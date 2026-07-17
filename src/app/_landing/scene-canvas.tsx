"use client";

import dynamic from "next/dynamic";
import { type RefObject, useEffect, useState } from "react";

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

type SceneCanvasProps = {
  scrollProgress: RefObject<number>;
};

export function SceneCanvas({ scrollProgress }: SceneCanvasProps) {
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [quality, setQuality] = useState<"low" | "high">("high");

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const sync = () => {
      setReducedMotion(motionQuery.matches);
      setQuality(mobileQuery.matches ? "low" : "high");
    };

    sync();
    setReady(true);
    motionQuery.addEventListener("change", sync);
    mobileQuery.addEventListener("change", sync);
    return () => {
      motionQuery.removeEventListener("change", sync);
      mobileQuery.removeEventListener("change", sync);
    };
  }, []);

  if (!ready) return null;

  return (
    <HeroScene
      scrollProgress={scrollProgress}
      reducedMotion={reducedMotion}
      quality={quality}
    />
  );
}
