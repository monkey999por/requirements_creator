import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const ZOOM_SENSITIVITY = 0.005;
const DOUBLE_TAP_THRESHOLD = 300;

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

export function useZoomPan(options?: { alwaysPannable?: boolean }) {
  const alwaysPannable = options?.alwaysPannable ?? false;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>({ scale: 1, translateX: 0, translateY: 0 });
  const rafIdRef = useRef<number>(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Pointer tracking for drag/pan
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // Pinch tracking
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef(0);
  const lastPinchCenter = useRef({ x: 0, y: 0 });

  // Double-tap detection
  const lastTapTime = useRef(0);

  const applyTransform = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      const { scale, translateX, translateY } = transformRef.current;
      el.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    });
  }, []);

  const clampTranslation = useCallback(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const t = transformRef.current;
    const wRect = wrapper.getBoundingClientRect();
    const contentWidth = content.scrollWidth * t.scale;
    const contentHeight = content.scrollHeight * t.scale;

    // Allow panning but keep at least 50px of content visible
    const margin = 50;
    const minX = wRect.width - contentWidth - margin;
    const maxX = margin;
    const minY = wRect.height - contentHeight - margin;
    const maxY = margin;

    if (contentWidth > wRect.width) {
      t.translateX = Math.min(maxX, Math.max(minX, t.translateX));
    } else {
      t.translateX = Math.min(maxX, Math.max(minX, t.translateX));
    }
    if (contentHeight > wRect.height) {
      t.translateY = Math.min(maxY, Math.max(minY, t.translateY));
    } else {
      t.translateY = Math.min(maxY, Math.max(minY, t.translateY));
    }
  }, []);

  const reset = useCallback(() => {
    transformRef.current = { scale: 1, translateX: 0, translateY: 0 };
    setIsZoomed(false);
    applyTransform();
  }, [applyTransform]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, delta: number) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const t = transformRef.current;
      const rect = wrapper.getBoundingClientRect();

      // Cursor position relative to wrapper
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      // Point in content space before zoom
      const beforeX = (cx - t.translateX) / t.scale;
      const beforeY = (cy - t.translateY) / t.scale;

      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (1 - delta)));
      t.scale = newScale;

      // Adjust translation so the point under cursor stays in place
      t.translateX = cx - beforeX * newScale;
      t.translateY = cy - beforeY * newScale;

      clampTranslation();
      setIsZoomed(newScale > 1.01);
      applyTransform();
    },
    [applyTransform, clampTranslation],
  );

  // Wheel event (registered imperatively for { passive: false })
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      const t = transformRef.current;
      const zoomed = t.scale > 1.01;

      // Ctrl/Cmd + wheel (or trackpad pinch) → zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY * ZOOM_SENSITIVITY;
        zoomAt(e.clientX, e.clientY, delta);
        return;
      }

      // Zoomed in (or alwaysPannable) + two-finger scroll → pan
      if (zoomed || alwaysPannable) {
        e.preventDefault();
        t.translateX -= e.deltaX;
        t.translateY -= e.deltaY;
        clampTranslation();
        applyTransform();
        return;
      }
      // Otherwise, let the event propagate for normal page scroll
    };

    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheel);
  }, [zoomAt, clampTranslation, applyTransform]);

  // Pointer handlers for drag-pan and pinch-zoom
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    wrapper.setPointerCapture(e.pointerId);

    if (pointers.current.size === 1) {
      const t = transformRef.current;
      if (t.scale > 1.01 || alwaysPannable) {
        isDragging.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
      }
    } else if (pointers.current.size === 2) {
      isDragging.current = false;
      const pts = [...pointers.current.values()];
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      lastPinchDist.current = Math.hypot(dx, dy);
      lastPinchCenter.current = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2) {
        // Pinch zoom
        const pts = [...pointers.current.values()];
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const dist = Math.hypot(dx, dy);
        const center = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };

        if (lastPinchDist.current > 0) {
          const ratio = dist / lastPinchDist.current;
          const delta = -(ratio - 1);
          zoomAt(center.x, center.y, delta);
        }

        lastPinchDist.current = dist;
        lastPinchCenter.current = center;
      } else if (isDragging.current && pointers.current.size === 1) {
        // Drag pan
        const t = transformRef.current;
        const deltaX = e.clientX - lastPointer.current.x;
        const deltaY = e.clientY - lastPointer.current.y;
        t.translateX += deltaX;
        t.translateY += deltaY;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        clampTranslation();
        applyTransform();
      }
    },
    [zoomAt, clampTranslation, applyTransform],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      lastPinchDist.current = 0;
    }
    if (pointers.current.size === 0) {
      isDragging.current = false;
    }
  }, []);

  const onDoubleClick = useCallback(() => {
    const t = transformRef.current;
    if (t.scale > 1.01) {
      reset();
    }
  }, [reset]);

  // Double-tap detection for mobile
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) return;
      const now = Date.now();
      if (now - lastTapTime.current < DOUBLE_TAP_THRESHOLD) {
        const t = transformRef.current;
        if (t.scale > 1.01) {
          reset();
        }
        lastTapTime.current = 0;
      } else {
        lastTapTime.current = now;
      }
    },
    [reset],
  );

  return {
    wrapperRef: wrapperRef as RefObject<HTMLDivElement | null>,
    contentRef: contentRef as RefObject<HTMLDivElement | null>,
    isZoomed,
    isPannable: isZoomed || alwaysPannable,
    reset,
    wrapperProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      onTouchEnd,
    },
  };
}
