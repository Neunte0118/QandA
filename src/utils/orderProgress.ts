import { QuizQuestion, QuestionStats } from '../types';

export interface OrderProgress {
  quizId: string;
  questionId: string;
  orderIndex: number;
  updatedAt: number;
}

const STORAGE_PREFIX = 'quiz_order_progress_v1_';

/**
 * Retrieve saved order progress for a category
 */
export function getOrderProgress(quizId: string): OrderProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + quizId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderProgress;
    if (parsed && typeof parsed.orderIndex === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save current order progress (active question ID and index) for a category
 */
export function saveOrderProgress(
  quizId: string,
  questionId: string,
  orderIndex: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const progress: OrderProgress = {
      quizId,
      questionId,
      orderIndex: Math.max(0, orderIndex),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_PREFIX + quizId, JSON.stringify(progress));
  } catch {}
}

/**
 * Clear order progress for a specific category
 */
export function clearOrderProgress(quizId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + quizId);
  } catch {}
}

/**
 * Clear order progress for all categories
 */
export function clearAllOrderProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Calculate the 0-based index in the given question list to resume order mode from.
 * 1. Matches saved questionId if present in questions.
 * 2. Falls back to saved orderIndex if in valid range.
 * 3. Falls back to finding the first unanswered question if contiguous questions were answered from index 0.
 * Returns 0 if no progress or at the start/end.
 */
export function calculateOrderResumeIndex(
  questions: QuizQuestion[],
  statsMap?: Map<string, QuestionStats>,
  savedProgress?: OrderProgress | null
): number {
  if (!questions || questions.length === 0) return 0;

  // 1. If explicit saved progress exists
  if (savedProgress) {
    // Priority: find by exact questionId
    if (savedProgress.questionId) {
      const foundIndex = questions.findIndex((q) => q.id === savedProgress.questionId);
      if (foundIndex >= 0 && foundIndex < questions.length) {
        return foundIndex;
      }
    }

    // Fallback: check if orderIndex is in valid range
    if (savedProgress.orderIndex >= 0 && savedProgress.orderIndex < questions.length) {
      return savedProgress.orderIndex;
    }
  }

  // 2. Fallback using statsMap: check if questions were sequentially answered from the beginning
  if (statsMap && statsMap.size > 0) {
    let contiguousAnswered = 0;
    for (let i = 0; i < questions.length; i++) {
      const stat = statsMap.get(questions[i].id);
      if (stat && stat.answered > 0) {
        contiguousAnswered++;
      } else {
        break;
      }
    }
    if (contiguousAnswered > 0 && contiguousAnswered < questions.length) {
      return contiguousAnswered;
    }
  }

  return 0;
}
