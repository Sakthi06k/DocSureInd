import pytest
from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_passport_valid_standard_package():
    """Verify standard adult fresh passport package is valid with address, identity, birth proof (reusing Aadhaar)."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="voter_id",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        )
    ]
    answers = {"is_adult_fresh_ordinary": True, "name_changed": False}
    issues = validate_documents(docs, template_id="passport_fresh_adult_ordinary", answers=answers)
    score = calculate_score(issues)

    assert len(issues) == 0
    assert score == 100


def test_passport_missing_address_proof():
    """Verify missing address proof raises a blocking group error."""
    docs = [
        ExtractedDocument(
            document_type="pan_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        )
    ]
    answers = {"is_adult_fresh_ordinary": True, "name_changed": False}
    issues = validate_documents(docs, template_id="passport_fresh_adult_ordinary", answers=answers)
    score = calculate_score(issues)

    issue_codes = {i.code for i in issues}
    assert "missing_group_passport_address_proof" in issue_codes
    assert score < 100


def test_passport_name_changed_missing_evidence():
    """Verify that when name_changed is True, missing proof of transition raises a blocking error."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="voter_id",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        )
    ]
    answers = {"is_adult_fresh_ordinary": True, "name_changed": True}
    issues = validate_documents(docs, template_id="passport_fresh_adult_ordinary", answers=answers)
    
    issue_codes = {i.code for i in issues}
    assert "missing_group_passport_name_change_proof" in issue_codes


def test_passport_name_changed_with_evidence_matching():
    """Verify that when name_changed is True and marriage certificate exists, name variations trigger manual review."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan Shanmugam", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="marriage_certificate",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        )
    ]
    answers = {"is_adult_fresh_ordinary": True, "name_changed": True}
    issues = validate_documents(docs, template_id="passport_fresh_adult_ordinary", answers=answers)
    
    # Names differ (Karthikeyan Shanmugam vs Karthikeyan S) but proof exists
    # -> name_transition_review (severity review), not blocking name_mismatch error!
    review_issues = [i for i in issues if i.code.startswith("name_transition_review_")]
    assert len(review_issues) == 1
    assert review_issues[0].severity == "review"

    error_issues = [i for i in issues if i.severity == "error"]
    assert len(error_issues) == 0


def test_passport_name_changed_different_names_no_proof():
    """Verify that when names differ in a name change scenario without proof, it raises a name mismatch error."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan Shanmugam", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="voter_id",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9)
        )
    ]
    answers = {"is_adult_fresh_ordinary": True, "name_changed": True}
    issues = validate_documents(docs, template_id="passport_fresh_adult_ordinary", answers=answers)
    
    issue_codes = {i.code for i in issues}
    assert any(c.startswith("name_transition_mismatch_") for c in issue_codes)
