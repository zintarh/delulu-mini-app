/**
 * Fingerprints every proof image approved before proof integrity checks
 * shipped (20261116), so an old proof can't be submitted again as new.
 * Without this the duplicate check only knows images reviewed since deploy.
 *
 * Reads proof_rewards (every AI- or friend-approved proof), downloads each
 * image and records an 'accepted' row in proof_image_fingerprints with
 * period_key "legacy:<proof_rewards.id>" (it never matches a live period,
 * so these always count as earlier use). Skips URLs already fingerprinted.
 * Safe to re-run. Defaults to a dry run; pass --apply to write.
 *
 * Usage (from apps/web):
 *   pnpm tsx scripts/backfill-proof-fingerprints.ts          # dry run
 *   pnpm tsx scripts/backfill-proof-fingerprints.ts --apply  # write for real
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { fingerprintImage } from "../src/lib/proof-integrity/fingerprint";
import { readCaptureDate } from "../src/lib/proof-integrity/capture-date";

config({ path: resolve(__dirname, "../.env.local") });

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 6;

type ProofRow = { id: string; wallet: string; kind: "campaign" | "forfeit"; ref_id: string | null; proof_url: string };

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const proofs: ProofRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("proof_rewards")
      .select("id, wallet, kind, ref_id, proof_url")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    proofs.push(...((data ?? []) as ProofRow[]));
    if (!data || data.length < 1000) break;
  }

  const known = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("proof_image_fingerprints").select("proof_url").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) known.add(r.proof_url as string);
    if (!data || data.length < 1000) break;
  }

  const todo = proofs.filter((p) => !known.has(p.proof_url));
  console.log(`${proofs.length} approved proofs, ${todo.length} not fingerprinted yet${APPLY ? "" : " (dry run)"}`);

  let done = 0;
  let failed = 0;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (p) => {
        try {
          const res = await fetch(p.proof_url, { signal: AbortSignal.timeout(20_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const bytes = Buffer.from(await res.arrayBuffer());
          const [fp, takenAt] = await Promise.all([fingerprintImage(bytes), readCaptureDate(bytes, null)]);
          rows.push({
            wallet: p.wallet.toLowerCase(),
            kind: p.kind,
            ref_id: p.ref_id ?? "",
            period_key: `legacy:${p.id}`,
            proof_url: p.proof_url,
            sha256: fp.sha256,
            dhash: fp.dhash,
            width: fp.width,
            height: fp.height,
            taken_at: takenAt?.toISOString() ?? null,
            status: "accepted",
          });
          done++;
        } catch (err) {
          failed++;
          console.warn(`skip ${p.proof_url}: ${err instanceof Error ? err.message : err}`);
        }
      }),
    );
  }

  const unique = new Set(rows.map((r) => r.sha256)).size;
  console.log(`fingerprinted ${done}, failed ${failed}, distinct images ${unique}`);
  if (!APPLY) {
    console.log("Dry run — pass --apply to write.");
    return;
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("proof_image_fingerprints").insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`wrote ${rows.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
