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

## New: Pricing Intelligence

### Why this exists
Traditional formula pricing (`portion cost / target food cost %`) is still useful, but not enough by itself for real menu decisions.

Some dishes should be priced above formula because of labour burden, market expectation, perceived value, and strategic role (for example, wings, add-ons, drinks, signature items).

Pricing Intelligence keeps formula pricing, then layers practical commercial logic on top.

### Dish-level Pricing Intelligence inputs
Each Dish now includes:

- `pricingStrategy`
  - **Standard**: mostly cost-led, balanced
  - **Market-Based**: stronger weight on market range
  - **Margin Driver**: protects contribution and margin
  - **Traffic Builder**: tighter strategic pricing with margin warnings
  - **Premium Signature**: premium-friendly recommendation
- `labourIntensity` (Low / Medium / High)
- `perceivedValue` (Low / Medium / High)
- `menuRole`
  - Core Main, Side / Add-On, Signature Item, Combo Driver, Traffic Builder, High Margin Support
- Optional market range:
  - `marketLowPrice`
  - `marketHighPrice`
- Optional manual floor:
  - `minimumAcceptablePrice`

### Pricing Intelligence outputs
For each dish, the app displays:

1. Portion cost
2. Formula price
3. Market-guided range
4. Strategic recommended price
5. Final recommended price (after floor checks + rounding)
6. Food cost % at final recommendation
7. Confidence score
8. Pricing rationale
9. Pricing flags

### How final recommended price is derived

1. **Formula price**
   - `portion cost / (target food cost % / 100)`

2. **Strategic lift layer**
   - Labour intensity, perceived value, and menu role add transparent uplift.

3. **Strategy weighting**
   - Formula, market midpoint, and strategic uplift are blended differently by strategy type.

4. **Market-guided behavior**
   - If market range is provided, midpoint influences recommendation.
   - Formula far below market triggers a rationale + flags.

5. **Price floor logic**
   - Final recommendation is constrained by applicable floors:
     - formula protection (for selected strategies)
     - market low (for market-aware strategies)
     - operator minimum acceptable price
     - internal strategic floor for stronger margin protection

6. **Rounding**
   - Existing rounding rule is applied at the end.

## Smart business behavior included

- Margin Driver avoids unrealistically low recommendations.
- Traffic Builder can stay tighter but warns on weak margin.
- High labour + high perceived value supports stronger pricing.
- Very low food cost % is not treated as an error for margin/premium strategies.
- Flags include market positioning and contribution risk/opportunity cues.

## Migration safety

Older Dish objects are safely normalized with defaults:

- `pricingStrategy = Standard`
- `labourIntensity = Medium`
- `perceivedValue = Medium`
- `menuRole = Core Main`
- `marketLowPrice = null`
- `marketHighPrice = null`
- `minimumAcceptablePrice = null`

Legacy mixed records continue to be split safely into Recipes vs Dishes.

## Sample data

If localStorage is empty, sample data is auto-seeded to demonstrate Pricing Intelligence:

- **Beer Battered Wings** (Margin Driver, high labour/high value, market-guided, significantly higher strategic recommendation)
- **Grilled Chicken Bowl** (Standard strategy, closer formula vs final recommendation)

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
