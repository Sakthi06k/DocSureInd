$ErrorActionPreference = "Stop"

# Load deployment configuration
. "$PSScriptRoot\staging.config.ps1"

# Repository root is one level above this script
$REPOSITORY_ROOT = Split-Path -Parent $PSScriptRoot
$BACKEND_PATH = Join-Path $REPOSITORY_ROOT "backend"
$FRONTEND_PATH = Join-Path $REPOSITORY_ROOT "frontend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DocSureInd Staging Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project:        $PROJECT_ID"
Write-Host "Cloud Run:      $RUN_REGION"
Write-Host "Vertex AI:      $VERTEX_LOCATION"
Write-Host "Backend:        $API_SERVICE"
Write-Host "Frontend:       $WEB_SERVICE"
Write-Host "Service account: $SERVICE_ACCOUNT"
Write-Host ""

# Confirm deployment
$confirmation = Read-Host "Deploy to this project? Enter YES to continue"

if ($confirmation -ne "YES") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# Set active GCP configuration
Write-Host ""
Write-Host "[1/7] Configuring gcloud..." -ForegroundColor Yellow

gcloud config set project $PROJECT_ID
gcloud config set run/region $RUN_REGION

# Enable required APIs
Write-Host ""
Write-Host "[2/7] Enabling required GCP APIs..." -ForegroundColor Yellow

gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    aiplatform.googleapis.com `
    iam.googleapis.com `
    logging.googleapis.com

# Verify or create runtime service account
Write-Host ""
Write-Host "[3/7] Configuring runtime service account..." -ForegroundColor Yellow

$existingServiceAccount = gcloud iam service-accounts list `
    --filter="email:$SERVICE_ACCOUNT" `
    --format="value(email)"

if (-not $existingServiceAccount) {
    Write-Host "Creating service account: $SERVICE_ACCOUNT_NAME"

    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME `
        --display-name="DocSureInd API Runtime"
}
else {
    Write-Host "Service account already exists."
}

# Grant Vertex AI permission
Write-Host "Granting Vertex AI access..."

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/aiplatform.user" `
    --quiet

# Deploy backend
Write-Host ""
Write-Host "[4/7] Deploying backend API..." -ForegroundColor Yellow

gcloud run deploy $API_SERVICE `
    --source $BACKEND_PATH `
    --project $PROJECT_ID `
    --region $RUN_REGION `
    --service-account $SERVICE_ACCOUNT `
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,VERTEX_LOCATION=$VERTEX_LOCATION,GEMINI_MODEL=$GEMINI_MODEL,APP_ENV=$APP_ENV" `
    --memory "1Gi" `
    --cpu "1" `
    --timeout "300" `
    --concurrency "10" `
    --max-instances "2" `
    --allow-unauthenticated `
    --quiet

# Get backend URL
$API_URL = gcloud run services describe $API_SERVICE `
    --project $PROJECT_ID `
    --region $RUN_REGION `
    --format="value(status.url)"

if (-not $API_URL) {
    throw "Backend deployment completed, but its Cloud Run URL could not be retrieved."
}

Write-Host ""
Write-Host "Backend deployed successfully:" -ForegroundColor Green
Write-Host $API_URL -ForegroundColor Green

# Test backend health
Write-Host ""
Write-Host "[5/7] Testing backend health..." -ForegroundColor Yellow

try {
    $healthResult = Invoke-RestMethod `
        -Uri "$API_URL/health" `
        -Method Get `
        -TimeoutSec 60

    Write-Host "Backend health check passed." -ForegroundColor Green
    Write-Host ($healthResult | ConvertTo-Json)
}
catch {
    Write-Host "Backend health check failed." -ForegroundColor Red
    Write-Host "Review Cloud Run logs before continuing."
    throw
}

# Deploy frontend with runtime backend URL
Write-Host ""
Write-Host "[6/7] Deploying frontend..." -ForegroundColor Yellow

gcloud run deploy $WEB_SERVICE `
    --source $FRONTEND_PATH `
    --project $PROJECT_ID `
    --region $RUN_REGION `
    --set-env-vars "API_URL=$API_URL,APP_ENV=$APP_ENV" `
    --memory "512Mi" `
    --cpu "1" `
    --timeout "300" `
    --concurrency "20" `
    --max-instances "2" `
    --allow-unauthenticated `
    --quiet

# Get frontend URL
$WEB_URL = gcloud run services describe $WEB_SERVICE `
    --project $PROJECT_ID `
    --region $RUN_REGION `
    --format="value(status.url)"

if (-not $WEB_URL) {
    throw "Frontend deployment completed, but its Cloud Run URL could not be retrieved."
}

Write-Host ""
Write-Host "[7/7] Deployment complete" -ForegroundColor Green
Write-Host ""
Write-Host "Backend URL:" -ForegroundColor Cyan
Write-Host $API_URL
Write-Host ""
Write-Host "Frontend URL:" -ForegroundColor Cyan
Write-Host $WEB_URL
Write-Host ""
Write-Host "Open the frontend URL and run a synthetic document test."