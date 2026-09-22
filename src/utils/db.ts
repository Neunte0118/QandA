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

const DB_NAME = 'QuizDatabase';
const DB_VERSION = 1;

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
