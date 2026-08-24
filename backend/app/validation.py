import re
import os
import json
import unicodedata
from datetime import date
from pathlib import Path
from rapidfuzz.fuzz import ratio, token_sort_ratio
from typing import List, Set, Dict, Any, Optional

from .models import ExtractedDocument, ExtractedField, ValidationIssue, VerificationStatus

# Helper to load approved sources database for integrity validation
def load_sources() -> dict:
    sources_path = Path(__file__).resolve().parent.parent / "app" / "rag" / "sources.json"
    if not sources_path.exists():
        return {}
    try:
        with open(sources_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def find_rule_for_doc(resolved_rules: List[dict], doc_type: str) -> Optional[str]:
    """Finds which rule ID requires/references this document type."""
    for rule in resolved_rules:
        if doc_type in rule.get("documents", []):
            return rule["rule_id"]
    return None


def validate_template_integrity(template: dict, sources: dict) -> None:
    """Enforces strict template definition constraints to prevent misconfigured rule packs."""
    template_id = template.get("id")
    if not template_id:
        raise ValueError("Template is missing 'id'")

    if "version" not in template or not template["version"]:
        raise ValueError(f"Template {template_id} is missing 'version'")
        
    if template.get("status") == "VERIFIED":
        if "verified_on" not in template or not template["verified_on"]:
            raise ValueError(f"Verified template {template_id} is missing 'verified_on'")

    rule_ids: Set[str] = set()
    for rule in template.get("rules", []):
        rule_id = rule.get("rule_id")
        if not rule_id:
            raise ValueError(f"Rule in template {template_id} is missing 'rule_id'")
        if rule_id in rule_ids:
            raise ValueError(f"Duplicate rule ID: {rule_id} in template {template_id}")
        rule_ids.add(rule_id)
        
        # Check rule operator
        operator = rule.get("operator")
        if operator not in {"all_of", "one_of", "conditional", "recommended"}:
            raise ValueError(f"Unsupported rule operator '{operator}' in rule {rule_id} of template {template_id}")
            
        # Verify approved sources link
        for source_id in rule.get("source_ids", []):
            source = sources.get(source_id)
            if source is None:
                raise ValueError(f"Rule {rule_id} references unknown source ID: {source_id}")
            if source.get("template_id") != template_id:
                raise ValueError(f"Source {source_id} belongs to another template: {source.get('template_id')}")
            if template.get("status") == "VERIFIED" and source.get("status") != "APPROVED":
                raise ValueError(f"Verified template uses unapproved source: {source_id}")
                
        # Validate conditional clauses
        if operator == "conditional":
            when = rule.get("when")
            if not when or "field" not in when or "operator" not in when or "value" not in when:
                raise ValueError(f"Conditional rule {rule_id} is missing when clauses")
            if when["operator"] not in {"equals", "not_equals", "in"}:
                raise ValueError(f"Unsupported conditional operator '{when['operator']}' in rule {rule_id}")
                
            # Verify question field exists in questionnaire
            q_id = when["field"]
            q_ids = {q["id"] for q in template.get("questionnaire", [])}
            if q_id not in q_ids:
                raise ValueError(f"Conditional rule {rule_id} references unknown question ID: {q_id}")
                
            # Verify requirements block
            require = rule.get("require")
            if not require or "operator" not in require:
                raise ValueError(f"Conditional rule {rule_id} is missing 'require' block")
            if require["operator"] not in {"all_of", "one_of"}:
                raise ValueError(f"Unsupported require operator '{require['operator']}' in rule {rule_id}")


def get_templates(include_drafts: bool = False) -> Dict[str, dict]:
    """Loads and validates all templates from backend app/services JSON directory."""
    services_dir = Path(__file__).resolve().parent.parent / "app" / "services"
    templates = {}
    sources = load_sources()
    
    if services_dir.exists():
        for p in services_dir.glob("*.json"):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    tpl = json.load(f)
                    
                    # Force strict template integrity check
                    validate_template_integrity(tpl, sources)
                    
                    # Only return VERIFIED templates to normal users, unless include_drafts is True
                    if tpl.get("status") == "VERIFIED" or include_drafts:
                        templates[tpl["id"]] = tpl
            except Exception as e:
                # Block start if template fails integrity validation
                raise ValueError(f"Integrity check failed for template {p.name}: {e}")
                
    return templates


def validate_answers(template: dict, answers: dict) -> None:
    """Validates submitted questionnaire answers against the template definition."""
    allowed_questions = {
        question["id"]: question
        for question in template.get("questionnaire", [])
    }

    unknown = set(answers) - set(allowed_questions)
    if unknown:
        raise ValueError(f"Unknown questionnaire answers supplied: {', '.join(unknown)}")

    for question_id, question in allowed_questions.items():
        if question.get("required") and question_id not in answers:
            raise ValueError(f"Missing required answer: {question_id}")

        if question_id in answers:
            val = answers[question_id]
            q_type = question.get("type")
            
            # Validate types
            if q_type == "boolean" and not isinstance(val, bool):
                raise ValueError(f"Invalid type for {question_id}: expected boolean")
            elif q_type == "string" and not isinstance(val, str):
                raise ValueError(f"Invalid type for {question_id}: expected string")
            elif q_type == "select":
                allowed_values = question.get("allowed_values")
                if allowed_values is not None and val not in allowed_values:
                    raise ValueError(f"Invalid select option for {question_id}")


def resolve_template_requirements(template: dict, answers: dict) -> dict:
    """Evaluates rules against questionnaire answers to output the resolved required checklist."""
    resolved_rules = []
    
    for rule in template.get("rules", []):
        operator = rule["operator"]
        
        if operator == "all_of":
            resolved_rules.append({
                "rule_id": rule["rule_id"],
                "title": rule["title"],
                "operator": "all_of",
                "documents": rule["documents"],
                "severity_if_missing": rule.get("severity_if_missing", "error"),
                "source_ids": rule.get("source_ids", [])
            })
        elif operator == "one_of":
            resolved_rules.append({
                "rule_id": rule["rule_id"],
                "title": rule["title"],
                "operator": "one_of",
                "documents": rule["documents"],
                "severity_if_missing": rule.get("severity_if_missing", "error"),
                "source_ids": rule.get("source_ids", [])
            })
        elif operator == "recommended":
            resolved_rules.append({
                "rule_id": rule["rule_id"],
                "title": rule["title"],
                "operator": "recommended",
                "documents": rule.get("documents", [rule.get("document")]),
                "severity_if_missing": "warning",
                "source_ids": rule.get("source_ids", [])
            })
        elif operator == "conditional":
            when = rule["when"]
            field = when["field"]
            op = when["operator"]
            expected = when["value"]
            
            # Evaluate condition
            actual = answers.get(field)
            condition_met = False
            if op == "equals":
                condition_met = (actual == expected)
            elif op == "not_equals":
                condition_met = (actual != expected)
            elif op == "in":
                condition_met = (actual in expected) if isinstance(expected, list) else False
                
            if condition_met:
                require = rule["require"]
                resolved_rules.append({
                    "rule_id": rule["rule_id"],
                    "title": rule["title"],
                    "operator": require["operator"],
                    "documents": require["documents"],
                    "severity_if_missing": rule.get("severity_if_missing", "error"),
                    "source_ids": rule.get("source_ids", [])
                })
                
    return {
        "template_id": template["id"],
        "template_version": template["version"],
        "status": template["status"],
        "rules": resolved_rules,
        "official_sources": template.get("official_sources", [])
    }


def get_field(document: ExtractedDocument, field_name: str) -> ExtractedField:
    """Safe helper to dynamically retrieve an ExtractedField from the fields dictionary,

    preventing sharing mutable default instances.
    """
    return document.fields.get(field_name, ExtractedField())


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
    - Missing required document:             -25 (per doc type / group)
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

    # Deduplicate missing documents by type or rule group
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
    has_dob_mismatch = False
    has_dob_variation = False

    for issue in issues:
        if "name_mismatch" in issue.code or "name_transition_mismatch" in issue.code:
            has_name_mismatch = True
        elif "name_variation" in issue.code or "name_transition_review" in issue.code:
            has_name_variation = True
        elif "dob_mismatch" in issue.code:
            has_dob_mismatch = True
        elif "dob_transition_review" in issue.code:
            has_dob_variation = True

    if has_name_mismatch or has_dob_mismatch:
        score -= 25
    elif has_name_variation or has_dob_variation:
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
    template_id: str = "tn_post_matric_scholarship_bc",
    answers: dict = None
) -> List[ValidationIssue]:
    """Applies deterministic validation rules on extracted metadata."""
    issues: List[ValidationIssue] = []
    if answers is None:
        answers = {}

    # Load templates from services registry
    templates = get_templates(include_drafts=True)
    template = templates.get(template_id)
    if not template:
        raise ValueError(f"Template '{template_id}' is not registered or verified.")

    # Validate questionnaire answers first
    validate_answers(template, answers)

    # Resolve requirements server-side
    resolved = resolve_template_requirements(template, answers)
    manual_review_threshold = template.get("manual_review_threshold", 0.80)
    
    # Get primary URL source link
    official_sources = template.get("official_sources", [])
    source_url = official_sources[0]["url"] if official_sources else "https://www.bcmbcmw.tn.gov.in/welfare_schemes_education.htm"

    # 1. Document presence and duplicates checks
    present_types = [doc.document_type for doc in documents]
    unique_present_types = set(present_types)

    # Validate resolved rules (all_of / one_of checklist)
    for rule in resolved["rules"]:
        operator = rule["operator"]
        rule_docs = rule["documents"]
        severity = rule["severity_if_missing"]
        title = rule["title"]
        rule_source = rule.get("source_ids", [None])[0]
        ref_source = load_sources().get(rule_source, {}).get("url", source_url) if rule_source else source_url

        if operator == "all_of":
            for req_doc in rule_docs:
                if req_doc not in unique_present_types:
                    issues.append(
                        ValidationIssue(
                            code=f"missing_{req_doc}",
                            severity=severity,
                            title=f"Required document missing: {req_doc.replace('_', ' ').title()}",
                            explanation=f"The uploaded document set does not contain the required: {req_doc.replace('_', ' ').title()}.",
                            official_source=ref_source,
                            rule_id=rule["rule_id"],
                        )
                    )
        elif operator == "one_of":
            # Check if at least one document in the list is present
            if not any(req_doc in unique_present_types for req_doc in rule_docs):
                accepted_labels = []
                document_types_config = template.get("document_types", {})
                for req_doc in rule_docs:
                    label = document_types_config.get(req_doc, {}).get("label", req_doc.replace('_', ' ').title())
                    accepted_labels.append(label)
                
                issues.append(
                    ValidationIssue(
                        code=f"missing_group_{rule['rule_id']}",
                        severity=severity,
                        title=title,
                        explanation=f"Upload one of the following accepted proofs: {', '.join(accepted_labels)}.",
                        official_source=ref_source,
                        rule_id=rule["rule_id"],
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

    # 2. Critical fields validation (tied dynamically to the document definitions in the template)
    document_types_config = template.get("document_types", {})

    for index, document in enumerate(documents):
        dtype = document.document_type
        if dtype == "unknown" or dtype not in document_types_config:
            continue

        critical_fields_list = document_types_config[dtype].get("critical_fields", [])
        rule_id = find_rule_for_doc(resolved["rules"], dtype)

        for field_name in critical_fields_list:
            field = get_field(document, field_name)
            
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
                        rule_id=rule_id,
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
                        rule_id=rule_id,
                    )
                )

    # 3. Cross-document name comparisons (Fuzzy comparison using token sorting)
    # Compile named documents list using holder_name or bank_account_holder (for bank passbook)
    named_docs = []
    for index, doc in enumerate(documents):
        if doc.document_type == "unknown":
            continue

        # Bank passbook uses bank_account_holder; others use holder_name
        name_field = get_field(doc, "bank_account_holder") if doc.document_type == "bank_passbook" else get_field(doc, "holder_name")
        
        # Only compare valid high-confidence names to prevent duplicate mismatch penalties
        if name_field and has_value(name_field.value) and name_field.confidence >= manual_review_threshold:
            named_docs.append((index, doc, name_field))

    # Name correction / change scenario flag checks (allow transition reviews instead of blocking errors)
    correcting_name = answers.get("correcting_name", False) or answers.get("name_changed", False)
    has_name_change_proof = "marriage_certificate" in unique_present_types or "gazette_notification" in unique_present_types

    # Find the threshold from comparison rules
    fuzzy_rules_list = template.get("comparison_rules", [])
    fuzzy_rule = next((r for r in fuzzy_rules_list if r["field"] == "holder_name"), None) if fuzzy_rules_list else None
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

            rule_id = find_rule_for_doc(resolved["rules"], base_doc.document_type) or find_rule_for_doc(resolved["rules"], other_doc.document_type)

            if similarity < threshold:
                if correcting_name:
                    if has_name_change_proof:
                        issues.append(
                            ValidationIssue(
                                code=f"name_transition_review_{base_index}_{other_index}",
                                severity="review",
                                title="Name Transition Review Required",
                                explanation=(
                                    f"Name variation detected under a name correction scenario. "
                                    f"Verify that '{base_field.value}' transitioned to '{other_field.value}' "
                                    f"using the uploaded marriage certificate or gazette notification."
                                ),
                                document_ids=[str(base_index), str(other_index)],
                                rule_id=rule_id,
                            )
                        )
                    else:
                        issues.append(
                            ValidationIssue(
                                code=f"name_transition_mismatch_{base_index}_{other_index}",
                                severity="error",
                                title="Identity Name Mismatch (Missing Proof)",
                                explanation=(
                                    f"Name mismatch detected. Since name correction is selected, "
                                    f"please upload a valid Marriage Certificate or Gazette Notification to support the change."
                                ),
                                document_ids=[str(base_index), str(other_index)],
                                rule_id=rule_id,
                            )
                        )
                else:
                    issues.append(
                        ValidationIssue(
                            code=f"name_mismatch_{base_index}_{other_index}",
                            severity="error",
                            title="Identity Name Mismatch",
                            explanation=(
                                f"Name mismatch detected between {base_doc.document_type.replace('_', ' ').title()} "
                                f"('{base_field.value}') and {other_doc.document_type.replace('_', ' ').title()} "
                                f"('{other_field.value}'). Verify that they belong to the same applicant."
                            ),
                            document_ids=[str(base_index), str(other_index)],
                            rule_id=rule_id,
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
                        rule_id=rule_id,
                    )
                )

    # 3.1 Cross-document date-of-birth comparisons
    dob_docs = []
    for index, doc in enumerate(documents):
        if doc.document_type == "unknown":
            continue
        dob_field = get_field(doc, "date_of_birth")
        if dob_field and has_value(dob_field.value) and dob_field.confidence >= manual_review_threshold:
            dob_docs.append((index, doc, dob_field))

    correcting_dob = answers.get("correcting_dob", False)

    if len(dob_docs) >= 2:
        base_index, base_doc, base_field = dob_docs[0]
        base_dob = base_field.value.strip()

        for other_index, other_doc, other_field in dob_docs[1:]:
            other_dob = other_field.value.strip()
            rule_id = find_rule_for_doc(resolved["rules"], base_doc.document_type) or find_rule_for_doc(resolved["rules"], other_doc.document_type)
            if base_dob != other_dob:
                if correcting_dob:
                    issues.append(
                        ValidationIssue(
                            code=f"dob_transition_review_{base_index}_{other_index}",
                            severity="review",
                            title="DOB Transition Review Required",
                            explanation=(
                                f"Date of Birth difference detected under a DOB correction scenario. "
                                f"Verify that '{base_field.value}' is updated to '{other_field.value}' "
                                f"using the uploaded supporting certificate."
                              ),
                            document_ids=[str(base_index), str(other_index)],
                            rule_id=rule_id,
                        )
                    )
                else:
                    issues.append(
                        ValidationIssue(
                            code=f"dob_mismatch_{base_index}_{other_index}",
                            severity="error",
                            title="Date of Birth Mismatch",
                            explanation=(
                                f"Date of Birth mismatch detected between {base_doc.document_type.replace('_', ' ').title()} "
                                f"('{base_field.value}') and {other_doc.document_type.replace('_', ' ').title()} "
                                f"('{other_field.value}'). Verify that they belong to the same applicant."
                            ),
                            document_ids=[str(base_index), str(other_index)],
                            rule_id=rule_id,
                        )
                    )

    # 4. Expiry checks
    today = date.today()
    validity_rules = template.get("validity_rules", [])
    expiry_rules = {r["document"]: r["expiry_field"] for r in validity_rules} if validity_rules else {}

    for index, document in enumerate(documents):
        if document.document_type in expiry_rules:
            field_name = expiry_rules[document.document_type]
            expiry_field = get_field(document, field_name)
            rule_id = find_rule_for_doc(resolved["rules"], document.document_type)
            
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
                            rule_id=rule_id,
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
                            f"{document.document_type.replace('_', ' ').title()} could not be parsed."
                        ),
                        document_ids=[str(index)],
                        rule_id=rule_id,
                    )
                )

    return issues
