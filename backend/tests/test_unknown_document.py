from app.models import ExtractedDocument
from app.validation import validate_documents, calculate_score, calculate_status

def test_unknown_document_handling():
    doc = ExtractedDocument(
        document_type="unknown",
        document_type_confidence=0.9
    )
    
    issues = validate_documents([doc])
    score = calculate_score(issues)
    status = calculate_status([doc], issues)
    
    # Assert unknown document warning generated
    unknown_issues = [i for i in issues if "unknown_document_" in i.code]
    assert len(unknown_issues) == 1
    assert unknown_issues[0].severity == "warning"
    
    # Assert missing required documents still raised (4 required docs missing)
    missing_issues = [i for i in issues if i.code.startswith("missing_")]
    assert len(missing_issues) == 4
    
    # Score should deduct 4 * 25 (missing) + 5 (unknown) = 105 -> Floor is 0
    assert score == 0
    
    # Status should be UNABLE_TO_VERIFY because all docs are unknown
    assert status == "UNABLE_TO_VERIFY"
