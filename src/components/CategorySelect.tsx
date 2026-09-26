import React, { useState, useMemo } from 'react';
import { QuizCategory, QuizMode, QuizQuestion } from '../types';
import { getQuizQuestionStatsMap } from '../utils/db';
import { fetchQuestions } from '../utils/api';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  Moon,
  Sun,
  Key,
  Plus,
  X,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  ListOrdered,
  Shuffle,
  AlertTriangle,
  FileText,
  Tag,
  Check,
  ChevronDown,
} from 'lucide-react';

const HIDDEN_CATEGORIES_STORAGE_KEY = 'quiz_hidden_category_ids_v1';

interface CategorySelectProps {
  categories: QuizCategory[];
  isLoading: boolean;
  error: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelect: (
    category: QuizCategory,
    mode: QuizMode,
    selectedTags?: string[],
    tagFilterMode?: 'OR' | 'AND'
  ) => void;
  onRefresh: () => void;
  onAddEncryptedCategory: (
    encryptedId: string,
    key: string
  ) => Promise<{ success: boolean; error?: string }>;
  onRemoveCredential: (category: QuizCategory) => void;
  onResetCategoryData?: (quizId: string) => Promise<void>;
  onClearAllData?: () => Promise<void>;
  onOpenQuestionList?: (category: QuizCategory, selectedTags?: string[]) => void;
}

export function CategorySelect({
  categories,
  isLoading,
  error,
  isDarkMode,
  onToggleDarkMode,
  onSelect,
  onRefresh,
  onAddEncryptedCategory,
  onRemoveCredential,
  onResetCategoryData,
  onClearAllData,
  onOpenQuestionList,
}: CategorySelectProps) {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  // Hidden categories management
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(HIDDEN_CATEGORIES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHiddenSection, setShowHiddenSection] = useState<boolean>(false);
  const [hideFeedback, setHideFeedback] = useState<string | null>(null);

  const handleHideCategory = (catId: string, catTitle: string) => {
    setHiddenCategoryIds((prev) => {
      const next = prev.includes(catId) ? prev : [...prev, catId];
      try {
        localStorage.setItem(HIDDEN_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setHideFeedback(`「${catTitle}」を非表示にしました`);
    setTimeout(() => setHideFeedback(null), 2500);
  };

  const handleUnhideCategory = (catId: string) => {
    setHiddenCategoryIds((prev) => {
      const next = prev.filter((id) => id !== catId);
      try {
        localStorage.setItem(HIDDEN_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleUnhideAllCategories = () => {
    setHiddenCategoryIds([]);
    try {
      localStorage.removeItem(HIDDEN_CATEGORIES_STORAGE_KEY);
    } catch {}
  };

  // Mode Selection Modal state
  const [categoryForModeSelect, setCategoryForModeSelect] = useState<QuizCategory | null>(null);
  const [incorrectCount, setIncorrectCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [isLoadingTags, setIsLoadingTags] = useState<boolean>(false);
  const [modeSelectWarning, setModeSelectWarning] = useState<string | null>(null);

  // Tag selection for category
  const [categoryQuestions, setCategoryQuestions] = useState<QuizQuestion[]>([]);
  const [availableTags, setAvailableTags] = useState<{ tag: string; count: number }[]>([]);
  const [groupedTags, setGroupedTags] = useState<{ group: string; tags: { tag: string; count: number }[] }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'OR' | 'AND'>('OR');
  const [isTagsExpanded, setIsTagsExpanded] = useState<boolean>(false);

  // Add Category Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [inputId, setInputId] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Category Credential Confirmation Modal state
  const [categoryToDelete, setCategoryToDelete] = useState<QuizCategory | null>(null);

  // Clear Learning Data Modal state
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState<boolean>(false);
  const [selectedTargetScope, setSelectedTargetScope] = useState<string>('all'); // 'all' or category.id
  const [isClearingData, setIsClearingData] = useState<boolean>(false);
  const [dataClearedNotice, setDataClearedNotice] = useState<string | null>(null);
  const [confirmingSingleReset, setConfirmingSingleReset] = useState<boolean>(false);

  const handleChooseCategory = async (cat: QuizCategory) => {
    setSelectedTitle(cat.title);
    setCategoryForModeSelect(cat);
    setModeSelectWarning(null);
    setIsLoadingStats(true);
    setIsLoadingTags(true);
    setIncorrectCount(null);
    setSelectedTags([]);
    setTagFilterMode('OR');
    setIsTagsExpanded(false);

    try {
      const [statsMap, questionsResult] = await Promise.all([
        getQuizQuestionStatsMap(cat.id),
        fetchQuestions(cat.url, cat.decryptionKey, cat.id, cat.hash).catch(() => ({ questions: [] })),
      ]);

      const questions = questionsResult.questions || [];
      setCategoryQuestions(questions);

      // Extract tags grouped by 大分類 (category)
      const groupMap = new Map<string, Map<string, number>>();
      const groupOrder: string[] = [];

      for (const q of questions) {
        if (q.tagDetails && q.tagDetails.length > 0) {
          for (const td of q.tagDetails) {
            const group = td.category || 'その他';
            if (!groupMap.has(group)) {
              groupMap.set(group, new Map());
              groupOrder.push(group);
            }
            const map = groupMap.get(group)!;
            map.set(td.tag, (map.get(td.tag) || 0) + 1);
          }
        } else if (q.tags && q.tags.length > 0) {
          for (const t of q.tags) {
            let group = 'その他';
            let tagName = t;
            if (t.includes(':') || t.includes('：')) {
              const parts = t.split(/[:：]/);
              group = parts[0].trim();
              tagName = parts.slice(1).join(':').trim();
            }
            if (!groupMap.has(group)) {
              groupMap.set(group, new Map());
              groupOrder.push(group);
            }
            const map = groupMap.get(group)!;
            map.set(tagName, (map.get(tagName) || 0) + 1);
          }
        }
      }

      // Sort tags inside each 大分類 in ascending order (昇順ソート)
      const sections: { group: string; tags: { tag: string; count: number }[] }[] = [];
      for (const group of groupOrder) {
        const tagCounts = groupMap.get(group)!;
        const tags = Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => a.tag.localeCompare(b.tag, 'ja')); // 昇順ソート
        sections.push({ group, tags });
      }

      setGroupedTags(sections);
      setAvailableTags(sections.flatMap((s) => s.tags));

      let count = 0;
      for (const stat of statsMap.values()) {
        if (stat.answered > 0 && stat.correct / stat.answered < 0.9) {
          count++;
        }
      }
      setIncorrectCount(count);
    } catch {
      setIncorrectCount(0);
      setCategoryQuestions([]);
      setAvailableTags([]);
      setGroupedTags([]);
    } finally {
      setIsLoadingStats(false);
      setIsLoadingTags(false);
    }
  };

  // Questions matching active tag filter
  const matchingQuestions = useMemo(() => {
    if (!categoryQuestions || categoryQuestions.length === 0) return [];
    if (selectedTags.length === 0) return categoryQuestions;
    return categoryQuestions.filter((q) => {
      const allQTags = new Set<string>();
      if (q.tags) {
        q.tags.forEach((t) => {
          allQTags.add(t);
          if (t.includes(':') || t.includes('：')) {
            const parts = t.split(/[:：]/);
            allQTags.add(parts.slice(1).join(':').trim());
          }
        });
      }
      if (q.tagDetails) {
        q.tagDetails.forEach((td) => {
          allQTags.add(td.tag);
          allQTags.add(`${td.category}:${td.tag}`);
        });
      }
      if (allQTags.size === 0) return false;

      if (tagFilterMode === 'AND') {
        return selectedTags.every((t) => allQTags.has(t));
      }
      return selectedTags.some((t) => allQTags.has(t));
    });
  }, [categoryQuestions, selectedTags, tagFilterMode]);

  const handleStartMode = (mode: QuizMode) => {
    if (!categoryForModeSelect) return;
    if (selectedTags.length > 0 && matchingQuestions.length === 0) {
      setModeSelectWarning('選択したタグに一致する問題がありません。タグを選び直してください。');
      return;
    }
    if (mode === 'incorrect_only' && incorrectCount === 0) {
      setModeSelectWarning('正答率90%未満の問題がありません。まずは「シャッフル」や「順番通り」で学習してください。');
      return;
    }
    const cat = categoryForModeSelect;
    setCategoryForModeSelect(null);
    setModeSelectWarning(null);
    onSelect(cat, mode, selectedTags, tagFilterMode);
  };

  const handleOpenModal = () => {
    setInputId('');
    setInputKey('');
    setModalError(null);
    setShowKey(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalError(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputId.trim()) {
      setModalError('IDを入力...');
      return;
    }
    if (!inputKey.trim()) {
      setModalError('復号キーを入力...');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const result = await onAddEncryptedCategory(inputId.trim(), inputKey.trim());
      if (result.success) {
        setIsModalOpen(false);
      } else {
        setModalError(result.error || '一致する問題が見つかりませんでした');
      }
    } catch {
      setModalError('追加処理中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      onRemoveCredential(categoryToDelete);
      setCategoryToDelete(null);
    }
  };

  // Execute clearing of learning data (scope: 'all' or specific category ID)
  const handleExecuteClearData = async () => {
    setIsClearingData(true);
    setDataClearedNotice(null);
    try {
      if (selectedTargetScope === 'all') {
        if (onClearAllData) {
          await onClearAllData();
        }
        setDataClearedNotice('すべての学習データを削除しました。');
      } else {
        if (onResetCategoryData) {
          await onResetCategoryData(selectedTargetScope);
        }
        const cat = categories.find((c) => c.id === selectedTargetScope);
        setDataClearedNotice(`「${cat?.title || '指定の単元'}」の学習データを削除しました。`);
      }
      setTimeout(() => {
        setIsClearDataModalOpen(false);
        setDataClearedNotice(null);
      }, 1200);
    } catch (err) {
      console.error('Failed to clear learning data:', err);
    } finally {
      setIsClearingData(false);
    }
  };

  // Reset single category from inside Mode Select Modal
  const handleResetCurrentCategoryData = async () => {
    if (!categoryForModeSelect) return;
    setIsClearingData(true);
    try {
      if (onResetCategoryData) {
        await onResetCategoryData(categoryForModeSelect.id);
      }
      setIncorrectCount(0);
      setConfirmingSingleReset(false);
      setModeSelectWarning('学習データをリセットしました。');
      setTimeout(() => {
        setModeSelectWarning(null);
      }, 2500);
    } catch (err) {
      console.error('Failed to reset single category data:', err);
    } finally {
      setIsClearingData(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xs transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <button
              id="theme-toggle-button"
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 -ml-1 text-neutral-600 hover:text-neutral-900 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 rounded-xl transition-colors shrink-0"
              title={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                単元・科目の選択
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                学習したい一問一答を選択してください
              </p>
            </div>
          </div>
          <button
            id="refresh-categories-button"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 rounded-xl transition-colors"
            title="再読み込み"
            aria-label="スプレッドシートから再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-medium">データの取得に問題がありました</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="mt-2 inline-flex items-center gap-1 font-semibold underline text-amber-900 dark:text-amber-200 hover:text-black dark:hover:text-white"
              >
                再試行する
              </button>
            </div>
          </div>
        )}


        {/* Loading state */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 dark:text-neutral-400" />
            <span className="text-xs font-medium">スプレッドシートから読み込み中...</span>
          </div>
        ) : categories.filter((c) => !hiddenCategoryIds.includes(c.id)).length === 0 ? (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm">
            {categories.length > 0 && hiddenCategoryIds.length > 0
              ? 'すべての単元が非表示になっています。'
              : '表示できる公開単元がありません。'}
          </div>
        ) : (
          /* Categories List - Non-nested button structure */
          <div className="space-y-2 sm:space-y-2.5">
            {categories
              .filter((c) => !hiddenCategoryIds.includes(c.id))
              .map((cat, idx) => {
                const isSelected = selectedTitle === cat.title;
                return (
                  <div
                    key={`${cat.id}-${idx}`}
                    className={`w-full rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/80 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <button
                      id={`category-item-${idx}`}
                      type="button"
                      onClick={() => {
                        handleChooseCategory(cat);
                      }}
                      className="flex-1 min-w-0 text-left px-4 py-3.5 flex items-center gap-3 active:opacity-75 touch-manipulation cursor-pointer"
                    >
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          cat.isEncrypted
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {cat.isEncrypted ? (
                          <Key className="w-4 h-4" />
                        ) : (
                          <BookOpen className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                          {cat.title}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 pr-2.5 shrink-0">
                      {/* Hide Category button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideCategory(cat.id, cat.title);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                        title="この単元を非表示にする"
                        aria-label={`${cat.title}を非表示にする`}
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>

                      {cat.isEncrypted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToDelete(cat);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="削除"
                          aria-label={`${cat.title}を削除`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleChooseCategory(cat);
                        }}
                        className="p-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-semibold transition-colors cursor-pointer"
                      >
                        開始 &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Hidden Categories collapsible section */}
        {categories.filter((c) => hiddenCategoryIds.includes(c.id)).length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowHiddenSection((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  非表示の単元 (
                  {categories.filter((c) => hiddenCategoryIds.includes(c.id)).length}件)
                </span>
                <span className="text-[10px] text-neutral-400 underline ml-1">
                  {showHiddenSection ? '閉じる' : '一覧を開く'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleUnhideAllCategories}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                すべて再表示
              </button>
            </div>

            {showHiddenSection && (
              <div className="mt-2.5 space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-700/60">
                {categories
                  .filter((c) => hiddenCategoryIds.includes(c.id))
                  .map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
                    >
                      <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate flex-1 pr-2">
                        {cat.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnhideCategory(cat.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 py-1 px-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer shrink-0"
                        title="再表示する"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>再表示</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Action Button: Add Category inside card */}
        <div className="mt-3 sm:mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center">
          <button
            id="add-encrypted-category-button"
            type="button"
            onClick={handleOpenModal}
            className="w-full py-2.5 px-3 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 active:bg-neutral-100 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>単元を追加</span>
          </button>
        </div>
      </div>

      {/* Outside Actions: 一問一答一覧 & 学習データ削除 (赤色) placed directly below the card div */}
      <div className="mt-3 sm:mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {categories.length > 0 && onOpenQuestionList && (
          <button
            id="open-question-list-button"
            type="button"
            onClick={() => onOpenQuestionList(categories[0])}
            className="w-full py-2.5 px-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 active:bg-neutral-100 dark:active:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl flex items-center justify-center gap-2 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="一問一答一覧を開く"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>一問一答一覧</span>
          </button>
        )}
        {onClearAllData && (
          <button
            id="open-clear-data-modal-button"
            type="button"
            onClick={() => {
              setSelectedTargetScope('all');
              setDataClearedNotice(null);
              setIsClearDataModalOpen(true);
            }}
            className="w-full py-2.5 px-3.5 border border-red-200 dark:border-red-900/60 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 active:bg-red-200/70 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center gap-2 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="学習データ（履歴・正答率）を削除"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
            <span>学習データ削除</span>
          </button>
        )}
      </div>

      {/* Modal: Add Category */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-encrypted-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl relative animate-scaleUp">
            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Title & Icon */}
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <h3
                  id="add-encrypted-title"
                  className="text-base font-bold text-neutral-900 dark:text-neutral-100"
                >
                  追加
                </h3>
              </div>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
              「ID」と「復号キー」を入力してください。
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              {/* Encrypted ID input */}
              <div>
                <label
                  htmlFor="input-category-id"
                  className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
                >
                  ID
                </label>
                <input
                  id="input-category-id"
                  type="text"
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  placeholder="IDを入力..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 transition-all font-mono"
                  autoFocus
                />
              </div>

              {/* Decryption Key input */}
              <div>
                <label
                  htmlFor="input-category-key"
                  className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
                >
                  復号キー
                </label>
                <div className="relative">
                  <input
                    id="input-category-key"
                    type={showKey ? 'text' : 'password'}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="復号キーを入力..."
                    className="w-full px-3 py-2 pr-9 text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded cursor-pointer"
                    aria-label={showKey ? 'パスワードを非表示' : 'パスワードを表示'}
                  >
                    {showKey ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Modal error display */}
              {modalError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-snug">{modalError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  id="submit-add-encrypted-button"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>追加</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mode Selection Modal: 順番通り / シャッフル / 不正解のみ */}
      {categoryForModeSelect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mode-select-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl relative animate-scaleUp">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setCategoryForModeSelect(null);
                setModeSelectWarning(null);
              }}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="mb-4 pr-6">
              <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 block mb-0.5">
                出題モードを選択
              </span>
              <h3
                id="mode-select-title"
                className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate"
              >
                {categoryForModeSelect.title}
              </h3>
            </div>

            {/* Warning Message */}
            {modeSelectWarning && (
              <div className="p-2.5 mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-1.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span className="flex-1 leading-snug">{modeSelectWarning}</span>
              </div>
            )}

            {/* Tag Selection (Multi-select) */}
            {isLoadingTags ? (
              <div className="p-3 mb-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-center gap-2 text-xs text-neutral-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>タグ情報を確認中...</span>
              </div>
            ) : groupedTags.length > 0 ? (
              <div className="mb-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsTagsExpanded((prev) => !prev)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-neutral-100/70 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      タグ指定
                    </span>
                    {selectedTags.length > 0 && (
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.2 rounded">
                        {matchingQuestions.length}問 / 全{categoryQuestions.length}問
                      </span>
                    )}
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
                      isTagsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Collapsed Content */}
                {isTagsExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/50 space-y-2">
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-neutral-400">
                        {selectedTags.length > 0 ? `${selectedTags.length}件選択中` : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {selectedTags.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTags([])}
                            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                          >
                            クリア
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedTags(availableTags.map((t) => t.tag))}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                          >
                            全選択
                          </button>
                        )}
                        {selectedTags.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setTagFilterMode((m) => (m === 'OR' ? 'AND' : 'OR'))}
                            className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer"
                          >
                            {tagFilterMode}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grouped Tag Sections */}
                    <div className="max-h-48 overflow-y-auto pr-1 space-y-2.5">
                      {groupedTags.map(({ group, tags }) => {
                        const allInGroupSelected =
                          tags.length > 0 && tags.every((t) => selectedTags.includes(t.tag));
                        return (
                          <div key={group} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                {group}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const groupTagNames = tags.map((t) => t.tag);
                                  if (allInGroupSelected) {
                                    setSelectedTags((prev) =>
                                      prev.filter((t) => !groupTagNames.includes(t))
                                    );
                                  } else {
                                    setSelectedTags((prev) => [
                                      ...prev,
                                      ...groupTagNames.filter((t) => !prev.includes(t)),
                                    ]);
                                  }
                                }}
                                className="text-[10px] text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline cursor-pointer"
                              >
                                {allInGroupSelected ? '解除' : '全選択'}
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {tags.map(({ tag, count }) => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                      setSelectedTags((prev) =>
                                        isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                                      );
                                    }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xs'
                                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    <span>#{tag}</span>
                                    <span
                                      className={`text-[10px] px-1 py-0.2 rounded-full ${
                                        isSelected
                                          ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                                      }`}
                                    >
                                      {count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Mode Option Buttons */}
            <div className="space-y-2.5">
              {/* 1. 順番通りに開始 */}
              <button
                id="mode-order-button"
                type="button"
                onClick={() => handleStartMode('order')}
                className="w-full text-left p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 active:scale-[0.99] transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ListOrdered className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                        順番通りに開始
                      </span>
                      {selectedTags.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {matchingQuestions.length}問
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      IDの順番通りに出題
                    </div>
                  </div>
                </div>
              </button>

              {/* 2. シャッフルして開始 */}
              <button
                id="mode-shuffle-button"
                type="button"
                onClick={() => handleStartMode('shuffle')}
                className="w-full text-left p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 active:scale-[0.99] transition-all flex items-center justify-between group cursor-pointer relative"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Shuffle className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                        シャッフルして開始
                      </span>
                      {selectedTags.length > 0 && (
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          {matchingQuestions.length}問
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60">
                        おすすめ
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      重要度と正答率に合わせて最適に出題
                    </div>
                  </div>
                </div>
              </button>

              {/* 3. 不正解のみ出題 */}
              <button
                id="mode-incorrect-button"
                type="button"
                onClick={() => handleStartMode('incorrect_only')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                  incorrectCount === 0
                    ? 'border-neutral-200/70 dark:border-neutral-800/70 opacity-60 bg-neutral-50/50 dark:bg-neutral-800/20'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">
                        不正解のみ出題
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          incorrectCount === 0
                            ? 'text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                            : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 border-rose-200/80 dark:border-rose-800/60'
                        }`}
                      >
                        {isLoadingStats
                          ? '確認中...'
                          : incorrectCount !== null
                          ? `${incorrectCount}問`
                          : '苦手特訓'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      正答率が90%未満のもののみ出題
                    </div>
                  </div>
                </div>
              </button>

              {/* 4. 一問一答一覧を見る */}
              {onOpenQuestionList && (
                <button
                  id="mode-view-question-list-button"
                  type="button"
                  onClick={() => {
                    const cat = categoryForModeSelect;
                    setCategoryForModeSelect(null);
                    onOpenQuestionList(cat, selectedTags.length > 0 ? selectedTags : undefined);
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 active:scale-[0.99] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                          一問一答一覧を見る
                        </span>
                        {selectedTags.length > 0 && (
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                            {matchingQuestions.length}問
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        各問題の正答率・出題数・最終日時・重要度を確認
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Footer: Reset Category Data & Cancel / Confirm Reset */}
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              {confirmingSingleReset ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 animate-fadeIn">
                  <p className="text-xs text-rose-800 dark:text-rose-300 font-semibold mb-2">
                    この単元の学習履歴（出題数・正答率）をリセットしますか？
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingSingleReset(false)}
                      disabled={isClearingData}
                      className="px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                    >
                      やめる
                    </button>
                    <button
                      type="button"
                      onClick={handleResetCurrentCategoryData}
                      disabled={isClearingData}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      {isClearingData ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      <span>リセット実行</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryForModeSelect(null);
                      setModeSelectWarning(null);
                      setConfirmingSingleReset(false);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clear Learning Data (All or Specific Category) */}
      {isClearDataModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-data-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl relative animate-scaleUp">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setIsClearDataModalOpen(false);
                setDataClearedNotice(null);
              }}
              disabled={isClearingData}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3
                  id="clear-data-title"
                  className="text-base font-bold text-neutral-900 dark:text-neutral-100"
                >
                  学習データの削除
                </h3>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed">
              この端末に記録された出題履歴や正答率データを削除します。
            </p>

            {/* Success Feedback Notification */}
            {dataClearedNotice && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <span>✓</span>
                <span>{dataClearedNotice}</span>
              </div>
            )}

            {/* Scope Selection */}
            {!dataClearedNotice && (
              <div className="space-y-3 mb-5">
                <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  削除する対象を選択
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="clearScope"
                      value="all"
                      checked={selectedTargetScope === 'all'}
                      onChange={(e) => setSelectedTargetScope(e.target.value)}
                      className="accent-rose-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        すべての単元の学習データを削除
                      </div>
                    </div>
                  </label>

                  {categories.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                        または特定の単元のみ選択:
                      </div>
                      <select
                        value={selectedTargetScope === 'all' ? '' : selectedTargetScope}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedTargetScope(e.target.value);
                          }
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">単元を選択してください...</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            {!dataClearedNotice && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsClearDataModalOpen(false)}
                  disabled={isClearingData}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  id="confirm-execute-clear-button"
                  onClick={handleExecuteClearData}
                  disabled={isClearingData}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isClearingData ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {selectedTargetScope === 'all'
                      ? '全データを削除'
                      : '選択した単元を削除'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (no blocked window.confirm) */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl relative animate-scaleUp">
            <h3
              id="delete-confirm-title"
              className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-2"
            >
              削除の確認
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-5 leading-relaxed">
              「{categoryToDelete.title}」を削除しますか？
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
