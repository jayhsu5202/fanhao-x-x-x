/** 與 React Context 解耦，供 api/client 與 Provider 共用，避免循環依賴導致讀到過期語系。 */

export const MISSAV_LOCALE_STORAGE_KEY = "missavLocale";
export const MISSAV_LOCALE_DEFAULT = "zh-Hant";
export const MISSAV_LOCALE_CHANGE_EVENT = "missav-locale-change";

export function getStoredMissavLocale(): string {
  if (typeof window === "undefined") return MISSAV_LOCALE_DEFAULT;
  try {
    return localStorage.getItem(MISSAV_LOCALE_STORAGE_KEY) || MISSAV_LOCALE_DEFAULT;
  } catch {
    return MISSAV_LOCALE_DEFAULT;
  }
}

export function setStoredMissavLocale(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MISSAV_LOCALE_STORAGE_KEY, id);
    window.dispatchEvent(new Event(MISSAV_LOCALE_CHANGE_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}
