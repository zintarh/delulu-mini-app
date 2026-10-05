# Delulu redesign — design reference

Source of truth for the `feat/redesign` port. Each file in `screens/` is one artboard
exported from the design canvas (https://claude.ai/artifact/7NhbN53HL7zSQwzoXecKi8).
They are design-component HTML (they expect the canvas runtime), so read them for
markup, copy, tokens and spacing rather than opening them directly.

| Artboard | App route | Notes |
|---|---|---|
| `Main.dc.html` | `/` (guests) | Marketing landing |
| `Logo.dc.html` | — | Lulu mascot + Fredoka wordmark (option 1 is the chosen logo) |
| `Install.dc.html` | install sheet | PWA install, iPhone / Android |
| `SignIn.dc.html` | `/sign-in` | |
| `Welcome.dc.html` | `/welcome` | Single-step profile setup |
| `Home.dc.html` | `/home` | Verified user |
| `HomeNew.dc.html` | `/home` | Not-verified user (verify & claim card) |
| `CreateForfeit.dc.html` | `/forfeit` | New contract (money stake) |
| `CreateRep.dc.html` | `/forfeit` | New contract (stake your word) — Phase 5 |
| `ForfeitDetail.dc.html` | `/forfeit/[id]` | Quest path |
| `Proof.dc.html` | proof modal | Capture → AI check → celebration |
| `ProofNew.dc.html` | proof modal | Celebration, not verified (100 vs 1,000 pts) |
| `PayUp.dc.html` | — | Missed day, word stake — Phase 5 |
| `Campaigns.dc.html` | `/explore` | |
| `CampaignDetail.dc.html` | `/campaigns/[id]` | |
| `Leaderboard.dc.html` | `/leaderboard` | Weekly league + Global tabs |
| `Rewards.dc.html` | `/rewards` | Verified |
| `RewardsNew.dc.html` | `/rewards` | Not verified (locked rewards) |
| `Verify.dc.html` | verify sheet | Face check explainer |
| `Profile.dc.html` | `/profile` | Level ring, stats, badges |
| `FlexCard.dc.html` | `/profile/flex` | Shareable streak card |
| `Notifications.dc.html` | `/notifications` | |
| `Settings.dc.html` | `/settings` | |

## Design system
- **Fonts:** Big Shoulders Display (display + numbers), Schibsted Grotesk (body),
  IBM Plex Mono (labels), Fredoka (wordmark only).
- **Colors:** ink `#161615`, paper `#F7F7F4`, card `#FFFFFF`, line `#E6E6E0`,
  muted `#5C5C56`, yellow `#F6C324` (edge `#C99A0A`, soft `#FDF1C7`),
  green `#1F9A5B` / `#2DB36F` (edge `#157041`), orange `#B4410C`,
  blue `#2F6BE0` (edge `#1F4FB0`, soft `#EEF4FF`), pink `#C23E6E`.
- **Pressable surfaces:** 2px border + solid bottom edge (`box-shadow: 0 4px 0 <edge>`),
  pressing moves the element down by the edge height.
- **Copy rules:** marketing says "money", not "G$"; AI checks every proof and a friend
  is always optional; say "points", not "XP".
