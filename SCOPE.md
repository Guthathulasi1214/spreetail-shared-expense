# SCOPE.md

## Database Schema

I designed a normalized MySQL schema with the following tables. Sequelize models mirror this structure.

### users
Stores login accounts. `avatar_color` is a deterministic hex color I generate per user so the UI can show colored initial-based avatars without needing image uploads.

### groups
A group represents a shared living arrangement (e.g., "the flat"). `created_by` tracks who set it up.

### group_memberships
This is the table I consider most important to the design. Rather than a simple boolean "is this person a member", I used a date-range model: `joined_at` and `left_at` (nullable - NULL means still active). This is what lets the app answer Sam's question ("why would March electricity affect my balance?") and Meera's situation (she left, so April expenses shouldn't be hers) correctly: balance calculations always check whether a person was an active member on the `expense_date` of each expense, not just whether they're a member "now".

I also added a UNIQUE constraint on (group_id, user_id, joined_at) so a person could in theory leave and rejoin a group, producing two separate membership rows.

### expenses
Stores each expense with `amount`, `currency`, `exchange_rate_to_inr`, and `amount_in_inr`. I store the exchange rate per-row rather than globally because historical rates shouldn't change retroactively if I update a "current" rate later. `is_active` is a soft-delete flag - I use this instead of hard-deleting duplicate rows, since Meera explicitly asked to approve anything the app deletes.

### expense_splits
One row per (expense, user) pair, storing `share_amount` (always populated, in INR - this is what balance calculations use), and optionally `share_percentage` or `share_units` for traceability when the split was percentage- or share-based. I chose a separate table over a JSON column specifically so that "how much does X owe for expense Y" is a simple indexed query, not something I need to parse out of JSON - this directly supports Rohan's "no magic numbers" requirement, since every balance figure can be traced back to a row in this table.

### settlements
Direct person-to-person payments, kept separate from `expenses`. I made this decision because of row 14 in the CSV ("Rohan paid Aisha back") and row 38 ("Sam deposit share") - both are repayments between two people, not shared group costs, and mixing them into the expense ledger would distort group-wide totals (e.g., a "Rohan paid Aisha 5000" expense split among 4 people would incorrectly make everyone else responsible for part of that 5000).

### import_logs and import_anomalies
`import_logs` is one row per CSV upload, storing summary counts (total/imported/skipped/flagged) for the import report. `import_anomalies` is one row per flagged CSV row, storing the original raw data (untouched, as JSON), the anomaly type, my description, the action taken, and an `approved` field (NULL = pending, TRUE/FALSE = resolved) - this table IS the approval queue that satisfies Meera's requirement.

---

## Anomaly Log

I went through expenses_export.csv row by row and found the following data problems. For each, I describe what's wrong, my policy, and why.

### 1. Numeric value stored with a thousands separator (Row 7: Electricity Feb, "1,200")
**Policy:** Strip commas before parsing to a number. Auto-fixed, no approval needed - this is a pure formatting issue with no ambiguity.

### 2. Excessive decimal precision (Row 10: Cylinder refill, 899.995)
**Policy:** Round to 2 decimal places (standard currency precision) before storing. I defined `CURRENCY_DECIMALS = 2` as a named constant so this rule is easy to find and change.

### 3. Inconsistent name casing/whitespace (Row 9: "priya", Row 11: "Priya S", Row 27: "rohan ")
**Policy:** Trim whitespace and fuzzy-match against existing group members during import. "priya" and "rohan " match "Priya"/"Rohan" with high confidence and are auto-corrected. "Priya S" is a superset match for "Priya" and is also normalized - I do not allow it to create a separate user record.

### 4. Duplicate expense, same amount (Rows 5 & 6: "Dinner at Marina Bites" vs "dinner - marina bites")
**Policy:** Same date, payer, amount, and overlapping participants - I treat this as a duplicate. The second occurrence (row 6) is marked `is_active = false` by default, but flagged with `requires_approval = true` so a human (Meera) confirms before it's permanently excluded.

### 5. Unequal split - verified it reconciles (Row 12: Aisha birthday cake)
split_with lists Rohan, Priya, Meera and split_details gives 700 + 400 + 400 = 1500, which equals the total amount. I checked this manually before assuming it was broken - it isn't. **Policy:** import normally, Aisha correctly has no share (note explicitly says "Aisha not charged"). I documented this as a general validation: for unequal splits, I sum split_details and compare to the total; only flag if they don't match.

### 6. Missing paid_by (Row 13: House cleaning supplies)
**Policy:** An expense with no payer can't be assigned in the balance model. I exclude this row entirely from balances and flag it with `requires_approval = true` - someone needs to manually assign a payer before it counts.

### 7. Settlement mislabeled as an expense (Row 14: "Rohan paid Aisha back", 5000 INR)
split_type is empty and split_with contains exactly one person (Aisha) who isn't the payer. **Policy:** I detect this pattern (single non-payer in split_with, regardless of split_type) and convert it into a `settlements` record: Rohan paid Aisha 5000. This is auto-applied since the pattern is unambiguous.

### 8. Percentage split exceeds 100% (Row 15: Pizza Friday, and Row 32: Weekend brunch - both 30+30+30+20 = 110%)
**Policy:** I validate that percentage splits sum to ~100% (allowing a small floating-point epsilon). Both rows fail this. I exclude them from balances and flag with `requires_approval = true`. I deliberately do NOT auto-rescale the percentages to 100%, because that would silently change what people agreed to pay - a human needs to decide the correct percentages.

### 9. Foreign currency entries (Rows 20, 21, 23, 26: Goa villa booking, Beach shack lunch, Parasailing, Parasailing refund - all USD)
**Policy:** I store the original amount and currency, plus a computed `amount_in_inr` using a configurable `EXCHANGE_RATE_USD_TO_INR` constant (default 83). All balance math uses `amount_in_inr`. Each row is flagged in the import report stating the conversion applied, so Priya can see her dollars weren't treated as rupees 1:1.

### 10. Non-member in a split (Row 23: Parasailing includes "Dev's friend Kabir")
**Policy:** Kabir is not a flatmate and has no account in this system. I exclude him from the split and re-divide the amount among the remaining active participants (Aisha, Rohan, Priya, Dev), flagging this with `requires_approval = true` so a human can see the original 5-way split was reduced to 4-way.

### 11. Negative amount / refund (Row 26: Parasailing refund, -30 USD)
**Policy:** I treat a negative amount as a refund that reverses the original split direction - it's processed using the same split_type/split_with as a normal expense but with a negative amount, which nets out against the original Parasailing charge for each person. Auto-processed since the policy is well-defined, but flagged for visibility.

### 12. Duplicate expense, different amounts (Rows 24 & 25: "Dinner at Thalassa" 2400 by Aisha vs "Thalassa dinner" 2450 by Rohan, same date)
**Policy:** Unlike anomaly #4, these have different payers AND different amounts, and the note admits one may be wrong. I do not auto-resolve this - both rows are flagged with `requires_approval = true` and excluded from balances until a human picks one (or merges/edits them).

### 13. Unparseable date format (Row 27: "Mar-14")
**Policy:** This doesn't match the file's dominant DD-MM-YYYY format. Based on its position between rows dated 12-03-2026 and 15-03-2026, I infer 14-03-2026 - but I still flag it with `requires_approval = true` so a human confirms the inference rather than silently trusting it.

### 14. Missing currency (Row 28: Groceries DMart, 15-03-2026)
**Policy:** Default to the group's base currency (INR), auto-applied, with a flag noting the assumption: "Currency defaulted to INR (assumed)."

### 15. Zero-amount expense (Row 31: Dinner order Swiggy, amount = 0)
The note says "counted twice earlier - fixing later". **Policy:** I import the row for audit-trail completeness, but since the amount is 0, no expense_splits are created - it has no balance impact. Flagged in the report as "zero-amount, no balance impact."

### 16. Stale membership in split_with (Row 36: Groceries BigBasket, 02-04-2026, includes Meera)
Meera's `left_at` is 28-03-2026, so she was not an active member on 02-04-2026 - the note itself says "oops Meera still in the group list". **Policy:** I cross-check each split_with member against `group_memberships` as of the expense_date. Meera is automatically excluded from this split and the amount is re-divided among the remaining active members (Aisha, Rohan, Priya). This is auto-applied since membership dates are authoritative, but it's still surfaced in the import report for visibility.

### 17. Ambiguous date format (Row 34: "Deep cleaning service", 04-05-2026)
The note explicitly asks "is this April 5 or May 4?" **Policy:** I default to DD-MM-YYYY (4 May 2026) for consistency with the rest of the file, but because the row itself raises doubt and the date affects which membership period applies, I flag it with `requires_approval = true` for human confirmation before it counts toward any balance.

### 18. split_type/split_details mismatch (Row 42: Furniture for common room)
split_type says "equal" but split_details provides weights (1;1;1;1). **Policy:** I flag this with `requires_approval = true`, but since the weights given are uniform, they're equivalent to an equal split anyway - I auto-resolve to EQUAL and note that split_details was redundant. If the weights had been unequal, this would instead require a human to choose between split_type and split_details.

### 19. Person-to-person transaction miscategorized as an expense (Row 38: "Sam deposit share", 15000 INR)
Same pattern as #7: split_with contains exactly one person (Aisha) who isn't the payer, even though split_type is "equal" this time. **Policy:** I detect this pattern regardless of split_type value and convert it to a settlement: Sam paid Aisha 15000. Auto-applied.

### 20. Share-split validation (Row 22: Scooter rentals)
split_details gives Aisha 1; Rohan 2; Priya 1; Dev 2 (6 total units), and all four are in split_with. I verified this row is valid - it's processed normally as a share split (each person's share = their units / 6 * total amount). I added a general validation: for share/unequal/percentage splits, if any split_with member is missing a corresponding entry in split_details, flag with `requires_approval = true`.

---

## Known Issue (being actively worked on)

During development I found that the membership-date inference for newly-created users was using today's date instead of dates derived from the CSV, which caused a wave of false "not an active member" flags. I caught this by comparing the approval queue against my documented anomaly list above - anything not on this list is either a new bug or something I missed, and this didn't match anything here. The fix (scan the full CSV first to establish correct historical join/leave dates, then validate) is documented in DECISIONS.md and AI_USAGE.md.