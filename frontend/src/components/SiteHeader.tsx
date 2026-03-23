import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV_MENU } from "../constants/navCategories";
import LanguageSwitcher from "./LanguageSwitcher";

type Tone = "default" | "detail";

function navLinkClass(isActive: boolean): string {
  return `site-nav-link${isActive ? " is-active" : ""}`;
}

export default function SiteHeader({ tone = "default" }: { tone?: Tone }) {
  const [open, setOpen] = useState(false);
  /** 手機選單內分類區塊展開（對齊 missav：點主項切換子選單，非整頁跳轉） */
  const [mobileOpenKey, setMobileOpenKey] = useState<string | null>(null);
  const location = useLocation();
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
    setMobileOpenKey(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) setMobileOpenKey(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shellClass = `site-header ${tone === "detail" ? "site-header--detail" : ""}`;

  return (
    <header className={shellClass}>
      <div className="site-header-bar">
        <Link className={`brand ${tone === "detail" ? "brand-sm" : ""}`} to="/">
          MissAV 瀏覽
        </Link>

        <nav className="site-nav-desktop" aria-label="影片分類">
          <NavLink end className={({ isActive }) => navLinkClass(isActive)} to="/">
            首頁
          </NavLink>
          <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/favorites">
            最愛
          </NavLink>
          {NAV_MENU.map((m) => (
            <div key={m.key} className="nav-mega-wrap">
              <NavLink className={({ isActive }) => navLinkClass(isActive)} to={m.to}>
                {m.label}
              </NavLink>
              <div className="nav-mega-panel" role="region" aria-label={`${m.label} 子選單`}>
                <Link className="nav-mega-all" to={m.to}>
                  瀏覽「{m.label}」全部
                </Link>
                <div className="nav-mega-links">
                  {m.children.map((ch) => (
                    <Link key={`${m.key}-${ch.label}`} to={ch.to}>
                      {ch.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>

        <div className="site-header-actions">
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
            <div className="site-nav-panel-lang">
              <span className="site-nav-panel-lang-label">語系（影片頁來源）</span>
              <LanguageSwitcher />
            </div>
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
            {NAV_MENU.map((m) => {
              const expanded = mobileOpenKey === m.key;
              return (
                <div key={m.key} className={`site-nav-mobile-group${expanded ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="site-nav-mobile-group-head"
                    aria-expanded={expanded}
                    onClick={() => setMobileOpenKey((k) => (k === m.key ? null : m.key))}
                  >
                    <span>{m.label}</span>
                    <span className="site-nav-mobile-chevron" aria-hidden />
                  </button>
                  {expanded ? (
                    <div className="site-nav-mobile-group-body">
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
                          onClick={() => setOpen(false)}
                        >
                          {ch.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
