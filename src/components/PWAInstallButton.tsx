import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, X, HelpCircle, CheckCircle2 } from 'lucide-react';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already running inside installed standalone PWA
  if (isInstalled) {
    return (
      <span />
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* If standard beforeinstallprompt is ready */}
        {isInstallable ? (
          <button
            id="pwa-install-button"
            type="button"
            onClick={install}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white dark:text-neutral-900 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 active:bg-black rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>インストール</span>
          </button>
        ) : isIOS ? (
          <button
            id="pwa-ios-install-button"
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            <span>ホーム画面に追加</span>
          </button>
        ) : (
          /* When browser hasn't fired beforeinstallprompt or inside preview iframe */
          <button
            id="pwa-help-install-button"
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xs transition-colors"
            title="インストール方法を見る"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span>インストール案内</span>
          </button>
        )}
      </div>

      {/* Installation instruction modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                <span>アプリのインストール方法</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 text-xs text-neutral-600 dark:text-neutral-400 space-y-3">
              {/* iframe notice */}
              {window.self !== window.top && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
                  <strong>重要:</strong> プレビュー画面（枠内）ではブラウザの仕様によりPWAインストールが制限されます。右上の「新しいタブで開く」または公開URLを直接開いてお試しください。
                </div>
              )}

              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">iPhone / iPad (Safari) の場合:</p>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold shrink-0 text-[11px]">
                      1
                    </span>
                    <p>
                      画面下の共有ボタン（
                      <Share className="w-3.5 h-3.5 inline text-blue-600 -mt-0.5" />
                      ）をタップします。
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold shrink-0 text-[11px]">
                      2
                    </span>
                    <p>「ホーム画面に追加」を選び、右上の「追加」をタップします。</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">Android (Chrome) の場合:</p>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold shrink-0 text-[11px]">
                      1
                    </span>
                    <p>Chrome右上の「︙（メニュー）」をタップします。</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold shrink-0 text-[11px]">
                      2
                    </span>
                    <p>「アプリをインストール」または「ホーム画面に追加」を選択します。</p>
                  </div>

                  <p className="font-semibold text-neutral-800 dark:text-neutral-200 pt-1">PC (Chrome / Edge) の場合:</p>
                  <p>アドレスバー右端に表示される「インストール」アイコンをクリックします。</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
