"use client";

import { useEffect, useRef, useState } from "react";

const SAMPLE_SITE = "palmeras.limon.lat";

/**
 * MindMarket-style timeline ([mindmarket.com](https://mindmarket.com/)):
 * - Intro heading in normal flow (no sticky overlap with the hero)
 * - Tall SVG ribbon; scroll scrubs the dash (path travels)
 * - Exactly one card visible per scroll beat, centered vertically
 */
const CARDS = [
  {
    n: "01",
    title: "Sin caos. Solo tu web.",
    body: "Un link de Google Maps. Nosotros armamos fotos, menú, horarios y contacto — listos para compartir.",
    cta: "Arma mi web",
    href: "#hero-form",
    side: "left" as const,
    accent: "ink" as const,
  },
  {
    n: "02",
    title: "Pega el link de Maps",
    body: "Sin formularios eternos. Solo la URL de tu restaurante en Google Maps.",
    cta: "Empezar",
    href: "#hero-form",
    side: "right" as const,
    accent: "green" as const,
  },
  {
    n: "03",
    title: "Juntamos lo público",
    body: "Fotos, horarios, teléfono, dirección y reseñas — listos para tu web.",
    cta: "Ver qué incluye",
    href: "#hero-form",
    side: "left" as const,
    accent: "green" as const,
  },
  {
    n: "04",
    title: "Tu web ya está lista",
    body: "Un link compartible para WhatsApp, Instagram o la puerta del local.",
    cta: SAMPLE_SITE,
    href: `https://${SAMPLE_SITE}`,
    external: true,
    side: "right" as const,
    accent: "green" as const,
  },
] as const;

/**
 * Single wide serpentine: big amplitude, generous vertical spacing so the
 * stroke never overlaps itself. One clear diagonal sweep per card beat.
 */
const RIBBON_D = [
  // Straight vertical lead-in at the horizontal CENTER: the band + stub hide
  // behind the hero restaurant, so the path visually pours out of the
  // building. The rectangle stub butts seamlessly against the intro band.
  "M 972 -300",
  "L 972 420",
  "C 972 1120, 1620 1200, 1600 1840",
  "C 1580 2600, 340 2600, 360 3360",
  "C 380 4120, 1620 4120, 1600 4880",
  "C 1580 5640, 900 5640, 1000 6420",
].join(" ");

const VIEW_W = 1944;
const VIEW_H = 6560;
const WINDOW_H = 1900;
const RIBBON_START_X = 972;
const RIBBON_STROKE = 420;

/**
 * Fraction of the path drawn before any scroll: a stub that descends from the
 * hero's green band into the stage, so the ribbon reads as one continuous
 * stream instead of appearing mid-air.
 */
const PRE_DRAW = 0.1;

export function ScrollPath() {
  const runwayRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [progress, setProgress] = useState(0);
  const [traveler, setTraveler] = useState({ x: 972, y: -300 });
  const [visibleH, setVisibleH] = useState(WINDOW_H);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    const runway = runwayRef.current;
    const path = pathRef.current;
    if (!runway) return;

    let raf = 0;
    const measure = () => {
      raf = 0;

      // Mirror the SVG's `slice` math: CSS percentages drift because the
      // viewBox crops to cover the stage. Align the intro band horizontally
      // and track the truly visible viewBox height for the vbY window.
      // clientWidth excludes the scrollbar — innerWidth does not, and the
      // few px of difference visibly offsets the band from the ribbon.
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const s = Math.max(vw / VIEW_W, vh / WINDOW_H);
      setVisibleH(vh / s);
      const band = bandRef.current;
      if (band) {
        const cropX = (VIEW_W * s - vw) / 2;
        band.style.left = `${(RIBBON_START_X - RIBBON_STROKE / 2) * s - cropX}px`;
        band.style.width = `${RIBBON_STROKE * s}px`;
      }

      if (reducedRef.current) {
        setProgress(1);
        if (path) {
          const len = path.getTotalLength();
          const pt = path.getPointAtLength(len);
          setTraveler({ x: pt.x, y: pt.y });
        }
        return;
      }

      const rect = runway.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight, 1);
      const next = Math.min(Math.max(-rect.top / total, 0), 1);
      setProgress(next);

      if (path) {
        const len = path.getTotalLength();
        // Pen tip = drawn fraction (pre-drawn stub + scroll scrub), so the
        // pin always rides the front of the ribbon.
        const t = Math.min(PRE_DRAW + next * 1.02, 1);
        const pt = path.getPointAtLength(Math.max(t, 0.001) * len);
        setTraveler({ x: pt.x, y: pt.y });
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // The line draws only as you scroll, and the viewBox follows the pen tip so
  // the freshly-drawn ribbon stays in view.
  const drawn = reducedRef.current
    ? 1
    : Math.min(PRE_DRAW + progress * 1.02, 1);
  const dashOffset = 1 - drawn;
  // Center the pen tip inside the *visible* window (yMin anchoring — wide
  // viewports crop the viewBox bottom, never the top, so the ribbon always
  // meets the intro band at the stage's top edge).
  const vbY = Math.min(
    Math.max(traveler.y - visibleH * 0.52, 0),
    VIEW_H - visibleH,
  );

  // One card per equal scroll beat
  const cardCount = CARDS.length;
  const rawIndex = Math.min(Math.floor(progress * cardCount), cardCount - 1);
  const activeIndex = progress >= 0.98 ? cardCount - 1 : rawIndex;
  const segment = 1 / cardCount;
  const localInCard = Math.min(
    Math.max((progress - activeIndex * segment) / (segment * 0.35), 0),
    1,
  );

  return (
    <section
      aria-labelledby="how-heading"
      className="relative z-30 -mt-10 w-full sm:-mt-16"
      id="camino"
    >
      <div className="rounded-t-[2.25rem] bg-[var(--mm-cream)] sm:rounded-t-[3.5rem] lg:rounded-t-[4.5rem]">
        {/* Intro — normal flow, MindMarket editorial block */}
        <div className="relative">
          {/* Green band pouring from the hero into the ribbon start —
              left/width set in measure() to mirror the SVG slice crop */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-[72.5%] hidden w-[21.5%] bg-[#8ed462] sm:block"
            ref={bandRef}
          />
          <div className="relative mx-auto w-full max-w-6xl px-5 pb-4 pt-20 sm:px-8 sm:pt-24 lg:px-12">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#5fa83a]">
              El camino
            </p>
            <h2
              className="mt-3 max-w-2xl font-caprasimo text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.04] tracking-tight text-[var(--mm-ink)] text-balance"
              id="how-heading"
            >
              Cómo llega tu restaurante online
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--mm-ink)]/65 text-pretty">
              De un link de Google Maps a una web lista para compartir — sigue
              la línea.
            </p>
          </div>
        </div>

        {/* Sticky runway — one beat per card */}
        <div ref={runwayRef} style={{ height: `${cardCount * 100}vh` }}>
          <div className="sticky top-0 h-svh overflow-hidden">
            {/* Soft green washes for depth */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[30%] top-[-12%] h-[70%] w-[80%] rounded-[46%] bg-[#8ed462]"
              style={{ opacity: 0.1 + drawn * 0.14 }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-[24%] bottom-[-14%] h-[55%] w-[65%] rounded-[50%] bg-[#8ed462]"
              style={{ opacity: 0.07 + drawn * 0.16 }}
            />

            <div className="absolute inset-0">
              <svg
                aria-hidden="true"
                className="h-full w-full"
                fill="none"
                preserveAspectRatio="xMidYMin slice"
                viewBox={`0 ${vbY} ${VIEW_W} ${WINDOW_H}`}
              >
                <path
                  d={RIBBON_D}
                  pathLength={1}
                  ref={pathRef}
                  stroke="#8ed462"
                  strokeDasharray="1"
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={RIBBON_STROKE}
                />

                <g
                  opacity={drawn > 0.03 ? 1 : 0}
                  transform={`translate(${traveler.x} ${traveler.y})`}
                >
                  <g transform="translate(0 -92) scale(3.4)">
                    <path
                      d="M0 -18 C-11 -18 -18 -9 -18 2 C-18 16 0 34 0 34 C0 34 18 16 18 2 C18 -9 11 -18 0 -18 Z"
                      fill="#ea4335"
                    />
                    <circle cx="0" cy="-1" fill="#fff" r="7.5" />
                  </g>
                </g>
              </svg>
            </div>

            {/* Step counter — quiet anchor while the stage is pinned */}
            <p
              aria-hidden="true"
              className="absolute inset-x-0 bottom-6 z-10 text-center font-mono text-sm font-bold tabular-nums text-[var(--mm-ink)]/45"
            >
              {String(activeIndex + 1).padStart(2, "0")} / 0{cardCount}
            </p>

            <ol className="pointer-events-none absolute inset-0 z-20 list-none">
              {CARDS.map((card, i) => {
                const isActive = i === activeIndex;
                const external = "external" in card && card.external;
                const reveal = isActive ? localInCard : 0;
                const sideClass =
                  card.side === "left"
                    ? "left-4 sm:left-[7%] lg:left-[9%]"
                    : "right-4 left-auto sm:right-[7%] lg:right-[9%]";

                return (
                  <li
                    className={`absolute top-1/2 w-[min(92vw,24rem)] sm:w-[26rem] ${sideClass}`}
                    key={card.n}
                    style={{
                      opacity: isActive ? 0.15 + reveal * 0.85 : 0,
                      transform: `translate3d(0, calc(-50% + ${Math.round((1 - reveal) * 36)}px), 0)`,
                      transition:
                        "opacity 320ms var(--ease-out), transform 320ms var(--ease-out)",
                      pointerEvents: isActive && reveal > 0.4 ? "auto" : "none",
                      zIndex: isActive ? 2 : 0,
                    }}
                  >
                    <article className="rounded-[1.75rem] bg-white p-7 shadow-[0_20px_60px_rgba(44,46,42,0.14)] sm:p-9">
                      <p className="font-mono text-sm font-bold text-[#5fa83a]">
                        /{card.n}
                      </p>
                      <h3 className="mt-2.5 font-caprasimo text-[1.6rem] leading-[1.1] tracking-tight text-[var(--mm-ink)] text-balance sm:text-[1.85rem]">
                        {card.title}
                      </h3>
                      <p className="mt-3 text-base leading-7 text-[var(--mm-ink)]/65 text-pretty">
                        {card.body}
                      </p>
                      <a
                        className={`limon-press limon-tap group mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-bold transition-[transform,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 ${
                          card.accent === "ink"
                            ? "bg-[var(--mm-ink)] text-white hover:bg-[#1a1c18]"
                            : "bg-[#8ed462] text-[var(--mm-ink)] hover:bg-[#7ac455]"
                        }`}
                        href={card.href}
                        {...(external
                          ? {
                              rel: "noreferrer",
                              target: "_blank",
                              translate: "no" as const,
                            }
                          : {})}
                      >
                        {card.cta}
                        <span
                          aria-hidden="true"
                          className="grid size-6 place-items-center rounded-full bg-white text-[var(--mm-ink)] transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                        >
                          {external ? "↗" : "→"}
                        </span>
                      </a>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
