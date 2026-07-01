# Razorpay Live Setup for Production

Complete before DNS cutover to `https://daxch.app`.

## 1. Activate live mode

- Complete Razorpay KYC if not already done
- Switch dashboard to **Live mode**

## 2. API keys

Dashboard → **Settings → API Keys** → generate live key pair.

| Secret key (terraform.production.tfvars) | Value |
|------------------------------------------|-------|
| `RAZORPAY_KEY_ID` | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Live secret from same key pair |

## 3. Subscription plans

Create three **monthly** plans matching [plan_limits.py](../backend/app/services/plan_limits.py):

| Plan | Monthly price (INR) | Env var |
|------|----------------------|---------|
| Starter | 499 | `RAZORPAY_PLAN_STARTER_ID` |
| Pro | 999 | `RAZORPAY_PLAN_PRO_ID` |
| Ultra | 2,499 | `RAZORPAY_PLAN_ULTRA_ID` |

Copy each `plan_*` ID into `terraform.production.tfvars`.

## 4. Webhook

Dashboard → **Webhooks** → Add endpoint:

| Field | Value |
|-------|-------|
| URL | `https://daxch.app/api/v1/subscriptions/webhook` |
| Secret | Copy to `RAZORPAY_WEBHOOK_SECRET` |

**Enable events:**

- `subscription.activated`
- `subscription.charged`
- `subscription.halted`
- `subscription.cancelled`
- `subscription.paused`
- `subscription.pending`
- `subscription.completed`
- `subscription.authenticated`
- `payment.captured` (AI unit top-ups)
- `payment.failed`

## 5. Push secrets to AWS

```powershell
aws login
.\scripts\restore-production-secrets.ps1
```

## 6. Smoke test (after DNS live)

1. Subscribe to Pro on https://daxch.app/subscription
2. Complete Razorpay live checkout
3. Confirm plan shows **active**
4. Razorpay webhook log shows **200** delivery
5. Test AI units top-up (optional)

## Notes

- Staging test subscriptions (`sub_*` from test mode) do **not** work with live keys
- Do not point staging webhooks at `daxch.app`
- Keep test keys in staging `terraform.tfvars` only
