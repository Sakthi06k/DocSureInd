# DocSureInd (Documents Sure, India) 🇮🇳

DocSureInd is a preparation assistant that verifies if a student's document package is ready for a Tamil Nadu scholarship application. It uses Vertex AI Gemini to classify and extract certificate fields, and then runs a deterministic verification engine to detect missing files, mismatching names, and expired certificates. It provides a premium web dashboard with Tamil translation and audio read-aloud support.

---

## Technical Stack

- **Backend**: FastAPI (Python 3.12), Pydantic, RapidFuzz (fuzzy name comparisons), PyMuPDF (PDF handling), Pillow (Image handling).
- **Frontend**: Next.js (TypeScript, Tailwind CSS).
- **AI**: Gemini 2.5 Flash via Google GenAI SDK.
- **Deployments**: Docker containers hosted on Cloud Run.

---

## Local Setup and Running

Follow these steps to run both the frontend and backend services locally.

### Prerequisite: Google Cloud Auth
To use Vertex AI Gemini locally, you must authenticate using your Google Cloud credentials:
```bash
gcloud auth login
gcloud auth application-default login
```

Alternatively, if you do not have a GCP project set up yet, you can test using a standard Gemini API Key:
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="your-api-key-here"

# Linux / MacOS
export GEMINI_API_KEY="your-api-key-here"
```

---

### 1. Run the Backend API

1. **Navigate to backend and create a virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   
   # Linux/MacOS:
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set Environment Variables and Start the API**:
   ```bash
   # Windows PowerShell:
   $env:GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
   $env:VERTEX_LOCATION="us-central1"
   $env:GEMINI_MODEL="gemini-2.5-flash"
   uvicorn app.main:app --reload --port 8080
   
   # Linux/MacOS:
   export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
   export VERTEX_LOCATION="us-central1"
   export GEMINI_MODEL="gemini-2.5-flash"
   uvicorn app.main:app --reload --port 8080
   ```

4. **Verify Health**:
   Open `http://localhost:8080/health` in your browser. You should see `{"status":"ok"}`.

---

### 2. Run the Frontend App

1. **Navigate to the frontend folder**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify the environment configuration**:
   Ensure `frontend/.env.local` contains:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Access the web app**:
   Open `http://localhost:3000` in your browser to check out the landing page, and `/check` to test the document upload utility.

---

## Testing Verification Scenarios

We have prepared a verification script to validate backend endpoints.

1. **Run verification script**:
   ```bash
   cd backend
   python verify_backend.py
   ```

---

## GCP Deployment Commands

To deploy to Cloud Run, execute these commands from the root directory (`docsureind/`):

### 1. Deploy the Backend API
```bash
gcloud run deploy docsureind-api \
  --source ./backend \
  --region asia-south1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT="your-gcp-project-id",VERTEX_LOCATION="us-central1",GEMINI_MODEL="gemini-2.5-flash" \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 3 \
  --allow-unauthenticated
```
*Note the Service URL returned by this command (e.g., `https://docsureind-api-xxxx-xx.a.run.app`).*

### 2. Deploy the Frontend App
Build and deploy the Next.js static/SSR server container to Cloud Run, pointing it to your backend:
```bash
gcloud run deploy docsureind-web \
  --source ./frontend \
  --region asia-south1 \
  --set-env-vars NEXT_PUBLIC_API_URL="YOUR_BACKEND_CLOUD_RUN_URL" \
  --memory 512Mi \
  --max-instances 3 \
  --allow-unauthenticated
```
