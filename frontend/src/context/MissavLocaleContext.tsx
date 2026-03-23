import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getStoredMissavLocale,
  MISSAV_LOCALE_CHANGE_EVENT,
  MISSAV_LOCALE_STORAGE_KEY,
  setStoredMissavLocale,
} from "../lib/missavLocaleStorage";

/** @deprecated 請用 getStoredMissavLocale（與 api/client 一致） */
export function getMissavLocale(): string {
  return getStoredMissavLocale();
}

/** @deprecated 請用 setStoredMissavLocale */
export function setMissavLocale(id: string): void {
  setStoredMissavLocale(id);
}

type Ctx = {
  locale: string;
  setLocale: (id: string) => void;
};

const MissavLocaleContext = createContext<Ctx | null>(null);

const HTML_LANG: Record<string, string> = {
  "zh-Hant": "zh-Hant",
  "zh-Hans": "zh-Hans",
  en: "en",
  ja: "ja",
  ko: "ko",
};

export function MissavLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(() => getStoredMissavLocale());

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale] ?? locale;
  }, [locale]);

  useEffect(() => {
    const on = () => setLocaleState(getStoredMissavLocale());
    window.addEventListener(MISSAV_LOCALE_CHANGE_EVENT, on);
    const onStorage = (e: StorageEvent) => {
      if (e.key === MISSAV_LOCALE_STORAGE_KEY) setLocaleState(getStoredMissavLocale());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MISSAV_LOCALE_CHANGE_EVENT, on);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLocale = useCallback((id: string) => {
    setStoredMissavLocale(id);
    setLocaleState(id);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <MissavLocaleContext.Provider value={value}>{children}</MissavLocaleContext.Provider>;
}

export function useMissavLocale(): Ctx {
  const v = useContext(MissavLocaleContext);
  if (!v) throw new Error("useMissavLocale must be used within MissavLocaleProvider");
  return v;
}
