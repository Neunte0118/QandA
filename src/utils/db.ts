import { QuizQuestion } from '../types';

export interface QuizStats {
  quizId: string;
  shown: number;
}

export interface QuestionStats {
  quizId: string;
  questionId: string;
  answered: number;
  correct: number;
  lastShown: number; // timestamp
}

export interface CachedCSVEntry {
  url: string;
  csvText: string;
  timestamp: number;
}

export interface CachedQuestionsEntry {
  key: string;
  questions: QuizQuestion[];
  hash?: string;
  timestamp: number;
}

const DB_NAME = 'QuizDatabase';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. quizStats store (key: quizId)
      if (!db.objectStoreNames.contains('quizStats')) {
        db.createObjectStore('quizStats', { keyPath: 'quizId' });
      }

      // 2. questionStats store (compound key: [quizId, questionId])
      if (!db.objectStoreNames.contains('questionStats')) {
        db.createObjectStore('questionStats', { keyPath: ['quizId', 'questionId'] });
      }

      // 3. csvCache store (key: url)
      if (!db.objectStoreNames.contains('csvCache')) {
        db.createObjectStore('csvCache', { keyPath: 'url' });
      }

      // 4. questionsCache store (key: key)
      if (!db.objectStoreNames.contains('questionsCache')) {
        db.createObjectStore('questionsCache', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

const LS_CSV_PREFIX = 'quiz_csv_cache_';
const LS_QUESTIONS_PREFIX = 'quiz_questions_cache_';

/**
 * Get cached CSV text by URL (IndexedDB with localStorage fallback)
 */
export async function getCachedCSV(url: string): Promise<string | null> {
  try {
    const db = await getDB();
    const result = await new Promise<CachedCSVEntry | undefined>((resolve) => {
      try {
        const tx = db.transaction('csvCache', 'readonly');
        const store = tx.objectStore('csvCache');
        const req = store.get(url);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });

    if (result && result.csvText) {
      return result.csvText;
    }
  } catch {}

  // Fallback to localStorage
  try {
    const lsItem = localStorage.getItem(LS_CSV_PREFIX + url);
    if (lsItem) {
      const parsed = JSON.parse(lsItem);
      return parsed.csvText || null;
    }
  } catch {}

  return null;
}

/**
 * Cache CSV text by URL
 */
export async function setCachedCSV(url: string, csvText: string): Promise<void> {
  const entry: CachedCSVEntry = {
    url,
    csvText,
    timestamp: Date.now(),
  };

  try {
    const db = await getDB();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('csvCache', 'readwrite');
        const store = tx.objectStore('csvCache');
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}

  // Also save to localStorage
  try {
    localStorage.setItem(LS_CSV_PREFIX + url, JSON.stringify(entry));
  } catch {}
}

/**
 * Get cached questions and tags by cache key, optionally validating against expected hash
 */
export async function getCachedQuestions(
  key: string,
  expectedHash?: string
): Promise<QuizQuestion[] | null> {
  try {
    const db = await getDB();
    const result = await new Promise<CachedQuestionsEntry | undefined>((resolve) => {
      try {
        const tx = db.transaction('questionsCache', 'readonly');
        const store = tx.objectStore('questionsCache');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });

    if (result && result.questions && result.questions.length > 0) {
      if (expectedHash !== undefined && expectedHash !== '') {
        // Compare hash: if matching, cache is valid!
        if (result.hash === expectedHash) {
          return result.questions;
        }
        // Hash changed: cache is stale, return null to force re-fetch
        return null;
      }
      return result.questions;
    }
  } catch {}

  // Fallback to localStorage
  try {
    const lsItem = localStorage.getItem(LS_QUESTIONS_PREFIX + key);
    if (lsItem) {
      const parsed = JSON.parse(lsItem) as CachedQuestionsEntry;
      if (parsed && parsed.questions && parsed.questions.length > 0) {
        if (expectedHash !== undefined && expectedHash !== '') {
          if (parsed.hash === expectedHash) {
            return parsed.questions;
          }
          return null;
        }
        return parsed.questions;
      }
    }
  } catch {}

  return null;
}

/**
 * Cache parsed questions and tags by cache key with optional hash
 */
export async function setCachedQuestions(
  key: string,
  questions: QuizQuestion[],
  hash?: string
): Promise<void> {
  const entry: CachedQuestionsEntry = {
    key,
    questions,
    hash,
    timestamp: Date.now(),
  };

  try {
    const db = await getDB();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('questionsCache', 'readwrite');
        const store = tx.objectStore('questionsCache');
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}

  // Also save to localStorage
  try {
    localStorage.setItem(LS_QUESTIONS_PREFIX + key, JSON.stringify(entry));
  } catch {}
}

/**
 * Get quizStats for a specific quizId
 */
export async function getQuizStats(quizId: string): Promise<QuizStats> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizStats', 'readonly');
    const store = transaction.objectStore('quizStats');
    const request = store.get(quizId);

    request.onsuccess = () => {
      resolve(request.result || { quizId, shown: 0 });
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Increment shown count in quizStats
 */
export async function incrementQuizShown(quizId: string): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizStats', 'readwrite');
    const store = transaction.objectStore('quizStats');
    const getReq = store.get(quizId);

    getReq.onsuccess = () => {
      const current: QuizStats = getReq.result || { quizId, shown: 0 };
      const updated: QuizStats = { ...current, shown: current.shown + 1 };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated.shown);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Get stats for all questions belonging to a quizId
 */
export async function getQuizQuestionStatsMap(
  quizId: string
): Promise<Map<string, QuestionStats>> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('questionStats', 'readonly');
    const store = transaction.objectStore('questionStats');
    const request = store.openCursor();
    const statsMap = new Map<string, QuestionStats>();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const val = cursor.value as QuestionStats;
        if (val.quizId === quizId) {
          statsMap.set(val.questionId, val);
        }
        cursor.continue();
      } else {
        resolve(statsMap);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Record an answer result (correct/incorrect) for a specific question
 */
export async function recordQuestionAnswer(
  quizId: string,
  questionId: string,
  isCorrect: boolean
): Promise<QuestionStats> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('questionStats', 'readwrite');
    const store = transaction.objectStore('questionStats');
    const getReq = store.get([quizId, questionId]);

    getReq.onsuccess = () => {
      const current: QuestionStats = getReq.result || {
        quizId,
        questionId,
        answered: 0,
        correct: 0,
        lastShown: 0,
      };

      const updated: QuestionStats = {
        quizId,
        questionId,
        answered: current.answered + 1,
        correct: current.correct + (isCorrect ? 1 : 0),
        lastShown: Date.now(),
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Reset stats for a quiz if needed
 */
export async function resetQuizStats(quizId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['quizStats', 'questionStats'], 'readwrite');
    const quizStore = transaction.objectStore('quizStats');
    quizStore.delete(quizId);

    const questionStore = transaction.objectStore('questionStats');
    const cursorReq = questionStore.openCursor();
    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const val = cursor.value as QuestionStats;
        if (val.quizId === quizId) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Clear all learning data completely (all quizStats and all questionStats)
 */
export async function clearAllLearningData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['quizStats', 'questionStats'], 'readwrite');
    const quizStore = transaction.objectStore('quizStats');
    const questionStore = transaction.objectStore('questionStats');
    quizStore.clear();
    questionStore.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

