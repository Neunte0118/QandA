import { useState, useEffect, useCallback, useRef } from 'react';
import { QuizCategory, QuizQuestion, QuestionStats } from './types';
import { fetchCategories, fetchQuestions, ROOT_SPREADSHEET_CSV_URL } from './utils/api';
import { selectNextQuestion } from './utils/quizSelector';
import {
  getQuizStats,
  incrementQuizShown,
  getQuizQuestionStatsMap,
  recordQuestionAnswer,
} from './utils/db';
import { CategorySelect } from './components/CategorySelect';
import { QuizCard } from './components/QuizCard';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  // Category selection states
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Active quiz session states
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  // Stats in IndexedDB for current quiz
  const [quizShownCount, setQuizShownCount] = useState<number>(0);
  const [questionStatsMap, setQuestionStatsMap] = useState<Map<string, QuestionStats>>(
    new Map()
  );

  // Current active question
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [isReviewQuestion, setIsReviewQuestion] = useState<boolean>(false);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);

  // Ref to track latest stats & questions during async callbacks
  const statsMapRef = useRef<Map<string, QuestionStats>>(new Map());
  const shownCountRef = useRef<number>(0);

  // Load categories on mount
  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoriesError(null);
    try {
      const data = await fetchCategories(ROOT_SPREADSHEET_CSV_URL);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategoriesError('カテゴリー一覧の取得に失敗しました。');
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle selecting a category and initializing IndexedDB session
  const handleSelectCategory = async (category: QuizCategory) => {
    setSelectedCategory(category);
    setIsLoadingQuestions(true);
    setQuestionsError(null);
    setShowAnswer(false);
    setCurrentQuestion(null);

    try {
      // 1. Fetch questions from URL
      const { questions: loadedQuestions, isUsingFallback: fallback } =
        await fetchQuestions(category.url);

      if (loadedQuestions.length === 0) {
        setQuestionsError('問題データが見つかりませんでした。');
        setIsLoadingQuestions(false);
        return;
      }

      setAllQuestions(loadedQuestions);
      setIsUsingFallback(fallback);

      // 2. Load IndexedDB stats for this quiz
      const [savedQuizStats, savedQuestionStatsMap] = await Promise.all([
        getQuizStats(category.id),
        getQuizQuestionStatsMap(category.id),
      ]);

      const initialShown = savedQuizStats.shown;
      setQuizShownCount(initialShown);
      shownCountRef.current = initialShown;
      setQuestionStatsMap(savedQuestionStatsMap);
      statsMapRef.current = savedQuestionStatsMap;

      // 3. Increment shown count for the first question
      const newShown = await incrementQuizShown(category.id);
      setQuizShownCount(newShown);
      shownCountRef.current = newShown;

      // 4. Select initial question according to probability (shown / total)^2
      const selection = selectNextQuestion(
        loadedQuestions,
        savedQuestionStatsMap,
        newShown
      );

      setCurrentQuestion(selection.question);
      setIsReviewQuestion(selection.isReview);
      setShowAnswer(false);
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setQuestionsError('問題データの取得に失敗しました。');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Tap 1: Show answer
  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  // Tap 2: Record result & advance to next question infinitely
  const handleNextQuestion = async (isCorrect: boolean) => {
    if (!selectedCategory || !currentQuestion || allQuestions.length === 0) {
      return;
    }

    const quizId = selectedCategory.id;
    const questionId = currentQuestion.id;

    // 1. Record result into IndexedDB (questionStats)
    try {
      const updatedStat = await recordQuestionAnswer(quizId, questionId, isCorrect);
      const newMap = new Map(statsMapRef.current);
      newMap.set(questionId, updatedStat);
      statsMapRef.current = newMap;
      setQuestionStatsMap(newMap);
    } catch (e) {
      console.error('Failed to record question answer in IndexedDB:', e);
    }

    // 2. Increment overall quiz shown count (quizStats)
    let updatedShown = shownCountRef.current + 1;
    try {
      updatedShown = await incrementQuizShown(quizId);
      shownCountRef.current = updatedShown;
      setQuizShownCount(updatedShown);
    } catch (e) {
      console.error('Failed to increment quiz shown in IndexedDB:', e);
    }

    // 3. Select next question based on (shown / total)^2 accuracy review logic
    const selection = selectNextQuestion(
      allQuestions,
      statsMapRef.current,
      updatedShown,
      currentQuestion.id
    );

    // 4. Update view
    setCurrentQuestion(selection.question);
    setIsReviewQuestion(selection.isReview);
    setShowAnswer(false);
  };

  // Return to category list
  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setAllQuestions([]);
    setCurrentQuestion(null);
    setShowAnswer(false);
  };

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-800 flex flex-col justify-between p-3 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] font-sans antialiased">
      {/* Top Header */}
      <header className="w-full max-w-xl mx-auto py-2 sm:py-3 px-1 flex items-center justify-between">
        <div className="text-left">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-neutral-900">
            一問一答
          </h1>
          <p className="text-[11px] sm:text-xs text-neutral-500 truncate max-w-[200px] sm:max-w-none">
            {selectedCategory
              ? selectedCategory.title
              : 'スプレッドシートから読み込んで学習'}
          </p>
        </div>

        {/* PWA Install Button / Status */}
        <div className="shrink-0">
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1 flex flex-col justify-center items-center my-2 sm:my-4">
        {/* Step 1: Category Selection */}
        {!selectedCategory ? (
          <CategorySelect
            categories={categories}
            isLoading={isLoadingCategories}
            error={categoriesError}
            onSelect={handleSelectCategory}
            onRefresh={loadCategories}
          />
        ) : isLoadingQuestions ? (
          /* Loading questions */
          <div className="py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin mb-3" />
            <p className="text-sm text-neutral-600">問題を読み込み中...</p>
          </div>
        ) : questionsError ? (
          /* Error loading questions */
          <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-xs">
            <p className="text-sm text-red-600 font-medium mb-3">{questionsError}</p>
            <button
              id="back-from-error-button"
              type="button"
              onClick={handleBackToCategories}
              className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              単元一覧に戻る
            </button>
          </div>
        ) : currentQuestion ? (
          /* Active Infinite Question Card */
          <QuizCard
            question={currentQuestion}
            questionStats={questionStatsMap.get(currentQuestion.id)}
            totalShown={quizShownCount}
            totalQuestions={allQuestions.length}
            showAnswer={showAnswer}
            categoryTitle={selectedCategory.title}
            isUsingFallback={isUsingFallback}
            isReview={isReviewQuestion}
            onShowAnswer={handleShowAnswer}
            onNext={handleNextQuestion}
            onBack={handleBackToCategories}
          />
        ) : null}
      </main>

      {/* Footer (Desktop only or unobtrusive on mobile) */}
      <footer className="w-full max-w-xl mx-auto py-2 text-center text-[10px] sm:text-[11px] text-neutral-400 hidden sm:block">
        タップで解答表示・正誤記録（無限ループ学習）
      </footer>
    </div>
  );
}
