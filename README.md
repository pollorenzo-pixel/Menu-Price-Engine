# Menu Price Engine — Stage 4 + Weekly Review Mode

Menu Price Engine is a **static-file-only** internal app for Kiju covering costing, menu engineering, snapshots, reporting, and weekly operator decision workflows.

## UX refinement focus (current pass)

This refinement pass prioritizes a calmer, more focused interface while preserving all existing logic:
- **Home is simplified** into three clear zones: key KPIs, attention items, and quick actions.
- **Information hierarchy is tighter** so top-level health metrics are visible first.
- **Navigation is clearer** with explicit action buttons for Recipes, Ingredient Library, and Weekly Review.
- **Mode separation is cleaner** so each tab stays focused on its own task.
- **Mobile spacing and layout are lighter** (stacked controls, fuller tap targets, less visual density).
- **Mode routing is hardened** with a single `switchMode()` flow, delegated nav events, and explicit panel hide/show state.

## Weekly Review Mode (Operator Ritual)

Weekly Review Mode is designed as a guided founder/operator workflow, not a generic form.

### End-to-end weekly flow
1. **Start Review**
   - Set review title and optional context notes.
   - See a quick recap of the latest saved review.
2. **Data Check**
   - Clear scan of missing selling prices and missing units sold.
   - Continue is allowed (with warnings) if gaps are expected.
3. **Snapshot**
   - Create a named review snapshot or auto-create one in-flow.
4. **Comparison**
   - Compare current live state vs latest snapshot.
   - Capture what improved, what declined, and optional notes.
5. **Focus Item Selection**
   - Items grouped by **Stars / Plowhorses / Puzzles / Dogs**.
   - Suggested picks are pre-marked for faster weekly selection.
6. **Decision Entry**
   - One card per selected item.
   - Fast action choice + optional note.
7. **Summary**
   - Compact bullet summary suitable for internal team review.
8. **Save Review**
   - Saves the completed weekly review to localStorage.
9. **Previous Review Follow-up**
   - Evaluate last week’s decisions as:
     - Worked
     - Didn’t work
     - Needs adjustment

## How reviews are saved

Reviews are stored in `localStorage` under:
- `mpe_v4_weekly_reviews` (saved logs)
- `mpe_v4_weekly_draft` (in-progress draft state)

Each saved review includes:
- `id`, `name`, `createdAt`
- `snapshotId`
- `decisions[]`
- `selectedItems[]`
- `notes` (start/improved/declined/comparison)
- `previousEvaluation[]`
- `summary`

## Previous review evaluation behavior

The follow-up step loads the **most recent saved review** and lets the operator score each prior decision outcome.
Those outcomes are attached to the current weekly review record when saved.

## Stage 4 capability retained

All core Stage 4 capabilities remain intact:
- ingredient library CRUD
- recipe CRUD + duplication
- costing and menu engineering classification
- snapshots and snapshot comparisons
- CSV exports + print summary
- matrix and analysis tools

## Current limitations

- Data persistence is browser-local only (`localStorage`), no sync across devices.
- No user accounts or multi-user collaboration.
- Weekly draft and saved reviews depend on browser storage availability.
- Snapshot comparisons rely on available snapshot history.

## Run locally

Open `index.html` directly, or serve with:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment

GitHub Pages compatible without changes:
- `index.html`
- `style.css`
- `script.js`
- no backend, no build step, no external dependencies
