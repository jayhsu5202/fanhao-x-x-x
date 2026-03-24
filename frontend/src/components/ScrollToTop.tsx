import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * 換頁時的捲動位置管理：
 * - Push 新頁（首次進入）→ 捲回頂端
 * - Pop 返回（瀏覽器上一頁）→ 從 sessionStorage 恢復上次捲動位置
 *
 * 使用 React Router v6 的 location.key 作為每個歷史條目的唯一識別符。
 */
export default function ScrollToTop() {
  const { key } = useLocation();

  useEffect(() => {
    const storageKey = `scroll_pos_${key}`;
    const saved = sessionStorage.getItem(storageKey);

    if (saved !== null) {
      // 返回此歷史條目：恢復位置
      const y = parseInt(saved, 10);
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      // 首次 push 進入：捲回頂端
      window.scrollTo(0, 0);
    }

    // effect 清理時（即將離開此頁）記錄目前位置
    return () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };
  }, [key]);

  return null;
}
