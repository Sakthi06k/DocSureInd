import re
import unicodedata
from datetime import date
from rapidfuzz.fuzz import ratio
from typing import List, Set

from .models import ExtractedDocument, ValidationIssue
from .config import get_scholarship_rules

def normalize_name(value: str | None) -> str:
    """Normalizes names by lowercasing, resolving Unicode differences,

    and removing special characters (preserving English and Tamil letters).
    """
    if not value:
        return ""
    value = unicodedata.normalize("NFKC", value).casefold()
    # Support English letters, numbers, spaces, and the Tamil Unicode range (U+0B80 to U+0BFF)
    value = re.sub(r"[^a-z0-9\u0B80-\u0BFF ]", " ", value)
    return " ".join(value.split())


def validate_documents(
    documents: List[ExtractedDocument],
) -> List[ValidationIssue]:
    """Applies deterministic validation rules on extracted metadata."""
    issues: List[ValidationIssue] = []
    
    # Load dynamic scholarship rules
    rules = get_scholarship_rules()
    required_docs: Set[str] = set(rules.get("required_documents", []))
    manual_review_threshold = rules.get("manual_review_threshold", 0.80)
    
    # Get primary URL source
    official_sources = rules.get("official_sources", [])
    source_url = official_sources[0]["url"] if official_sources else "https://www.tnscholarship.tn.gov.in"

    # 1. Document presence and duplicates checks
    present_types = [doc.document_type for doc in documents]
    unique_present_types = set(present_types)

    # Detect missing required documents
    for required in required_docs:
        if required not in unique_present_types:
            issues.append(
                ValidationIssue(
                    code=f"missing_{required}",
                    severity="error",
                    title=f"Required document missing: {required.replace('_', ' ').title()}",
                    explanation=f"The uploaded document set does not contain the required: {required.replace('_', ' ').title()}.",
                    official_source=source_url,
                )
            )

    # Detect duplicate uploads of the same type
    seen_types = set()
    for index, doc in enumerate(documents):
        if doc.document_type == "unknown":
            issues.append(
                ValidationIssue(
                    code=f"unknown_document_{index}",
                    severity="warning",
                    title="Unclassified Document Uploaded",
                    explanation=(
                        f"Document #{index + 1} could not be identified as a valid certificate. "
                        "Please verify if you uploaded the correct file."
                    ),
                    document_ids=[str(index)],
                )
            )
            continue

        if doc.document_type in seen_types:
            issues.append(
                ValidationIssue(
                    code=f"duplicate_{doc.document_type}_{index}",
                    severity="warning",
                    title=f"Duplicate {doc.document_type.replace('_', ' ').title()} Uploaded",
                    explanation=(
                        f"Multiple copies of {doc.document_type.replace('_', ' ').title()} were detected. "
                        "Only the first copy will be evaluated for primary details."
                    ),
                    document_ids=[str(index)],
                )
            )
        else:
            seen_types.add(doc.document_type)

    # 2. Low-confidence extraction checks (Threshold check)
    for index, document in enumerate(documents):
        if document.document_type == "unknown":
            continue

        # Fields that are critical and require high confidence
        critical_fields = [
            ("holder_name", document.holder_name),
            ("expiry_date", document.expiry_date),
            ("certificate_number", document.certificate_number),
            ("annual_income", document.annual_income),
        ]

        for field_name, field in critical_fields:
            if field.value and field.confidence < manual_review_threshold:
                issues.append(
                    ValidationIssue(
                        code=f"low_confidence_{index}_{field_name}",
                        severity="review",
                        title=f"Unclear field: {field_name.replace('_', ' ').title()}",
                        explanation=(
                            f"The {field_name.replace('_', ' ').title()} on your {document.document_type.replace('_', ' ').title()} "
                            f"was read with low confidence ({int(field.confidence * 100)}%). Please review the value manually."
                        ),
                        document_ids=[str(index)],
                    )
                )

    # 3. Name comparisons across certificates (Fuzzy comparison)
    # Filter documents that have a holder name and high confidence, excluding bank passbook for name mismatch
    named_docs = [
        (index, doc)
        for index, doc in enumerate(documents)
        if doc.holder_name.value
        and doc.holder_name.confidence >= manual_review_threshold
        and doc.document_type != "bank_passbook"
        and doc.document_type != "unknown"
    ]

    # Find the threshold from comparison rules
    fuzzy_rule = next((r for r in rules.get("comparison_rules", []) if r["field"] == "holder_name"), None)
    threshold = fuzzy_rule["threshold"] if fuzzy_rule else 0.88

    if len(named_docs) >= 2:
        base_index, base_doc = named_docs[0]
        base_name = normalize_name(base_doc.holder_name.value)

        for other_index, other_doc in named_docs[1:]:
            other_name = normalize_name(other_doc.holder_name.value)
            # Calculate fuzzy similarity ratio (0 to 100)
            similarity = ratio(base_name, other_name) / 100.0

            if similarity < threshold:
                issues.append(
                    ValidationIssue(
                        code=f"name_mismatch_{base_index}_{other_index}",
                        severity="error",
                        title="Identity Name Mismatch",
                        explanation=(
                            f"Name mismatch detected between {base_doc.document_type.replace('_', ' ').title()} "
                            f"('{base_doc.holder_name.value}') and {other_doc.document_type.replace('_', ' ').title()} "
                            f"('{other_doc.holder_name.value}'). Verify that they belong to the same student."
                        ),
                        document_ids=[str(base_index), str(other_index)],
                    )
                )
            elif similarity < 0.96:
                issues.append(
                    ValidationIssue(
                        code=f"name_variation_{base_index}_{other_index}",
                        severity="review",
                        title="Name Spelling Variation",
                        explanation=(
                            f"A minor spelling or spacing variation was detected between "
                            f"'{base_doc.holder_name.value}' and '{other_doc.holder_name.value}'. "
                            "Please ensure this matches official application instructions."
                        ),
                        document_ids=[str(base_index), str(other_index)],
                    )
                )

    # 4. Expiry checks
    today = date.today()
    
    # Expiry rules check
    expiry_rules = {r["document"]: r["expiry_field"] for r in rules.get("validity_rules", [])}

    for index, document in enumerate(documents):
        if document.document_type in expiry_rules:
            field_name = expiry_rules[document.document_type]
            expiry_field = getattr(document, field_name, None)
            
            if not expiry_field or not expiry_field.value or expiry_field.confidence < manual_review_threshold:
                continue

            expiry_value = expiry_field.value.strip()
            try:
                expiry_date = date.fromisoformat(expiry_value)
                if expiry_date < today:
                    issues.append(
                        ValidationIssue(
                            code=f"expired_{index}_{document.document_type}",
                            severity="error",
                            title=f"Expired {document.document_type.replace('_', ' ').title()}",
                            explanation=(
                                f"The {document.document_type.replace('_', ' ').title()} expired on "
                                f"{expiry_date.strftime('%d-%b-%Y')}. A valid, active certificate is required."
                            ),
                            document_ids=[str(index)],
                            official_source=source_url,
                        )
                    )
            except ValueError:
                issues.append(
                    ValidationIssue(
                        code=f"invalid_expiry_{index}_{document.document_type}",
                        severity="review",
                        title=f"Verify {document.document_type.replace('_', ' ').title()} Expiry",
                        explanation=(
                            f"The expiry date '{expiry_value}' on the "
                            f"{document.document_type.replace('_', ' ').title()} is in an unreadable or non-standard format."
                        ),
                        document_ids=[str(index)],
                    )
                )

    return issues
