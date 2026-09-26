/**
 * User measurement / analytics tracking via Google Forms
 */

export const ANALYTICS_FORM_URL =
  'https://docs.google.com/forms/d/1y5QHwinkbB3oDHKuiIUUBOlJHXnNY1lsjg2HYpiEXac/formResponse';

export const ANALYTICS_ENTRY_USER_ID = 'entry.1389292709';
export const ANALYTICS_ENTRY_USER_TYPE = 'entry.1545568694';
export const ANALYTICS_ENTRY_DEVICE = 'entry.1743233097';
export const ANALYTICS_ENTRY_BROWSER = 'entry.1539033752';
export const ANALYTICS_ENTRY_PWA = 'entry.1599646897';

const STORAGE_KEY_USER_ID = 'quiz_analytics_user_id';
const STORAGE_KEY_LAST_SENT = 'quiz_analytics_last_sent_key';

let isTrackingInProgress = false;

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
export function getOrCreateUserId(): { userId: string; isNewUser: boolean } {
  if (typeof window === 'undefined') {
    return { userId: 'unknown', isNewUser: false };
  }

  let userId: string | null = null;
  let isNewUser = false;

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
    isNewUser = true;
  }

  return { userId, isNewUser };
}

/**
 * Tracks user visit and submits analytics to Google Forms.
 * - Checks URL for ?user_type=(something)
 * - If not present, sends '新規' (for brand new users) or 'リピーター'
 * - Debounces to send once per day (or per user_type change)
 */
export async function trackUserVisit(): Promise<void> {
  if (typeof window === 'undefined' || isTrackingInProgress) return;
  isTrackingInProgress = true;

  try {
    const todayKey = new Date().toLocaleDateString('sv'); // YYYY-MM-DD
    const { userId, isNewUser } = getOrCreateUserId();

    // Check query param ?user_type=...
    const urlParams = new URLSearchParams(window.location.search);
    const queryUserType = urlParams.get('user_type');

    let userType: string;
    if (queryUserType && queryUserType.trim().length > 0) {
      userType = queryUserType.trim();
    } else {
      userType = isNewUser ? '新規' : 'リピーター';
    }

    const dedupeKey = `${todayKey}_${userType}`;

    // Check if already sent today with this userType
    try {
      const lastSent = localStorage.getItem(STORAGE_KEY_LAST_SENT);
      const sessionSent = sessionStorage.getItem(STORAGE_KEY_LAST_SENT);
      if (lastSent === dedupeKey || sessionSent === dedupeKey) {
        return;
      }
    } catch {
      // ignore storage access errors
    }

    const device = detectDevice();
    const browser = detectBrowser();
    const pwaStatus = isPWA() ? 'true' : 'false';

    const formData = new URLSearchParams();
    formData.append(ANALYTICS_ENTRY_USER_ID, userId);
    formData.append(ANALYTICS_ENTRY_USER_TYPE, userType);
    formData.append(ANALYTICS_ENTRY_DEVICE, device);
    formData.append(ANALYTICS_ENTRY_BROWSER, browser);
    formData.append(ANALYTICS_ENTRY_PWA, pwaStatus);

    // Save sent state before sending to avoid race conditions
    try {
      sessionStorage.setItem(STORAGE_KEY_LAST_SENT, dedupeKey);
      localStorage.setItem(STORAGE_KEY_LAST_SENT, dedupeKey);
    } catch {
      // ignore
    }

    await fetch(ANALYTICS_FORM_URL, {
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
