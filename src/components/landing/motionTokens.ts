import type React from "react";
import { animate } from "motion/react";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const SPRING_GENTLE = {
  type: "spring",
  duration: 0.58,
  bounce: 0.16,
} as const;

export const VIEWPORT_ONCE = {
  once: true,
  amount: 0.22,
} as const;

let activeScrollControls: { stop: () => void } | null = null;

/**
 * Interruptible, GPU-frame-paced smooth scroll for landing hash anchors.
 * Avoids Next.js <Link> instant hash snapping and avoids CSS double-smoothing.
 */
export function smoothScrollTo(
  e: React.MouseEvent<HTMLElement>,
  targetId: string
) {
  if (!targetId.startsWith("#")) return;
  const el = document.getElementById(targetId.slice(1));
  if (!el) return;

  e.preventDefault();

  if (activeScrollControls) {
    activeScrollControls.stop();
    activeScrollControls = null;
  }

  const startY = window.scrollY;
  const headerOffset = 88;
  const targetY = Math.max(
    0,
    Math.min(
      document.documentElement.scrollHeight - window.innerHeight,
      el.getBoundingClientRect().top + startY - headerOffset
    )
  );

  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", targetId);
  }

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
    return;
  }

  const distance = Math.abs(targetY - startY);
  const duration = Math.min(0.9, Math.max(0.45, distance / 2000));

  const cleanup = () => {
    window.removeEventListener("wheel", cancelOnUserInput);
    window.removeEventListener("touchstart", cancelOnUserInput);
    window.removeEventListener("keydown", cancelOnUserKey);
  };

  const cancelOnUserInput = () => {
    if (activeScrollControls) {
      activeScrollControls.stop();
      activeScrollControls = null;
    }
    cleanup();
  };

  const cancelOnUserKey = (ev: KeyboardEvent) => {
    if (
      ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(
        ev.key
      )
    ) {
      cancelOnUserInput();
    }
  };

  window.addEventListener("wheel", cancelOnUserInput, { passive: true });
  window.addEventListener("touchstart", cancelOnUserInput, { passive: true });
  window.addEventListener("keydown", cancelOnUserKey);

  activeScrollControls = animate(startY, targetY, {
    duration,
    ease: [0.22, 1, 0.36, 1],
    onUpdate: (latest) => {
      window.scrollTo({ top: latest, behavior: "instant" as ScrollBehavior });
    },
    onComplete: () => {
      activeScrollControls = null;
      cleanup();
    },
  });
}
