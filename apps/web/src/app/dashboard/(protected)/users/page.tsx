"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Search,
  Users,
  X,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Gift,
} from "lucide-react";
import { formatAddress } from "@/lib/utils";
import {
  AdminFilterPill,
  AdminKpiStrip,
  AdminPagination,
} from "@/components/admin/admin-ui";
import { RewardUserModal } from "@/components/admin/reward-user-modal";
import { useDashboardToast } from "@/components/dashboard/dashboard-toast";
import {
  DashboardPage,
  DashboardPageHeader,
  DashboardTableCard,
  DashboardTableLoading,
  DashboardTableEmptyState,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
  hasTableCellValue,
} from "@/components/dashboard/dashboard-ui";

interface UserRow {
  address: string;
  username: string | null;
  email: string;
  pfp_url: string | null;
  referral_code: string | null;
  claim_count: number | null;
  created_at: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

type DatePreset = "all" | "today" | "yesterday" | "custom";

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "custom", label: "Pick date" },
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingAddress, setSavingAddress] = useState<string | null>(null);
  const [rewardAddress, setRewardAddress] = useState<string | null>(null);
  const { show: showToast } = useDashboardToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("query", search.trim());
      if (datePreset === "today") params.set("date", "today");
      else if (datePreset === "yesterday") params.set("date", "yesterday");
      else if (datePreset === "custom" && customDate) params.set("date", customDate);
      params.set("page", String(page));

      const res = await fetch(`/api/dashboard/users?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, datePreset, customDate, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handlePreset = (p: DatePreset) => { setDatePreset(p); setPage(1); };
  const handleCustomDate = (v: string) => { setCustomDate(v); setPage(1); };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const handleDeleteUser = async (targetAddress: string) => {
    const confirmed = window.confirm(
      `Delete user ${formatAddress(targetAddress as `0x${string}`)}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingAddress(targetAddress);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/users?address=${encodeURIComponent(targetAddress)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Delete failed: ${res.status}`);
      }
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingAddress(null);
    }
  };

  const handleStartEdit = (targetAddress: string, currentUsername: string | null) => {
    setEditingAddress(targetAddress);
    setEditValue(currentUsername ?? "");
  };

  const handleCancelEdit = () => {
    setEditingAddress(null);
    setEditValue("");
  };

  const handleSaveUsername = async (targetAddress: string) => {
    const username = editValue.trim();
    if (!username) return;

    setSavingAddress(targetAddress);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress, username }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Rename failed: ${res.status}`);
      }
      // Only clear the edit box if it still belongs to this row — the admin may
      // have already moved on to editing a different row while this save was in flight.
      setEditingAddress((current) => {
        if (current !== targetAddress) return current;
        setEditValue("");
        return null;
      });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename user");
    } finally {
      setSavingAddress(null);
    }
  };

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">

      <DashboardPageHeader title="Users" />

      {data && (
        <AdminKpiStrip icon={Users}>
          <span className="text-sm font-bold text-foreground tabular-nums">{data.total}</span>
          <span className="text-sm text-muted-foreground">
            registered user{data.total !== 1 ? "s" : ""}
          </span>
        </AdminKpiStrip>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by username or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_PRESETS.map((preset) => (
            <AdminFilterPill
              key={preset.id}
              active={datePreset === preset.id}
              onClick={() => handlePreset(preset.id)}
            >
              {preset.label}
            </AdminFilterPill>
          ))}
        </div>

        {datePreset === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => handleCustomDate(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : error ? (
          <p className="py-14 text-center text-sm text-destructive">{error}</p>
        ) : !data || data.users.length === 0 ? (
          <DashboardTableEmptyState icon={Users} title="No users found" />
        ) : (
          <>
            <DashboardTableScroll minWidth="680px">
              <DashboardTableHead>
                <DashboardTableHeadRow>
                  <DashboardTableHeadCell>Address</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Username</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Email</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Referral</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Joined</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Claims</DashboardTableHeadCell>
                  <DashboardTableHeadCell align="right">Action</DashboardTableHeadCell>
                </DashboardTableHeadRow>
              </DashboardTableHead>
              <DashboardTableBody>
                {data.users.map((u) => (
                  <DashboardTableRow key={u.address}>
                    <DashboardTableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatAddress(u.address as `0x${string}`)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(u.address)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy full address"
                        >
                          {copiedAddress === u.address ? (
                            <Check className="w-3.5 h-3.5 text-delulu-blue" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`https://celoscan.io/address/${u.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="View on Celoscan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </DashboardTableCell>
                    <DashboardTableCell>
                      {editingAddress === u.address ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleSaveUsername(u.address);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                            autoFocus
                            maxLength={32}
                            className="w-32 rounded-lg border border-border bg-white px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveUsername(u.address)}
                            disabled={savingAddress === u.address || !editValue.trim()}
                            className="text-delulu-blue hover:opacity-80 disabled:opacity-40"
                            title="Save"
                          >
                            {savingAddress === u.address ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={savingAddress === u.address}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {hasTableCellValue(u.username) ? (
                            <span className="font-semibold text-foreground">@{u.username}</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(u.address, u.username)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Rename user"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </DashboardTableCell>
                    <DashboardTableCell className="max-w-[200px] truncate text-foreground">
                      {u.email}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      {hasTableCellValue(u.referral_code) ? (
                        <span className="font-mono text-xs text-muted-foreground">{u.referral_code}</span>
                      ) : null}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      {u.created_at ? (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : null}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {u.claim_count ?? 0}
                      </span>
                    </DashboardTableCell>
                    <DashboardTableCell align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRewardAddress(u.address)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-delulu-blue/30 px-2.5 py-1.5 text-xs font-semibold text-delulu-blue hover:bg-delulu-blue-light transition-colors"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          Reward
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.address)}
                          disabled={deletingAddress === u.address}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          {deletingAddress === u.address ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    </DashboardTableCell>
                  </DashboardTableRow>
                ))}
              </DashboardTableBody>
            </DashboardTableScroll>
            <AdminPagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </DashboardTableCard>

      {rewardAddress ? (
        <RewardUserModal
          userAddress={rewardAddress}
          onClose={() => setRewardAddress(null)}
          onSuccess={(message) => showToast(message)}
        />
      ) : null}
    </DashboardPage>
  );
}
