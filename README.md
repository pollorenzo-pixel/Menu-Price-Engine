# Menu Price Engine (Refactored Model)

Menu Price Engine is a **static-file-only** app (GitHub Pages compatible) for costing and menu decision support.

## Core model (now corrected)

The app now separates three entities clearly:

1. **Ingredients** = what you buy
   - Raw purchased supplier items only.
   - Stored with purchase price, pack size/unit, supplier, and notes.

2. **Recipes** = what you prep
   - Prepared components (sauces, dressings, cooked proteins, toppings, etc.).
   - Production costing only.
   - Recipe output metrics are:
     - total batch cost
     - cost per yield unit

3. **Dishes** = what you sell
   - Customer-facing menu items.
   - Can use:
     - raw ingredients directly,
     - recipes/components,
     - or both.
   - Commercial fields live here (pricing, sales, reporting, and menu-engineering analysis).

## What moved out of Recipes

Dish/commercial fields were removed from recipe editing and moved to the Dish model:
- target food cost %
- packaging cost
- VAT rate
- delivery commission
- rounding rule
- suggested / rounded selling prices (calculated)
- current selling price
- manual override
- units sold
- reporting period
- menu-engineering classification inputs
- weekly review focus fields

## Migration from old mixed model

A safe best-effort migration runs automatically on load:

- Reads legacy keys (`mpe_v4_*`) if new keys (`mpe_v5_*`) do not exist.
- Legacy recipe objects are inspected.
- If an old recipe contains commercial menu fields (e.g. selling price, units sold, target food cost, packaging), it is migrated to a **Dish**.
- If it does not, it is retained as a **Recipe**.
- Ingredient costing rows are preserved as component/input rows where possible.
- Migration is non-destructive and designed to avoid crashes if old data is incomplete.

## Information architecture / navigation

Modes are now explicit:
- Home
- Ingredients
- Recipes
- Dishes
- Menu Analysis
- Reports & Snapshots
- Weekly Review

## Stage 4 / Weekly behavior

- Home KPIs are **dish-level**.
- Menu Analysis works on **dishes**.
- Reports and snapshots operate on **dishes**.
- Weekly Review focuses on **dishes** and their recommended actions.

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
