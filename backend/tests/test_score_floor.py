from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_score_floor_remains_zero():
    # Pass a package with maximum failures to force a large negative score calculation
    docs = [
        ExtractedDocument(
            document_type="income_certificate",
            holder_name=ExtractedField(value="Arun", confidence=0.5), # low confidence critical field (-15) & name mismatch (-25)
            expiry_date=ExtractedField(value="2020-01-01", confidence=0.9), # expired (-20)
            annual_income=ExtractedField(value=None, confidence=0.0) # unreadable critical field (-15)
        ),
        ExtractedDocument(
            document_type="unknown" # unknown document warning (-5)
        )
    ]
    
    issues = validate_documents(docs)
    score = calculate_score(issues)
    
    # Assert score is floor-locked at 0 (cannot be negative)
    assert score == 0
