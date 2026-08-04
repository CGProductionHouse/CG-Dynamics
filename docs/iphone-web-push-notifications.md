# iPhone Web Push notifications

CG Dynamics uses standards-based Web Push as an additive transport over the
canonical `notifications` table. In-app notifications remain the fallback.

## Server configuration

Required Supabase Edge Function secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (for example `mailto:info@cgproductionhouse.com`)

Generate one P-256 VAPID key pair and keep the private key outside Git. Deploy
`web-push-config` with JWT verification enabled and redeploy `background-worker`
with its existing custom-auth/no-JWT configuration.

Migration `20260804070651_iphone_web_push_notifications.sql` adds:

- private staff/device subscriptions;
- idempotent notification delivery rows;
- own-device register/status/unsubscribe RPCs;
- a test-notification RPC;
- an insert trigger from canonical notifications into the durable worker queue;
- a five-minute server schedule for morning, midday, explicit reminder,
  approaching-due and end-of-day notifications.

The schedule respects 19:00-07:00 Africa/Johannesburg quiet hours. Task
assignment notifications already created by existing workflows automatically
use the same delivery trigger.

## Two-minute iPhone acceptance

1. On iOS 16.4 or later, open production in Safari.
2. Share > Add to Home Screen.
3. Open CG Dynamics from the Home Screen icon and sign in as Franco.
4. Open CG Assistant and tap Enable notifications.
5. Confirm the card says Active on this device, then tap Send test notification.
6. Close the app and lock the phone. Confirm the push appears on the Lock Screen.
7. Tap it and confirm `/admin/assistant` opens.
8. Repeat the test once and verify only one push appears per generated
   notification. During quiet hours, scheduled daily/reminder pushes are not
   generated; in-app notifications remain available.
