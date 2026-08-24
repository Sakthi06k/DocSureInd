from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_low_confidence_critical_field():
    doc = ExtractedDocument(
        document_type="income_certificate",
        document_type_confidence=0.95,
        holder_name=ExtractedField(value="Karthikeyan S", confidence=0.5), # Low confidence critical field
        certificate_number=ExtractedField(value="IC-12345", confidence=0.9),
        annual_income=ExtractedField(value="100000", confidence=0.9)
    )
    
    issues = validate_documents([doc])
    score = calculate_score(issues)
    
    low_conf_issues = [i for i in issues if "low_confidence_" in i.code]
    assert len(low_conf_issues) == 1
    assert low_conf_issues[0].severity == "review"
    
    # Start = 100, Missing = 3 * 25 = 75, Low Conf = 15 => Score = 10
    assert score == 10
