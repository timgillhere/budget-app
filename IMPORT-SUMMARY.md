# Monthly spending import (local, totals only)

`scripts/import-summary.mjs` reads one month's bank statement **PDF**, categorises it with Ollama running on your computer, and writes only category totals to the **Spend summary** tab of your Google Sheet. Descriptions and merchant names never leave your machine. The dashboard reads that tab.

CSV is not supported: the existing parser reads PDF statements only.

## One-time setup

1. Install dependencies: `npm install` (this brings in `pdfjs-dist`).
2. Install Ollama from ollama.com, then pull the model: `ollama pull qwen3:4b-instruct`
3. Create `.env.local` in the repo root with:
   - `GOOGLE_SHEET_ID=1EB73fODHIGCHaPq6G2nIgdGW-QxkdY927gIU9Q9_9TA`
   - `GOOGLE_SERVICE_ACCOUNT_JSON=` the service account key (raw JSON on one line, or base64)
4. Share the Sheet with the service account's `client_email` as **Editor** (it must write).
5. `package.json` already has an `import-summary` script, so `npm run import-summary -- <file> ...` works.

## Each month

1. Start Ollama: open the Ollama app, or run `ollama serve` in a separate terminal and leave it open.
2. Preview without writing anything:
   `npm run import-summary -- ~/Downloads/statement.pdf --account "Current account" --dry-run`
3. Check the output:
   - "Balances match" means every row was read. A warning means a row may be missing or misread.
   - Rows marked `?` were low-confidence. They stay in the totals under the model's best guess and are counted in "Needs review".
   - The last block lists the category totals that would be written. Nothing else goes to the Sheet.
4. Run it again without `--dry-run` (or add `--yes` to skip the prompt). Answer `y`.
5. Open the Sheet's **Spend summary** tab to see the rows, then reload the dashboard and pick the month on the Spending tab.

One statement covers one month. For each account (Starling, Monzo, current account), run it once with `--account "<name>"`. Re-running a month for the same account replaces those rows; other accounts and months are kept. New rows are added before the old ones are removed, so a failure part-way can leave duplicates but not lose data.

Options: `--model <tag>`, `--ollama <url>` (default `http://localhost:11434`), `--dry-run`, `--yes`.

## Correcting a category

Add a rule to the **Merchant rules** tab (pattern, match type, category). The script applies these before the model next time. Past months only change when you re-run them.
