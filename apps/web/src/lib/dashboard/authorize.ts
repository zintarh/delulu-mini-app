import type { AdminSessionPayload } from "@/lib/admin-session";
import type { StaffSession } from "@/lib/dashboard/authorize-types";

export type { GlobalRole, StaffSession } from "@/lib/dashboard/authorize-types";
export { isPlatformAdminRole, canAccessCommunity } from "@/lib/dashboard/authorize-types";

/** Map admin session payload to StaffSession for access checks. */
export function toStaffSession(session: AdminSessionPayload): StaffSession {
  return {
    staffUserId: session.userId,
    email: session.email,
    displayName: null,
    globalRole: session.staffRole ?? "platform_admin",
    communityIds: session.communityIds,
  };
}
