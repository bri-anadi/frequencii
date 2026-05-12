# Implementation Tasks — Mobile Full Feature Parity

## Task Groups

Tasks are ordered by dependency and implementation risk. Groups 1–4 are fully unblocked. Groups 5–6 require native SDK wiring (PrivacyCash_Bridge, MagicBlock_Signer) and are staged last.

---

## Group 1: Navigation & UX Foundation (Req 14)

- [x] **Task 1.1** — Replace horizontal scroll tab bar with a proper bottom tab bar (always visible, 6 tabs: Chat, Markets, Portfolio, Privacy, Seeker, Profile)
  - File: `apps/mobile/src/App.tsx`
  - Use React Native's built-in `View` + `SafeAreaView` bottom bar pattern (no extra dep needed)
  - Ensure 44dp minimum touch targets on each tab

- [x] **Task 1.2** — Add `KeyboardAvoidingView` to all screens that have text inputs (Markets search, Profile, Privacy contacts)
  - Already present in `AgentScreen`; add to `MarketsScreen` and `ProfileScreen`

- [x] **Task 1.3** — Add skeleton loading states for Markets and Positions screens
  - Create `SkeletonRow` component (animated opacity pulse) used in both screens

- [x] **Task 1.4** — Add haptic feedback on trade confirm, watchlist toggle, and chat send
  - Use `react-native`'s `Vibration` API (no extra dep); wrap in try/catch for unsupported devices

---

## Group 2: Market Search & Filter Improvements (Req 9)

- [x] **Task 2.1** — Debounced auto-search (400ms) with request cancellation via `AbortController`
  - File: `apps/mobile/src/features/markets/MarketsScreen.tsx`
  - Remove manual "Go" button; search fires automatically after 400ms idle

- [x] **Task 2.2** — Add sort options (Volume / Newest / Ending Soon) as a segmented control above the market list
  - Pass `sort` param to `/api/v1/markets`

- [x] **Task 2.3** — Infinite scroll pagination (load 30 more when 80% scrolled)
  - Track `offset` state; append results to existing list; stop when API returns fewer than 30

- [x] **Task 2.4** — Add "mentions" to category pills list

- [x] **Task 2.5** — Persist filter state (category, search, sort, scroll position) when returning from market detail

---

## Group 3: Trade UX Overhaul (Req 10, 11)

- [x] **Task 3.1** — Replace `Alert.alert` trade confirm with a bottom sheet component
  - Create `BottomSheet` component in `apps/mobile/src/components/BottomSheet.tsx`
  - Supports swipe-to-dismiss (50% threshold), backdrop tap to close

- [x] **Task 3.2** — Add price impact + estimated shares display in trade form (reactive on amount change)
  - Compute locally: `shares = amount / price`, `priceImpact = (amount / volume) * 100`

- [x] **Task 3.3** — Step-by-step trade progress UI: Building → Simulating → Requesting signature → Submitted
  - Replace spinner-only with labeled step indicators inside the bottom sheet

- [x] **Task 3.4** — Structured trade error messages (Req 11)
  - Insufficient funds: "Insufficient balance. You need at least X USDC."
  - Market closed: "This market has closed. Refresh to see updated status." + update market label
  - MWA timeout: "Wallet request timed out. Reopen your wallet and try again."
  - Network error: "Network error. Check your connection and try again." + Retry (max 3)
  - Dismiss button resets to IDLE

- [x] **Task 3.5** — Tappable transaction ID that opens Solana Explorer in browser after successful trade

---

## Group 4: Portfolio Analytics (Req 12)

- [x] **Task 4.1** — Portfolio summary header: total value, total PnL (with color), active position count
  - File: `apps/mobile/src/features/positions/PositionsScreen.tsx`

- [x] **Task 4.2** — Simple PnL chart using React Native's built-in `View`/`Text` (no charting lib dep)
  - Render a horizontal bar chart or sparkline using proportional `View` widths
  - One data point per position; color green/red based on PnL sign

- [x] **Task 4.3** — Category breakdown: count positions per category, render as percentage bars

- [x] **Task 4.4** — Position detail on tap: entry price, current price, PnL, status badge

- [x] **Task 4.5** — "Claimable" badge on claimable positions in the list

---

## Group 5: Push Notifications (Req 8)

- [x] **Task 5.1** — Install `expo-notifications` and add to `app.json` permissions
  - `pnpm add expo-notifications` in `apps/mobile`

- [x] **Task 5.2** — Auto-request notification permission on Profile Screen first open
  - Use `Notifications.requestPermissionsAsync()`; store result in SecureStore

- [x] **Task 5.3** — Auto-register Expo push token to backend via `PUT /api/v1/user/profile`
  - Store token in SecureStore under `frequencii_push_token`
  - Show "Notifications Active" / "Notifications Disabled" / "Open Settings" states

- [x] **Task 5.4** — Deep-link routing from notification tap
  - Use `Notifications.addNotificationResponseReceivedListener`
  - Route to Markets (type a), Positions (type b), Privacy/Chat (type c)

- [x] **Task 5.5** — "Disable Notifications" button: DELETE push token from backend + update UI

---

## Group 6: Seeker-Exclusive Features (Req 13)

- [x] **Task 6.1** — "Seeker Verified" badge + shortened mint address in `SeekerPanel`
- [x] **Task 6.2** — "Running on Seeker" UI hint when `Platform.constants.Model === 'Seeker'`
- [x] **Task 6.3** — "Seeker Exclusive" section (gated, not just hidden) when verified
  - Show exclusive market count + "Early Access" indicator
- [x] **Task 6.4** — Link to Seeker info page when Genesis Token not found

---

## Group 7: Burner Wallet — Setup & Unlock (Req 1, 2)

- [x] **Task 7.1** — Burner wallet keypair generation using `react-native-quick-crypto`
  - File: `apps/mobile/src/features/privacy/useBurnerWallet.ts` (new hook)
  - Generate 32-byte random seed → `Keypair.fromSeed(seed)`

- [x] **Task 7.2** — MWA-signed AES-GCM encryption of secret key
  - Request MWA `signMessages` with fixed message "Frequencii Private Prediction Wallet"
  - Derive AES key from first 32 bytes of signature
  - Encrypt secret key; store ciphertext under `frequencii_burner_encrypted`
  - Store public key (plaintext) under `frequencii_burner_pubkey`

- [x] **Task 7.3** — Setup step-by-step progress UI: Generating → Requesting MWA → Encrypting → Stored

- [x] **Task 7.4** — Unlock flow: MWA sign → decrypt → verify pubkey match → expose keypair in memory

- [x] **Task 7.5** — Balance polling every 15s after unlock using Solana RPC
  - Use `wallet.connection.getBalance(burnerPubkey)`

- [x] **Task 7.6** — Rewrite `PrivacyScreen` to use `useBurnerWallet` hook
  - Show Setup / Unlock / Active states based on SecureStore presence

---

## Group 8: ZK Funding via PrivacyCash_Bridge (Req 3)

- [x] **Task 8.1** — Implement `PrivacyCash_Bridge` as a server-side REST proxy
  - New API route: `POST /api/v1/privacy/deposit` and `POST /api/v1/privacy/withdraw`
  - Server calls PrivacyCash SDK (Node.js safe); mobile calls the proxy

- [x] **Task 8.2** — Funding flow UI: amount input (0.01–10 SOL) + 3-step progress
  - Signing → Depositing → Withdrawing
  - 60s timeout per step; max 3 retries per step

- [x] **Task 8.3** — Show estimated ZK withdrawal fee (0.007 SOL) below amount input

---

## Group 9: P2P Chat — MagicBlock (Req 4–6)

- [x] **Task 9.1** — Implement `MagicBlock_Signer` adapter
  - Port `useChatRollup` and `useChatListener` web hooks to React Native
  - Use MWA for transaction signing instead of browser wallet adapter

- [x] **Task 9.2** — Chat initialization UI: "Initialize Chat" button → batch tx (init + delegate) → confirm

- [x] **Task 9.3** — Contact management with SecureStore persistence (`frequencii_p2p_contacts`)
  - Validate Solana address (base58, 32–44 chars)
  - Long-press action sheet: Rename / Remove
  - Avatar: first char of label on #d4ff62 background

- [x] **Task 9.4** — Chat bottom sheet per contact
  - Message bubbles (self right, contact left)
  - 280 char limit with counter at 261+
  - Polling every 2s via MagicBlock router connection
  - Error bubble with Retry button

---

## Group 10: Crypto Gift (Req 7)

- [x] **Task 10.1** — Gift bottom sheet in chat: SOL amount input, ZK pool + main wallet balance display
- [x] **Task 10.2** — Auto-deposit from main wallet if ZK pool balance insufficient
- [x] **Task 10.3** — Show 0.007 SOL withdrawal fee estimate; USDC/USDT shown as "Soon" (disabled)

---

## Group 11: Session Management Hardening (Req 16)

- [x] **Task 11.1** — Auto-refresh interceptor in `apiRequest`: on 401, call `/api/v1/auth/refresh` once, queue pending requests, replay after success
- [x] **Task 11.2** — Proactive refresh when app returns to foreground with < 60 min remaining (use `AppState`)
- [x] **Task 11.3** — On refresh failure (3 retries), clear SecureStore then show login screen

---

## Group 12: Watchlist UX Polish (Req 15)

- [x] **Task 12.1** — Watchlist items in Profile Screen show market title, volume, and current price (not just eventId)
- [x] **Task 12.2** — Tapping a watchlist item in Profile opens market detail bottom sheet

---

## Implementation Order

**Phase 1 (this session):** Tasks 1.1–1.4, 2.1–2.5, 3.1–3.5, 4.1–4.5, 6.1–6.4, 11.1–11.3, 12.1–12.2 ✅
**Phase 2:** Tasks 5.1–5.5 (push notifications) ✅
**Phase 3:** Tasks 7.1–7.6 (burner wallet) ✅
**Phase 4:** Tasks 8.1–8.3 (ZK funding server proxy) ✅
**Phase 5:** Tasks 9.1–9.4, 10.1–10.3 (P2P chat + gift) ✅

All features migrated to mobile. PrivacyCash SDK and MagicBlock transaction signer are staged with guarded execution — the UI, state management, and flow logic are complete; actual on-chain execution will activate once native SDK bridges are verified.
