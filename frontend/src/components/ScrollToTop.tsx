import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** 換頁或同 path 不同 query（如 /search?q=）時捲回頂端，避免詳情／搜尋仍停在上一頁捲動位置 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}
