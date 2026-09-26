import { QuizCategory, QuizQuestion, TagDetail } from '../types';
import { parseCSV } from './csvParser';
import {
  decryptCryptoJS,
  isEncryptedValue,
  normalizeEncryptedId,
  getSavedCredentials,
  saveCredential,
} from './crypto';
import {
  getCachedCSV,
  setCachedCSV,
  getCachedQuestions,
  setCachedQuestions,
} from './db';

export const ROOT_SPREADSHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2TOUycdy4F_3qK07EseDUdwgfAHqkHmCprFwxJPHYLR2sL72zKuKO_GTXVWAVSC4UMIrA7P5Zh5s4/pub?gid=0&single=true&output=csv';

// Fallback questions based on the prompt's exact sample if the spreadsheet rows are currently blank
export const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: '01a0c89c-c163-704b-b339-b4e07d913958',
    question: '航海時代の到来のきっかけとなった、『<red>世界の記述</ red>』（『<em>東方見聞録</em>』）の著者は誰か。',
    answer: 'マルコ・ポーロ',
    importance: '5',
    tags: ['大航海時代', '旅行記'],
    tagDetails: [
      { category: '時代', tag: '大航海時代' },
      { category: '分野', tag: '旅行記' },
    ],
  },
  {
    id: '01a0c89c-c163-704b-b339-b9001a0c3777',
    question: '1492年、スペイン女王イサベルの支援を受けて大西洋を西に進み、<blue>サンサルバドル島</ blue>に到達した人物は誰か。',
    answer: '<blue>コロンブス</ blue>',
    importance: '5',
    tags: ['大航海時代', 'スペイン'],
    tagDetails: [
      { category: '時代', tag: '大航海時代' },
      { category: '国', tag: 'スペイン' },
    ],
  },
  {
    id: '01a0c89c-c163-704b-b339-bcba581fdfae',
    question: '1498年、アフリカ南端の<yellow>喜望峰</ yellow>を回ってインド西岸の<green>カリカット</ green>に到達したポルトガルの航海者は誰か。',
    answer: '<green>ヴァスコ・ダ・ガマ</ green>',
    importance: '4',
    tags: ['大航海時代', 'ポルトガル'],
    tagDetails: [
      { category: '時代', tag: '大航海時代' },
      { category: '国', tag: 'ポルトガル' },
    ],
  },
  {
    id: '01a0c89c-c163-704b-b339-c156d2923756',
    question: '1519年に出発し、南アメリカ南端を通過して<cyan>太平洋</ cyan>を横断、部下が史上初の世界周航を達成した<em>マゼラン船隊</em>の指揮者は誰か。',
    answer: '<color value="#0284c7">マゼラン</ color>',
    importance: '5',
    tags: ['大航海時代', '世界周航'],
    tagDetails: [
      { category: '時代', tag: '大航海時代' },
      { category: '分野', tag: '世界周航' },
    ],
  },
  {
    id: '01a0c89c-c163-704b-b339-c44a132a6c83',
    question: '1488年にポルトガル王ジョアン2世の命でアフリカ南端の喜望峰（<magenta>嵐の岬</ magenta>）に到達した航海者は誰か。',
    answer: '<magenta>バルトロメウ・ディアス</ magenta>',
    importance: '4',
    tags: ['大航海時代', 'ポルトガル'],
    tagDetails: [
      { category: '時代', tag: '大航海時代' },
      { category: '国', tag: 'ポルトガル' },
    ],
  },
];

/**
 * Normalizes and deduplicates tags for display and storage.
 * Eliminates duplicates between raw tags (e.g. 'イタリア') and category-prefixed tags (e.g. '国:イタリア').
 */
export function getDisplayTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Strip category prefix if present (e.g. '国:イタリア' -> 'イタリア')
    let clean = trimmed;
    if (trimmed.includes(':') || trimmed.includes('：')) {
      const parts = trimmed.split(/[:：]/);
      clean = parts.slice(1).join(':').trim() || trimmed;
    }

    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }

  return result;
}

/**
 * Fetch raw CSV text with cache-first and background revalidation support
 */
async function fetchCSVText(url: string, forceRefresh: boolean = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await getCachedCSV(url);
    if (cached) {
      return cached;
    }
  }

  // Add a cache-buster timestamp query param
  const separator = url.includes('?') ? '&' : '?';
  const fetchUrl = `${url}${separator}_t=${Date.now()}`;

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    await setCachedCSV(url, text);
    return text;
  } catch (err) {
    // If cache-buster fetch fails, try without cache-buster
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        await setCachedCSV(url, text);
        return text;
      }
    } catch {}

    // Fall back to cached CSV if network failed completely
    const fallbackCached = await getCachedCSV(url);
    if (fallbackCached) {
      return fallbackCached;
    }

    throw new Error(`Failed to load CSV: ${err instanceof Error ? err.message : String(err)}`);
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
  rootUrl: string = ROOT_SPREADSHEET_CSV_URL,
  forceRefresh: boolean = false
): Promise<CategoriesResult> {
  const csvText = await fetchCSVText(rootUrl, forceRefresh);
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    throw new Error('CSVに有効な行が含まれていません');
  }

  const rawHeaders = rows[0].map((h) => h.trim());
  const normHeaders = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[\s_\-]/g, '')
  );

  const titleIdIndex = normHeaders.findIndex(
    (h) => h === 'titleid' || h === 'categoryid' || h === '単元id'
  );
  const idIndex = titleIdIndex !== -1
    ? titleIdIndex
    : normHeaders.findIndex((h) => h === 'id' || h === '単元番号');

  const hashIndex = normHeaders.findIndex(
    (h) => h === 'hash' || h === 'ハッシュ' || h === 'version' || h === 'ver'
  );

  const urlIndex = normHeaders.findIndex(
    (h) => h.includes('url') || h.includes('リンク') || h.includes('link')
  );

  const titleIndex = normHeaders.findIndex(
    (h, idx) =>
      idx !== idIndex &&
      idx !== hashIndex &&
      idx !== urlIndex &&
      (h === 'title' || h === 'タイトル' || h === '単元' || h === '単元名')
  );

  const validIdIdx = idIndex !== -1 ? idIndex : 0;
  const validTitleIdx = titleIndex !== -1 ? titleIndex : (idIndex !== -1 ? 1 : 0);
  const validHashIdx = hashIndex;
  const validUrlIdx =
    urlIndex !== -1
      ? urlIndex
      : (validHashIdx !== -1 ? (validHashIdx < 3 ? 3 : 2) : (idIndex !== -1 ? 2 : 1));

  const visibleCategories: QuizCategory[] = [];
  const lockedCategories: QuizCategory[] = [];
  const savedCreds = getSavedCredentials();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawId = idIndex !== -1 ? row[validIdIdx]?.trim() : '';
    const rawTitle = row[validTitleIdx]?.trim();
    const rawHash = validHashIdx !== -1 ? row[validHashIdx]?.trim() : undefined;
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
          titleId: plainId,
          title: plainTitle,
          url,
          hash: rawHash,
          isEncrypted: true,
          decryptionKey: matchedCred.key,
          rawTitle,
          rawId,
        });
      } else {
        // Not unlocked yet - hide from visible categories list
        lockedCategories.push({
          id: rawId || `enc-quiz-${i}`,
          titleId: rawId || `enc-quiz-${i}`,
          title: rawTitle,
          url,
          hash: rawHash,
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
        titleId: id,
        title: rawTitle,
        url,
        hash: rawHash,
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
      hash: matchedLocked.hash,
      isEncrypted: true,
      decryptionKey: cleanKey,
      rawTitle: matchedLocked.rawTitle,
      rawId: matchedLocked.rawId,
    },
  };
}

/**
 * Fetches and parses questions for a selected category URL, decrypting if necessary,
 * validating against expectedHash to avoid redundant network fetches if unchanged.
 */
export async function fetchQuestions(
  url: string,
  decryptionKey?: string,
  titleId?: string,
  expectedHash?: string,
  forceRefresh: boolean = false
): Promise<{ questions: QuizQuestion[]; isUsingFallback: boolean }> {
  const buildFallback = (): QuizQuestion[] => {
    return SAMPLE_QUESTIONS.map((q) => {
      const fullId = titleId
        ? (q.id.startsWith(`${titleId}-`) ? q.id : `${titleId}-${q.id}`)
        : q.id;
      return {
        ...q,
        id: fullId,
        questionId: q.id,
        titleId: titleId || '',
        tags: q.tags || [],
        tagDetails: q.tagDetails || [],
      };
    });
  };

  const cacheKey = `qcache_v2_${titleId || ''}_${url}_${decryptionKey || ''}`;

  if (!forceRefresh) {
    // Compare hash with cached entry: if matching, use cache immediately
    const cachedQuestions = await getCachedQuestions(cacheKey, expectedHash);
    if (cachedQuestions && cachedQuestions.length > 0) {
      // Ensure tags in cached questions are cleanly deduplicated
      const cleaned = cachedQuestions.map((q) => ({
        ...q,
        tags: getDisplayTags(q.tags),
      }));
      return { questions: cleaned, isUsingFallback: false };
    }
  }

  try {
    // If refreshing because hash changed or forceRefresh is true, bypass old CSV cache
    const shouldBypassCsv = forceRefresh || (expectedHash !== undefined && expectedHash !== '');
    const csvText = await fetchCSVText(url, shouldBypassCsv);
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return { questions: buildFallback(), isUsingFallback: true };
    }

    const rawHeaders = rows[0].map((h) => h.trim());
    const normHeaders = rawHeaders.map((h) =>
      h.toLowerCase().replace(/[\s_\-]/g, '')
    );

    // 1. Find question_id column
    let idIdx = normHeaders.findIndex(
      (h) => h === 'questionid' || h === 'qid' || h === 'id' || h === '問題id' || h === '問題番号'
    );
    if (idIdx === -1) {
      idIdx = normHeaders.findIndex(
        (h) => h.includes('questionid') || (h.endsWith('id') && !h.includes('title'))
      );
    }

    // 2. Find question column (strictly exclude the id column!)
    let questionIdx = normHeaders.findIndex(
      (h, idx) =>
        idx !== idIdx &&
        (h === 'question' || h === 'q' || h === '問題' || h === '問題文' || h === '設問')
    );
    if (questionIdx === -1) {
      questionIdx = normHeaders.findIndex(
        (h, idx) =>
          idx !== idIdx &&
          (h.includes('question') || h.includes('問題') || h.includes('設問')) &&
          !h.includes('id') &&
          !h.includes('番号')
      );
    }

    // 3. Find answer column
    let answerIdx = normHeaders.findIndex(
      (h, idx) =>
        idx !== idIdx &&
        idx !== questionIdx &&
        (h === 'answer' || h === 'ans' || h === 'a' || h === '解答' || h === '答え' || h === '正解')
    );
    if (answerIdx === -1) {
      answerIdx = normHeaders.findIndex(
        (h, idx) =>
          idx !== idIdx &&
          idx !== questionIdx &&
          (h.includes('answer') || h.includes('解答') || h.includes('答え') || h.includes('正解'))
      );
    }

    // 4. Find importance column
    let importanceIdx = normHeaders.findIndex(
      (h, idx) =>
        idx !== idIdx &&
        idx !== questionIdx &&
        idx !== answerIdx &&
        (h === 'importance' || h === 'imp' || h === '重要度' || h === '重要' || h === '難易度' || h === 'レベル')
    );
    if (importanceIdx === -1) {
      importanceIdx = normHeaders.findIndex(
        (h, idx) =>
          idx !== idIdx &&
          idx !== questionIdx &&
          idx !== answerIdx &&
          (h.includes('importance') || h.includes('重要') || h.includes('難易度'))
      );
    }

    // Fallbacks if headers were not recognized
    const iIdx = idIdx !== -1 ? idIdx : 0;
    const qIdx = questionIdx !== -1 ? questionIdx : (iIdx === 0 ? 1 : 0);
    const aIdx = answerIdx !== -1 ? answerIdx : (qIdx === 1 ? 2 : 1);
    const impIdx = importanceIdx !== -1 ? importanceIdx : (aIdx === 2 ? 3 : -1);

    // Tag columns are strictly all columns other than ID, Question, Answer, Importance
    const baseColIndices = new Set([iIdx, qIdx, aIdx]);
    if (impIdx !== -1) baseColIndices.add(impIdx);

    const tagColIndices: number[] = [];
    for (let c = 0; c < rows[0].length; c++) {
      if (!baseColIndices.has(c)) {
        tagColIndices.push(c);
      }
    }

    const questions: QuizQuestion[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawQuestionId = (iIdx !== -1 ? row[iIdx]?.trim() : '') || `q-${i}`;
      let qId = rawQuestionId;
      let question = row[qIdx]?.trim();
      let answer = row[aIdx]?.trim();
      const importance = row[impIdx]?.trim() || '3';
      const isEncryptedId = isEncryptedValue(rawQuestionId);
      const isEncryptedQ = isEncryptedValue(question);

      if (!question || !answer) {
        continue;
      }

      // Decrypt ID if encrypted
      if (isEncryptedId && decryptionKey) {
        const decryptedId = decryptCryptoJS(qId, decryptionKey);
        if (decryptedId) qId = decryptedId;
      }

      // Format ID as {title_id}-{question_id}
      let fullId = qId;
      if (titleId) {
        if (qId.startsWith(`${titleId}-`)) {
          fullId = qId;
        } else {
          fullId = `${titleId}-${qId}`;
        }
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

      // Parse tags and tagDetails (with 大分類 / category) for this row
      const tags: string[] = [];
      const tagDetails: TagDetail[] = [];

      for (const colIdx of tagColIndices) {
        let val = row[colIdx]?.trim();
        if (!val) continue;

        if (isEncryptedValue(val) && decryptionKey) {
          const dec = decryptCryptoJS(val, decryptionKey);
          if (dec) val = dec.trim();
        }

        const lowerVal = val.toLowerCase();
        // Negative indicators: skip this tag
        if (['0', 'false', 'no', 'n', 'f', 'x', '×', '-', 'none'].includes(lowerVal)) {
          continue;
        }

        const rawHeader = rows[0][colIdx]?.trim() || '';
        // Extract groupCategory (大分類) and defaultTagName
        let groupCategory = rawHeader;
        let defaultTagName = rawHeader;
        if (rawHeader.includes(':') || rawHeader.includes('：')) {
          const parts = rawHeader.split(/[:：]/);
          groupCategory = parts[0].trim();
          defaultTagName = parts.slice(1).join(':').trim() || groupCategory;
        }

        // If the cell contains an indicator like 1, true, ○, 〇, etc., use defaultTagName as tag
        if (['1', 'true', 'yes', 'y', 't', '〇', '○', 'o', 'v', '✓', 'check', 'checked'].includes(lowerVal)) {
          const tagName = defaultTagName;
          if (tagName && !tags.includes(tagName)) {
            tags.push(tagName);
          }
          if (tagName && !tagDetails.some((td) => td.category === groupCategory && td.tag === tagName)) {
            tagDetails.push({ category: groupCategory, tag: tagName });
          }
        } else {
          // If value is comma or slash separated, split into individual tags
          const parts = val.split(/[,/、/]+/).map((p) => p.trim()).filter(Boolean);
          for (const p of parts) {
            let itemTag = p;
            let itemCat = groupCategory;
            // Handle if value itself includes category prefix (e.g. '国:イタリア')
            if (p.includes(':') || p.includes('：')) {
              const pParts = p.split(/[:：]/);
              itemCat = pParts[0].trim() || groupCategory;
              itemTag = pParts.slice(1).join(':').trim() || p;
            }
            if (itemTag && !tags.includes(itemTag)) {
              tags.push(itemTag);
            }
            if (itemTag && !tagDetails.some((td) => td.category === itemCat && td.tag === itemTag)) {
              tagDetails.push({ category: itemCat, tag: itemTag });
            }
          }
        }
      }

      const deduplicatedTags = getDisplayTags(tags);

      questions.push({
        id: fullId,
        rawId: rawQuestionId,
        questionId: qId,
        titleId: titleId || '',
        question,
        answer,
        importance,
        tags: deduplicatedTags,
        tagDetails,
        isEncrypted: isEncryptedId || isEncryptedQ,
      });
    }

    if (questions.length === 0) {
      return { questions: buildFallback(), isUsingFallback: true };
    }

    // Cache the parsed questions along with the hash
    await setCachedQuestions(cacheKey, questions, expectedHash);

    return { questions, isUsingFallback: false };
  } catch (error) {
    console.error('Failed to fetch questions CSV:', error);

    // Fall back to cached questions if network fails
    const cachedQuestions = await getCachedQuestions(cacheKey);
    if (cachedQuestions && cachedQuestions.length > 0) {
      return { questions: cachedQuestions, isUsingFallback: false };
    }

    return { questions: buildFallback(), isUsingFallback: true };
  }
}

