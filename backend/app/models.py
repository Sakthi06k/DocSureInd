from typing import Literal, Optional, List
from pydantic import BaseModel, Field

DocumentType = Literal[
    "income_certificate",
    "community_certificate",
    "student_id",
    "bank_passbook",
    "marksheet",
    "bonafide_certificate",
    "unknown"
]

VerificationStatus = Literal[
    "READY",
    "CORRECTIONS_REQUIRED",
    "MANUAL_REVIEW_REQUIRED",
    "UNABLE_TO_VERIFY"
]

class ExtractedField(BaseModel):
    value: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence: Optional[str] = None

class ExtractedDocument(BaseModel):
    document_type: DocumentType = "unknown"
    document_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    holder_name: ExtractedField = Field(default_factory=ExtractedField)
    date_of_birth: ExtractedField = Field(default_factory=ExtractedField)
    certificate_number: ExtractedField = Field(default_factory=ExtractedField)
    issue_date: ExtractedField = Field(default_factory=ExtractedField)
    expiry_date: ExtractedField = Field(default_factory=ExtractedField)

    annual_income: ExtractedField = Field(default_factory=ExtractedField)
    community: ExtractedField = Field(default_factory=ExtractedField)

    bank_account_holder: ExtractedField = Field(default_factory=ExtractedField)
    bank_account_last4: ExtractedField = Field(default_factory=ExtractedField)
    ifsc: ExtractedField = Field(default_factory=ExtractedField)

    institution_name: ExtractedField = Field(default_factory=ExtractedField)
    academic_year: ExtractedField = Field(default_factory=ExtractedField)

    warnings: List[str] = Field(default_factory=list)

class ValidationIssue(BaseModel):
    code: str
    severity: Literal["error", "warning", "review"]
    title: str
    explanation: str
    document_ids: List[str] = Field(default_factory=list)
    official_source: Optional[str] = None

class AnalysisResult(BaseModel):
    status: VerificationStatus
    ready: bool
    score: int
    documents: List[ExtractedDocument] = Field(default_factory=list)
    issues: List[ValidationIssue] = Field(default_factory=list)
    disclaimer: str
