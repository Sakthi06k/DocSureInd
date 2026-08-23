import os
from pathlib import Path
import json
from dotenv import load_dotenv
load_dotenv()

# Project Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent

# GCP Configuration
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "docsureind-prod")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Rule Engine Configuration
RULES_PATH = BASE_DIR / "app" / "services" / "tn_scholarship.json"

def get_scholarship_rules() -> dict:
    """Loads the scholarship rules JSON file."""
    if not RULES_PATH.exists():
        # Fallback empty config
        return {
            "id": "tn_student_scholarship_demo",
            "name": "Tamil Nadu Student Scholarship — Prototype",
            "version": "2026-01",
            "verified_on": "2026-08-01",
            "official_sources": [],
            "required_documents": [
                "income_certificate",
                "community_certificate",
                "student_id",
                "bank_passbook"
            ],
            "comparison_rules": [
                {
                    "field": "holder_name",
                    "documents": [
                        "income_certificate",
                        "community_certificate",
                        "student_id"
                    ],
                    "match": "fuzzy",
                    "threshold": 0.88
                }
            ],
            "validity_rules": [
                {
                    "document": "income_certificate",
                    "expiry_field": "expiry_date"
                }
            ],
            "manual_review_threshold": 0.80
        }
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
