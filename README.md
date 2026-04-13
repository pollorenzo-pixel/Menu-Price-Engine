# Menu Price Engine — Stage 3 (Refinement Pass)

Menu Price Engine is a static-file internal app for **Kiju** that combines:

- Stage 2 recipe costing
- Stage 3 menu engineering analytics
- Recommendation-ready dashboard summaries

No build step, backend, or framework is required.

---

## Stage 3 Refinement Goals Completed

This pass focused on **stability, quality, and decision usefulness** while preserving Stage 2 compatibility.

### 1) Stage 2 compatibility + migration safety

- Retains Stage 2 keys fallback (`mpe_v2_*`) when v3 storage is empty.
- Migration now tolerates common legacy field names (e.g. servings/yield aliases, selling price aliases, units sold aliases).
- Missing Stage 3 fields are safely defaulted.
- All recipes are normalized to `storageVersion: 3`.

### 2) Selling price + units sold persistence correctness

- `sellingPrice` migration uses safe fallbacks and rounded recommendation when needed.
- `unitsSold` is normalized to a non-negative integer during migration and form reads.
- Dashboard and analysis table display units with integer formatting.

### 3) Revenue + gross profit formula correctness

Per-item metrics:

- `revenue = effectiveMenuPrice * unitsSold` (unless override supplied)
- `totalIngredientCostPeriod = totalCostPerPortionExclLabour * unitsSold`
- `totalGrossProfit = revenue - totalIngredientCostPeriod`

This ensures gross profit remains mathematically consistent with overrides.

### 4) Classification + actions quality

- Classification remains average-based (Star / Plowhorse / Puzzle / Dog) over active items.
- Recommended actions are now more practical and operational (clear tests, concrete price/cost moves, rescue windows).

### 5) Dashboard + analysis usability

- Improved empty states for recipe list, ingredient library, and analysis table.
- Sorting column now visually highlighted.
- Analysis table includes inactive items when selected by filter.
- Low-data dashboard messaging is explicit.

### 6) Visual matrix clarity + responsiveness

- Added axis labels and average threshold lines.
- Long item labels are truncated for readability.
- Mobile responsiveness improved for point labels and chart height.

### 7) GBP formatting consistency

- Currency formatting is centralized via `Intl.NumberFormat('en-GB', { currency: 'GBP' })`.
- Units are displayed consistently as integers where appropriate.

---

## Tech + Hosting Constraints

- HTML + CSS + Vanilla JS only
- localStorage only
- No Node runtime requirement in production
- Static-file compatible
- GitHub Pages compatible

---

## Files

```text
.
├── index.html
├── style.css
├── script.js
└── README.md
```

---

## Run Locally

### Option A: Open directly

Open `index.html` in a browser.

### Option B: Local static server

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

---

## Deploy to GitHub Pages

1. Push repository to GitHub.
2. Open **Settings → Pages**.
3. Choose your branch and root folder.
4. Save.

No build step is required.

---

## Storage Keys

### Stage 3 keys

- `mpe_v3_ingredients`
- `mpe_v3_recipes`
- `mpe_v3_active_draft`
- `mpe_v3_seeded`
- `mpe_v3_dashboard_prefs`

### Stage 2 fallback keys

- `mpe_v2_ingredients`
- `mpe_v2_recipes`
- `mpe_v2_active_draft`
- `mpe_v2_seeded`
