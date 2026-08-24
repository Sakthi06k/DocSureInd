# GCP project settings
$PROJECT_ID = "docsureind"

# Cloud Run deployment region
$RUN_REGION = "asia-south1"

# Vertex AI model location
$VERTEX_LOCATION = "us-central1"

# Vertex AI model
$GEMINI_MODEL = "gemini-2.5-flash"

# Cloud Run service names
$API_SERVICE = "docsureind-api-staging"
$WEB_SERVICE = "docsureind-web-staging"

# Runtime service account
$SERVICE_ACCOUNT_NAME = "docsureind-api"
$SERVICE_ACCOUNT = "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Deployment environment
$APP_ENV = "staging"