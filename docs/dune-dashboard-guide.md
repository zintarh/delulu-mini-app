# Delulu Dune Analytics Dashboard Guide

## Overview

This guide walks you through setting up a Dune dashboard that gives anyone a complete picture
of Delulu's on-chain activity — goals, staking, tipping, shares, challenges, and protocol revenue.

**Contract (Celo Mainnet):** `0x7692199630F3865160fB1Fa496961251fA15aFEa`  
**Chain in Dune:** `celo`

---

## Step 1 — Decode the Contract

Before you can write clean SQL you need Dune to decode the ABI into named tables.

1. Go to **dune.com → My Account → Contracts → Submit for decoding**
2. Fill in:
   - **Blockchain:** Celo
   - **Contract address:** `0x7692199630F3865160fB1Fa496961251fA15aFEa`
   - **Project name:** `delulu`
   - **Contract name:** `Delulu`
   - **ABI:** paste the full ABI from `apps/web/src/lib/abi/index.ts`
3. Submit. Decoding usually takes a few minutes to a few hours.

Once decoded, Dune creates these table families (all lowercase, DuneSQL):

```
celo.delulu_delulu_evt_delulucreated
celo.delulu_delulu_evt_supportstaked
celo.delulu_delulu_evt_tipexecuted
celo.delulu_delulu_evt_sharesbought
celo.delulu_delulu_evt_sharessold
celo.delulu_delulu_evt_milestoneverified
celo.delulu_delulu_evt_milestonesubmitteddetailed
celo.delulu_delulu_evt_milestonemissed
celo.delulu_delulu_evt_goalfailed
celo.delulu_delulu_evt_deluluresolved
celo.delulu_delulu_evt_challengecreated
celo.delulu_delulu_evt_delulujoinedchallenge
celo.delulu_delulu_evt_profileupdated
celo.delulu_delulu_evt_supportclaimed
celo.delulu_delulu_evt_stakerefundclaimed
```

> **Before decoding is ready** you can use `celo.logs` filtered by contract address.
> See the raw-logs fallback at the bottom of this guide.

---

## Step 2 — Dashboard Layout

Structure your dashboard into **5 sections** using Dune's text blocks as headers.

```
Section 1 — Protocol Overview       (headline KPIs)
Section 2 — Goals (Delulus)          (creation, resolution, failure rates)
Section 3 — Money Flow               (staking, tipping, shares, revenue)
Section 4 — Milestones               (submissions, verifications, misses)
Section 5 — Users & Community        (unique wallets, profiles, leaderboard)
```

---

## Step 3 — Queries to Build

Each query below maps to one or more visualizations. Create each as a **New Query** in Dune,
then drag it onto the dashboard.

---

### SECTION 1 — Protocol Overview

#### Q1: Headline KPIs (Counter widgets)

```sql
WITH
goals_created AS (
    SELECT COUNT(*) AS n
    FROM celo.delulu_delulu_evt_delulucreated
),
goals_completed AS (
    SELECT COUNT(*) AS n
    FROM celo.delulu_delulu_evt_deluluresolved
),
goals_failed AS (
    SELECT COUNT(*) AS n
    FROM celo.delulu_delulu_evt_goalfailed
),
goals_active AS (
    SELECT COUNT(*) AS n
    FROM celo.delulu_delulu_evt_delulucreated c
    WHERE NOT EXISTS (
        SELECT 1 FROM celo.delulu_delulu_evt_deluluresolved r
        WHERE r.deluluId = c.deluluId
    )
    AND NOT EXISTS (
        SELECT 1 FROM celo.delulu_delulu_evt_goalfailed f
        WHERE f.deluluId = c.deluluId
    )
),
unique_supporters AS (
    SELECT COUNT(DISTINCT supporter) AS n
    FROM celo.delulu_delulu_evt_supportstaked
),
unique_tippers AS (
    SELECT COUNT(DISTINCT data_tipper) AS n
    FROM celo.delulu_delulu_evt_tipexecuted
),
registered_users AS (
    SELECT COUNT(DISTINCT "user") AS n
    FROM celo.delulu_delulu_evt_profileupdated
)

SELECT
    gc.n  AS total_goals_created,
    gco.n AS goals_completed,
    gf.n  AS goals_failed,
    ga.n  AS active_goals,
    us.n  AS unique_supporters,
    ut.n  AS unique_tippers,
    ru.n  AS registered_users
FROM goals_created gc
CROSS JOIN goals_completed gco
CROSS JOIN goals_failed gf
CROSS JOIN goals_active ga
CROSS JOIN unique_supporters us
CROSS JOIN unique_tippers ut
CROSS JOIN registered_users ru
```

> **Visualization:** 7 Counter widgets side by side. Full setup instructions below.

---

#### Q2: Daily Activity (New goals + active wallets per day)

```sql
SELECT
    DATE_TRUNC('day', block_time)          AS day,
    COUNT(*)                               AS new_delulus,
    COUNT(DISTINCT creator)                AS unique_creators
FROM celo.delulu_delulu_evt_delulucreated
GROUP BY 1
ORDER BY 1
```

> **Visualization:** Bar chart (new_delulus) with line overlay (unique_creators). Title: "Daily New Goals & Creators".

---

#### Q3: Cumulative Growth

```sql
SELECT
    DATE_TRUNC('day', block_time)                         AS day,
    SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('day', block_time)) AS cumulative_delulus,
    SUM(COUNT(DISTINCT creator)) OVER (ORDER BY DATE_TRUNC('day', block_time)) AS cumulative_creators
FROM celo.delulu_delulu_evt_delulucreated
GROUP BY 1
ORDER BY 1
```

> **Visualization:** Area chart. Title: "Cumulative Goals & Creators Over Time".

---

### SECTION 2 — Goals (Delulus)

#### Q4: Goal Outcomes Breakdown

```sql
WITH outcomes AS (
    SELECT
        d.deluluId,
        CASE
            WHEN f.deluluId IS NOT NULL THEN 'Failed'
            WHEN r.deluluId IS NOT NULL THEN 'Resolved / Succeeded'
            ELSE 'Active'
        END AS outcome
    FROM celo.delulu_delulu_evt_delulucreated d
    LEFT JOIN celo.delulu_delulu_evt_goalfailed f USING (deluluId)
    LEFT JOIN celo.delulu_delulu_evt_deluluresolved r USING (deluluId)
)
SELECT outcome, COUNT(*) AS count
FROM outcomes
GROUP BY 1
ORDER BY 2 DESC
```

> **Visualization:** Donut chart. Title: "Goal Outcomes". Shows health of the platform at a glance.

---

#### Q5: Token Preference (G$ vs USDT)

```sql
SELECT
    CASE
        WHEN LOWER(token) = LOWER('0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A') THEN 'G$ (GoodDollar)'
        WHEN LOWER(token) = LOWER('0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e') THEN 'USDT'
        ELSE 'Other'
    END AS token_symbol,
    COUNT(*)                                          AS total_delulus,
    SUM(CAST(totalSupportCollected AS DOUBLE)) / 1e18 AS total_support_usd
FROM celo.delulu_delulu_evt_delulucreated
GROUP BY 1
ORDER BY 2 DESC
```

> **Visualization:** Two charts: (1) Bar chart by count, (2) Bar chart by total support value. Title: "Goals by Token".

---

#### Q6: Goal Size Distribution (Initial Support Buckets)

```sql
SELECT
    CASE
        WHEN CAST(initialSupport AS DOUBLE) / 1e18 < 1    THEN '< $1'
        WHEN CAST(initialSupport AS DOUBLE) / 1e18 < 5    THEN '$1 – $5'
        WHEN CAST(initialSupport AS DOUBLE) / 1e18 < 20   THEN '$5 – $20'
        WHEN CAST(initialSupport AS DOUBLE) / 1e18 < 100  THEN '$20 – $100'
        ELSE '> $100'
    END AS stake_bucket,
    COUNT(*) AS count
FROM celo.delulu_delulu_evt_delulucreated
GROUP BY 1
ORDER BY MIN(CAST(initialSupport AS DOUBLE))
```

> **Visualization:** Bar chart. Title: "Goal Size Distribution (Initial Stake)".

---

### SECTION 3 — Money Flow

#### Q7: Total Volume (Staking + Tipping + Shares)

```sql
SELECT
    'Staking'                                                        AS category,
    SUM(CAST(amount AS DOUBLE)) / 1e18                               AS volume_usd
FROM celo.delulu_delulu_evt_supportstaked

UNION ALL

SELECT
    'Tips',
    SUM(CAST(data.amount AS DOUBLE)) / 1e18
FROM celo.delulu_delulu_evt_tipexecuted

UNION ALL

SELECT
    'Share Buys',
    SUM(CAST(curveCost AS DOUBLE)) / 1e18
FROM celo.delulu_delulu_evt_sharesbought

UNION ALL

SELECT
    'Share Sells',
    SUM(CAST(curveProceeds AS DOUBLE)) / 1e18
FROM celo.delulu_delulu_evt_sharessold
```

> **Visualization:** Bar chart. Title: "Volume by Activity Type (USD equivalent)".

---

#### Q8: Protocol Revenue (Fees Collected)

```sql
SELECT
    DATE_TRUNC('week', block_time)                        AS week,
    SUM(CAST(protocolFee AS DOUBLE)) / 1e18               AS share_fees_usd
FROM celo.delulu_delulu_evt_sharesbought
GROUP BY 1

UNION ALL

SELECT
    DATE_TRUNC('week', block_time),
    SUM(CAST(protocolFee AS DOUBLE)) / 1e18
FROM celo.delulu_delulu_evt_sharessold
GROUP BY 1

ORDER BY 1
```

> **Visualization:** Bar chart grouped by week. Title: "Weekly Protocol Revenue from Shares".

---

#### Q9: Weekly Staking Volume

```sql
SELECT
    DATE_TRUNC('week', block_time)             AS week,
    COUNT(*)                                   AS stake_events,
    COUNT(DISTINCT supporter)                  AS unique_stakers,
    SUM(CAST(amount AS DOUBLE)) / 1e18         AS total_staked_usd
FROM celo.delulu_delulu_evt_supportstaked
GROUP BY 1
ORDER BY 1
```

> **Visualization:** Bar chart (total_staked_usd) with line overlay (unique_stakers). Title: "Weekly Staking Volume".

---

#### Q10: Tipping Volume & Tippers Over Time

```sql
SELECT
    DATE_TRUNC('week', block_time)                  AS week,
    COUNT(*)                                        AS tip_count,
    COUNT(DISTINCT data.tipper)                     AS unique_tippers,
    SUM(CAST(data.amount AS DOUBLE)) / 1e18         AS total_tips_usd,
    COUNT(*) FILTER (WHERE data.isScout = true)     AS scout_tips,
    COUNT(*) FILTER (WHERE data.isGenesis = true)   AS genesis_tips,
    COUNT(*) FILTER (WHERE data.isFinisher = true)  AS finisher_tips
FROM celo.delulu_delulu_evt_tipexecuted
GROUP BY 1
ORDER BY 1
```

> **Visualization:** Stacked bar (scout_tips / genesis_tips / finisher_tips) + line for unique_tippers.
> Title: "Weekly Tips by Type".

---

#### Q11: Share Market Activity (Bonding Curve)

```sql
SELECT
    DATE_TRUNC('day', block_time)               AS day,
    'Buy'                                        AS direction,
    COUNT(*)                                     AS trades,
    SUM(CAST(amount AS DOUBLE))                  AS shares_volume,
    SUM(CAST(curveCost AS DOUBLE)) / 1e18        AS usd_volume
FROM celo.delulu_delulu_evt_sharesbought
GROUP BY 1, 2

UNION ALL

SELECT
    DATE_TRUNC('day', block_time),
    'Sell',
    COUNT(*),
    SUM(CAST(amount AS DOUBLE)),
    SUM(CAST(curveProceeds AS DOUBLE)) / 1e18
FROM celo.delulu_delulu_evt_sharessold
GROUP BY 1, 2

ORDER BY 1
```

> **Visualization:** Bar chart with color by direction (Buy/Sell). Title: "Daily Share Market Trades".

---

#### Q12: Top Supporters (Leaderboard)

```sql
SELECT
    supporter                                     AS wallet,
    COUNT(DISTINCT deluluId)                      AS goals_backed,
    SUM(CAST(amount AS DOUBLE)) / 1e18            AS total_staked_usd
FROM celo.delulu_delulu_evt_supportstaked
GROUP BY 1
ORDER BY 3 DESC
LIMIT 25
```

> **Visualization:** Table. Title: "Top 25 Supporters by Total Staked".

---

### SECTION 4 — Milestones

#### Q13: Milestone Funnel

```sql
SELECT 'Submitted'  AS stage, COUNT(*) AS count FROM celo.delulu_delulu_evt_milestonesubmitteddetailed
UNION ALL
SELECT 'Verified',           COUNT(*) FROM celo.delulu_delulu_evt_milestoneverified
UNION ALL
SELECT 'Rejected',           COUNT(*) FROM celo.delulu_delulu_evt_milestonerejected
UNION ALL
SELECT 'Missed',             COUNT(*) FROM celo.delulu_delulu_evt_milestonemissed
ORDER BY CASE stage WHEN 'Submitted' THEN 1 WHEN 'Verified' THEN 2 WHEN 'Rejected' THEN 3 WHEN 'Missed' THEN 4 END
```

> **Visualization:** Bar chart. Title: "Milestone Funnel — Submitted → Verified / Rejected / Missed".
> This is one of the most important charts — it shows creator follow-through.

---

#### Q14: Milestone Verification Rate Over Time

```sql
WITH submitted AS (
    SELECT DATE_TRUNC('week', block_time) AS week, COUNT(*) AS submitted
    FROM celo.delulu_delulu_evt_milestonesubmitteddetailed
    GROUP BY 1
),
verified AS (
    SELECT DATE_TRUNC('week', block_time) AS week, COUNT(*) AS verified
    FROM celo.delulu_delulu_evt_milestoneverified
    GROUP BY 1
)
SELECT
    s.week,
    s.submitted,
    COALESCE(v.verified, 0)                                   AS verified,
    ROUND(100.0 * COALESCE(v.verified, 0) / NULLIF(s.submitted, 0), 1) AS verification_rate_pct
FROM submitted s
LEFT JOIN verified v USING (week)
ORDER BY 1
```

> **Visualization:** Bar (submitted) + line (verification_rate_pct). Title: "Weekly Milestone Verification Rate".

---

#### Q15: Points Distribution (Most Active Goals)

```sql
SELECT
    deluluId,
    SUM(CAST(pointsEarned AS DOUBLE)) AS total_points_earned,
    COUNT(*)                          AS milestones_verified
FROM celo.delulu_delulu_evt_milestoneverified
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20
```

> **Visualization:** Bar chart. Title: "Top 20 Goals by Points Earned".

---

### SECTION 5 — Users & Community

#### Q16: New User Registrations Over Time

```sql
SELECT
    DATE_TRUNC('week', block_time)   AS week,
    COUNT(DISTINCT user)             AS new_users
FROM celo.delulu_delulu_evt_profileupdated
GROUP BY 1
ORDER BY 1
```

> **Visualization:** Bar chart + cumulative area chart (use two visualizations from the same query).
> Title: "Weekly New Profile Registrations".

---

#### Q17: User Retention Cohorts (creators who come back)

```sql
WITH creator_activity AS (
    SELECT
        creator                                             AS wallet,
        DATE_TRUNC('month', MIN(block_time))                AS first_month,
        COUNT(DISTINCT DATE_TRUNC('month', block_time))     AS active_months
    FROM celo.delulu_delulu_evt_delulucreated
    GROUP BY 1
)
SELECT
    first_month,
    active_months,
    COUNT(*) AS creators
FROM creator_activity
GROUP BY 1, 2
ORDER BY 1, 2
```

> **Visualization:** Heatmap or table. Title: "Creator Cohort Retention".

---

#### Q18: Top Creators by Total Support Collected

```sql
SELECT
    creator,
    COUNT(*)                                              AS total_delulus,
    SUM(CAST(totalSupportCollected AS DOUBLE)) / 1e18    AS total_support_usd,
    SUM(CAST(totalSupporters AS DOUBLE))                 AS total_supporters
FROM celo.delulu_delulu_evt_delulucreated
GROUP BY 1
ORDER BY 3 DESC
LIMIT 25
```

> **Visualization:** Table. Title: "Top 25 Creators by Support Collected".

---

#### Q19: Challenge Participation

```sql
SELECT
    c.challengeId,
    c.poolAmount / 1e18                        AS pool_usd,
    COUNT(DISTINCT j.deluluId)                 AS delulus_joined,
    c.block_time                               AS created_at
FROM celo.delulu_delulu_evt_challengecreated c
LEFT JOIN celo.delulu_delulu_evt_delulujoinedchallenge j USING (challengeId)
GROUP BY 1, 2, 4
ORDER BY 3 DESC
```

> **Visualization:** Table with conditional formatting. Title: "Active Challenges by Participation".

---

#### Q20: Wallet Activity Heatmap (hour of day × day of week)

```sql
SELECT
    DAY_OF_WEEK(block_time)     AS day_of_week,   -- 1=Mon ... 7=Sun
    HOUR(block_time)            AS hour_utc,
    COUNT(*)                    AS transactions
FROM celo.delulu_delulu_evt_delulucreated
GROUP BY 1, 2
ORDER BY 1, 2
```

> **Visualization:** Heatmap. Title: "Goal Creation — Day/Hour Heatmap (UTC)". Shows when your users are most active.

---

## Step 4 — Sharing & Embedding

1. Open your dashboard → click the **Share** button (top right)
2. Toggle **Public** on — anyone with the link can view without a Dune account
3. Copy the link. Format: `https://dune.com/[yourhandle]/[dashboard-slug]`
4. For embedding in Notion/docs: use `https://dune.com/embeds/[dashboard-id]/[viz-id]`

To find the embed URL for a specific visualization:
- Click the three-dot menu on a visualization → **Embed** → copy the iframe src URL

---

## Step 5 — Adding Parameters (Optional but powerful)

Add a `{{wallet}}` parameter to make queries explorer-friendly so anyone can look up their own stats.

Example — Personal Stats query:

```sql
SELECT
    creator                                               AS wallet,
    COUNT(*)                                              AS goals_created,
    SUM(CAST(totalSupportCollected AS DOUBLE)) / 1e18     AS total_support_raised
FROM celo.delulu_delulu_evt_delulucreated
WHERE LOWER(creator) = LOWER('{{wallet}}')
GROUP BY 1
```

Add `{{wallet}}` as a **Text** parameter in Dune's query editor. When someone opens the dashboard
they can type any wallet address and instantly see their own activity.

---

## Fallback: Raw Logs (Before Decoding is Ready)

If the contract hasn't been decoded yet, use `celo.logs` directly:

```sql
-- Example: Count DeluluCreated events from raw logs
-- topic0 = keccak256("DeluluCreated(uint256,address,address,string,uint256,uint256,uint256,uint256,uint256)")
SELECT
    DATE_TRUNC('day', block_time) AS day,
    COUNT(*)                      AS new_delulus
FROM celo.logs
WHERE contract_address = 0x7692199630F3865160fB1Fa496961251fA15aFEa
  AND topic0 = 0x<paste_topic_hash_here>  -- get this from Celoscan event tab
GROUP BY 1
ORDER BY 1
```

To get topic hashes: go to **Celoscan** → search contract address → **Events** tab →
each event type shows its topic0 hash.

---

## Reference: All Contract Addresses

| Asset | Address | Decimals |
|---|---|---|
| Delulu Proxy | `0x7692199630F3865160fB1Fa496961251fA15aFEa` | — |
| Delulu Impl | `0xb916bBAa5b5c13FD09A1a63dCFC151f8C2544C8e` | — |
| G$ (GoodDollar) | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` | 18 |
| USDT (Celo) | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 18 |
| USDm (cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |

---

## Dashboard Priority Order (Build in this order)

1. **Q1** — Headline KPIs (most impressive for sharing)
2. **Q2** — Daily activity
3. **Q13** — Milestone funnel
4. **Q4** — Goal outcomes donut
5. **Q7** — Total volume by category
6. **Q10** — Tipping over time
7. **Q11** — Share market
8. **Q8** — Protocol revenue
9. **Q12** — Top supporters
10. **Q18** — Top creators
11. Everything else
