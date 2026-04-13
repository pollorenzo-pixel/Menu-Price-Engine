# Menu Price Engine — Stage 4 (Refinement Pass)

Menu Price Engine is a **static-file-only** restaurant costing and reporting app for **Kiju**.  
No backend, no build step, and fully compatible with GitHub Pages hosting.

## Stage 4 Refinement Focus

This refinement pass improves:
- reporting usefulness and managerial clarity
- snapshot/comparison stability and movement accuracy
- action-priority ranking logic
- CSV export completeness
- print-friendly review readability
- empty states for limited snapshot history
- spacing and hierarchy in the reporting layout

## Stage 3 Compatibility (Verified)

Stage 4 preserves all Stage 3 features:
- ingredient library CRUD
- recipe CRUD + duplicate
- draft autosave
- costing + menu engineering classification
- dashboard, matrix, analysis table

Migration strategy remains safe:
- reads Stage 4 keys first (`mpe_v4_*`)
- falls back to Stage 3 keys (`mpe_v3_*`)
- normalizes legacy aliases during migration

## Snapshot & Comparison Integrity

- Snapshots are saved as cloned historical records with:
  - timestamp
  - period label
  - notes
  - totals
  - item-level metrics, flags, and recommended actions
- Comparison matching now prefers stable item IDs and falls back to normalized names.
- Item movement clearly identifies:
  - improved
  - worsened
  - class changed
  - new item
  - removed item
- Classification movement is rendered in plain language (e.g. `Star → Plowhorse`).

## Exports and Printable Review

- **Current analysis CSV** now includes:
  - period, category, active status
  - rounded price reference
  - flags and recommended action
  - updated timestamp
- **Comparison CSV** includes:
  - from/to labels
  - movement type
  - all key deltas
  - severity and action
- Print-friendly summary has a dedicated report block and remains browser-printable with static assets only.

## Running Locally

### Open directly
Open `index.html` in a browser.

### Optional local server
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## GitHub Pages Compatibility

This app stays compatible with GitHub Pages:
- plain `index.html`, `style.css`, `script.js`
- localStorage-only persistence
- no API calls required

## Suggested Review Workflow

1. Update recipe and performance fields.
2. Save a snapshot for the review period.
3. Run comparison against prior snapshot/live state.
4. Check movement + priority ranking.
5. Export CSV/print summary for stakeholder review.
6. Add notes and repeat on schedule.
