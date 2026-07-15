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
  if (!response.ok) throw new Error(body.error || "Generation failed.");
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
          setError(result.error || "We could not finish this restaurant.");
          return;
        }

        setStatus("failed");
        setError(
          "Generation took too long. Try again to resume from saved data.",
        );
      } catch (reason) {
        if (controller.signal.aborted) return;
        setStatus("failed");
        setError(
          reason instanceof Error
            ? reason.message
            : "The generation service is unavailable.",
        );
      }
    }

    void generate();
    return () => controller.abort();
  }, [attempt, id, initialStatus, router]);

  return (
    <main className="generation-page relative grid min-h-screen overflow-hidden bg-[#17231a] px-5 py-12 text-white sm:px-8">
      <div className="generation-glow absolute left-1/2 top-1/2 size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d7ef58]/10 blur-3xl" />
      <div className="relative z-10 m-auto w-full max-w-2xl text-center">
        <a className="inline-flex items-center gap-2.5" href="/">
          <span className="relative grid size-9 place-items-center rounded-full bg-[#d7ef58] text-[#17231a]">
            <span className="font-display text-xl leading-none">L</span>
          </span>
          <span className="text-xl font-bold tracking-[-0.04em]">limon</span>
        </a>

        <div
          className="relative mx-auto mt-16 size-40 sm:size-48"
          aria-hidden="true"
        >
          <span className="generation-ring absolute inset-0 rounded-full border border-white/15" />
          <span className="generation-orbit absolute inset-3 rounded-full border-2 border-transparent border-t-[#d7ef58]" />
          <span className="font-display absolute inset-0 grid place-items-center text-6xl text-[#d7ef58] sm:text-7xl">
            L
          </span>
        </div>

        {status === "failed" ? (
          <>
            <p className="mt-12 font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#ff7448]">
              Generation paused
            </p>
            <h1 className="font-display mt-5 text-5xl leading-none sm:text-7xl">
              The kitchen needs another try.
            </h1>
            <p
              className="mx-auto mt-6 max-w-xl leading-7 text-white/60"
              role="alert"
            >
              {error}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <button
                className="rounded-full bg-[#d7ef58] px-6 py-3.5 font-bold text-[#17231a]"
                onClick={() => setAttempt((value) => value + 1)}
                type="button"
              >
                Try again
              </button>
              <a
                className="rounded-full border border-white/25 px-6 py-3.5 font-bold"
                href="/"
              >
                Use another link
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="mt-12 font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#d7ef58]">
              Building your restaurant
            </p>
            <h1 className="font-display mt-5 text-5xl leading-none sm:text-7xl">
              Setting the table.
            </h1>
            <p className="mx-auto mt-6 max-w-lg leading-7 text-white/60">
              We are gathering the details once, preserving the photos, and
              preparing a page that loads from your own database from now on.
            </p>
            <div className="mx-auto mt-10 grid max-w-md gap-2 text-left text-sm">
              <p className="generation-step rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-white/70">
                Reading the restaurant profile
              </p>
              <p className="generation-step generation-step-delay-1 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-white/70">
                Preserving photos and reviews
              </p>
              <p className="generation-step generation-step-delay-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-white/70">
                Reading menu photos and publishing
              </p>
            </div>
            <p className="mt-8 text-xs text-white/35" aria-live="polite">
              Keep this tab open. Most restaurants are ready in under a minute.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
