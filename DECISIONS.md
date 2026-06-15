# DECISIONS.md

This is a log of the significant decisions I made while building this app, the options I considered, and why I chose what I chose.

---

## 1. MySQL + Sequelize, with a separate `expense_splits` table

**Options considered:**
- Store splits as a JSON column on the `expenses` table.
- Store splits as a separate relational table (`expense_splits`), one row per (expense, user).

**Decision:** Separate table.

**Why:** Rohan's requirement was explicit - "if the app says I owe 2300, I want to see exactly which expenses make that up." If splits were stored as JSON, answering "what does Rohan owe across all expenses in this group" would require pulling every expense row and parsing JSON in application code. With a separate table, it's a simple indexed query (`WHERE user_id = X`), and the balance calculation and the drill-down/traceability view both read from the same source of truth. The extra table is a small cost for a large gain in correctness and explainability - which matters directly for the live session.

---

## 2. Settlements are a separate table from expenses

**Options considered:**
- Treat a "Rohan paid Aisha 5000" repayment as a normal expense with split_type and a single person in split_with.
- Create a dedicated `settlements` table for direct person-to-person payments.

**Decision:** Separate `settlements` table.

**Why:** The CSV itself contains two rows (row 14 "Rohan paid Aisha back" and row 38 "Sam deposit share") that are direct repayments, not shared costs - and one of them even has a note questioning whether it's an expense at all ("this is a settlement not an expense??"). If I imported these as expenses with split_type=equal and a single recipient, the math would still "work" in isolation, but it conceptually conflates two different kinds of transaction (shared cost vs. debt repayment) and would make the import logic's pattern-matching ("is this row actually a settlement?") harder to generalize. Keeping them separate also means the Settle Up feature (recording a payment to clear a balance) and these CSV-derived settlements use the exact same code path - one mental model for "money moved between two people directly."

---

## 3. group_memberships uses a date-range model (joined_at / left_at), not a boolean

**Options considered:**
- A simple `is_member` boolean per user per group, updated when someone joins/leaves.
- A date-range model with `joined_at` and nullable `left_at`.

**Decision:** Date-range model.

**Why:** This directly answers two of the five stakeholder requests. Sam asked "why would March electricity affect my balance?" - with a boolean, the app has no way to know Sam wasn't around in March; it would just see "Sam is a current member" and potentially include him in retroactive splits. With date ranges, every balance calculation checks whether a person was active *on the expense_date*, not whether they're active *now*. Similarly, Meera leaving at the end of March means April expenses correctly exclude her (and the CSV even has a row, #36, where she's mistakenly still listed - my import logic catches this specifically because of this date-range design).

---

## 4. Rounding rule: remainder from an uneven equal split goes to the payer

**Options considered:**
- Remainder goes to the payer.
- Remainder goes to the first person alphabetically / first in split_with.
- Distribute the remainder across people one paisa at a time in some order.

**Decision:** Remainder goes to the payer.

**Why:** It's simple, deterministic, and matches the convention used by most mainstream splitting apps, so it won't surprise anyone. I defined `CURRENCY_DECIMALS = 2` and isolated this logic into one function (`calculateEqualSplit`) specifically so that if asked to change this rule live in the interview (e.g., "give the remainder to the first person instead"), I can point to exactly one place and change it without touching the other split-type calculations.

---

## 5. USD handling: store original currency + a converted amount_in_inr, using a config constant exchange rate

**Options considered:**
- Build a general multi-currency system where each group has a configurable base currency and live exchange rates.
- Store only the INR-converted amount, discarding the original USD value.
- Store both the original amount/currency and a computed `amount_in_inr`, using a single configurable exchange-rate constant.

**Decision:** The third option.

**Why:** Priya's complaint was specifically "the sheet pretends a dollar is a rupee" - so the minimum fix is making sure USD amounts are actually converted, and that this conversion is visible, not silent. A full multi-currency system (live rates, per-group base currencies, etc.) is significant scope beyond what this CSV or the assignment's five requests need, and would make the codebase harder for me to fully explain. I store the original amount and currency for transparency/audit purposes, compute `amount_in_inr` using a named constant (`EXCHANGE_RATE_USD_TO_INR`, default 83) for all balance math, and flag each USD row in the import report so the conversion is explicit rather than hidden.

---

## 6. Kabir (non-member participant) is excluded from his split, not added as a guest user

**Options considered:**
- Auto-create Kabir as a one-off "guest" user, similar to how Dev is handled.
- Exclude Kabir from the split entirely and re-divide his share among the actual group members, flagged for review.

**Decision:** Exclude and re-divide, flagged for approval.

**Why:** Dev is a recurring participant across multiple trip expenses with his own paid-for items (Goa villa booking), so giving him a temporary membership window makes sense - he has his own balance to track for the trip. Kabir appears exactly once, as someone else's guest, with no expenses of his own. Creating a full user/membership record for a single mention felt like over-engineering, and more importantly, Kabir isn't a flatmate who will use this app or settle debts - there's no one for him to "owe" in any lasting sense. Excluding him and flagging it lets a human decide if they want to track him differently (e.g., Dev personally absorbs Kabir's share outside the app).

---

## 7. Settlement detection pattern: "split_with has exactly one non-payer person", regardless of split_type

**Options considered:**
- Only treat a row as a settlement if split_type is empty/null (matches row 14 exactly).
- Detect the pattern "split_with contains exactly one person who isn't the payer" regardless of what split_type says.

**Decision:** The second, broader pattern.

**Why:** Row 14 ("Rohan paid Aisha back") has an empty split_type, but row 38 ("Sam deposit share") has split_type="equal" despite being the same kind of person-to-person transaction (the note confirms: "Sam moving in! paid Aisha his deposit"). If I'd only matched on empty split_type, row 38 would have been imported as a real group expense, making Aisha responsible for only 1/4 of her own deposit and the other three flatmates responsible for the rest - which is clearly wrong. The broader pattern (single non-payer recipient) catches both cases correctly.

---

## 8. Date format ambiguity (rows 27 and 34): infer using context, but always require approval for inferred dates

**Options considered:**
- Reject any row with an unparseable/ambiguous date outright.
- Silently guess the most likely date and import normally.
- Make a best-guess inference, but always flag inferred dates for human confirmation.

**Decision:** The third option.

**Why:** Rejecting the row entirely loses real data unnecessarily - "Mar-14" is clearly meant to be mid-March based on its position in the file. But silently guessing is exactly the "silent guess" failure mode the assignment warns against - if my inference for row 34 ("is this April 5 or May 4?") is wrong, it could place an expense on the wrong side of Meera's departure or Sam's arrival, changing who it affects. Flagging inferred dates for approval gives the best of both: the data isn't lost, but a human confirms before it affects anyone's balance.