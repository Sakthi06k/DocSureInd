from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_status

def test_invalid_expiry_date_handling():
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
        expiry_date=ExtractedField(value="blurry text", confidence=0.9), # Unparseable date
        annual_income=ExtractedField(value="150000", confidence=0.9)
    )
    
    issues = validate_documents([doc])
    
    invalid_issues = [i for i in issues if "invalid_expiry_" in i.code]
    assert len(invalid_issues) == 1
    assert invalid_issues[0].severity == "review"
    
    status = calculate_status([doc], issues)
    assert status == "CORRECTIONS_REQUIRED" # due to missing required documents
