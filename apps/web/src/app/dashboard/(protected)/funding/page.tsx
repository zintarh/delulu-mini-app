import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { FundingPageClient } from "./funding-page-client";

export const dynamic = "force-dynamic";

export default async function FundingPage() {
  const session = await readAdminSession();
  if (!session) redirect("/signin");
  if (!isPlatformAdminRole(session.staffRole)) redirect("/dashboard");

  return <FundingPageClient />;
}
