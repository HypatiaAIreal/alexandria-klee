"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LightboxImage {
  src: string;
  caption?: string;
}

const MIN = 1;
const MAX = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function Lightbox({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const moved = useRef(false);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // reset transform whenever a new image opens
  useEffect(() => {
    reset();
  }, [image, reset]);

  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setScale((s) => clamp(s * 1.3, MIN, MAX));
      else if (e.key === "-") setScale((s) => clamp(s / 1.3, MIN, MAX));
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [image, onClose, reset]);

  if (!image) return null;

  // Zoom toward the cursor so the point under it stays put.
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    setScale((s) => {
      const ns = clamp(s * factor, MIN, MAX);
      const ratio = ns / s;
      if (ns === MIN) {
        setTx(0);
        setTy(0);
      } else {
        setTx((t) => cx - (cx - t) * ratio);
        setTy((t) => cy - (cy - t) * ratio);
      }
      return ns;
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (scale > 1) reset();
    else zoomAt(e.clientX, e.clientY, 2.8);
  };

  // ── mouse pan ──
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
    moved.current = false;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    setTx(drag.current.tx + dx);
    setTy(drag.current.ty + dy);
  };
  const endMouse = () => {
    drag.current = null;
  };

  // ── touch: 1-finger pan, 2-finger pinch ──
  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinch.current = { dist: dist(e.touches), scale };
    } else if (e.touches.length === 1 && scale > 1) {
      drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (pinch.current && e.touches.length === 2) {
      const ns = clamp((dist(e.touches) / pinch.current.dist) * pinch.current.scale, MIN, MAX);
      setScale(ns);
      if (ns === MIN) {
        setTx(0);
        setTy(0);
      }
    } else if (drag.current && e.touches.length === 1) {
      setTx(drag.current.tx + (e.touches[0].clientX - drag.current.x));
      setTy(drag.current.ty + (e.touches[0].clientY - drag.current.y));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      pinch.current = null;
      drag.current = null;
    }
  };

  const btn =
    "grid h-9 w-9 place-items-center rounded-md border border-ink-700 bg-ink-850 text-parchment-200 hover:border-ochre/50 hover:text-ochre disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 backdrop-blur-sm"
      onClick={() => {
        if (!moved.current) onClose();
      }}
    >
      {/* toolbar */}
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={btn} onClick={() => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.3)} disabled={scale <= MIN} aria-label="Zoom out">−</button>
        <span className="min-w-[3rem] text-center font-mono text-xs text-parchment-300">
          {Math.round(scale * 100)}%
        </span>
        <button className={btn} onClick={() => zoomAt(innerWidth / 2, innerHeight / 2, 1.3)} disabled={scale >= MAX} aria-label="Zoom in">+</button>
        <button className={btn} onClick={reset} disabled={scale === 1} aria-label="Reset">⊙</button>
        <button className={btn} onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* image stage */}
      <div
        ref={frameRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endMouse}
        onMouseLeave={endMouse}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.caption ?? ""}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] max-w-[94vw] select-none rounded-md object-contain shadow-2xl ring-1 ring-ink-700"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: drag.current || pinch.current ? "none" : "transform 0.12s ease-out",
          }}
        />
      </div>

      <div className="pointer-events-none pb-4 text-center">
        {image.caption && (
          <p className="font-mono text-xs text-parchment-300">{image.caption}</p>
        )}
        <p className="mt-1 font-mono text-[0.62rem] text-parchment-400/60">
          scroll or pinch to zoom · drag to pan · double-click to toggle · esc to close
        </p>
      </div>
    </div>
  );
}
