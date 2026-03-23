import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiPost } from "../api/client";

type Props = {
  slug: string;
  title?: string;
  /** 若已知狀態可省去初次閃爍；仍會在點擊時與後端同步 */
  initialFavorited?: boolean;
  className?: string;
  onAfterChange?: (favorited: boolean) => void;
};

export default function FavoriteHeart({
  slug,
  title,
  initialFavorited = false,
  className = "",
  onAfterChange,
}: Props) {
  const [on, setOn] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOn(initialFavorited);
  }, [initialFavorited]);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      try {
        if (on) {
          await apiDelete<{ ok: boolean }>(`/api/favorites/${encodeURIComponent(slug)}`);
          setOn(false);
          onAfterChange?.(false);
        } else {
          await apiPost<{ ok: boolean }>("/api/favorites", {
            slug,
            ...(title ? { title } : {}),
          });
          setOn(true);
          onAfterChange?.(true);
        }
      } catch {
        /* 略過；使用者可再試 */
      } finally {
        setBusy(false);
      }
    },
    [busy, on, onAfterChange, slug, title]
  );

  return (
    <button
      type="button"
      className={`favorite-heart${on ? " favorite-heart--on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={on}
      aria-label={on ? "從最愛移除" : "加入最愛"}
      disabled={busy}
      onClick={toggle}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s-6.716-4.35-9.5-8.5C.5 9.5 1.84 5 6.5 5c2.2 0 3.99 1.35 5.5 3.36C13.51 6.35 15.3 5 17.5 5 22.16 5 23.5 9.5 21.5 12.5 18.716 16.65 12 21 12 21Z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill={on ? "currentColor" : "none"}
          fillOpacity={on ? 0.92 : 0}
        />
      </svg>
    </button>
  );
}
