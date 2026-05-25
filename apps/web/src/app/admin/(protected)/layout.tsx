import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/admin-session";
import { AdminShell } from "@/app/admin/admin-shell";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return <AdminShell>{children}</AdminShell>;
}
