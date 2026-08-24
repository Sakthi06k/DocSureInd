from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score, calculate_status

def test_null_critical_field_deduction():
    # Setup income_certificate with null holder_name value
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value=None, confidence=0.0), # Null critical field
        certificate_number=ExtractedField(value="IC-12345", confidence=0.9),
        annual_income=ExtractedField(value="100000", confidence=0.9)
    )
    
    issues = validate_documents([doc])
    score = calculate_score(issues)
    status = calculate_status([doc], issues)
    
    # Check that it generated unreadable field issue
    unreadable_issues = [i for i in issues if "unreadable_" in i.code]
    assert len(unreadable_issues) == 1
    assert unreadable_issues[0].severity == "review"
    
    # Score should be deducted by 15 (unreadable field) and 75 (missing 3 other documents)
    # Start = 100, Missing = 3 * 25 = 75, Unreadable = 15 => Score = 100 - 75 - 15 = 10
    assert score == 10
    
    # Status should be MANUAL_REVIEW_REQUIRED or CORRECTIONS_REQUIRED
    # Since there are missing required documents, there will be missing errors.
    # So status is CORRECTIONS_REQUIRED
    assert status == "CORRECTIONS_REQUIRED"
