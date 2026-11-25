import { getSupabaseAdmin } from "../src/lib/push/supabase";
import { sendSignupIdleEmails } from "../src/lib/email/send-signup-idle";

async function main() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("no db");
  const result = await sendSignupIdleEmails(admin);
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "failed");
  process.exit(1);
});
