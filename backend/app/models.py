from typing import Literal, Optional, List, Any
from pydantic import BaseModel, Field

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
    document_type: str = "unknown"
    document_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    fields: dict[str, ExtractedField] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)

    def __init__(self, **data: Any):
        # Redirect legacy field parameters to the fields dictionary dynamically for backward compatibility
        standard_keys = {"document_type", "document_type_confidence", "fields", "warnings"}
        fields_data = data.setdefault("fields", {})
        
        extra_keys = [k for k in data if k not in standard_keys]
        for key in extra_keys:
            val = data.pop(key)
            if isinstance(val, dict):
                fields_data[key] = ExtractedField(**val)
            elif isinstance(val, ExtractedField):
                fields_data[key] = val
            elif val is None or isinstance(val, str):
                fields_data[key] = ExtractedField(value=val)
            else:
                fields_data[key] = val
                
        super().__init__(**data)

class ValidationIssue(BaseModel):
    code: str
    severity: Literal["error", "warning", "review"]
    title: str
    explanation: str
    document_ids: List[str] = Field(default_factory=list)
    official_source: Optional[str] = None
    rule_id: Optional[str] = None

class AnalysisResult(BaseModel):
    status: VerificationStatus
    ready: bool
    score: int
    documents: List[ExtractedDocument] = Field(default_factory=list)
    issues: List[ValidationIssue] = Field(default_factory=list)
    disclaimer: str

# RAG / Grounded Explanations schemas
class RAGQueryRequest(BaseModel):
    template_id: str
    template_version: str
    rule_id: str
    question: str
    language: Literal["en", "ta", "hi"] = "en"

class Citation(BaseModel):
    source_id: str
    title: str
    department: str
    url: str
    excerpt: str
    retrieved_on: str

class RAGQueryResponse(BaseModel):
    grounded: bool
    answer: str
    citations: List[Citation] = Field(default_factory=list)
    disclaimer: str
