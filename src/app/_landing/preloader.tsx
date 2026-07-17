"use client";

import { useEffect, useState } from "react";

type PreloaderProps = {
  onDone: () => void;
};

/**
 * MindMarket-style stroke preloader: green path draws in, then reveals the page.
 * @see https://mindmarket.com/ — `.c-preloader` SVG stroke draw
 */
export function Preloader({ onDone }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setProgress(100);
      const t = window.setTimeout(() => {
        setLeaving(true);
        window.setTimeout(onDone, 200);
      }, 120);
      return () => window.clearTimeout(t);
    }

    const duration = 950;
    const started = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min((now - started) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setLeaving(true);
        window.setTimeout(onDone, 320);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const pathLength = 520;
  const dashOffset = pathLength - (progress / 100) * pathLength;

  return (
    <div
      aria-busy={!leaving}
      className={`limon-preloader fixed inset-0 z-[100] grid place-items-center bg-[var(--mm-cream)] text-[var(--mm-ink)] transition-[opacity,transform] duration-500 ease-out ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-8 px-6">
        <svg
          aria-hidden="true"
          className="h-24 w-28 sm:h-28 sm:w-32"
          fill="none"
          viewBox="0 0 120 100"
        >
          <path
            d="M22 62 C18 38 38 14 60 18 C82 14 102 38 98 62 C94 82 76 92 60 90 C44 92 26 82 22 62 Z"
            stroke="var(--mm-green)"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="7"
          />
          <path
            d="M60 22 C62 34 70 42 78 48"
            stroke="var(--mm-green)"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
        <p className="font-caprasimo text-2xl tracking-tight" translate="no">
          limon
        </p>
        <output className="font-mono text-sm font-bold tabular-nums text-[var(--mm-ink)]/55">
          {progress}%<span className="sr-only"> cargado</span>
        </output>
      </div>
    </div>
  );
}
