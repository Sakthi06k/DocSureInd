from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_multiple_name_mismatches_deduplication():
    docs = [
        ExtractedDocument(
            document_type="income_certificate",
            holder_name=ExtractedField(value="Arun Kumar", confidence=0.9), # Different name
            certificate_number=ExtractedField(value="IC-123", confidence=0.9),
            annual_income=ExtractedField(value="150000", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="community_certificate",
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            certificate_number=ExtractedField(value="CC-123", confidence=0.9),
            community=ExtractedField(value="BC", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="student_id",
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            institution_name=ExtractedField(value="Anna University", confidence=0.9)
        )
    ]
    
    issues = validate_documents(docs)
    score = calculate_score(issues)
    
    # Verify that multiple mismatches issues were generated
    mismatch_issues = [i for i in issues if "name_mismatch" in i.code]
    assert len(mismatch_issues) >= 2 # mismatch between 0 and 1, and 0 and 2
    
    # Deductions: 1 * 25 (missing bank passbook) + 25 (deduplicated name mismatch) = 50.
    # Score = 100 - 50 = 50
    assert score == 50
