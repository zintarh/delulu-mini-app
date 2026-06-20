import { redirect } from "next/navigation";

export default function NewCommunityPage() {
  redirect("/dashboard/communities?new=1");
}
