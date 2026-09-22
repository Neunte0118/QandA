import { useState } from 'react';
import { QuizCategory } from '../types';
import { BookOpen, RefreshCw, AlertCircle, Moon, Sun } from 'lucide-react';

interface CategorySelectProps {
  categories: QuizCategory[];
  isLoading: boolean;
  error: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelect: (category: QuizCategory) => void;
  onRefresh: () => void;
}

export function CategorySelect({
  categories,
  isLoading,
  error,
  isDarkMode,
  onToggleDarkMode,
  onSelect,
  onRefresh,
}: CategorySelectProps) {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xs transition-colors">
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
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">単元・科目の選択</h2>
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

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 dark:text-neutral-400" />
            <span className="text-xs font-medium">スプレッドシートから読み込み中...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm">
            表示できる単元がありません。
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-2.5">
            {categories.map((cat, idx) => {
              const isSelected = selectedTitle === cat.title;
              return (
                <button
                  key={`${cat.id}-${idx}`}
                  id={`category-item-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedTitle(cat.title);
                    onSelect(cat);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center justify-between group active:scale-[0.99] touch-manipulation ${
                    isSelected
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/80 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50 active:bg-neutral-100 dark:active:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 block">
                      {cat.title}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors font-medium shrink-0 ml-2">
                    開始 &rarr;
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
