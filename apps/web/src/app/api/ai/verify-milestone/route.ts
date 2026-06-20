import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { verifyImageProof } from "@/lib/ai/verify-image-proof";

export type { VerifyImageProofResult as VerifyMilestoneResponse } from "@/lib/ai/verify-image-proof";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, milestoneDescription, deluluGoal } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return errorResponse("imageUrl is required", 400);
    }

    const rawGoal = typeof deluluGoal === "string" ? deluluGoal.trim() : "";
    const rawMilestone =
      typeof milestoneDescription === "string" ? milestoneDescription.trim() : "";

    const result = await verifyImageProof({
      imageUrl,
      goal: rawGoal,
      milestone: rawMilestone,
    });

    return jsonResponse(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify milestone";
    if (message === "AI service not configured") return errorResponse(message, 503);
    if (message.includes("Image fetch failed") || message.includes("download")) {
      return errorResponse("Could not download the image. Please try again.", 422);
    }
    console.error("[/api/ai/verify-milestone]", err);
    return errorResponse(message, 500);
  }
}
