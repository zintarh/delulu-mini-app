import { redirect } from "next/navigation";

/** Temporary: the public landing page replaces this in the next commit. */
export default function RootPage() {
  redirect("/home");
}
