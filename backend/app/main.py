from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel

from .extraction import extract_document, translate_issues_to_tamil, TranslatedIssueItem
from .models import AnalysisResult, ValidationIssue
from .validation import validate_documents

app = FastAPI(
    title="DocSureInd API",
    description="Verification API for student documentation scholarship readiness",
    version="0.1.0"
)

# Enable CORS for frontend web integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local prototyping, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}

MAX_FILE_SIZE = 8 * 1024 * 1024  # 8 MB per file
MAX_FILES = 6

class TranslateRequest(BaseModel):
    issues: List[ValidationIssue]

@app.get("/health")
def health():
    """Service health status endpoint."""
    return {"status": "ok"}


@app.post("/api/v1/analyze", response_model=AnalysisResult)
async def analyze(
    service_id: str = Form(...),
    files: List[UploadFile] = File(...),
):
    """Parses, classifies and checks documentation packages for compliance."""
    if service_id != "tn_student_scholarship_demo":
        raise HTTPException(
            status_code=400,
            detail="Unsupported scholarship service ID."
        )

    if not files or len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Upload must contain between 1 and {MAX_FILES} files."
        )

    extracted_documents = []

    for index, file in enumerate(files):
        # Validate mime type
        if file.content_type not in ALLOWED_TYPES:
            # Try to guess from extension if browser did not supply mime type
            filename = file.filename.lower() if file.filename else ""
            if filename.endswith(".pdf"):
                file.content_type = "application/pdf"
            elif filename.endswith((".jpg", ".jpeg")):
                file.content_type = "image/jpeg"
            elif filename.endswith(".png"):
                file.content_type = "image/png"
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file.filename or 'Document'}. Only PDFs, JPEGs, and PNGs are allowed."
                )

        # Read content
        content = await file.read()

        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename or f'#{index}'} exceeds the 8 MB upload limit."
            )

        try:
            # Extract document metadata with Vertex AI Gemini
            extracted = await extract_document(
                content=content,
                mime_type=file.content_type,
            )
            extracted_documents.append(extracted)
        except Exception as e:
            # Raise unprocessable entity if Gemini fails on a corrupted file
            raise HTTPException(
                status_code=422,
                detail=f"Failed to parse and extract file '{file.filename or f'#{index}'}': {str(e)}"
            )

    # Perform deterministic validation checks
    issues = validate_documents(extracted_documents)

    # Count blocking issues (errors)
    blocking_issues = [
        issue for issue in issues if issue.severity == "error"
    ]
    
    # Count review / warning flags
    review_issues = [
        issue for issue in issues if issue.severity in ("review", "warning")
    ]

    # Calculate compliance score (base 100)
    score = max(
        0,
        100 - (len(blocking_issues) * 20) - (len(review_issues) * 5)
    )

    return AnalysisResult(
        ready=len(blocking_issues) == 0,
        score=score,
        documents=extracted_documents,
        issues=issues,
        disclaimer=(
            "DocSureInd is a preparation assistant, not an official government "
            "approval platform. Verify results against government guidelines before submitting."
        ),
    )


@app.post("/api/v1/translate", response_model=List[TranslatedIssueItem])
async def translate(request: TranslateRequest):
    """Translates a list of validation issues to Tamil using Gemini."""
    try:
        translated = await translate_issues_to_tamil(request.issues)
        return translated
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to translate issues: {str(e)}"
        )
