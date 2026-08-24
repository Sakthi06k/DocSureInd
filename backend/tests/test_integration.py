import os
import pytest
from app.extraction import extract_document

RUN_LIVE_VERTEX_TESTS = (
    os.getenv("RUN_LIVE_VERTEX_TESTS") == "1"
)

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_LIVE_VERTEX_TESTS,
        reason="Live Vertex AI tests are disabled",
    ),
]

@pytest.mark.asyncio
async def test_vertex_extraction_with_synthetic_file():
    # Pass a synthetic, watermarked doc header directly to test the API route integration
    content = b"%PDF-1.5\n%SYNTHETIC TEST DOCUMENT - NOT VALID\n..."
    try:
        result = await extract_document(content, "application/pdf")
        assert result is not None
        assert hasattr(result, "document_type")
    except Exception as e:
        pytest.fail(f"Live Vertex AI connection failed: {e}")
