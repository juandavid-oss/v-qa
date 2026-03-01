# Text Classification Strategy

## Purpose

This document defines how OCR text detections from video are categorized, how text variations are grouped with Levenshtein similarity, and which technical knobs can be tuned in the future.

The business categories are:

1. Names and brands
2. Partial sequences
3. Fixed text
4. Subtitle text

Important rule:
- A detection can be subtitle text and also a proper name (person) or brand at the same time.

---

## Classification Model

We use 2 dimensions per detection:

1. Structural category (single value):
   - `partial_sequence`
   - `fixed_text`
   - `subtitle_text`

2. Semantic tags (multiple values):
   - `proper_name`
   - `brand_name`

Business mapping:
- Names and brands: detections with `proper_name` or `brand_name` tag
- Partial sequences: `category = partial_sequence`
- Fixed text: `category = fixed_text`
- Subtitle text: `category = subtitle_text`

This avoids data loss. Example:
- "John Smith" in subtitles => `category=subtitle_text`, `semantic_tags=["proper_name"]`

---

## End-to-End Pipeline

## 1) OCR extraction
Each raw detection includes:
- `text`
- `start_time`, `end_time`
- `bbox` (`top`, `left`, `bottom`, `right`)
- `confidence`

## 2) Partial sequence merge
Detections are merged when they are:
- spatially near (high bbox overlap)
- temporally adjacent
- text-growing/shrinking (prefix/suffix pattern)

Output:
- resolved text (longest/most stable)
- `is_partial_sequence`
- optional sequence members for debugging

## 3) Text normalization for similarity
Normalize text before fuzzy comparison:
- lowercase
- trim
- collapse spaces
- remove punctuation
- remove diacritics

Raw text is still stored for UI and audit.

## 4) Variation grouping with Levenshtein
Similarity formula:

`similarity = 1 - (levenshtein_distance(a, b) / max(len(a), len(b)))`

Initial threshold:
- `LEVENSHTEIN_THRESHOLD = 0.88`

Safety rules:
- `len < 4`: exact match only
- numeric-only text: exact match only
- empty text: ignored

Per detection result:
- `variation_group_id`
- `canonical_text`
- `variation_similarity`

Canonical choice:
- most frequent variation in the group
- tie-breaker: higher average confidence

## 5) Structural category decision
Priority order:
1. `partial_sequence` if merged as partial sequence
2. `fixed_text` if fixed heuristics win
3. `subtitle_text` fallback

Fixed vs subtitle heuristics:
- vertical position (subtitles usually lower)
- duration
- repetition in same spatial region

## 6) Semantic tags decision
Using canonical text + recurrence + visual behavior:

- `proper_name`:
  - person name patterns (title case, multi-token names)
  - context checks to avoid generic words

- `brand_name`:
  - repeated stable on-screen occurrence
  - logo-like persistence
  - optional whitelist match

Both tags can coexist.

---

## Storage Contract (Recommended)

In `text_detections`, keep existing booleans for backward compatibility and add:

- `category` (`partial_sequence | fixed_text | subtitle_text`)
- `semantic_tags` (JSON/array)
- `canonical_text`
- `variation_group_id`
- `variation_similarity`
- `is_name_or_brand` (derived helper)

Compatibility:
- Continue filling `is_subtitle`, `is_fixed_text`, `is_partial_sequence` from `category`.

---

## UI Behavior

- Subtitle panel reads `category=subtitle_text`.
- Names/Brands panel reads `semantic_tags` containing `proper_name` or `brand_name`.
- A subtitle with a person name appears in both contexts:
  - subtitle flow (time-synced)
  - names/brands reporting panel

---

## Tuning Parameters (Future Adjustments)

Expose as constants/env variables:

- `LEVENSHTEIN_THRESHOLD` (default `0.88`)
- `MIN_LEN_FOR_FUZZY` (default `4`)
- `WEIGHT_POSITION`
- `WEIGHT_DURATION`
- `WEIGHT_REPETITION`
- `BRAND_WHITELIST` (optional)
- `PROPER_NAME_WHITELIST` (optional)

When adjusting:
1. Change one parameter at a time
2. Validate against a fixed sample set
3. Compare category distribution before/after

---

## Quality and Monitoring

Track these metrics per project:
- count by structural category
- count by semantic tag
- number of variation groups
- average similarity per group
- top canonical texts by frequency

Warning signs:
- sudden drop of subtitle category
- too many large clusters (over-grouping)
- low similarity groups incorrectly merged

---

## Test Cases

Minimum required:

1. Subtitle proper name:
   - Input: "John Smith" in subtitle region
   - Expected: `category=subtitle_text`, tag `proper_name`

2. Brand variation merge:
   - Input: "Boomin Brands", "boomin brand"
   - Expected: same variation group (if similarity >= 0.88)

3. Short text protection:
   - Input: "AI", "A1"
   - Expected: no fuzzy merge unless exact

4. Partial sequence precedence:
   - Input: incremental OCR sequence
   - Expected: `category=partial_sequence`

5. Fixed text persistence:
   - Input: top-position repeated stable text
   - Expected: `category=fixed_text`

---

## Rollout Recommendation

Phase 1:
- apply to new analyses only
- do not backfill historical projects initially

Phase 2:
- tune threshold/weights with real production samples

Phase 3:
- optional historical backfill with a controlled batch job

