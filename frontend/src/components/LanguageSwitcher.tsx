import { useEffect, useId, useRef, useState } from "react";
import { UI_LOCALES } from "../constants/missavLocales";
import { useMissavLocale } from "../context/MissavLocaleContext";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useMissavLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = UI_LOCALES.find((l) => l.id === locale) ?? UI_LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="lang-switch" ref={rootRef}>
      <button
        type="button"
        className="lang-switch-trigger"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="介面語系與影片頁來源語言"
        title="決定 MissAV 影片頁／縮圖／詳情與下載的語系。列表卡片標題多來自推薦引擎，未必隨語系改變。"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-switch-flag" aria-hidden>
          {current.flag}
        </span>
        {!compact ? <span className="lang-switch-label">{current.label}</span> : null}
        <span className="lang-switch-chevron" aria-hidden />
      </button>
      {open ? (
        <ul className="lang-switch-list" id={listId} role="listbox">
          {UI_LOCALES.map((opt) => (
            <li key={opt.id} role="option" aria-selected={opt.id === locale}>
              <button
                type="button"
                className={`lang-switch-item${opt.id === locale ? " is-active" : ""}`}
                onClick={() => {
                  setLocale(opt.id);
                  setOpen(false);
                }}
              >
                <span aria-hidden>{opt.flag}</span>
                <span>{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
