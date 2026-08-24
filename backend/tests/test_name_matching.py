from app.validation import normalize_name
from rapidfuzz.fuzz import ratio, token_sort_ratio

def test_name_normalization():
    assert normalize_name("Karthikeyan S") == "karthikeyan s"
    assert normalize_name("  Karthikeyan   S ") == "karthikeyan s"
    assert normalize_name("Sakthivel R.") == "sakthivel r"
    # Tamil Unicode block normalization check
    assert normalize_name("கார்த்திகேயன்") == "கார்த்திகேயன்"

def test_name_fuzzy_token_sorting():
    name_a = normalize_name("Karthikeyan S")
    name_b = normalize_name("S Karthikeyan")
    
    char_score = ratio(name_a, name_b)
    token_score = token_sort_ratio(name_a, name_b)
    
    # Standard character ratio is relatively low for flipped strings
    assert char_score < 90.0
    
    # Token sorting matches them perfectly (100)
    assert token_score == 100.0
    
    similarity = max(char_score, token_score) / 100.0
    assert similarity >= 0.95
