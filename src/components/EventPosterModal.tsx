"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

export function EventPosterModal() {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="IMFC event registration poster"
    >
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        aria-label="Close event poster"
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-slate-950 text-white shadow-xl transition hover:scale-105 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 sm:right-6 sm:top-6"
      >
        <X className="h-7 w-7" strokeWidth={3} />
      </button>

      <img
        src="/poster-a3.png"
        alt="IMFC — I Am Freshman Consultant. Scan the QR code on the poster to register. Last date to register: 25 October 2026."
        width={1414}
        height={2000}
        className="h-auto max-h-[calc(100dvh-1.5rem)] w-auto max-w-full rounded-sm object-contain shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      />
    </div>
  );
}
