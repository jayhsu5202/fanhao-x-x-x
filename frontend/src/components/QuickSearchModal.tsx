import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickSearchModal({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();

  /* 開啟時聚焦輸入框，關閉時清空 */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQ("");
    }
  }, [open]);

  /* ESC 關閉 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* 點擊遮罩關閉 */
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    onClose();
    navigate(`/search?q=${encodeURIComponent(t)}`);
  }

  if (!open) return null;

  return (
    <div
      className="quick-search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogId}
      onClick={handleBackdropClick}
    >
      <div className="quick-search-box">
        <p id={dialogId} className="visually-hidden">快速搜尋</p>
        <form className="quick-search-form" onSubmit={onSubmit}>
          <span className="quick-search-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <line x1="12.5" y1="12.5" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="quick-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋番號、女優、關鍵字…"
            autoComplete="off"
            aria-label="快速搜尋"
            enterKeyHint="search"
          />
          <button type="submit" className="quick-search-submit">
            搜尋
          </button>
          <button
            type="button"
            className="quick-search-close"
            aria-label="關閉搜尋"
            onClick={onClose}
          >
            ✕
          </button>
        </form>
        <p className="quick-search-hint">按 ESC 或點擊外部關閉</p>
      </div>
    </div>
  );
}
