from datetime import date, timedelta
from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_status

def test_manual_review_status_resolution():
    future_date = (date.today() + timedelta(days=100)).isoformat()
    
    # 4 required documents present, matching names, but one name variation exists
    docs = [
        ExtractedDocument(
            document_type="income_certificate",
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            expiry_date=ExtractedField(value=future_date, confidence=0.9),
            annual_income=ExtractedField(value="150000", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="community_certificate",
            holder_name=ExtractedField(value="Karthikeyans", confidence=0.9), # Minor name spelling variation
            issue_date=ExtractedField(value="2025-05-10", confidence=0.9),
            community=ExtractedField(value="BC", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="student_id",
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            institution_name=ExtractedField(value="Anna University", confidence=0.9),
            academic_year=ExtractedField(value="2026-2027", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="bank_passbook",
            bank_account_holder=ExtractedField(value="Karthikeyan S", confidence=0.9),
            bank_account_last4=ExtractedField(value="1234", confidence=0.9),
            ifsc=ExtractedField(value="SBIN0001234", confidence=0.9)
        )
    ]
    
    issues = validate_documents(docs)
    status = calculate_status(docs, issues)
    
    # Verify no errors, only review issues
    errors = [i for i in issues if i.severity == "error"]
    reviews = [i for i in issues if i.severity == "review"]
    
    assert len(errors) == 0
    assert len(reviews) > 0
    
    # Assert status resolves to MANUAL_REVIEW_REQUIRED
    assert status == "MANUAL_REVIEW_REQUIRED"
