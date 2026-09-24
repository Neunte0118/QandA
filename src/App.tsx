import { useState, useEffect, useCallback, useRef } from 'react';
import { QuizCategory, QuizQuestion, QuestionStats, QuizMode } from './types';
import {
  fetchCategoriesWithLocked,
  fetchQuestions,
  tryUnlockEncryptedCategory,
  ROOT_SPREADSHEET_CSV_URL,
} from './utils/api';
import { removeCategoryCredential } from './utils/crypto';
import {
  selectNextQuestion,
  sortQuestionsById,
  getIncorrectQuestions,
  selectNextIncorrectQuestion,
} from './utils/quizSelector';
import {
  getQuizStats,
  incrementQuizShown,
  getQuizQuestionStatsMap,
  recordQuestionAnswer,
  resetQuizStats,
  clearAllLearningData,
} from './utils/db';
import { CategorySelect } from './components/CategorySelect';
import { QuizCard } from './components/QuizCard';
import { QuestionListView } from './components/QuestionListView';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  // Category selection states
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [lockedCategories, setLockedCategories] = useState<QuizCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Question List View states
  const [isViewingQuestionList, setIsViewingQuestionList] = useState<boolean>(false);
  const [questionListCategory, setQuestionListCategory] = useState<QuizCategory | null>(null);
  const [questionListItems, setQuestionListItems] = useState<QuizQuestion[]>([]);
  const [questionListStatsMap, setQuestionListStatsMap] = useState<Map<string, QuestionStats>>(
    new Map()
  );
  const [isLoadingQuestionList, setIsLoadingQuestionList] = useState<boolean>(false);
  const [questionListError, setQuestionListError] = useState<string | null>(null);

  // Active quiz session states
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>('shuffle');
  const [sortedQuestions, setSortedQuestions] = useState<QuizQuestion[]>([]);
  const [orderIndex, setOrderIndex] = useState<number>(0);
  const orderIndexRef = useRef<number>(0);
  const [isClearedIncorrectMode, setIsClearedIncorrectMode] = useState<boolean>(false);

  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  // Stats in IndexedDB for current quiz
  const [quizShownCount, setQuizShownCount] = useState<number>(0);
  const [questionStatsMap, setQuestionStatsMap] = useState<Map<string, QuestionStats>>(
    new Map()
  );

  // Dark / Light mode state with persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

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
      const res = await fetchCategoriesWithLocked(ROOT_SPREADSHEET_CSV_URL);
      setCategories(res.visibleCategories);
      setLockedCategories(res.lockedCategories);
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

  // Handle adding an encrypted category with encrypted ID and decryption key
  const handleAddEncryptedCategory = async (
    encryptedId: string,
    key: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = tryUnlockEncryptedCategory(encryptedId, key, lockedCategories);
    if (result.success) {
      const res = await fetchCategoriesWithLocked(ROOT_SPREADSHEET_CSV_URL);
      setCategories(res.visibleCategories);
      setLockedCategories(res.lockedCategories);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  // Handle removing stored decryption key for a category
  const handleRemoveCredential = async (category: QuizCategory) => {
    removeCategoryCredential({
      id: category.id,
      rawId: category.rawId,
      title: category.title,
      rawTitle: category.rawTitle,
      decryptionKey: category.decryptionKey,
    });
    const res = await fetchCategoriesWithLocked(ROOT_SPREADSHEET_CSV_URL);
    setCategories(res.visibleCategories);
    setLockedCategories(res.lockedCategories);
  };

  // Handle resetting learning data for a specific category
  const handleResetCategoryData = async (quizId: string) => {
    try {
      await resetQuizStats(quizId);
      // If question list is open for this category, clear its stats map
      if (questionListCategory && questionListCategory.id === quizId) {
        setQuestionListStatsMap(new Map());
      }
      // If currently inside the active quiz session for this category, reset memory state
      if (selectedCategory && selectedCategory.id === quizId) {
        const emptyMap = new Map<string, QuestionStats>();
        statsMapRef.current = emptyMap;
        setQuestionStatsMap(emptyMap);
        setQuizShownCount(0);
        shownCountRef.current = 0;
        if (allQuestions.length > 0) {
          if (quizMode === 'order') {
            const sorted = sortQuestionsById(allQuestions);
            setSortedQuestions(sorted);
            orderIndexRef.current = 0;
            setOrderIndex(0);
            setCurrentQuestion(sorted[0]);
            setIsReviewQuestion(false);
          } else if (quizMode === 'incorrect_only') {
            setIsClearedIncorrectMode(true);
            setCurrentQuestion(null);
          } else {
            const selection = selectNextQuestion(allQuestions, emptyMap, 0);
            setCurrentQuestion(selection.question);
            setIsReviewQuestion(selection.isReview);
          }
          setShowAnswer(false);
        }
      }
    } catch (e) {
      console.error('Failed to reset category learning data:', e);
    }
  };

  // Handle clearing all learning data completely
  const handleClearAllData = async () => {
    try {
      await clearAllLearningData();
      setQuestionListStatsMap(new Map());
      const emptyMap = new Map<string, QuestionStats>();
      statsMapRef.current = emptyMap;
      setQuestionStatsMap(emptyMap);
      setQuizShownCount(0);
      shownCountRef.current = 0;
      if (selectedCategory && allQuestions.length > 0) {
        if (quizMode === 'order') {
          const sorted = sortQuestionsById(allQuestions);
          setSortedQuestions(sorted);
          orderIndexRef.current = 0;
          setOrderIndex(0);
          setCurrentQuestion(sorted[0]);
          setIsReviewQuestion(false);
        } else if (quizMode === 'incorrect_only') {
          setIsClearedIncorrectMode(true);
          setCurrentQuestion(null);
        } else {
          const selection = selectNextQuestion(allQuestions, emptyMap, 0);
          setCurrentQuestion(selection.question);
          setIsReviewQuestion(selection.isReview);
        }
        setShowAnswer(false);
      }
    } catch (e) {
      console.error('Failed to clear all learning data:', e);
    }
  };

  // Handle opening Question List View for a category
  const handleOpenQuestionList = async (category: QuizCategory) => {
    setIsViewingQuestionList(true);
    setQuestionListCategory(category);
    setIsLoadingQuestionList(true);
    setQuestionListError(null);

    try {
      // Reuse loaded questions if viewing the currently active quiz category
      if (selectedCategory && selectedCategory.id === category.id && allQuestions.length > 0) {
        setQuestionListItems(allQuestions);
        const stats = await getQuizQuestionStatsMap(category.id);
        setQuestionListStatsMap(stats);
      } else {
        const { questions: loadedQuestions } = await fetchQuestions(
          category.url,
          category.decryptionKey
        );
        setQuestionListItems(loadedQuestions);
        const stats = await getQuizQuestionStatsMap(category.id);
        setQuestionListStatsMap(stats);
      }
    } catch (err) {
      console.error('Failed to load questions for question list:', err);
      setQuestionListError('一問一答一覧の取得に失敗しました。');
    } finally {
      setIsLoadingQuestionList(false);
    }
  };

  // Handle switching category inside Question List View
  const handleSelectCategoryInQuestionList = (category: QuizCategory) => {
    handleOpenQuestionList(category);
  };

  // Handle starting a quiz from inside Question List View
  const handleStartQuizFromList = (category: QuizCategory, mode: QuizMode) => {
    setIsViewingQuestionList(false);
    handleSelectCategory(category, mode);
  };

  // Handle returning from Question List View
  const handleBackFromQuestionList = () => {
    setIsViewingQuestionList(false);
  };

  // Handle selecting a category and initializing IndexedDB session with specified mode
  const handleSelectCategory = async (category: QuizCategory, mode: QuizMode = 'shuffle') => {
    setSelectedCategory(category);
    setQuizMode(mode);
    setIsClearedIncorrectMode(false);
    setIsLoadingQuestions(true);
    setQuestionsError(null);
    setShowAnswer(false);
    setCurrentQuestion(null);

    try {
      // 1. Fetch questions from URL, decrypting if key exists
      const { questions: loadedQuestions, isUsingFallback: fallback } =
        await fetchQuestions(category.url, category.decryptionKey);

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

      // 4. Select initial question according to chosen mode
      if (mode === 'order') {
        const sorted = sortQuestionsById(loadedQuestions);
        setSortedQuestions(sorted);
        orderIndexRef.current = 0;
        setOrderIndex(0);
        const firstQ = sorted[0];
        const isAnswered = (savedQuestionStatsMap.get(firstQ.id)?.answered ?? 0) > 0;
        setCurrentQuestion(firstQ);
        setIsReviewQuestion(isAnswered);
        setShowAnswer(false);
      } else if (mode === 'incorrect_only') {
        const incorrectList = getIncorrectQuestions(loadedQuestions, savedQuestionStatsMap);
        if (incorrectList.length === 0) {
          setIsClearedIncorrectMode(true);
          setCurrentQuestion(null);
          setShowAnswer(false);
        } else {
          const firstQ = selectNextIncorrectQuestion(incorrectList, savedQuestionStatsMap);
          setCurrentQuestion(firstQ);
          setIsReviewQuestion(true);
          setShowAnswer(false);
        }
      } else {
        // mode === 'shuffle'
        const selection = selectNextQuestion(
          loadedQuestions,
          savedQuestionStatsMap,
          newShown
        );
        setCurrentQuestion(selection.question);
        setIsReviewQuestion(selection.isReview);
        setShowAnswer(false);
      }
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

  // Tap 2: Record result & advance to next question according to active mode
  const handleNextQuestion = async (isCorrect: boolean) => {
    if (!selectedCategory || !currentQuestion || allQuestions.length === 0) {
      return;
    }

    const quizId = selectedCategory.id;
    const questionId = currentQuestion.id;

    // 1. Record result into IndexedDB (questionStats)
    let newMap = new Map(statsMapRef.current);
    try {
      const updatedStat = await recordQuestionAnswer(quizId, questionId, isCorrect);
      newMap = new Map(statsMapRef.current);
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

    // 3. Select next question based on current mode
    if (quizMode === 'order') {
      const sorted = sortedQuestions.length > 0 ? sortedQuestions : sortQuestionsById(allQuestions);
      const nextIndex = (orderIndexRef.current + 1) % sorted.length;
      orderIndexRef.current = nextIndex;
      setOrderIndex(nextIndex);
      const nextQ = sorted[nextIndex];
      const isAnswered = (newMap.get(nextQ.id)?.answered ?? 0) > 0;
      setCurrentQuestion(nextQ);
      setIsReviewQuestion(isAnswered);
      setShowAnswer(false);
    } else if (quizMode === 'incorrect_only') {
      const remainingIncorrect = getIncorrectQuestions(allQuestions, newMap);
      if (remainingIncorrect.length === 0) {
        setIsClearedIncorrectMode(true);
        setCurrentQuestion(null);
        setShowAnswer(false);
      } else {
        const nextQ = selectNextIncorrectQuestion(
          remainingIncorrect,
          newMap,
          currentQuestion.id
        );
        setCurrentQuestion(nextQ);
        setIsReviewQuestion(true);
        setShowAnswer(false);
      }
    } else {
      // mode === 'shuffle'
      const selection = selectNextQuestion(
        allQuestions,
        newMap,
        updatedShown,
        currentQuestion.id
      );
      setCurrentQuestion(selection.question);
      setIsReviewQuestion(selection.isReview);
      setShowAnswer(false);
    }
  };

  // Return to category list
  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setAllQuestions([]);
    setCurrentQuestion(null);
    setShowAnswer(false);
    setIsClearedIncorrectMode(false);
  };

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 flex flex-col justify-between p-3 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] font-sans antialiased transition-colors touch-pan-y">
      {/* Top Header */}
      <header className="w-full max-w-xl mx-auto py-2 sm:py-3 px-1 flex items-center justify-between">
        <div className="text-left">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
            一問一答
          </h1>
          <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[200px] sm:max-w-none">
            {isViewingQuestionList && questionListCategory
              ? `一覧: ${questionListCategory.title}`
              : selectedCategory
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
      <main
        className={`w-full max-w-full flex-1 flex flex-col ${
          isViewingQuestionList ? 'justify-start items-stretch' : 'justify-center items-center'
        } my-2 sm:my-4`}
      >
        {/* Step 0: Question List View */}
        {isViewingQuestionList && questionListCategory ? (
          <QuestionListView
            category={questionListCategory}
            allCategories={categories}
            questions={questionListItems}
            statsMap={questionListStatsMap}
            isLoading={isLoadingQuestionList}
            error={questionListError}
            onSelectCategory={handleSelectCategoryInQuestionList}
            onStartQuiz={handleStartQuizFromList}
            onBack={handleBackFromQuestionList}
          />
        ) : !selectedCategory ? (
          /* Step 1: Category Selection */
          <CategorySelect
            categories={categories}
            isLoading={isLoadingCategories}
            error={categoriesError}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            onSelect={handleSelectCategory}
            onRefresh={loadCategories}
            onAddEncryptedCategory={handleAddEncryptedCategory}
            onRemoveCredential={handleRemoveCredential}
            onResetCategoryData={handleResetCategoryData}
            onClearAllData={handleClearAllData}
            onOpenQuestionList={handleOpenQuestionList}
          />
        ) : isLoadingQuestions ? (
          /* Loading questions */
          <div className="py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-800 dark:border-t-neutral-200 rounded-full animate-spin mb-3" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">問題を読み込み中...</p>
          </div>
        ) : questionsError ? (
          /* Error loading questions */
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-center shadow-xs">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-3">{questionsError}</p>
            <button
              id="back-from-error-button"
              type="button"
              onClick={handleBackToCategories}
              className="px-4 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              単元一覧に戻る
            </button>
          </div>
        ) : isClearedIncorrectMode ? (
          /* All incorrect questions cleared celebration view */
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 text-center shadow-xs animate-scaleUp">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shadow-inner">
              🎉
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              苦手問題をすべてクリア！
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
              正答率90%未満の問題がなくなりました。<br />
              素晴らしい学習成果です！
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => selectedCategory && handleSelectCategory(selectedCategory, 'shuffle')}
                className="w-full py-2.5 px-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                シャッフルで総復習する
              </button>
              <button
                type="button"
                onClick={() => selectedCategory && handleSelectCategory(selectedCategory, 'order')}
                className="w-full py-2.5 px-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                順番通りに通しで解く
              </button>
              <button
                type="button"
                onClick={handleBackToCategories}
                className="w-full py-2.5 px-4 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                単元一覧に戻る
              </button>
            </div>
          </div>
        ) : currentQuestion ? (
          /* Active Question Card */
          <QuizCard
            question={currentQuestion}
            questionStats={questionStatsMap.get(currentQuestion.id)}
            totalShown={quizShownCount}
            totalQuestions={allQuestions.length}
            showAnswer={showAnswer}
            categoryTitle={selectedCategory.title}
            isUsingFallback={isUsingFallback}
            isReview={isReviewQuestion}
            quizMode={quizMode}
            orderIndex={orderIndex}
            remainingIncorrectCount={getIncorrectQuestions(allQuestions, questionStatsMap).length}
            onShowAnswer={handleShowAnswer}
            onNext={handleNextQuestion}
            onBack={handleBackToCategories}
            onResetCategoryData={() => handleResetCategoryData(selectedCategory.id)}
            onOpenQuestionList={() => handleOpenQuestionList(selectedCategory)}
          />
        ) : null}
      </main>

      {/* Footer (Desktop only or unobtrusive on mobile) */}
      <footer className="w-full max-w-xl mx-auto py-2 text-center text-[10px] sm:text-[11px] text-neutral-400 hidden sm:block">
        Neunte0118
      </footer>
    </div>
  );
}
