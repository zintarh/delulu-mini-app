import Link from "next/link";
import { ExternalLink, Users } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  DashboardTableCard,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
} from "@/components/dashboard/dashboard-ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function joinLabel(via: string | null) {
  if (via === "onboarding") return "Onboarding";
  if (via === "invite_code") return "Invite";
  if (via === "admin_added") return "Admin";
  return "—";
}

export default async function PublicCommunityMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return <PageShell title="Members"><p className="text-sm text-muted-foreground">Unavailable right now.</p></PageShell>;
  }

  const { data: community } = await admin
    .from("communities")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!community) {
    return <PageShell title="Community not found"><p className="text-sm text-muted-foreground">This link may be invalid.</p></PageShell>;
  }

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: members, count } = await admin
    .from("community_members")
    .select("id, wallet_address, joined_at, joined_via, gd_first_claimed_at, gd_claim_count", {
      count: "exact",
    })
    .eq("community_id", community.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .range(from, to);

  const wallets = (members ?? []).map((m) => m.wallet_address.toLowerCase());
  const { data: profiles } = wallets.length
    ? await admin.from("profiles").select("address, username").in("address", wallets)
    : { data: [] as { address: string; username: string | null }[] };
  const usernameMap = new Map((profiles ?? []).map((p) => [p.address.toLowerCase(), p.username]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <PageShell title={community.name} subtitle={`${count ?? 0} members`}>
      <DashboardTableCard>
        {!members?.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No members yet</p>
        ) : (
          <DashboardTableScroll>
            <DashboardTableHead>
              <DashboardTableHeadRow>
                <DashboardTableHeadCell>Member</DashboardTableHeadCell>
                <DashboardTableHeadCell>Joined</DashboardTableHeadCell>
                <DashboardTableHeadCell>Source</DashboardTableHeadCell>
                <DashboardTableHeadCell>Claims</DashboardTableHeadCell>
                <DashboardTableHeadCell>First claim</DashboardTableHeadCell>
              </DashboardTableHeadRow>
            </DashboardTableHead>
            <DashboardTableBody>
              {members.map((m) => (
                <DashboardTableRow key={m.id}>
                  <DashboardTableCell>
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono text-xs">
                        {usernameMap.get(m.wallet_address.toLowerCase())
                          ? `@${usernameMap.get(m.wallet_address.toLowerCase())}`
                          : formatAddress(m.wallet_address)}
                      </p>
                      <a
                        href={`https://celoscan.io/address/${m.wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="View on Celoscan"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </DashboardTableCell>
                  <DashboardTableCell className="text-xs text-muted-foreground">
                    {formatDate(m.joined_at)}
                  </DashboardTableCell>
                  <DashboardTableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                      {joinLabel(m.joined_via)}
                    </span>
                  </DashboardTableCell>
                  <DashboardTableCell className="tabular-nums font-semibold">
                    {m.gd_claim_count ?? 0}
                  </DashboardTableCell>
                  <DashboardTableCell className="text-xs text-muted-foreground">
                    {formatDate(m.gd_first_claimed_at)}
                  </DashboardTableCell>
                </DashboardTableRow>
              ))}
            </DashboardTableBody>
          </DashboardTableScroll>
        )}
      </DashboardTableCard>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={`?page=${page - 1}`} className="text-muted-foreground hover:text-foreground">
              Previous
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`?page=${page + 1}`} className="text-muted-foreground hover:text-foreground">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}

function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
