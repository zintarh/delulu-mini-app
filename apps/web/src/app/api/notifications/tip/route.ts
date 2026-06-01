import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";

// POST /api/notifications/tip — called client-side after a successful on-chain tip
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tipperAddress = typeof body.tipperAddress === "string" ? body.tipperAddress.toLowerCase() : null;
    const creatorAddress = typeof body.creatorAddress === "string" ? body.creatorAddress.toLowerCase() : null;
    const deluluId = body.deluluId != null ? String(body.deluluId) : null;
    const amount = typeof body.amount === "string" ? body.amount : null;
    const tokenSymbol = typeof body.tokenSymbol === "string" ? body.tokenSymbol : "G$";

    if (!tipperAddress || !creatorAddress || !deluluId) {
      return NextResponse.json({ error: "tipperAddress, creatorAddress, deluluId required" }, { status: 400 });
    }

    // Don't notify if the tipper is the creator
    if (tipperAddress === creatorAddress) {
      return NextResponse.json({ ok: true });
    }

    const short = `${tipperAddress.slice(0, 6)}…${tipperAddress.slice(-4)}`;
    const amountStr = amount ? ` ${amount} ${tokenSymbol}` : "";

    await createNotification({
      recipientAddress: creatorAddress,
      type: "tip",
      message: `**${short}** tipped you${amountStr} on your delulu`,
      actorAddress: tipperAddress,
      actionUrl: `/delulu/${deluluId}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}
