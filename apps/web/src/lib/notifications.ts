import { getSupabaseAdmin } from "@/lib/push/supabase";

// Notification types used across the app
export type NotificationType =
  | "milestone_due"
  | "delulu_ending"
  | "stake"
  | "like"
  | "comment"
  | "tip"
  | "system";

export interface CreateNotificationInput {
  recipientAddress: string;
  type: NotificationType;
  message: string;
  imageUrl?: string | null;
  actionUrl?: string | null;
  actorAddress?: string | null;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("notifications").insert({
    recipient_address: input.recipientAddress.toLowerCase(),
    type: input.type,
    message: input.message,
    image_url: input.imageUrl ?? null,
    action_url: input.actionUrl ?? null,
    actor_address: input.actorAddress?.toLowerCase() ?? null,
  });
}
