# Menu Price Engine (Ingredients / Recipes / Dishes Model)

Menu Price Engine is a **static-file-only** app (GitHub Pages compatible) for costing and menu decision support.

## Core model

The app uses a strict three-level structure:

1. **Ingredients** = what you buy
   - Raw purchased supplier items only.
   - Contains purchase price, pack size/unit, supplier, and notes.
   - Ingredient Library view is grouped by supplier (accordion sections) with a dedicated **No Supplier** group for unassigned items, plus search/filter controls.

2. **Recipes** = what you prep
   - Prepared components (sauces, dressings, cooked proteins, toppings, etc.).
   - Production costing only.
   - Recipe metrics are limited to:
     - total batch cost
     - cost per yield unit
   - Recipe forms intentionally do **not** contain selling/commercial fields.

3. **Dishes** = what you sell
   - Customer-facing menu items.
   - Can use:
     - raw ingredients directly,
     - recipes/components,
     - or both in the same dish.
   - Commercial fields live only here:
     - target food cost %
     - packaging per portion
     - VAT
     - delivery commission
     - rounding rule
     - selling price / manual override
     - units sold / reporting period

## Navigation and workflow clarity

Top navigation is organized by workflow order:

1) Ingredients → 2) Recipes → 3) Dishes → 4) Analysis → 5) Reports → 6) Weekly Review

- Home highlights dish-level KPIs and actions.
- Quick-jump buttons are included to reduce context switching confusion.

## Dishes-only commercial surfaces

The following sections all run on **Dishes**:

- Home
- Menu Analysis
- Reports & Snapshots
- Weekly Review

## Migration safety from old mixed objects

A safe best-effort migration runs on load:

- If v5 keys are missing, legacy v4 keys are read.
- Legacy mixed recipe objects are inspected.
- Legacy objects with commercial menu fields are migrated to **Dish** records.
- Legacy production-only objects remain **Recipe** records.
- Ingredient rows are preserved as component/input rows where possible.

Additional safety pass:

- If existing v5 recipe data still contains legacy commercial fields (mixed objects), those entries are split safely:
  - converted to Dishes,
  - removed from Recipes,
  - normalized and persisted.

## Mobile layout

The mobile layout is optimized for clarity:

- Navigation switches to horizontal scroll chips on narrower screens.
- Form grids collapse to single-column.
- Header and action rows wrap cleanly.

## Deployment constraints

- No backend
- localStorage only
- static files only
- works on GitHub Pages

## Run locally

Open `index.html` directly, or run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.
