import { redirect } from "next/navigation";

/** Delulu “All goals” admin list removed — pending milestone review is the Milestones home. */
export default function AdminMarketsRedirectPage() {
  redirect("/dashboard/milestones");
}
