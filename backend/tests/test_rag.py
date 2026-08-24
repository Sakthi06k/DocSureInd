import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import RAGQueryResponse

client = TestClient(app)

def test_rag_query_scholarship_valid():
    """Verify RAG query returns grounded answer and original citation metadata for verified scholarship."""
    payload = {
        "template_id": "tn_post_matric_scholarship_bc",
        "template_version": "1.0.0",
        "rule_id": "scholarship_mandatory_documents",
        "question": "What documents do I need to submit for this scholarship?",
        "language": "en"
    }
    response = client.post("/api/v1/assistant/query", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    rag_response = RAGQueryResponse.model_validate(data)
    
    assert rag_response.grounded is True
    assert len(rag_response.citations) == 1
    citation = rag_response.citations[0]
    assert citation.source_id == "tn_scholarship_source_001"
    assert citation.url == "https://www.bcmbcmw.tn.gov.in/welfare_schemes_education.htm"
    assert "income certificate" in rag_response.answer.lower() or "community certificate" in rag_response.answer.lower()


def test_rag_query_unsupported_rule():
    """Verify RAG query returns 404 error when querying an unknown rule ID."""
    payload = {
        "template_id": "tn_post_matric_scholarship_bc",
        "template_version": "1.0.0",
        "rule_id": "non_existent_rule_xyz",
        "question": "Tell me about this rule.",
        "language": "en"
    }
    response = client.post("/api/v1/assistant/query", json=payload)
    assert response.status_code == 404
    assert "Rule ID not found" in response.json()["detail"]


def test_rag_query_ungrounded_refusal():
    """Verify RAG query falls back to standard refusal when evidence cannot answer the question."""
    payload = {
        "template_id": "tn_post_matric_scholarship_bc",
        "template_version": "1.0.0",
        "rule_id": "scholarship_mandatory_documents",
        "question": "What is the capital of France?",
        "language": "en"
    }
    response = client.post("/api/v1/assistant/query", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    rag_response = RAGQueryResponse.model_validate(data)
    
    assert rag_response.grounded is False
    assert len(rag_response.citations) == 0
    assert "could not verify" in rag_response.answer
