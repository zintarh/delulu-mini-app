import type { getSupabaseAdmin } from "@/lib/push/supabase";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Private Bingo photos: one switch per player (profiles.bingo_photos_private).
 * Other players see a private card's progress but not its photos; the owner,
 * the AI verifier and admins always do. Until the migration runs
 * (docs/migrations/20261124_bingo_private_photos.sql) everyone reads as public
 * and switching returns `setupPending`.
 */
const COLUMN = "bingo_photos_private";
const missingColumn = (msg: string | undefined) => !!msg && msg.includes(COLUMN);

/** Wallets (lowercase) among these whose Bingo photos are private. */
export async function privatePhotoWallets(admin: Admin, wallets: string[]): Promise<Set<string>> {
  const list = [...new Set(wallets.map((w) => w.toLowerCase()))];
  if (list.length === 0) return new Set();
  const { data, error } = await admin.from("profiles").select(`address, ${COLUMN}`).in("address", list).eq(COLUMN, true);
  if (error) {
    if (!missingColumn(error.message)) console.error("[bingo/privacy] read failed", error);
    return new Set();
  }
  return new Set((data ?? []).map((p) => String((p as { address: string }).address).toLowerCase()));
}

export async function arePhotosPrivate(admin: Admin, wallet: string): Promise<boolean> {
  return (await privatePhotoWallets(admin, [wallet])).has(wallet.toLowerCase());
}

export async function setPhotosPrivate(admin: Admin, wallet: string, value: boolean): Promise<{ ok: true } | { ok: false; setupPending: boolean; error: string }> {
  const { data, error } = await admin.from("profiles").update({ [COLUMN]: value }).eq("address", wallet.toLowerCase()).select("address");
  if (error) return { ok: false, setupPending: missingColumn(error.message), error: error.message };
  if (!data?.length) return { ok: false, setupPending: false, error: "Finish setting up your profile first." };
  return { ok: true };
}

/** Whether the column exists yet (the migration ran) — the switch stays hidden until then. */
export async function photoPrivacyReady(admin: Admin): Promise<boolean> {
  const { error } = await admin.from("profiles").select(COLUMN).limit(1);
  return !error;
}
