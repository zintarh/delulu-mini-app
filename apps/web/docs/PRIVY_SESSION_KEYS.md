# Privy Session Keys – Implementation Guide

This guide summarizes **Privy’s session keys (signers)** so your app can execute transactions on behalf of users without requiring a signature every time. It is based on the official Privy docs.

## Why session keys?

- **Problem:** Users sign every transaction (stake, add milestone, etc.).
- **Solution:** Users approve a **session signer** once; your server (or a delegated client) can then send transactions for that wallet within the allowed scope, without the user signing again each time.

## High-level flow

1. **Dashboard:** Enable server-side access and create an app **authorization key** (key quorum). Store the private key on your server.
2. **Client (one-time):** After login, call `addSigners` so the user **grants** your app permission to act on their embedded wallet. The user signs **once**.
3. **Server:** For actions that should not prompt the user again, your backend uses the Privy API (with the app’s authorization key and the user’s session/JWT) to sign and send transactions from that wallet.

---

## 1. Create an app authorization key

Create a P-256 keypair (Privy uses it to verify that requests come from your server):

```bash
openssl ecparam -name prime256v1 -genkey -noout -out private.pem && \
openssl ec -in private.pem -pubout -out public.pem
```

- Store `private.pem` securely (e.g. secrets manager). **Privy does not store it and cannot recover it.**
- You will register the **public** key with Privy in the next step.

## 2. Enable signers and register the key in the Privy Dashboard

1. Open [Privy Dashboard](https://dashboard.privy.io) → your app.
2. **Enable server-side access**  
   - Go to **User management → Authentication → Advanced**.  
   - Turn on **Server-side access** (signers).
3. **(Recommended)** Turn on **Require signed requests** and copy the **Signing key** (or use your own key from step 1 and register it).
4. **Register your public key as a key quorum**  
   - Go to **Wallet infrastructure → Authorization keys** (or [Authorization keys](https://dashboard.privy.io/apps?authorization-keys)).  
   - Click **New key** → **Register key quorum instead**.  
   - Paste the **public key** from step 1 (SPKI format).  
   - Set **Authorization threshold** to 1.  
   - Save and copy the **key quorum ID** (`signerId`). You will use this in the client and in env vars.

## 3. Configure embedded wallets (if not already)

For session signers, the wallet you add the signer to is the user’s **embedded** wallet. Ensure embedded wallets are created for the users you want to support:

- In **PrivyProvider** config, set:
  - `embeddedWallets.ethereum.createOnLogin: 'all-users'`  
  so every user gets an embedded wallet (required for adding a signer).

Example:

```tsx
<PrivyProvider
  config={{
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'all-users',  // or 'users-without-wallets' if you only delegate for those
      },
    },
  }}
>
```

## 4. Client: add signer once after login

After the user logs in and has an embedded wallet, call `addSigners` so they **grant** your app permission (one signature).

- Use the **embedded wallet address** (not the connected/linked wallet address).
- Use the **key quorum ID** from step 2 as `signerId`.

Example (React):

```tsx
import { usePrivy, useSigners } from '@privy-io/react-auth';

const { user } = usePrivy();
const { addSigners } = useSigners();

// Embedded wallet address (Privy embedded wallet)
const embeddedWallet = user?.linkedAccounts?.find(
  (a) => a.type === 'wallet' && a.walletClientType === 'privy'
);
const address = embeddedWallet?.address;

if (address && signerKeyQuorumId) {
  await addSigners({
    address,
    signers: [{
      signerId: signerKeyQuorumId,  // from Dashboard / env
      policyIds: [],                 // or policy IDs to restrict what the signer can do
    }],
  });
}
```

- **Optional:** Restrict what the signer can do by creating **policies** in the Dashboard (Wallet infrastructure → Policies) and passing their IDs in `policyIds`.

## 5. Server: send transactions without user signature

Once the signer is added and the user has delegated:

- Your server uses the **private key** from step 1 to sign requests to the Privy API.
- Your server obtains a **session** for the user (e.g. via `/v1/wallets/authenticate` with the user’s JWT) and then calls the wallet APIs (e.g. **eth_sendTransaction**) so that transactions are signed in Privy’s enclave, not on the user’s device.

**Node.js (recommended):**

- Initialize the Privy client with the **authorization private key** (from step 1):

```ts
const privy = new PrivyClient(APP_ID, APP_SECRET, {
  walletApi: {
    authorizationPrivateKey: process.env.PRIVY_SIGNER_PRIVATE_KEY,
  },
});
```

- Use the Privy Node SDK to send transactions for a user’s wallet (see [Send transactions – NodeJS](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction#nodejs)).

**REST API (advanced):**

- Sign each request with your authorization key and send the signature in the `privy-authorization-signature` header. See [Sign requests](https://docs.privy.io/controls/authorization-keys/using-owners/sign).

## 6. Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `PRIVY_SIGNER_PRIVATE_KEY` | Server only | Private key from step 1 (PEM or equivalent). Never expose to the client. |
| `NEXT_PUBLIC_PRIVY_SIGNER_KEY_QUORUM_ID` | Client | Key quorum ID from step 2. Used in `addSigners({ signers: [{ signerId }] })`. |

## 7. References (Privy docs)

- [Enabling users or servers to execute transactions](https://docs.privy.io/recipes/wallets/user-and-server-signers)
- [Signers overview](https://docs.privy.io/wallets/using-wallets/signers/overview)
- [Add signers (React)](https://docs.privy.io/wallets/using-wallets/signers/add-signers)
- [Configure signers](https://docs.privy.io/wallets/using-wallets/signers/configure-signers)
- [Authenticate (session key API)](https://docs.privy.io/api-reference/wallets/authenticate)
- [Enabling server-side access to user wallets](https://docs.privy.io/recipes/wallets/session-signer-use-cases/server-side-access)
