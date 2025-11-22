# Wallet Connection Setup ✅

Your wallet connection is now fully configured using [Wagmi](https://wagmi.sh/react/getting-started).

## What Was Configured

### 1. Multiple Wallet Connectors

Updated `apps/web/app/contexts/frame-wallet-context.tsx` to support:

- **Injected Wallet** - MetaMask, Valora, Coinbase Wallet, etc.
- **WalletConnect** - Mobile wallets via QR code
- **Farcaster MiniApp** - For when deployed inside Farcaster

### 2. Connect Wallet Component

Created `apps/web/components/connect-wallet.tsx` - A reusable button component with:
- Connect to multiple wallet options
- Display connected address
- Copy address to clipboard
- View address on Celoscan explorer
- Disconnect wallet

## How to Use

### 1. Get WalletConnect Project ID

1. Go to https://cloud.walletconnect.com
2. Sign up for a free account
3. Create a new project
4. Copy your Project ID

### 2. Set Environment Variables

Create a `.env.local` file in `apps/web/`:

```bash
# Application URL
NEXT_PUBLIC_URL=http://localhost:3000

# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Contract Addresses (update after deploying)
NEXT_PUBLIC_DELULU_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CUSD_TOKEN_ADDRESS=0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
```

### 3. Add Connect Button to Your UI

Import and use the component anywhere in your app:

```tsx
import { ConnectWallet } from "@/components/connect-wallet";

export default function MyPage() {
  return (
    <div>
      <ConnectWallet />
      {/* Your other components */}
    </div>
  );
}
```

### 4. Check Connection Status

Use Wagmi hooks to check if user is connected:

```tsx
import { useAccount } from "wagmi";

export default function MyComponent() {
  const { address, isConnected } = useAccount();
  
  if (!isConnected) {
    return <p>Please connect your wallet</p>;
  }
  
  return <p>Connected: {address}</p>;
}
```

## Supported Wallets

### Desktop/Browser
- MetaMask
- Coinbase Wallet
- Brave Wallet
- Any injected wallet

### Mobile (via WalletConnect)
- Valora (Celo's mobile wallet)
- MetaMask Mobile
- Trust Wallet
- Rainbow
- Coinbase Wallet Mobile
- And 300+ other wallets

### Farcaster
- Farcaster embedded wallet (when deployed as mini-app)

## Testing

1. **Local Development:**
   - Install MetaMask or Valora browser extension
   - Switch network to Celo Alfajores testnet
   - Click "Connect Wallet" button
   - Choose your wallet from the list

2. **Mobile Testing:**
   - Click "Connect Wallet"
   - Choose "WalletConnect"
   - Scan QR code with mobile wallet app
   - Approve connection

3. **Farcaster Testing:**
   - Deploy as mini-app to Farcaster
   - Farcaster connector will automatically handle wallet

## Network Configuration

Currently configured for:
- **Celo Mainnet** (Chain ID: 42220)
- **Celo Alfajores Testnet** (Chain ID: 44787)

You can add more chains by editing `frame-wallet-context.tsx`:

```tsx
import { celo, celoAlfajores, mainnet } from "wagmi/chains";

const config = createConfig({
  chains: [celo, celoAlfajores, mainnet], // Add more chains
  // ...
});
```

## Troubleshooting

### "Please connect your wallet" message persists
- Refresh the page
- Check that your wallet is unlocked
- Make sure you're on the correct network (Celo Alfajores)

### WalletConnect QR code doesn't work
- Verify you added `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to `.env.local`
- Make sure your Project ID is valid

### Transaction fails
- Check you have enough CELO for gas fees
- Verify you're on the correct network
- Ensure you have sufficient cUSD balance (for staking)

## Next Steps

1. ✅ Wallet connection implemented
2. ✅ Contract integration completed
3. ⏳ Deploy contract to Celo Alfajores
4. ⏳ Update contract address in config
5. ⏳ Test create delusion flow end-to-end
6. ⏳ Add connect button to your UI pages

---

*For more info, see [Wagmi Documentation](https://wagmi.sh/react/getting-started)*


