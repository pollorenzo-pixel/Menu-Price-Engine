# Menu Price Engine — Stage 2

Menu Price Engine Stage 2 is a static-file restaurant costing dashboard for **Kiju**.  
It upgrades Stage 1 from a single calculator into a reusable internal costing system with an ingredient library and saved recipe management.

## Who this is for

This tool is built for internal hospitality operations teams:
- founders and managers
- chefs and kitchen leads
- menu engineering and profitability reviews

It is not designed as a consumer product.

## Stage 2 Features (Refined Pass)

### 1) Ingredient Library
- Add, edit, delete ingredients
- Store purchase price, pack size, pack unit, supplier, notes
- Search ingredients by name
- Case-insensitive duplicate protection
- Persisted in `localStorage`

### 2) Saved Recipe Management
- Create, save, update, duplicate, and delete recipes
- Search saved recipes
- Sort and display by most recently updated
- Restore full recipe editor state and ingredient rows
- Recipe cards show category, rounded recommended price, and food cost %

### 3) Snapshot-Safe Ingredient Rows
- Recipe rows can link to library ingredients, then override values
- Each saved row keeps snapshot data (name/price/pack/unit)
- Recipe costing still works even if library entries later change or are deleted

### 4) Robust Calculation Engine
- Unit conversion (`g/kg`, `ml/l`, `unit`)
- Handles invalid conversions safely with warnings
- Calculates:
  - total ingredient cost
  - cost per portion
  - cost per portion with packaging/labour
  - suggested net price
  - rounded price
  - VAT-inclusive price
  - delivery-adjusted recommendation
  - gross profit and actual food cost metrics

### 5) Pricing Insight Panel
- Generates short business guidance based on calculated results
- Highlights food cost pressure, delivery margin risk, and profitability signals

### 6) Local Storage Persistence
- Separate keys for ingredients, recipes, and active draft
- Auto-save draft while editing
- Restore draft and saved datasets on reload
- Safe JSON parsing fallbacks to prevent crashes on corrupted storage values
- Draft restore timestamp shown in UI for operator confidence

### 7) UX and Validation Polish
- Cleaner scan-friendly saved recipe list cards
- Ingredient library now shows recipe usage count for safe delete decisions
- Clear but non-intrusive validation (inline message + light field highlights)
- Consistent GBP formatting across cards, tables, and results
- Improved mobile spacing and visual hierarchy without any build tooling

### 8) Sample Data Seeding
If storage is empty, Stage 2 seeds realistic starter data:
- Ingredient set including baguette, chicken thigh, sauces, greens, takeaway packaging, etc.
- Two sample recipes:
  - Chicken Banh Mi
  - Chicken Salad Bowl

## File Structure

```text
.
├── index.html   # Dashboard markup (3-panel layout + ingredient library modal)
├── style.css    # Dark professional styling and responsive behavior
├── script.js    # State model, storage, validation, rendering, calculations
└── README.md    # Project documentation
```

## Run Locally

1. Clone or download this repository.
2. Open `index.html` directly in a browser.

Optional local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages Deployment

1. Push repo to GitHub.
2. In **Settings → Pages**, choose branch and root folder.
3. Save and wait for deployment.

No build pipeline is required (pure static files).

## localStorage Keys

- `mpe_v2_ingredients`
- `mpe_v2_recipes`
- `mpe_v2_active_draft`
- `mpe_v2_seeded`

## Sample Data Behavior

Sample data is only auto-seeded when all storage is empty and no seed flag exists.  
After first seed, user data is preserved across reloads.

## Stability/Compatibility Notes

- Pure static files only (`index.html`, `style.css`, `script.js`) for easy GitHub Pages hosting.
- No framework, no bundler, no server dependency.
- Saved recipes preserve ingredient snapshots to avoid breakage after library edits/deletes.
- Unit conversion is guarded by unit families (`weight`, `volume`, `count`) and returns warnings instead of crashing.

## Current Stage 2 Limitations

- Single-user browser-local data only
- No cloud sync / team collaboration
- No import/export CSV yet
- No authentication or approval workflow
- No historical ingredient price versioning

## Suggested Stage 3 Roadmap

- CSV/Excel import-export for ingredients and recipes
- multi-channel pricing profiles (dine-in / takeaway / delivery)
- margin analytics dashboard across all recipes
- change logs / audit trail
- optional backend sync for shared team access
- batch costing updates from supplier price changes
