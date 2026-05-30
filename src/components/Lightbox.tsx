"use client";

import { useEffect } from "react";

export interface LightboxImage {
  src: string;
  caption?: string;
}

export default function Lightbox({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-parchment-200 hover:border-ochre/50 hover:text-ochre"
        onClick={onClose}
      >
        Close ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.caption ?? ""}
        className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl ring-1 ring-ink-700"
        onClick={(e) => e.stopPropagation()}
      />
      {image.caption && (
        <p className="mt-3 font-mono text-xs text-parchment-300">{image.caption}</p>
      )}
    </div>
  );
}
