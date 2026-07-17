"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Preloader } from "./preloader";
import { SceneCanvas } from "./scene-canvas";
import { ScrollPath } from "./scroll-path";

const SAMPLE_MAPS_URL =
  "https://www.google.com/maps/place/Cevicheria+%22Las+Palmeras%22/@-6.0546499,-77.2167419,13z/data=!4m6!3m5!1s0x91b7279870584b0f:0x44e376e36c0739b3!8m2!3d-6.050179!4d-77.1720976!16s%2Fg%2F11b5qh5cn0";

type LandingExperienceProps = {
  action: (formData: FormData) => void;
  error?: string;
  defaultMaps?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      className="limon-btn limon-press limon-tap group inline-flex min-h-13 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--mm-maps-red)] px-7 text-base font-bold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#d33a2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-80"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
          />
          Armando tu web…
        </>
      ) : (
        <>
          Arma mi web
          <span
            aria-hidden="true"
            className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
          >
            →
          </span>
        </>
      )}
    </button>
  );
}

export function LandingExperience({
  action,
  error,
  defaultMaps,
}: LandingExperienceProps) {
  const [booted, setBooted] = useState(false);
  const scrollProgress = useRef(0);
  const heroRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const finishPreload = useCallback(() => setBooted(true), []);

  // Hero exit progress (0 → hero fully on screen, 1 → scrolled past) drives a
  // subtle parallax in the 3D strip. No layout mutation — transform only.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const hero = heroRef.current;
        if (!hero) return;
        const range = Math.max(hero.offsetHeight, 1);
        scrollProgress.current = Math.min(
          Math.max(window.scrollY / range, 0),
          1,
        );
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const focusForm = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    input.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
    input.focus({ preventScroll: true });
  }, []);

  return (
    <main className="limon-landing limon-mm relative min-h-screen">
      {!booted ? <Preloader onDone={finishPreload} /> : null}

      <div
        className={`relative transition-opacity duration-500 ease-out ${
          booted ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Floating pill nav — compact, hugs its content (MindMarket) */}
        <header className="fixed inset-x-0 top-0 z-50">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
            <div className="flex h-13 items-center gap-3 rounded-full bg-[var(--mm-white)] py-1.5 pl-2 pr-5 shadow-[0_8px_30px_rgba(44,46,42,0.10)] sm:h-15">
              <a
                className="limon-tap flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2"
                href="#hero"
                translate="no"
              >
                <span className="grid size-9 place-items-center rounded-full bg-[var(--mm-green-deep)] font-caprasimo text-lg leading-none text-[var(--mm-ink)] sm:size-10">
                  L
                </span>
                <span className="font-caprasimo text-xl leading-none text-[var(--mm-ink)] sm:text-2xl">
                  limon
                </span>
              </a>
              <span
                aria-hidden="true"
                className="hidden h-6 w-px bg-[var(--mm-ink)]/12 md:block"
              />
              <span className="hidden text-sm font-semibold text-[var(--mm-ink)]/60 md:inline">
                Webs para restaurantes
              </span>
            </div>
            <button
              className="limon-btn limon-press limon-tap group inline-flex h-13 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--mm-white)] px-6 text-sm font-bold text-[var(--mm-ink)] shadow-[0_8px_30px_rgba(44,46,42,0.10)] transition-[transform,background-color] duration-150 ease-out hover:bg-[#f7f4ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 sm:h-15 sm:px-7 sm:text-base"
              onClick={focusForm}
              type="button"
            >
              Arma mi web
              <span
                aria-hidden="true"
                className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              >
                →
              </span>
            </button>
          </nav>
        </header>

        {/* Hero — one calm composition: copy block + 3D strip, no scroll traps */}
        <section
          className="relative flex min-h-svh flex-col overflow-hidden bg-[var(--mm-green-deep)]"
          id="hero"
          ref={heroRef}
        >
          <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-4xl flex-col items-center justify-center px-5 pb-[max(28svh,205px)] pt-24 text-center sm:px-8 sm:pt-28">
            <h1 className="limon-enter font-caprasimo text-[clamp(3.25rem,8.5vw,7.25rem)] leading-[0.98] tracking-[-0.01em] text-[var(--mm-ink)] text-balance">
              Ya estás en el mapa
            </h1>
            <p
              className="limon-enter mt-4 text-xl font-semibold text-[var(--mm-ink)]/75 sm:text-2xl"
              style={{ "--limon-delay": "70ms" } as React.CSSProperties}
            >
              Ahora ponte online.
            </p>

            <form
              action={action}
              className="limon-enter relative mt-8 w-full max-w-xl rounded-[2rem] bg-[var(--mm-white)] p-2 shadow-[0_14px_40px_rgba(44,46,42,0.14)]"
              id="hero-form"
              style={{ "--limon-delay": "140ms" } as React.CSSProperties}
            >
              <label className="sr-only" htmlFor="maps-url">
                Link de Google Maps de tu restaurante
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  autoComplete="url"
                  className="min-h-13 min-w-0 flex-1 rounded-full border border-transparent bg-transparent px-5 text-left text-base text-[var(--mm-ink)] outline-none placeholder:text-[var(--mm-ink)]/40 focus-visible:border-[var(--mm-ink)]/15 focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)]/20"
                  defaultValue={defaultMaps ?? ""}
                  id="maps-url"
                  inputMode="url"
                  name="mapsUrl"
                  placeholder="Pega el link de Google Maps…"
                  ref={inputRef}
                  required
                  spellCheck={false}
                  type="url"
                />
                <SubmitButton />
              </div>
              {error ? (
                <p
                  aria-live="polite"
                  className="px-5 pb-2 pt-2.5 text-left text-sm font-semibold text-[var(--danger)]"
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                >
                  {error}
                </p>
              ) : null}
            </form>

            <a
              className="limon-enter limon-tap mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-full text-sm font-bold text-[var(--mm-ink)]/70 underline decoration-[var(--mm-ink)]/30 underline-offset-4 transition-colors duration-150 hover:text-[var(--mm-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mm-green-deep)]"
              href={`/?maps=${encodeURIComponent(SAMPLE_MAPS_URL)}#hero-form`}
              style={{ "--limon-delay": "200ms" } as React.CSSProperties}
            >
              ¿Sin link a la mano? Prueba con Las Palmeras
            </a>
          </div>

          {/* 3D strip — pinned to the hero floor; z-40 so the restaurant
              stands ON the cream section that slides over the hero (z-30) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-[42svh] min-h-[270px] w-full"
          >
            {booted ? <SceneCanvas scrollProgress={scrollProgress} /> : null}
          </div>
        </section>

        <ScrollPath />

        {/* Green CTA slides up over the cream timeline — connected, no seam */}
        <section className="relative z-40 -mt-10 overflow-hidden rounded-t-[2.25rem] bg-[var(--mm-green-deep)] px-5 pb-20 pt-24 text-center text-[var(--mm-ink)] sm:-mt-16 sm:rounded-t-[3.5rem] sm:px-8 sm:pb-24 sm:pt-28 lg:rounded-t-[4.5rem] lg:px-12">
          <h2 className="mx-auto max-w-3xl font-caprasimo text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[1.02] tracking-tight text-balance">
            ¿Listo cuando tú lo estés?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[var(--mm-ink)]/75 text-pretty">
            Pega el link de Maps y arma una web con carácter —fotos, menú,
            horarios y contacto— en segundos.
          </p>
          <button
            className="limon-btn limon-press limon-tap group mt-9 inline-flex min-h-13 cursor-pointer items-center gap-3 rounded-full bg-[var(--mm-white)] px-7 py-3 text-base font-bold text-[var(--mm-ink)] shadow-[0_10px_30px_rgba(44,46,42,0.12)] transition-[transform,background-color] duration-150 ease-out hover:bg-[#f7f4ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mm-green-deep)]"
            onClick={focusForm}
            type="button"
          >
            Pega tu link
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-[var(--mm-maps-red)] text-white transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            >
              →
            </span>
          </button>
          <p className="mt-12 text-sm font-semibold text-[var(--mm-ink)]/70">
            Sin formularios eternos
            <span aria-hidden="true" className="mx-3">
              ·
            </span>
            Datos listos para compartir
            <span aria-hidden="true" className="mx-3">
              ·
            </span>
            Hecho en Lima, Perú
          </p>
        </section>

        {/* Ink footer — the yolk accent lives only here (design.md) */}
        <footer className="relative z-30 overflow-hidden bg-[var(--mm-ink)] px-5 pb-10 pt-16 text-[var(--mm-cream)] sm:px-8 sm:pt-20 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-caprasimo text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.98] tracking-tight text-balance">
              <button
                className="limon-tap group cursor-pointer rounded-lg text-left transition-colors duration-150 hover:text-[var(--mm-yellow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-yellow)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--mm-ink)]"
                onClick={focusForm}
                type="button"
              >
                Crea tu web ahora
                <svg
                  aria-hidden="true"
                  className="mt-4 block w-56 transition-transform duration-200 ease-out group-hover:translate-x-2 sm:w-80"
                  fill="none"
                  viewBox="0 0 240 40"
                >
                  <path
                    d="M8 22 C 36 4, 64 36, 96 18 C 128 2, 160 36, 192 18 C 212 8, 228 28, 232 20"
                    stroke="var(--mm-yellow)"
                    strokeLinecap="round"
                    strokeWidth="14"
                  />
                </svg>
              </button>
            </h2>
            <div className="mt-14 flex flex-col gap-6 border-t border-[var(--mm-cream)]/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--mm-cream)]/60">
                Copyright © {new Date().getFullYear()} limon.lat — Hecho en
                Lima, Perú
              </p>
              <a
                className="limon-tap flex cursor-pointer items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-cream)]"
                href="#hero"
                translate="no"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[var(--mm-green-deep)] font-caprasimo text-xl leading-none text-[var(--mm-ink)]">
                  L
                </span>
                <span className="font-caprasimo text-2xl leading-none">
                  limon
                </span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
