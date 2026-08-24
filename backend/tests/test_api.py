from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_health_route():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_analyze_validation_rejection():
    # Post request missing required form data parameters (service_id and files)
    response = client.post("/api/v1/analyze")
    assert response.status_code == 422


def test_api_translate_endpoint_empty():
    response = client.post("/api/v1/translate", json={"issues": []})
    assert response.status_code == 200
    assert response.json() == []


def test_api_analyze_unsupported_service():
    # Test service_id validation reject
    files = [("files", ("test.pdf", b"%PDF-1.5\n", "application/pdf"))]
    response = client.post(
        "/api/v1/analyze",
        data={"service_id": "invalid_scheme_id"},
        files=files
    )
    assert response.status_code == 400
    assert "Unsupported scholarship service ID" in response.json()["detail"]


def test_api_analyze_invalid_signature():
    # Test binary signature check failed: pdf with invalid bytes
    files = [("files", ("test.pdf", b"NOT_A_PDF_HEADER", "application/pdf"))]
    response = client.post(
        "/api/v1/analyze",
        data={"service_id": "tn_post_matric_scholarship_bc"},
        files=files
    )
    assert response.status_code == 400
    assert "signature mismatch" in response.json()["detail"]


def test_api_analyze_invalid_extension():
    # Test file with unsupported extension (e.g. .exe masquerading as pdf)
    files = [("files", ("malicious.exe", b"%PDF-1.5", "application/pdf"))]
    response = client.post(
        "/api/v1/analyze",
        data={"service_id": "tn_post_matric_scholarship_bc"},
        files=files
    )
    assert response.status_code == 400
    assert "signature mismatch" in response.json()["detail"]


def test_api_analyze_corrupt_image():
    # Test image with valid JPEG header but corrupt content
    files = [("files", ("test.jpg", b"\xff\xd8\xff_corrupted_data_here_12345", "image/jpeg"))]
    response = client.post(
        "/api/v1/analyze",
        data={"service_id": "tn_post_matric_scholarship_bc"},
        files=files
    )
    assert response.status_code == 400
    assert "invalid, corrupted, or password-locked" in response.json()["detail"]


def test_api_analyze_too_many_files():
    # Test maximum files count check
    files = [
        ("files", ("1.pdf", b"%PDF-1.4\n", "application/pdf")),
        ("files", ("2.pdf", b"%PDF-1.4\n", "application/pdf")),
        ("files", ("3.pdf", b"%PDF-1.4\n", "application/pdf")),
        ("files", ("4.pdf", b"%PDF-1.4\n", "application/pdf")),
        ("files", ("5.pdf", b"%PDF-1.4\n", "application/pdf")),
        ("files", ("6.pdf", b"%PDF-1.4\n", "application/pdf")),
        ("files", ("7.pdf", b"%PDF-1.4\n", "application/pdf")), # 7 files (exceeds max 6)
    ]
    response = client.post(
        "/api/v1/analyze",
        data={"service_id": "tn_post_matric_scholarship_bc"},
        files=files
    )
    assert response.status_code == 400
    assert "between 1 and" in response.json()["detail"]
