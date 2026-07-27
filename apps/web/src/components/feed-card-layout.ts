/** Shared horizontal feed card width — home categories & detail explore row. */
export const FEED_CARD_SLOT_CLASS =
  "snap-start shrink-0 w-[min(88vw,340px)] sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2rem)/3)]";

/**
 * Home feed type scale — every card (forfeit, mission, feature) should use these
 * so titles/subtitles don't jump in size from card to card.
 */
export const FEED_CARD_TITLE_CLASS =
  "text-lg font-bold leading-snug tracking-tight text-foreground";

export const FEED_CARD_SUBTITLE_CLASS =
  "text-sm leading-snug text-muted-foreground";

export const FEED_CARD_META_CLASS =
  "text-xs font-medium text-muted-foreground";

export const FEED_CARD_EYEBROW_CLASS =
  "text-[10px] font-black uppercase text-foreground/40";

export const FEED_CARD_CTA_CLASS = "text-sm font-bold";
