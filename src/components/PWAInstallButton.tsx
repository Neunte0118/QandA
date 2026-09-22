import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, X } from 'lucide-react';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-button"
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg shadow-2xs transition-colors"
      >
        <Download className="w-3.5 h-3.5 text-neutral-600" />
        <span>アプリをインストール</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-button"
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg shadow-2xs transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-neutral-600" />
          <span>ホーム画面に追加</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 backdrop-blur-2xs animate-fadeIn">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-neutral-200">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <h3 className="text-sm font-bold text-neutral-900">
                  ホーム画面に追加する手順
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="my-4 text-xs text-neutral-600 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    Safari画面下のツールバーにある共有ボタン（
                    <Share className="w-3.5 h-3.5 inline text-blue-600 -mt-0.5" />
                    ）をタップします。
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                    2
                  </span>
                  <p>メニューを下にスクロールして「ホーム画面に追加」を選びます。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
