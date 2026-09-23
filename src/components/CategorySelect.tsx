import React, { useState } from 'react';
import { QuizCategory, QuizMode } from '../types';
import { getQuizQuestionStatsMap } from '../utils/db';
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
} from 'lucide-react';

interface CategorySelectProps {
  categories: QuizCategory[];
  isLoading: boolean;
  error: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelect: (category: QuizCategory, mode: QuizMode) => void;
  onRefresh: () => void;
  onAddEncryptedCategory: (
    encryptedId: string,
    key: string
  ) => Promise<{ success: boolean; error?: string }>;
  onRemoveCredential: (category: QuizCategory) => void;
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
}: CategorySelectProps) {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  // Mode Selection Modal state
  const [categoryForModeSelect, setCategoryForModeSelect] = useState<QuizCategory | null>(null);
  const [incorrectCount, setIncorrectCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [modeSelectWarning, setModeSelectWarning] = useState<string | null>(null);

  // Add Category Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [inputId, setInputId] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Confirmation Modal state
  const [categoryToDelete, setCategoryToDelete] = useState<QuizCategory | null>(null);

  const handleChooseCategory = async (cat: QuizCategory) => {
    setSelectedTitle(cat.title);
    setCategoryForModeSelect(cat);
    setModeSelectWarning(null);
    setIsLoadingStats(true);
    setIncorrectCount(null);

    try {
      const statsMap = await getQuizQuestionStatsMap(cat.id);
      let count = 0;
      for (const stat of statsMap.values()) {
        if (stat.answered > 0 && stat.correct / stat.answered < 0.9) {
          count++;
        }
      }
      setIncorrectCount(count);
    } catch {
      setIncorrectCount(0);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleStartMode = (mode: QuizMode) => {
    if (!categoryForModeSelect) return;
    if (mode === 'incorrect_only' && incorrectCount === 0) {
      setModeSelectWarning('正答率90%未満の問題がありません。まずは「シャッフル」や「順番通り」で学習してください。');
      return;
    }
    const cat = categoryForModeSelect;
    setCategoryForModeSelect(null);
    setModeSelectWarning(null);
    onSelect(cat, mode);
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
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm">
            表示できる公開単元がありません。
          </div>
        ) : (
          /* Categories List - Non-nested button structure */
          <div className="space-y-2 sm:space-y-2.5">
            {categories.map((cat, idx) => {
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

                  <div className="flex items-center gap-1 pr-3 shrink-0">
                    {cat.isEncrypted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryToDelete(cat);
                        }}
                        className="p-2 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
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
                      className="p-1.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition-colors cursor-pointer"
                    >
                      開始 &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Category Button */}
        <div className="mt-3 sm:mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <button
            id="add-encrypted-category-button"
            type="button"
            onClick={handleOpenModal}
            className="w-full py-2.5 px-3 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 active:bg-neutral-100 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>追加</span>
          </button>
        </div>
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
                    <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                      順番通りに開始
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      IDの昇順（1, 2, 3...）に順番に出題
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
            </div>

            {/* Cancel Button */}
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCategoryForModeSelect(null);
                  setModeSelectWarning(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
            </div>
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
