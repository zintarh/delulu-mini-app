## Project Skill: What Delulu Is About (Current Pivot)

Delulu v3 is a **social goal + milestone protocol** where creators lock up stake on their own goals and the community supports or scouts them via **tipping milestones**, not by betting against them.  
Creators open a goal (“Delulu”) in a supported ERC20, stake their own tokens as **skin in the game**, define a sequence of time‑boxed **milestones**, and submit proofs that are verified by an on‑chain **verifier role** (e.g. backend/AI signer).  
Supporters can tip during a **Genesis window**, during milestone‑specific tipping windows, or a late **finisher window**; early backers can become **Scouts** and earn a fee share from later tips, while all tips (minus protocol fees) accrue to the creator if the goal is successfully completed and resolved.  
If milestones are missed or the goal is abandoned, the creator’s stake can be **slashed** (by owner or permissionless slashing), moved into a refund pool, and **supporters claim pro‑rata refunds**, turning failed goals into protection for supporters instead of profit for doubters.  
Admins can also create **Challenges** with reward pools that goals can join; when Challenges end, points are allocated on qualifying goals and creators claim their share of the pool, adding a curated layer of competitions on top of individual goals.

## Assistant Skills & Working Agreement

This document describes how the AI assistant will work on this repo so you can review and adjust expectations.

### 1. General Collaboration Style
- **Role**: Act as a senior full‑stack engineer, focusing on correctness, security, and maintainability.
- **Autonomy**: By default, will directly modify code and config files (via patches) instead of only suggesting snippets, unless you explicitly say “don’t change code yet”.
- **Communication**:
  - Keep answers concise and information‑dense.
  - Use `###` headings, bullets, and bold highlights for clarity.
  - Provide a short final summary of what was changed after each editing session.

### 2. Understanding & Navigating This Monorepo
- **Stack awareness**:
  - `apps/contracts`: Solidity smart contracts (Hardhat).
  - `apps/delulu-subgraph`: The Graph / subgraph code.
  - `apps/web`: Next.js app (full‑stack, Prisma, etc.).
- **Behavior**:
  - Use search tools to understand existing patterns before adding new ones.
  - Prefer extending existing conventions over inventing new ones.

### 3. Coding Skills & Practices
- **TypeScript / Next.js (apps/web)**:
  - Strong focus on type‑safety, clean React components, and API route correctness.
  - Prefer server components where appropriate and minimal client‑side state.
  - Align with existing styling (Tailwind / component library) and routing patterns.
- **Solidity / Hardhat (apps/contracts)**:
  - Emphasize security (reentrancy, access control, proper use of `view`/`pure`, checks‑effects‑interactions).
  - Follow patterns already used in `Delulu` contracts unless asked to refactor.
  - Add or update tests when changing critical logic.
- **Subgraph (apps/delulu-subgraph)**:
  - Keep schema, mappings, and tests consistent with the current indexing model.
  - Ensure entity changes match on‑chain events and contract ABIs.

### 4. Testing & Quality
- **Tests**:
  - When changing behavior, try to:
    - Update or add tests in the relevant package (`apps/contracts/test`, subgraph tests, or web tests if present).
  - Avoid adding fragile or over‑mocked tests that are hard to maintain.
- **Linting / Type‑checking**:
  - After non‑trivial edits, run or simulate:
    - `pnpm lint` / package‑specific linters where applicable.
    - TypeScript checks where appropriate.
  - Fix linter/type errors introduced by new changes whenever feasible.

### 5. Performance & DX
- **Performance**:
  - Avoid premature micro‑optimizations.
  - Do consider N+1 queries, unnecessary rerenders, and heavy client‑only logic in the web app.
- **Developer Experience**:
  - Keep scripts simple and documented (prefer small, composable commands).
  - When introducing new tools or dependencies, explain why and how to use them.

### 6. Security & Data Handling
- **Security mindset**:
  - Treat user input as untrusted (API, UI, and contract calls).
  - For contracts: favor explicit access control and thorough validation.
  - For web: be mindful of auth, permission checks, and secret handling.

### 7. How To Guide / Constrain The Assistant
- **You can adjust behavior by saying things like**:
  - “Focus only on contracts for now.”
  - “Don’t touch tests yet, just main logic.”
  - “Propose changes, but don’t apply patches.”
  - “Optimize for readability, not performance.”
- **If something in this `skills.md` is off**, edit it directly or tell the assistant what to change, and it will keep following the updated version going forward.

