import re
import unicodedata
from datetime import date
from rapidfuzz.fuzz import ratio, token_sort_ratio
from typing import List, Set

from .models import ExtractedDocument, ValidationIssue, VerificationStatus
from .config import get_scholarship_rules

# Scheme-specific critical fields configurations (as verified against official guidelines)
CRITICAL_FIELDS = {
    "tn_post_matric_scholarship_bc": {
        "income_certificate": {
            "holder_name",
            "certificate_number",
            "annual_income",
        },
        "community_certificate": {
            "holder_name",
            "certificate_number",
            "community",
        },
        "student_id": {
            "holder_name",
            "institution_name",
        },
        "bank_passbook": {
            "bank_account_holder",
            "bank_account_last4",
            "ifsc",
        },
    }
}


def has_value(value: str | None) -> bool:
    """Returns True if the value is present and contains non-whitespace text."""
    return bool(value and value.strip())


def contains_initial(tokens: List[str]) -> bool:
    """Returns True if any token in the split string represents an initial (length 1)."""
    return any(len(token) == 1 for token in tokens)


def calculate_status(
    documents: List[ExtractedDocument],
    issues: List[ValidationIssue],
) -> VerificationStatus:
    """Derives verification status cleanly from documents and issues list:

    1. Return UNABLE_TO_VERIFY if no docs exist, if any processing fails, or if all are unknown.
    2. Return CORRECTIONS_REQUIRED if any blocking error exists.
    3. Return MANUAL_REVIEW_REQUIRED if any warnings or review flags exist.
    4. Return READY otherwise.
    """
    if not documents:
        return "UNABLE_TO_VERIFY"

    if any(issue.code.startswith("processing_failed") for issue in issues):
        return "UNABLE_TO_VERIFY"

    if all(doc.document_type == "unknown" for doc in documents):
        return "UNABLE_TO_VERIFY"

    if any(issue.severity == "error" for issue in issues):
        return "CORRECTIONS_REQUIRED"

    if any(issue.severity in {"review", "warning"} for issue in issues):
        return "MANUAL_REVIEW_REQUIRED"

    return "READY"


def calculate_score(issues: List[ValidationIssue]) -> int:
    """Calculates the compliance readiness score using deduplicated rule deductions:

    - Start at 100
    - Missing required document:             -25 (per doc type)
    - Critical identity mismatch:            -25 (deduplicated for package)
    - Expired required document:             -20 (per doc type)
    - Unreadable critical field (low conf):  -15 (deduplicated by field code)
    - Minor name variation/manual review:     -5  (deduplicated for package)
    - Unknown document:                       -5  (per doc type)
    - Duplicate upload:                       -5  (per warning)
    """
    score = 100
    has_name_mismatch = False
    has_name_variation = False

    # Deduplicate missing documents by type
    missing_docs = {i.code for i in issues if i.code.startswith("missing_")}
    score -= len(missing_docs) * 25

    # Deduplicate expired documents by type
    expired_docs = {i.code for i in issues if i.code.startswith("expired_")}
    score -= len(expired_docs) * 20

    # Deduplicate unreadable or low confidence critical fields by code
    critical_errors = {
        i.code for i in issues 
        if i.code.startswith("unreadable_") or i.code.startswith("low_confidence_")
    }
    score -= len(critical_errors) * 15

    # Deduplicate unknown documents
    unknown_docs = {i.code for i in issues if i.code.startswith("unknown_document_")}
    score -= len(unknown_docs) * 5

    # Deduplicate warning duplicates
    duplicate_docs = {i.code for i in issues if i.code.startswith("duplicate_")}
    score -= len(duplicate_docs) * 5

    # Identity comparison check
    for issue in issues:
        if "name_mismatch" in issue.code:
            has_name_mismatch = True
        elif "name_variation" in issue.code:
            has_name_variation = True

    if has_name_mismatch:
        score -= 25
    elif has_name_variation:
        score -= 5

    return max(0, score)


def normalize_name(value: str | None) -> str:
    """Normalizes names by lowercasing, resolving Unicode differences,

    and removing special characters (preserving English and Tamil letters).
    """
    if not value:
        return ""
    value = unicodedata.normalize("NFKC", value).casefold()
    value = re.sub(r"[^a-z0-9\u0B80-\u0BFF ]", " ", value)
    return " ".join(value.split())


def validate_documents(
    documents: List[ExtractedDocument],
) -> List[ValidationIssue]:
    """Applies deterministic validation rules on extracted metadata."""
    issues: List[ValidationIssue] = []
    
    # Load dynamic scholarship rules
    rules = get_scholarship_rules()
    scheme_id = rules.get("id", "tn_post_matric_scholarship_bc")
    required_docs: Set[str] = set(rules.get("required_documents", []))
    manual_review_threshold = rules.get("manual_review_threshold", 0.80)
    
    # Get primary URL source (Tamil Nadu BC/MBC Welfare Department)
    official_sources = rules.get("official_sources", [])
    source_url = official_sources[0]["url"] if official_sources else "https://www.bcmbcmw.tn.gov.in/welfare_schemes_education.htm"

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

    # Detect duplicate uploads and unclassified documents
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

    # 2. Critical fields validation (tied specifically to the scheme and doc type)
    scheme_critical_fields = CRITICAL_FIELDS.get(scheme_id, {})

    for index, document in enumerate(documents):
        dtype = document.document_type
        if dtype == "unknown" or dtype not in scheme_critical_fields:
            continue

        critical_fields_list = scheme_critical_fields[dtype]

        for field_name in critical_fields_list:
            field = getattr(document, field_name, None)
            
            if not field or not has_value(field.value):
                # Critical field could not be read or is empty
                issues.append(
                    ValidationIssue(
                        code=f"unreadable_{index}_{field_name}",
                        severity="review",
                        title=f"Required field could not be read: {field_name.replace('_', ' ').title()}",
                        explanation=(
                            f"The required field '{field_name.replace('_', ' ').title()}' on the "
                            f"{dtype.replace('_', ' ').title()} could not be read. Please upload a clearer copy or verify it manually."
                        ),
                        document_ids=[str(index)],
                    )
                )
            elif field.confidence < manual_review_threshold:
                # Value was read but is uncertain
                issues.append(
                    ValidationIssue(
                        code=f"low_confidence_{index}_{field_name}",
                        severity="review",
                        title=f"Manual verification required: {field_name.replace('_', ' ').title()}",
                        explanation=(
                            f"The required field '{field_name.replace('_', ' ').title()}' on the "
                            f"{dtype.replace('_', ' ').title()} was read with low confidence ({int(field.confidence * 100)}%)."
                        ),
                        document_ids=[str(index)],
                    )
                )

    # 3. Cross-document name comparisons (Fuzzy comparison using token sorting)
    # Compile named documents list using holder_name or bank_account_holder (for bank passbook)
    named_docs = []
    for index, doc in enumerate(documents):
        if doc.document_type == "unknown":
            continue

        # Bank passbook uses bank_account_holder; others use holder_name
        name_field = doc.bank_account_holder if doc.document_type == "bank_passbook" else doc.holder_name
        
        # Only compare valid high-confidence names to prevent duplicate mismatch penalties
        if name_field and has_value(name_field.value) and name_field.confidence >= manual_review_threshold:
            named_docs.append((index, doc, name_field))

    # Find the threshold from comparison rules
    fuzzy_rule = next((r for r in rules.get("comparison_rules", []) if r["field"] == "holder_name"), None)
    threshold = fuzzy_rule["threshold"] if fuzzy_rule else 0.88

    if len(named_docs) >= 2:
        base_index, base_doc, base_field = named_docs[0]
        base_name = normalize_name(base_field.value)

        for other_index, other_doc, other_field in named_docs[1:]:
            other_name = normalize_name(other_field.value)
            
            # Fuzzy comparisons: standard character ratio and token sorting ratio
            char_score = ratio(base_name, other_name)
            token_score = token_sort_ratio(base_name, other_name)
            similarity = max(char_score, token_score) / 100.0
            
            # Reordered initials protection
            tokens_base = base_name.split()
            tokens_other = other_name.split()
            is_reordered = char_score < 95.0 and token_score >= 95.0
            has_initial = contains_initial(tokens_base) or contains_initial(tokens_other)

            if similarity < threshold:
                issues.append(
                    ValidationIssue(
                        code=f"name_mismatch_{base_index}_{other_index}",
                        severity="error",
                        title="Identity Name Mismatch",
                        explanation=(
                            f"Name mismatch detected between {base_doc.document_type.replace('_', ' ').title()} "
                            f"('{base_field.value}') and {other_doc.document_type.replace('_', ' ').title()} "
                            f"('{other_field.value}'). Verify that they belong to the same student."
                        ),
                        document_ids=[str(base_index), str(other_index)],
                    )
                )
            elif similarity < 0.95 or (is_reordered and has_initial):
                issues.append(
                    ValidationIssue(
                        code=f"name_variation_{base_index}_{other_index}",
                        severity="review",
                        title="Name Spelling/Order Variation",
                        explanation=(
                            f"A name order or minor spelling variation was detected between "
                            f"'{base_field.value}' and '{other_field.value}'. "
                            "Please ensure this matches official application instructions."
                        ),
                        document_ids=[str(base_index), str(other_index)],
                    )
                )

    # 4. Expiry checks
    today = date.today()
    expiry_rules = {r["document"]: r["expiry_field"] for r in rules.get("validity_rules", [])}

    for index, document in enumerate(documents):
        if document.document_type in expiry_rules:
            field_name = expiry_rules[document.document_type]
            expiry_field = getattr(document, field_name, None)
            
            # Only run checks if value is present and read confidently
            if not expiry_field or not has_value(expiry_field.value) or expiry_field.confidence < manual_review_threshold:
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
                # Note: expiry_date == today is accepted as valid today (no issue added)
            except ValueError:
                issues.append(
                    ValidationIssue(
                        code=f"invalid_expiry_{index}_{document.document_type}",
                        severity="review",
                        title=f"Verify {document.document_type.replace('_', ' ').title()} Expiry",
                        explanation=(
                            f"The expiry date '{expiry_value}' on the "
                            f"{document.document_type.replace('_', ' ').title()} could not be parsed."
                        ),
                        document_ids=[str(index)],
                    )
                )

    return issues
