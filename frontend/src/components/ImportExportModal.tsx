import { useEffect, useRef, useState } from "react";
import {
  downloadBackupFile,
  parseBackup,
  serializeBackup,
  type ImportResult,
  type MissavBackup,
} from "../lib/backup";

interface ImportExportModalProps {
  title: string;
  /** 呼叫方提供當前完整備份物件（含 favorites + watchHistory） */
  backup: MissavBackup;
  /** 呼叫方執行實際導入，收到解析後的 backup 物件 */
  onImport: (backup: MissavBackup) => Promise<ImportResult>;
  onClose: () => void;
}

type Tab = "export" | "import";

export default function ImportExportModal({
  title,
  backup,
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

  const exportText = serializeBackup(backup);

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

  function handleDownload() {
    downloadBackupFile(backup);
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setResult(null);
    setImportErr(null);
    try {
      const parsed = parseBackup(importText);
      const res = await onImport(parsed);
      setResult(res);
      setImportText("");
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "導入失敗");
    } finally {
      setImporting(false);
    }
  }

  /** 從本地 JSON 檔讀入 */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setImportText(text);
        setResult(null);
        setImportErr(null);
      }
    };
    reader.readAsText(file, "utf-8");
    // reset input so same file can be re-selected
    e.target.value = "";
  }

  const favCount = backup.favorites.length;
  const watchCount = backup.watchHistory.length;

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
            ↑ 導出
          </button>
          <button
            type="button"
            className={`ie-modal-tab${tab === "import" ? " ie-modal-tab--active" : ""}`}
            onClick={() => setTab("import")}
          >
            ↓ 導入
          </button>
        </div>

        {/* ── 導出 Tab ── */}
        {tab === "export" && (
          <>
            <div className="ie-modal-import-hint">
              備份包含：最愛 <strong>{favCount}</strong> 筆 ＋ 觀看記錄 <strong>{watchCount}</strong> 筆。
              可複製 JSON 文字，或點「下載備份檔」儲存為 <code className="inline-code">.json</code>。
            </div>
            <textarea
              ref={exportTextareaRef}
              className="export-modal-textarea"
              readOnly
              value={exportText}
              rows={12}
            />
            <div className="export-modal-actions">
              <button
                type="button"
                className="ie-modal-download-btn"
                onClick={handleDownload}
              >
                ⬇ 下載備份檔
              </button>
              <button
                type="button"
                className="export-modal-copy-btn"
                onClick={() => void handleCopy()}
              >
                {copied ? "✓ 已複製" : "複製 JSON"}
              </button>
            </div>
          </>
        )}

        {/* ── 導入 Tab ── */}
        {tab === "import" && (
          <>
            <div className="ie-modal-import-hint">
              貼上或載入備份 JSON，然後按「確認導入」。
              已存在的記錄不會重複寫入（slug 相同則略過）。
            </div>
            <div className="ie-modal-file-row">
              <label className="ie-modal-file-label">
                📂 選擇備份檔
                <input
                  type="file"
                  accept=".json,application/json"
                  className="ie-modal-file-input"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
            <textarea
              className="export-modal-textarea ie-modal-import-textarea"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setResult(null);
                setImportErr(null);
              }}
              placeholder={'貼上備份 JSON…\n{\n  "v": 1,\n  "favorites": [...],\n  "watchHistory": [...]\n}'}
              rows={12}
              disabled={importing}
            />
            {result && (
              <div className="ie-modal-result ie-modal-result--ok">
                ✓ 最愛：成功 {result.favorites.success} 筆
                {result.favorites.skipped > 0 && `，略過 ${result.favorites.skipped} 筆`}
                {result.favorites.failed > 0 && `，失敗 ${result.favorites.failed} 筆`}
                ；觀看記錄：成功 {result.watchHistory.success} 筆
                {result.watchHistory.skipped > 0 && `，略過 ${result.watchHistory.skipped} 筆`}
                {result.watchHistory.failed > 0 && `，失敗 ${result.watchHistory.failed} 筆`}
              </div>
            )}
            {importErr && (
              <div className="ie-modal-result ie-modal-result--err">✕ {importErr}</div>
            )}
            <div className="export-modal-actions">
              <span className="export-modal-hint">
                {importText.trim() ? "JSON 已就緒" : "尚未輸入備份內容"}
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

export type { ImportResult };
