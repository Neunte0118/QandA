import { useEffect, useState, useRef } from 'react';
import { QuizQuestion, QuestionStats } from '../types';
import { ArrowLeft, Check, X as XIcon } from 'lucide-react';
import { FormattedText } from './FormattedText';

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
  // Swipe drag state
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const hasSwipedRef = useRef<boolean>(false);

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
      } else if (showAnswer && (e.key === 'x' || e.key === 'X' || e.code === 'Backspace' || e.key === 'ArrowRight')) {
        e.preventDefault();
        onNext(false); // incorrect (right / X)
      } else if (showAnswer && (e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        onNext(true); // correct (left / O)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnswer, onShowAnswer, onNext]);

  // Touch handlers for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isHorizontalSwipe.current = null;
    hasSwipedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Detect if this is predominantly horizontal swipe vs vertical scroll
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipe.current) {
      // Horizontal drag
      setDragOffset(deltaX);
      if (Math.abs(deltaX) > 20) {
        hasSwipedRef.current = true;
      }
    }
  };

  const handleTouchEnd = () => {
    const currentOffset = dragOffset;
    const wasHorizontal = isHorizontalSwipe.current;

    // Reset touch tracking
    touchStartRef.current = null;
    isHorizontalSwipe.current = null;
    setIsDragging(false);
    setDragOffset(0);

    // If swiped horizontally with significant distance
    const SWIPE_THRESHOLD = 50;
    if (wasHorizontal && Math.abs(currentOffset) > SWIPE_THRESHOLD) {
      hasSwipedRef.current = true;
      if (!showAnswer) {
        // First reveal answer if swiped before answer was visible
        onShowAnswer();
        return;
      }

      // User specification:
      // 左にスワイプで正解 (Left swipe -> deltaX < 0 -> Correct)
      // 右にスワイプで不正解 (Right swipe -> deltaX > 0 -> Incorrect)
      if (currentOffset < -SWIPE_THRESHOLD) {
        onNext(true); // 左スワイプ: 正解
      } else if (currentOffset > SWIPE_THRESHOLD) {
        onNext(false); // 右スワイプ: 不正解
      }
    }
  };

  // Standard click handler (handles desktop click and mobile tap reliably)
  const handleCardClick = () => {
    // If user just performed a swipe gesture, do not trigger tap/click
    if (hasSwipedRef.current) {
      hasSwipedRef.current = false;
      return;
    }

    if (!showAnswer) {
      onShowAnswer();
    } else {
      onNext(true); // Tap card to advance default
    }
  };

  const answeredCount = questionStats?.answered ?? 0;
  const correctCount = questionStats?.correct ?? 0;
  const accuracyPercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;

  // Visual cues based on drag direction
  // Dragging left (negative offset): Correct cue (Emerald)
  // Dragging right (positive offset): Incorrect cue (Rose/Red)
  const isDraggingLeft = dragOffset < -25;
  const isDraggingRight = dragOffset > 25;
  const rotationDeg = Math.min(Math.max(dragOffset * 0.05, -8), 8);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-2.5 sm:gap-3.5 pb-28 sm:pb-0 select-none">
      {/* Top navigation & info bar */}
      <div className="flex items-center justify-between px-1">
        <button
          id="back-to-categories-button"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 py-1.5 px-2 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-medium">単元一覧</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
          {isReview && (
            <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full">
              復習
            </span>
          )}
          <span className="text-neutral-500 dark:text-neutral-400 truncate max-w-[120px] sm:max-w-none">
            {categoryTitle}
          </span>
          <span className="font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-200/70 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-[11px] sm:text-xs">
            出題: {totalShown}
          </span>
        </div>
      </div>

      {isUsingFallback && (
        <div className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-[11px] text-center">
          スプレッドシートに問題が未入力のため、例示サンプル問題を表示しています
        </div>
      )}

      {/* Swipe Direction Instruction Hints (Mobile) */}
      <div className="sm:hidden flex items-center justify-between px-2 text-[11px] text-neutral-400 dark:text-neutral-500">
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
          ← 左スワイプ: 正解 (○)
        </span>
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
          右スワイプ: 不正解 (✕) →
        </span>
      </div>

      {/* Main Flashcard with Swipe Motion */}
      <div className="relative w-full">
        {/* Swipe Feedback Overlay Under Card */}
        {isDragging && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-between px-6 pointer-events-none z-0">
            {/* Left cue: Correct */}
            <div
              className={`flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold transition-opacity ${
                isDraggingLeft ? 'opacity-100 scale-110' : 'opacity-20'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <span className="text-sm font-black tracking-wider">正解</span>
            </div>

            {/* Right cue: Incorrect */}
            <div
              className={`flex items-center gap-2 text-red-600 dark:text-red-400 font-bold transition-opacity ${
                isDraggingRight ? 'opacity-100 scale-110' : 'opacity-20'
              }`}
            >
              <span className="text-sm font-black tracking-wider">不正解</span>
              <div className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center text-xl shadow-md">
                <XIcon className="w-6 h-6 stroke-[3]" />
              </div>
            </div>
          </div>
        )}

        <div
          id="quiz-flashcard"
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
            transform: `translateX(${dragOffset}px) rotate(${rotationDeg}deg)`,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
            borderColor: isDraggingLeft ? '#10b981' : isDraggingRight ? '#ef4444' : undefined,
          }}
          className={`relative z-10 w-full min-h-[300px] sm:min-h-[360px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 cursor-pointer select-none text-left touch-pan-y ${
            isDraggingLeft ? 'ring-2 ring-emerald-400/40' : isDraggingRight ? 'ring-2 ring-red-400/40' : ''
          }`}
          aria-label={showAnswer ? 'スワイプまたはタップで回答' : 'タップで解答を表示'}
        >
          {/* Card Header: ID on top-left, importance on top-right */}
          <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
            <span
              id="question-id-label"
              className="text-[10px] sm:text-[11px] font-mono text-neutral-400 dark:text-neutral-500 tracking-tight truncate max-w-[65%]"
              title={question.id}
            >
              ID: {question.id}
            </span>
            <span
              id="question-importance-label"
              className="text-[11px] sm:text-xs font-semibold text-neutral-700 dark:text-neutral-300 shrink-0 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md"
            >
              重要度: {question.importance}
            </span>
          </div>

          {/* Card Content: Question and Answer */}
          <div className="my-auto py-5 sm:py-6 flex flex-col gap-5 sm:gap-6">
            {/* Question Text */}
            <div>
              <div className="text-[10px] sm:text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                問題
              </div>
              <p
                id="question-text"
                className="text-base sm:text-xl font-medium text-neutral-900 dark:text-neutral-100 leading-relaxed break-words"
              >
                <FormattedText text={question.question} />
              </p>
            </div>

            {/* Answer Text */}
            {showAnswer ? (
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 animate-fadeIn">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] sm:text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    解答
                  </div>
                  {accuracyPercent !== null ? (
                    <span className="text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-500">
                      過去実績: {correctCount}/{answeredCount}問正解 ({accuracyPercent}%)
                    </span>
                  ) : (
                    <span className="text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-500">初出題</span>
                  )}
                </div>
                <p
                  id="answer-text"
                  className="text-xl sm:text-2xl font-bold text-red-600 dark:text-rose-400 leading-snug break-words"
                >
                  <FormattedText text={question.answer} />
                </p>
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                タップして解答を表示
              </div>
            )}
          </div>

          {/* Desktop Card Footer (hidden on mobile) */}
          <div className="hidden sm:flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
            {showAnswer ? (
              <>
                <button
                  id="desktop-correct-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext(true);
                  }}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-bold text-xl border border-emerald-200 dark:border-emerald-800 transition-colors shadow-2xs"
                  title="正解 (Space / Enter / ←)"
                >
                  O
                </button>

                <span className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
                  [← / Space: O] [→ / X: X]
                </span>

                <button
                  id="desktop-incorrect-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext(false);
                  }}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 font-bold text-xl border border-red-200 dark:border-red-800 transition-colors shadow-2xs"
                  title="不正解 (X / →)"
                >
                  X
                </button>
              </>
            ) : (
              <div className="w-full text-center text-xs text-neutral-400 dark:text-neutral-500">
                画面をタップで解答を表示 [Space / Enter]
              </div>
            )}
          </div>

          {/* Mobile footer hint inside card (when answer is not shown) */}
          {!showAnswer && (
            <div className="sm:hidden pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
              タップで解答を表示
            </div>
          )}
        </div>
      </div>

      {/* Mobile-specific bottom area */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-neutral-50 dark:from-neutral-950 via-neutral-50/95 dark:via-neutral-950/95 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto flex items-center justify-between pointer-events-auto">
          {showAnswer ? (
            <>
              {/* Mobile Left-Bottom: Large O (正解) */}
              <div className="flex flex-col items-center gap-1">
                <button
                  id="mobile-correct-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext(true);
                  }}
                  className="w-16 h-16 rounded-full bg-emerald-600 active:bg-emerald-700 text-white shadow-lg flex items-center justify-center font-black text-2xl transition-transform active:scale-90 border-2 border-white dark:border-neutral-900 focus:outline-hidden"
                  aria-label="正解 (O) - 左スワイプ"
                >
                  O
                </button>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  左スワイプ / 正解
                </span>
              </div>

              <div className="text-center px-2">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block leading-tight">
                  スワイプ操作対応
                </span>
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                  全{totalQuestions}問
                </span>
              </div>

              {/* Mobile Right-Bottom: Large X (不正解) */}
              <div className="flex flex-col items-center gap-1">
                <button
                  id="mobile-incorrect-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext(false);
                  }}
                  className="w-16 h-16 rounded-full bg-red-600 active:bg-red-700 text-white shadow-lg flex items-center justify-center font-black text-2xl transition-transform active:scale-90 border-2 border-white dark:border-neutral-900 focus:outline-hidden"
                  aria-label="不正解 (X) - 右スワイプ"
                >
                  X
                </button>
                <span className="text-[10px] font-semibold text-red-700 dark:text-red-400">
                  右スワイプ / 不正解
                </span>
              </div>
            </>
          ) : (
            <button
              id="mobile-reveal-answer-button"
              type="button"
              onClick={onShowAnswer}
              className="w-full text-center py-3 bg-neutral-900 dark:bg-neutral-100 active:bg-neutral-800 dark:active:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl shadow-md transition-colors"
            >
              <span className="text-xs font-semibold">
                タップして解答を表示
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
