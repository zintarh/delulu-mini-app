import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { FLOW_STATE, setFlowStateLive } from "@/lib/flow-state";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Short, so an admin flip reaches every server instance within seconds. */
const CACHE_MS = 15_000;
let cached: { on: boolean; at: number } | null = null;

export type FlowVoteSetting = { enabled: boolean; updatedAt: string | null; updatedBy: string | null; stored: boolean };

/** The row as stored. A missing table or row means the code default. */
export async function readFlowVoteSetting(admin: SupabaseAdmin): Promise<FlowVoteSetting> {
  const { data, error } = await admin.from("app_settings").select("value, updated_at, updated_by").eq("key", "flow_vote").maybeSingle();
  if (error) throw new Error(error.message);
  const value = (data?.value ?? null) as { enabled?: unknown } | null;
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : FLOW_STATE.active,
    updatedAt: (data?.updated_at as string | undefined) ?? null,
    updatedBy: (data?.updated_by as string | undefined) ?? null,
    stored: !!data,
  };
}

/** Is voting on? Cached 15s per instance. A failed read keeps the last answer (or the code default). */
export async function getFlowVoteEnabled(admin: SupabaseAdmin | null): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.on;
  let on = cached?.on ?? FLOW_STATE.active;
  if (admin) {
    try {
      on = (await readFlowVoteSetting(admin)).enabled;
    } catch (err) {
      console.error("[app-settings] flow_vote read failed, keeping", on, err);
    }
  }
  cached = { on, at: Date.now() };
  setFlowStateLive(on);
  return on;
}

export async function saveFlowVoteEnabled(admin: SupabaseAdmin, enabled: boolean, by: string): Promise<FlowVoteSetting> {
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "flow_vote", value: { enabled }, updated_at: new Date().toISOString(), updated_by: by }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  cached = { on: enabled, at: Date.now() };
  setFlowStateLive(enabled);
  return readFlowVoteSetting(admin);
}
