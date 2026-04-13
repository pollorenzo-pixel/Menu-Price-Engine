# Menu Price Engine — Stage 4

Menu Price Engine is a static-file internal restaurant costing and menu review system for **Kiju**.

Stage 4 extends Stage 3 by adding a practical reporting workflow:
- save performance snapshots by period
- compare periods (snapshot vs snapshot, or live vs snapshot)
- track item movement and classification shifts
- generate action priorities for management review
- export CSV and print-friendly summaries

---

## What Stage 4 Adds

1. **Reporting Snapshots**
   - Create named snapshots from current live menu metrics.
   - Save period labels and notes.
   - Keep immutable period records for review meetings.

2. **Period Comparison**
   - Compare:
     - Live vs Snapshot
     - Snapshot A vs Snapshot B
   - Includes revenue, gross profit, units, food-cost movement, and item-level deltas.

3. **Item Movement / Trend Analysis**
   - Shows item-level movement:
     - Price, units, revenue, total GP, food cost %
     - Classification shift (e.g. `Star → Plowhorse`)

4. **Review Dashboard**
   - Current overview cards + comparison-aware cards.
   - Key highlights (top drivers, weakest margins, flagged issues).

5. **Action Priority View**
   - Ranked priority list generated using operational rules:
     - high food cost
     - priced below recommendation
     - high volume weak margin
     - low volume strong margin
     - dog classification
     - near-zero margin

6. **Exports**
   - Current analysis CSV
   - Comparison CSV
   - Print-friendly review summary view
   - Copyable text summary for notes/chat/email

7. **Review Notes**
   - Snapshot notes
   - Comparison notes persisted in localStorage

---

## Stage 3 Compatibility

Stage 4 keeps existing Stage 3 functionality:
- ingredient library CRUD
- recipe CRUD + duplicate
- autosaved draft
- costing calculations
- performance fields
- menu engineering classification
- dashboard, analysis table, matrix

Migration safety:
- loads Stage 4 keys first (`mpe_v4_*`)
- falls back to Stage 3 keys (`mpe_v3_*`) when needed
- normalizes legacy field aliases during migration

---

## Data Model / localStorage

Primary keys:
- `mpe_v4_ingredients`
- `mpe_v4_recipes`
- `mpe_v4_active_draft`
- `mpe_v4_snapshots`
- `mpe_v4_prefs`
- `mpe_v4_compare_notes`
- `mpe_v4_seeded`

Snapshot object includes:
- `id`, `name`, `periodLabel`, `createdAt`, `notes`
- item-level metrics/classification/actions/flags
- summary totals for that period

All storage parsing uses safe fallbacks to avoid crashes from malformed localStorage.

---

## Sample Data

When storage is empty, the app seeds:
- Stage 3-style ingredients and recipes
- two Stage 4 snapshots with meaningful differences:
  - `Last 30 Days`
  - `Current Month`

The seeded comparisons include:
- improved items
- worsened items
- class movements
- above-target food cost flags
- below-recommendation price flags

---

## Running Locally

### Option A (no server)
Open `index.html` directly in your browser.

### Option B (local static server)
```bash
python -m http.server 8000
```
Open `http://localhost:8000`.

---

## Deploy to GitHub Pages

1. Push repo to GitHub.
2. Open **Settings → Pages**.
3. Select your branch/root.
4. Save.

No backend or build step required.

---

## Review Workflow (Suggested)

1. Keep recipe/performance data current.
2. Save a snapshot at each review checkpoint.
3. Run comparison (current vs prior period).
4. Review movement + priority list.
5. Add notes and export summary/CSV for discussion.
6. Repeat monthly/weekly.

---

## Current Limitations

- no backend/database
- no cross-user sync
- no full historical charting yet
- no multi-brand rollups yet

---

## Stage 5 Roadmap (Suggested)

- multi-period trend charts
- brand dimension + rollups (Kiju/Yume)
- period/date filters across snapshots
- deeper action scoring and workflow tracking
- richer report templates

