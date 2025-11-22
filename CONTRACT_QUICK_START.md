# Delulu Contract - Quick Start Guide

## 🎯 Your Questions Answered

### 1. Contract Address
**Status:** ⚠️ **ACTION REQUIRED**

You need to update the contract addresses in `/apps/web/lib/contracts/config.ts` after deployment:

```

### 2. cUSD Approval Flow
**Status:** ✅ **FULLY IMPLEMENTED**

I've implemented **BOTH** options:
- ✅ **Automatic approval before each stake** - Users approve the exact amount they want to stake
- ✅ **One-time "max approval"** - Users can click "Approve Max" for unlimited approval

The UI automatically:
- Checks if approval is needed
- Shows approval buttons only when needed
- Displays approval status
- Refetches allowance after approval

### 3. Delusion Creation Flow
**Status:** ✅ **UPDATED**

The `/create` page now includes:
- ✅ Delusion text input
- ✅ Deadline picker (min 24 hours)
- ✅ **Initial position selection** (Believe/Doubt) - **NEW!**
- ✅ Initial stake amount slider
- ✅ cUSD approval flow
- ✅ Balance checking
- ✅ Transaction status
- ✅ Auto-redirect on success

### 4. Delusion Detail Page Features
**Status:** ✅ **FULLY IMPLEMENTED**

All features implemented on `/delusion/[id]`:
- ✅ Real-time delusion details from contract
- ✅ Pool amounts (Believe vs Doubt)
- ✅ User's current stake position
- ✅ **Stake More** (Believe/Doubt)
- ✅ **Switch Position** (with penalty calculation)
- ✅ **Withdraw** (5% penalty)
- ✅ **Finalize** (creator only, after deadline)
- ✅ **Claim Rewards** (winners only)
- ✅ Transaction status for all actions
- ✅ Winner celebration UI

### 5. Real-time Updates
**Status:** ✅ **AUTO-REFRESH IMPLEMENTED**

I've implemented automatic data refresh:
- ✅ Refetches delusion data after every successful transaction
- ✅ Refetches user stake after every action
- ✅ Updates pools and counts in real-time

For even more real-time updates (optional):
- Use `watchContractEvent` for listening to events
- Add polling with `refetchInterval` in read hooks
- Implement The Graph indexer

### 6. Error Handling & Loading States
**Status:** ✅ **COMPREHENSIVE**

Full transaction feedback with 4 states:

1. **Waiting for Approval** 
   - "Please confirm in your wallet..."
   - Yellow indicator

2. **Transaction Pending**
   - "Your transaction is being confirmed..."
   - Loading spinner
   - Explorer link to track

3. **Success!**
   - Success message
   - Green checkmark
   - Explorer link

4. **Error**
   - Clear error message
   - Red indicator
   - Reason from contract

---

## 🚀 Quick Deployment Steps

### Step 1: Deploy Contract (sepolia Testnet)

```bash
cd apps/contracts

# Compile
pnpm hardhat compile

# Deploy to sepolia testnet
pnpm hardhat run scripts/deploy.ts --network sepolia

# Copy the deployed address
```

### Step 2: Update Contract Address

```typescript
// apps/web/lib/contracts/config.ts
export const CONTRACTS = {
  delulu: {
    [celosepolia.id]: "0xPasteYourAddressHere" as `0x${string}`,
  },
}
```

)

### Step 4: Test the App

```bash
cd apps/web
pnpm dev

# Open http://localhost:3000 or ngrok URL
```

### Step 5: Test Full Flow

1. **Connect Wallet** ✓
2. **Create Delusion** ✓
   - Enter text: "I will run 5k this week"
   - Set deadline: 7 days from now
   - Choose position: Believe
   - Set stake: 10 cUSD
   - Approve cUSD (if first time)
   - Create!

3. **View Delusion** ✓
   - Click on created delusion
   - See pools updating

4. **Stake More** ✓
   - Enter amount
   - Approve (if needed)
   - Stake Believe or Doubt

5. **Switch Position** ✓
   - Click "Switch to Doubt" (or vice versa)
   - Confirm transaction
   - See penalty applied

6. **Finalize** (After Deadline) ✓
   - Wait for deadline to pass
   - Creator sees "Made It!" / "Failed" buttons
   - Click to finalize

7. **Claim Rewards** ✓
   - Winners see "Claim Rewards" button
   - Click to claim
   - Receive original stake + share of losing pool

---

## 🎨 UI Features Included

### Visual Feedback
- ✅ Loading spinners during transactions
- ✅ Success animations
- ✅ Error messages with details
- ✅ Pool distribution bars
- ✅ Position badges (Believe/Doubt)
- ✅ Winner badges and celebration
- ✅ Creator badges
- ✅ Time remaining countdown

### Smart UX
- ✅ Disable buttons during transactions
- ✅ Show balance before transactions
- ✅ Warn about insufficient balance
- ✅ Show approval status
- ✅ Explorer links for all transactions
- ✅ Auto-redirect after creation
- ✅ Approval flow integrated seamlessly

---

## 📊 Contract Economics

### Fees
- **0.1%** platform fee on all stakes
- **20%** of platform fees → climate vault
- **5%** penalty on early withdrawal
- **0.5% - 10%** penalty on position switch (quadratic, time-based)

### Rewards
- Winners split the losing pool proportionally
- Formula: `userReward = userStake + (userStake / winningPool) * losingPool`
- Example: 
  - You staked 100 cUSD believing
  - Total believe pool: 1000 cUSD
  - Doubt pool: 500 cUSD
  - Delusion succeeds!
  - Your reward: 100 + (100/1000) * 500 = **150 cUSD** ✨

---

## 🔧 Customization Points

### Change Stake Amount Range
```typescript
// In /app/create/page.tsx
<Slider
  min={5}      // Change minimum
  max={500}    // Change maximum
  step={5}     // Change step
/>
```

### Change Default Deadline
```typescript
// In /app/create/page.tsx
const getDefaultDeadline = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)  // Change from 7 to your preference
  return date.toISOString().slice(0, 16)
}
```

### Add More Networks
```typescript
// In /app/contexts/frame-wallet-context.tsx
const config = createConfig({
  chains: [celo, celosepolia, yourNewChain],
  // ...
})

// In /lib/contracts/config.ts
export const CONTRACTS = {
  delulu: {
    [celo.id]: "0x...",
    [celosepolia.id]: "0x...",
    [yourNewChain.id]: "0x...",
  },
}
```

---

## 📝 Files You May Want to Customize

| File | What It Does | Customize? |
|------|-------------|------------|
| `/lib/contracts/config.ts` | Contract addresses & constants | ✅ YES - Update addresses |
| `/app/create/page.tsx` | Creation UI & flow | Maybe - Adjust stake ranges |
| `/app/delusion/[id]/page.tsx` | Detail page & interactions | Maybe - UI tweaks |
| `/components/transaction-status.tsx` | Transaction feedback | Maybe - Custom messages |
| `/lib/hooks/use-delulu-contract.ts` | Contract hooks | ❌ NO - Leave as is |
| `/lib/hooks/use-cusd-approval.ts` | Approval management | ❌ NO - Leave as is |

---

## 🆘 Common Issues & Solutions

### Issue: "Contract not deployed"
**Solution:** Update contract address in `/lib/contracts/config.ts`

### Issue: "Insufficient balance"

### Issue: "Approval not working"
**Solution:** 
- Check you have CELO for gas fees
- Wait for approval tx to confirm before staking
- The UI should handle this automatically

### Issue: "Transaction stuck"
**Solution:**
- Celo is usually fast (5-10 seconds)
- If stuck >1 min, may need to increase gas

### Issue: "Can't finalize delusion"
**Solution:**
- Only creator can finalize
- Must wait until deadline passes
- Check "Time Remaining" shows "Expired"

### Issue: "Can't claim rewards"
**Solution:**
- Only winners can claim
- Must finalize first
- Can only claim once

---

## 🎯 Testing Checklist

- [ ] Deploy contract to sepolia
- [ ] Update contract address in config
- [ ] Get CELO and cUSD from faucet
- [ ] Create a delusion (test approval flow)
- [ ] View delusion detail page
- [ ] Stake more (same position)
- [ ] Switch position (test penalty)
- [ ] Create another account, stake opposite side
- [ ] Wait for deadline (or test in contract with short deadline)
- [ ] Finalize as creator
- [ ] Claim rewards as winner
- [ ] Check transaction on Celoscan
- [ ] Test withdraw before finalization
- [ ] Test error cases (insufficient balance, etc.)

---

## 🚀 Ready for Production?

Before mainnet deployment:

- [ ] Security audit of smart contract
- [ ] Test all edge cases on testnet
- [ ] Update contract addresses for mainnet
- [ ] Test with real cUSD
- [ ] Set up monitoring/alerts
- [ ] Prepare for higher gas costs
- [ ] Have emergency pause mechanism
- [ ] Document all admin functions
- [ ] Set up proper key management

---

## 📞 Need Help?

Check these files:
1. **`INTEGRATION_SUMMARY.md`** - Complete technical overview
2. **`CONTRACT_QUICK_START.md`** - This file
3. **`FARCASTER_SETUP.md`** - Farcaster miniapp setup

**Everything is ready to go!** Just deploy the contract and update the address. 🎉

