"use client";

import { Center, ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, Suspense, useMemo, useRef } from "react";
import type { Group, Mesh, Object3D } from "three";

const INK = "#2c2e2a";
const GREEN = "#8ed462";
const CREAM = "#f5f1e4";
const GROUND = "#7ac455";

const RESTAURANT_GLB = "/models/low_poly_generic_restaurant.glb";
const RESTAURANT_SCALE = 1;
const RESTAURANT_NATIVE_HEIGHT = 2.567;

type Quality = "low" | "high";

type SceneProps = {
  scrollProgress: RefObject<number>;
  reducedMotion: boolean;
  quality: Quality;
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function damp(current: number, target: number, factor: number) {
  return current + (target - current) * factor;
}

function softenMaterials(root: Object3D) {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  });
}

function Restaurant() {
  const { scene } = useGLTF(RESTAURANT_GLB);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    softenMaterials(cloned);
    return cloned;
  }, [scene]);

  return (
    <Center
      position={[0, (RESTAURANT_NATIVE_HEIGHT * RESTAURANT_SCALE) / 2, 0]}
    >
      <primitive object={model} scale={RESTAURANT_SCALE} />
    </Center>
  );
}

useGLTF.preload(RESTAURANT_GLB);

/**
 * Centered stage strip: the restaurant rises from below the frame once
 * (off-canvas entrance), idles with a gentle bob, and parallax-drops slightly
 * as the hero scrolls away. Camera stays still — calm, composed framing.
 */
function Scene({ scrollProgress, reducedMotion, quality }: SceneProps) {
  const sceneRef = useRef<Group>(null);
  const restaurantRef = useRef<Group>(null);
  const start = useRef<number>(-1);
  const { camera, size } = useThree();
  const isNarrow = size.width < 768;

  useFrame((state) => {
    const scene = sceneRef.current;
    const restaurant = restaurantRef.current;
    if (!scene || !restaurant) return;

    const baseScale = isNarrow ? 1.6 : 2.3;
    const camZ = isNarrow ? 9.2 : 9.7;
    const camY = 1.7;
    const lookY = 1.55;
    // Half-buried at rest; scroll lifts the building until it stands on the
    // cream ledge (finalY keeps the full roofline inside the strip)
    const sunkY = isNarrow ? -3.3 : -4.05;
    const finalY = isNarrow ? -1.2 : -1.4;

    camera.position.set(0, camY, camZ);
    camera.lookAt(0, lookY, 0);

    if (reducedMotion) {
      scene.position.set(0, finalY, 0);
      scene.rotation.set(0, 0, 0);
      scene.scale.setScalar(baseScale);
      restaurant.position.y = 0;
      restaurant.scale.setScalar(1);
      return;
    }

    const now = state.clock.elapsedTime;
    if (start.current < 0) start.current = now;
    const elapsed = now - start.current;
    const tHouse = easeOutCubic(
      Math.min(Math.max((elapsed - 0.15) / 0.9, 0), 1),
    );

    // Off-canvas entrance: rises from below the strip
    restaurant.position.y = damp(
      restaurant.position.y,
      (1 - tHouse) * -3.2,
      0.12,
    );
    restaurant.scale.setScalar(
      damp(restaurant.scale.x, 0.96 + tHouse * 0.04, 0.12),
    );

    // Reveal on scroll: only the roofline peeks at rest, then the whole
    // building rises as the visitor starts scrolling.
    const p = scrollProgress.current ?? 0;
    const reveal = easeOutCubic(Math.min(p / 0.45, 1));
    const bob = Math.sin(now * 0.7) * 0.03;
    scene.position.y = damp(
      scene.position.y,
      bob + sunkY + (finalY - sunkY) * reveal,
      0.09,
    );
    scene.scale.setScalar(damp(scene.scale.x, baseScale, 0.08));
    scene.rotation.y = damp(
      scene.rotation.y,
      Math.sin(now * 0.35) * 0.035,
      0.04,
    );
  });

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight intensity={0.75} position={[3, 8, 5]} />
      <directionalLight color={GREEN} intensity={0.22} position={[-4, 3, -2]} />
      <hemisphereLight color={CREAM} groundColor={GROUND} intensity={0.4} />
      <group ref={sceneRef}>
        <ContactShadows
          blur={3.6}
          color={INK}
          far={2.4}
          opacity={0.18}
          position={[0, 0.01, 0]}
          resolution={quality === "high" ? 512 : 256}
          scale={5.5}
        />
        <group ref={restaurantRef} position={[0, -3.2, 0]} scale={0.96}>
          <Suspense fallback={null}>
            <Restaurant />
          </Suspense>
        </group>
      </group>
    </>
  );
}

export default function HeroScene({
  scrollProgress,
  reducedMotion,
  quality,
}: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.55, 7.2], fov: 34 }}
      dpr={quality === "high" ? [1, 2] : [1, 1.35]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true }}
      shadows={false}
      style={{ pointerEvents: "none" }}
    >
      <Scene
        quality={quality}
        reducedMotion={reducedMotion}
        scrollProgress={scrollProgress}
      />
    </Canvas>
  );
}
