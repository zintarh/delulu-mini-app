import { cn } from "@/lib/utils";
import { Lulu, type LuluMood } from "./art";

/**
 * How Lulu feels about your habits lately:
 * sunny   — kept everything today
 * waiting — today still to do (or brand new)
 * gloomy  — missed yesterday
 * sad     — missed 2–6 days
 * storm   — gone a week or more: rain, cold, slumped
 * One kept day brings the sun straight back.
 */
export type LuluWeather = "sunny" | "waiting" | "gloomy" | "sad" | "storm";

const FACE: Record<LuluWeather, LuluMood> = {
  sunny: "kept",
  waiting: "dream",
  gloomy: "gloomy",
  sad: "sad",
  storm: "storm",
};

/** Days fully missed (today excluded) → weather. `daysSinceKept` null = never kept. */
export function luluWeatherFor({
  keptToday,
  daysSinceKept,
}: {
  keptToday: boolean;
  daysSinceKept: number | null;
}): LuluWeather {
  if (keptToday || daysSinceKept === 0) return "sunny";
  if (daysSinceKept == null) return "waiting";
  const missed = daysSinceKept - 1;
  if (missed >= 7) return "storm";
  if (missed >= 2) return "sad";
  if (missed === 1) return "gloomy";
  return "waiting";
}

function Cloud({ dark }: { dark: boolean }) {
  return (
    <path
      d="M14 22a7 7 0 0 1 2-13.6A9 9 0 0 1 33 7a7.5 7.5 0 0 1 9 7.5A6 6 0 0 1 40 22z"
      fill={dark ? "#8A8A83" : "#E6E6E0"}
      stroke="#161615"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  );
}

/** Falling drops under the cloud; heavier for a storm. */
function Rain({ heavy }: { heavy: boolean }) {
  const drops = heavy ? [12, 18, 24, 30, 36, 42] : [18, 28, 38];
  return (
    <>
      {drops.map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={25}
          x2={x - 1.5}
          y2={30}
          stroke="#8A8A83"
          strokeWidth="2"
          strokeLinecap="round"
          className="lulu-rain"
          style={{ animationDelay: `${(i * 0.37) % 1.1}s`, animationDuration: heavy ? "0.8s" : "1.3s" }}
        />
      ))}
    </>
  );
}

/**
 * Lulu with weather that matches the mood.
 * Decorative: the card next to it carries the words.
 */
export function LuluScene({ weather, className }: { weather: LuluWeather; className?: string }) {
  const showCloud = weather === "gloomy" || weather === "sad" || weather === "storm";
  return (
    <span className={cn("relative block h-[84px] w-[76px] shrink-0", className)} aria-hidden>
      <span className="absolute bottom-0 left-1/2 block -translate-x-1/2">
        {/* Lulu moves on its own now (hop, droop, shiver per mood). */}
        <Lulu size={60} mood={FACE[weather]} animated />
      </span>
      {/* Weather layer, over Lulu's head */}
      <svg viewBox="0 0 54 34" className="absolute left-1/2 top-0 h-[34px] w-[54px] -translate-x-1/2 overflow-visible">
        {showCloud ? (
          <g className={cn(weather !== "storm" && "lulu-drift")}>
            {(weather === "sad" || weather === "storm") && <Rain heavy={weather === "storm"} />}
            <Cloud dark={weather !== "gloomy"} />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
