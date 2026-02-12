import { useCallback, useRef, useState } from "react";

/** スワイプ方向: 1 = 左スワイプ(次タブ), -1 = 右スワイプ(前タブ) */
export type SwipeDirection = 1 | -1;

interface SwipeState {
  startX: number;
  startY: number;
  /** 横スワイプとして確定したか */
  locked: boolean;
  /** 縦スクロールと判定されキャンセルされたか */
  cancelled: boolean;
}

const SWIPE_THRESHOLD = 50;
/** 横/縦の移動量比がこの値以上で横スワイプと判定 */
const DIRECTION_RATIO = 1.2;

export function useSwipeTab<T extends string>({
  tabs,
  currentTab,
  onChangeTab,
  disabled,
}: {
  tabs: readonly T[];
  currentTab: T;
  onChangeTab: (tab: T) => void;
  /** スワイプ無効化（memo編集中など） */
  disabled?: boolean;
}) {
  const state = useRef<SwipeState | null>(null);
  const [direction, setDirection] = useState<SwipeDirection>(1);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // マルチタッチ(ピンチ等)は無視
      if (e.pointerType === "touch" && !e.isPrimary) return;

      state.current = {
        startX: e.clientX,
        startY: e.clientY,
        locked: false,
        cancelled: false,
      };
    },
    [disabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    if (!s || s.cancelled) return;

    if (!s.locked) {
      const dx = Math.abs(e.clientX - s.startX);
      const dy = Math.abs(e.clientY - s.startY);
      // ある程度動いてから方向を判定
      if (dx > 10 || dy > 10) {
        if (dx > dy * DIRECTION_RATIO) {
          s.locked = true;
        } else {
          // 縦方向 → スワイプキャンセル
          s.cancelled = true;
        }
      }
    }
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = state.current;
      state.current = null;
      if (!s || s.cancelled || disabled) return;

      const dx = e.clientX - s.startX;
      const dy = Math.abs(e.clientY - s.startY);

      // 横移動が閾値以上 & 縦より横が大きい
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) < dy * DIRECTION_RATIO) return;

      const idx = tabs.indexOf(currentTab);
      if (idx === -1) return;

      if (dx < 0 && idx < tabs.length - 1) {
        // 左スワイプ → 次のタブ
        setDirection(1);
        onChangeTab(tabs[idx + 1]);
      } else if (dx > 0 && idx > 0) {
        // 右スワイプ → 前のタブ
        setDirection(-1);
        onChangeTab(tabs[idx - 1]);
      }
    },
    [tabs, currentTab, onChangeTab, disabled],
  );

  const onPointerCancel = useCallback(() => {
    state.current = null;
  }, []);

  return {
    /** スライドアニメーション用の方向 */
    direction,
    /** タブボタン押下時にアニメーション方向をセットする */
    setDirection,
    /** コンテンツ領域に付与するイベントハンドラ */
    swipeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style: { touchAction: "pan-y" } as React.CSSProperties,
    },
  };
}
