from datetime import date, timedelta
from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents

def test_expired_income_certificate():
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
        expiry_date=ExtractedField(value=yesterday, confidence=0.9),
        annual_income=ExtractedField(value="120000", confidence=0.9)
    )
    issues = validate_documents([doc])
    expired_issues = [i for i in issues if "expired_" in i.code]
    assert len(expired_issues) == 1
    assert expired_issues[0].severity == "error"

def test_valid_income_certificate():
    tomorrow = (date.today() + timedelta(days=100)).isoformat()
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
        expiry_date=ExtractedField(value=tomorrow, confidence=0.9),
        annual_income=ExtractedField(value="120000", confidence=0.9)
    )
    issues = validate_documents([doc])
    expired_issues = [i for i in issues if "expired_" in i.code]
    assert len(expired_issues) == 0
