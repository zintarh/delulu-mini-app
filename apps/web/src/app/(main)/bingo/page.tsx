import { redirect } from "next/navigation";

/** Bingos live alongside campaigns on Explore — one place to browse. */
export default function BingoHubPage() {
  redirect("/explore");
}
