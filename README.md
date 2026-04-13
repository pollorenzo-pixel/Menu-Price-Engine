# Menu Price Engine (Ingredients / Recipes / Dishes Model)

Menu Price Engine is a **static-file-only** app (GitHub Pages compatible) for costing and menu decision support.

## Core model

The app uses a strict three-level structure:

1. **Ingredients** = what you buy
   - Raw purchased supplier items only.
   - Contains purchase price, pack size/unit, supplier, and notes.

2. **Recipes** = what you prep
   - Prepared components (sauces, dressings, cooked proteins, toppings, etc.).
   - Production costing only (`total batch cost`, `cost per yield unit`).

3. **Dishes** = what you sell
   - Customer-facing menu items.
   - Can use raw ingredients, prep recipes, or both in one dish.
   - Commercial fields live only here.

## Pricing Intelligence (refined)

### What changed in this refinement pass
- Final recommendations are now less formula-dominant and more context-led.
- Margin Driver logic now protects contribution on low-cost, high-value items (for example wings).
- Market-based inputs behave cleanly when range values are provided in either order.
- Inputs in Dish editor are clearer and grouped into **Positioning** and **Market Anchors**.
- Rationale and flags are shorter, more human, and capped to reduce noise.
- Mobile presentation is cleaner with lower visual clutter in the Pricing Intelligence area.

### Dish-level Pricing Intelligence inputs
Each Dish includes:

- `pricingStrategy`
  - **Standard**: balanced
  - **Market-Based**: stronger market pull
  - **Margin Driver**: protects contribution
  - **Traffic Builder**: tighter pricing with risk checks
  - **Premium Signature**: supports premium positioning
- `labourIntensity` (Low / Medium / High)
- `perceivedValue` (Low / Medium / High)
- `menuRole`
  - Core Main, Side / Add-On, Signature Item, Combo Driver, Traffic Builder, High Margin Support
- Optional market anchors:
  - `marketLowPrice`
  - `marketHighPrice`
- Optional hard floor:
  - `minimumAcceptablePrice`

### Pricing logic summary
1. Build formula price from cost and target food cost.
2. Apply strategic lift from labour, value, and menu role.
3. Blend strategic premium + market pull on top of formula (instead of rigid weighted average).
4. If market range exists, keep recommendation in a sensible corridor around that range.
5. Apply floors (strategy floor, market-aware floor, operator minimum).
6. Apply rounding rule.

### Outputs shown in Dish editor
- Portion cost
- Formula price
- Market-guided range
- Final recommended price
- Food cost % at final
- Confidence score
- Gap vs current price
- Short rationale bullets
- Reduced, high-signal flags

## Migration safety

Older Dish objects are normalized safely with defaults:

- `pricingStrategy = Standard`
- `labourIntensity = Medium`
- `perceivedValue = Medium`
- `menuRole = Core Main`
- `marketLowPrice = null`
- `marketHighPrice = null`
- `minimumAcceptablePrice = null`

Additionally, if legacy market values are reversed (`low > high`), they are corrected during normalization.

Legacy mixed records continue to be split safely into Recipes vs Dishes.

## Sample data

If localStorage is empty, sample data is auto-seeded to demonstrate Pricing Intelligence:

- **Beer Battered Wings** (Margin Driver, high labour/high value, market-guided)
- **Grilled Chicken Bowl** (Standard strategy)

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
