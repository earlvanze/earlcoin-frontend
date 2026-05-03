# Supabase Remote Functions Inventory

Last checked: 2026-03-31
Project ref: `aeaufjjeimtkiixdmrtq`

## Verified remote functions present
- stripe-identity-session
- sync-kyc-status
- mint-vnft
- transfer-vnft
- create-checkout-session
- stripe-webhook
- process-wallet-settlement
- withdraw-custody-balance

## Downloaded into repo on 2026-03-31
These were present remotely but previously missing from source control:
- stripe-identity-session
- sync-kyc-status
- mint-vnft
- transfer-vnft

## Local hardening applied after download
- `stripe-identity-session`
  - now binds requests to authenticated caller instead of trusting arbitrary posted `user_id`
  - now returns `session_id` in addition to `client_secret`
- `mint-vnft` / `transfer-vnft`
  - now default to mainnet Algorand endpoints if env is missing
- frontend `/verification`
  - now persists `stripe_kyc_session_id` so `sync-kyc-status` can be used after redirect/return flow

## Remote-only functions still not pulled locally
These exist remotely but are not currently mirrored in this repo:
- set-kyc-status
- treasury-claim
- finalize-proposal
- finalize-expired-proposals
- fulfill-usdca-purchase

## Required secret/env families for verification/VNFT flow
Names observed in downloaded functions:
- PROJECT_URL
- PROJECT_SECRET_KEY
- STRIPE_SECRET_KEY
- VNFT_ADMIN_MNEMONIC
- ALGOD_URL
- INDEXER_URL

Do not print raw secret values in logs, chat, commits, or memory files.
