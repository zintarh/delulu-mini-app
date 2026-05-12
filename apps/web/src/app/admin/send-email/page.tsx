"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Mail,
  Loader2,
  Send,
  Eye,
  Pencil,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertCircle,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { buildMarketingEmailInnerHtml } from "@/lib/marketing-email-template";
import { timestampToDate } from "@/lib/graph/transformers";
import { useEmailFilterData, type EmailDeluluDebugRow } from "@/hooks/graph/useAdminDashboard";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface UserRow {
  address: string;
  username: string | null;
  email: string;
  pfp_url: string | null;
  created_at: string;
}

type FilterId = "all" | "active_delulu" | "ended_delulu" | "ending_soon";

interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
  failedDetails?: Array<{ email: string; reason: string }>;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PAGE_SIZE = 25;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All Users" },
  { id: "active_delulu", label: "Active Delulu" },
  { id: "ended_delulu", label: "Ended" },
  { id: "ending_soon", label: "Ending Soon" },
];

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p as number)}
                className={cn(
                  "min-w-[30px] rounded-lg border px-2 py-1 text-xs font-bold transition-colors",
                  page === p
                    ? "border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111]"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {p}
              </button>
            ),
          )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RowCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked || indeterminate
          ? "border-foreground bg-foreground"
          : "border-border bg-card hover:border-foreground/40",
      )}
    >
      {checked && (
        <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 10 10">
          <path
            d="M1.5 5l2.5 2.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {!checked && indeterminate && <div className="w-2 h-0.5 bg-background rounded" />}
    </button>
  );
}

function EmailPreview({ subject, message }: { subject: string; message: string }) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://delulu.app";
  const html = buildMarketingEmailInnerHtml({
    appUrl,
    subject: subject.trim() || " ",
    messagePlain: message.trim() === "" ? " " : message,
    username: "there",
  });

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/10">
      <div className="email-preview-frame max-h-[min(78vh,860px)] overflow-y-auto overscroll-contain bg-[#f5f5f5] dark:bg-[#1a1a1a]">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function AdminSendEmailPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");

  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const {
    endingSoonAddresses,
    endingSoonMeta,
    activeTabDeluluRows,
    endedTabDeluluRows,
    isLoading: loadingFilters,
  } = useEmailFilterData();

  // Goal/deadline hints for user rows (Ending soon tab only — Active/Ended use delulu inventory tables).
  const contextMeta = useMemo(() => {
    if (activeFilter === "ending_soon") {
      return new Map(
        [...endingSoonMeta.entries()].map(([addr, v]) => [
          addr,
          { content: v.goal, deadline: v.deadline },
        ]),
      );
    }
    return new Map<string, { content: string; deadline: Date }>();
  }, [activeFilter, endingSoonMeta]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/send-email", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setAllUsers(json.users ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
    setSelectedEmails(new Set());
  }, [activeFilter, search]);

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const userByAddressLower = useMemo(() => {
    const m = new Map<string, { email: string; username: string | null }>();
    for (const u of allUsers) {
      m.set(u.address.toLowerCase(), { email: u.email, username: u.username });
    }
    return m;
  }, [allUsers]);

  /** Active tab: card-active delulus only, creator must exist in admin user list with a non-empty email. */
  const activeDeluluRowsWithEmail = useMemo(
    () =>
      activeTabDeluluRows.filter((r) => {
        if (!r.cardActive) return false;
        const prof = userByAddressLower.get(r.creatorAddress.toLowerCase());
        return Boolean(prof?.email?.trim());
      }),
    [activeTabDeluluRows, userByAddressLower],
  );

  const filteredDeluluInventoryRows = useMemo(() => {
    if (activeFilter !== "active_delulu" && activeFilter !== "ended_delulu") {
      return [] as EmailDeluluDebugRow[];
    }
    const source =
      activeFilter === "ended_delulu" ? endedTabDeluluRows : activeDeluluRowsWithEmail;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.creatorAddress.toLowerCase().includes(q) ||
        r.goal.toLowerCase().includes(q) ||
        r.resolutionDeadline.toLowerCase().includes(q),
    );
  }, [activeFilter, activeDeluluRowsWithEmail, endedTabDeluluRows, search]);

  /** Unique creator emails in the current delulu inventory view (active / ended tabs). */
  const deluluFilteredRecipientEmails = useMemo(() => {
    const set = new Set<string>();
    for (const r of filteredDeluluInventoryRows) {
      const e = userByAddressLower.get(r.creatorAddress.toLowerCase())?.email?.trim();
      if (e) set.add(e);
    }
    return set;
  }, [filteredDeluluInventoryRows, userByAddressLower]);

  const filteredUsers = useMemo(() => {
    let users = allUsers;

    if (activeFilter === "active_delulu") {
      return [];
    } else if (activeFilter === "ended_delulu") {
      return [];
    } else if (activeFilter === "ending_soon") {
      users = users.filter((u) => endingSoonAddresses.has(u.address.toLowerCase()));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.username ?? "").toLowerCase().includes(q) ||
          u.address.toLowerCase().includes(q),
      );
    }

    return users;
  }, [allUsers, activeFilter, search, endingSoonAddresses]);

  const filterCounts = useMemo(
    () => ({
      all: allUsers.length,
      active_delulu: activeDeluluRowsWithEmail.length,
      ended_delulu: endedTabDeluluRows.length,
      ending_soon: allUsers.filter((u) =>
        endingSoonAddresses.has(u.address.toLowerCase()),
      ).length,
    }),
    [allUsers, activeDeluluRowsWithEmail, endedTabDeluluRows, endingSoonAddresses],
  );

  const recipientListLength =
    activeFilter === "active_delulu" || activeFilter === "ended_delulu"
      ? filteredDeluluInventoryRows.length
      : filteredUsers.length;

  const totalPages = Math.max(1, Math.ceil(recipientListLength / PAGE_SIZE));

  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedDeluluRows = filteredDeluluInventoryRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const pageEmails = paginatedUsers.map((u) => u.email);

  const pageDeluluEmails = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const r of paginatedDeluluRows) {
      const e = userByAddressLower.get(r.creatorAddress.toLowerCase())?.email?.trim();
      if (e && !seen.has(e)) {
        seen.add(e);
        out.push(e);
      }
    }
    return out;
  }, [paginatedDeluluRows, userByAddressLower]);

  const allPageSelected = pageEmails.length > 0 && pageEmails.every((e) => selectedEmails.has(e));
  const somePageSelected = pageEmails.some((e) => selectedEmails.has(e));

  const allDeluluPageSelected =
    pageDeluluEmails.length > 0 && pageDeluluEmails.every((e) => selectedEmails.has(e));
  const someDeluluPageSelected = pageDeluluEmails.some((e) => selectedEmails.has(e));

  const selectAllRecipientCount =
    activeFilter === "active_delulu" || activeFilter === "ended_delulu"
      ? deluluFilteredRecipientEmails.size
      : filteredUsers.length;

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const togglePageAll = () => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageEmails.forEach((e) => next.delete(e));
      } else {
        pageEmails.forEach((e) => next.add(e));
      }
      return next;
    });
  };

  const togglePageAllDelulu = () => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (allDeluluPageSelected) {
        pageDeluluEmails.forEach((e) => next.delete(e));
      } else {
        pageDeluluEmails.forEach((e) => next.add(e));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (activeFilter === "active_delulu" || activeFilter === "ended_delulu") {
      setSelectedEmails(new Set(deluluFilteredRecipientEmails));
      return;
    }
    setSelectedEmails(new Set(filteredUsers.map((u) => u.email)));
  };
  const clearAll = () => setSelectedEmails(new Set());

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: [...selectedEmails],
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Send failed: ${res.status}`);
      setResult(json);
      if ((json.failed ?? 0) > 0) {
        const firstFailure = json.failedDetails?.[0];
        setSendError(
          firstFailure
            ? `Failed for ${firstFailure.email}: ${firstFailure.reason}`
            : `${json.failed} email(s) failed to send.`,
        );
      }
      setSelectedEmails(new Set());
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const canSend =
    selectedEmails.size > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    !sending;

  const isLoading = loadingUsers || loadingFilters;

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="w-full px-5 sm:px-7 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Send Email</h1>
      </div>

      {/* Result banner */}
      {result && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-[#35d07f]/30 bg-[#35d07f]/10 px-5 py-3.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#35d07f]" />
          <p className="text-sm font-semibold text-foreground flex-1">
            {result.sent} sent · {result.skipped} skipped · {result.failed} failed
          </p>
          <button type="button" onClick={() => setResult(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {sendError && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-50 dark:bg-red-950/20 px-5 py-3.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">{sendError}</p>
          <button type="button" onClick={() => setSendError(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Composer ─────────────────────────────────────────────────────── */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border px-4 pt-3 pb-0">
          <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <Mail className="h-4 w-4 text-background" />
          </div>
          {(["edit", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPreviewMode(tab)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors",
                previewMode === tab
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {tab === "edit" ? "Edit" : "Preview"}
              {previewMode === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {previewMode === "edit" ? (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject…"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Write your message…"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none leading-relaxed bg-transparent"
                />
              </div>
            </>
          ) : (
            <EmailPreview subject={subject} message={message} />
          )}
        </div>
      </div>

      {/* ── Recipients ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              activeFilter === f.id
                ? "border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111]"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {f.label}
            {!loadingFilters && !loadingUsers && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                  activeFilter === f.id
                    ? "bg-white/20 text-white dark:bg-black/20 dark:text-black"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {filterCounts[f.id]}
              </span>
            )}
          </button>
        ))}

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={isLoading || selectAllRecipientCount === 0}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            Select all ({selectAllRecipientCount})
          </button>
          {activeFilter === "ended_delulu" && (
            <p className="text-[11px] text-muted-foreground max-w-xs text-right leading-snug">
              Delulus where the card would show <span className="font-semibold">ended</span> (resolution set and in the past). Same rule as “Card active: No”.
            </p>
          )}
          {selectedEmails.size > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Search + selected badge */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={
              activeFilter === "active_delulu" || activeFilter === "ended_delulu"
                ? "Search by delulu id, creator, goal, deadline…"
                : "Search by username, email or address…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {selectedEmails.size > 0 && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-[#35d07f]" />
            <span className="text-sm font-bold text-foreground tabular-nums">
              {selectedEmails.size}
            </span>
            <span className="text-sm text-muted-foreground">
              selected
            </span>
          </div>
        )}
      </div>

      {/* User table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <p className="py-14 text-center text-sm text-destructive">{fetchError}</p>
        ) : (activeFilter === "active_delulu" || activeFilter === "ended_delulu"
          ? filteredDeluluInventoryRows.length === 0
          : filteredUsers.length === 0) ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">
              {activeFilter === "active_delulu" || activeFilter === "ended_delulu"
                ? "No delulus in this view"
                : "No users found"}
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              {activeFilter === "active_delulu"
                ? "Adjust search, refresh users, or note: only creators with an email in the admin list are shown."
                : activeFilter === "ended_delulu"
                  ? "Adjust search, or confirm the subgraph returned data (non-cancelled markets only)."
                  : "Try a different filter or search term."}
            </p>
          </div>
        ) : activeFilter === "active_delulu" || activeFilter === "ended_delulu" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 w-10">
                      <RowCheckbox
                        checked={allDeluluPageSelected}
                        indeterminate={!allDeluluPageSelected && someDeluluPageSelected}
                        onChange={togglePageAllDelulu}
                      />
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      ID
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Creator
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Milestones
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Res. (unix s)
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Res. (local)
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Card active
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Goal
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Profile email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeluluRows.map((r) => {
                    const prof = userByAddressLower.get(r.creatorAddress.toLowerCase());
                    const creatorEmail = prof?.email?.trim() ?? "";
                    const isChecked = Boolean(creatorEmail && selectedEmails.has(creatorEmail));
                    const resDate = timestampToDate(r.resolutionDeadline);
                    const resLocal =
                      resDate.getTime() > 0
                        ? resDate.toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—";
                    return (
                      <tr
                        key={r.id}
                        onClick={() => {
                          if (creatorEmail) toggleEmail(creatorEmail);
                        }}
                        className={cn(
                          "border-b border-border transition-colors",
                          creatorEmail ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/20",
                          isChecked ? "bg-foreground/[0.03]" : "",
                        )}
                      >
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          {creatorEmail ? (
                            <RowCheckbox checked={isChecked} onChange={() => toggleEmail(creatorEmail)} />
                          ) : (
                            <span className="inline-block h-4 w-4 shrink-0 rounded border border-border opacity-40" title="No email on file" />
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sm font-bold tabular-nums text-foreground">
                          {r.id}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatAddress(r.creatorAddress as `0x${string}`)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs tabular-nums text-muted-foreground">
                          {r.milestoneCount ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground tabular-nums">
                          {r.resolutionDeadline}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{resLocal}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                              r.cardActive
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                            )}
                          >
                            {r.cardActive ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-[220px]">
                          <span className="text-xs text-foreground line-clamp-2 leading-snug">
                            {r.goal || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-[180px]">
                          {prof ? (
                            <span className="text-xs text-foreground truncate block">{prof.email}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 w-10">
                      <RowCheckbox
                        checked={allPageSelected}
                        indeterminate={!allPageSelected && somePageSelected}
                        onChange={togglePageAll}
                      />
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Username</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                    {activeFilter === "all" ? (
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Address</th>
                    ) : (
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Goal</th>
                    )}
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {activeFilter === "all" ? "Joined" : "Ending"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => {
                    const isChecked = selectedEmails.has(u.email);
                    const deluluInfo = contextMeta.get(u.address.toLowerCase());
                    return (
                      <tr
                        key={u.address}
                        onClick={() => toggleEmail(u.email)}
                        className={cn(
                          "border-b border-border cursor-pointer transition-colors",
                          isChecked ? "bg-foreground/[0.03]" : "hover:bg-muted/30",
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <RowCheckbox checked={isChecked} onChange={() => toggleEmail(u.email)} />
                        </td>
                        <td className="px-5 py-3.5">
                          {u.username ? (
                            <span className="text-sm font-semibold text-foreground">@{u.username}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 max-w-[200px]">
                          <span className="text-sm text-foreground truncate block">{u.email}</span>
                        </td>
                        {activeFilter === "all" ? (
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatAddress(u.address as `0x${string}`)}
                            </span>
                          </td>
                        ) : (
                          <td className="px-5 py-3.5 max-w-[200px]">
                            {deluluInfo?.content ? (
                              <span className="text-xs text-foreground line-clamp-2 leading-snug">
                                {deluluInfo.content}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Loading…</span>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                          {activeFilter === "all"
                            ? (u.created_at
                                ? new Date(u.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                                : "—")
                            : (deluluInfo?.deadline
                                ? deluluInfo.deadline.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                                : "—")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </div>

      {/* Sticky send footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm px-5 py-4 lg:left-60">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {selectedEmails.size === 0 ? (
              "Select recipients to send"
            ) : (
              <>
                <span className="font-semibold text-foreground">{selectedEmails.size}</span>{" "}
                recipient{selectedEmails.size !== 1 ? "s" : ""} selected
              </>
            )}
          </p>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending
              ? `Sending ${selectedEmails.size}…`
              : `Send to ${selectedEmails.size > 0 ? selectedEmails.size : "selected"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
