import { QuizCategory, QuizQuestion } from '../types';
import { parseCSV } from './csvParser';

export const ROOT_SPREADSHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2TOUycdy4F_3qK07EseDUdwgfAHqkHmCprFwxJPHYLR2sL72zKuKO_GTXVWAVSC4UMIrA7P5Zh5s4/pub?gid=0&single=true&output=csv';

// Fallback questions based on the prompt's exact sample if the spreadsheet rows are currently blank
export const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: '01a0c89c-c163-704b-b339-b4e07d913958',
    question: '航海時代の到来のきっかけとなった、『世界の記述』（『東方見聞録』）の著者は誰か。',
    answer: 'マルコ・ポーロ',
    importance: '5',
  },
  {
    id: '01a0c89c-c163-704b-b339-b9001a0c3777',
    question: '1492年、スペイン女王イサベルの支援を受けて大西洋を西に進み、サンサルバドル島に到達した人物は誰か。',
    answer: 'コロンブス',
    importance: '5',
  },
  {
    id: '01a0c89c-c163-704b-b339-bcba581fdfae',
    question: '1498年、アフリカ南端の喜望峰を回ってインド西岸のカリカットに到達したポルトガルの航海者は誰か。',
    answer: 'ヴァスコ・ダ・ガマ',
    importance: '4',
  },
  {
    id: '01a0c89c-c163-704b-b339-c156d2923756',
    question: '1519年に出発し、南アメリカ南端を通過して太平洋を横断、部下が史上初の世界周航を達成した人物は誰か。',
    answer: 'マゼラン',
    importance: '5',
  },
  {
    id: '01a0c89c-c163-704b-b339-c44a132a6c83',
    question: '1488年にポルトガル王ジョアン2世の命でアフリカ南端の喜望峰（嵐の岬）に到達した航海者は誰か。',
    answer: 'バルトロメウ・ディアス',
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

/**
 * Fetches and parses the root categories sheet
 */
export async function fetchCategories(
  rootUrl: string = ROOT_SPREADSHEET_CSV_URL
): Promise<QuizCategory[]> {
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

  const categories: QuizCategory[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawId = idIndex !== -1 ? row[validIdIdx]?.trim() : '';
    const title = row[validTitleIdx]?.trim();
    const url = row[validUrlIdx]?.trim();
    const id = rawId || (title ? `quiz-${encodeURIComponent(title)}` : `quiz-${i}`);

    if (title && url && url.startsWith('http')) {
      categories.push({ id, title, url });
    }
  }

  if (categories.length === 0) {
    // Fallback if formatting differed slightly
    return [
      {
        id: '01a0c8d8-3960-720a-a4dc-f3dcb40005cc',
        title: '後期期末世界史',
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2TOUycdy4F_3qK07EseDUdwgfAHqkHmCprFwxJPHYLR2sL72zKuKO_GTXVWAVSC4UMIrA7P5Zh5s4/pub?gid=601855841&single=true&output=csv',
      },
    ];
  }

  return categories;
}

/**
 * Fetches and parses questions for a selected category URL
 */
export async function fetchQuestions(
  url: string
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
      const id = row[iIdx]?.trim() || `q-${i}`;
      const question = row[qIdx]?.trim();
      const answer = row[aIdx]?.trim();
      const importance = row[impIdx]?.trim() || '3';

      // Only add if question and answer are non-empty
      if (question && answer) {
        questions.push({
          id,
          question,
          answer,
          importance,
        });
      }
    }

    if (questions.length === 0) {
      // The sheet was fetched successfully, but all question/answer fields are currently blank!
      return { questions: SAMPLE_QUESTIONS, isUsingFallback: true };
    }

    return { questions, isUsingFallback: false };
  } catch (error) {
    console.error('Failed to fetch questions CSV:', error);
    return { questions: SAMPLE_QUESTIONS, isUsingFallback: true };
  }
}
