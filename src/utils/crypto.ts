import CryptoJS from 'crypto-js';

const STORAGE_KEY = 'quiz_unlocked_encrypted_categories_v1';

export interface StoredCredential {
  id: string; // The encrypted ID or raw ID
  title: string; // Decrypted title for display
  key: string; // The decryption key
  addedAt: number;
}

/**
 * Decrypts a CryptoJS AES-encrypted string (prefixed with "enc:" or raw).
 * Returns null if decryption fails or if output is empty.
 */
export function decryptCryptoJS(encryptedText: string, password: string): string | null {
  if (!encryptedText) return null;
  const raw = encryptedText.startsWith('enc:')
    ? encryptedText.slice(4).trim()
    : encryptedText.trim();

  if (!raw) return null;

  try {
    const bytes = CryptoJS.AES.decrypt(raw, password);
    const text = bytes.toString(CryptoJS.enc.Utf8);
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Encrypts plaintext with CryptoJS AES-256 using password, with 'enc:' prefix.
 */
export function encryptCryptoJS(plainText: string, password: string): string {
  const cipher = CryptoJS.AES.encrypt(plainText, password).toString();
  return `enc:${cipher}`;
}

/**
 * Checks if a value is marked as encrypted
 */
export function isEncryptedValue(val: string | undefined): boolean {
  return typeof val === 'string' && val.trim().startsWith('enc:');
}

/**
 * Normalize an ID for flexible comparison (strips quotes, whitespace, and 'enc:' prefix)
 */
export function normalizeEncryptedId(id: string | undefined): string {
  if (!id) return '';
  return id
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .toLowerCase()
    .replace(/^enc:/i, '')
    .replace(/\s+/g, '');
}

/**
 * Retrieve saved credentials from localStorage
 */
export function getSavedCredentials(): StoredCredential[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) =>
          c &&
          typeof c.key === 'string' &&
          (typeof c.id === 'string' || typeof c.title === 'string')
      );
    }
    return [];
  } catch (err) {
    console.error('Failed to read saved encryption credentials from localStorage:', err);
    return [];
  }
}

/**
 * Save or update a credential in localStorage by encrypted ID and/or title
 */
export function saveCredential(id: string, title: string, key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedCredentials();
    const cleanId = id.trim().replace(/^["']|["']$/g, '').trim();
    const cleanTitle = title.trim();
    const cleanKey = key.trim();
    const normId = normalizeEncryptedId(cleanId);

    // Remove existing with same ID or title
    const filtered = current.filter((c) => {
      const existingNormId = normalizeEncryptedId(c.id);
      if (normId && existingNormId && normId === existingNormId) return false;
      if (cleanTitle && c.title && cleanTitle.toLowerCase() === c.title.toLowerCase()) return false;
      return true;
    });

    filtered.push({
      id: cleanId,
      title: cleanTitle,
      key: cleanKey,
      addedAt: Date.now(),
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to save encryption credential to localStorage:', err);
  }
}

export interface RemoveCategoryTarget {
  id?: string;
  rawId?: string;
  title?: string;
  rawTitle?: string;
  decryptionKey?: string;
}

/**
 * Robustly removes saved credential matching any of the category's identifiers or key
 */
export function removeCategoryCredential(target: RemoveCategoryTarget | string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedCredentials();
    if (typeof target === 'string') {
      const cleanTarget = target.trim();
      const normTarget = normalizeEncryptedId(cleanTarget);
      const filtered = current.filter((c) => {
        if (c.id && (c.id === cleanTarget || normalizeEncryptedId(c.id) === normTarget)) {
          return false;
        }
        if (c.title && c.title.trim().toLowerCase() === cleanTarget.toLowerCase()) {
          return false;
        }
        return true;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return;
    }

    const normId = target.id ? normalizeEncryptedId(target.id) : '';
    const normRawId = target.rawId ? normalizeEncryptedId(target.rawId) : '';
    const cleanTitle = target.title ? target.title.trim().toLowerCase() : '';

    const filtered = current.filter((c) => {
      const cNormId = normalizeEncryptedId(c.id);
      if (normId && cNormId && normId === cNormId) return false;
      if (normRawId && cNormId && normRawId === cNormId) return false;
      if (cleanTitle && c.title && cleanTitle === c.title.trim().toLowerCase()) return false;
      if (target.decryptionKey && c.key === target.decryptionKey) return false;
      if (target.rawTitle) {
        const decrypted = decryptCryptoJS(target.rawTitle, c.key);
        if (decrypted && (!cleanTitle || decrypted.trim().toLowerCase() === cleanTitle)) {
          return false;
        }
      }
      return true;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to remove encryption credential from localStorage:', err);
  }
}

/**
 * Backward-compatible removeCredential
 */
export function removeCredential(identifier: string): void {
  removeCategoryCredential(identifier);
}
