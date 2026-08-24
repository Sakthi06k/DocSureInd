from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_duplicate_document_handling():
    docs = [
        ExtractedDocument(
            document_type="income_certificate",
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            certificate_number=ExtractedField(value="IC-12345", confidence=0.9),
            annual_income=ExtractedField(value="150000", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="income_certificate",
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            certificate_number=ExtractedField(value="IC-12345", confidence=0.9),
            annual_income=ExtractedField(value="150000", confidence=0.9)
        )
    ]
    
    issues = validate_documents(docs)
    score = calculate_score(issues)
    
    # Assert duplicate warning generated
    duplicate_issues = [i for i in issues if "duplicate_" in i.code]
    assert len(duplicate_issues) == 1
    assert duplicate_issues[0].severity == "warning"
    
    # Assert missing documents are still tracked (3 types: community, student_id, bank_passbook are missing)
    missing_codes = [i.code for i in issues if i.code.startswith("missing_")]
    assert len(missing_codes) == 3
    assert "missing_community_certificate" in missing_codes
    assert "missing_student_id" in missing_codes
    assert "missing_bank_passbook" in missing_codes
    
    # Deductions: 3 * 25 (missing) + 5 (duplicate) = 80 => Score = 20
    assert score == 20
