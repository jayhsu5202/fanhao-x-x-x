import { useEffect, useRef, useState } from "react";

interface ExportModalProps {
  title: string;
  text: string;
  onClose: () => void;
}

export default function ExportModal({ title, text, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ESC 關閉
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 自動全選
  useEffect(() => {
    textareaRef.current?.select();
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: 選取文字
      textareaRef.current?.select();
    }
  }

  return (
    <div
      className="export-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="export-modal-panel">
        <div className="export-modal-header">
          <span className="export-modal-title">{title}</span>
          <button
            type="button"
            className="export-modal-close"
            onClick={onClose}
            aria-label="關閉"
          >
            ✕
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="export-modal-textarea"
          readOnly
          value={text}
          rows={12}
        />
        <div className="export-modal-actions">
          <span className="export-modal-hint">
            共 {text.split("\n").filter(Boolean).length} 筆
          </span>
          <button
            type="button"
            className="export-modal-copy-btn"
            onClick={() => void handleCopy()}
          >
            {copied ? "✓ 已複製" : "複製全部"}
          </button>
        </div>
      </div>
    </div>
  );
}
