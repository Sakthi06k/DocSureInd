import pytest
from app.models import ExtractedDocument, ExtractedField
from app.validation import validate_documents, calculate_score

def test_pan_valid_standard_package():
    """Verify standard individual PAN correction is valid with Aadhaar and PAN copy."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="pan_card_copy",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        )
    ]
    answers = {
        "is_individual_correction": True,
        "correcting_name": False,
        "correcting_dob": False,
        "correcting_address": False,
        "using_aadhaar_route": True
    }
    issues = validate_documents(docs, template_id="pan_correction_individual", answers=answers)
    score = calculate_score(issues)

    assert len(issues) == 0
    assert score == 100


def test_pan_missing_proof_of_pan():
    """Verify missing proof of existing PAN copy raises a blocking error."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        )
    ]
    answers = {
        "is_individual_correction": True,
        "correcting_name": False,
        "correcting_dob": False,
        "correcting_address": False,
        "using_aadhaar_route": True
    }
    issues = validate_documents(docs, template_id="pan_correction_individual", answers=answers)
    score = calculate_score(issues)

    issue_codes = {i.code for i in issues}
    assert "missing_group_pan_proof" in issue_codes
    assert score < 100


def test_pan_name_correction_missing_proof():
    """Verify name difference during name correction without transition proof raises a mismatch error."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan Shanmugam", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="pan_card_copy",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        )
    ]
    answers = {
        "is_individual_correction": True,
        "correcting_name": True,
        "correcting_dob": False,
        "correcting_address": False,
        "using_aadhaar_route": True
    }
    issues = validate_documents(docs, template_id="pan_correction_individual", answers=answers)
    
    issue_codes = {i.code for i in issues}
    assert any(c.startswith("name_transition_mismatch_") for c in issue_codes)


def test_pan_name_correction_with_proof():
    """Verify name difference during name correction with transition proof triggers manual review (no error)."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan Shanmugam", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="pan_card_copy",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="marriage_certificate",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan Shanmugam", confidence=0.9)
        )
    ]
    answers = {
        "is_individual_correction": True,
        "correcting_name": True,
        "correcting_dob": False,
        "correcting_address": False,
        "using_aadhaar_route": True
    }
    issues = validate_documents(docs, template_id="pan_correction_individual", answers=answers)
    
    review_issues = [i for i in issues if i.code.startswith("name_transition_review_")]
    assert len(review_issues) == 1
    assert review_issues[0].severity == "review"

    error_issues = [i for i in issues if i.severity == "error"]
    assert len(error_issues) == 0


def test_pan_dob_correction_flag():
    """Verify DOB difference during DOB correction flags transition review (no blocking error)."""
    docs = [
        ExtractedDocument(
            document_type="aadhaar_card",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-05-12", confidence=0.9)
        ),
        ExtractedDocument(
            document_type="pan_card_copy",
            document_type_confidence=0.95,
            holder_name=ExtractedField(value="Karthikeyan S", confidence=0.9),
            date_of_birth=ExtractedField(value="1995-06-12", confidence=0.9)
        )
    ]
    
    # When correcting_dob is True
    answers = {
        "is_individual_correction": True,
        "correcting_name": False,
        "correcting_dob": True,
        "correcting_address": False,
        "using_aadhaar_route": True
    }
    issues = validate_documents(docs, template_id="pan_correction_individual", answers=answers)
    
    review_issues = [i for i in issues if i.code.startswith("dob_transition_review_")]
    assert len(review_issues) == 1
    assert review_issues[0].severity == "review"
    assert not any(i.severity == "error" for i in issues)

    # When correcting_dob is False (must raise blocking error)
    answers["correcting_dob"] = False
    issues = validate_documents(docs, template_id="pan_correction_individual", answers=answers)
    
    error_issues = [i for i in issues if i.code.startswith("dob_mismatch_")]
    assert len(error_issues) == 1
    assert error_issues[0].severity == "error"
