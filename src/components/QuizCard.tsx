import { useEffect } from 'react';
import { QuizQuestion, QuestionStats } from '../types';
import { ArrowLeft } from 'lucide-react';

interface QuizCardProps {
  question: QuizQuestion;
  questionStats: QuestionStats | undefined;
  totalShown: number;
  totalQuestions: number;
  showAnswer: boolean;
  categoryTitle: string;
  isUsingFallback: boolean;
  isReview: boolean;
  onShowAnswer: () => void;
  onNext: (isCorrect: boolean) => void;
  onBack: () => void;
}

export function QuizCard({
  question,
  questionStats,
  totalShown,
  totalQuestions,
  showAnswer,
  categoryTitle,
  isUsingFallback,
  isReview,
  onShowAnswer,
  onNext,
  onBack,
}: QuizCardProps) {
  // Keyboard navigation for desktop/laptop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!showAnswer) {
          onShowAnswer();
        } else {
          onNext(true); // default correct on space/enter
        }
      } else if (showAnswer && (e.key === 'x' || e.key === 'X' || e.code === 'Backspace')) {
        e.preventDefault();
        onNext(false); // incorrect
      } else if (showAnswer && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        onNext(true); // correct
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnswer, onShowAnswer, onNext]);

  const handleCardClick = () => {
    if (!showAnswer) {
      onShowAnswer();
    } else {
      onNext(true); // Tap card to advance (default correct)
    }
  };

  const answeredCount = questionStats?.answered ?? 0;
  const correctCount = questionStats?.correct ?? 0;
  const accuracyPercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-2.5 sm:gap-3.5 pb-24 sm:pb-0">
      {/* Top navigation & info bar */}
      <div className="flex items-center justify-between px-1">
        <button
          id="back-to-categories-button"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 py-1.5 px-2 rounded-lg hover:bg-neutral-200/60 active:bg-neutral-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-medium">単元一覧</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
          {isReview && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
              復習
            </span>
          )}
          <span className="text-neutral-500 truncate max-w-[120px] sm:max-w-none">
            {categoryTitle}
          </span>
          <span className="font-semibold text-neutral-700 bg-neutral-200/70 px-2 py-0.5 rounded-full text-[11px] sm:text-xs">
            出題: {totalShown}
          </span>
        </div>
      </div>

      {isUsingFallback && (
        <div className="px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-600 text-[11px] text-center">
          スプレッドシートに問題が未入力のため、例示サンプル問題を表示しています
        </div>
      )}

      {/* Main Flashcard */}
      <div
        id="quiz-flashcard"
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        className="w-full min-h-[300px] sm:min-h-[360px] bg-white border border-neutral-200 rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-xs hover:border-neutral-300 transition-all cursor-pointer select-none text-left active:scale-[0.995]"
        aria-label={showAnswer ? 'タップして次の問題へ' : 'タップして解答を表示'}
      >
        {/* Card Header: ID on top-left, importance on top-right */}
        <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-neutral-100">
          <span
            id="question-id-label"
            className="text-[10px] sm:text-[11px] font-mono text-neutral-400 tracking-tight truncate max-w-[65%]"
            title={question.id}
          >
            ID: {question.id}
          </span>
          <span
            id="question-importance-label"
            className="text-[11px] sm:text-xs font-semibold text-neutral-700 shrink-0 bg-neutral-100 px-2 py-0.5 rounded-md"
          >
            重要度: {question.importance}
          </span>
        </div>

        {/* Card Content: Question and Answer */}
        <div className="my-auto py-5 sm:py-6 flex flex-col gap-5 sm:gap-6">
          {/* Question Text */}
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              問題
            </div>
            <p
              id="question-text"
              className="text-base sm:text-xl font-medium text-neutral-900 leading-relaxed break-words"
            >
              {question.question}
            </p>
          </div>

          {/* Answer Text (appears in red text when tapped, question remains visible) */}
          {showAnswer ? (
            <div className="pt-4 border-t border-neutral-100 animate-fadeIn">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  解答
                </div>
                {accuracyPercent !== null ? (
                  <span className="text-[10px] sm:text-[11px] text-neutral-400">
                    過去実績: {correctCount}/{answeredCount}問正解 ({accuracyPercent}%)
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-neutral-400">初出題</span>
                )}
              </div>
              <p
                id="answer-text"
                className="text-xl sm:text-2xl font-bold text-red-600 leading-snug break-words"
              >
                {question.answer}
              </p>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-neutral-300 font-medium">
              タップして解答を表示
            </div>
          )}
        </div>

        {/* Desktop Card Footer (hidden on mobile) */}
        <div className="hidden sm:flex items-center justify-between pt-4 border-t border-neutral-100">
          {showAnswer ? (
            <>
              {/* Desktop Left: O */}
              <button
                id="desktop-correct-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext(true);
                }}
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xl border border-emerald-200 transition-colors shadow-2xs"
                title="正解 (Space / Enter)"
              >
                O
              </button>

              <span className="text-xs text-neutral-400 text-center">
                タップで次の問題へ [Space: O / X: X]
              </span>

              {/* Desktop Right: X */}
              <button
                id="desktop-incorrect-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext(false);
                }}
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xl border border-red-200 transition-colors shadow-2xs"
                title="不正解 (X)"
              >
                X
              </button>
            </>
          ) : (
            <div className="w-full text-center text-xs text-neutral-400">
              画面をタップで解答を表示 [Space / Enter]
            </div>
          )}
        </div>

        {/* Mobile footer hint inside card (when answer is not shown) */}
        {!showAnswer && (
          <div className="sm:hidden pt-3 border-t border-neutral-100 text-center text-[11px] text-neutral-400">
            タップで解答を表示
          </div>
        )}
      </div>

      {/* Mobile-specific fixed bottom action buttons (Left: O, Right: X) */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-neutral-50 via-neutral-50/95 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto flex items-center justify-between pointer-events-auto">
          {showAnswer ? (
            <>
              {/* Mobile Left-Bottom: Large O (正解) */}
              <button
                id="mobile-correct-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext(true);
                }}
                className="w-18 h-18 rounded-full bg-emerald-600 active:bg-emerald-700 text-white shadow-lg flex items-center justify-center font-black text-3xl transition-transform active:scale-90 border-2 border-white focus:outline-hidden"
                aria-label="正解 (O)"
              >
                O
              </button>

              <div className="text-center px-2">
                <span className="text-[11px] font-medium text-neutral-500 block leading-tight">
                  タップでも次へ
                </span>
                <span className="text-[9px] text-neutral-400">
                  全{totalQuestions}問
                </span>
              </div>

              {/* Mobile Right-Bottom: Large X (不正解) */}
              <button
                id="mobile-incorrect-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext(false);
                }}
                className="w-18 h-18 rounded-full bg-red-600 active:bg-red-700 text-white shadow-lg flex items-center justify-center font-black text-3xl transition-transform active:scale-90 border-2 border-white focus:outline-hidden"
                aria-label="不正解 (X)"
              >
                X
              </button>
            </>
          ) : (
            <div className="w-full text-center py-2 bg-white/80 backdrop-blur-2xs border border-neutral-200/80 rounded-xl shadow-2xs">
              <span className="text-xs text-neutral-500 font-medium">
                カードをタップして解答を表示
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
