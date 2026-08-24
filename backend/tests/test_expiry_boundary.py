from datetime import date, timedelta
from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_status

def test_expiry_boundary_today():
    today_str = date.today().isoformat()
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
        expiry_date=ExtractedField(value=today_str, confidence=0.9), # Expiring today
        annual_income=ExtractedField(value="150000", confidence=0.9)
    )
    
    issues = validate_documents([doc])
    expired_issues = [i for i in issues if "expired_" in i.code]
    
    # Expiring today must be valid (no issue)
    assert len(expired_issues) == 0

def test_expiry_boundary_yesterday():
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
        expiry_date=ExtractedField(value=yesterday_str, confidence=0.9), # Expired yesterday
        annual_income=ExtractedField(value="150000", confidence=0.9)
    )
    
    issues = validate_documents([doc])
    expired_issues = [i for i in issues if "expired_" in i.code]
    
    # Expired yesterday must raise an error
    assert len(expired_issues) == 1
    assert expired_issues[0].severity == "error"
    
    status = calculate_status([doc], issues)
    assert status == "CORRECTIONS_REQUIRED"
