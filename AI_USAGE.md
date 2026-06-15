# AI_USAGE.md

## AI Tools Used

I used **Google Antigravity (Gemini 3.1 Pro)** as my coding assistant for scaffolding the backend (Express + Sequelize + MySQL), the frontend (React + Vite), and implementing the CSV import, anomaly detection, and balance calculation logic that I specified.

I also used **Claude (Anthropic)** as a planning and verification tool — to help me design the architecture and database schema, write out the detailed specifications I then gave to Antigravity, and most importantly, to independently cross-check the app's output against numbers I computed myself from the raw CSV.

I treated both tools as assistants executing a specification I designed and verified — not as autonomous developers. Every architectural decision (schema design, anomaly policies, rounding rules, how to treat settlements vs. expenses, guest member handling) was one I made first; the AI tools then implemented it, and I checked the result.

## My Process / Key Prompts

1. I first read the assignment and the CSV myself and identified ~20 distinct data problems in expenses_export.csv (duplicates, currency issues, a settlement logged as an expense, percentage splits not summing to 100%, ambiguous dates, stale group memberships, etc.).

2. For each one, I decided on a handling policy (auto-fix, auto-fix-with-flag, or require manual approval) based on the stakeholder requests in the assignment (Rohan's "no magic numbers", Meera's "I want to approve deletions", Sam's "March electricity shouldn't affect me", etc.).

3. I wrote a detailed specification covering the database schema, every split type, the rounding rule, and the anomaly-by-anomaly import policy, and gave this to Antigravity to implement incrementally (schema -> auth -> groups -> expenses -> balances -> settlements -> CSV import -> approval UI).

4. After each major step, I tested the app myself and verified the output against expected values I computed independently.

## Three Concrete Cases Where the AI Got Something Wrong, How I Caught It, and What I Changed

### 1. Inflated balance totals (off by ~Rs 62,000)

After the first CSV import, the app showed Aisha's balance as Rs 152,495.85. Before trusting this, I independently calculated what every member's balance *should* be by working through all 40 CSV rows by hand, applying the policies I had specified (excluding rows pending approval, handling the settlement and refund rows, converting USD at the agreed rate). My calculation gave Rs 89,853.67 for Aisha - a difference of about Rs 62,600.

**How I caught it:** I don't trust a number I can't reproduce. I recomputed every user's balance from the raw CSV myself and checked a basic invariant - the sum of everyone's balances across the group must equal zero, since money owed by some members must equal money owed to others. The app's numbers failed this check.

**What I changed:** I had Antigravity add a debug script that recomputes balances directly from the `expense_splits` and `settlements` tables and asserts the total is zero, then trace every row contributing to Aisha's balance so I could compare it line-by-line against my own calculation. This pointed to likely double-counting and incorrect handling of the USD conversion and the settlement sign convention, which I then had it fix.

### 2. A name-formatting typo in the CSV became a fake duplicate user

The CSV has one row where the payer is written as "Priya S" instead of "Priya" - a known data inconsistency I had already documented in my anomaly list, with the policy "normalize via fuzzy name matching to the existing member 'Priya'."

Instead, the first import created **a separate user called "Priya S"**, which then showed up on the Balances page as its own person owing money.

**How I caught it:** I know there are only six real people in this dataset (Aisha, Rohan, Priya, Meera, Dev, Sam). Seeing "Priya S" as a distinct member on the Balances page was an immediate red flag - it didn't match my anomaly list or the people I knew should exist.

**What I changed:** I directed Antigravity to fix the name-matching logic so "Priya S" maps to "Priya" on import, and to reassign the existing "Priya S" user's data to "Priya" and remove the duplicate, then re-import.

### 3. New users were given today's date as their join date instead of their real history

After fixing #1 and #2, I re-checked the approval queue and found it had grown to 17 flagged rows - most of them saying members like Rohan, Priya, and Meera were "not active members" on rows 1-2 of the CSV (February rent and groceries). This made no sense: those four were the original flatmates from day one, and this scenario wasn't anywhere on my documented anomaly list.

**How I caught it:** I cross-referenced the flagged rows against my own anomaly list - they didn't match any of the ~20 issues I'd identified, which told me this was a *new bug introduced by the previous fix*, not a real data problem. I then checked the group's member timeline view and saw every member's "joined" date was set to the date I'd created the group that day, rather than dates from the CSV.

**What I changed:** I specified that the import process must first scan the whole CSV to determine each person's correct historical join/leave dates (based on the policies I'd already set for Dev as a trip guest, Meera leaving end of March, and Sam joining mid-April), and only validate membership-based anomalies *after* those dates are correctly established. This brought the approval queue back down to the ~10-11 anomalies I had originally identified and expected.

## Why This Matters

In all three cases, the AI's output looked complete and plausible at a glance - a populated balances page, a working approval queue - but was substantively wrong. I caught every one of these by checking the output against numbers and expectations I had worked out myself beforehand, not by re-prompting until it "looked right." I can explain the reasoning behind every schema decision, every anomaly policy, and every balance figure in this app because I derived them independently before asking the AI to implement them.