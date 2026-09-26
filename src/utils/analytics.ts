/**
 * User measurement / analytics tracking
 * Obfuscated Google Form endpoint and parameters (no plaintext URLs in code)
 */

const _k = 0x5b;
const _d = (a: number[]): string => a.map((c) => String.fromCharCode(c ^ _k)).join('');

// Obfuscated form endpoint: https://docs.google.com/forms/d/1y5QHwinkbB3oDHKuiIUUBOlJHXnNY1lsjg2HYpiEXac/formResponse
const _F = [
  51, 47, 47, 43, 40, 97, 116, 116, 63, 52, 56, 40, 117, 60, 52, 52, 60, 55, 62, 117, 56, 52, 54,
  116, 61, 52, 41, 54, 40, 116, 63, 116, 106, 34, 110, 10, 19, 44, 50, 53, 48, 57, 25, 104, 52,
  31, 19, 16, 46, 50, 18, 14, 14, 25, 20, 55, 17, 19, 3, 53, 21, 2, 106, 55, 40, 49, 60, 105, 19,
  2, 43, 50, 30, 3, 58, 56, 116, 61, 52, 41, 54, 9, 62, 40, 43, 52, 53, 40, 62,
];

// Obfuscated entry IDs
const _E_UID = [62, 53, 47, 41, 34, 117, 106, 104, 99, 98, 105, 98, 105, 108, 107, 98]; // entry.1389292709
const _E_UTYPE = [62, 53, 47, 41, 34, 117, 106, 110, 111, 110, 110, 109, 99, 109, 98, 111]; // entry.1545568694
const _E_DEV = [62, 53, 47, 41, 34, 117, 106, 108, 111, 104, 105, 104, 104, 107, 98, 108]; // entry.1743233097
const _E_BROWSER = [62, 53, 47, 41, 34, 117, 106, 110, 104, 98, 107, 104, 104, 108, 110, 105]; // entry.1539033752
const _E_PWA = [62, 53, 47, 41, 34, 117, 106, 110, 98, 98, 109, 111, 109, 99, 98, 108]; // entry.1599646897

const STORAGE_KEY_USER_ID = 'quiz_analytics_user_id';
const STORAGE_KEY_LAST_SENT_DATE = 'quiz_analytics_last_sent_date';
const STORAGE_KEY_HAS_SENT = 'quiz_analytics_has_sent';

let isTrackingInProgress = false;

/**
 * Returns today's date string in local time (YYYY-MM-DD)
 */
function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Detects device name (e.g. iPhone, Android, iPad, Mac, Windows, Linux)
 */
export function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'Other';
  const ua = navigator.userAgent || '';
  if (
    /iPad|Tablet/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ) {
    return 'iPad';
  }
  if (/iPhone|iPod/i.test(ua)) return 'iPhone';
  if (/Android.*Mobile/i.test(ua)) return 'Android';
  if (/Android/i.test(ua)) return 'Android Tablet';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  return 'Other';
}

/**
 * Detects browser name (e.g. Chrome, Safari, Firefox, Edge)
 */
export function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'Other';
  const ua = navigator.userAgent || '';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera\//i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/MSIE|Trident/i.test(ua)) return 'IE';
  return 'Other';
}

/**
 * Detects whether the app is running in PWA standalone mode
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');
  return !!isStandalone;
}

/**
 * Retrieves the existing anonymous user ID or generates a new one.
 */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  let userId: string | null = null;
  try {
    userId = localStorage.getItem(STORAGE_KEY_USER_ID);
  } catch {
    // ignore
  }

  if (!userId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      userId = crypto.randomUUID();
    } else {
      userId = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }
    try {
      localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    } catch {
      // ignore
    }
  }

  return userId;
}

/**
 * Tracks user visit and submits analytics to Google Forms.
 * - Strictly limited to ONCE per calendar day per user.
 * - If ?user_type=(something) is in the URL, sends that value.
 * - Otherwise, sends '新規' on the first ever recorded visit, and 'リピーター' on subsequent days.
 */
export async function trackUserVisit(): Promise<void> {
  if (typeof window === 'undefined' || isTrackingInProgress) return;
  isTrackingInProgress = true;

  try {
    const today = getTodayString();
    const userId = getOrCreateUserId();

    // Check query parameter ?user_type=...
    const urlParams = new URLSearchParams(window.location.search);
    const queryUserType = urlParams.get('user_type');

    let userType: string;
    let hasSentInitial = false;
    let lastSentDate: string | null = null;

    try {
      lastSentDate = localStorage.getItem(STORAGE_KEY_LAST_SENT_DATE);
      hasSentInitial = localStorage.getItem(STORAGE_KEY_HAS_SENT) === '1';
    } catch {
      // ignore storage access errors
    }

    if (queryUserType && queryUserType.trim().length > 0) {
      userType = queryUserType.trim();
      // For explicit query parameters, allow 1 send per query value per day
      const queryKey = `${today}_${userType}`;
      if (lastSentDate === queryKey) {
        return; // Already sent this user_type today
      }
    } else {
      // Normal visit: strictly 1 time per day
      if (lastSentDate === today) {
        // Already sent today! Do not send again today.
        return;
      }
      userType = hasSentInitial ? 'リピーター' : '新規';
    }

    const device = detectDevice();
    const browser = detectBrowser();
    const pwaStatus = isPWA() ? 'true' : 'false';

    const formData = new URLSearchParams();
    formData.append(_d(_E_UID), userId);
    formData.append(_d(_E_UTYPE), userType);
    formData.append(_d(_E_DEV), device);
    formData.append(_d(_E_BROWSER), browser);
    formData.append(_d(_E_PWA), pwaStatus);

    // Save date immediately to prevent duplicate sends on fast reloads or React StrictMode
    try {
      if (queryUserType && queryUserType.trim().length > 0) {
        localStorage.setItem(STORAGE_KEY_LAST_SENT_DATE, `${today}_${userType}`);
      } else {
        localStorage.setItem(STORAGE_KEY_LAST_SENT_DATE, today);
        localStorage.setItem(STORAGE_KEY_HAS_SENT, '1');
      }
    } catch {
      // ignore
    }

    await fetch(_d(_F), {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  } catch (err) {
    console.error('Analytics tracking error:', err);
  } finally {
    isTrackingInProgress = false;
  }
}
