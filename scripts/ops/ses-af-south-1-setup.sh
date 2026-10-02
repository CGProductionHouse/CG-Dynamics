#!/usr/bin/env bash
# Issue #405 — Amazon SES (af-south-1, à-la-carte, shared IPs) setup for the website-enquiry
# delivery runtime. RUN BY CA with CA's own AWS + Supabase CLI sessions. Never prints a secret.
#
#   bash scripts/ops/ses-af-south-1-setup.sh            # dry run: read-only checks + plan
#   bash scripts/ops/ses-af-south-1-setup.sh --apply    # make the changes
#
# Hard guarantees:
# - refuses to change anything unless the af-south-1 SES pricing plan is NONE (à-la-carte),
#   no dedicated IP pools exist and VDM is not enabled (no paid add-ons are ever enabled);
# - WEBSITE_ENQUIRY_EMAIL_ENABLED is never set (sending stays off; enabling is a later gate);
# - AWS secret access key and worker secret go straight from generation into Supabase secrets
#   / Vault through a 0600 temp file that is removed on exit; nothing secret is echoed;
# - every create step is idempotent (re-running converges, never duplicates);
# - no email is sent.
set -euo pipefail

REGION="af-south-1"
PROJECT_REF="ehtjfntukiwbgptqgbzy"
DOMAIN="notify.cgdynamics.co.za"
MAIL_FROM_DOMAIN="mail.notify.cgdynamics.co.za"
FROM_ADDRESS="leads@notify.cgdynamics.co.za"
FROM_HEADER="CG Dynamics Leads <leads@notify.cgdynamics.co.za>"
CONFIG_SET="cg-dynamics-events"
EVENT_DESTINATION="cg-dynamics-sns"
TOPIC_NAME="cg-dynamics-ses-events"
ENDPOINT="https://${PROJECT_REF}.supabase.co/functions/v1/website-enquiry-ses-events"
IAM_USER="cg-dynamics-ses-sender"
IAM_POLICY="cg-dynamics-ses-send-only"
VAULT_NAME="website_enquiry_worker_secret"
SUMMARY_FILE="${SUMMARY_FILE:-ses-af-south-1-setup-summary.txt}"

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1
AWS=(aws --region "$REGION")
SECRET_TMP=""
# Must never alter the script's exit status (an EXIT trap's last status becomes it).
cleanup() { if [[ -n "$SECRET_TMP" && -f "$SECRET_TMP" ]]; then rm -f "$SECRET_TMP"; fi; return 0; }
trap cleanup EXIT

say()  { printf '%s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
die()  { printf 'STOP: %s\n' "$*" >&2; exit 2; }
run()  { if (( APPLY )); then "$@"; else say "  [dry-run] would run: ${1} ${2:-} ${3:-} ..."; fi; }
secret_file() { SECRET_TMP="$(mktemp)"; chmod 600 "$SECRET_TMP"; }

for tool in aws supabase openssl; do command -v "$tool" >/dev/null || die "$tool CLI not found"; done

step "1. Identity and region"
ACCOUNT_ID="$("${AWS[@]}" sts get-caller-identity --query Account --output text)" || die "AWS CLI is not signed in"
say "  AWS account ${ACCOUNT_ID}, region ${REGION}"
OPT="$(aws account get-region-opt-status --region-name "$REGION" --query RegionOptStatus --output text 2>/dev/null || echo UNKNOWN)"
case "$OPT" in
  ENABLED|ENABLED_BY_DEFAULT) say "  af-south-1 region: ${OPT}" ;;
  *) die "af-south-1 is an opt-in region and reports '${OPT}'. Enable it (free) in AWS Account > AWS Regions, wait until ENABLED, then re-run." ;;
esac

step "2. Cost guard: à-la-carte only, shared IPs, no paid add-ons"
PLAN="$("${AWS[@]}" sesv2 get-account --query 'PricingAttributes.CurrentPlan' --output text 2>/dev/null || echo UNKNOWN)"
if [[ "$PLAN" != "NONE" ]]; then
  die "SES pricing plan in ${REGION} is '${PLAN}', not à-la-carte (NONE). New SES accounts default to Essentials.
      Open SES console > ${REGION} > Pricing plan > Cancel plan (a defaulted plan's first cancellation is immediate),
      confirm it shows no plan, then re-run. This script never changes plans itself."
fi
say "  pricing plan: NONE (à-la-carte)"
POOLS="$("${AWS[@]}" sesv2 list-dedicated-ip-pools --query 'length(DedicatedIpPools)' --output text)"
[[ "$POOLS" == "0" ]] || die "dedicated IP pools exist (${POOLS}); this lane uses shared IPs only."
VDM="$("${AWS[@]}" sesv2 get-account --query 'VdmAttributes.VdmEnabled' --output text 2>/dev/null || echo None)"
[[ "$VDM" == "ENABLED" ]] && die "Virtual Deliverability Manager is ENABLED (paid add-on); disable it or confirm with CA first."
say "  dedicated IP pools: 0; VDM: ${VDM}"
SENDING="$("${AWS[@]}" sesv2 get-account --query 'ProductionAccessEnabled' --output text)"
say "  production access currently: ${SENDING}"
SECRET_NAMES="$(supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null)" || die "cannot list Supabase secret names for ${PROJECT_REF}"
has_secret() { grep -Eq "(^|[^A-Z0-9_])${1}([^A-Z0-9_]|\$)" <<<"$SECRET_NAMES"; }
if has_secret WEBSITE_ENQUIRY_EMAIL_ENABLED; then
  die "WEBSITE_ENQUIRY_EMAIL_ENABLED exists in Supabase secrets; it must stay unset until the CA activation gate."
fi

step "2b. Credential preflight: existing IAM keys must already be stored in Supabase"
# AWS never returns an existing secret access key, so pre-existing keys without both SES credential
# secrets is an unrecoverable, incomplete state. Stop here, before any change, instead of converging.
if aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1; then
  KEYS="$(aws iam list-access-keys --user-name "$IAM_USER" --query 'length(AccessKeyMetadata)' --output text)"     || die "cannot list access keys for ${IAM_USER}"
else
  KEYS=0
fi
[[ "$KEYS" =~ ^[0-9]+$ ]] || die "unexpected access-key count for ${IAM_USER}: '${KEYS}'"
if (( KEYS > 0 )); then
  if has_secret WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID && has_secret WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY; then
    say "  ${IAM_USER} has ${KEYS} access key(s) and both SES credential secrets exist; reusing them"
  else
    die "${IAM_USER} already has ${KEYS} access key(s) but WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID and
      WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY are not both set in Supabase. AWS cannot return an existing
      secret key, so this state cannot be completed. Recovery: in IAM > Users > ${IAM_USER} > Security
      credentials, deactivate then delete the unused key(s) (confirm nothing else uses them), then re-run;
      the script creates exactly one new key and stores it straight into Supabase. Nothing was changed."
  fi
else
  say "  ${IAM_USER}: no existing access keys"
fi

step "3. Configuration set ${CONFIG_SET} (no dedicated pool, no VDM options)"
if "${AWS[@]}" sesv2 get-configuration-set --configuration-set-name "$CONFIG_SET" >/dev/null 2>&1; then
  say "  exists"
else
  run "${AWS[@]}" sesv2 create-configuration-set --configuration-set-name "$CONFIG_SET" --sending-options SendingEnabled=true
fi

step "4. Email identity ${DOMAIN} (Easy DKIM, default configuration set) + MAIL FROM ${MAIL_FROM_DOMAIN}"
if "${AWS[@]}" sesv2 get-email-identity --email-identity "$DOMAIN" >/dev/null 2>&1; then
  say "  identity exists"
else
  run "${AWS[@]}" sesv2 create-email-identity --email-identity "$DOMAIN" --configuration-set-name "$CONFIG_SET"
fi
run "${AWS[@]}" sesv2 put-email-identity-configuration-set-attributes --email-identity "$DOMAIN" --configuration-set-name "$CONFIG_SET"
run "${AWS[@]}" sesv2 put-email-identity-mail-from-attributes --email-identity "$DOMAIN" \
  --mail-from-domain "$MAIL_FROM_DOMAIN" --behavior-on-mx-failure USE_DEFAULT_VALUE

step "5. SNS topic ${TOPIC_NAME} (SignatureVersion=2) restricted to SES for this configuration set"
TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:${TOPIC_NAME}"
run "${AWS[@]}" sns create-topic --name "$TOPIC_NAME" --attributes SignatureVersion=2
run "${AWS[@]}" sns set-topic-attributes --topic-arn "$TOPIC_ARN" --attribute-name SignatureVersion --attribute-value 2
POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"SesPublishFromCgConfigurationSet\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"ses.amazonaws.com\"},\"Action\":\"sns:Publish\",\"Resource\":\"${TOPIC_ARN}\",\"Condition\":{\"StringEquals\":{\"AWS:SourceAccount\":\"${ACCOUNT_ID}\"},\"StringLike\":{\"AWS:SourceArn\":\"arn:aws:ses:${REGION}:${ACCOUNT_ID}:configuration-set/${CONFIG_SET}\"}}}]}"
run "${AWS[@]}" sns set-topic-attributes --topic-arn "$TOPIC_ARN" --attribute-name Policy --attribute-value "$POLICY"

step "6. Event destination: SEND, DELIVERY, BOUNCE, COMPLAINT, REJECT -> SNS"
DEST="{\"Enabled\":true,\"MatchingEventTypes\":[\"SEND\",\"DELIVERY\",\"BOUNCE\",\"COMPLAINT\",\"REJECT\"],\"SnsDestination\":{\"TopicArn\":\"${TOPIC_ARN}\"}}"
if "${AWS[@]}" sesv2 get-configuration-set-event-destinations --configuration-set-name "$CONFIG_SET" \
     --query "EventDestinations[?Name=='${EVENT_DESTINATION}'] | length(@)" --output text 2>/dev/null | grep -qx 1; then
  run "${AWS[@]}" sesv2 update-configuration-set-event-destination --configuration-set-name "$CONFIG_SET" \
    --event-destination-name "$EVENT_DESTINATION" --event-destination "$DEST"
else
  run "${AWS[@]}" sesv2 create-configuration-set-event-destination --configuration-set-name "$CONFIG_SET" \
    --event-destination-name "$EVENT_DESTINATION" --event-destination "$DEST"
fi

step "7. Supabase: topic ARN first (the endpoint only confirms its configured topic), then subscribe"
run supabase secrets set --project-ref "$PROJECT_REF" "WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN=${TOPIC_ARN}"
EXISTING_SUB="$("${AWS[@]}" sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
  --query "Subscriptions[?Endpoint=='${ENDPOINT}'].SubscriptionArn | [0]" --output text 2>/dev/null || echo None)"
if [[ "$EXISTING_SUB" == "None" || -z "$EXISTING_SUB" || "$EXISTING_SUB" == "PendingConfirmation" ]]; then
  # Subscribing again while PendingConfirmation makes SNS resend the SubscriptionConfirmation.
  [[ "$EXISTING_SUB" == "PendingConfirmation" ]] && say "  subscription is PendingConfirmation; requesting a new confirmation"
  if (( APPLY )); then sleep 20; fi   # let the secret reach the deployed function before SNS calls it
  run "${AWS[@]}" sns subscribe --topic-arn "$TOPIC_ARN" --protocol https --notification-endpoint "$ENDPOINT" --return-subscription-arn
else
  say "  subscription exists: ${EXISTING_SUB}"
fi

step "8. Least-privilege sender ${IAM_USER}: ses:SendEmail on this identity + configuration set + From address only"
SEND_POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"ses:SendEmail\",\"Resource\":[\"arn:aws:ses:${REGION}:${ACCOUNT_ID}:identity/${DOMAIN}\",\"arn:aws:ses:${REGION}:${ACCOUNT_ID}:configuration-set/${CONFIG_SET}\"],\"Condition\":{\"StringEquals\":{\"ses:FromAddress\":\"${FROM_ADDRESS}\"}}}]}"
if ! aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1; then
  run aws iam create-user --user-name "$IAM_USER" --tags Key=purpose,Value=cg-dynamics-website-enquiry-ses
fi
run aws iam put-user-policy --user-name "$IAM_USER" --policy-name "$IAM_POLICY" --policy-document "$SEND_POLICY"

step "9. Supabase secrets (values never printed). WEBSITE_ENQUIRY_EMAIL_ENABLED is NOT set."
if (( APPLY )); then
  secret_file
  if [[ "$KEYS" == "0" ]]; then
    # Key material goes from AWS straight into the 0600 env file; never to stdout.
    aws iam create-access-key --user-name "$IAM_USER" \
      --query '[AccessKey.AccessKeyId,AccessKey.SecretAccessKey]' --output text \
      | awk '{ printf "WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID=%s\nWEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY=%s\n", $1, $2 }' >> "$SECRET_TMP"
    say "  created one access key for ${IAM_USER}"
  else
    say "  ${IAM_USER} already has ${KEYS} access key(s), already stored in Supabase (preflight); not creating another"
  fi
  WORKER_SECRET="$(openssl rand -hex 32)"
  {
    printf 'WEBSITE_ENQUIRY_EMAIL_PROVIDER=ses\n'
    printf 'WEBSITE_ENQUIRY_EMAIL_FROM="%s"\n' "$FROM_HEADER"
    printf 'WEBSITE_ENQUIRY_SES_REGION=%s\n' "$REGION"
    printf 'WEBSITE_ENQUIRY_SES_CONFIGURATION_SET=%s\n' "$CONFIG_SET"
    printf 'WEBSITE_ENQUIRY_WORKER_SECRET=%s\n' "$WORKER_SECRET"
  } >> "$SECRET_TMP"
  supabase secrets set --project-ref "$PROJECT_REF" --env-file "$SECRET_TMP" >/dev/null
  # Same worker secret into Vault for the pg_cron schedule (read there, never stored in cron.job).
  # Two statements: update_secret returns void and create_secret returns uuid, so one CASE fails.
  printf "select vault.update_secret(id, '%s') from vault.secrets where name = '%s';\nselect vault.create_secret('%s', '%s', 'x-worker-secret for website-enquiry-delivery-worker')\n where not exists (select 1 from vault.secrets where name = '%s');\n" \
    "$WORKER_SECRET" "$VAULT_NAME" "$WORKER_SECRET" "$VAULT_NAME" "$VAULT_NAME" > "$SECRET_TMP"
  supabase db query --linked --project-ref "$PROJECT_REF" -f "$SECRET_TMP" >/dev/null \
    || die "Vault write failed (supabase db query --linked). Supabase secrets are set; re-run --apply to write a fresh worker secret to both."
  unset WORKER_SECRET
  rm -f "$SECRET_TMP"; SECRET_TMP=""
  say "  secrets set: PROVIDER, FROM, SES_REGION, SES_CONFIGURATION_SET, WORKER_SECRET (+Vault), SES keys as above"
else
  say "  [dry-run] would set PROVIDER=ses, FROM, SES_REGION, SES_CONFIGURATION_SET, a new WORKER_SECRET (+Vault)"
  say "  [dry-run] would create an access key for ${IAM_USER} only if it has none (currently ${KEYS})"
fi

step "10. SES production access request (TRANSACTIONAL)"
if [[ "$SENDING" == "True" ]]; then
  say "  already enabled"
elif [[ "${REQUEST_PRODUCTION_ACCESS:-}" == "yes" ]]; then
  run "${AWS[@]}" sesv2 put-account-details --production-access-enabled --mail-type TRANSACTIONAL \
    --website-url "https://www.cgproductionhouse.com" --contact-language EN \
    --use-case-description "CG Production House builds and hosts small-business websites. When a visitor submits a website's contact form, CG Dynamics stores the enquiry and sends ONE transactional notification to that business's own pre-approved inbox, with the visitor as Reply-To. No marketing, newsletters or lists; recipients are our clients who requested these notifications. Bounces and complaints are consumed via SES event publishing (SNS) into our delivery records and suppress further sends. Expected volume: low hundreds per month initially."
else
  say "  not requested (set REQUEST_PRODUCTION_ACCESS=yes to submit the prepared TRANSACTIONAL use case)"
fi

step "11. DNS records to add at the cgdynamics.co.za DNS host (Afrihost)"
TOKENS="$("${AWS[@]}" sesv2 get-email-identity --email-identity "$DOMAIN" --query 'DkimAttributes.Tokens' --output text 2>/dev/null || true)"
ZONE="$("${AWS[@]}" sesv2 get-email-identity --email-identity "$DOMAIN" --query 'DkimAttributes.SigningHostedZone' --output text 2>/dev/null || true)"
{
  say "# SES setup summary (no secrets) — ${DOMAIN} / ${REGION} / account ${ACCOUNT_ID}"
  say "topic_arn=${TOPIC_ARN}"
  say "configuration_set=${CONFIG_SET}"
  if [[ -n "$TOKENS" && "$TOKENS" != "None" && -n "$ZONE" && "$ZONE" != "None" ]]; then
    for token in $TOKENS; do say "CNAME ${token}._domainkey.${DOMAIN}  ->  ${token}.${ZONE}"; done
  else
    say "CNAME (DKIM tokens appear after --apply creates the identity)"
  fi
  say "MX    ${MAIL_FROM_DOMAIN}  ->  10 feedback-smtp.${REGION}.amazonses.com"
  say "TXT   ${MAIL_FROM_DOMAIN}  ->  \"v=spf1 include:amazonses.com ~all\""
} | tee "$SUMMARY_FILE"
say ""
say "Done ($( (( APPLY )) && echo applied || echo dry-run )). Sending remains DISABLED. Share ${SUMMARY_FILE} (no secrets) on #405."
