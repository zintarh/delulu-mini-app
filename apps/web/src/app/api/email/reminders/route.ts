import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { sendReminderEmail } from "@/lib/email/send-reminder";

// Called by Vercel Cron daily — secured by CRON_SECRET
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET;
  const secret = req.headers.get("authorization");
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_URL ?? "https://delulu.app";

  // Fetch all users who have an active goal series + their profile
  const { data: activeSeries, error } = await supabase
    .from("goal_series")
    .select(`
      id,
      ultimate_goal,
      creator_address,
      goal_series_habits ( emoji, title, status )
    `)
    .eq("status", "active");

  if (error) {
    console.error("[reminders] fetch series error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!activeSeries?.length) {
    return NextResponse.json({ sent: 0, message: "No active series" });
  }

  // Fetch profiles for all addresses in one query
  const addresses = [...new Set(activeSeries.map((s) => s.creator_address))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("address, username, email")
    .in("address", addresses);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.address, p])
  );

  let sent = 0;
  let skipped = 0;

  for (const series of activeSeries) {
    const profile = profileMap[series.creator_address];

    // Skip if no email or email is a wallet placeholder
    if (!profile?.email || profile.email.endsWith("@wallet.local")) {
      skipped++;
      continue;
    }

    const pending = (series.goal_series_habits ?? []).filter(
      (h: any) => h.status === "pending"
    );

    // Nothing left to remind about
    if (pending.length === 0) {
      skipped++;
      continue;
    }

    try {
      await sendReminderEmail(profile.email, {
        username: profile.username ?? "there",
        goalTitle: series.ultimate_goal,
        pendingHabits: pending.map((h: any) => ({ emoji: h.emoji, title: h.title })),
        appUrl,
      });
      sent++;
    } catch (err) {
      console.error(`[reminders] failed to send to ${profile.email}:`, err);
    }
  }

  console.log(`[reminders] done — sent: ${sent}, skipped: ${skipped}`);
  return NextResponse.json({ sent, skipped });
}
