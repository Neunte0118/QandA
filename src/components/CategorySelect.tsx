import { useState } from 'react';
import { QuizCategory } from '../types';
import { BookOpen, RefreshCw, AlertCircle } from 'lucide-react';

interface CategorySelectProps {
  categories: QuizCategory[];
  isLoading: boolean;
  error: string | null;
  onSelect: (category: QuizCategory) => void;
  onRefresh: () => void;
}

export function CategorySelect({
  categories,
  isLoading,
  error,
  onSelect,
  onRefresh,
}: CategorySelectProps) {
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">単元・科目の選択</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              学習したい一問一答を選択してください
            </p>
          </div>
          <button
            id="refresh-categories-button"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 rounded-xl transition-colors"
            title="再読み込み"
            aria-label="スプレッドシートから再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium">データの取得に問題がありました</p>
              <p className="mt-0.5 text-amber-700">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="mt-2 inline-flex items-center gap-1 font-semibold underline text-amber-900 hover:text-black"
              >
                再試行する
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500" />
            <span className="text-xs font-medium">スプレッドシートから読み込み中...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 text-xs sm:text-sm">
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
                      ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50/70 active:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 group-hover:bg-neutral-200 transition-colors shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-neutral-800 block">
                        {cat.title}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        ID: {cat.id}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400 group-hover:text-neutral-700 transition-colors font-medium shrink-0 ml-2">
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
