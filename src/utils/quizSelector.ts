import { QuizQuestion, QuestionStats } from '../types';

/**
 * Select next question based on user specification:
 * With probability ( shown / totalQuestions ) ^ 2, pick from previously seen questions
 * that have the lowest accuracy (correct / answered).
 * Otherwise, pick randomly from unseen questions (or all questions).
 */
export function selectNextQuestion(
  allQuestions: QuizQuestion[],
  statsMap: Map<string, QuestionStats>,
  shown: number,
  previousQuestionId?: string
): { question: QuizQuestion; isReview: boolean } {
  if (allQuestions.length === 0) {
    throw new Error('No questions available');
  }

  if (allQuestions.length === 1) {
    return { question: allQuestions[0], isReview: false };
  }

  const totalQuestions = allQuestions.length;

  // Probability: (shown / totalQuestions) ^ 2, clamped between 0 and 1
  const rawRatio = shown / totalQuestions;
  const reviewProbability = Math.min(1, Math.max(0, Math.pow(rawRatio, 2)));

  // Partition questions into answered vs unseen
  const answeredQuestions: { question: QuizQuestion; stats: QuestionStats; accuracy: number }[] =
    [];
  const unseenQuestions: QuizQuestion[] = [];

  for (const q of allQuestions) {
    const stats = statsMap.get(q.id);
    if (stats && stats.answered > 0) {
      const accuracy = stats.correct / stats.answered;
      answeredQuestions.push({ question: q, stats, accuracy });
    } else {
      unseenQuestions.push(q);
    }
  }

  const shouldReview =
    answeredQuestions.length > 0 && Math.random() < reviewProbability;

  if (shouldReview) {
    // Pick from previously seen questions with lowest accuracy
    // Filter out previousQuestionId if there are other candidates
    let candidates = answeredQuestions.filter(
      (item) => item.question.id !== previousQuestionId
    );
    if (candidates.length === 0) {
      candidates = answeredQuestions;
    }

    // Sort by accuracy ascending (lowest accuracy first)
    // Tie-break: oldest lastShown first
    candidates.sort((a, b) => {
      if (Math.abs(a.accuracy - b.accuracy) > 0.0001) {
        return a.accuracy - b.accuracy;
      }
      return a.stats.lastShown - b.stats.lastShown;
    });

    // To add a little variety among equally poor questions, pick among the lowest accuracy tier
    const lowestAccuracy = candidates[0].accuracy;
    const lowestTier = candidates.filter(
      (c) => Math.abs(c.accuracy - lowestAccuracy) < 0.05
    );

    const chosen = lowestTier[Math.floor(Math.random() * lowestTier.length)];
    return { question: chosen.question, isReview: true };
  }

  // Normal pick: Prefer unseen questions, or random from all
  let pool = unseenQuestions.filter((q) => q.id !== previousQuestionId);
  if (pool.length === 0) {
    pool = unseenQuestions;
  }
  if (pool.length === 0) {
    // All questions have been answered at least once
    pool = allQuestions.filter((q) => q.id !== previousQuestionId);
    if (pool.length === 0) {
      pool = allQuestions;
    }
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  return { question: pool[randomIndex], isReview: false };
}
