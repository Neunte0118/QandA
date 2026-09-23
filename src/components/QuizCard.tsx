import { useEffect, useState, useRef } from 'react';
import { QuizQuestion, QuestionStats, QuizMode } from '../types';
import { ArrowLeft, Check, X as XIcon } from 'lucide-react';
import { FormattedText } from './FormattedText';
import { parseImportance } from '../utils/quizSelector';

interface QuizCardProps {
  question: QuizQuestion;
  questionStats: QuestionStats | undefined;
  totalShown: number;
  totalQuestions: number;
  showAnswer: boolean;
  categoryTitle: string;
  isUsingFallback: boolean;
  isReview: boolean;
  quizMode?: QuizMode;
  orderIndex?: number;
  remainingIncorrectCount?: number;
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
  quizMode = 'shuffle',
  orderIndex = 0,
  remainingIncorrectCount = 0,
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

  // Transition & visual feedback states
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [feedbackKey, setFeedbackKey] = useState<number>(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [showTapHint, setShowTapHint] = useState<boolean>(false);
  const tapHintTimeoutRef = useRef<number | null>(null);

  // Reset transition states whenever question changes
  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    setExitDirection(null);
    setShowTapHint(false);
  }, [question.id]);

  // Main answer trigger with screen edge glow feedback and slide-out animation
  const handleAnswer = (isCorrect: boolean) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const result = isCorrect ? 'correct' : 'incorrect';
    setFeedback(result);
    setFeedbackKey((k) => k + 1);
    setExitDirection(isCorrect ? 'left' : 'right');

    // Optional haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(isCorrect ? 35 : [40, 30, 40]);
      } catch {
        // Ignore vibration error
      }
    }

    // Call onNext after the card starts sliding out (220ms)
    setTimeout(() => {
      onNext(isCorrect);
    }, 220);

    // Clear feedback glow after flash completes (650ms)
    setTimeout(() => {
      setFeedback(null);
      setExitDirection(null);
      setIsTransitioning(false);
    }, 650);
  };

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
          // Strictly DO NOT allow continuing by pressing Space/Enter when answer is displayed.
          setShowTapHint(true);
          if (tapHintTimeoutRef.current) window.clearTimeout(tapHintTimeoutRef.current);
          tapHintTimeoutRef.current = window.setTimeout(() => setShowTapHint(false), 1800);
        }
      } else if (showAnswer && (e.key === 'x' || e.key === 'X' || e.code === 'Backspace' || e.key === 'ArrowRight')) {
        e.preventDefault();
        handleAnswer(false); // 不正解 (右 / X)
      } else if (showAnswer && (e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        handleAnswer(true); // 正解 (左 / O)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnswer, onShowAnswer, isTransitioning]);

  // Touch handlers for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
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
    if (isTransitioning || !touchStartRef.current) return;
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
      setDragOffset(deltaX);
      if (Math.abs(deltaX) > 20) {
        hasSwipedRef.current = true;
      }
    }
  };

  const handleTouchEnd = () => {
    if (isTransitioning) return;
    const currentOffset = dragOffset;
    const wasHorizontal = isHorizontalSwipe.current;

    // Reset touch tracking
    touchStartRef.current = null;
    isHorizontalSwipe.current = null;
    setIsDragging(false);
    setDragOffset(0);

    const SWIPE_THRESHOLD = 50;
    if (wasHorizontal && Math.abs(currentOffset) > SWIPE_THRESHOLD) {
      hasSwipedRef.current = true;
      if (!showAnswer) {
        // Reveal answer if swiped before answer was visible
        onShowAnswer();
        return;
      }

      // User specification:
      // 左にスワイプで正解 (Left swipe -> deltaX < 0 -> Correct)
      // 右にスワイプで不正解 (Right swipe -> deltaX > 0 -> Incorrect)
      if (currentOffset < -SWIPE_THRESHOLD) {
        handleAnswer(true); // 左スワイプ: 正解
      } else if (currentOffset > SWIPE_THRESHOLD) {
        handleAnswer(false); // 右スワイプ: 不正解
      }
    }
  };

  // Card click handler:
  // ONLY allows revealing the answer.
  // Tap-to-continue is STRICTLY FORBIDDEN per user specification ("そのままタップして続けることは許しません").
  const handleCardClick = () => {
    if (isTransitioning) return;
    if (hasSwipedRef.current) {
      hasSwipedRef.current = false;
      return;
    }

    if (!showAnswer) {
      onShowAnswer();
    } else {
      // Show user-friendly feedback that tap does not advance
      setShowTapHint(true);
      if (tapHintTimeoutRef.current) window.clearTimeout(tapHintTimeoutRef.current);
      tapHintTimeoutRef.current = window.setTimeout(() => setShowTapHint(false), 1800);
    }
  };

  const answeredCount = questionStats?.answered ?? 0;
  const correctCount = questionStats?.correct ?? 0;
  const accuracyPercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;
  const starCount = parseImportance(question.importance);

  // Visual cues based on drag direction
  // Dragging left (negative offset): Correct cue (Emerald)
  // Dragging right (positive offset): Incorrect cue (Rose/Red)
  const isDraggingLeft = dragOffset < -20;
  const isDraggingRight = dragOffset > 20;
  const rotationDeg = Math.min(Math.max(dragOffset * 0.05, -8), 8);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-2.5 sm:gap-3.5 pb-28 sm:pb-0 select-none">
      {/* Screen Edge Glow Feedback ("画面の淵が正解なら緑色、不正解なら赤色に光る") */}
      {feedback ? (
        <div
          key={`edge-flash-${feedbackKey}`}
          className={`fixed inset-0 pointer-events-none z-50 ${
            feedback === 'correct' ? 'screen-edge-flash-green' : 'screen-edge-flash-red'
          }`}
          aria-hidden="true"
        />
      ) : isDragging && (isDraggingLeft || isDraggingRight) ? (
        <div
          className={`fixed inset-0 pointer-events-none z-50 transition-opacity duration-75 ${
            isDraggingLeft ? 'screen-edge-drag-green' : 'screen-edge-drag-red'
          }`}
          style={{
            opacity: Math.min(0.9, Math.abs(dragOffset) / 75),
          }}
          aria-hidden="true"
        />
      ) : null}

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
          <span className="text-neutral-500 dark:text-neutral-400 truncate max-w-[120px] sm:max-w-none">
            {categoryTitle}
          </span>
          {quizMode === 'order' ? (
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px]">
              順番通り ({orderIndex + 1}/{totalQuestions})
            </span>
          ) : quizMode === 'incorrect_only' ? (
            <span className="font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px]">
              不正解のみ (残:{remainingIncorrectCount}問)
            </span>
          ) : (
            <span className="font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-200/70 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-[11px] sm:text-xs">
              出題: {totalShown}
            </span>
          )}
        </div>
      </div>

      {isUsingFallback && (
        <div className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-[11px] text-center">
          スプレッドシートに問題が未入力のため、例示サンプル問題を表示しています
        </div>
      )}

      {/* Swipe Direction Instruction Hints */}
      <div className="flex items-center justify-between px-2 text-[11px] text-neutral-400 dark:text-neutral-500">
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
          ← 正解
        </span>
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
          不正解 →
        </span>
      </div>

      {/* Main Flashcard with Swipe Motion */}
      <div className="relative w-full overflow-y-clip">
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
            transform:
              exitDirection === 'left'
                ? 'translateX(-110vw)'
                : exitDirection === 'right'
                ? 'translateX(110vw)'
                : `translateX(${dragOffset}px) rotate(${rotationDeg}deg)`,
            transition: exitDirection
              ? 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.22s ease-out'
              : isDragging
              ? 'none'
              : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
            opacity: exitDirection ? 0 : 1,
            pointerEvents: exitDirection ? 'none' : undefined,
            borderColor:
              feedback === 'correct' || isDraggingLeft
                ? '#10b981'
                : feedback === 'incorrect' || isDraggingRight
                ? '#ef4444'
                : undefined,
          }}
          className={`relative z-10 w-full min-h-[300px] sm:min-h-[360px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-xs select-none text-left touch-pan-y ${
            !showAnswer
              ? 'cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700'
              : 'cursor-default'
          } ${
            feedback === 'correct' || isDraggingLeft
              ? 'ring-2 ring-emerald-400/50'
              : feedback === 'incorrect' || isDraggingRight
              ? 'ring-2 ring-red-400/50'
              : ''
          }`}
          aria-label={
            showAnswer
              ? '左スワイプまたは○で正解、右スワイプまたは×で不正解'
              : 'タップで解答を表示'
          }
        >
          {/* Card Header: Mode badge on left, importance on top-right */}
          <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5">
              {quizMode === 'order' && (
                <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                  ID: {question.id}
                </span>
              )}
              {quizMode === 'incorrect_only' && (
                <span className="text-[10px] sm:text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 px-2 py-0.5 rounded">
                  苦手特訓 {accuracyPercent !== null ? `(${accuracyPercent}%)` : ''}
                </span>
              )}
              {quizMode === 'shuffle' && isReview && (
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded">
                  復習
                </span>
              )}
            </div>

            <span
              id="question-importance-label"
              className="text-xs sm:text-sm font-bold text-amber-500 dark:text-amber-400 shrink-0 tracking-widest select-none bg-amber-50/80 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40"
              aria-label={`重要度: ${starCount}`}
              title={`重要度: ${starCount}`}
            >
              {'★'.repeat(starCount)}
            </span>
          </div>

          {/* Card Content: Question and Answer */}
          <div className="flex-1 py-4 sm:py-5 flex flex-col justify-start gap-4 sm:gap-6">
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
                      正答率: {correctCount}/{answeredCount} | ({accuracyPercent}%)
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
              <div />
            )}
          </div>

          {/* Desktop Card Footer (hidden on mobile) */}
          <div className="hidden sm:flex flex-col gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            {showAnswer ? (
              <>
                <div className="flex items-center justify-between">
                  <button
                    id="desktop-correct-button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAnswer(true);
                    }}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-bold text-xl border border-emerald-200 dark:border-emerald-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
                    title="正解 (← / Oキー)"
                  >
                    O
                  </button>

                  <button
                    id="desktop-incorrect-button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAnswer(false);
                    }}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 font-bold text-xl border border-red-200 dark:border-red-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
                    title="不正解 (→ / Xキー)"
                  >
                    X
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full text-center text-xs text-neutral-400 dark:text-neutral-500">
                画面をタップで解答を表示
              </div>
            )}
          </div>
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
                    handleAnswer(true);
                  }}
                  className="w-16 h-16 rounded-full bg-emerald-600 active:bg-emerald-700 text-white shadow-lg flex items-center justify-center font-black text-2xl transition-transform active:scale-90 border-2 border-white dark:border-neutral-900 focus:outline-hidden cursor-pointer"
                  aria-label="正解 (O) - 左スワイプ"
                >
                  O
                </button>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  左スワイプ
                </span>
              </div>

              {/* Mobile Right-Bottom: Large X (不正解) */}
              <div className="flex flex-col items-center gap-1">
                <button
                  id="mobile-incorrect-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnswer(false);
                  }}
                  className="w-16 h-16 rounded-full bg-red-600 active:bg-red-700 text-white shadow-lg flex items-center justify-center font-black text-2xl transition-transform active:scale-90 border-2 border-white dark:border-neutral-900 focus:outline-hidden cursor-pointer"
                  aria-label="不正解 (X) - 右スワイプ"
                >
                  X
                </button>
                <span className="text-[10px] font-semibold text-red-700 dark:text-red-400">
                  右スワイプ
                </span>
              </div>
            </>
          ) : (
            <button
              id="mobile-reveal-answer-button"
              type="button"
              onClick={onShowAnswer}
              className="w-full text-center py-3 bg-neutral-900 dark:bg-neutral-100 active:bg-neutral-800 dark:active:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl shadow-md transition-colors cursor-pointer"
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
