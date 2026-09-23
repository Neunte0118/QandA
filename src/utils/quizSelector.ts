import { QuizQuestion, QuestionStats } from '../types';

/**
 * Parses the importance string into a positive number (default 3 if missing or unrecognized).
 * Handles numbers ('5', '4', '3', '2') as well as stars ('★★★', '★★★★★').
 */
export function parseImportance(val: string | undefined): number {
  if (!val) return 3;
  const str = String(val).trim();
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    return Math.max(1, Math.min(10, num));
  }
  const stars = (str.match(/[★☆]/g) || []).length;
  if (stars > 0) return stars;
  return 3;
}

/**
 * Weighted random selection based on question importance.
 * Higher importance questions have proportionally higher probability of being drawn.
 */
function pickWeightedByImportance(questions: QuizQuestion[]): QuizQuestion {
  if (questions.length <= 1) return questions[0];

  const weights = questions.map((q) => parseImportance(q.importance));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let randomVal = Math.random() * totalWeight;

  for (let i = 0; i < questions.length; i++) {
    if (randomVal < weights[i]) {
      return questions[i];
    }
    randomVal -= weights[i];
  }

  return questions[questions.length - 1];
}

/**
 * Select next question incorporating:
 * 1. Adaptive review probability = (1 - これまでの正答率)
 * 2. Importance weighting for new questions (higher importance appears earlier)
 * 3. Importance weighting for review questions (higher importance prioritized among mistakes)
 */
export function selectNextQuestion(
  allQuestions: QuizQuestion[],
  statsMap: Map<string, QuestionStats>,
  _shown: number,
  previousQuestionId?: string
): { question: QuizQuestion; isReview: boolean } {
  if (allQuestions.length === 0) {
    throw new Error('No questions available');
  }

  if (allQuestions.length === 1) {
    const isAnswered = (statsMap.get(allQuestions[0].id)?.answered ?? 0) > 0;
    return { question: allQuestions[0], isReview: isAnswered };
  }

  // Partition questions into answered vs unseen, and compute overall accuracy
  let totalAnsweredCount = 0;
  let totalCorrectCount = 0;

  const answeredQuestions: {
    question: QuizQuestion;
    stats: QuestionStats;
    accuracy: number;
    importance: number;
  }[] = [];
  const unseenQuestions: QuizQuestion[] = [];

  for (const q of allQuestions) {
    const stats = statsMap.get(q.id);
    if (stats && stats.answered > 0) {
      totalAnsweredCount += stats.answered;
      totalCorrectCount += stats.correct;
      const accuracy = stats.correct / stats.answered;
      answeredQuestions.push({
        question: q,
        stats,
        accuracy,
        importance: parseImportance(q.importance),
      });
    } else {
      unseenQuestions.push(q);
    }
  }

  // Option A: 復習確率 = (1 - これまでの問題の正答率)
  const overallAccuracy =
    totalAnsweredCount > 0 ? totalCorrectCount / totalAnsweredCount : 1.0;
  const reviewProbability = Math.min(1, Math.max(0, 1 - overallAccuracy));

  // 未出題の問題がすべて無くなった場合は、全問が復習対象（100%復習）
  const allSeen = unseenQuestions.length === 0;
  const shouldReview =
    answeredQuestions.length > 0 &&
    (allSeen || Math.random() < reviewProbability);

  if (shouldReview) {
    // 復習対象の候補（直前の問題と同一のものを除外して連続出題を防止）
    let candidates = answeredQuestions.filter(
      (item) => item.question.id !== previousQuestionId
    );

    if (candidates.length === 0) {
      if (unseenQuestions.length > 0) {
        candidates = [];
      } else {
        candidates = answeredQuestions;
      }
    }

    if (candidates.length > 0) {
      // 復習優先度:
      // 1. 正答率昇順（最も間違えている問題優先）
      // 2. 正答率が同等なら「重要度降順」（重要度の高い問題を優先して復習）
      // 3. 正答率も重要度も同じなら「最も昔に出題された問題」を優先
      candidates.sort((a, b) => {
        if (Math.abs(a.accuracy - b.accuracy) > 0.0001) {
          return a.accuracy - b.accuracy;
        }
        if (a.importance !== b.importance) {
          return b.importance - a.importance;
        }
        return a.stats.lastShown - b.stats.lastShown;
      });

      // 最低正答率グループ（上位5%以内）
      const lowestAccuracy = candidates[0].accuracy;
      const lowestTier = candidates.filter(
        (c) => Math.abs(c.accuracy - lowestAccuracy) < 0.05
      );

      // 最低正答率グループの中から重要度加重抽選で決定
      const chosen = pickWeightedByImportance(lowestTier.map((c) => c.question));
      return { question: chosen, isReview: true };
    }
  }

  // 新規問題の出題（直前の問題を除外）
  let pool = unseenQuestions.filter((q) => q.id !== previousQuestionId);
  if (pool.length === 0) {
    pool = unseenQuestions;
  }
  if (pool.length === 0) {
    // 未出題が残っていない場合の安全策
    pool = allQuestions.filter((q) => q.id !== previousQuestionId);
    if (pool.length === 0) {
      pool = allQuestions;
    }
    const chosen = pickWeightedByImportance(pool);
    return { question: chosen, isReview: true };
  }

  // 新規問題も重要度加重抽選（重要度の高い問題ほど優先的に出題）
  const chosen = pickWeightedByImportance(pool);
  return { question: chosen, isReview: false };
}
