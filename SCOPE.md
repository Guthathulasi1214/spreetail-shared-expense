# SCOPE.md — Project Scope, Schema Reference, and CSV Anomaly Policies

This document is the definitive reference for the live session. It covers:
1. Database schema with field-level explanations
2. All 20 CSV anomaly policies
3. Supported endpoints overview

---

## Database Schema Reference

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | Auto-increment |
| name | VARCHAR(100) | Display name |
| email | VARCHAR(255) UNIQUE | Login identifier |
| password_hash | VARCHAR(255) | bcrypt hash, never plaintext |
| avatar_color | VARCHAR(7) | Hex color for initials avatar, set at signup |
| created_at | TIMESTAMP | Auto-set |

### `groups`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| name | VARCHAR(150) | Group display name |
| description | TEXT NULL | Optional |
| created_by | INT UNSIGNED FK→users | Audit only; group persists if creator leaves |
| created_at | TIMESTAMP | |

### `group_memberships`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| group_id | FK→groups | CASCADE delete |
| user_id | FK→users | RESTRICT delete |
| joined_at | DATE | Membership start |
| left_at | DATE NULL | NULL = still active; date = left on this day |

**Key query:** "Was user X active on date D?"
```sql
WHERE user_id = X AND group_id = G
  AND joined_at <= D
  AND (left_at IS NULL OR left_at > D)
```

### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| group_id | FK→groups | |
| description | VARCHAR(255) | |
| amount | DECIMAL(12,4) | Original currency, 4dp |
| currency | CHAR(3) | 'INR' or 'USD' |
| exchange_rate_to_inr | DECIMAL(10,6) | Immutable per-row |
| amount_in_inr | DECIMAL(12,2) | = amount × rate, used in ALL balance math |
| paid_by_user_id | FK→users | |
| split_type | ENUM | equal/unequal/percentage/share/settlement |
| expense_date | DATE | |
| notes | TEXT NULL | |
| is_active | BOOLEAN | FALSE = soft-deleted |
| created_at | TIMESTAMP | |

### `expense_splits`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| expense_id | FK→expenses | CASCADE delete |
| user_id | FK→users | |
| share_amount | DECIMAL(12,2) | **Always set.** INR value this user owes |
| share_percentage | DECIMAL(7,4) NULL | Set for PERCENTAGE splits |
| share_units | DECIMAL(10,4) NULL | Set for SHARE splits |

UNIQUE KEY on (expense_id, user_id) prevents double-counting.

### `settlements`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| group_id | FK→groups | |
| paid_by_user_id | FK→users | The payer |
| paid_to_user_id | FK→users | The recipient |
| amount | DECIMAL(12,2) | INR |
| currency | CHAR(3) | Default 'INR' |
| settled_date | DATE | |
| notes | TEXT NULL | |
| related_expense_id | FK→expenses NULL | Links to CSV-converted settlement source |
| created_at | TIMESTAMP | |

### `import_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| group_id | FK→groups | |
| imported_by | FK→users | Who uploaded the CSV |
| imported_at | TIMESTAMP | |
| total_rows | INT | All data rows parsed |
| rows_imported | INT | Clean rows → inserted into expenses |
| rows_skipped | INT | Auto-excluded (auto-resolved anomalies) |
| rows_flagged | INT | Require approval |
| original_filename | VARCHAR(255) NULL | |

### `import_anomalies`
| Column | Type | Notes |
|--------|------|-------|
| id | INT UNSIGNED PK | |
| import_log_id | FK→import_logs | |
| row_number | INT | 1-indexed |
| raw_row_data | JSON | Original CSV row, never modified |
| anomaly_type | VARCHAR(50) | See ANOMALY_TYPES in constants.js |
| description | TEXT | Human-readable, Meera-friendly |
| action_taken | TEXT NULL | What was/will be done |
| requires_approval | BOOLEAN | TRUE = in approval queue |
| approved | BOOLEAN NULL | NULL=pending, TRUE=approved, FALSE=rejected |
| resolved_at | TIMESTAMP NULL | When Approve/Reject was clicked |
| resolved_by | FK→users NULL | Who resolved it |

---

## CSV Format

Input file columns: `date, description, paid_by, amount, currency, split_type, split_with, split_details, notes`

Data: 40 rows, Feb–Apr 2026, members: Aisha, Rohan, Priya, Meera (leaves 28-03-2026), Sam (joins mid-April), Dev (Goa trip guest 08-03 to 12-03).

---

## CSV Anomaly Policies (All 20)

---

### #1 NUMERIC_FORMAT — Comma in number
**Example:** `amount = "1,200"` (Electricity Feb)  
**Detection:** Amount contains a comma character.  
**Policy:** Strip commas before `parseFloat()`.  
**Action:** Auto-fixed. Logged as `NUMERIC_FORMAT`. `requires_approval = false`.  
**Anomaly type code:** `NUMERIC_FORMAT`

---

### #2 EXCESS_PRECISION — Too many decimal places
**Example:** `amount = 899.995` (Cylinder refill)  
**Detection:** Parsed float has more than `CURRENCY_DECIMALS` (2) significant decimal places.  
**Policy:** Round using standard round-half-up to 2dp: `Math.round(value * 100) / 100`.  
**Action:** Auto-fixed (899.995 → 900.00). Logged as `EXCESS_PRECISION`. `requires_approval = false`.  
**Code constant:** `CURRENCY_DECIMALS = 2` in `constants.js`

---

### #3 NAME_NORMALIZED / NAME_UNRESOLVED — Inconsistent name casing/whitespace
**Examples:** `"priya"`, `"Priya S"`, `"rohan "` (trailing space)  
**Detection:** Name (after trim + lowercase) doesn't exactly match any group member name.  
**Policy:**
- Trim whitespace from both ends
- Attempt case-insensitive fuzzy match (`.toLowerCase()` comparison, also try prefix matching for "Priya S" → "Priya")
- Confident match (one unique result): auto-correct, log as `NAME_NORMALIZED`, `requires_approval = false`
- No confident match: log as `NAME_UNRESOLVED`, `requires_approval = true`, exclude row until resolved  
**Anomaly type codes:** `NAME_NORMALIZED` / `NAME_UNRESOLVED`

---

### #4 DUPLICATE_EXACT — Exact duplicate expense
**Example:** `"Dinner at Marina Bites"` (08-02-2026, Dev, ₹3200) vs `"dinner - marina bites"` (same date/payer/amount)  
**Detection:** Match on (normalized date, normalized paid_by, amount, currency, overlapping split_with set).  
**Policy:**
- Import FIRST occurrence normally
- Second occurrence: `is_active = false` (soft-deleted)
- `requires_approval = true` — user confirms which one to keep
- Both rows shown side-by-side in approval UI  
**Anomaly type code:** `DUPLICATE_EXACT`

---

### #5 UNEQUAL_MISMATCH — Unequal split details don't sum to total
**Example:** Aisha birthday cake: Rohan 700 + Priya 400 + Meera 400 = 1500 ✓ (this one reconciles)  
**Detection:** Sum of `split_details` values ≠ `amount` (with ±0.01 epsilon).  
**Policy:**
- If sum matches: import normally (as in the example)
- If sum mismatches: `requires_approval = true`, exclude from balances, show actual sum in report
- NEVER guess the missing amount  
**Anomaly type code:** `UNEQUAL_MISMATCH`

---

### #6 MISSING_PAID_BY — No payer specified
**Example:** "House cleaning supplies" (22-02-2026, paid_by empty)  
**Detection:** `paid_by` field is empty/null/whitespace after trim.  
**Policy:** Cannot compute balances without a payer. `requires_approval = true`. Row excluded entirely until payer is manually assigned via approval UI.  
**Anomaly type code:** `MISSING_PAID_BY`

---

### #7 CONVERTED_SETTLEMENT — Settlement mislabeled as expense
**Example:** "Rohan paid Aisha back" (25-02-2026, ₹5000, split_with="Aisha" only)  
**Detection:** `split_with` contains exactly ONE person who is not the payer (regardless of split_type).  
**Policy:** Auto-convert: create row in `settlements` table (paid_by=Rohan, paid_to=Aisha, amount=5000), do NOT create an `expenses` row. `requires_approval = false` (pattern is unambiguous).  
**Anomaly type code:** `CONVERTED_SETTLEMENT`

---

### #8 PERCENTAGE_OVER_100 — Percentage split sums to >100%
**Examples:** "Pizza Friday" (30+30+30+20=110%), "Weekend brunch" (same)  
**Detection:** Sum of percentages in `split_details` > 100 + epsilon (0.01).  
**Policy:** `requires_approval = true`. Exclude from balances. Show actual sum in report. **NEVER auto-rescale** — that silently changes what people agreed to.  
**Anomaly type code:** `PERCENTAGE_OVER_100`

---

### #9 FOREIGN_CURRENCY — USD expense
**Examples:** Goa villa ($540), Beach shack lunch ($84), Parasailing ($150), Parasailing refund (-$30)  
**Detection:** `currency = 'USD'` (or any non-INR currency).  
**Policy:** Store original amount + currency. Compute `amount_in_inr = amount × EXCHANGE_RATE_USD_TO_INR`. All balance math uses `amount_in_inr`. Log each with rate used. `requires_approval = false`.  
**Anomaly type code:** `FOREIGN_CURRENCY`

---

### #10 NON_MEMBER_IN_SPLIT — Unknown person in split_with
**Example:** "Parasailing" split_with includes "Dev's friend Kabir"  
**Detection:** Name in `split_with` doesn't match any group member (after normalization).  
**Policy:** `requires_approval = true`. Default action: exclude Kabir, re-divide among remaining members (Aisha/Rohan/Priya/Dev). Report clearly states "Kabir removed — share redistributed among 4 remaining members; original was 5-way split."  
**Why not auto-add Kabir?** See DECISIONS.md #7.  
**Anomaly type code:** `NON_MEMBER_IN_SPLIT`

---

### #11 REFUND — Negative amount
**Example:** Parasailing refund = -$30 (same group/date range as Parasailing expense)  
**Detection:** Parsed amount < 0.  
**Policy:** Process as a refund — same split_type and split_with as specified, but negative. This reverses the share direction for each person (they get money back). Auto-processed. `requires_approval = false`.  
**Note:** `amount_in_inr` will be negative (e.g., -30 × 83 = -2490 INR). Balance math handles negative amounts naturally.  
**Anomaly type code:** `REFUND`

---

### #12 DUPLICATE_FUZZY — Duplicate with different amount/payer
**Example:** "Dinner at Thalassa" (11-03, Aisha, ₹2400) vs "Thalassa dinner" (11-03, Rohan, ₹2450, notes: "Aisha also logged this I think hers is wrong")  
**Detection:** Same date/group, description similarity > threshold (Levenshtein or token overlap), but different payer AND/OR different amount.  
**Policy:** Both rows `requires_approval = true`. Both excluded from balances until a human picks or merges. Side-by-side comparison in approval UI. Do NOT auto-resolve.  
**Anomaly type code:** `DUPLICATE_FUZZY`

---

### #13 DATE_UNPARSEABLE — Unparseable date format
**Example:** "Airport cab" date="Mar-14" (no year, inconsistent format)  
**Detection:** Date string doesn't parse as DD-MM-YYYY.  
**Policy:** Attempt multiple known formats (DD-MM-YYYY, YYYY-MM-DD, MMM-DD, DD-MMM-YYYY). If still ambiguous, infer from chronological position (this row sits between 12-03-2026 and 15-03-2026 → infer 14-03-2026). Still set `requires_approval = true` so human confirms before it counts toward balances.  
**Anomaly type code:** `DATE_UNPARSEABLE`

---

### #14 MISSING_CURRENCY — Currency field empty
**Example:** "Groceries DMart" (15-03-2026, ₹2105, currency field blank)  
**Detection:** `currency` field is empty/null/whitespace.  
**Policy:** Default to group base currency (INR). `exchange_rate_to_inr = 1`. `requires_approval = false`. Flag: "Currency defaulted to INR (assumed)."  
**Anomaly type code:** `MISSING_CURRENCY`

---

### #15 ZERO_AMOUNT — Amount is zero
**Example:** "Dinner order Swiggy" (22-03-2026, amount=0, notes: "counted twice earlier - fixing later")  
**Detection:** Parsed amount === 0.  
**Policy:** Import the expense row for audit trail (`is_active = true`), but create **no** `expense_splits` rows (zero amount → zero balance impact). `requires_approval = false`. Flag: "Zero-amount expense, no balance impact — likely correction of a duplicate."  
**Anomaly type code:** `ZERO_AMOUNT`

---

### #16 STALE_MEMBERSHIP — Member not active on expense date
**Example:** "Groceries BigBasket" (02-04-2026) lists Meera in split_with, but Meera's `left_at = 28-03-2026`  
**Detection:** Cross-check each name in `split_with` against `group_memberships` as of `expense_date`. If `joined_at > date OR left_at <= date` → stale.  
**Policy:** Auto-exclude Meera from the split, re-divide among active members (Aisha, Rohan, Priya). `requires_approval = false`. Flag clearly: "Meera not active on 02-04-2026 (left 28-03-2026) — removed from split, re-divided among 3 remaining members."  
**Anomaly type code:** `STALE_MEMBERSHIP`

---

### #17 AMBIGUOUS_DATE — Date format ambiguous (DD-MM vs MM-DD)
**Example:** "Deep cleaning service" date="04-05-2026" (April 5 or May 4?)  
**Detection:** Date where day ≤ 12 (so it could be either DD-MM or MM-DD) AND the row's own notes flag uncertainty.  
**Policy:** Default to DD-MM-YYYY (file's dominant format → 4 May 2026). Set `requires_approval = true` because the date affects which membership period applies (high-consequence for balance correctness).  
**Anomaly type code:** `AMBIGUOUS_DATE`

---

### #18 SPLIT_TYPE_MISMATCH — split_type conflicts with split_details
**Example:** "Furniture for common room" (18-04-2026): `split_type="equal"` but `split_details="Aisha 1; Rohan 1; Priya 1; Sam 1"`  
**Detection:** `split_type = 'equal'` but `split_details` is non-empty.  
**Policy:** `requires_approval = true`. If weights in split_details are uniform (1;1;1;1 → equal anyway), auto-resolve to EQUAL and note "split_details ignored as redundant — weights uniform, consistent with split_type=equal." If weights were NOT uniform, keep `requires_approval = true` and let human choose between split_type or split_details.  
**Anomaly type code:** `SPLIT_TYPE_MISMATCH`

---

### #19 CONVERTED_SETTLEMENT (person-to-person via equal split_type)
**Example:** "Sam deposit share" (08-04-2026, Sam pays ₹15000, split_with="Aisha" only, split_type=equal)  
**Detection:** Same as #7 — `split_with` has exactly ONE person who is not the payer, regardless of `split_type`.  
**Policy:** Same as #7 — treat as settlement: paid_by=Sam, paid_to=Aisha, amount=15000 → `settlements` table. Auto-applied. Flag: "Converted to settlement record."  
**Note:** The split_type=equal is irrelevant — the detection rule is the single non-payer in split_with.  
**Anomaly type code:** `CONVERTED_SETTLEMENT`

---

### #20 SHARE_SPLIT_MISSING — Share split has missing unit entry
**Example (valid):** "Scooter rentals" split_with=Aisha;Rohan;Priya;Dev, split_details="Aisha 1; Rohan 2; Priya 1; Dev 2" — all 4 present, VALID.  
**Detection (invalid case):** Any member listed in `split_with` lacks a corresponding entry in `split_details` for SHARE/UNEQUAL/PERCENTAGE splits.  
**Policy:** Valid case imports normally (shares: 1/6, 2/6, 1/6, 2/6 of total). Invalid case: `requires_approval = true`. Never assume a missing share is 0 or equal — that silently changes the split.  
**Anomaly type code:** `SHARE_SPLIT_MISSING`

---

### GUEST_MEMBER_CREATED — Auto-created guest user
**Context:** Dev appears in the CSV (08-03 to 12-03) as both a payer and split member but doesn't exist as a user.  
**Policy:** Auto-create Dev as a `users` record (name="Dev", email=`dev_guest_<timestamp>@import.local`, random password hash). Create `group_membership` with `joined_at=08-03-2026, left_at=13-03-2026`. Flag as `GUEST_MEMBER_CREATED`, `requires_approval = true` for date confirmation.  
**Anomaly type code:** `GUEST_MEMBER_CREATED`

---

### CATCH-ALL — Unknown anomaly
Any row that is malformed or ambiguous in a way not covered above: `requires_approval = true`, clear description, excluded from balances.  
**Anomaly type code:** `UNKNOWN`

---

## Out of Scope

The following features are explicitly NOT built (to keep the codebase explainable):

- Push notifications / email alerts
- Recurring expenses
- Multi-currency support beyond INR/USD
- Live exchange rate API integration
- Expense categories / tags
- Receipt image upload (beyond CSV import)
- Group templates
- Multi-group dashboard consolidation (dashboard shows aggregate, but all operations are per-group)
