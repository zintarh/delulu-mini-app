import { redirect } from "next/navigation";

/** Old /wallet URL → /rewards */
export default function WalletRedirectPage() {
  redirect("/rewards");
}
