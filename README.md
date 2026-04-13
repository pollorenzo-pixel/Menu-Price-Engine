# Menu Price Engine (Stage 1)

A practical internal pricing calculator for restaurant menu engineering at **Kiju**.

This static web app helps teams quickly calculate suggested selling prices, compare margins, and test delivery-safe pricing for individual menu items.

## What this tool does

The app accepts recipe and costing inputs, then instantly computes:

- Total ingredient cost for the full recipe
- Ingredient cost per portion
- Total cost per portion (with packaging, and with packaging + labour)
- Suggested net selling price from a target food cost %
- Rounded suggested price using configurable rounding rules
- VAT-inclusive price
- Delivery-adjusted recommended price (commission aware)
- Gross profit per portion
- Actual food cost % at both rounded and manual prices

It also includes:

- Dynamic ingredient rows (add/remove)
- Validation warnings for invalid values/unit mismatches
- Pricing insight guidance box
- Local storage persistence (auto-save and auto-restore)
- A realistic example loader (Chicken Banh Mi)

## Run locally

Because this is a static app, you can run it directly:

1. Clone/download the repository
2. Open `index.html` in your browser

Optional (recommended for consistent local behavior):

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In your repository settings, open **Pages**.
3. Set source to the branch you want (commonly `main`) and folder `/ (root)`.
4. Save and wait for deployment.

Since this app uses only static files (`html/css/js`), it is fully GitHub Pages compatible.

## File structure

```text
.
├── index.html   # UI structure and app layout
├── style.css    # Dark, professional responsive styling
├── script.js    # Logic: calculations, validation, rendering, localStorage
└── README.md    # Project documentation
```

## Stage 1 feature summary

- Single-page internal tool interface
- Mobile-friendly two-panel layout (stacks on small screens)
- Ingredient cost engine with unit conversions (`g/kg`, `ml/l`, `unit`)
- Configurable pricing controls (target %, VAT %, delivery %, rounding)
- Instant results panel and practical pricing insights
- Form reset and example dataset loading
- Automatic state persistence via `localStorage`

## Stage 2 expansion ideas

- Multi-item library with saved menu items
- Category-level margin dashboards
- CSV import/export for recipe costing
- Daypart/channel pricing modes (dine-in, takeaway, delivery)
- User roles and approval workflow (when backend is introduced)
- Ingredient master data and supplier price versioning
- Printable costing sheets and reporting exports

