"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  Mail,
  Eye,
  Pencil,
  Users,
  AlertTriangle,
  SquareCheckBig,
  Square,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import type { FormattedDelulu } from "@/lib/types";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface BroadcastSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  delulus: FormattedDelulu[];
  isLoading: boolean;
}

type Step = "compose" | "sending" | "done";

interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

/* ─── Default template values ────────────────────────────────────────────── */
const DEFAULT_SUBJECT = "Your delulu is waiting for a milestone 🎯";
const DEFAULT_MESSAGE = `You created a delulu on Delulu but haven't set any milestones yet.

Milestones are how you track your progress and prove your commitment on-chain. Without them, your stakers can't follow along, and you can't submit proof.

It only takes a minute — head to your delulu and add your first milestone today.`;

/* ─── Email preview renderer ─────────────────────────────────────────────── */
function EmailPreview({ subject, message }: { subject: string; message: string }) {
  const appUrl = process.env.NEXT_PUBLIC_URL ?? "https://delulu.app";
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="padding:24px 28px 18px;text-align:center;border-bottom:1px solid #e5e7eb;background:#fafafa;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;background:#111111;border-radius:10px;margin-bottom:8px;">
        <span style="color:#fcff52;font-size:20px;">⚡</span>
      </div>
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">From the Delulu team</p>
    </div>
    <div style="padding:28px;">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#111827;">Hey @alice 👋</h1>
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Subject</p>
      <p style="margin:0 0 20px;font-size:15px;font-weight:700;color:#111827;">${subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "(no subject)"}</p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />
      <div style="font-size:14px;color:#374151;line-height:1.75;">${safeMessage || "<em style='color:#9ca3af;'>Type a message to preview it here…</em>"}</div>
      <div style="margin-top:28px;text-align:center;">
        <span style="display:inline-block;background:#111111;color:#ffffff;font-size:13px;font-weight:800;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">
          Set your milestone →
        </span>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center;background:#fafafa;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this because you have an active delulu on delulu.app</p>
    </div>
  </div>`;

  return (
    <div className="overflow-y-auto rounded-xl border border-border bg-[#f8fafc] p-4">
      <div
        className="mx-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function BroadcastSheet({ open, onOpenChange, delulus, isLoading }: BroadcastSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<Step>("compose");
  const [result, setResult] = useState<SendResult | null>(null);
  const [reachable, setReachable] = useState<number | null>(null);
  const reachableFetched = useRef(false);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSelected(new Set());
        setSubject(DEFAULT_SUBJECT);
        setMessage(DEFAULT_MESSAGE);
        setPreviewMode("edit");
        setSearch("");
        setStep("compose");
        setResult(null);
        setReachable(null);
        reachableFetched.current = false;
      }, 300);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return delulus;
    return delulus.filter((d) => {
      const id = String(d.onChainId ?? d.id);
      const creator = (d.creator ?? "").toLowerCase();
      const content = (d.content ?? "").toLowerCase();
      const un = (d.username ?? "").toLowerCase();
      return id.includes(q) || creator.includes(q) || content.includes(q) || un.includes(q);
    });
  }, [delulus, search]);

  // Unique creator addresses across all no-milestone delulus
  const uniqueAddresses = useMemo(
    () => [...new Set(delulus.map((d) => d.creator).filter(Boolean))],
    [delulus],
  );

  // Check reachable count when selection changes
  useEffect(() => {
    if (selected.size === 0) { setReachable(null); return; }
    const addresses = [...selected].join(",");
    fetch(`/api/admin/broadcast?addresses=${encodeURIComponent(addresses)}`)
      .then((r) => r.json())
      .then((d) => setReachable(d.reachable ?? null))
      .catch(() => setReachable(null));
  }, [selected]);

  const toggleAddress = (addr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(addr) ? next.delete(addr) : next.add(addr);
      return next;
    });
  };

  const toggleAll = () => {
    const visibleAddresses = [...new Set(filtered.map((d) => d.creator).filter(Boolean))];
    const allSelected = visibleAddresses.every((a) => selected.has(a));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleAddresses.forEach((a) => next.delete(a));
      } else {
        visibleAddresses.forEach((a) => next.add(a));
      }
      return next;
    });
  };

  const visibleAddresses = useMemo(
    () => [...new Set(filtered.map((d) => d.creator).filter(Boolean))],
    [filtered],
  );
  const allVisible = visibleAddresses.length > 0 && visibleAddresses.every((a) => selected.has(a));

  const handleSend = async () => {
    if (selected.size === 0 || !subject.trim() || !message.trim()) return;
    setStep("sending");
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: [...selected],
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const json = await res.json();
      setResult(json);
      setStep("done");
    } catch {
      setResult({ sent: 0, skipped: 0, failed: selected.size, total: selected.size });
      setStep("done");
    }
  };

  const canSend = selected.size > 0 && subject.trim().length > 0 && message.trim().length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh]",
            "flex flex-col rounded-2xl border border-border bg-card shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200",
          )}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
                <Mail className="h-4 w-4 text-background" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Send Broadcast</p>
                <p className="text-xs text-muted-foreground">
                  {delulus.length} delulu{delulus.length !== 1 ? "s" : ""} with no milestones ·{" "}
                  {uniqueAddresses.length} creator{uniqueAddresses.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <DialogPrimitive.Close className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          {step === "done" && result ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#35d07f]/15">
                <CheckCircle2 className="h-8 w-8 text-[#35d07f]" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-foreground">Broadcast sent</p>
                <p className="mt-1 text-sm text-muted-foreground">Here's how it went</p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                {[
                  { label: "Sent", value: result.sent, color: "text-[#35d07f]" },
                  { label: "Skipped", value: result.skipped, color: "text-muted-foreground" },
                  { label: "Failed", value: result.failed, color: result.failed > 0 ? "text-red-500" : "text-muted-foreground" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
                    <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {result.skipped > 0 && (
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {result.skipped} user{result.skipped !== 1 ? "s" : ""} skipped — no real email address on file.
                </p>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg bg-foreground px-6 py-2.5 text-sm font-bold text-background hover:opacity-80 transition-opacity"
              >
                Close
              </button>
            </div>
          ) : step === "sending" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Sending {selected.size} email{selected.size !== 1 ? "s" : ""}…</p>
              <p className="text-xs text-muted-foreground">This may take a moment.</p>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 flex-col lg:flex-row">

              {/* ── Left: recipient selector ────────────────────────────── */}
              <div className="flex flex-col w-full lg:w-[42%] border-b lg:border-b-0 lg:border-r border-border min-h-0">
                <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Recipients
                    </p>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-muted-foreground transition-colors"
                    >
                      {allVisible ? (
                        <SquareCheckBig className="h-3.5 w-3.5" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                      {allVisible ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <input
                    type="search"
                    placeholder="Filter by creator, id, content…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {selected.size > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-foreground/5 border border-border px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-[#35d07f]" />
                      <p className="text-xs font-semibold text-foreground">
                        {selected.size} creator{selected.size !== 1 ? "s" : ""} selected
                        {reachable !== null && (
                          <span className="text-muted-foreground font-normal">
                            {" "}· {reachable} with real email
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                      <CheckCircle2 className="h-8 w-8 text-[#35d07f]" />
                      <p className="text-sm font-semibold text-foreground">All caught up!</p>
                      <p className="text-xs text-muted-foreground">Every active delulu has at least one milestone.</p>
                    </div>
                  ) : (
                    filtered.map((d) => {
                      const addr = d.creator ?? "";
                      const isChecked = selected.has(addr);
                      const label = d.username
                        ? `@${d.username}`
                        : addr
                          ? formatAddress(addr as `0x${string}`)
                          : "—";
                      const preview = d.content
                        ? d.content.slice(0, 60) + (d.content.length > 60 ? "…" : "")
                        : "—";
                      const isExpired =
                        d.stakingDeadline && d.stakingDeadline < new Date();

                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleAddress(addr)}
                          className={cn(
                            "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors",
                            isChecked
                              ? "bg-foreground/[0.04]"
                              : "hover:bg-muted/40",
                          )}
                        >
                          <div
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                              isChecked
                                ? "border-foreground bg-foreground"
                                : "border-border bg-card",
                            )}
                          >
                            {isChecked && (
                              <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 10 10">
                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">{label}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">#{d.onChainId ?? d.id}</span>
                              {isExpired && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Expired
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug truncate">
                              {preview}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Right: email composer ───────────────────────────────── */}
              <div className="flex flex-col flex-1 min-h-0">
                {/* Tab bar */}
                <div className="shrink-0 flex items-center gap-1 border-b border-border px-4 pt-3 pb-0">
                  {(["edit", "preview"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPreviewMode(tab)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors capitalize",
                        previewMode === tab
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {tab === "edit" ? "Edit template" : "Preview email"}
                      {previewMode === tab && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Editor / preview */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {previewMode === "edit" ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Subject line
                        </label>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Email subject…"
                          className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Message body
                          <span className="ml-2 normal-case font-normal text-muted-foreground/60">
                            — personalized with recipient's username
                          </span>
                        </label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={12}
                          placeholder="Write your message…"
                          className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none leading-relaxed"
                        />
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                        <p><span className="font-semibold text-foreground">Greeting:</span> Auto-prepended — "Hey @username 👋"</p>
                        <p><span className="font-semibold text-foreground">CTA button:</span> "Set your milestone →" links to the user's profile</p>
                        <p><span className="font-semibold text-foreground">Skipped:</span> Users with no real email (@wallet.local) will not receive this</p>
                      </div>
                    </>
                  ) : (
                    <EmailPreview subject={subject} message={message} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {step === "compose" && (
            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              <p className="text-xs text-muted-foreground">
                {selected.size === 0
                  ? "Select at least one recipient"
                  : `${selected.size} creator${selected.size !== 1 ? "s" : ""} selected${reachable !== null ? ` · ${reachable} reachable` : ""}`}
              </p>
              <div className="flex items-center gap-2">
                <DialogPrimitive.Close className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                  Cancel
                </DialogPrimitive.Close>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-40 hover:opacity-80 transition-opacity"
                >
                  <Send className="h-4 w-4" />
                  Send broadcast
                </button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
