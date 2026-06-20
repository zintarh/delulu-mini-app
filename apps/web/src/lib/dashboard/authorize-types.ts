export type GlobalRole = "platform_admin" | "community_admin";

export interface StaffSession {
  staffUserId: string;
  email: string;
  displayName: string | null;
  globalRole: GlobalRole;
  /** Community IDs this staff member is actively assigned to. */
  communityIds: string[];
}

/** Legacy allowlist users have staffRole null and are treated as platform admins. */
export function isPlatformAdminRole(staffRole: GlobalRole | null): boolean {
  return staffRole === "platform_admin" || staffRole === null;
}

/** Returns true if the caller can access the given communityId. Safe to use in page components. */
export function canAccessCommunity(session: StaffSession, communityId: string): boolean {
  return session.globalRole === "platform_admin" || session.communityIds.includes(communityId);
}
