import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

const SECTIONS = [
  {
    title: "What Delulu Is",
    body: "Delulu is a public accountability platform. You post a goal, stake something real behind it, share proof of your progress, and build a community of supporters who believe in you. The whole thing only works because it's open — your journey, your wins, your evidence, all visible.",
  },
  {
    title: "Your Proof Is Public — By Design",
    highlight: true,
    body: "When you submit evidence for a milestone, that proof is permanently stored on the Celo blockchain and publicly visible to every user on the platform. This is not a side effect — it's the point.",
    bullets: [
      "Anyone can tap a completed milestone and see the evidence you submitted.",
      "Verified proof is surfaced on your public profile and in campaign leaderboards.",
      "Your wins become social proof that inspires other dreamers to start their own.",
    ],
    footer: "If you're not comfortable with your proof being public, please don't submit it. Once it's on-chain, it cannot be deleted.",
  },
  {
    title: "Content You Post",
    body: "You own everything you create. By posting on Delulu, you grant us a non-exclusive, royalty-free, worldwide license to display, distribute, and promote your content on and off the platform — including using verified milestones to encourage new users.",
  },
  {
    title: "What You Cannot Post",
    bullets: [
      "Content you don't own or don't have rights to share.",
      "Fabricated or misleading evidence for a milestone.",
      "Anything illegal, harmful, or in violation of third-party rights.",
    ],
    footer: "Submitting fake proof is a serious violation. It undermines the trust of every supporter on the platform and may result in permanent suspension.",
  },
  {
    title: "On-Chain Permanence",
    body: "Transactions, milestone completions, stakes, and submitted proofs are recorded on the Celo blockchain. This data is immutable and decentralized. Delulu cannot alter or delete it, even if you close your account. Think before you post.",
  },
  {
    title: "No Guarantees",
    body: "Delulu is provided as-is. We don't guarantee specific outcomes, financial returns, or results from participating in campaigns. Cryptocurrency values fluctuate. Participation involves real risk.",
  },
  {
    title: "Changes to These Terms",
    body: "We may update these terms as the platform evolves. Continued use after changes are posted means you accept the updated terms. Big changes will be announced in our community channels.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10 pb-24">
        {/* Back */}
        <Link
          href="/sign-in"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        {/* Header */}
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground">
            <Shield className="h-6 w-6 text-background" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Terms of Service
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Last updated May 2026 · Read this. It matters.
            </p>
          </div>
        </div>

        {/* Intro callout */}
        <div className="mb-10 rounded-2xl border border-border/60 bg-secondary/40 px-5 py-5">
          <p className="text-sm leading-relaxed text-foreground">
            Delulu runs on radical transparency. Every goal you post, every milestone you verify, every
            piece of evidence you submit — it's all public, permanent, and on-chain. That's what makes
            accountability real. By using Delulu, you're agreeing to play by those rules.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((s, i) => (
            <section key={s.title}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-black text-background">
                  {i + 1}
                </span>
                <h2
                  className={`text-base font-bold tracking-tight ${
                    s.highlight ? "text-foreground" : "text-foreground"
                  }`}
                >
                  {s.title}
                </h2>
              </div>

              {s.highlight && (
                <div className="mb-4 rounded-xl border border-delulu-blue-border bg-delulu-blue-light/40 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-delulu-blue">
                    Important
                  </p>
                </div>
              )}

              {s.body && (
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              )}

              {s.bullets && (
                <ul className="mb-3 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {s.footer && (
                <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
                  {s.footer}
                </p>
              )}

              {i < SECTIONS.length - 1 && (
                <div className="mt-8 border-b border-border/40" />
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 rounded-2xl border border-border/60 bg-secondary/30 px-5 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            Questions or concerns?{" "}
            <a
              href="https://t.me/deluluapp"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:underline"
            >
              Find us on Telegram
            </a>
            .
          </p>
          <p className="mt-2 text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Delulu. Built on Celo.
          </p>
        </div>
      </div>
    </div>
  );
}
