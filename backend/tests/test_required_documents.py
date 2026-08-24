from app.models import ExtractedDocument
from app.validation import validate_documents

def test_all_missing_required_documents():
    issues = validate_documents([])
    missing_codes = [i.code for i in issues if i.code.startswith("missing_")]
    assert len(missing_codes) == 4
    assert "missing_income_certificate" in missing_codes
    assert "missing_community_certificate" in missing_codes
    assert "missing_student_id" in missing_codes
    assert "missing_bank_passbook" in missing_codes

def test_partial_missing_documents():
    doc1 = ExtractedDocument(document_type="income_certificate")
    doc2 = ExtractedDocument(document_type="student_id")
    issues = validate_documents([doc1, doc2])
    missing_codes = [i.code for i in issues if i.code.startswith("missing_")]
    assert len(missing_codes) == 2
    assert "missing_community_certificate" in missing_codes
    assert "missing_bank_passbook" in missing_codes
