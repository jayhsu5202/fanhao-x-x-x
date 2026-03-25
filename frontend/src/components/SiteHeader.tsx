import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV_MENU } from "../constants/navCategories";
import LanguageSwitcher from "./LanguageSwitcher";
import QuickSearchModal from "./QuickSearchModal";

type Tone = "default" | "detail";

function navLinkClass(isActive: boolean): string {
  return `site-nav-link${isActive ? " is-active" : ""}`;
}

export default function SiteHeader({ tone = "default" }: { tone?: Tone }) {
  const [open, setOpen] = useState(false);
  const [desktopOpenKey, setDesktopOpenKey] = useState<string | null>(null);
  const [mobileExpandedKey, setMobileExpandedKey] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const menuId = useId();
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* unmount 時清除懸掛的 timer，避免 state 更新在已卸載元件上執行 */
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    setDesktopOpenKey(null);
    setMobileExpandedKey(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!desktopOpenKey) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(".nav-mega-wrap")) {
        setDesktopOpenKey(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [desktopOpenKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* 桌面版：滑鼠 / 鍵盤焦點統一由 JS 管理，避免 :focus-within 與 is-open 重疊 */
  const handleMegaEnter = (key: string) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = null;
    setDesktopOpenKey(key);
  };
  const handleMegaLeave = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setDesktopOpenKey(null), 150);
  };
  /* 鍵盤：焦點進入時開啟，離開整個 wrap 時關閉（取代 CSS :focus-within） */
  const handleMegaFocusIn = (key: string) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = null;
    setDesktopOpenKey(key);
  };
  const handleMegaFocusOut = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setDesktopOpenKey(null), 150);
  };

  const shellClass = `site-header ${tone === "detail" ? "site-header--detail" : ""}`;

  return (
    <>
    <header className={shellClass}>
      <div className="site-header-bar">
        <Link className={`brand ${tone === "detail" ? "brand-sm" : ""}`} to="/">
          My日系影片
        </Link>

        <nav className="site-nav-desktop" aria-label="影片分類">
          <NavLink end className={({ isActive }) => navLinkClass(isActive)} to="/">
            首頁
          </NavLink>
          <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/favorites">
            最愛
          </NavLink>
          <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/watch-history">
            觀看記錄
          </NavLink>
          {NAV_MENU.map((m, index) => (
            <div
              key={m.key}
              className={`nav-mega-wrap${desktopOpenKey === m.key ? " is-open" : ""}${
                index >= NAV_MENU.length - 2 ? " nav-mega-wrap--align-end" : ""
              }`}
              onMouseEnter={() => handleMegaEnter(m.key)}
              onMouseLeave={handleMegaLeave}
              onFocusCapture={() => handleMegaFocusIn(m.key)}
              onBlurCapture={handleMegaFocusOut}
            >
              <NavLink className={({ isActive }) => navLinkClass(isActive)} to={m.to}>
                {m.label}
              </NavLink>
              <div className="nav-mega-panel" role="region" aria-label={`${m.label} 子選單`}>
                <Link className="nav-mega-all" to={m.to}>
                  瀏覽「{m.label}」全部
                </Link>
                <div className="nav-mega-links">
                  {m.children.map((ch) => (
                    <Link key={`${m.key}-${ch.label}`} to={ch.to} title={ch.description}>
                      {ch.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>

        <div className="site-header-actions">
          <button
            type="button"
            className="quick-search-trigger-btn"
            aria-label="快速搜尋"
            onClick={() => setSearchOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <line x1="12.5" y1="12.5" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <LanguageSwitcher compact />
          <button
            type="button"
            className="site-nav-toggle"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="site-nav-toggle-bars" aria-hidden />
            <span className="visually-hidden">{open ? "關閉選單" : "開啟選單"}</span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="site-nav-panel" id={menuId} role="dialog" aria-label="導覽與分類">
          <div className="site-nav-panel-inner">
            <NavLink
              end
              className={({ isActive }) => `site-nav-panel-link${isActive ? " is-active" : ""}`}
              to="/"
              onClick={() => setOpen(false)}
            >
              首頁／搜尋
            </NavLink>
            <NavLink
              className={({ isActive }) => `site-nav-panel-link${isActive ? " is-active" : ""}`}
              to="/favorites"
              onClick={() => setOpen(false)}
            >
              我的最愛
            </NavLink>
            <NavLink
              className={({ isActive }) => `site-nav-panel-link${isActive ? " is-active" : ""}`}
              to="/watch-history"
              onClick={() => setOpen(false)}
            >
              觀看記錄
            </NavLink>

            <p className="site-nav-mobile-divider-label">影片分類</p>
            {NAV_MENU.map((m) => (
              <div key={m.key} className="site-nav-mobile-section" role="group" aria-label={m.label}>
                <button
                  type="button"
                  className={`site-nav-mobile-section-title site-nav-mobile-section-toggle${mobileExpandedKey === m.key ? " is-expanded" : ""}`}
                  onClick={() => setMobileExpandedKey((prev) => (prev === m.key ? null : m.key))}
                  aria-expanded={mobileExpandedKey === m.key}
                >
                  <span>{m.label}</span>
                  <span className="site-nav-mobile-chevron" aria-hidden>&#8250;</span>
                </button>
                {mobileExpandedKey === m.key ? (
                  <>
                    <Link
                      className="site-nav-panel-sublink site-nav-panel-sublink-strong"
                      to={m.to}
                      onClick={() => setOpen(false)}
                    >
                      瀏覽「{m.label}」全部
                    </Link>
                    {m.children.map((ch) => (
                      <Link
                        key={`${m.key}-${ch.label}`}
                        className="site-nav-panel-sublink"
                        to={ch.to}
                        title={ch.description}
                        onClick={() => setOpen(false)}
                      >
                        {ch.label}
                      </Link>
                    ))}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </header>
    <QuickSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
  </>
  );
}
