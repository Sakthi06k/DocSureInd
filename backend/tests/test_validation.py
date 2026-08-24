from datetime import date, timedelta
from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_full_valid_compliance_package():
    future_date = (date.today() + timedelta(days=200)).isoformat()
    docs = [
        ExtractedDocument(
            document_type="income_certificate",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            certificate_number=ExtractedField(value="IC-12345", confidence=0.9),
            expiry_date=ExtractedField(value=future_date, confidence=0.9),
            annual_income=ExtractedField(value="150000", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="community_certificate",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            certificate_number=ExtractedField(value="CC-12345", confidence=0.9),
            issue_date=ExtractedField(value="2025-05-10", confidence=0.9),
            community=ExtractedField(value="BC", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="student_id",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            institution_name=ExtractedField(value="Anna University", confidence=0.9),
            academic_year=ExtractedField(value="2026-2027", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="bank_passbook",
            document_type_confidence=0.95,
            bank_account_holder=ExtractedField(value="Karthikeyan S", confidence=0.9),
            bank_account_last4=ExtractedField(value="1234", confidence=0.9),
            ifsc=ExtractedField(value="SBIN0001234", confidence=0.9)
        )
    ]
    issues = validate_documents(docs)
    score = calculate_score(issues)
    
    assert len(issues) == 0
    assert score == 100

def test_compliance_scoring_deductions():
    past_date = (date.today() - timedelta(days=10)).isoformat()
    docs = [
        ExtractedDocument(
            document_type="income_certificate",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Arun Kumar", confidence=0.9), # name mismatch (error: -25)
            certificate_number=ExtractedField(value="IC-12345", confidence=0.9),
            expiry_date=ExtractedField(value=past_date, confidence=0.9), # expired (error: -20)
            annual_income=ExtractedField(value="150000", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="community_certificate",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            certificate_number=ExtractedField(value="CC-12345", confidence=0.9),
            community=ExtractedField(value="BC", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="student_id",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            institution_name=ExtractedField(value="Anna University", confidence=0.9)
        ),
        # bank_passbook is missing (error: -25)
    ]
    issues = validate_documents(docs)
    score = calculate_score(issues)
    
    issue_codes = [i.code for i in issues]
    assert "missing_bank_passbook" in issue_codes
    assert any("name_mismatch" in c for c in issue_codes)
    assert any("expired_" in c for c in issue_codes)
    
    # Expected deductions: 100 - 25 (missing) - 25 (mismatch) - 20 (expired) = 30
    assert score == 30
