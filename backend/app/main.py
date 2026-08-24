import time
import uuid
import logging
import hashlib
from io import BytesIO
from typing import List, Dict
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import fitz  # PyMuPDF

from .extraction import extract_document, translate_issues_to_tamil, TranslatedIssueItem
from .models import AnalysisResult, ValidationIssue, VerificationStatus
from .validation import validate_documents, calculate_score, calculate_status

# Initialize Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DocSureIndAPI")

app = FastAPI(
    title="DocSureInd API",
    description="Verification API for student documentation scholarship readiness",
    version="0.1.0"
)

# Enable CORS for local and staging access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants for security controls
FILE_SIGNATURES = {
    "application/pdf": (b"%PDF",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}

ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}

MAX_FILE_SIZE = 8 * 1024 * 1024       # 8 MB per file
MAX_TOTAL_SIZE = 24 * 1024 * 1024     # 24 MB total request limit
MAX_FILES = 6
MAX_PDF_PAGES = 10

class TranslateRequest(BaseModel):
    issues: List[ValidationIssue]


def validate_file_signature(filename: str, content_type: str, content: bytes) -> bool:
    """Validates the file extension, declared MIME type, and binary magic bytes."""
    extension = Path(filename).suffix.lower()
    expected_type = ALLOWED_EXTENSIONS.get(extension)

    if not expected_type:
        return False

    if content_type != expected_type:
        return False

    signatures = FILE_SIGNATURES[expected_type]
    return any(content.startswith(sig) for sig in signatures)


def verify_image_bytes(content: bytes) -> None:
    """Verifies if the image bytes can be decoded and are not corrupt."""
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
    except Exception as exc:
        raise ValueError("Invalid or corrupted image contents") from exc


def get_pdf_page_count(content: bytes) -> int:
    """Verifies and returns page count for a PDF file. Raises ValueError if invalid."""
    try:
        with fitz.open(stream=content, filetype="pdf") as doc:
            page_count = doc.page_count
        return page_count
    except Exception as exc:
        raise ValueError("Invalid, corrupted, or password-locked PDF document") from exc


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
    request_id = f"dsi_{uuid.uuid4().hex[:8]}"
    start_time = time.time()
    
    # Safe Logging - Operational metadata only - NO PII
    logger.info(
        f"[START] request_id={request_id} service_id={service_id} file_count={len(files)}"
    )

    if service_id != "tn_post_matric_scholarship_bc":
        logger.warning(
            f"[REJECT] request_id={request_id} reason=unsupported_service_id service_id={service_id}"
        )
        raise HTTPException(
            status_code=400,
            detail="Unsupported scholarship service ID."
        )

    if not files or len(files) > MAX_FILES:
        logger.warning(
            f"[REJECT] request_id={request_id} reason=invalid_file_count count={len(files)}"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Upload must contain between 1 and {MAX_FILES} files."
        )

    extracted_documents = []
    seen_hashes: Dict[str, int] = {}  # sha256 -> index in extracted_documents
    total_size = 0

    for index, file in enumerate(files):
        # Read content
        content = await file.read()
        total_size += len(content)

        # Validate total request size
        if total_size > MAX_TOTAL_SIZE:
            logger.warning(
                f"[REJECT] request_id={request_id} reason=total_request_too_large size={total_size}"
            )
            raise HTTPException(
                status_code=413,
                detail=f"Total upload size exceeds the {MAX_TOTAL_SIZE // 1024 // 1024} MB limit."
            )

        # Validate individual file size
        if len(content) > MAX_FILE_SIZE:
            logger.warning(
                f"[REJECT] request_id={request_id} reason=file_too_large index={index} size={len(content)}"
            )
            raise HTTPException(
                status_code=413,
                detail=f"File '{file.filename or f'#{index}'}' exceeds the 8 MB upload limit."
            )

        # Normalise content type from extension if missing
        if file.content_type not in ALLOWED_EXTENSIONS.values():
            filename = file.filename.lower() if file.filename else ""
            for ext, mtype in ALLOWED_EXTENSIONS.items():
                if filename.endswith(ext):
                    file.content_type = mtype
                    break

        # Validate extension, MIME type, and magic bytes signature
        if not validate_file_signature(file.filename or "", file.content_type or "", content):
            logger.warning(
                f"[REJECT] request_id={request_id} reason=signature_check_failed filename={file.filename}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename or f'#{index}'}' has a signature mismatch or unsupported extension."
            )

        # Format-specific validations (Pillow decode & PyMuPDF page count checking)
        try:
            if file.content_type == "application/pdf":
                pages = get_pdf_page_count(content)
                if pages > MAX_PDF_PAGES:
                    logger.warning(
                        f"[REJECT] request_id={request_id} reason=pdf_pages_exceeded pages={pages}"
                    )
                    raise HTTPException(
                        status_code=400,
                        detail=f"File '{file.filename or f'#{index}'}' exceeds the maximum {MAX_PDF_PAGES} page limit."
                    )
            else:
                verify_image_bytes(content)
        except ValueError as val_err:
            logger.warning(
                f"[REJECT] request_id={request_id} reason=file_corrupt filename={file.filename} error={val_err}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename or f'#{index}'}' is invalid, corrupted, or password-locked."
            )

        # Byte-level duplicate detection check
        digest = hashlib.sha256(content).hexdigest()
        if digest in seen_hashes:
            logger.info(
                f"[INFO] request_id={request_id} index={index} status=skipped_duplicate_extraction"
            )
            # Duplicate uploaded in the same packet. Clone first extracted doc but add warning
            first_idx = seen_hashes[digest]
            extracted = extracted_documents[first_idx].model_copy(deep=True)
            extracted.warnings.append("Duplicate file byte-contents uploaded.")
            extracted_documents.append(extracted)
            continue

        seen_hashes[digest] = len(extracted_documents)

        # Perform live Gemini extraction
        try:
            extracted = await extract_document(
                content=content,
                mime_type=file.content_type,
            )
            extracted_documents.append(extracted)
        except Exception as e:
            logger.error(
                f"[ERROR] request_id={request_id} index={index} error_type=extraction_failed details={str(e)}"
            )
            raise HTTPException(
                status_code=422,
                detail=f"Failed to process and extract file '{file.filename or f'#{index}'}': Gemini extraction error."
            )

    # Perform deterministic validation checks
    issues = validate_documents(extracted_documents)

    # Compute status and readiness cleanly
    status = calculate_status(extracted_documents, issues)
    ready = status == "READY"

    # Compute final score
    score = calculate_score(issues)
    
    # Calculate operational metrics for telemetry
    processing_time_ms = int((time.time() - start_time) * 1000)
    issue_codes = [issue.code for issue in issues]

    # Clean Logging - Operational telemetry only - NO PII
    logger.info(
        f"[COMPLETE] request_id={request_id} processing_time_ms={processing_time_ms} "
        f"status={status} score={score} issue_codes={issue_codes}"
    )

    return AnalysisResult(
        status=status,
        ready=ready,
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
        logger.error(f"[ERROR] translation_failed details={str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to translate issues: {str(e)}"
        )
