import { useEffect, useRef, useState } from "react";

export type ImportResult = {
  success: number;
  failed: number;
  skipped: number;
};

interface ImportExportModalProps {
  title: string;
  exportText: string;               // 導出內容
  onImport: (raw: string) => Promise<ImportResult>; // 呼叫者負責實際導入
  onClose: () => void;
}

type Tab = "export" | "import";

export default function ImportExportModal({
  title,
  exportText,
  onImport,
  onClose,
}: ImportExportModalProps) {
  const [tab, setTab] = useState<Tab>("export");
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const exportTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ESC 關閉
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 切到導出 tab 時自動全選
  useEffect(() => {
    if (tab === "export") {
      setTimeout(() => exportTextareaRef.current?.select(), 50);
    }
  }, [tab]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      exportTextareaRef.current?.select();
    }
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setResult(null);
    setImportErr(null);
    try {
      const res = await onImport(importText);
      setResult(res);
      setImportText("");
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "導入失敗");
    } finally {
      setImporting(false);
    }
  }

  const exportCount = exportText.split("\n").filter(Boolean).length;

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
        {/* 頂部：標題 + 關閉 */}
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

        {/* Tab 切換 */}
        <div className="ie-modal-tabs">
          <button
            type="button"
            className={`ie-modal-tab${tab === "export" ? " ie-modal-tab--active" : ""}`}
            onClick={() => setTab("export")}
          >
            導出
          </button>
          <button
            type="button"
            className={`ie-modal-tab${tab === "import" ? " ie-modal-tab--active" : ""}`}
            onClick={() => setTab("import")}
          >
            導入
          </button>
        </div>

        {/* 導出 Tab */}
        {tab === "export" && (
          <>
            <textarea
              ref={exportTextareaRef}
              className="export-modal-textarea"
              readOnly
              value={exportText}
              rows={12}
            />
            <div className="export-modal-actions">
              <span className="export-modal-hint">共 {exportCount} 筆</span>
              <button
                type="button"
                className="export-modal-copy-btn"
                onClick={() => void handleCopy()}
              >
                {copied ? "✓ 已複製" : "複製全部"}
              </button>
            </div>
          </>
        )}

        {/* 導入 Tab */}
        {tab === "import" && (
          <>
            <div className="ie-modal-import-hint">
              每行格式：<code className="inline-code">slug</code> 或{" "}
              <code className="inline-code">slug[Tab]標題</code>，貼上後按「確認導入」。
            </div>
            <textarea
              className="export-modal-textarea ie-modal-import-textarea"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setResult(null);
                setImportErr(null);
              }}
              placeholder="貼上要導入的記錄，每行一筆…"
              rows={12}
              disabled={importing}
            />
            {result && (
              <div className="ie-modal-result ie-modal-result--ok">
                ✓ 成功導入 {result.success} 筆
                {result.skipped > 0 && `，略過 ${result.skipped} 筆（已存在）`}
                {result.failed > 0 && `，失敗 ${result.failed} 筆`}
              </div>
            )}
            {importErr && (
              <div className="ie-modal-result ie-modal-result--err">✕ {importErr}</div>
            )}
            <div className="export-modal-actions">
              <span className="export-modal-hint">
                {importText.split("\n").filter(Boolean).length} 行待導入
              </span>
              <button
                type="button"
                className="export-modal-copy-btn"
                onClick={() => void handleImport()}
                disabled={importing || !importText.trim()}
              >
                {importing ? "導入中…" : "確認導入"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
