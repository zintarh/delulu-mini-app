import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/admin-session";
import { signInRedirectPath } from "@/lib/dashboard/sign-in-redirect";
import { AdminShell } from "@/app/dashboard/admin-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readAdminSession();
  if (!session) {
    const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(signInRedirectPath(pathname));
  }
  return (
    <AdminShell
      staffRole={session.staffRole}
      communityIds={session.communityIds}
    >
      {children}
    </AdminShell>
  );
}
