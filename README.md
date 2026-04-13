# Menu Price Engine — Mode-Based Stage 4 Workspace

Menu Price Engine is a **static-file-only** restaurant costing and menu engineering app for **Kiju**.

This version refactors the interface into a **mode-based layout** so the app is no longer crowded into one long page.

## New Information Architecture

When the app opens, users now land on **Home / Command Center**.

From Home, they can move into focused workspaces:

1. **Home**
2. **Recipes & Costing**
3. **Menu Analysis**
4. **Reports & Snapshots**
5. **Weekly Review**
6. **Ingredient Library**

This keeps the first view calm and operationally focused, while preserving all Stage 4 capabilities.

## Home / Command Center

Home now prioritises:

1. Key KPIs
2. Urgent attention items
3. Next action shortcuts
4. Recent snapshot / review status

Home intentionally avoids showing every editor, matrix, and table at once.

## Mode Responsibilities

### 1) Recipes & Costing
- recipe list + search/filter
- recipe editor fields
- ingredient rows
- costing and pricing outputs

### 2) Menu Analysis
- popularity vs profitability matrix
- menu engineering table
- class/action analysis filters

### 3) Reports & Snapshots
- snapshot creation controls
- period comparison controls
- dashboard highlights + priorities
- snapshot list and comparison table
- CSV export + print summary + copy summary

### 4) Weekly Review
- full guided weekly ritual (Step 1–9)
- focus selection
- decision capture
- saved review logs

### 5) Ingredient Library
- add/edit/delete ingredients
- supplier + notes management
- ingredient usage visibility

## What Stayed Compatible

This refactor preserves:
- existing calculation and classification logic
- localStorage data model compatibility
- Stage 4 comparison/reporting features
- Weekly Review workflow
- static deployment model
- GitHub Pages compatibility

## Running Locally

Open `index.html` directly, or run:

```bash
python -m http.server 8000
```

Then browse to `http://localhost:8000`.
