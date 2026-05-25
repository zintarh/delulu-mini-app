import { redirect } from "next/navigation";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; country?: string }>;
};

/** Legacy route — explore page replaces standalone search. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.country) sp.set("country", params.country);
  const qs = sp.toString();
  redirect(qs ? `/explore?${qs}` : "/explore");
}
