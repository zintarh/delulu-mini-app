# Delulu Shares Model (Friend.tech-style) — Design & Math

This doc outlines how to change Delulu from **support/stake** to **buy/sell shares** of a user’s goal (delulu), with a bonding curve, creator fees, platform fees, and optional rewards to shareholders.

---

## 1. How “stocks” work in this context (bonding curves)

- **Bonding curve** = contract that acts as an automated market maker: it defines **price as a function of share supply**.
- No order book: you always **buy from** or **sell to** the contract at the current curve price.
- **Buy (mint):** user sends payment → contract increases supply → user receives shares. Price goes **up** as supply increases.
- **Sell (burn):** user returns shares → contract decreases supply → user receives payment. Price for the next unit goes **down**.
- Payment stays in the contract (reserve). Early buyers can profit when later buyers push the price up (they sell at a higher price).

So in our case:
- Each **delulu** (goal) has its own **share supply** and **curve**.
- “Buying shares” = paying the curve price (in your chosen token, e.g. G$) to receive **shares of that delulu**.
- “Selling shares” = returning shares to the contract and receiving token back at the current (lower) curve price.
- **Creator** = owner of the delulu; gets a **subject fee** (like Friend.tech) on each buy/sell.
- **Platform** = protocol; gets a **protocol fee** on each buy/sell.
- **Rewards to shareholders** = optional: e.g. a % of fees or of new buys distributed to current holders (see below).

---

## 2. Friend.tech-style pricing (quadratic curve)

Friend.tech uses a **sum-of-squares** formula. Price is proportional to the area under the curve **price = k²** (for integer share counts).

- **Supply** = total number of shares that exist for this subject (e.g. this delulu).
- **Cost to buy `amount` shares** when current supply is `supply`:

  Cost = (1/16000) × 1 ether × [ Σ i² for i = supply to (supply + amount - 1) ]

  Closed form for **Σ i² from a to b** (inclusive):

  - Sum of squares 1² + 2² + … + n² = n(n+1)(2n+1) / 6  
  - So Σ i² from `start` to `end` = [ end(end+1)(2*end+1) - (start-1)(start)(2*start-1) ] / 6  
  - For **buy**: start = supply + 1, end = supply + amount  
    → cost in “curve units” = ( (supply+amount)(supply+amount+1)(2(supply+amount)+1) - (supply)(supply+1)(2*supply+1) ) / 6  
  - Multiply by **1e18 / 16000** to get wei (or same ratio for an ERC20 with 18 decimals).

- **Sell**: when you sell `amount` shares, supply goes from `supply` to `supply - amount`. You receive the **sell price** for that amount:
  - Same formula but for supply **decreasing**: integrate from (supply - amount) to (supply - 1), i.e.  
    start = supply - amount, end = supply - 1  
    → sell proceeds (curve units) = ( (supply-1)(supply)(2*supply-1) - (supply-amount-1)(supply-amount)(2*(supply-amount)-1) ) / 6  
  - Multiply by 1e18/16000 for wei.

So:
- **Buy N shares at supply S:** cost = (1/16000) * 1e18 * [ sumSquare(S+1, S+N) ].
- **Sell N shares at supply S:** proceeds = (1/16000) * 1e18 * [ sumSquare(S-N, S-1) ].

The **spread** (buy cost minus sell proceeds for the same amount) is where protocol and creator fees can be taken (and/or extra reward pool).

---

## 3. Fee split (creator + platform)

Friend.tech has:
- **protocolFeePercent** → platform
- **subjectFeePercent** → subject (in our case, delulu creator)

On each **buy**:
- Total paid by user = curve cost + protocol fee + subject fee.
- Protocol and subject each get their % of the **curve cost** (or of total payment; design choice).

On each **sell**:
- Curve proceeds to user; from that (or from a separate fee), protocol and subject get their %.
- Typical: fee = percentage of curve proceeds; user receives curve minus fees.

Example (concept only):
- Buy: user pays `curveCost + (protocolFeeBps + creatorFeeBps) * curveCost`.
- Sell: user receives `curveProceeds - (protocolFeeBps + creatorFeeBps) * curveProceeds`.

So:
- **Creator (delulu owner)** gets a % of every buy and sell on their delulu.
- **Platform** gets a % of every buy and sell.
- “Owner of the delulu gets reward for being the owner” = creator fee. “Platform gets their share” = protocol fee.

---

## 4. Rewards “as more people buy” for shareholders

Two common patterns:

**A) Price appreciation only (like Friend.tech)**  
- No extra “reward” contract; holders profit by **selling later** when the curve price is higher.  
- So “rewards” = the fact that new buyers push the price up; early buyers can sell at a profit.

**B) Explicit reward distribution**  
- Reserve a % of each buy (and optionally sell) as a **reward pool** for that delulu.  
- Distribute that pool to **current shareholders** proportionally (e.g. by share count) at claim time or at resolution.  
- So “buyers get rewards as more people buy” = they hold shares and periodically (or at the end) claim a share of the accumulated fees/reward pool.

You can combine: (1) creator fee + protocol fee, and (2) an optional “reward pool” % that gets distributed to shareholders (e.g. pro-rata by shares held at resolution or at each claim epoch).

---

## 5. What to change in the Delulu contract (high level)

Current model (v3):
- **Support/stake**: users send token to “support” a delulu; `totalSupportCollected`, `totalSupporters`, `supporterAmount[deluluId][user]`, tips, milestones, resolution, claims.

Target model (shares):
- **Per-delulu state** (in addition or replacement of support state):
  - `sharesSupply[deluluId]` = total shares in circulation for this delulu.
  - `sharesBalance[deluluId][user]` = shares held by each user.
- **Bonding curve**: implement `getBuyPrice(deluluId, amount)` and `getSellPrice(deluluId, amount)` using the sum-of-squares formula and your scaling (e.g. 1e18/16000 for 18-decimal token).
- **Functions**:
  - `buyShares(deluluId, amount)`  
    - Compute curve cost for `amount` at current `sharesSupply[deluluId]`.  
    - Compute protocol fee + creator fee.  
    - Transfer from user: curve cost + fees (in the delulu’s token).  
    - Send protocol fee to platform, creator fee to delulu creator.  
    - Increase `sharesSupply[deluluId]`, increase `sharesBalance[deluluId][msg.sender]`.  
    - Emit event (e.g. SharesTraded(deluluId, user, amount, true, curveCost, protocolFee, creatorFee)).
  - `sellShares(deluluId, amount)`  
    - Require `sharesBalance[deluluId][msg.sender] >= amount`.  
    - Compute curve proceeds for `amount` at current supply.  
    - Deduct protocol + creator fee from proceeds.  
    - Decrease `sharesSupply[deluluId]`, decrease `sharesBalance[deluluId][msg.sender]`.  
    - Transfer net proceeds to user; send fees to platform and creator.  
    - Emit event.
- **Optional**: reward pool and `claimShareRewards(deluluId)` (or distribute at resolution) for shareholders.
- **Migration / coexistence**:  
  - Either **replace** support with shares (new delulus only or migration path), or  
  - **Keep** support for existing delulus and add shares as a **new product** (new contract or new mode per delulu).  

So:
- **Display**: frontend and subgraph show “shares” (supply, balance, buy/sell price, fees).  
- **Contract**: new state variables and the two functions above; optionally view functions for price and fees; events for indexing.

---

## 6. Math summary (for implementation)

- **Sum of squares**  
  `sumSquare(from, to) = to*(to+1)*(2*to+1)/6 - (from-1)*from*(2*from-1)/6`  
  (with from ≤ to; use SafeMath or checked arithmetic).

- **Buy cost (curve only)**  
  `costWei = sumSquare(supply+1, supply+amount) * 1e18 / 16000`

- **Sell proceeds (curve only)**  
  `proceedsWei = sumSquare(supply-amount, supply-1) * 1e18 / 16000`

- **Fees**  
  - On buy: `fee = costWei * (protocolFeeBps + creatorFeeBps) / 10000`; split between protocol and creator.  
  - On sell: `fee = proceedsWei * (protocolFeeBps + creatorFeeBps) / 10000`; user gets `proceedsWei - fee`.

- **ERC20**: if your token uses 18 decimals, the same 1e18/16000 scaling applies; transfer amounts in token units (18 decimals). If you use a different decimal token, replace 1e18 with 10**decimals.

---

## 7. References

- Friend.tech: bonding curve with sum-of-squares; protocol + subject fee on each trade.
- [Bonding Curves In Depth (blakeir.com)](https://blakeir.com/bonding-curves-in-depth-intuition-parametrization): power curves, Bancor, parameterization.
- [Friend.tech Smart Contract Breakdown (Medium)](https://medium.com/valixconsulting/friend-tech-smart-contract-breakdown-c5588ae3a1cf): variables, getPrice, buyShares, sellShares, fee destination.

---

## 8. Next steps

1. **Decide** migration vs new product (shares only for new delulus or new contract).
2. **Implement** in Solidity:  
   - `sumSquare(from, to)` (view),  
   - `getBuyPrice(deluluId, amount)`, `getSellPrice(deluluId, amount)`,  
   - `buyShares(deluluId, amount)`, `sellShares(deluluId, amount)` with fee split.
3. **Add** events and subgraph for shares supply, balances, trades.
4. **Optionally** add reward pool and shareholder reward distribution.
5. **Frontend**: replace “Support” with “Buy shares” and show share price, supply, and portfolio.

This gives you the math and contract shape so that users **buy shares** of a goal, the **creator and platform get their share** on each trade, and **holders get rewards** either via price appreciation or via an explicit reward distribution.
