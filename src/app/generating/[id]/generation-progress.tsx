"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { isLimonHost, restaurantUrl } from "@/lib/domains";

type GenerationStatus = "failed" | "generating" | "pending" | "ready";

type StatusResponse = {
  status?: GenerationStatus;
  slug?: string;
  error?: string;
};

const STEPS = [
  "Leyendo el perfil del restaurante",
  "Guardando fotos y reseñas",
  "Leyendo el menú y publicando",
];

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function readResponse(response: Response): Promise<StatusResponse> {
  const body = (await response.json()) as StatusResponse;
  if (!response.ok) throw new Error(body.error || "No pudimos armar tu web.");
  return body;
}

export function GenerationProgress({
  id,
  initialStatus,
  initialError,
}: {
  id: string;
  initialStatus: GenerationStatus;
  initialError?: string;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<GenerationStatus>(initialStatus);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialStatus === "failed" && attempt === 0) return;

    const controller = new AbortController();
    const endpoint = `/api/generations/${id}?attempt=${attempt}`;

    async function generate() {
      setStatus("generating");
      setError(undefined);

      try {
        let result: StatusResponse = { status: "generating" };

        try {
          result = await readResponse(
            await fetch(endpoint, {
              method: "POST",
              signal: controller.signal,
            }),
          );
        } catch {
          if (controller.signal.aborted) return;
          // The worker may continue even if its request connection is interrupted.
        }

        let polls = 0;
        while (
          (result.status === "pending" || result.status === "generating") &&
          !controller.signal.aborted &&
          polls < 260
        ) {
          await wait(1_500, controller.signal);
          polls += 1;
          result = await readResponse(
            await fetch(endpoint, {
              cache: "no-store",
              method: polls % 20 === 0 ? "POST" : "GET",
              signal: controller.signal,
            }),
          );
        }

        if (result.status === "ready" && result.slug) {
          if (isLimonHost(window.location.host)) {
            window.location.replace(restaurantUrl(result.slug));
            return;
          }
          startTransition(() => router.replace(`/${result.slug}`));
          return;
        }

        if (result.status === "failed") {
          setStatus("failed");
          setError(result.error || "No pudimos terminar tu web.");
          return;
        }

        setStatus("failed");
        setError(
          "Esto está tardando más de lo normal. Intenta de nuevo para seguir desde donde quedó.",
        );
      } catch (reason) {
        if (controller.signal.aborted) return;
        setStatus("failed");
        setError(
          reason instanceof Error
            ? reason.message
            : "El servicio no está disponible por ahora.",
        );
      }
    }

    void generate();
    return () => controller.abort();
  }, [attempt, id, initialStatus, router]);

  const failed = status === "failed";

  return (
    <main className="limon-landing limon-mm relative grid min-h-screen place-items-center overflow-hidden bg-[var(--mm-cream)] px-5 py-16 text-[var(--mm-ink)] sm:px-8">
      <div
        aria-hidden="true"
        className="generation-glow pointer-events-none absolute left-1/2 top-1/2 size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--mm-green-deep)]/20 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-2xl text-center">
        <a
          className="limon-tap inline-flex cursor-pointer items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mm-cream)]"
          href="/"
          translate="no"
        >
          <span className="grid size-9 place-items-center rounded-full bg-[var(--mm-green-deep)] font-caprasimo text-lg leading-none text-[var(--mm-ink)]">
            L
          </span>
          <span className="font-caprasimo text-xl leading-none text-[var(--mm-ink)]">
            limon
          </span>
        </a>

        <div
          aria-hidden="true"
          className="relative mx-auto mt-14 size-36 sm:size-40"
        >
          <span className="generation-ring absolute inset-0 rounded-full border border-[var(--mm-ink)]/12" />
          {!failed ? (
            <span className="generation-orbit absolute inset-3 rounded-full border-2 border-transparent border-t-[var(--mm-green-deep)] motion-reduce:hidden" />
          ) : null}
          <span className="font-caprasimo absolute inset-0 grid place-items-center text-5xl text-[var(--mm-ink)] sm:text-6xl">
            L
          </span>
        </div>

        <div aria-live="polite">
          {failed ? (
            <>
              <p className="mt-10 text-sm font-bold uppercase tracking-[0.14em] text-[var(--danger)]">
                Necesitamos otro intento
              </p>
              <h1 className="limon-enter mt-4 font-caprasimo text-[clamp(2.25rem,5.5vw,3.5rem)] leading-[1.02] tracking-tight text-balance">
                La cocina necesita un momento más.
              </h1>
              <p
                className="limon-enter mx-auto mt-5 max-w-lg text-lg leading-7 text-[var(--mm-ink)]/70 text-pretty"
                role="alert"
                style={{ "--limon-delay": "60ms" } as React.CSSProperties}
              >
                {error}
              </p>
              <div className="limon-enter mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  className="limon-btn limon-press limon-tap inline-flex min-h-13 cursor-pointer items-center rounded-full bg-[var(--mm-maps-red)] px-7 text-base font-bold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#d33a2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mm-cream)]"
                  onClick={() => setAttempt((value) => value + 1)}
                  type="button"
                >
                  Intentar de nuevo
                </button>
                <a
                  className="limon-btn limon-press limon-tap inline-flex min-h-13 cursor-pointer items-center rounded-full bg-[var(--mm-white)] px-7 text-base font-bold text-[var(--mm-ink)] shadow-[0_8px_30px_rgba(44,46,42,0.10)] transition-[transform,background-color] duration-150 ease-out hover:bg-[#f7f4ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mm-cream)]"
                  href="/"
                >
                  Usar otro link
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="mt-10 text-sm font-bold uppercase tracking-[0.14em] text-[#5fa83a]">
                Preparando tu web
              </p>
              <h1 className="font-caprasimo mt-4 text-[clamp(2.25rem,5.5vw,3.5rem)] leading-[1.02] tracking-tight text-balance">
                Armando tu web.
              </h1>
              <p className="mx-auto mt-5 max-w-md text-lg leading-7 text-[var(--mm-ink)]/70 text-pretty">
                Estamos juntando fotos, menú, horarios y contacto en una web
                lista para compartir.
              </p>
              <ol
                aria-hidden="true"
                className="mx-auto mt-9 grid max-w-md gap-2 text-left text-sm"
              >
                {STEPS.map((step, index) => (
                  <li
                    className={`generation-step rounded-full border border-[var(--mm-ink)]/10 bg-[var(--mm-white)]/70 px-5 py-3 text-[var(--mm-ink)]/70 generation-step-delay-${index}`}
                    key={step}
                  >
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-8 text-sm text-[var(--mm-ink)]/50">
                No cierres esta pestaña. La mayoría está lista en menos de un
                minuto.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
