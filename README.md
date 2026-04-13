# Menu Price Engine — Stage 3

Menu Price Engine Stage 3 is a static-file internal dashboard for **Kiju** that combines recipe costing with menu engineering decisions.

It extends Stage 2 (ingredient library + saved recipes) with performance tracking, menu classification, and dashboard-level decision support.

---

## What Stage 3 Means

Stage 2 answered: **"What should this item cost and be priced at?"**

Stage 3 adds: **"How is this item performing commercially, and what should we do next?"**

Each menu item now includes:
- Costing data (ingredients, packaging, labour, suggested prices)
- Performance data (selling price, units sold, optional override and notes)
- Menu engineering classification (Star / Plowhorse / Puzzle / Dog)
- Recommended actions and operational flags

---

## Menu Engineering Model Used

Classification is calculated for **active items** using menu averages:

1. Compute average units sold across active items
2. Compute average gross profit per portion across active items
3. For each item:
   - popularity = high if `unitsSold >= averageUnits`
   - profitability = high if `grossProfitPerPortion >= averageGrossProfit`
4. Assign category:
   - **Star**: high popularity + high profitability
   - **Plowhorse**: high popularity + low profitability
   - **Puzzle**: low popularity + high profitability
   - **Dog**: low popularity + low profitability

If there is insufficient active data, the UI shows an explicit fallback state instead of forcing a bad classification.

---

## Stage 3 Feature List

### 1) Stage 2 Compatibility Preserved
- Ingredient library create/edit/delete/search
- Saved recipe create/save/update/delete/duplicate
- Draft autosave and restore
- Costing calculations and pricing insight panel
- localStorage persistence and restore

### 2) Performance Inputs Per Menu Item
- Current selling price
- Units sold in period
- Reporting period label
- Internal score (optional)
- Revenue override (optional)
- Active/inactive toggle
- Internal notes

### 3) Contribution Metrics
Per item:
- Portion cost (excl labour)
- Gross profit per portion
- Food cost %
- Revenue for period
- Total ingredient cost for period
- Total gross profit for period
- Contribution per item sold

### 4) Dashboard Summary
Across active items:
- Total active items
- Total units sold
- Total revenue
- Total gross profit
- Average selling price
- Average food cost %
- Average gross profit per portion
- Counts of Star / Plowhorse / Puzzle / Dog

Also includes:
- Top 3 by units sold
- Top 3 by total gross profit
- Priority insight list
- Bulk flag summary

### 5) Menu Engineering Table
- Search by item name
- Filter by classification
- Sort by key columns (header click)
- Shows classification, financial metrics, actions, and flags

### 6) Recommended Actions + Flags
Action guidance examples:
- Star → Promote and protect
- Plowhorse → Review pricing/cost
- Puzzle → Improve visibility and push sales
- Dog → Consider redesign/removal

Operational flags include:
- Food cost above target
- Selling price below recommendation
- Low units sold
- Near-zero/negative margin
- Inactive item
- Missing performance data

### 7) Visual Matrix (No chart library)
A pure HTML/CSS/JS matrix plotting:
- X-axis = popularity (units sold)
- Y-axis = profitability (gross profit/portion)

Quadrants are labeled Star / Plowhorse / Puzzle / Dog.

### 8) Safe Migration From Stage 2
When Stage 3 keys are empty, app checks Stage 2 keys and migrates automatically.
Missing Stage 3 fields are defaulted safely:
- `sellingPrice` defaults to rounded recommendation if possible
- `unitsSold` defaults to `0`
- `isActive` defaults to `true`

IDs and timestamps are preserved where available.

### 9) Seeded Sample Data (Stage 3 Ready)
When storage is empty, app seeds realistic data including:
- Chicken Banh Mi
- Chicken Salad Bowl
- Tofu Salad Bowl
- Wings

The seed is intentionally varied so dashboard and classification are useful immediately.

---

## Tech Stack + Constraints

- HTML
- CSS
- Vanilla JavaScript
- localStorage only
- No React/Vue/TypeScript
- No backend/database/build tools
- Works as static files + GitHub Pages compatible

---

## File Structure

```text
.
├── index.html
├── style.css
├── script.js
└── README.md
```

---

## Run Locally

Option A (fastest):
1. Download or clone the repo
2. Open `index.html` in your browser

Option B (local server):
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

---

## Deploy to GitHub Pages

1. Push repository to GitHub
2. Open **Settings → Pages**
3. Choose deployment source branch and root folder
4. Save

No build step is required.

---

## localStorage Keys

Stage 3 keys:
- `mpe_v3_ingredients`
- `mpe_v3_recipes`
- `mpe_v3_active_draft`
- `mpe_v3_seeded`
- `mpe_v3_dashboard_prefs`

Legacy compatibility keys read during migration:
- `mpe_v2_ingredients`
- `mpe_v2_recipes`
- `mpe_v2_active_draft`
- `mpe_v2_seeded`

---

## Current Limitations

- Browser-local, single-user data only
- No cloud sync / multi-location collaboration
- No import/export tooling yet
- No historical trend charts over time periods
- No role-based access controls

---

## Possible Stage 4 Roadmap

- CSV import/export for ingredients and menu performance
- Channel-specific pricing (dine-in / takeaway / delivery)
- Weekly/monthly trend and cohort views
- Multi-brand support (e.g., Kiju + Yume)
- Price-change simulation mode with impact forecast
- Optional backend sync for team workflows

