"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { parseUnits } from "viem";
import {
  Activity,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { DurationDayStrip } from "@/components/forfeit/duration-day-strip";
import { DeluluDetailHeader } from "@/components/delulu-detail/delulu-detail-header";
import { useSupportedTokens } from "@/hooks/use-supported-tokens";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useTokenMetadata } from "@/hooks/use-token-metadata";
import { getForfeitMarketAddress, FORFEIT_CREATION_ENABLED } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { formatUsdEquivalent } from "@/lib/token-amounts";
import { TokenBadge } from "@/components/token-badge";
import { FeedbackModal } from "@/components/feedback-modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  ForfeitCadence,
  ForfeitDestinationType,
  generateVerifierInviteCode,
  useCreateForfeitCommitment,
} from "@/hooks/use-create-forfeit-commitment";
import {
  clearPendingForfeitConfirm,
  ensurePendingForfeitConfirmed,
  readPendingForfeitConfirm,
  writePendingForfeitConfirm,
  type PendingForfeitConfirm,
} from "@/lib/forfeit/pending-forfeit-confirm";
import {
  addDays,
  endOfDay,
  scheduleFromDeadline,
  startOfDay,
} from "@/lib/forfeit/forfeit-schedule";


const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CLASH = { fontFamily: '"Clash Display", sans-serif' } as const;
const MANROPE = { fontFamily: "var(--font-manrope)" } as const;

/** Adds thousands separators to a raw (unformatted) numeric string as the user types. */
function formatAmountDraft(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
}

function formatAnytimeLabel(date: Date) {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const tomorrow = addDays(today, 1);
  const in3 = addDays(today, 2);
  const in7 = addDays(today, 6);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (target.getTime() === in3.getTime()) return "3 days";
  if (target.getTime() === in7.getTime()) return "7 days";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function normalizeEvidenceTypeForApi(evidenceId: string): string {
  if (evidenceId === "gps-checkin") return "gps";
  return evidenceId;
}

type EvidenceType = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  /** Lead-in before the evidence pill, e.g. "I'll send a" */
  sentencePrefix: string;
  /** Label inside the evidence pill */
  pillLabel: string;
  /** Text after the pill, e.g. "of" */
  sentenceSuffix: string;
  placeholder: string;
  tags?: string[];
  comingSoon?: boolean;
};

const EVIDENCE_TYPES: EvidenceType[] = [
  {
    id: "photo",
    title: "Photo",
    description: "Submit photo evidence.",
    icon: ImageIcon,
    sentencePrefix: "I'll send a",
    pillLabel: "photo",
    sentenceSuffix: "of",
    placeholder: "Reading for 30 minutes",
  },
  {
    id: "camera",
    title: "Camera only",
    description: "Live camera proof only",
    icon: Camera,
    sentencePrefix: "I'll take a",
    pillLabel: "live photo",
    sentenceSuffix: "of",
    placeholder: "Finishing a 20-minute workout",
  },
  {
    id: "gps-checkin",
    title: "GPS check-in",
    description: "Prove you were at a location by a certain time.",
    icon: MapPin,
    sentencePrefix: "I'll do a",
    pillLabel: "GPS check-in",
    sentenceSuffix: "at",
    placeholder: "Arriving at the gym by 7am",
    tags: ["Check-in", "Time interval"],
    comingSoon: true,
  },
  {
    id: "strava",
    title: "Strava run",
    description: "Verify a completed workout from your Strava activity.",
    icon: Activity,
    sentencePrefix: "I'll complete a",
    pillLabel: "Strava run",
    sentenceSuffix: "for",
    placeholder: "A 30-minute run",
    comingSoon: true,
  },
];

const PENALTY_AMOUNT_PRESETS = [1000, 5000, 10000] as const;
const MIN_FORFEIT_AMOUNT_GOODDOLLAR = 1000;

const FORFEIT_DESTINATIONS = [
  {
    id: "charity",
    label: "charity",
    title: "Charity",
    description:
      "If you miss it, your stake is held in the Delulu pool earmarked for charity, until direct charity payouts are supported.",
  },
  {
    id: "friend",
    label: "a friend",
    title: "Friend",
    description: "If you miss it, your stake goes to a friend you choose.",
  },
  {
    id: "delulu",
    label: "Delulu",
    title: "Delulu",
    description: "If you miss it, your stake goes to the Delulu community pool.",
  },
] as const;

type ForfeitDestinationId = (typeof FORFEIT_DESTINATIONS)[number]["id"];

// "Charity" is routed to the same on-chain CommunityPool mechanism as "Delulu"
// for now — CommunityPool is the only destination type the contract escrows
// internally (communityPoolBalance) rather than requiring an approved external
// payout address, so charity forfeits can go live without picking a real charity
// wallet yet. The two are only distinguished off-chain, via is_charity_intent on
// the forfeit_commitments row (see confirm-create) — otherwise the pooled funds
// would be indistinguishable once mixed together on-chain.
const DESTINATION_TYPE_BY_ID: Record<ForfeitDestinationId, number> = {
  charity: ForfeitDestinationType.CommunityPool,
  friend: ForfeitDestinationType.Friend,
  delulu: ForfeitDestinationType.CommunityPool,
};

const REPEAT_EVERY = ["day", "weekday", "week"] as const;

const CADENCE_BY_REPEAT: Record<(typeof REPEAT_EVERY)[number], number> = {
  day: ForfeitCadence.Daily,
  weekday: ForfeitCadence.Weekday,
  week: ForfeitCadence.Weekly,
};

const ADDITIONAL_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
  excludeEvidence: readonly string[];
}> = [
  {
    id: "remind",
    label: "Remind me 1 hour before deadline",
    excludeEvidence: [],
  },
  {
    id: "friend-verifier",
    label: "Allow friend as verifier",
    excludeEvidence: [],
  },
];

function PillButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-delulu-blue px-3 py-1.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98]",
        className,
      )}
      style={MANROPE}
    >
      {children}
      <ChevronDown className="h-3.5 w-3.5 opacity-90" />
    </button>
  );
}

function SheetListRow({
  selected,
  title,
  description,
  onClick,
  icon: Icon,
  tags,
  disabled,
  badge,
}: {
  selected?: boolean;
  title: string;
  description?: string;
  onClick: () => void;
  icon?: React.ElementType;
  tags?: string[];
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border/40 bg-muted/30 opacity-70"
          : selected
            ? "border-delulu-blue bg-accent"
            : "border-border/60 bg-card hover:bg-muted/40",
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            disabled ? "bg-muted/80 text-muted-foreground" : "bg-muted text-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-sm font-bold",
                disabled ? "text-muted-foreground" : "text-foreground",
              )}
              style={MANROPE}
            >
              {title}
            </p>
            {badge ? (
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </div>
          {selected && !disabled ? (
            <Check className="h-4 w-4 shrink-0 text-delulu-blue" />
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground" style={MANROPE}>
            {description}
          </p>
        ) : null}
        {tags && tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function ForfeitCreatePage() {
  // Defaults to repeating — an ongoing accountability habit is the more common
  // case for this app; a one-time forfeit is the thing you opt into via the toggle.
  const [isRepeat, setIsRepeat] = useState(true);
  const [evidenceId, setEvidenceId] = useState("photo");
  const [description, setDescription] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date>(() =>
    endOfDay(addDays(new Date(), 6)),
  );
  const [deadlineLabel, setDeadlineLabel] = useState<string>("7 days");
  // A short (sub-day) one-off duration, e.g. "30 min" — mutually exclusive
  // with deadlineDate/cutoffTime; only offered when !isRepeat.
  const [shortDurationSeconds, setShortDurationSeconds] = useState<number | null>(null);
  // Raw input backing the short-goal duration — free-form value + unit
  // instead of fixed presets, so any goal length is expressible.
  const [shortGoalValue, setShortGoalValue] = useState("");
  const [shortGoalUnit, setShortGoalUnit] = useState<"minutes" | "hours">("minutes");
  // "Submit before HH:MM" — null means "submit anytime" (the default,
  // rolling/end-of-day behavior). Only meaningful when shortDurationSeconds is null.
  const [cutoffTime, setCutoffTime] = useState<{ hours: number; minutes: number } | null>(null);
  const submitAnytime = cutoffTime === null;
  const minDeadlineDate = useMemo(() => startOfDay(new Date()), []);
  // Frozen at mount so the "cutoff each period" preview doesn't drift as the
  // user fills out the form — it should reflect when the schedule would start.
  const formStartedAtRef = useRef(new Date());
  const [repeatEvery, setRepeatEvery] = useState<(typeof REPEAT_EVERY)[number]>("day");
  const [forfeitAmount, setForfeitAmount] = useState(1000);
  const [amountDraft, setAmountDraft] = useState("1000");
  // Neutral default — "charity" shouldn't be silently pre-selected for anyone
  // who never opens the destination picker; that's an intent worth an explicit choice.
  const [destinationId, setDestinationId] = useState<ForfeitDestinationId>("delulu");
  const [destinationFriendAddress, setDestinationFriendAddress] = useState("");
  const [destinationFriendQuery, setDestinationFriendQuery] = useState("");
  const [destinationFriend, setDestinationFriend] = useState<{
    address: `0x${string}`;
    username: string | null;
    email: string | null;
    pfpUrl: string | null;
  } | null>(null);
  const [destinationSearchResults, setDestinationSearchResults] = useState<
    Array<{
      address: string;
      username: string | null;
      email: string | null;
      hasRealEmail: boolean;
      pfpUrl: string | null;
    }>
  >([]);
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false);

  const supportedTokens = useSupportedTokens();
  const [selectedToken, setSelectedToken] = useState<string>(
    () => supportedTokens.find((t) => t.symbol === "G$")?.address ?? supportedTokens[0]?.address ?? "",
  );
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tokenDropdownRef.current &&
        !tokenDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTokenDropdownOpen(false);
      }
    };
    if (isTokenDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTokenDropdownOpen]);

  const [remindEnabled, setRemindEnabled] = useState(true);
  const [friendVerifierEnabled, setFriendVerifierEnabled] = useState(false);
  const [verifierUsername, setVerifierUsername] = useState("");
  const [verifierEmail, setVerifierEmail] = useState("");
  const [resolvedVerifier, setResolvedVerifier] = useState<{
    address: `0x${string}`;
    username: string | null;
    email: string | null;
    hasRealEmail: boolean;
    pfpUrl: string | null;
  } | null>(null);
  const [friendSearchResults, setFriendSearchResults] = useState<
    Array<{
      address: string;
      username: string | null;
      email: string | null;
      hasRealEmail: boolean;
      pfpUrl: string | null;
    }>
  >([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);

  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  // Resolved lazily (not thrown at render time) so a missing env var surfaces as
  // a normal submit-time error instead of crashing the whole page.
  const forfeitMarketAddress = useMemo(() => {
    try {
      return getForfeitMarketAddress(chainId);
    } catch {
      return undefined;
    }
  }, [chainId]);
  const { createCommitmentAndWait, isPending: isCreating } = useCreateForfeitCommitment();
  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
  } = useTokenApproval(selectedToken, forfeitMarketAddress);
  const selectedTokenBalance = useTokenBalance(selectedToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const evidence = useMemo(
    () => EVIDENCE_TYPES.find((e) => e.id === evidenceId) ?? EVIDENCE_TYPES[0],
    [evidenceId],
  );
  const destination =
    FORFEIT_DESTINATIONS.find((d) => d.id === destinationId) ?? FORFEIT_DESTINATIONS[0];

  const additionalOptions = useMemo(
    () =>
      ADDITIONAL_OPTIONS.filter((opt) => !opt.excludeEvidence.includes(evidenceId)).filter((opt) => {
        if (shortDurationSeconds == null) return true;
        // "Remind me 1 hour before deadline" can't work for a goal whose whole
        // duration is under an hour — the reminder moment would land before
        // (or at) creation. A named friend-verifier needs to notice and act
        // inside the same short window as the creator — restrict both rather
        // than offer something that won't realistically work.
        if (opt.id === "remind") return false;
        if (opt.id === "friend-verifier") return false;
        return true;
      }),
    [evidenceId, shortDurationSeconds],
  );

  const { decimals: selectedTokenDecimals } = useTokenMetadata(selectedToken);
  const selectedTokenSymbol =
    supportedTokens.find((t) => t.address === selectedToken)?.symbol ?? "";
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();

  const verificationMethod: "friend" | "ai" = friendVerifierEnabled ? "friend" : "ai";

  // Conflict of interest: if your verifier is also who your stake goes to on a
  // miss, they're financially better off never approving your proof. Not blocked
  // outright — just surfaced, since it may be an intentional/trusted choice.
  const verifierIsDestinationFriend =
    destinationId === "friend" &&
    !!destinationFriend &&
    !!resolvedVerifier &&
    destinationFriend.address.toLowerCase() === resolvedVerifier.address.toLowerCase();

  // Resolved-but-no-real-email-on-file uses the small dedicated `verifierEmail`
  // follow-up field. Unresolved (invite) has no separate email field anymore —
  // the single search box doubles as the invite address whenever what's typed
  // there looks like an email instead of a username.
  const friendEmailValid = EMAIL_RE.test(verifierEmail.trim());
  const friendInviteEmail = resolvedVerifier ? verifierEmail.trim() : verifierUsername.trim();
  const friendVerifierReady = resolvedVerifier
    ? resolvedVerifier.hasRealEmail || friendEmailValid
    : EMAIL_RE.test(verifierUsername.trim());

  // Live search-as-you-type for an existing registered user to tag directly.
  useEffect(() => {
    if (resolvedVerifier) return;
    const query = verifierUsername.trim();
    if (query.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setFriendSearchLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (address) params.set("excludeAddress", address);
      fetch(`/api/forfeit/lookup-friend?${params}`, { signal: ctrl.signal })
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          setFriendSearchResults(json.results ?? []);
        })
        .catch((err) => {
          if (cancelled || err?.name === "AbortError") return;
          setFriendSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setFriendSearchLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [verifierUsername, resolvedVerifier, address]);

  // Live search for "forfeit to a friend" — only resolves to an existing Delulu
  // user (username or email); a raw wallet address is never a valid destination
  // pick here, since anyone can paste any address and this must stay a picker
  // over real registered accounts.
  useEffect(() => {
    if (destinationId !== "friend" || destinationFriend) return;
    const query = destinationFriendQuery.trim();
    if (query.length < 2 || ADDRESS_RE.test(query)) {
      setDestinationSearchResults([]);
      setDestinationSearchLoading(false);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setDestinationSearchLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (address) params.set("excludeAddress", address);
      fetch(`/api/forfeit/lookup-friend?${params}`, { signal: ctrl.signal })
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          setDestinationSearchResults(json.results ?? []);
        })
        .catch((err) => {
          if (cancelled || err?.name === "AbortError") return;
          setDestinationSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setDestinationSearchLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [destinationFriendQuery, destinationFriend, destinationId, address]);

  const selectDestinationFriend = (friend: {
    address: string;
    username: string | null;
    email: string | null;
    pfpUrl?: string | null;
  }) => {
    const addr = friend.address as `0x${string}`;
    setDestinationFriendAddress(addr);
    setDestinationFriend({
      address: addr,
      username: friend.username,
      email: friend.email,
      pfpUrl: friend.pfpUrl ?? null,
    });
    setDestinationFriendQuery("");
    setDestinationSearchResults([]);
  };

  const clearDestinationFriend = () => {
    setDestinationFriend(null);
    setDestinationFriendAddress("");
    setDestinationFriendQuery("");
    setDestinationSearchResults([]);
  };

  const destinationPillLabel =
    destinationId === "friend" && destinationFriend?.username
      ? `@${destinationFriend.username}`
      : destinationId === "friend" && destinationFriendAddress
        ? `${destinationFriendAddress.slice(0, 6)}…${destinationFriendAddress.slice(-4)}`
        : destination.label;

  const hasInsufficientBalance =
    isConnected && !selectedTokenBalance.isLoading
      ? parseFloat(selectedTokenBalance.formatted) < forfeitAmount
      : false;

  const minForfeitAmount =
    selectedTokenSymbol === "G$" ? MIN_FORFEIT_AMOUNT_GOODDOLLAR : 1;

  const canNext =
    description.trim().length >= 3 &&
    forfeitAmount >= minForfeitAmount &&
    !!selectedToken &&
    !hasInsufficientBalance &&
    (destinationId !== "friend" || ADDRESS_RE.test(destinationFriendAddress.trim())) &&
    (verificationMethod !== "friend" || friendVerifierReady);
  const amountLabel = `${forfeitAmount.toLocaleString()} ${selectedTokenSymbol}`;
  const placeholder = evidence.placeholder;

  // Each period's on-chain cutoff lands one full period after creation, so its
  // time-of-day matches when the form was opened — not the final deadline's
  // time-of-day (those only coincide for the last period). Once a specific
  // "submit before" time is chosen, every period lands on that clock time
  // instead, regardless of when the form was opened.
  const periodCutoffLabel = useMemo(() => {
    const schedule = scheduleFromDeadline({
      deadlineDate,
      isRepeat: true,
      repeatEvery,
      now: formStartedAtRef.current,
      cadenceByRepeat: CADENCE_BY_REPEAT,
      cutoffTime,
    });
    return new Date(schedule.firstDeadline * 1000).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }, [deadlineDate, repeatEvery, cutoffTime]);

  const openAmountSheet = () => {
    setAmountDraft(String(forfeitAmount));
    setAmountOpen(true);
  };

  const saveAmount = () => {
    const parsed = Number(amountDraft.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed < minForfeitAmount) return;
    setForfeitAmount(Math.floor(parsed));
    setAmountOpen(false);
  };

  const shortGoalMin = shortGoalUnit === "minutes" ? 5 : 1;

  // Commits a short-goal value once it clears the minimum for its unit —
  // called on every keystroke and on unit switch, so it silently no-ops
  // while the field is empty or still below minimum rather than erroring.
  const applyShortGoal = (raw: string, unit: "minutes" | "hours") => {
    const n = Number(raw);
    const min = unit === "minutes" ? 5 : 1;
    if (raw === "" || !Number.isFinite(n) || n < min) return;
    setShortDurationSeconds(unit === "minutes" ? n * 60 : n * 3600);
    setCutoffTime(null);
    setDeadlineLabel(`${n} ${unit === "minutes" ? "min" : n === 1 ? "hr" : "hrs"}`);
    // A short one-off duration implies non-repeating — and "Remind 1 hour
    // before deadline" / friend-verify are both hidden at this duration, so
    // keep their stored values from quietly claiming otherwise.
    setIsRepeat(false);
    setRemindEnabled(false);
    setFriendVerifierEnabled(false);
  };

  const [showSuccess, setShowSuccess] = useState(false);
  // Survives refresh. Once the stake lands we persist + show success immediately;
  // DB confirm runs silently in the background so users never feel money is "gone".
  const resumeStartedRef = useRef(false);

  /** Restore every field to the same defaults as a fresh visit. */
  const resetFormToDefaults = () => {
    setIsRepeat(true);
    setEvidenceId("photo");
    setDescription("");
    setDeadlineDate(endOfDay(addDays(new Date(), 6)));
    setDeadlineLabel("7 days");
    setShortDurationSeconds(null);
    setCutoffTime(null);
    setRepeatEvery("day");
    setForfeitAmount(1000);
    setAmountDraft("1000");
    setDestinationId("delulu");
    setDestinationFriendAddress("");
    setDestinationFriendQuery("");
    setDestinationFriend(null);
    setDestinationSearchResults([]);
    setDestinationSearchLoading(false);
    setSelectedToken(
      supportedTokens.find((t) => t.symbol === "G$")?.address ??
        supportedTokens[0]?.address ??
        "",
    );
    setRemindEnabled(true);
    setFriendVerifierEnabled(false);
    setVerifierUsername("");
    setVerifierEmail("");
    setResolvedVerifier(null);
    setFriendSearchResults([]);
    setFriendSearchLoading(false);
    setEvidenceOpen(false);
    setDeadlineOpen(false);
    setAmountOpen(false);
    setDestinationOpen(false);
    setSubmitError(null);
    setIsSubmitting(false);
  };

  const buildConfirmPayload = (
    txHash: `0x${string}`,
    plaintextInviteCode: `0x${string}` | undefined,
    stakeAmountWei: bigint,
    schedule: {
      firstDeadline: number;
      totalPeriods: number;
      cadence: number;
      periodSeconds: number | undefined;
    },
  ): PendingForfeitConfirm => {
    const resolvedFriendEmail =
      resolvedVerifier?.hasRealEmail && resolvedVerifier.email
        ? resolvedVerifier.email
        : friendInviteEmail || null;

    return {
      txHash,
      plaintextInviteCode,
      walletAddress: (address ?? "").toLowerCase(),
      title: description.trim().slice(0, 100) || "Forfeit",
      description: description.trim() || "Forfeit",
      evidenceType: normalizeEvidenceTypeForApi(evidenceId),
      verificationMethod,
      remindEnabled,
      verifierUsername:
        verificationMethod === "friend"
          ? (resolvedVerifier?.username ??
              (EMAIL_RE.test(verifierUsername.trim()) ? null : verifierUsername.trim())) ||
            null
          : null,
      verifierEmail: verificationMethod === "friend" ? resolvedFriendEmail : null,
      isCharityIntent: destinationId === "charity",
      destinationFriendUsername:
        destinationId === "friend"
          ? destinationFriend?.username?.trim() ||
            (EMAIL_RE.test(destinationFriendQuery.trim())
              ? null
              : destinationFriendQuery.trim().replace(/^@/, "") || null)
          : null,
      destinationFriendEmail:
        destinationId === "friend"
          ? destinationFriend?.email?.trim() ||
            (EMAIL_RE.test(destinationFriendQuery.trim())
              ? destinationFriendQuery.trim()
              : null)
          : null,
      stakeAmountWei: stakeAmountWei.toString(),
      token: (selectedToken ?? "").toLowerCase(),
      destinationType: DESTINATION_TYPE_BY_ID[destinationId],
      destinationAddr:
        destinationId === "friend"
          ? destinationFriendAddress.trim().toLowerCase()
          : null,
      firstDeadline: schedule.firstDeadline,
      totalPeriods: schedule.totalPeriods,
      cadence: schedule.cadence,
      periodSeconds: schedule.periodSeconds ?? 86_400,
      savedAt: Date.now(),
    };
  };

  /** Fire-and-forget: keep confirming until the row exists. Never blocks success UI. */
  const syncPendingInBackground = (pending: PendingForfeitConfirm) => {
    void ensurePendingForfeitConfirmed(pending).then((ok) => {
      if (ok) clearPendingForfeitConfirm();
    });
  };

  // If they refresh mid-sync: celebrate immediately (stake is already locked) and
  // finish the quiet DB save — never ask them to create again.
  useEffect(() => {
    if (!address || resumeStartedRef.current) return;
    const stored = readPendingForfeitConfirm(address);
    if (!stored) return;

    resumeStartedRef.current = true;
    resetFormToDefaults();
    setShowSuccess(true);
    syncPendingInBackground(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleSubmit = async () => {
    if (isSubmitting || isCreating || isApproving || isApprovingConfirming) return;
    // Never open a second stake while a previous one still needs indexing.
    if (address && readPendingForfeitConfirm(address)) {
      resetFormToDefaults();
      setShowSuccess(true);
      const stored = readPendingForfeitConfirm(address);
      if (stored) syncPendingInBackground(stored);
      return;
    }
    setSubmitError(null);

    try {
      if (!isConnected || !address) throw new Error("Connect your wallet first");
      if (!canNext) throw new Error("Fill in every required field before continuing");

      setIsSubmitting(true);

      if (needsApproval(forfeitAmount) && !isApprovalSuccess) {
        await approve(forfeitAmount);
      }

      let verifierInviteCodeHash: `0x${string}` | undefined;
      let plaintextInviteCode: `0x${string}` | undefined;
      if (verificationMethod === "friend" && !resolvedVerifier) {
        const invite = generateVerifierInviteCode();
        verifierInviteCodeHash = invite.hash;
        plaintextInviteCode = invite.code;
      }

      const schedule = scheduleFromDeadline({
        deadlineDate,
        isRepeat,
        repeatEvery,
        cadenceByRepeat: CADENCE_BY_REPEAT,
        shortDurationSeconds: isRepeat ? undefined : (shortDurationSeconds ?? undefined),
        cutoffTime,
      });

      const destinationAddr =
        destinationId === "friend" ? (destinationFriendAddress.trim() as `0x${string}`) : undefined;

      const stakeAmountWei = parseUnits(forfeitAmount.toString(), selectedTokenDecimals ?? 18);

      const txHash = await createCommitmentAndWait({
        token: selectedToken as `0x${string}`,
        stakeAmountWei,
        destinationType: DESTINATION_TYPE_BY_ID[destinationId],
        destinationAddr,
        cadence: schedule.cadence,
        periodSeconds: schedule.periodSeconds,
        totalPeriods: schedule.totalPeriods,
        firstDeadline: schedule.firstDeadline,
        verifier: resolvedVerifier?.address,
        verifierInviteCodeHash,
      });

      // Stake is locked — success for the user starts here. DB sync is background.
      const pending = buildConfirmPayload(
        txHash,
        plaintextInviteCode,
        stakeAmountWei,
        schedule,
      );
      writePendingForfeitConfirm(pending);
      resetFormToDefaults();
      setShowSuccess(true);
      syncPendingInBackground(pending);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create forfeit");
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isCreating || isApproving || isApprovingConfirming;

  if (!FORFEIT_CREATION_ENABLED) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
        <DeluluDetailHeader shareSlot={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Hourglass className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-lg font-black tracking-tight text-foreground">
            New forfeits are paused
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            We&apos;re making some improvements. Existing forfeits keep working as normal — check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <DeluluDetailHeader shareSlot={null} />

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-y-auto scrollbar-hide lg:max-w-2xl">
        <div className="my-6 h-auto flex-none rounded-3xl border-none bg-white dark:bg-card px-5 py-6 lg:px-8 lg:py-8">
        <p
          className="mb-5 text-lg font-black tracking-tight text-foreground sm:text-xl"
          style={CLASH}
        >
          Create a forfeit
        </p>

        {/* Sentence form */}
        <div className="space-y-4">
          <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
            {evidence.sentencePrefix}{" "}
            <PillButton onClick={() => setEvidenceOpen(true)}>
              {evidence.pillLabel}
            </PillButton>{" "}
            {evidence.sentenceSuffix}
          </p>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none ring-delulu-blue focus:border-delulu-blue focus:ring-2 focus:ring-delulu-blue/20"
            style={MANROPE}
          />
          {description.length > 0 && description.trim().length < 3 ? (
            <p className="-mt-2 text-xs text-amber-600" style={MANROPE}>
              Add a few more words so your verifier knows what to check.
            </p>
          ) : null}

          <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
            Duration{" "}
            <PillButton onClick={() => setDeadlineOpen(true)}>
              {deadlineLabel}
            </PillButton>
          </p>

          <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
            Or forfeit to{" "}
            <PillButton onClick={() => setDestinationOpen(true)}>
              {destinationPillLabel}
            </PillButton>{" "}
            <PillButton onClick={openAmountSheet}>{amountLabel}</PillButton>
          </p>
        </div>

        {/* Repeat toggle + Every pill (same pattern as Duration) — a short
            (sub-day) goal is inherently one-off, so repeating has no
            meaning here and the whole section is hidden rather than just
            defaulted off. */}
        {shortDurationSeconds == null ? (
        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground" style={MANROPE}>
                Repeat this forfeit
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground" style={MANROPE}>
                Keep proving on a schedule instead of just once
              </p>
            </div>
            <button
              type="button"
              role="checkbox"
              aria-checked={isRepeat}
              onClick={() => setIsRepeat((v) => !v)}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
                isRepeat
                  ? "border-delulu-blue bg-delulu-blue text-white"
                  : "border-border bg-background",
              )}
            >
              {isRepeat ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          </label>

          {isRepeat ? (
            <>
              <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
                Every{" "}
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-delulu-blue px-3 py-1.5 text-sm font-bold text-white shadow-sm"
                  style={MANROPE}
                >
                  day
                </span>
              </p>
              <p className="text-xs text-muted-foreground" style={MANROPE}>
                <span className="font-semibold text-foreground/80">{deadlineLabel}</span>.
                Cutoff each period: {periodCutoffLabel}.
              </p>
            </>
          ) : null}
        </div>
        ) : null}

        {additionalOptions.length > 0 ? (
          <div className="mt-6 space-y-2">
            <p
              className="px-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/40"
              style={MANROPE}
            >
              Options
            </p>
            {additionalOptions.map((opt) => {
              const checked =
                opt.id === "remind" ? remindEnabled : friendVerifierEnabled;
              const toggle =
                opt.id === "remind"
                  ? () => setRemindEnabled((v) => !v)
                  : () => setFriendVerifierEnabled((v) => !v);
              return (
                <label
                  key={opt.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm"
                >
                  <span className="text-sm font-semibold text-foreground" style={MANROPE}>
                    {opt.label}
                  </span>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={toggle}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
                      checked
                        ? "border-delulu-blue bg-delulu-blue text-white"
                        : "border-border bg-background",
                    )}
                  >
                    {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                </label>
              );
            })}

            {friendVerifierEnabled ? (
              <div className="space-y-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
                {resolvedVerifier ? (
                  <>
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-delulu-blue/40 bg-accent px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          address={resolvedVerifier.address}
                          username={resolvedVerifier.username}
                          pfpUrl={resolvedVerifier.pfpUrl}
                          size={36}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-delulu-blue" style={MANROPE}>
                            {resolvedVerifier.username
                              ? `@${resolvedVerifier.username}`
                              : `${resolvedVerifier.address.slice(0, 6)}…${resolvedVerifier.address.slice(-4)}`}
                          </p>
                        {resolvedVerifier.hasRealEmail && resolvedVerifier.email ? (
                          <p className="mt-0.5 truncate text-xs text-delulu-blue/80" style={MANROPE}>
                            {resolvedVerifier.email}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-amber-700" style={MANROPE}>
                            No email on file — add one below to invite them
                          </p>
                        )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvedVerifier(null);
                          setVerifierUsername("");
                          setVerifierEmail("");
                          setFriendSearchResults([]);
                        }}
                        className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        style={MANROPE}
                      >
                        Change
                      </button>
                    </div>

                    {!resolvedVerifier.hasRealEmail ? (
                      <label className="block">
                        <span
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          style={MANROPE}
                        >
                          Friend&apos;s email
                        </span>
                        <input
                          type="email"
                          value={verifierEmail}
                          onChange={(e) => setVerifierEmail(e.target.value)}
                          placeholder="friend@example.com"
                          className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-base font-medium text-foreground outline-none focus:border-delulu-blue focus:ring-2 focus:ring-delulu-blue/20"
                          style={MANROPE}
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground" style={MANROPE}>
                          We&apos;ll email them so they know they&apos;ve been tagged as your verifier.
                        </p>
                        {verifierEmail.trim() && !friendEmailValid ? (
                          <p className="mt-1 text-xs font-semibold text-red-500" style={MANROPE}>
                            Enter a valid email address
                          </p>
                        ) : null}
                      </label>
                    ) : (
                      <p className="text-xs text-muted-foreground" style={MANROPE}>
                        They&apos;re on Delulu — we&apos;ll notify them at {resolvedVerifier.email} when
                        you create this forfeit.
                      </p>
                    )}
                    {verifierIsDestinationFriend ? (
                      <p className="text-xs font-semibold text-amber-700" style={MANROPE}>
                        Heads up: this person also gets your stake if you miss, so there&apos;s a conflict.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground" style={MANROPE}>
                      Search for someone already on Delulu by username or email — or just type a
                      friend&apos;s email to invite them if they&apos;re not on Delulu yet. They
                      review your proof, not AI.
                    </p>
                    <label className="block">
                      <span
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        style={MANROPE}
                      >
                        Friend&apos;s username or email
                      </span>
                      <div className="relative">
                        <input
                          type="text"
                          value={verifierUsername}
                          onChange={(e) => setVerifierUsername(e.target.value)}
                          placeholder="@username or friend@email.com"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="w-full rounded-xl border border-border/60 bg-background py-2.5 pl-3.5 pr-9 text-base font-medium text-foreground outline-none focus:border-delulu-blue focus:ring-2 focus:ring-delulu-blue/20"
                          style={MANROPE}
                        />
                        {friendSearchLoading ? (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                      {friendSearchLoading ? null : friendSearchResults.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {friendSearchResults.map((result) => (
                            <button
                              key={result.address}
                              type="button"
                              onClick={() => {
                                setResolvedVerifier({
                                  address: result.address as `0x${string}`,
                                  username: result.username,
                                  email: result.email,
                                  hasRealEmail: result.hasRealEmail,
                                  pfpUrl: result.pfpUrl,
                                });
                                setVerifierUsername(result.username ?? result.email ?? "");
                                setVerifierEmail(result.hasRealEmail && result.email ? result.email : "");
                                setFriendSearchResults([]);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60"
                              style={MANROPE}
                            >
                              <UserAvatar
                                address={result.address}
                                username={result.username}
                                pfpUrl={result.pfpUrl}
                                size={32}
                              />
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {result.username
                                    ? `@${result.username}`
                                    : `${result.address.slice(0, 6)}…${result.address.slice(-4)}`}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {result.hasRealEmail && result.email
                                    ? result.email
                                    : "No email on file"}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : verifierUsername.trim().length >= 2 ? (
                        EMAIL_RE.test(verifierUsername.trim()) ? (
                          <p className="mt-1.5 text-xs text-emerald-700" style={MANROPE}>
                            No Delulu account found for this email — we&apos;ll invite{" "}
                            {verifierUsername.trim()} to sign up and verify.
                          </p>
                        ) : verifierUsername.includes("@") ? (
                          // Contains "@" but doesn't fully match EMAIL_RE yet (e.g. no
                          // dot/TLD typed) — they're mid-typing an email, not a failed
                          // username search, so don't tell them to "try their email".
                          <p className="mt-1.5 text-xs text-muted-foreground" style={MANROPE}>
                            Keep typing their email address...
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground" style={MANROPE}>
                            No match — try their email instead to invite them.
                          </p>
                        )
                      ) : null}
                    </label>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 space-y-3 text-[12px] leading-relaxed text-muted-foreground" style={MANROPE}>
          <p>
            {verificationMethod === "friend"
              ? "Your named friend reviews your proof and confirms completion — not AI."
              : "AI will verify your forfeit instantly."}
          </p>
          
        </div>

        {hasInsufficientBalance ? (
          <p className="mt-4 text-sm font-semibold text-red-500" style={MANROPE}>
            Insufficient {selectedTokenSymbol} balance
          </p>
        ) : forfeitAmount < minForfeitAmount ? (
          <p className="mt-4 text-sm font-semibold text-red-500" style={MANROPE}>
            Minimum forfeit is {minForfeitAmount.toLocaleString()} {selectedTokenSymbol}
          </p>
        ) : null}

        {submitError ? (
          <p className="mt-4 text-sm font-semibold text-red-500" style={MANROPE}>
            {submitError}
          </p>
        ) : null}


        <button
          type="button"
          disabled={isConnected && (!canNext || isBusy)}
          onClick={() => {
            if (!isConnected) {
              persistSignInRedirect("/forfeit");
              router.push(buildSignInUrl("/forfeit"));
              return;
            }
            void handleSubmit();
          }}
          className={cn(
            "mt-8 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold transition-opacity",
            !isConnected || (canNext && !isBusy)
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground opacity-60",
          )}
          style={MANROPE}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {!isConnected
            ? "Sign in"
            : isApproving || isApprovingConfirming
              ? "Approving..."
              : isCreating
                ? "Confirm in wallet..."
                : isSubmitting
                  ? "Creating..."
                  : "Create forfeit"}
        </button>
        </div>
      </div>

      <FeedbackModal
        isOpen={showSuccess}
        type="success"
        title="Forfeit created!"
        message="Your stake is locked in. Submit proof before the deadline to get it back."
        onClose={() => {
          setShowSuccess(false);
          router.push("/profile");
        }}
        actionText="Done"
      />

      {/* Evidence type sheet */}
      <ResponsiveSheet
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        title="Select evidence type"
        hideTitleVisually
      >
        <div className="px-1 pb-2 pt-1">
          <h2 className="mb-4 text-lg font-black text-foreground" style={CLASH}>
            Select evidence type
          </h2>
          <div className="max-h-[70vh] space-y-2.5 overflow-y-auto pb-4 scrollbar-hide">
            {EVIDENCE_TYPES.map((item) => (
              <SheetListRow
                key={item.id}
                icon={item.icon}
                title={item.title}
                description={item.description}
                tags={item.tags}
                selected={evidenceId === item.id}
                disabled={item.comingSoon}
                badge={item.comingSoon ? "Coming soon" : undefined}
                onClick={() => {
                  if (item.comingSoon) return;
                  setEvidenceId(item.id);
                  setEvidenceOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      </ResponsiveSheet>

      {/* Duration sheet */}
      <ResponsiveSheet
        open={deadlineOpen}
        onOpenChange={setDeadlineOpen}
        title="Set duration"
        hideTitleVisually
      >
        <div className="px-1 pb-4 pt-1">
          <h2 className="mb-3 text-center text-lg font-black text-foreground" style={CLASH}>
            Set duration
          </h2>

          <p
            className="mb-1.5 w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            style={MANROPE}
          >
            Short goal
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 focus-within:border-delulu-blue">
            <input
              type="text"
              inputMode="numeric"
              value={shortGoalValue}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, "");
                setShortGoalValue(cleaned);
                applyShortGoal(cleaned, shortGoalUnit);
              }}
              placeholder={shortGoalUnit === "minutes" ? "15" : "1"}
              className="w-full bg-transparent text-base font-bold text-foreground outline-none"
              style={MANROPE}
            />
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary p-1">
              {(["minutes", "hours"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => {
                    setShortGoalUnit(unit);
                    applyShortGoal(shortGoalValue, unit);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                    shortGoalUnit === unit
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  style={MANROPE}
                >
                  {unit === "minutes" ? "Min" : "Hr"}
                </button>
              ))}
            </div>
          </div>
          {shortGoalValue !== "" && Number(shortGoalValue) < shortGoalMin ? (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              Minimum is {shortGoalUnit === "minutes" ? "5 minutes" : "1 hour"}
            </p>
          ) : null}

          <p
            className="mb-1.5 mt-3.5 w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            style={MANROPE}
          >
            Or ends on
          </p>
          <DurationDayStrip
            value={deadlineDate}
            onChange={(date) => {
              setDeadlineDate(date);
              setDeadlineLabel(formatAnytimeLabel(date));
              if (shortDurationSeconds != null) setRemindEnabled(true);
              setShortDurationSeconds(null);
            }}
            minDate={minDeadlineDate}
            className="-mx-1 px-1"
          />

          {shortDurationSeconds == null ? (
            <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
              <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground" style={MANROPE}>
                <Clock className="h-4 w-4 text-muted-foreground" />
                Submit anytime
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {!submitAnytime ? (
                  <input
                    type="time"
                    value={
                      cutoffTime
                        ? `${String(cutoffTime.hours).padStart(2, "0")}:${String(cutoffTime.minutes).padStart(2, "0")}`
                        : ""
                    }
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      if (Number.isFinite(h) && Number.isFinite(m)) {
                        setCutoffTime({ hours: h, minutes: m });
                      }
                    }}
                    className="w-[92px] rounded-lg border border-border/60 bg-background px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-delulu-blue"
                    style={MANROPE}
                  />
                ) : null}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={submitAnytime}
                  onClick={() => setCutoffTime((v) => (v === null ? { hours: 18, minutes: 0 } : null))}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
                    submitAnytime
                      ? "border-delulu-blue bg-delulu-blue text-white"
                      : "border-border bg-background",
                  )}
                >
                  {submitAnytime ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setDeadlineOpen(false)}
            className="mt-4 w-full rounded-full bg-delulu-blue py-3 text-sm font-bold text-white"
            style={MANROPE}
          >
            Save
          </button>
        </div>
      </ResponsiveSheet>

      {/* Destination sheet */}
      <ResponsiveSheet
        open={destinationOpen}
        onOpenChange={setDestinationOpen}
        title="Forfeit to"
        hideTitleVisually
      >
        <div className="px-1 pb-4 pt-1">
          <h2 className="mb-1 text-lg font-black text-foreground" style={CLASH}>
            Forfeit to
          </h2>
          <p className="mb-4 text-xs text-muted-foreground" style={MANROPE}>
            Choose where your stake goes if you miss the goal.
          </p>
          <div className="space-y-2">
            {FORFEIT_DESTINATIONS.map((item) => (
              <SheetListRow
                key={item.id}
                title={item.title}
                description={item.description}
                selected={destinationId === item.id}
                onClick={() => {
                  setDestinationId(item.id);
                  if (item.id !== "friend") {
                    clearDestinationFriend();
                    setDestinationOpen(false);
                  }
                }}
              />
            ))}
          </div>

          {destinationId === "friend" ? (
            <div className="mt-4 space-y-3">
              {destinationFriend ? (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-delulu-blue/40 bg-accent px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar
                      address={destinationFriend.address}
                      username={destinationFriend.username}
                      pfpUrl={destinationFriend.pfpUrl}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-delulu-blue" style={MANROPE}>
                        {destinationFriend.username
                          ? `@${destinationFriend.username}`
                          : `${destinationFriend.address.slice(0, 8)}…${destinationFriend.address.slice(-4)}`}
                      </p>
                      {destinationFriend.email ? (
                        <p className="mt-0.5 truncate text-xs text-delulu-blue/80" style={MANROPE}>
                          {destinationFriend.email}
                        </p>
                      ) : (
                        <p className="mt-0.5 truncate text-xs text-delulu-blue/70" style={MANROPE}>
                          {destinationFriend.address.slice(0, 10)}…{destinationFriend.address.slice(-6)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearDestinationFriend}
                    className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    style={MANROPE}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      style={MANROPE}
                    >
                      Search by username or email
                    </span>
                    <div className="relative">
                      <input
                        type="text"
                        value={destinationFriendQuery}
                        onChange={(e) => setDestinationFriendQuery(e.target.value)}
                        placeholder="@username or friend@email.com"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full rounded-2xl border border-border/60 bg-card py-3 pl-4 pr-10 text-base font-medium text-foreground outline-none focus:border-delulu-blue focus:ring-2 focus:ring-delulu-blue/20"
                        style={MANROPE}
                      />
                      {destinationSearchLoading ? (
                        <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                    {destinationSearchLoading ? null : destinationSearchResults.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {destinationSearchResults.map((result) => (
                          <button
                            key={result.address}
                            type="button"
                            onClick={() =>
                              selectDestinationFriend({
                                address: result.address,
                                username: result.username,
                                email: result.hasRealEmail ? result.email : null,
                                pfpUrl: result.pfpUrl,
                              })
                            }
                            className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60"
                            style={MANROPE}
                          >
                            <UserAvatar
                              address={result.address}
                              username={result.username}
                              pfpUrl={result.pfpUrl}
                              size={32}
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {result.username
                                  ? `@${result.username}`
                                  : `${result.address.slice(0, 6)}…${result.address.slice(-4)}`}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {result.hasRealEmail && result.email
                                  ? result.email
                                  : `${result.address.slice(0, 8)}…${result.address.slice(-4)}`}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : destinationFriendQuery.trim().length >= 2 ? (
                      <p className="mt-1.5 text-xs text-muted-foreground" style={MANROPE}>
                        No match — they need a Delulu account to be picked as a destination.
                      </p>
                    ) : null}
                  </label>
                </>
              )}
            </div>
          ) : null}


          {destinationId === "friend" ? (
            <button
              type="button"
              onClick={() => setDestinationOpen(false)}
              disabled={
                !destinationFriendAddress || !ADDRESS_RE.test(destinationFriendAddress)
              }
              className="mt-5 w-full rounded-full bg-delulu-blue py-3 text-sm font-bold text-white disabled:opacity-50"
              style={MANROPE}
            >
              Save
            </button>
          ) : null}
        </div>
      </ResponsiveSheet>

      {/* Amount sheet */}
      <ResponsiveSheet
        open={amountOpen}
        onOpenChange={setAmountOpen}
        title="Forfeit amount"
        hideTitleVisually
      >
        <div className="px-1 pb-4 pt-1">
          <h2 className="mb-3 text-lg font-black text-foreground" style={CLASH}>
            Forfeit amount
          </h2>

          {/* Hero card — same gradient-glow treatment as the duration picker. */}
          <div className="relative overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-b from-delulu-blue-light/70 via-card to-card p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:from-delulu-blue/10 dark:via-card dark:to-card">
            <div
              className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-60 blur-2xl"
              style={{ background: "radial-gradient(circle, var(--delulu-blue) 0%, transparent 70%)" }}
              aria-hidden
            />

            <div className="relative flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={formatAmountDraft(amountDraft)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/,/g, "");
                  if (cleaned === "" || /^\d*\.?\d*$/.test(cleaned)) {
                    setAmountDraft(cleaned);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveAmount();
                  }
                }}
                className="w-full min-w-0 flex-1 bg-transparent text-3xl font-black tabular-nums text-foreground outline-none"
                style={MANROPE}
                placeholder="1,000"
              />
              <div ref={tokenDropdownRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTokenDropdownOpen((o) => !o)}
                  disabled={supportedTokens.length <= 1}
                  className={cn(
                    "flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1.5 text-sm font-bold text-foreground shadow-sm transition-colors",
                    supportedTokens.length > 1 && "hover:bg-muted",
                  )}
                  style={MANROPE}
                >
                  <TokenBadge tokenAddress={selectedToken} size="sm" showText={false} />
                  {selectedTokenSymbol}
                  {supportedTokens.length > 1 ? (
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-muted-foreground transition-transform",
                        isTokenDropdownOpen && "rotate-180",
                      )}
                    />
                  ) : null}
                </button>

                {isTokenDropdownOpen && supportedTokens.length > 1 ? (
                  <div className="absolute right-0 top-full z-10 mt-1.5 min-w-[130px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                    {supportedTokens.map((t) => (
                      <button
                        key={t.address}
                        type="button"
                        onClick={() => {
                          setSelectedToken(t.address);
                          setIsTokenDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold transition-colors",
                          selectedToken === t.address
                            ? "bg-secondary text-foreground"
                            : "text-foreground hover:bg-secondary/60",
                        )}
                        style={MANROPE}
                      >
                        <TokenBadge tokenAddress={t.address} size="sm" showText={false} />
                        {t.symbol}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {isConnected ? (
              <div className="relative mt-2 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground" style={MANROPE}>
                  {selectedTokenBalance.isLoading ? (
                    <span className="inline-block h-3 w-16 animate-pulse rounded bg-muted align-middle" />
                  ) : (
                    <>Balance: {Number(selectedTokenBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedTokenSymbol}</>
                  )}
                </span>
                {!selectedTokenBalance.isLoading && Number(selectedTokenBalance.formatted) > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAmountDraft(String(Math.floor(Number(selectedTokenBalance.formatted) || 0)))
                    }
                    className="rounded-full bg-delulu-blue/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-delulu-blue transition-colors hover:bg-delulu-blue/20"
                  >
                    Max
                  </button>
                ) : null}
              </div>
            ) : null}

            {Number(amountDraft) > 0 && Number(amountDraft) < minForfeitAmount ? (
              <p className="relative mt-1.5 text-xs font-medium text-destructive">
                Minimum forfeit is {minForfeitAmount.toLocaleString()} {selectedTokenSymbol}
              </p>
            ) : formatUsdEquivalent(Number(amountDraft), selectedToken, gDollarUsdPrice) ? (
              <p className="relative mt-1.5 text-xs font-medium text-muted-foreground" style={MANROPE}>
                ≈ ${formatUsdEquivalent(Number(amountDraft), selectedToken, gDollarUsdPrice)} USD
              </p>
            ) : null}
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {PENALTY_AMOUNT_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setForfeitAmount(amount);
                  setAmountDraft(String(amount));
                  setAmountOpen(false);
                }}
                className={cn(
                  "rounded-2xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors",
                  forfeitAmount === amount
                    ? "border-delulu-blue bg-accent text-accent-foreground"
                    : "border-border/60 bg-card text-foreground hover:bg-muted/40",
                )}
                style={MANROPE}
              >
                {amount.toLocaleString()} {selectedTokenSymbol}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={saveAmount}
            disabled={!Number.isFinite(Number(amountDraft)) || Number(amountDraft) < minForfeitAmount}
            className={cn(
              "mt-4 w-full rounded-full py-3 text-sm font-bold text-white",
              Number(amountDraft) >= minForfeitAmount
                ? "bg-delulu-blue"
                : "bg-muted text-muted-foreground",
            )}
            style={MANROPE}
          >
            Save
          </button>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
