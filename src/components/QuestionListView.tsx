import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QuizCategory, QuizQuestion, QuestionStats, QuizMode } from '../types';
import FormattedText from './FormattedText';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Star,
  Eye,
  EyeOff,
  ChevronDown,
  Play,
  Filter,
  BarChart3,
  X,
  ChevronUp,
  Loader2,
} from 'lucide-react';

interface QuestionListViewProps {
  category: QuizCategory;
  allCategories: QuizCategory[];
  questions: QuizQuestion[];
  statsMap: Map<string, QuestionStats>;
  isLoading: boolean;
  error: string | null;
  onSelectCategory: (category: QuizCategory) => void;
  onStartQuiz: (category: QuizCategory, mode: QuizMode, startQuestionId?: string) => void;
  onBack: () => void;
}

type FilterStatus = 'all' | 'incorrect' | 'mastered' | 'unanswered';
type SortOption =
  | 'id'
  | 'accuracy_asc'
  | 'accuracy_desc'
  | 'answered_desc'
  | 'answered_asc'
  | 'last_shown_desc'
  | 'importance_desc';

const INITIAL_PAGE_SIZE = 25;
const PAGE_INCREMENT = 25;

/**
 * Format timestamp into YYYY/MM/DD HH:mm:ss
 */
function formatLastAnswered(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return '未回答';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '未回答';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
}

/**
 * Helper to parse importance into numeric level
 */
function parseImportance(importance?: string): number {
  if (!importance) return 0;
  const num = parseInt(importance.trim(), 10);
  if (!isNaN(num)) return num;
  const starCount = (importance.match(/★/g) || []).length;
  if (starCount > 0) return starCount;
  return 0;
}

export function QuestionListView({
  category,
  allCategories,
  questions,
  statsMap,
  isLoading,
  error,
  onSelectCategory,
  onStartQuiz,
  onBack,
}: QuestionListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('id');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [isAllAnswersVisible, setIsAllAnswersVisible] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Progressive infinite scroll
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Toggle single answer
  const toggleAnswer = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all answers
  const toggleAllAnswers = () => {
    if (isAllAnswersVisible) {
      setRevealedIds(new Set());
      setIsAllAnswersVisible(false);
    } else {
      const allIds = new Set(questions.map((q) => q.id));
      setRevealedIds(allIds);
      setIsAllAnswersVisible(true);
    }
  };

  // Summary statistics
  const summary = useMemo(() => {
    let answeredCount = 0;
    let totalAttempts = 0;
    let totalCorrect = 0;
    let incorrectCount = 0; // answered and <90%
    let masteredCount = 0; // answered and >=90%

    questions.forEach((q) => {
      const stat = statsMap.get(q.id);
      if (stat && stat.answered > 0) {
        answeredCount++;
        totalAttempts += stat.answered;
        totalCorrect += stat.correct;
        const rate = stat.correct / stat.answered;
        if (rate >= 0.9) {
          masteredCount++;
        } else {
          incorrectCount++;
        }
      }
    });

    const unansweredCount = questions.length - answeredCount;
    const overallAccuracy =
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    return {
      total: questions.length,
      answeredCount,
      unansweredCount,
      incorrectCount,
      masteredCount,
      overallAccuracy,
      totalAttempts,
      totalCorrect,
    };
  }, [questions, statsMap]);

  // Unique importance levels in questions
  const availableImportances = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.importance) set.add(q.importance.trim());
    });
    return Array.from(set).sort((a, b) => parseImportance(b) - parseImportance(a));
  }, [questions]);

  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    let result = [...questions];

    // Search query filter
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.question.toLowerCase().includes(qLower) ||
          item.answer.toLowerCase().includes(qLower) ||
          item.id.toLowerCase().includes(qLower)
      );
    }

    // Status filter
    if (statusFilter === 'incorrect') {
      result = result.filter((item) => {
        const stat = statsMap.get(item.id);
        return stat && stat.answered > 0 && stat.correct / stat.answered < 0.9;
      });
    } else if (statusFilter === 'mastered') {
      result = result.filter((item) => {
        const stat = statsMap.get(item.id);
        return stat && stat.answered > 0 && stat.correct / stat.answered >= 0.9;
      });
    } else if (statusFilter === 'unanswered') {
      result = result.filter((item) => {
        const stat = statsMap.get(item.id);
        return !stat || stat.answered === 0;
      });
    }

    // Importance filter
    if (importanceFilter !== 'all') {
      result = result.filter((item) => item.importance?.trim() === importanceFilter);
    }

    // Sorting
    result.sort((a, b) => {
      const statA = statsMap.get(a.id);
      const statB = statsMap.get(b.id);
      const accA = statA && statA.answered > 0 ? statA.correct / statA.answered : -1;
      const accB = statB && statB.answered > 0 ? statB.correct / statB.answered : -1;

      switch (sortOption) {
        case 'accuracy_asc':
          if (accA === -1 && accB !== -1) return 1;
          if (accB === -1 && accA !== -1) return -1;
          return accA - accB;
        case 'accuracy_desc':
          return accB - accA;
        case 'answered_desc':
          return (statB?.answered ?? 0) - (statA?.answered ?? 0);
        case 'answered_asc':
          return (statA?.answered ?? 0) - (statB?.answered ?? 0);
        case 'last_shown_desc':
          return (statB?.lastShown ?? 0) - (statA?.lastShown ?? 0);
        case 'importance_desc':
          return parseImportance(b.importance) - parseImportance(a.importance);
        case 'id':
        default:
          return a.id.localeCompare(b.id, undefined, { numeric: true });
      }
    });

    return result;
  }, [questions, statsMap, searchQuery, statusFilter, importanceFilter, sortOption]);

  // Reset pagination on filter or category change
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [searchQuery, statusFilter, importanceFilter, sortOption, category.id]);

  // Sliced questions for progressive rendering
  const displayedQuestions = useMemo(() => {
    return filteredQuestions.slice(0, visibleCount);
  }, [filteredQuestions, visibleCount]);

  // Progressive scroll loading via IntersectionObserver
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          if (visibleCount < filteredQuestions.length) {
            setIsLoadingMore(true);
            setTimeout(() => {
              setVisibleCount((prev) => Math.min(prev + PAGE_INCREMENT, filteredQuestions.length));
              setIsLoadingMore(false);
            }, 100);
          }
        }
      },
      {
        root: null,
        rootMargin: '300px 0px',
        threshold: 0.05,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, filteredQuestions.length]);

  // Scroll to top button visibility check
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_INCREMENT, filteredQuestions.length));
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-2 sm:space-y-2.5 pb-16 animate-fadeIn text-neutral-900 dark:text-neutral-100 touch-pan-y">
      {/* Top Header Card: Compact Single Row */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 sm:p-3 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 py-1 px-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>単元選択</span>
          </button>

          {/* Category Dropdown Switcher */}
          <div className="relative flex-1 min-w-[160px] max-w-xs sm:max-w-md">
            <button
              type="button"
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="w-full flex items-center justify-between gap-1.5 py-1 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/60 text-xs font-bold text-neutral-900 dark:text-neutral-100 transition-colors text-left cursor-pointer group"
              title="単元を切り替え"
            >
              <span className="truncate">{category.title}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${
                  isCategoryDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCategoryDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden animate-fadeIn">
                <div className="max-h-56 overflow-y-auto p-1 divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {allCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        cat.id === category.id
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                          : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="truncate flex-1">{cat.title}</span>
                      {cat.id === category.id && (
                        <span className="text-[10px] ml-2 shrink-0">選択中</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Quiz Start button */}
          <button
            type="button"
            onClick={() => onStartQuiz(category, 'shuffle')}
            className="inline-flex items-center gap-1.5 py-1 px-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>クイズ開始</span>
          </button>
        </div>

        {/* Compact Summary Strip */}
        <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span className="text-neutral-500 dark:text-neutral-400">
              全 <strong className="text-neutral-900 dark:text-neutral-100">{summary.total}</strong> 問
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <span className="text-neutral-500 dark:text-neutral-400">
              学習済 <strong className="text-neutral-900 dark:text-neutral-100">{summary.answeredCount}</strong>問
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <span className="text-neutral-500 dark:text-neutral-400">
              平均正答率:{' '}
              <strong
                className={
                  summary.overallAccuracy >= 90
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : summary.overallAccuracy >= 60
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 font-bold'
                }
              >
                {summary.answeredCount > 0 ? `${summary.overallAccuracy}%` : 'ー'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
              習得 {summary.masteredCount}問
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold">
              要復習 {summary.incorrectCount}問
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
              未回答 {summary.unansweredCount}問
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar: Compact */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 sm:p-3 shadow-xs space-y-2 transition-colors">
        {/* Row 1: Search + Toggle All Answers */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="問題・解答・キーワードを検索..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-neutral-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
                title="クリア"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={toggleAllAnswers}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title={isAllAnswersVisible ? 'すべての解答を隠す' : 'すべての解答を表示'}
          >
            {isAllAnswersVisible ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">全解答を隠す</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">全解答を表示</span>
              </>
            )}
          </button>
        </div>

        {/* Row 2: Status Filters & Selectors in one compact wrap */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800 text-xs">
          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              すべて ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('incorrect')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'incorrect'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              要復習 ({summary.incorrectCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('mastered')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'mastered'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              習得 ({summary.masteredCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unanswered')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === 'unanswered'
                  ? 'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              未回答 ({summary.unansweredCount})
            </button>
          </div>

          {/* Importance & Sort Dropdowns */}
          <div className="flex items-center gap-2 text-[11px]">
            {availableImportances.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-neutral-400">重要度:</span>
                <select
                  value={importanceFilter}
                  onChange={(e) => setImportanceFilter(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-1.5 py-0.5 text-neutral-800 dark:text-neutral-200 font-medium focus:outline-hidden"
                >
                  <option value="all">すべて</option>
                  {availableImportances.map((imp) => (
                    <option key={imp} value={imp}>
                      ★ {imp}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1">
              <span className="text-neutral-400">順序:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-1.5 py-0.5 text-neutral-800 dark:text-neutral-200 font-medium focus:outline-hidden"
              >
                <option value="id">問題順</option>
                <option value="accuracy_asc">正答率: 低い順</option>
                <option value="accuracy_desc">正答率: 高い順</option>
                <option value="answered_desc">出題数: 多い順</option>
                <option value="answered_asc">出題数: 少ない順</option>
                <option value="last_shown_desc">最新回答日時順</option>
                <option value="importance_desc">重要度: 高い順</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="inline-block w-5 h-5 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-800 dark:border-t-neutral-200 rounded-full animate-spin mb-2" />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">問題一覧を読み込み中...</p>
        </div>
      ) : error ? (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs text-center">
          {error}
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 text-center text-neutral-400 dark:text-neutral-500 text-xs">
          条件に一致する問題が見つかりませんでした。
        </div>
      ) : (
        /* Compact Question List Cards - Progressive Infinite Scroll */
        <div className="space-y-1.5 sm:space-y-2">
          {displayedQuestions.map((q, idx) => {
            const stat = statsMap.get(q.id);
            const answered = stat?.answered ?? 0;
            const correct = stat?.correct ?? 0;
            const accuracy =
              answered > 0 ? Math.round((correct / answered) * 100) : null;
            const lastShownText = formatLastAnswered(stat?.lastShown);
            const isRevealed = revealedIds.has(q.id);
            const impNumber = parseImportance(q.importance);

            return (
              <div
                key={q.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 sm:p-3 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
              >
                {/* Header row: Question number, importance, accuracy, stats & last answered */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-neutral-100 dark:border-neutral-800/60 text-[11px]">
                  {/* Left: Question Number & Importance */}
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-[10px]">
                      問 {idx + 1}
                    </span>

                    {/* 重要度 */}
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 text-[10px] font-bold"
                      title={`重要度: ${q.importance || '未設定'}`}
                    >
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                      <span>重要度: {q.importance || impNumber || 'ー'}</span>
                    </span>
                  </div>

                  {/* Right: Accuracy, Correct/Answered Counts, Last Answered Datetime */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {/* 正答率 */}
                    {accuracy !== null ? (
                      <span
                        className={`px-1.5 py-0.5 rounded-full font-bold border ${
                          accuracy >= 90
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : accuracy >= 60
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        正答率: {accuracy}%
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        正答率: 未回答
                      </span>
                    )}

                    {/* 正答数 / 出題数 */}
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                      正答: <strong className="font-bold">{correct}</strong> / 出題:{' '}
                      <strong className="font-bold">{answered}</strong>回
                    </span>

                    {/* 最後に答えた日付時間 */}
                    <span
                      className="hidden sm:inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-mono text-[10px]"
                      title="最後に答えた日時"
                    >
                      <Clock className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                      <span>{lastShownText}</span>
                    </span>
                  </div>
                </div>

                {/* Question & Answer Content: Compact and tight */}
                <div className="mt-1.5 space-y-1.5">
                  {/* Question Text */}
                  <div className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-snug break-words">
                    <FormattedText text={q.question} />
                  </div>

                  {/* Mobile-only Last Answered line if space was tight */}
                  <div className="sm:hidden flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    <span>最後に答えた日時: {lastShownText}</span>
                  </div>

                  {/* Answer Section: Compact Revealable */}
                  <div className="pt-0.5">
                    {isRevealed ? (
                      <div className="p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/60 dark:border-emerald-900/40 text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-start justify-between gap-2 animate-fadeIn">
                        <div className="flex-1 leading-snug">
                          <span className="inline-block text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-1 py-0.2 rounded mr-1.5">
                            解答
                          </span>
                          <FormattedText text={q.answer} />
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAnswer(q.id)}
                          className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 px-1 py-0.5 rounded hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 shrink-0 transition-colors cursor-pointer"
                        >
                          隠す
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleAnswer(q.id)}
                        className="inline-flex items-center gap-1 py-1 px-2.5 rounded-md bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800/60 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-700/60 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-neutral-400" />
                        <span>解答を表示</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Progressive Scroll Loading Sentinel & Status */}
          {visibleCount < filteredQuestions.length ? (
            <div ref={sentinelRef} className="py-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-600 dark:text-neutral-300" />
                    <span>スクロールを検知、追加読み込み中...</span>
                  </>
                ) : (
                  <span>
                    全 {filteredQuestions.length} 問中 {displayedQuestions.length} 問を表示中
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={loadMore}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>さらに表示する (+{Math.min(PAGE_INCREMENT, filteredQuestions.length - displayedQuestions.length)}問)</span>
              </button>
            </div>
          ) : (
            filteredQuestions.length > INITIAL_PAGE_SIZE && (
              <div className="py-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
                すべての問題（全 {filteredQuestions.length} 問）を表示しました
              </div>
            )
          )}
        </div>
      )}

      {/* Bottom return button */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>単元一覧に戻る</span>
        </button>
      </div>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-2.5 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center animate-fadeIn"
          title="トップに戻る"
          aria-label="トップに戻る"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default QuestionListView;
