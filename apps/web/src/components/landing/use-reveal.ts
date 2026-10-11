import { useEffect, type RefObject } from "react";

/**
 * Animates `.reveal` elements inside `rootRef` in once as they scroll into view
 * (styles in globals.css). The landing page owns its scroller, so it is the root.
 */
export function useReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { root, threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    root.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    root.classList.add("reveal-ready");

    return () => observer.disconnect();
  }, [rootRef]);
}
