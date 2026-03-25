import dynamic from "next/dynamic";

const DailyClaimClient = dynamic(() => import("./DailyClaimClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-6 w-40 bg-muted rounded animate-pulse" />
        <div className="mt-6 h-10 w-72 bg-muted rounded animate-pulse" />
        <div className="mt-3 h-4 w-96 bg-muted rounded animate-pulse" />
        <div className="mt-10 space-y-3">
          <div className="h-40 bg-muted rounded-3xl animate-pulse" />
          <div className="h-28 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  ),
});

export default function GoodDollarClaimPage() {
  return <DailyClaimClient />;
}
