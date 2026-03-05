#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Setup Google Cloud Scheduler for Pivot heartbeat cron
# Run once after deploying to production.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Firebase project linked (gcloud config set project <PROJECT_ID>)
#   - Cloud Scheduler API enabled
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-pivot-bi}"
REGION="${GCP_REGION:-us-central1}"
APP_URL="${APP_URL:-https://pivot-bi.web.app}"
CRON_SECRET="${CRON_SECRET:-ZXe9we2Nk8_WOR10kjyAlwUYszg6jw1EA_5JYKtNGiQ}"

echo "=== Pivot Cloud Scheduler Setup ==="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "App URL:  $APP_URL"
echo ""

# ── Enable the API ────────────────────────────────────────────
echo "1. Enabling Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com \
  --project="$PROJECT_ID" 2>/dev/null || true

# ── Create heartbeat job (every 5 minutes) ────────────────────
echo "2. Creating heartbeat cron job (every 5 min)..."
gcloud scheduler jobs create http pivot-heartbeat \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="*/5 * * * *" \
  --uri="${APP_URL}/api/execution/heartbeat" \
  --http-method=POST \
  --headers="Authorization=Bearer ${CRON_SECRET}" \
  --headers="Content-Type=application/json" \
  --message-body='{}' \
  --time-zone="America/New_York" \
  --description="Pivot execution engine heartbeat — checks for queued tasks every 5 minutes" \
  --attempt-deadline="120s" \
  --max-retry-attempts=1 \
  2>/dev/null || {
    echo "   Job already exists, updating..."
    gcloud scheduler jobs update http pivot-heartbeat \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --schedule="*/5 * * * *" \
      --uri="${APP_URL}/api/execution/heartbeat" \
      --http-method=POST \
      --update-headers="Authorization=Bearer ${CRON_SECRET}" \
      --update-headers="Content-Type=application/json" \
      --message-body='{}' \
      --time-zone="America/New_York" \
      --description="Pivot execution engine heartbeat — checks for queued tasks every 5 minutes" \
      --attempt-deadline="120s" \
      --max-retry-attempts=1
  }

echo ""
echo "=== Done! ==="
echo ""
echo "Cloud Scheduler will hit POST ${APP_URL}/api/execution/heartbeat every 5 minutes."
echo ""
echo "Useful commands:"
echo "  gcloud scheduler jobs list --project=$PROJECT_ID --location=$REGION"
echo "  gcloud scheduler jobs run pivot-heartbeat --project=$PROJECT_ID --location=$REGION"
echo "  gcloud scheduler jobs pause pivot-heartbeat --project=$PROJECT_ID --location=$REGION"
echo "  gcloud scheduler jobs resume pivot-heartbeat --project=$PROJECT_ID --location=$REGION"
