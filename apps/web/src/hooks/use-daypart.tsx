"use client";

import { useEffect, useState } from "react";
import { daypartFor, isDaypart, type Daypart } from "@/lib/daypart/daypart";

function read(): Daypart {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-daypart");
    if (isDaypart(attr)) return attr;
  }
  return daypartFor(new Date());
}

/** Current time of day (follows the `?daypart=` preview the boot script applied). */
export function useDaypart(): Daypart {
  const [part, setPart] = useState<Daypart>("day");
  useEffect(() => {
    setPart(read());
    const obs = new MutationObserver(() => setPart(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-daypart"] });
    return () => obs.disconnect();
  }, []);
  return part;
}

/**
 * Keeps `html[data-daypart]` in step with the clock (every few minutes and
 * whenever the app comes back to the foreground). Mounted once in the root.
 */
export function DaypartSync() {
  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get("daypart");
    if (isDaypart(preview)) return; // previewing a fixed part
    const tick = () => {
      const next = daypartFor(new Date());
      if (document.documentElement.getAttribute("data-daypart") !== next) {
        document.documentElement.setAttribute("data-daypart", next);
      }
    };
    tick();
    const id = window.setInterval(tick, 5 * 60_000);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
