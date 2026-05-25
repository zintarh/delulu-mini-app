export type DeluluComment = {
  id: string;
  deluluId: number;
  authorAddress: string;
  displayName: string;
  text: string;
  createdAt: string; // ISO string
};

export const DELULU_SOCIAL_UPDATED_EVENT = "delulu-social-updated";

export function notifyDeluluSocialUpdated(deluluId: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DELULU_SOCIAL_UPDATED_EVENT, { detail: { deluluId } }),
  );
}
