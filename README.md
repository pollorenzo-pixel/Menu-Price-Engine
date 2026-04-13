# Menu Price Engine — Stage 4 + Weekly Review Mode

Menu Price Engine is a **static-file-only** restaurant costing and reporting app for **Kiju**.
It now includes a structured **Weekly Review Mode** that guides operational review decisions end-to-end.

## What’s New: Weekly Review Mode

A new top-level **Weekly Review** section is integrated directly in the app.

### Guided flow (Step 1 → Step 9)
1. **Start Review**
   - auto-suggested review name (date-based)
   - optional start notes
2. **Data Check**
   - detects missing `units sold` and missing `selling price`
   - warns before continuing
3. **Snapshot**
   - create snapshot for the review or auto-create on continue
4. **Comparison**
   - reuses Stage 4 comparison logic
   - prompts for: what improved / what declined + notes
5. **Focus Item Selector**
   - suggests up to 5 items (Stars / Plowhorses / Puzzles + optional Dog)
   - user can add/remove focus items
6. **Decision Panel**
   - for each selected item: choose action and add notes
7. **Review Summary**
   - generated summary text from selected decisions
8. **Save Review**
   - stores review object in `localStorage` under `weeklyReviews`
9. **Next Week Loop**
   - displays previous decisions
   - allows marking outcomes: Worked / Didn’t work / Needs adjustment

## Data Model (localStorage only)

`weeklyReviews` entries store:
- `id`
- `name`
- `createdAt`
- `snapshotId`
- `decisions[]`
- `notes`
- `selectedItems[]`
- `previousEvaluation[]`
- `summary`

## Existing Stage 4 Features Preserved

This update does **not** remove or break Stage 4 capabilities:
- ingredient library CRUD
- recipe CRUD + duplicate
- costing and menu engineering classification
- snapshots, comparison table, movement tracking
- CSV export and print-friendly summary

## Running Locally

Open `index.html` directly in a browser, or run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Hosting Compatibility

Still fully GitHub Pages compatible:
- `index.html`
- `style.css`
- `script.js`
- `localStorage` persistence only
- no backend and no build step
