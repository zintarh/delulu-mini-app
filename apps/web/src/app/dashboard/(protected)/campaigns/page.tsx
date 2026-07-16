import { readAdminSession } from "@/lib/admin-session";
import { CampaignsPageClient } from "./campaigns-page-client";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const session = await readAdminSession();
  if (!session) return null;

  return <CampaignsPageClient />;
}
