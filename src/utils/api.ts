import { QuizCategory, QuizQuestion } from '../types';
import { parseCSV } from './csvParser';
import {
  decryptCryptoJS,
  isEncryptedValue,
  normalizeEncryptedId,
  getSavedCredentials,
  saveCredential,
} from './crypto';

export const ROOT_SPREADSHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2TOUycdy4F_3qK07EseDUdwgfAHqkHmCprFwxJPHYLR2sL72zKuKO_GTXVWAVSC4UMIrA7P5Zh5s4/pub?gid=0&single=true&output=csv';

// Fallback questions based on the prompt's exact sample if the spreadsheet rows are currently blank
export const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: '01a0c89c-c163-704b-b339-b4e07d913958',
    question: '航海時代の到来のきっかけとなった、『<red>世界の記述</ red>』（『<em>東方見聞録</em>』）の著者は誰か。',
    answer: 'マルコ・ポーロ',
    importance: '5',
  },
  {
    id: '01a0c89c-c163-704b-b339-b9001a0c3777',
    question: '1492年、スペイン女王イサベルの支援を受けて大西洋を西に進み、<blue>サンサルバドル島</ blue>に到達した人物は誰か。',
    answer: '<blue>コロンブス</ blue>',
    importance: '5',
  },
  {
    id: '01a0c89c-c163-704b-b339-bcba581fdfae',
    question: '1498年、アフリカ南端の<yellow>喜望峰</ yellow>を回ってインド西岸の<green>カリカット</ green>に到達したポルトガルの航海者は誰か。',
    answer: '<green>ヴァスコ・ダ・ガマ</ green>',
    importance: '4',
  },
  {
    id: '01a0c89c-c163-704b-b339-c156d2923756',
    question: '1519年に出発し、南アメリカ南端を通過して<cyan>太平洋</ cyan>を横断、部下が史上初の世界周航を達成した<em>マゼラン船隊</em>の指揮者は誰か。',
    answer: '<color value="#0284c7">マゼラン</ color>',
    importance: '5',
  },
  {
    id: '01a0c89c-c163-704b-b339-c44a132a6c83',
    question: '1488年にポルトガル王ジョアン2世の命でアフリカ南端の喜望峰（<magenta>嵐の岬</ magenta>）に到達した航海者は誰か。',
    answer: '<magenta>バルトロメウ・ディアス</ magenta>',
    importance: '4',
  },
];

/**
 * Fetch raw CSV text, with basic cache-busting and error handling
 */
async function fetchCSVText(url: string): Promise<string> {
  // Add a cache-buster timestamp query param if not already present
  const separator = url.includes('?') ? '&' : '?';
  const fetchUrl = `${url}${separator}_t=${Date.now()}`;

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }
    return await res.text();
  } catch (err) {
    // If direct fetch fails (e.g., in strict origin restrictions), try without cache-buster
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load CSV: ${res.statusText}`);
    }
    return await res.text();
  }
}

export interface CategoriesResult {
  visibleCategories: QuizCategory[];
  lockedCategories: QuizCategory[];
}

/**
 * Fetches and parses the root categories sheet.
 * Encrypted categories whose titles start with "enc:" are hidden from visibleCategories
 * unless unlocked by stored credentials in localStorage.
 */
export async function fetchCategoriesWithLocked(
  rootUrl: string = ROOT_SPREADSHEET_CSV_URL
): Promise<CategoriesResult> {
  const csvText = await fetchCSVText(rootUrl);
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    throw new Error('CSVに有効な行が含まれていません');
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const idIndex = headers.findIndex((h) => h === 'id' || h.includes('id'));
  const titleIndex = headers.findIndex((h) => h.includes('title') || h.includes('タイトル'));
  const urlIndex = headers.findIndex((h) => h.includes('url'));

  const validIdIdx = idIndex !== -1 ? idIndex : 0;
  const validTitleIdx = titleIndex !== -1 ? titleIndex : (idIndex !== -1 ? 1 : 0);
  const validUrlIdx = urlIndex !== -1 ? urlIndex : (idIndex !== -1 ? 2 : 1);

  const visibleCategories: QuizCategory[] = [];
  const lockedCategories: QuizCategory[] = [];
  const savedCreds = getSavedCredentials();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawId = idIndex !== -1 ? row[validIdIdx]?.trim() : '';
    const rawTitle = row[validTitleIdx]?.trim();
    const url = row[validUrlIdx]?.trim();

    if (!rawTitle || !url || !url.startsWith('http')) {
      continue;
    }

    if (isEncryptedValue(rawTitle)) {
      // Encrypted category
      let matchedCred = savedCreds.find((c) => {
        if (c.id && rawId) {
          if (
            normalizeEncryptedId(c.id) === normalizeEncryptedId(rawId) ||
            c.id.trim() === rawId.trim()
          ) {
            return true;
          }
        }
        const decrypted = decryptCryptoJS(rawTitle, c.key);
        return (
          decrypted &&
          c.title &&
          decrypted.trim().toLowerCase() === c.title.trim().toLowerCase()
        );
      });

      // Try any saved credential if it can decrypt this title
      if (!matchedCred) {
        for (const cred of savedCreds) {
          const decrypted = decryptCryptoJS(rawTitle, cred.key);
          if (decrypted && decrypted.trim().length > 0) {
            matchedCred = { ...cred, title: decrypted.trim(), id: cred.id || rawId };
            break;
          }
        }
      }

      if (matchedCred) {
        // Successfully unlocked with local stored key!
        const plainTitle = decryptCryptoJS(rawTitle, matchedCred.key) || rawTitle;
        const plainId = rawId && isEncryptedValue(rawId)
          ? (decryptCryptoJS(rawId, matchedCred.key) || rawId)
          : (rawId || `quiz-${encodeURIComponent(plainTitle)}`);

        visibleCategories.push({
          id: plainId,
          title: plainTitle,
          url,
          isEncrypted: true,
          decryptionKey: matchedCred.key,
          rawTitle,
          rawId,
        });
      } else {
        // Not unlocked yet - hide from visible categories list
        lockedCategories.push({
          id: rawId || `enc-quiz-${i}`,
          title: rawTitle,
          url,
          isEncrypted: true,
          rawTitle,
          rawId,
        });
      }
    } else {
      // Normal unencrypted category
      const id = rawId || (rawTitle ? `quiz-${encodeURIComponent(rawTitle)}` : `quiz-${i}`);
      visibleCategories.push({
        id,
        title: rawTitle,
        url,
        isEncrypted: false,
      });
    }
  }

  if (visibleCategories.length === 0 && lockedCategories.length === 0) {
    // Fallback if formatting differed slightly
    return {
      visibleCategories: [
        {
          id: '01a0c8d8-3960-720a-a4dc-f3dcb40005cc',
          title: '後期期末世界史',
          url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2TOUycdy4F_3qK07EseDUdwgfAHqkHmCprFwxJPHYLR2sL72zKuKO_GTXVWAVSC4UMIrA7P5Zh5s4/pub?gid=601855841&single=true&output=csv',
        },
      ],
      lockedCategories: [],
    };
  }

  return { visibleCategories, lockedCategories };
}

/**
 * Backward-compatible fetchCategories returning only visible/unlocked categories
 */
export async function fetchCategories(
  rootUrl: string = ROOT_SPREADSHEET_CSV_URL
): Promise<QuizCategory[]> {
  const res = await fetchCategoriesWithLocked(rootUrl);
  return res.visibleCategories;
}

/**
 * Attempt to unlock an encrypted category from locked list using user-entered encrypted ID & decryption key
 */
export function tryUnlockEncryptedCategory(
  idInput: string,
  keyInput: string,
  lockedCategories: QuizCategory[]
): { success: true; unlockedCategory: QuizCategory } | { success: false; error: string } {
  const targetId = idInput.trim().replace(/^["']|["']$/g, '').trim();
  const cleanKey = keyInput.trim().replace(/^["']|["']$/g, '').trim();

  if (!targetId) {
    return { success: false, error: 'IDを入力してください' };
  }
  if (!cleanKey) {
    return { success: false, error: '復号キーを入力してください' };
  }

  const normInputId = normalizeEncryptedId(targetId);

  // 1. Find matching category among locked categories
  let matchedLocked: QuizCategory | undefined = lockedCategories.find((locked) => {
    if (locked.rawId) {
      const cleanRawId = locked.rawId.trim().replace(/^["']|["']$/g, '').trim();
      if (
        cleanRawId.toLowerCase() === targetId.toLowerCase() ||
        normalizeEncryptedId(cleanRawId) === normInputId
      ) {
        return true;
      }
    }
    if (locked.id) {
      const cleanId = locked.id.trim().replace(/^["']|["']$/g, '').trim();
      if (
        cleanId.toLowerCase() === targetId.toLowerCase() ||
        normalizeEncryptedId(cleanId) === normInputId
      ) {
        return true;
      }
    }
    // Also allow if user passed the raw encrypted title by mistake
    if (locked.rawTitle && normalizeEncryptedId(locked.rawTitle) === normInputId) {
      return true;
    }
    return false;
  });

  // 1b. If not found by direct ID string, test if targetId matches a decrypted rawId
  if (!matchedLocked) {
    for (const locked of lockedCategories) {
      if (locked.rawId && isEncryptedValue(locked.rawId)) {
        const decryptedId = decryptCryptoJS(locked.rawId, cleanKey);
        if (
          decryptedId &&
          (decryptedId.trim().toLowerCase() === targetId.toLowerCase() ||
            normalizeEncryptedId(decryptedId) === normInputId)
        ) {
          matchedLocked = locked;
          break;
        }
      }
    }
  }

  // 1c. If still not matched, check if cleanKey successfully decrypts a locked category's title
  if (!matchedLocked) {
    for (const locked of lockedCategories) {
      if (locked.rawTitle) {
        const testDecrypted = decryptCryptoJS(locked.rawTitle, cleanKey);
        if (testDecrypted && testDecrypted.trim().length > 0) {
          matchedLocked = locked;
          break;
        }
      }
    }
  }

  if (!matchedLocked) {
    return {
      success: false,
      error: '一致する問題が見つかりませんでした。IDと復号キーをご確認ください。',
    };
  }

  // 2. Validate decryption key by decrypting title
  const decryptedTitle = decryptCryptoJS(matchedLocked.rawTitle || '', cleanKey);
  if (!decryptedTitle) {
    return {
      success: false,
      error: 'IDは見つかりましたが、復号キーが正しくありません。',
    };
  }

  const decryptedId =
    matchedLocked.rawId && isEncryptedValue(matchedLocked.rawId)
      ? decryptCryptoJS(matchedLocked.rawId, cleanKey) || matchedLocked.rawId
      : matchedLocked.id;

  // 3. Save credential with ID and Title
  saveCredential(matchedLocked.rawId || matchedLocked.id, decryptedTitle.trim(), cleanKey);

  return {
    success: true,
    unlockedCategory: {
      id: decryptedId,
      title: decryptedTitle.trim(),
      url: matchedLocked.url,
      isEncrypted: true,
      decryptionKey: cleanKey,
      rawTitle: matchedLocked.rawTitle,
      rawId: matchedLocked.rawId,
    },
  };
}

/**
 * Fetches and parses questions for a selected category URL, decrypting if necessary
 */
export async function fetchQuestions(
  url: string,
  decryptionKey?: string
): Promise<{ questions: QuizQuestion[]; isUsingFallback: boolean }> {
  try {
    const csvText = await fetchCSVText(url);
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return { questions: SAMPLE_QUESTIONS, isUsingFallback: true };
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const idIdx = headers.findIndex((h) => h === 'id' || h.includes('id'));
    const questionIdx = headers.findIndex((h) => h === 'question' || h.includes('question') || h.includes('問題'));
    const answerIdx = headers.findIndex((h) => h === 'answer' || h.includes('answer') || h.includes('解答') || h.includes('答え'));
    const importanceIdx = headers.findIndex(
      (h) => h === 'importance' || h.includes('importance') || h.includes('重要度')
    );

    const qIdx = questionIdx !== -1 ? questionIdx : 1;
    const aIdx = answerIdx !== -1 ? answerIdx : 2;
    const iIdx = idIdx !== -1 ? idIdx : 0;
    const impIdx = importanceIdx !== -1 ? importanceIdx : 3;

    const questions: QuizQuestion[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      let id = row[iIdx]?.trim() || `q-${i}`;
      let question = row[qIdx]?.trim();
      let answer = row[aIdx]?.trim();
      const importance = row[impIdx]?.trim() || '3';

      if (!question || !answer) {
        continue;
      }

      // Decrypt ID if encrypted
      if (isEncryptedValue(id) && decryptionKey) {
        const decryptedId = decryptCryptoJS(id, decryptionKey);
        if (decryptedId) id = decryptedId;
      }

      // Decrypt question if encrypted
      if (isEncryptedValue(question)) {
        if (decryptionKey) {
          const decrypted = decryptCryptoJS(question, decryptionKey);
          question = decrypted ?? '[復号失敗: キーが異なります]';
        } else {
          question = '[暗号化された問題 - 復号キーが必要です]';
        }
      }

      // Decrypt answer if encrypted
      if (isEncryptedValue(answer)) {
        if (decryptionKey) {
          const decrypted = decryptCryptoJS(answer, decryptionKey);
          answer = decrypted ?? '[復号失敗: キーが異なります]';
        } else {
          answer = '[暗号化された解答 - 復号キーが必要です]';
        }
      }

      questions.push({
        id,
        question,
        answer,
        importance,
      });
    }

    if (questions.length === 0) {
      return { questions: SAMPLE_QUESTIONS, isUsingFallback: true };
    }

    return { questions, isUsingFallback: false };
  } catch (error) {
    console.error('Failed to fetch questions CSV:', error);
    return { questions: SAMPLE_QUESTIONS, isUsingFallback: true };
  }
}

