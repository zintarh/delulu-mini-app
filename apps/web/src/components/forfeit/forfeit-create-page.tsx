"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  HeartPulse,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  Smartphone,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { DateTimePicker } from "@/components/date-time-picker";
import { DeluluDetailHeader } from "@/components/delulu-detail/delulu-detail-header";

const CLASH = { fontFamily: '"Clash Display", sans-serif' } as const;
const MANROPE = { fontFamily: "var(--font-manrope)" } as const;

const DEADLINE_PRESETS = [
  "Anytime tomorrow",
  "Tonight",
  "End of week",
  "In 3 days",
] as const;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatAnytimeLabel(date: Date) {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const tomorrow = addDays(today, 1);
  if (target.getTime() === today.getTime()) return "Anytime today";
  if (target.getTime() === tomorrow.getTime()) return "Anytime tomorrow";
  return `Anytime ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  })}`;
}

function deadlineFromPreset(preset: (typeof DEADLINE_PRESETS)[number]) {
  const today = new Date();
  switch (preset) {
    case "Tonight":
      return endOfDay(today);
    case "Anytime tomorrow":
      return endOfDay(addDays(today, 1));
    case "End of week": {
      const day = today.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      return endOfDay(addDays(today, daysUntilSunday));
    }
    case "In 3 days":
      return endOfDay(addDays(today, 3));
    default:
      return endOfDay(addDays(today, 1));
  }
}

type ForfeitMode = "once" | "repeat";

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
    description: "Submit photo evidence from your camera roll or camera.",
    icon: ImageIcon,
    sentencePrefix: "I'll send a",
    pillLabel: "photo",
    sentenceSuffix: "of",
    placeholder: "Reading for 30 minutes",
  },
  {
    id: "camera",
    title: "Camera only",
    description: "Live camera proof only — uploads from gallery are blocked.",
    icon: Camera,
    sentencePrefix: "I'll take a",
    pillLabel: "live photo",
    sentenceSuffix: "of",
    placeholder: "Finishing a 20-minute workout",
  },
  {
    id: "timelapse",
    title: "Timelapse",
    description: "Record a short timelapse of you doing the task.",
    icon: Video,
    sentencePrefix: "I'll send a",
    pillLabel: "timelapse",
    sentenceSuffix: "of",
    placeholder: "Studying for 1 hour",
  },
  {
    id: "self",
    title: "Self verify",
    description: "Honestly confirm completion yourself. Trust-based, no time limit.",
    icon: ShieldCheck,
    sentencePrefix: "I'll",
    pillLabel: "self-verify",
    sentenceSuffix: "that I did",
    placeholder: "Read for 30 minutes",
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
    description: "Verify a completed run or workout from your Strava activity.",
    icon: Activity,
    sentencePrefix: "I'll complete a",
    pillLabel: "Strava run",
    sentenceSuffix: "for",
    placeholder: "A 30-minute run",
    comingSoon: true,
  },
  {
    id: "google-health",
    title: "Google Health",
    description: "Pull step count or workout data from Google Fit / Health Connect.",
    icon: HeartPulse,
    sentencePrefix: "I'll hit my",
    pillLabel: "Google Health",
    sentenceSuffix: "goal of",
    placeholder: "8,000 steps today",
    comingSoon: true,
  },
  {
    id: "apple-health",
    title: "Apple Health",
    description: "Verify activity or health metrics from Apple Health.",
    icon: Smartphone,
    sentencePrefix: "I'll hit my",
    pillLabel: "Apple Health",
    sentenceSuffix: "goal of",
    placeholder: "30 minutes of exercise",
    comingSoon: true,
  },
];

const PENALTY_AMOUNT_PRESETS = [100, 250, 500, 1000] as const;

const FORFEIT_DESTINATIONS = [
  {
    id: "charity",
    label: "a charity",
    title: "Charity",
    description: "If you miss it, your stake is donated to a verified charity.",
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

const ADDITIONAL_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
  excludeEvidence: readonly string[];
}> = [
  {
    id: "private",
    label: "Private forfeit (only you can see it)",
    /** Evidence types where this option does not apply */
    excludeEvidence: [],
  },
  {
    id: "remind",
    label: "Remind me 1 hour before deadline",
    // Self-verify has no time pressure / deadline reminders.
    excludeEvidence: ["self"],
  },
  {
    id: "friend-verifier",
    label: "Allow friend as verifier",
    // Self-verify already is the user confirming — no third-party verifier.
    excludeEvidence: ["self"],
  },
];

const REPEAT_EVERY = ["day", "weekday", "week", "month"] as const;

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
            ? "border-delulu-blue bg-delulu-blue-light/60"
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
  const [mode, setMode] = useState<ForfeitMode>("once");
  const [evidenceId, setEvidenceId] = useState("photo");
  const [description, setDescription] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date>(() =>
    endOfDay(addDays(new Date(), 1)),
  );
  const [deadlineLabel, setDeadlineLabel] = useState<string>("Anytime tomorrow");
  const [submitAnytime, setSubmitAnytime] = useState(true);
  const minDeadlineDate = useMemo(() => startOfDay(new Date()), []);
  const [repeatEvery, setRepeatEvery] = useState<(typeof REPEAT_EVERY)[number]>("day");
  const [repeatFrom, setRepeatFrom] = useState("Tomorrow");
  const [forfeitAmount, setForfeitAmount] = useState(100);
  const [amountDraft, setAmountDraft] = useState("100");
  const [destinationId, setDestinationId] = useState<ForfeitDestinationId>("charity");

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [everyOpen, setEveryOpen] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const evidence = useMemo(
    () => EVIDENCE_TYPES.find((e) => e.id === evidenceId) ?? EVIDENCE_TYPES[0],
    [evidenceId],
  );
  const destination =
    FORFEIT_DESTINATIONS.find((d) => d.id === destinationId) ?? FORFEIT_DESTINATIONS[0];

  const additionalOptions = useMemo(
    () =>
      ADDITIONAL_OPTIONS.filter((opt) => !opt.excludeEvidence.includes(evidenceId)),
    [evidenceId],
  );

  const canNext = description.trim().length >= 3 && forfeitAmount > 0;
  const isProduction = process.env.NODE_ENV === "production";
  const nextEnabled = canNext && !isProduction;
  const amountLabel = `${forfeitAmount.toLocaleString()} G$`;
  const placeholder =
    mode === "repeat" && evidenceId === "photo"
      ? "Meditate for 10 minutes"
      : evidence.placeholder;

  const openAmountSheet = () => {
    setAmountDraft(String(forfeitAmount));
    setAmountOpen(true);
  };

  const saveAmount = () => {
    const parsed = Number(amountDraft.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setForfeitAmount(Math.floor(parsed));
    setAmountOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <DeluluDetailHeader shareSlot={null} />

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden lg:max-w-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 scrollbar-hide lg:px-8 lg:pt-8">
        {/* Once / Repeat tabs */}
        <div className="mx-auto mb-7 flex w-full max-w-xs rounded-full border border-border bg-muted p-1">
          {(
            [
              { id: "once", label: "Once" },
              { id: "repeat", label: "Repeat" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              aria-pressed={mode === tab.id}
              className={cn(
                "flex-1 rounded-full py-2.5 text-sm font-bold transition-all",
                mode === tab.id
                  ? "bg-delulu-blue text-white shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
              style={MANROPE}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
            className="w-full resize-none rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-[15px] font-medium text-foreground placeholder:text-muted-foreground/70 outline-none ring-delulu-blue focus:border-delulu-blue focus:ring-2 focus:ring-delulu-blue/20"
            style={MANROPE}
          />

          {mode === "once" ? (
            <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
              Before{" "}
              <button
                type="button"
                onClick={() => setDeadlineOpen(true)}
                className="inline-flex items-center rounded-xl bg-muted px-3 py-1.5 text-sm font-bold text-delulu-blue transition-colors hover:bg-muted/80"
                style={MANROPE}
              >
                {deadlineLabel}
              </button>
            </p>
          ) : (
            <div className="space-y-3.5">
              <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
                Before{" "}
                <PillButton onClick={() => setDeadlineOpen(true)}>midnight</PillButton>
              </p>
              <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
                Every{" "}
                <PillButton onClick={() => setEveryOpen(true)}>{repeatEvery}</PillButton>
              </p>
              <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
                From{" "}
                <PillButton onClick={() => setFromOpen(true)}>{repeatFrom}</PillButton>
              </p>
            </div>
          )}

          <p className="text-[17px] font-semibold leading-relaxed text-foreground" style={MANROPE}>
            Or forfeit to{" "}
            <PillButton onClick={() => setDestinationOpen(true)}>
              {destination.label}
            </PillButton>{" "}
            <PillButton onClick={openAmountSheet}>{amountLabel}</PillButton>
          </p>
        </div>

        {additionalOptions.length > 0 ? (
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="mt-6 flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
          >
            <span className="text-sm font-bold text-foreground" style={MANROPE}>
              Additional options
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}

        <div className="mt-6 space-y-3 text-[12px] leading-relaxed text-muted-foreground" style={MANROPE}>
          <p>
            AI will verify your forfeit instantly. It compares the description above with the
            proof you send, and approves it if it matches.
          </p>
          <p>
            If you fail to submit in time, or the forfeit is denied, your stake goes to{" "}
            {destination.label}.
          </p>
        </div>

        <button
          type="button"
          disabled={!nextEnabled}
          className={cn(
            "mt-8 w-full rounded-full py-3.5 text-sm font-bold transition-opacity",
            nextEnabled
              ? "bg-delulu-charcoal text-white hover:opacity-90"
              : "bg-muted text-muted-foreground opacity-60",
          )}
          style={MANROPE}
        >
          {isProduction ? "Coming soon" : "Next"}
        </button>
        </div>
      </div>

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

      {/* Deadline sheet */}
      <ResponsiveSheet
        open={deadlineOpen}
        onOpenChange={setDeadlineOpen}
        title="Set deadline"
        hideTitleVisually
      >
        <div className="px-1 pb-4 pt-1">
          <h2 className="mb-4 text-center text-lg font-black text-foreground" style={CLASH}>
            Set deadline
          </h2>

          {mode === "once" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {DEADLINE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const next = deadlineFromPreset(preset);
                      setDeadlineDate(next);
                      setDeadlineLabel(preset);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors",
                      deadlineLabel === preset
                        ? "border-delulu-blue bg-delulu-blue-light text-delulu-blue"
                        : "border-border/60 bg-card text-foreground hover:bg-muted/40",
                    )}
                    style={MANROPE}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  style={MANROPE}
                >
                  Or pick any date
                </p>
                <DateTimePicker
                  value={deadlineDate}
                  onChange={(date) => {
                    if (!date) return;
                    setDeadlineDate(date);
                    setDeadlineLabel(formatAnytimeLabel(date));
                  }}
                  minDate={minDeadlineDate}
                  className="max-w-none"
                />
              </div>

              <label className="mt-5 flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground" style={MANROPE}>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Submit anytime
                </span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={submitAnytime}
                  onClick={() => setSubmitAnytime((v) => !v)}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                    submitAnytime
                      ? "border-delulu-blue bg-delulu-blue text-white"
                      : "border-border bg-background",
                  )}
                >
                  {submitAnytime ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              </label>
            </>
          ) : (
            <div className="space-y-2">
              {["midnight", "9:00 PM", "noon", "end of day"].map((label) => (
                <SheetListRow
                  key={label}
                  title={label}
                  selected={deadlineLabel.toLowerCase() === label}
                  onClick={() => {
                    setDeadlineLabel(label);
                    setDeadlineOpen(false);
                  }}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setDeadlineOpen(false)}
            className="mt-5 w-full rounded-full bg-delulu-blue py-3 text-sm font-bold text-white"
            style={MANROPE}
          >
            Save
          </button>
        </div>
      </ResponsiveSheet>

      {/* Every sheet */}
      <ResponsiveSheet open={everyOpen} onOpenChange={setEveryOpen} title="Repeat every">
        <div className="space-y-2 pb-4 pt-2">
          {REPEAT_EVERY.map((item) => (
            <SheetListRow
              key={item}
              title={`Every ${item}`}
              selected={repeatEvery === item}
              onClick={() => {
                setRepeatEvery(item);
                setEveryOpen(false);
              }}
            />
          ))}
        </div>
      </ResponsiveSheet>

      {/* From sheet */}
      <ResponsiveSheet open={fromOpen} onOpenChange={setFromOpen} title="Starts from">
        <div className="space-y-2 pb-4 pt-2">
          {["Tomorrow", "Today", "Next Monday", "Next week"].map((item) => (
            <SheetListRow
              key={item}
              title={item}
              selected={repeatFrom === item}
              onClick={() => {
                setRepeatFrom(item);
                setFromOpen(false);
              }}
            />
          ))}
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
                  setDestinationOpen(false);
                }}
              />
            ))}
          </div>
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
          <h2 className="mb-1 text-lg font-black text-foreground" style={CLASH}>
            Forfeit amount
          </h2>
          <p className="mb-4 text-xs text-muted-foreground" style={MANROPE}>
            Choose how much G$ you&apos;re willing to forfeit if you miss the goal.
          </p>

          <div className="grid grid-cols-2 gap-2">
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
                  "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors",
                  forfeitAmount === amount
                    ? "border-delulu-blue bg-delulu-blue-light text-delulu-blue"
                    : "border-border/60 bg-card text-foreground hover:bg-muted/40",
                )}
                style={MANROPE}
              >
                {amount.toLocaleString()} G$
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={MANROPE}>
              Or enter any amount
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 focus-within:border-delulu-blue focus-within:ring-2 focus-within:ring-delulu-blue/20">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                value={amountDraft}
                onChange={(e) => setAmountDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveAmount();
                  }
                }}
                className="w-full bg-transparent text-base font-bold text-foreground outline-none"
                style={MANROPE}
                placeholder="100"
              />
              <span className="shrink-0 text-sm font-bold text-muted-foreground" style={MANROPE}>
                G$
              </span>
            </div>
          </label>

          <button
            type="button"
            onClick={saveAmount}
            disabled={!Number.isFinite(Number(amountDraft)) || Number(amountDraft) <= 0}
            className={cn(
              "mt-5 w-full rounded-full py-3 text-sm font-bold text-white",
              Number(amountDraft) > 0
                ? "bg-delulu-blue"
                : "bg-muted text-muted-foreground",
            )}
            style={MANROPE}
          >
            Save
          </button>
        </div>
      </ResponsiveSheet>

      {/* Additional options */}
      <ResponsiveSheet
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        title="Additional options"
        hideTitleVisually
      >
        <div className="px-1 pb-4 pt-1">
          <h2 className="mb-4 text-lg font-black text-foreground" style={CLASH}>
            Additional options
          </h2>
          <div className="space-y-2">
            {additionalOptions.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5"
              >
                <span className="text-sm font-semibold text-foreground" style={MANROPE}>
                  {opt.label}
                </span>
                <span className="h-5 w-5 shrink-0 rounded-md border border-border bg-background" />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOptionsOpen(false)}
            className="mt-5 w-full rounded-full bg-delulu-blue py-3 text-sm font-bold text-white"
            style={MANROPE}
          >
            Done
          </button>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
