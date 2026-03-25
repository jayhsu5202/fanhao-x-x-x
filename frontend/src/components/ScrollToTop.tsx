import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * 換頁時的捲動位置管理：
 * - Push 新頁（首次進入）→ 捲回頂端
 * - Pop 返回（瀏覽器上一頁）→ 從 localStorage 恢復上次捲動位置
 *
 * 使用 pathname + search 作為穩定 key，確保：
 * - PWA standalone 視窗重開後仍能恢復捲動位置
 * - iOS「加到主畫面」打開後仍能恢復捲動位置
 * （不使用 React Router location.key，因為它每次開新視窗都不同）
 */
export default function ScrollToTop() {
  const { pathname, search, key } = useLocation();
  const stableKey = `scroll_pos_${pathname}${search}`;

  useEffect(() => {
    const saved = localStorage.getItem(stableKey);

    if (saved !== null) {
      // 路由相同：恢復上次捲動位置（返回時）
      const y = parseInt(saved, 10);
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      // 首次進入此路由：捲回頂端
      window.scrollTo(0, 0);
    }

    // effect 清理時（即將離開此頁）記錄目前位置
    return () => {
      localStorage.setItem(stableKey, String(window.scrollY));
    };
  // key 確保同路由 push 新條目時也捲回頂端
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stableKey]);

  return null;
}
