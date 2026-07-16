import { redirect } from "next/navigation";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; country?: string }>;
};

/** Legacy route — campaigns/goals pages replace standalone search. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.country) sp.set("country", params.country);
  const qs = sp.toString();

  // Country filtering is a delulu-only concept — send those to goals.
  // A bare keyword search defaults to campaigns, matching prior behavior.
  const base = params.country ? "/goals" : "/explore";
  redirect(qs ? `${base}?${qs}` : base);
}
