import pytest
from app.validation import (
    get_templates,
    validate_answers,
    resolve_template_requirements,
    validate_template_integrity,
)

def test_template_registry_loading():
    """Verify that all templates load correctly and include verified and draft ones."""
    templates = get_templates(include_drafts=True)
    assert "tn_post_matric_scholarship_bc" in templates
    assert "passport_fresh_adult_ordinary" in templates
    assert "pan_correction_individual" in templates

    # Since we have published all templates, they will all be present in public_templates
    public_templates = get_templates(include_drafts=False)
    assert "tn_post_matric_scholarship_bc" in public_templates
    assert "passport_fresh_adult_ordinary" in public_templates
    assert "pan_correction_individual" in public_templates


def test_questionnaire_validation():
    """Test server-side validation of questionnaire answers."""
    templates = get_templates(include_drafts=True)
    passport_template = templates["passport_fresh_adult_ordinary"]

    # Valid answers
    valid_answers = {"is_adult_fresh_ordinary": True, "name_changed": True}
    validate_answers(passport_template, valid_answers)

    # Missing required answer
    with pytest.raises(ValueError, match="Missing required answer"):
        validate_answers(passport_template, {})

    # Unknown answer
    with pytest.raises(ValueError, match="Unknown questionnaire answers"):
        validate_answers(passport_template, {"is_adult_fresh_ordinary": True, "name_changed": True, "extra_question": "yes"})

    # Invalid type
    with pytest.raises(ValueError, match="Invalid type"):
        validate_answers(passport_template, {"is_adult_fresh_ordinary": True, "name_changed": "not-a-bool"})


def test_rule_resolution_conditional_false():
    """Verify resolved rules when a conditional question is answered False."""
    templates = get_templates(include_drafts=True)
    passport_template = templates["passport_fresh_adult_ordinary"]

    answers = {"is_adult_fresh_ordinary": True, "name_changed": False}
    resolved = resolve_template_requirements(passport_template, answers)
    
    rules = resolved["rules"]
    # Check that name_change_proof is NOT present
    rule_ids = {r["rule_id"] for r in rules}
    assert "passport_address_proof" in rule_ids
    assert "passport_identity_proof" in rule_ids
    assert "passport_birth_proof" in rule_ids
    assert "passport_name_change_proof" not in rule_ids


def test_rule_resolution_conditional_true():
    """Verify resolved rules when a conditional question is answered True."""
    templates = get_templates(include_drafts=True)
    passport_template = templates["passport_fresh_adult_ordinary"]

    answers = {"is_adult_fresh_ordinary": True, "name_changed": True}
    resolved = resolve_template_requirements(passport_template, answers)
    
    rules = resolved["rules"]
    # Check that name_change_proof IS present
    rule_ids = {r["rule_id"] for r in rules}
    assert "passport_address_proof" in rule_ids
    assert "passport_identity_proof" in rule_ids
    assert "passport_birth_proof" in rule_ids
    assert "passport_name_change_proof" in rule_ids

    # Find the name change rule details
    name_change_rule = next(r for r in rules if r["rule_id"] == "passport_name_change_proof")
    assert name_change_rule["operator"] == "one_of"
    assert "marriage_certificate" in name_change_rule["documents"]
    assert "gazette_notification" in name_change_rule["documents"]


def test_template_integrity_violations():
    """Verify that integrity validation raises appropriate ValueErrors on misconfigured templates."""
    sources = {
        "source_001": {
            "source_id": "source_001",
            "template_id": "test_template",
            "status": "APPROVED"
        }
    }

    # Missing version
    bad_template = {"id": "test_template"}
    with pytest.raises(ValueError, match="missing 'version'"):
        validate_template_integrity(bad_template, sources)

    # Verified template missing verified_on date
    bad_template = {"id": "test_template", "version": "1.0.0", "status": "VERIFIED"}
    with pytest.raises(ValueError, match="missing 'verified_on'"):
        validate_template_integrity(bad_template, sources)

    # Duplicate rule IDs
    bad_template = {
        "id": "test_template",
        "version": "1.0.0",
        "status": "DRAFT",
        "rules": [
            {"rule_id": "rule1", "operator": "all_of", "documents": []},
            {"rule_id": "rule1", "operator": "one_of", "documents": []}
        ]
    }
    with pytest.raises(ValueError, match="Duplicate rule ID"):
        validate_template_integrity(bad_template, sources)

    # Unknown source ID
    bad_template = {
        "id": "test_template",
        "version": "1.0.0",
        "status": "DRAFT",
        "rules": [
            {"rule_id": "rule1", "operator": "all_of", "documents": [], "source_ids": ["unknown_source"]}
        ]
    }
    with pytest.raises(ValueError, match="references unknown source ID"):
        validate_template_integrity(bad_template, sources)
