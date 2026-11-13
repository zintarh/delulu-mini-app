/**
 * Time of day on the person's own clock. Drives the page background
 * (`html[data-daypart]` → `.bg-wash` in globals.css) and small touches like
 * Lulu sleeping at night. Pure — no "@/" imports, so it's unit-testable.
 */
export type Daypart = "dawn" | "day" | "dusk" | "night";

export const DAYPARTS: readonly Daypart[] = ["dawn", "day", "dusk", "night"];

export function isDaypart(v: unknown): v is Daypart {
  return typeof v === "string" && (DAYPARTS as readonly string[]).includes(v);
}

/** 5–11 dawn · 11–17 day · 17–20 dusk · 20–5 night (local hours). */
export function daypartFor(date: Date): Daypart {
  const h = date.getHours();
  if (h >= 5 && h < 11) return "dawn";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/**
 * Inline <head> script: sets data-daypart before first paint so there's no
 * flash of the daytime wash at night. `?daypart=night` previews a part.
 */
export const DAYPART_BOOT_SCRIPT = `(function(){try{var p=new URLSearchParams(location.search).get("daypart");var ok=["dawn","day","dusk","night"];var h=new Date().getHours();var d=ok.indexOf(p)>=0?p:h>=5&&h<11?"dawn":h>=11&&h<17?"day":h>=17&&h<20?"dusk":"night";document.documentElement.setAttribute("data-daypart",d);}catch(e){}})();`;
