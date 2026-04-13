const STORAGE_VERSION = 4;
const STORAGE_KEYS = {
  ingredients: 'mpe_v4_ingredients', recipes: 'mpe_v4_recipes', draft: 'mpe_v4_active_draft', seeded: 'mpe_v4_seeded',
  snapshots: 'mpe_v4_snapshots', prefs: 'mpe_v4_prefs', compareNotes: 'mpe_v4_compare_notes',
  legacyIngredients: 'mpe_v3_ingredients', legacyRecipes: 'mpe_v3_recipes', legacyDraft: 'mpe_v3_active_draft', legacySeeded: 'mpe_v3_seeded',
};
const PACK_UNITS = ['g', 'kg', 'ml', 'l', 'unit'];
const UNIT_GROUP = { g: 'weight', kg: 'weight', ml: 'volume', l: 'volume', unit: 'count' };
const BASE_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, unit: 1 };

const $ = (id) => document.getElementById(id);
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
const nowIso = () => new Date().toISOString();
const cleanText = (v) => String(v ?? '').trim();
const toNumber = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const safeLower = (v) => cleanText(v).toLowerCase();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const fmtCurrency = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(toNumber(v, 0));
const fmtPercent = (v) => `${toNumber(v, 0).toFixed(2)}%`;
const fmtInt = (v) => Math.round(toNumber(v, 0)).toLocaleString('en-GB');
const shortDateTime = (iso) => new Date(iso).toLocaleString();

const state = {
  ingredients: [], recipes: [], snapshots: [], draft: null,
  activeRecipeId: null, ingredientEditingId: null,
  recipeSearch: '', recipeStatusFilter: 'all', ingredientSearch: '', analysisSearch: '', analysisClassFilter: 'all',
  compareSearch: '', compareMovementFilter: 'all',
  sort: { key: 'name', dir: 'asc' }, csort: { key: 'revenueChange', dir: 'desc' },
  prefs: { foodCostFlagTarget: 32, lowUnitsThreshold: 25 },
  menuEngine: null, comparison: null,
};

const dom = {
  recipeList: $('recipe-list'), recipeCount: $('recipe-count'), recipeSearch: $('recipe-search'), recipeStatusFilter: $('recipe-status-filter'),
  ingredientRows: $('ingredient-rows'), template: $('ingredient-row-template'),
  editorErrors: $('editor-errors'), calcWarnings: $('calc-warnings'), draftState: $('draft-state'),
  insightList: $('insight-list'), itemFlagList: $('item-flag-list'), periodLabel: $('period-label'), modeIndicator: $('mode-indicator'),
  analysisSearch: $('analysis-search'), analysisClassFilter: $('analysis-class-filter'), analysisTable: $('analysis-table'), analysisBody: $('analysis-body'),
  dashboardCards: $('dashboard-cards'), menuInsightList: $('menu-insight-list'), priorityList: $('priority-list'), snapshotList: $('snapshot-list'), comparisonSummary: $('comparison-summary'),
  reviewSummaryOutput: $('review-summary-output'),
  matrixChart: $('matrix-chart'), matrixFallback: $('matrix-fallback'),
  compareSearch: $('compare-search'), compareMovementFilter: $('compare-movement-filter'), comparisonTable: $('comparison-table'), comparisonBody: $('comparison-body'),
  snapshotName: $('snapshot-name'), snapshotPeriod: $('snapshot-period'), snapshotNotes: $('snapshot-notes'), snapshotFeedback: $('snapshot-feedback'),
  compareLeft: $('compare-left'), compareRight: $('compare-right'), comparisonNotes: $('comparison-notes'),
  actions: {
    openLib: $('open-library-btn'), closeLib: $('close-library-btn'), newRecipe: $('new-recipe-btn'), addRow: $('add-row-btn'),
    save: $('save-recipe-btn'), update: $('update-recipe-btn'), duplicate: $('duplicate-recipe-btn'), del: $('delete-recipe-btn'), reset: $('reset-form-btn'),
    createSnapshot: $('create-snapshot-btn'), runCompare: $('run-compare-btn'), clearCompare: $('clear-compare-btn'),
    exportCurrentCsv: $('export-current-csv-btn'), exportCompareCsv: $('export-compare-csv-btn'), printSummary: $('print-summary-btn'), copySummary: $('copy-summary-btn'),
  },
  results: {
    totalIngredient: $('res-total-ingredient'), totalPortion: $('res-total-portion'), rounded: $('res-rounded'), gross: $('res-gross'), foodRounded: $('res-food-rounded'),
    totalRevenue: $('res-total-revenue'), totalGrossProfit: $('res-total-gross-profit'), classification: $('res-classification'), action: $('res-action'),
  },
  fields: {
    name: $('recipe-name'), category: $('recipe-category'), portions: $('portions-yielded'), target: $('target-food-cost'), packaging: $('packaging-cost'), labour: $('labour-cost'),
    vat: $('vat-rate'), delivery: $('delivery-commission'), rounding: $('rounding-rule'), manual: $('manual-price'), sellingPrice: $('selling-price'), unitsSold: $('units-sold'),
    reportingPeriod: $('reporting-period'), internalScore: $('internal-score'), isActive: $('is-active'), revenueOverride: $('revenue-override'), itemNotes: $('item-notes'),
  },
  library: {
    modal: $('library-modal'), errors: $('library-errors'), count: $('ingredient-count'), body: $('ingredient-library-body'), search: $('ingredient-search'),
    name: $('lib-name'), price: $('lib-price'), packSize: $('lib-pack-size'), packUnit: $('lib-pack-unit'), supplier: $('lib-supplier'), notes: $('lib-notes'),
    add: $('add-ingredient-btn'), update: $('update-ingredient-btn'), clear: $('clear-ingredient-form-btn'),
  },
};

function setInlineMessage(el, message, type = 'warn') { el.textContent = message || ''; el.classList.toggle('success', type === 'success'); }
function safeParse(raw, fallback) { try { const v = JSON.parse(raw); return v ?? fallback; } catch { return fallback; } }
function getStoredArray(k) { const v = safeParse(localStorage.getItem(k), []); return Array.isArray(v) ? v : []; }
function getStoredObject(k, f = {}) { const v = safeParse(localStorage.getItem(k), f); return v && typeof v === 'object' ? v : f; }
function setStored(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function defaultIngredientRow() { return { rowId: uid('row'), ingredientId: '', ingredientNameSnapshot: '', purchasePriceSnapshot: 0, packSizeSnapshot: 1, packUnitSnapshot: 'g', amountUsed: 0, useUnit: 'g', calculatedCostUsed: 0 }; }
function defaultRecipe() {
  return {
    id: null, name: '', category: '', portionsYielded: 10, packagingCostPerPortion: 0, labourCostPerPortion: 0,
    targetFoodCostPercent: 30, vatRatePercent: 20, deliveryCommissionPercent: 30, roundingRule: 0.25, manualMenuPrice: '',
    ingredientRows: [defaultIngredientRow()], sellingPrice: 0, unitsSold: 0, reportingPeriod: 'Last 30 Days', internalScore: '', isActive: true,
    revenueOverride: '', itemNotes: '', createdAt: null, updatedAt: null, storageVersion: STORAGE_VERSION,
  };
}
function convertUnit(value, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || UNIT_GROUP[fromUnit] !== UNIT_GROUP[toUnit]) return { ok: false, value: 0 };
  return { ok: true, value: (value * BASE_FACTOR[fromUnit]) / BASE_FACTOR[toUnit] };
}

function migrateIngredient(raw) {
  return { id: cleanText(raw?.id) || uid('ing'), name: cleanText(raw?.name), purchasePrice: Math.max(0, toNumber(raw?.purchasePrice)), packSize: Math.max(0.0001, toNumber(raw?.packSize, 1)), packUnit: PACK_UNITS.includes(raw?.packUnit) ? raw.packUnit : 'g', supplier: cleanText(raw?.supplier), notes: cleanText(raw?.notes) };
}
function migrateRow(raw) {
  return { rowId: cleanText(raw?.rowId) || uid('row'), ingredientId: cleanText(raw?.ingredientId), ingredientNameSnapshot: cleanText(raw?.ingredientNameSnapshot ?? raw?.name), purchasePriceSnapshot: Math.max(0, toNumber(raw?.purchasePriceSnapshot ?? raw?.purchasePrice)), packSizeSnapshot: Math.max(0.0001, toNumber(raw?.packSizeSnapshot ?? raw?.packSize, 1)), packUnitSnapshot: PACK_UNITS.includes(raw?.packUnitSnapshot ?? raw?.packUnit) ? (raw?.packUnitSnapshot ?? raw?.packUnit) : 'g', amountUsed: Math.max(0, toNumber(raw?.amountUsed)), useUnit: PACK_UNITS.includes(raw?.useUnit) ? raw.useUnit : 'g', calculatedCostUsed: Math.max(0, toNumber(raw?.calculatedCostUsed)) };
}
function migrateRecipe(raw) {
  const seeded = { ...defaultRecipe(), ...raw };
  return {
    ...seeded, id: cleanText(raw?.id) || uid('rec'), name: cleanText(raw?.name), category: cleanText(raw?.category),
    portionsYielded: Math.max(0.01, toNumber(raw?.portionsYielded ?? raw?.servings, 10)),
    packagingCostPerPortion: Math.max(0, toNumber(raw?.packagingCostPerPortion ?? raw?.packagingCost)), labourCostPerPortion: Math.max(0, toNumber(raw?.labourCostPerPortion ?? raw?.laborCostPerPortion ?? raw?.labourCost)),
    targetFoodCostPercent: clamp(toNumber(raw?.targetFoodCostPercent ?? raw?.targetFoodCost, 30), 0.01, 99.99), vatRatePercent: Math.max(0, toNumber(raw?.vatRatePercent, 20)),
    deliveryCommissionPercent: Math.max(0, toNumber(raw?.deliveryCommissionPercent, 30)), roundingRule: toNumber(raw?.roundingRule, 0.25) || 0.25,
    manualMenuPrice: raw?.manualMenuPrice === '' ? '' : Math.max(0, toNumber(raw?.manualMenuPrice ?? raw?.menuPrice, 0)),
    sellingPrice: Math.max(0, toNumber(raw?.sellingPrice ?? raw?.currentSellingPrice ?? raw?.priceSoldAt, 0)), unitsSold: Math.max(0, Math.round(toNumber(raw?.unitsSold ?? raw?.salesUnits ?? raw?.qtySold, 0))),
    reportingPeriod: cleanText(raw?.reportingPeriod || 'Last 30 Days'), internalScore: raw?.internalScore === '' ? '' : clamp(toNumber(raw?.internalScore, 0), 0, 10),
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : true, revenueOverride: raw?.revenueOverride === '' ? '' : toNumber(raw?.revenueOverride, 0), itemNotes: cleanText(raw?.itemNotes),
    ingredientRows: Array.isArray(raw?.ingredientRows) && raw.ingredientRows.length ? raw.ingredientRows.map(migrateRow) : [defaultIngredientRow()], createdAt: cleanText(raw?.createdAt) || nowIso(), updatedAt: cleanText(raw?.updatedAt) || nowIso(), storageVersion: STORAGE_VERSION,
  };
}

function calculateRowCost(row) {
  const c = convertUnit(Math.max(0, toNumber(row.amountUsed)), row.useUnit, row.packUnitSnapshot);
  if (!c.ok) return { cost: 0, warning: `Cannot convert ${row.useUnit} to ${row.packUnitSnapshot}` };
  return { cost: (Math.max(0, toNumber(row.purchasePriceSnapshot)) / Math.max(0.0001, toNumber(row.packSizeSnapshot, 1))) * c.value, warning: '' };
}
function roundToRule(value, rule = 0.25) { return value > 0 ? Math.round(value / rule) * rule : 0; }
function calculateRecipeMetrics(recipe, options = {}) {
  const warnings = []; let totalIngredientCost = 0;
  const ingredientRows = (recipe.ingredientRows || []).map((r) => {
    const calc = calculateRowCost(r); totalIngredientCost += calc.cost; if (calc.warning && !options.suppressWarnings) warnings.push(calc.warning); return { ...r, calculatedCostUsed: calc.cost };
  });
  const portions = Math.max(0.01, toNumber(recipe.portionsYielded, 10));
  const ingredientCostPerPortion = totalIngredientCost / portions;
  const totalCostPerPortionExclLabour = ingredientCostPerPortion + Math.max(0, toNumber(recipe.packagingCostPerPortion));
  const totalCostPerPortionInclLabour = totalCostPerPortionExclLabour + Math.max(0, toNumber(recipe.labourCostPerPortion));
  const suggestedNetSellingPrice = totalCostPerPortionExclLabour / (Math.max(0.01, toNumber(recipe.targetFoodCostPercent, 30)) / 100);
  const roundedSellingPrice = roundToRule(suggestedNetSellingPrice, toNumber(recipe.roundingRule, 0.25));
  const effectiveMenuPrice = Math.max(0, toNumber(recipe.sellingPrice, 0)) || (recipe.manualMenuPrice === '' ? roundedSellingPrice : Math.max(0, toNumber(recipe.manualMenuPrice, roundedSellingPrice)));
  const foodCostPercent = effectiveMenuPrice > 0 ? (totalCostPerPortionExclLabour / effectiveMenuPrice) * 100 : 0;
  const grossProfitPerPortion = effectiveMenuPrice - totalCostPerPortionExclLabour;
  const unitsSold = Math.max(0, toNumber(recipe.unitsSold, 0));
  const computedRevenue = effectiveMenuPrice * unitsSold;
  const revenue = recipe.revenueOverride === '' ? computedRevenue : Math.max(0, toNumber(recipe.revenueOverride, computedRevenue));
  const totalGrossProfit = revenue - (totalCostPerPortionExclLabour * unitsSold);
  return { ...recipe, ingredientRows, totalIngredientCost, ingredientCostPerPortion, totalCostPerPortionExclLabour, totalCostPerPortionInclLabour, suggestedNetSellingPrice, roundedSellingPrice, effectiveMenuPrice, foodCostPercent, grossProfitPerPortion, unitsSold, revenue, totalGrossProfit, warnings };
}

function classifyMenuItems(items) {
  const active = items.filter((i) => i.isActive);
  if (active.length < 2) return { items: items.map((i) => ({ ...i, classification: i.isActive ? 'Unclassified' : 'Inactive' })), averages: { unitsSold: 0, grossProfitPerPortion: 0 }, fallback: 'Need at least 2 active items for classification.' };
  const avgUnits = active.reduce((s, i) => s + i.unitsSold, 0) / active.length;
  const avgGross = active.reduce((s, i) => s + i.grossProfitPerPortion, 0) / active.length;
  return {
    averages: { unitsSold: avgUnits, grossProfitPerPortion: avgGross }, fallback: '',
    items: items.map((i) => {
      if (!i.isActive) return { ...i, classification: 'Inactive' };
      const hp = i.unitsSold >= avgUnits; const hgp = i.grossProfitPerPortion >= avgGross;
      const c = hp && hgp ? 'Star' : hp ? 'Plowhorse' : hgp ? 'Puzzle' : 'Dog';
      return { ...i, classification: c };
    }),
  };
}

function getItemFlags(item) {
  const f = [];
  if (item.foodCostPercent > state.prefs.foodCostFlagTarget) f.push('Food cost above target');
  if (item.effectiveMenuPrice < item.roundedSellingPrice) f.push('Priced below recommendation');
  if (item.unitsSold > state.prefs.lowUnitsThreshold && item.grossProfitPerPortion < 1.5) f.push('High sales, weak margin');
  if (item.unitsSold <= state.prefs.lowUnitsThreshold && item.grossProfitPerPortion >= 2) f.push('Low sales, strong profit');
  if (item.classification === 'Dog') f.push('Dog classification');
  if (item.grossProfitPerPortion <= 0.15) f.push('Negative/near-zero margin');
  if (!item.isActive) f.push('Inactive item');
  return f;
}
function recommendedAction(item) {
  if (item.grossProfitPerPortion <= 0.15) return 'Review recipe cost and reprice urgently';
  if (item.foodCostPercent > state.prefs.foodCostFlagTarget) return 'Raise price carefully or reduce ingredient cost';
  if (item.classification === 'Puzzle') return 'Improve menu placement and promotion';
  if (item.classification === 'Plowhorse') return 'Test small price lift (0.25-0.50)';
  if (item.classification === 'Dog') return 'Consider redesign or removal after test';
  return 'Maintain positioning and monitor';
}
function scorePriority(item, flag) {
  let score = 0;
  if (item.grossProfitPerPortion <= 0.15) score += 140;
  if (item.classification === 'Dog') score += 85;
  if (item.foodCostPercent > state.prefs.foodCostFlagTarget) score += 65;
  if (item.effectiveMenuPrice < item.roundedSellingPrice) score += 40;
  if (flag.includes('High sales')) score += 35;
  if (flag.includes('Low sales')) score -= 10;
  score += Math.max(0, item.unitsSold * 0.08);
  score += Math.max(0, item.totalGrossProfit < 0 ? 45 : 0);
  return Math.round(score);
}

function totalsFromItems(items) {
  const active = items.filter((i) => i.isActive);
  return {
    activeItems: active.length, totalUnits: active.reduce((s, i) => s + i.unitsSold, 0), totalRevenue: active.reduce((s, i) => s + i.revenue, 0),
    totalGrossProfit: active.reduce((s, i) => s + i.totalGrossProfit, 0), avgSellingPrice: active.length ? active.reduce((s, i) => s + i.effectiveMenuPrice, 0) / active.length : 0,
    avgGrossProfitPerPortion: active.length ? active.reduce((s, i) => s + i.grossProfitPerPortion, 0) / active.length : 0,
    avgFoodCostPercent: active.length ? active.reduce((s, i) => s + i.foodCostPercent, 0) / active.length : 0,
    stars: active.filter((i) => i.classification === 'Star').length, plowhorses: active.filter((i) => i.classification === 'Plowhorse').length,
    puzzles: active.filter((i) => i.classification === 'Puzzle').length, dogs: active.filter((i) => i.classification === 'Dog').length,
  };
}

function snapshotFromItems(name, periodLabel, notes, sourceLabel = 'live') {
  const metrics = state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }));
  const classified = classifyMenuItems(metrics).items.map((i) => ({ ...i, flags: getItemFlags(i), action: recommendedAction(i) }));
  return {
    id: uid('snap'),
    name,
    periodLabel: periodLabel || 'Unspecified',
    notes: notes || '',
    sourceLabel,
    createdAt: nowIso(),
    storageVersion: STORAGE_VERSION,
    totals: totalsFromItems(classified),
    items: structuredClone(classified),
  };
}

function comparePeriods(leftItems, rightItems) {
  const itemKey = (i) => cleanText(i.id) || safeLower(i.name);
  const lmap = new Map(leftItems.map((i) => [itemKey(i), i]));
  const rmap = new Map(rightItems.map((i) => [itemKey(i), i]));
  const keys = [...new Set([...lmap.keys(), ...rmap.keys()])];
  const rows = keys.map((k) => {
    const oldI = lmap.get(k); const newI = rmap.get(k);
    const base = oldI || { id: '', name: newI.name, classification: 'Missing', effectiveMenuPrice: 0, unitsSold: 0, revenue: 0, totalGrossProfit: 0, foodCostPercent: 0, grossProfitPerPortion: 0, isActive: false };
    const curr = newI || { id: '', name: oldI.name, classification: 'Missing', effectiveMenuPrice: 0, unitsSold: 0, revenue: 0, totalGrossProfit: 0, foodCostPercent: 0, grossProfitPerPortion: 0, isActive: false };
    const priceChange = curr.effectiveMenuPrice - base.effectiveMenuPrice;
    const unitsChange = curr.unitsSold - base.unitsSold;
    const revenueChange = curr.revenue - base.revenue;
    const profitChange = curr.totalGrossProfit - base.totalGrossProfit;
    const foodCostChange = curr.foodCostPercent - base.foodCostPercent;
    const isNewItem = base.classification === 'Missing' && curr.classification !== 'Missing';
    const isRemovedItem = curr.classification === 'Missing' && base.classification !== 'Missing';
    const improved = !isNewItem && !isRemovedItem && revenueChange > 0 && profitChange > 0;
    const worsened = !isNewItem && (revenueChange < 0 || profitChange < 0 || isRemovedItem);
    const classChanged = base.classification !== curr.classification;
    const movement = isNewItem ? 'New item added' : isRemovedItem ? 'Removed from latest period' : classChanged ? `${base.classification} → ${curr.classification}` : 'No class change';
    const severity = isRemovedItem || curr.grossProfitPerPortion <= 0.15 || curr.classification === 'Dog' || profitChange < 0 ? 'High' : worsened || classChanged ? 'Medium' : 'Low';
    const movementType = isNewItem ? 'new' : isRemovedItem ? 'removed' : improved ? 'improved' : worsened ? 'worsened' : classChanged ? 'changed' : 'stable';
    return { id: curr.id || base.id || k, name: curr.name || base.name, oldClassification: base.classification, newClassification: curr.classification, priceChange, unitsChange, revenueChange, profitChange, foodCostChange, improved, worsened, classChanged, movement, movementType, severity, action: isRemovedItem ? 'Review removal impact and replacement plan' : recommendedAction(curr), old: base, new: curr };
  });
  const leftTotals = totalsFromItems(leftItems); const rightTotals = totalsFromItems(rightItems);
  const pct = (nv, ov) => ov === 0 ? null : ((nv - ov) / ov) * 100;
  return {
    rows,
    summary: {
      revenueDelta: rightTotals.totalRevenue - leftTotals.totalRevenue, revenuePct: pct(rightTotals.totalRevenue, leftTotals.totalRevenue),
      grossProfitDelta: rightTotals.totalGrossProfit - leftTotals.totalGrossProfit, grossProfitPct: pct(rightTotals.totalGrossProfit, leftTotals.totalGrossProfit),
      unitsDelta: rightTotals.totalUnits - leftTotals.totalUnits, unitsPct: pct(rightTotals.totalUnits, leftTotals.totalUnits),
      foodCostDelta: rightTotals.avgFoodCostPercent - leftTotals.avgFoodCostPercent,
      gpPerPortionDelta: rightTotals.avgGrossProfitPerPortion - leftTotals.avgGrossProfitPerPortion,
      starsDelta: rightTotals.stars - leftTotals.stars, changedClasses: rows.filter((r) => r.oldClassification !== r.newClassification).length,
      improved: rows.filter((r) => r.improved).length, worsened: rows.filter((r) => r.worsened).length,
    },
  };
}

function persistAll() { setStored(STORAGE_KEYS.ingredients, state.ingredients); setStored(STORAGE_KEYS.recipes, state.recipes); setStored(STORAGE_KEYS.snapshots, state.snapshots); setStored(STORAGE_KEYS.prefs, state.prefs); }
function persistDraft() { const r = readRecipeFromForm(); r.updatedAt = nowIso(); state.draft = r; setStored(STORAGE_KEYS.draft, r); dom.draftState.textContent = `Draft autosaved ${new Date().toLocaleTimeString()}`; }

function sampleIngredients() {
  return [
    { id: uid('ing'), name: 'Baguette', purchasePrice: 8.4, packSize: 12, packUnit: 'unit', supplier: 'Metro Bakery', notes: '' },
    { id: uid('ing'), name: 'Chicken Thigh', purchasePrice: 24, packSize: 5, packUnit: 'kg', supplier: 'Kiju Butchery', notes: '' },
    { id: uid('ing'), name: 'Tofu', purchasePrice: 9.8, packSize: 2, packUnit: 'kg', supplier: 'Tofu House', notes: '' },
    { id: uid('ing'), name: 'Wings', purchasePrice: 18, packSize: 5, packUnit: 'kg', supplier: 'Kiju Butchery', notes: '' },
    { id: uid('ing'), name: 'Pickled Carrot', purchasePrice: 3.9, packSize: 1, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Daikon', purchasePrice: 2.8, packSize: 1, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Cucumber', purchasePrice: 5.5, packSize: 10, packUnit: 'unit', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Soy Glaze', purchasePrice: 5.8, packSize: 1, packUnit: 'l', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Takeaway Bowl', purchasePrice: 12, packSize: 100, packUnit: 'unit', supplier: '', notes: '' },
  ];
}
function rowByName(ingredients, name, amountUsed, useUnit) {
  const ing = ingredients.find((i) => safeLower(i.name) === safeLower(name));
  return migrateRow({ ingredientId: ing?.id, ingredientNameSnapshot: ing?.name ?? name, purchasePriceSnapshot: ing?.purchasePrice, packSizeSnapshot: ing?.packSize, packUnitSnapshot: ing?.packUnit ?? useUnit, amountUsed, useUnit });
}
function sampleRecipes(ingredients) {
  const base = [
    { name: 'Chicken Banh Mi', category: 'Sandwich', portionsYielded: 10, targetFoodCostPercent: 28, packagingCostPerPortion: 0.32, labourCostPerPortion: 0.6, manualMenuPrice: 8.5, sellingPrice: 8.5, unitsSold: 320, ingredientRows: [rowByName(ingredients, 'Baguette', 10, 'unit'), rowByName(ingredients, 'Chicken Thigh', 1600, 'g'), rowByName(ingredients, 'Pickled Carrot', 300, 'g'), rowByName(ingredients, 'Daikon', 200, 'g')] },
    { name: 'Tofu Bowl', category: 'Bowl', portionsYielded: 8, targetFoodCostPercent: 29, packagingCostPerPortion: 0.42, labourCostPerPortion: 0.7, manualMenuPrice: 9.95, sellingPrice: 9.95, unitsSold: 75, ingredientRows: [rowByName(ingredients, 'Tofu', 1500, 'g'), rowByName(ingredients, 'Cucumber', 3, 'unit'), rowByName(ingredients, 'Pickled Carrot', 220, 'g'), rowByName(ingredients, 'Takeaway Bowl', 8, 'unit')] },
    { name: 'Chicken Bowl', category: 'Bowl', portionsYielded: 8, targetFoodCostPercent: 30, packagingCostPerPortion: 0.42, labourCostPerPortion: 0.8, manualMenuPrice: 10.5, sellingPrice: 10.5, unitsSold: 260, ingredientRows: [rowByName(ingredients, 'Chicken Thigh', 1600, 'g'), rowByName(ingredients, 'Cucumber', 4, 'unit'), rowByName(ingredients, 'Pickled Carrot', 220, 'g'), rowByName(ingredients, 'Takeaway Bowl', 8, 'unit')] },
    { name: 'Wings', category: 'Sides', portionsYielded: 10, targetFoodCostPercent: 27, packagingCostPerPortion: 0.22, labourCostPerPortion: 0.45, manualMenuPrice: 7.75, sellingPrice: 7.75, unitsSold: 95, ingredientRows: [rowByName(ingredients, 'Wings', 1800, 'g'), rowByName(ingredients, 'Soy Glaze', 120, 'ml')] },
  ];
  return base.map((r) => migrateRecipe({ ...defaultRecipe(), ...r, id: uid('rec'), createdAt: nowIso(), updatedAt: nowIso() }));
}
function seedSnapshots() {
  const live = state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }));
  const classed = classifyMenuItems(live).items;
  const old = classed.map((i) => {
    const mult = i.name.includes('Chicken Banh') ? 0.88 : i.name.includes('Tofu') ? 0.75 : i.name.includes('Wings') ? 1.08 : 0.93;
    const oldUnits = Math.max(0, Math.round(i.unitsSold * mult));
    const oldPrice = i.name.includes('Chicken Banh') ? i.effectiveMenuPrice - 0.25 : i.effectiveMenuPrice;
    const revenue = oldUnits * oldPrice;
    const gp = revenue - oldUnits * i.totalCostPerPortionExclLabour;
    return { ...i, unitsSold: oldUnits, effectiveMenuPrice: oldPrice, revenue, totalGrossProfit: gp };
  });
  const oldClassed = classifyMenuItems(old).items;
  return [
    { id: uid('snap'), name: 'Last 30 Days', periodLabel: 'Mar 2026', createdAt: nowIso(), notes: 'Before menu pricing tweaks', totals: totalsFromItems(oldClassed), items: oldClassed },
    { id: uid('snap'), name: 'Current Month', periodLabel: 'Apr 2026', createdAt: nowIso(), notes: 'Post pricing and promo changes', totals: totalsFromItems(classed), items: classed },
  ];
}

function loadData() {
  let ingredients = getStoredArray(STORAGE_KEYS.ingredients); let recipes = getStoredArray(STORAGE_KEYS.recipes); let snapshots = getStoredArray(STORAGE_KEYS.snapshots);
  if (!ingredients.length && !recipes.length) { ingredients = getStoredArray(STORAGE_KEYS.legacyIngredients); recipes = getStoredArray(STORAGE_KEYS.legacyRecipes); }
  state.ingredients = ingredients.map(migrateIngredient);
  state.recipes = recipes.map(migrateRecipe);
  state.snapshots = Array.isArray(snapshots) ? snapshots : [];
  state.prefs = { ...state.prefs, ...getStoredObject(STORAGE_KEYS.prefs, {}) };
  state.comparisonNotes = localStorage.getItem(STORAGE_KEYS.compareNotes) || '';

  const seededFlag = localStorage.getItem(STORAGE_KEYS.seeded) || localStorage.getItem(STORAGE_KEYS.legacySeeded);
  if (!state.ingredients.length && !state.recipes.length && !seededFlag) {
    state.ingredients = sampleIngredients();
    state.recipes = sampleRecipes(state.ingredients);
    state.snapshots = seedSnapshots();
    localStorage.setItem(STORAGE_KEYS.seeded, '1');
  } else if (!state.snapshots.length && state.recipes.length) {
    state.snapshots = seedSnapshots();
  }

  const storedDraft = safeParse(localStorage.getItem(STORAGE_KEYS.draft), null) || safeParse(localStorage.getItem(STORAGE_KEYS.legacyDraft), null);
  state.draft = storedDraft ? migrateRecipe(storedDraft) : null;
  persistAll();
}

function readRowsFromDom() {
  const rows = [...dom.ingredientRows.querySelectorAll('tr')].map((tr) => {
    const q = (s) => tr.querySelector(s);
    return migrateRow({ rowId: tr.dataset.rowId, ingredientId: q('.row-lib-select').value, ingredientNameSnapshot: q('.row-name').value, purchasePriceSnapshot: q('.row-price').value, packSizeSnapshot: q('.row-pack-size').value, packUnitSnapshot: q('.row-pack-unit').value, amountUsed: q('.row-amount').value, useUnit: q('.row-use-unit').value, calculatedCostUsed: q('.row-cost').dataset.cost });
  });
  return rows.length ? rows : [defaultIngredientRow()];
}
function readRecipeFromForm() {
  return migrateRecipe({
    id: state.activeRecipeId, name: dom.fields.name.value, category: dom.fields.category.value, portionsYielded: dom.fields.portions.value, targetFoodCostPercent: dom.fields.target.value,
    packagingCostPerPortion: dom.fields.packaging.value, labourCostPerPortion: dom.fields.labour.value, vatRatePercent: dom.fields.vat.value, deliveryCommissionPercent: dom.fields.delivery.value, roundingRule: dom.fields.rounding.value,
    manualMenuPrice: dom.fields.manual.value === '' ? '' : dom.fields.manual.value, sellingPrice: dom.fields.sellingPrice.value, unitsSold: dom.fields.unitsSold.value, reportingPeriod: dom.fields.reportingPeriod.value || 'Last 30 Days', internalScore: dom.fields.internalScore.value,
    isActive: dom.fields.isActive.value === 'true', revenueOverride: dom.fields.revenueOverride.value === '' ? '' : dom.fields.revenueOverride.value, itemNotes: dom.fields.itemNotes.value, ingredientRows: readRowsFromDom(),
  });
}
function setRecipeToForm(recipe) {
  dom.fields.name.value = recipe.name; dom.fields.category.value = recipe.category; dom.fields.portions.value = recipe.portionsYielded; dom.fields.target.value = recipe.targetFoodCostPercent;
  dom.fields.packaging.value = recipe.packagingCostPerPortion; dom.fields.labour.value = recipe.labourCostPerPortion; dom.fields.vat.value = recipe.vatRatePercent; dom.fields.delivery.value = recipe.deliveryCommissionPercent;
  dom.fields.rounding.value = String(recipe.roundingRule); dom.fields.manual.value = recipe.manualMenuPrice === '' ? '' : recipe.manualMenuPrice; dom.fields.sellingPrice.value = recipe.sellingPrice;
  dom.fields.unitsSold.value = recipe.unitsSold; dom.fields.reportingPeriod.value = recipe.reportingPeriod; dom.fields.internalScore.value = recipe.internalScore; dom.fields.isActive.value = String(recipe.isActive);
  dom.fields.revenueOverride.value = recipe.revenueOverride; dom.fields.itemNotes.value = recipe.itemNotes;
  dom.ingredientRows.innerHTML = ''; (recipe.ingredientRows?.length ? recipe.ingredientRows : [defaultIngredientRow()]).forEach(addRowToDom); recalcAndRender();
}
function addRowToDom(rowData = defaultIngredientRow()) {
  const fragment = dom.template.content.cloneNode(true); const tr = fragment.querySelector('tr'); tr.dataset.rowId = rowData.rowId || uid('row');
  const select = tr.querySelector('.row-lib-select'); select.innerHTML = '<option value="">Manual / Snapshot</option>';
  state.ingredients.forEach((ing) => { const o = document.createElement('option'); o.value = ing.id; o.textContent = ing.name; select.appendChild(o); });
  tr.querySelector('.row-name').value = rowData.ingredientNameSnapshot || ''; tr.querySelector('.row-price').value = rowData.purchasePriceSnapshot; tr.querySelector('.row-pack-size').value = rowData.packSizeSnapshot;
  tr.querySelector('.row-pack-unit').value = rowData.packUnitSnapshot; tr.querySelector('.row-amount').value = rowData.amountUsed; tr.querySelector('.row-use-unit').value = rowData.useUnit; select.value = rowData.ingredientId || '';
  select.addEventListener('change', () => {
    const ing = state.ingredients.find((x) => x.id === select.value); if (!ing) return;
    tr.querySelector('.row-name').value = ing.name; tr.querySelector('.row-price').value = ing.purchasePrice; tr.querySelector('.row-pack-size').value = ing.packSize; tr.querySelector('.row-pack-unit').value = ing.packUnit; tr.querySelector('.row-use-unit').value = ing.packUnit;
    recalcAndRender();
  });
  ['.row-name', '.row-price', '.row-pack-size', '.row-pack-unit', '.row-amount', '.row-use-unit'].forEach((s) => { const el = tr.querySelector(s); el.addEventListener('input', recalcAndRender); el.addEventListener('change', recalcAndRender); });
  tr.querySelector('.row-remove').addEventListener('click', () => { tr.remove(); if (!dom.ingredientRows.querySelector('tr')) addRowToDom(); recalcAndRender(); });
  dom.ingredientRows.appendChild(fragment);
}

function renderRecipeList() {
  const q = safeLower(state.recipeSearch);
  const rows = state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true })).filter((r) => (!q || safeLower(r.name).includes(q)) && (state.recipeStatusFilter === 'all' || (state.recipeStatusFilter === 'active' ? r.isActive : !r.isActive))).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  dom.recipeCount.textContent = rows.length; dom.recipeList.innerHTML = '';
  if (!rows.length) return dom.recipeList.innerHTML = '<li class="helper-text">No recipes found.</li>';
  rows.forEach((r) => {
    const li = document.createElement('li'); li.className = `recipe-item ${state.activeRecipeId === r.id ? 'active' : ''}`;
    li.innerHTML = `<strong>${r.name || '(Untitled)'}</strong><p>${r.category || 'No category'} · ${r.reportingPeriod}</p><p>${fmtCurrency(r.effectiveMenuPrice)} · ${fmtInt(r.unitsSold)} units</p>`;
    li.addEventListener('click', () => { state.activeRecipeId = r.id; setRecipeToForm(migrateRecipe(r)); renderRecipeList(); }); dom.recipeList.appendChild(li);
  });
}

function renderDashboard() {
  const metrics = state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }));
  state.menuEngine = classifyMenuItems(metrics);
  const items = state.menuEngine.items.map((i) => ({ ...i, flags: getItemFlags(i), action: recommendedAction(i) }));
  const totals = totalsFromItems(items);
  dom.periodLabel.textContent = `Period: ${items[0]?.reportingPeriod || 'mixed'}`;
  const cards = [
    ['Active Items', totals.activeItems], ['Total Units', fmtInt(totals.totalUnits)], ['Total Revenue', fmtCurrency(totals.totalRevenue)], ['Total Gross Profit', fmtCurrency(totals.totalGrossProfit)],
    ['Avg Selling Price', fmtCurrency(totals.avgSellingPrice)], ['Avg GP / Portion', fmtCurrency(totals.avgGrossProfitPerPortion)], ['Avg Food Cost %', fmtPercent(totals.avgFoodCostPercent)],
    ['Stars', totals.stars], ['Plowhorses', totals.plowhorses], ['Puzzles', totals.puzzles], ['Dogs', totals.dogs],
    ['Improved Items', state.comparison?.summary?.improved ?? 0], ['Worsened Items', state.comparison?.summary?.worsened ?? 0], ['Need Action', items.filter((i) => i.flags.length).length],
  ];
  dom.dashboardCards.innerHTML = cards.map(([k, v]) => `<div class="metric-card"><span>${k}</span><strong>${v}</strong></div>`).join('');

  const topRevenue = [...items].sort((a, b) => b.revenue - a.revenue)[0];
  const topProfit = [...items].sort((a, b) => b.totalGrossProfit - a.totalGrossProfit)[0];
  const weakestMargin = [...items].sort((a, b) => a.grossProfitPerPortion - b.grossProfitPerPortion)[0];
  const strongestMomentum = state.comparison?.rows?.slice().sort((a, b) => b.profitChange - a.profitChange)[0];
  const biggestDecline = state.comparison?.rows?.slice().sort((a, b) => a.profitChange - b.profitChange)[0];
  const highFoodCost = items.filter((i) => i.foodCostPercent > state.prefs.foodCostFlagTarget);
  const lowPrice = items.filter((i) => i.effectiveMenuPrice < i.roundedSellingPrice);
  const highlights = [
    `Biggest revenue driver: ${topRevenue ? `${topRevenue.name} (${fmtCurrency(topRevenue.revenue)})` : 'N/A'}`,
    `Biggest profit driver: ${topProfit ? `${topProfit.name} (${fmtCurrency(topProfit.totalGrossProfit)})` : 'N/A'}`,
    `Weakest margin item: ${weakestMargin ? `${weakestMargin.name} (${fmtCurrency(weakestMargin.grossProfitPerPortion)}/portion)` : 'N/A'}`,
    `${highFoodCost.length} item(s) above target food cost (${state.prefs.foodCostFlagTarget}%)`,
    `${lowPrice.length} item(s) priced below recommendation`,
    state.comparison ? `Best momentum: ${strongestMomentum?.name || 'N/A'} (${fmtCurrency(strongestMomentum?.profitChange || 0)} GP change)` : 'Run a comparison to evaluate momentum.',
    state.comparison ? `Largest decline: ${biggestDecline?.name || 'N/A'} (${fmtCurrency(biggestDecline?.profitChange || 0)} GP change)` : `Create at least 1 snapshot to start trend tracking.`,
    state.comparison ? `Classification changes in selected comparison: ${state.comparison.summary.changedClasses}` : 'Run a comparison to see class movement.',
  ];
  dom.menuInsightList.innerHTML = highlights.map((h) => `<li>${h}</li>`).join('');

  const priorities = [...items].flatMap((i) => i.flags.map((flag) => {
    const score = scorePriority(i, flag);
    const severity = score >= 140 ? 'High' : score >= 75 ? 'Medium' : 'Low';
    return { name: i.name, flag, severity, score, action: recommendedAction(i) };
  })).sort((a, b) => b.score - a.score).slice(0, 12);
  dom.priorityList.innerHTML = priorities.length ? priorities.map((p) => `<li><strong>${p.name}</strong> — ${p.flag} <span class="movement-chip">${p.severity} · ${p.score}</span><br/><span class="helper-text">${p.action}</span></li>`).join('') : '<li class="empty-state">No priority flags right now.</li>';

  renderAnalysisTable(items);
  renderMatrix(items);
  renderSnapshotList();
  renderComparisonSummary();
  dom.reviewSummaryOutput.textContent = reviewSummaryText();
}

function renderAnalysisTable(items) {
  let rows = [...items];
  if (state.analysisSearch) rows = rows.filter((i) => safeLower(i.name).includes(safeLower(state.analysisSearch)));
  if (state.analysisClassFilter !== 'all') rows = rows.filter((i) => i.classification === state.analysisClassFilter);
  const dir = state.sort.dir === 'asc' ? 1 : -1; const k = state.sort.key;
  rows.sort((a, b) => (typeof a[k] === 'string' ? String(a[k]).localeCompare(String(b[k])) : toNumber(a[k]) - toNumber(b[k])) * dir);
  dom.analysisBody.innerHTML = rows.length ? rows.map((i) => `<tr><td>${i.name}</td><td><span class="badge badge-${i.classification.toLowerCase()}">${i.classification}</span></td><td>${fmtCurrency(i.effectiveMenuPrice)}</td><td>${fmtCurrency(i.grossProfitPerPortion)}</td><td class="${i.foodCostPercent > state.prefs.foodCostFlagTarget ? 'value-warn' : ''}">${fmtPercent(i.foodCostPercent)}</td><td>${fmtInt(i.unitsSold)}</td><td>${fmtCurrency(i.revenue)}</td><td>${fmtCurrency(i.totalGrossProfit)}</td><td>${i.action}</td></tr>`).join('') : '<tr><td colspan="9">No items match filters.</td></tr>';
}
function renderMatrix(items) {
  const active = items.filter((i) => i.isActive && i.classification !== 'Unclassified'); dom.matrixChart.innerHTML = '';
  if (active.length < 2) { dom.matrixFallback.textContent = 'Add more active items to render matrix.'; return; }
  dom.matrixFallback.textContent = '';
  const maxU = Math.max(...active.map((i) => i.unitsSold), 1); const maxG = Math.max(...active.map((i) => i.grossProfitPerPortion), 0.01);
  active.forEach((i) => {
    const p = document.createElement('div'); p.className = `matrix-point badge-${i.classification.toLowerCase()}`; p.style.left = `${clamp((i.unitsSold / maxU) * 100, 4, 96)}%`; p.style.bottom = `${clamp((i.grossProfitPerPortion / maxG) * 100, 4, 96)}%`; p.title = `${i.name} · ${i.classification}`; p.textContent = i.name.length > 16 ? `${i.name.slice(0, 15)}…` : i.name; dom.matrixChart.appendChild(p);
  });
}

function renderSnapshotSelectors() {
  const ordered = state.snapshots.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const options = ['<option value="live">Current Live Data</option>', ...ordered.map((s) => `<option value="${s.id}">${s.name} · ${s.periodLabel}</option>`)];
  dom.compareLeft.innerHTML = options.join(''); dom.compareRight.innerHTML = options.join('');
  if (!dom.compareRight.value && ordered[0]) dom.compareRight.value = ordered[0].id;
  if (!dom.compareLeft.value) dom.compareLeft.value = 'live';
}
function renderSnapshotList() {
  dom.snapshotList.innerHTML = state.snapshots.length
    ? state.snapshots.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((s) => `<li><strong>${s.name}</strong> (${s.periodLabel})<br/><span class="helper-text">${shortDateTime(s.createdAt)} · ${s.notes || 'No notes'}</span><br/><button class="btn btn-secondary" data-snapshot-view="${s.id}" type="button">Load</button> <button class="btn btn-danger" data-snapshot-delete="${s.id}" type="button">Delete</button></li>`).join('')
    : '<li class="empty-state">No snapshots yet. Create a first snapshot to unlock period-over-period reporting.</li>';
}
function renderComparisonSummary() {
  if (!state.comparison) {
    dom.comparisonSummary.innerHTML = state.snapshots.length < 1
      ? '<li class="empty-state">No snapshot history yet. Create one snapshot, then compare it with live data.</li>'
      : '<li class="empty-state">No comparison selected. Choose periods above and click Run Comparison.</li>';
    dom.comparisonBody.innerHTML = '<tr><td colspan="10">Select periods and run comparison.</td></tr>';
    dom.modeIndicator.textContent = 'Mode: Live';
    return;
  }
  const s = state.comparison.summary;
  const pct = (v) => (v === null || !Number.isFinite(v) ? 'n/a' : `${v.toFixed(1)}%`);
  dom.comparisonSummary.innerHTML = [
    `Revenue: ${s.revenueDelta >= 0 ? '▲' : '▼'} ${fmtCurrency(s.revenueDelta)} (${pct(s.revenuePct)})`,
    `Gross profit: ${s.grossProfitDelta >= 0 ? '▲' : '▼'} ${fmtCurrency(s.grossProfitDelta)} (${pct(s.grossProfitPct)})`,
    `Units sold: ${s.unitsDelta >= 0 ? '▲' : '▼'} ${fmtInt(s.unitsDelta)} (${pct(s.unitsPct)})`,
    `Avg food cost: ${s.foodCostDelta >= 0 ? '▲' : '▼'} ${s.foodCostDelta.toFixed(2)} pts`,
    `Avg GP/portion: ${s.gpPerPortionDelta >= 0 ? '▲' : '▼'} ${fmtCurrency(s.gpPerPortionDelta)}`,
    `Class changes: ${s.changedClasses} · Improved: ${s.improved} · Worsened: ${s.worsened}`,
  ].map((x) => `<li>${x}</li>`).join('');
  dom.modeIndicator.textContent = `Mode: Comparison (${state.comparison.leftLabel} → ${state.comparison.rightLabel})`;
  renderComparisonTable();
}
function renderComparisonTable() {
  if (!state.comparison) return;
  let rows = [...state.comparison.rows];
  if (state.compareSearch) rows = rows.filter((r) => safeLower(r.name).includes(safeLower(state.compareSearch)));
  if (state.compareMovementFilter === 'improved') rows = rows.filter((r) => r.improved || r.movementType === 'new');
  if (state.compareMovementFilter === 'worsened') rows = rows.filter((r) => r.worsened || r.movementType === 'removed');
  if (state.compareMovementFilter === 'changed') rows = rows.filter((r) => r.classChanged);
  const k = state.csort.key; const dir = state.csort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => (typeof a[k] === 'string' ? String(a[k]).localeCompare(String(b[k])) : toNumber(a[k]) - toNumber(b[k])) * dir);
  const movementClass = (r) => (r.movementType === 'new' ? 'movement-new' : r.movementType === 'removed' ? 'movement-removed' : r.worsened ? 'movement-down' : 'movement-up');
  dom.comparisonBody.innerHTML = rows.length ? rows.map((r) => `<tr><td>${r.name}</td><td>${r.oldClassification}</td><td>${r.newClassification}</td><td class="${r.priceChange >= 0 ? 'value-good' : 'value-bad'}">${fmtCurrency(r.priceChange)}</td><td class="${r.unitsChange >= 0 ? 'value-good' : 'value-bad'}">${fmtInt(r.unitsChange)}</td><td class="${r.revenueChange >= 0 ? 'value-good' : 'value-bad'}">${fmtCurrency(r.revenueChange)}</td><td class="${r.profitChange >= 0 ? 'value-good' : 'value-bad'}">${fmtCurrency(r.profitChange)}</td><td>${r.foodCostChange.toFixed(2)} pts</td><td><span class="movement-chip ${movementClass(r)}">${r.movement}</span></td><td>${r.action} <span class="movement-chip">${r.severity}</span></td></tr>`).join('') : '<tr><td colspan="10">No comparable items for filters.</td></tr>';
}

function recalcAndRender() {
  const r = readRecipeFromForm(); const m = calculateRecipeMetrics(r);
  [...dom.ingredientRows.querySelectorAll('tr')].forEach((tr, i) => {
    const c = m.ingredientRows[i]?.calculatedCostUsed ?? 0; const cell = tr.querySelector('.row-cost'); cell.dataset.cost = c; cell.textContent = fmtCurrency(c);
  });
  dom.results.totalIngredient.textContent = fmtCurrency(m.totalIngredientCost); dom.results.totalPortion.textContent = fmtCurrency(m.totalCostPerPortionExclLabour);
  dom.results.rounded.textContent = fmtCurrency(m.roundedSellingPrice); dom.results.gross.textContent = fmtCurrency(m.grossProfitPerPortion); dom.results.foodRounded.textContent = fmtPercent(m.foodCostPercent);
  dom.results.totalRevenue.textContent = fmtCurrency(m.revenue); dom.results.totalGrossProfit.textContent = fmtCurrency(m.totalGrossProfit);
  const classified = state.menuEngine?.items?.find((x) => x.id === m.id) || { ...m, classification: 'Unclassified' };
  dom.results.classification.textContent = classified.classification; dom.results.action.textContent = recommendedAction(classified);
  dom.insightList.innerHTML = [m.foodCostPercent > m.targetFoodCostPercent ? `Food cost (${fmtPercent(m.foodCostPercent)}) above target.` : 'Food cost near target.', m.effectiveMenuPrice < m.roundedSellingPrice ? 'Current price is below recommendation.' : 'Current price is aligned with recommendation.'].map((x) => `<li>${x}</li>`).join('');
  dom.itemFlagList.innerHTML = getItemFlags(classified).map((x) => `<li>${x}</li>`).join('') || '<li>No major flags.</li>';
  setInlineMessage(dom.calcWarnings, m.warnings.join(' · '));
  if (document.activeElement !== dom.fields.sellingPrice && (!toNumber(dom.fields.sellingPrice.value) || toNumber(dom.fields.sellingPrice.value) === 0) && m.roundedSellingPrice > 0) dom.fields.sellingPrice.value = m.roundedSellingPrice.toFixed(2);
  persistDraft();
}

function validateRecipe(r) {
  const e = []; if (!r.name) e.push('Recipe name is required.'); if (!(r.portionsYielded > 0)) e.push('Portions yielded must be greater than 0.'); if (!(r.targetFoodCostPercent > 0 && r.targetFoodCostPercent < 100)) e.push('Target food cost must be between 0 and 100.');
  return e;
}
function resetRecipeForm() { state.activeRecipeId = null; setRecipeToForm(defaultRecipe()); setInlineMessage(dom.editorErrors, ''); }
function upsertRecipe(mode) {
  const r = readRecipeFromForm(); const errors = validateRecipe(r); if (errors.length) return setInlineMessage(dom.editorErrors, errors.join(' '));
  if (mode === 'save') { r.id = uid('rec'); r.createdAt = nowIso(); r.updatedAt = nowIso(); state.recipes.unshift(r); state.activeRecipeId = r.id; setInlineMessage(dom.editorErrors, 'Recipe saved.', 'success'); }
  if (mode === 'update') { if (!state.activeRecipeId) return setInlineMessage(dom.editorErrors, 'Select a recipe to update.'); r.id = state.activeRecipeId; const old = state.recipes.find((x) => x.id === r.id); r.createdAt = old?.createdAt || nowIso(); r.updatedAt = nowIso(); state.recipes = state.recipes.map((x) => x.id === r.id ? r : x); setInlineMessage(dom.editorErrors, 'Recipe updated.', 'success'); }
  persistAll(); renderRecipeList(); renderDashboard();
}
function duplicateRecipe() { const src = state.recipes.find((r) => r.id === state.activeRecipeId); if (!src) return setInlineMessage(dom.editorErrors, 'Select a recipe to duplicate.'); const cp = migrateRecipe({ ...src, id: uid('rec'), name: `${src.name} (Copy)`, createdAt: nowIso(), updatedAt: nowIso() }); state.recipes.unshift(cp); state.activeRecipeId = cp.id; persistAll(); setRecipeToForm(cp); renderRecipeList(); renderDashboard(); }
function deleteRecipe() { const rec = state.recipes.find((r) => r.id === state.activeRecipeId); if (!rec) return setInlineMessage(dom.editorErrors, 'Select a recipe to delete.'); if (!window.confirm(`Delete "${rec.name}"?`)) return; state.recipes = state.recipes.filter((r) => r.id !== rec.id); state.activeRecipeId = null; persistAll(); resetRecipeForm(); renderRecipeList(); renderDashboard(); }

function readIngredientForm() { return { name: cleanText(dom.library.name.value), purchasePrice: toNumber(dom.library.price.value), packSize: toNumber(dom.library.packSize.value), packUnit: dom.library.packUnit.value, supplier: cleanText(dom.library.supplier.value), notes: cleanText(dom.library.notes.value) }; }
function clearIngredientForm() { state.ingredientEditingId = null; dom.library.name.value = ''; dom.library.price.value = ''; dom.library.packSize.value = ''; dom.library.packUnit.value = ''; dom.library.supplier.value = ''; dom.library.notes.value = ''; setInlineMessage(dom.library.errors, ''); }
function renderIngredientLibrary() {
  const q = safeLower(state.ingredientSearch); const usage = new Map(); state.recipes.forEach((r) => (r.ingredientRows || []).forEach((row) => { if (row.ingredientId) usage.set(row.ingredientId, (usage.get(row.ingredientId) || 0) + 1); }));
  const rows = state.ingredients.filter((i) => !q || safeLower(i.name).includes(q)); dom.library.count.textContent = rows.length; dom.library.body.innerHTML = rows.length ? rows.map((i) => `<tr><td>${i.name}</td><td>${fmtCurrency(i.purchasePrice)}</td><td>${i.packSize} ${i.packUnit}</td><td>${i.supplier || '—'}</td><td>${i.notes || '—'}</td><td>${usage.get(i.id) || 0}</td><td><button class="btn btn-secondary" data-action="edit" data-id="${i.id}">Edit</button> <button class="btn btn-danger" data-action="delete" data-id="${i.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="7">No ingredients found.</td></tr>';
}
function refreshRowIngredientOptions() { const rows = readRowsFromDom(); dom.ingredientRows.innerHTML = ''; rows.forEach(addRowToDom); }

function createSnapshot() {
  const name = cleanText(dom.snapshotName.value); if (!name) return setInlineMessage(dom.snapshotFeedback, 'Snapshot name is required.');
  const periodLabel = cleanText(dom.snapshotPeriod.value || dom.fields.reportingPeriod.value || 'Mixed Periods');
  const notes = cleanText(dom.snapshotNotes.value);
  const snap = snapshotFromItems(name, periodLabel, notes);
  state.snapshots.unshift(snap); persistAll(); renderSnapshotSelectors(); renderSnapshotList();
  dom.snapshotName.value = ''; dom.snapshotPeriod.value = ''; dom.snapshotNotes.value = '';
  setInlineMessage(dom.snapshotFeedback, `Snapshot "${snap.name}" created.`, 'success');
  renderDashboard();
}
function findPeriodBySelector(value) {
  if (value === 'live') {
    const metrics = state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }));
    const items = classifyMenuItems(metrics).items.map((i) => ({ ...i, flags: getItemFlags(i), action: recommendedAction(i) }));
    return { label: 'Current Live', items };
  }
  const snap = state.snapshots.find((s) => s.id === value);
  return snap ? { label: `${snap.name} (${snap.periodLabel})`, items: snap.items } : null;
}
function runComparison() {
  const left = findPeriodBySelector(dom.compareLeft.value); const right = findPeriodBySelector(dom.compareRight.value);
  if (!left || !right) return setInlineMessage(dom.snapshotFeedback, 'Please select valid periods for comparison.');
  if (dom.compareLeft.value === dom.compareRight.value) return setInlineMessage(dom.snapshotFeedback, 'Pick two different periods.');
  state.comparison = { ...comparePeriods(left.items, right.items), leftLabel: left.label, rightLabel: right.label, notes: cleanText(dom.comparisonNotes.value) };
  localStorage.setItem(STORAGE_KEYS.compareNotes, state.comparison.notes || '');
  setInlineMessage(dom.snapshotFeedback, `Comparison ready: ${left.label} → ${right.label}.`, 'success');
  renderDashboard();
}
function clearComparison() { state.comparison = null; dom.comparisonNotes.value = ''; localStorage.removeItem(STORAGE_KEYS.compareNotes); renderDashboard(); setInlineMessage(dom.snapshotFeedback, 'Comparison cleared.', 'success'); }

function csvEscape(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadCsv(filename, headers, rows) {
  if (!rows.length) return setInlineMessage(dom.snapshotFeedback, 'No rows available for CSV export.');
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
function exportCurrentCsv() {
  const items = state.menuEngine?.items || classifyMenuItems(state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }))).items;
  const period = cleanText(dom.fields.reportingPeriod.value) || 'Mixed';
  downloadCsv('menu-current-analysis.csv',
    ['periodLabel', 'name', 'category', 'classification', 'isActive', 'effectiveMenuPrice', 'roundedSellingPrice', 'unitsSold', 'revenue', 'grossProfitPerPortion', 'totalGrossProfit', 'foodCostPercent', 'flags', 'action', 'updatedAt'],
    items.map((i) => ({ periodLabel: period, name: i.name, category: i.category, classification: i.classification, isActive: i.isActive, effectiveMenuPrice: i.effectiveMenuPrice.toFixed(2), roundedSellingPrice: i.roundedSellingPrice.toFixed(2), unitsSold: i.unitsSold, revenue: i.revenue.toFixed(2), grossProfitPerPortion: i.grossProfitPerPortion.toFixed(2), totalGrossProfit: i.totalGrossProfit.toFixed(2), foodCostPercent: i.foodCostPercent.toFixed(2), flags: getItemFlags(i).join(' | '), action: recommendedAction(i), updatedAt: i.updatedAt || '' })),
  );
}
function exportComparisonCsv() {
  if (!state.comparison) return setInlineMessage(dom.snapshotFeedback, 'Run comparison before exporting.');
  const rows = state.comparison.rows.map((r) => ({ comparisonFrom: state.comparison.leftLabel, comparisonTo: state.comparison.rightLabel, name: r.name, oldClassification: r.oldClassification, newClassification: r.newClassification, movementType: r.movementType, priceChange: r.priceChange.toFixed(2), unitsChange: r.unitsChange, revenueChange: r.revenueChange.toFixed(2), profitChange: r.profitChange.toFixed(2), foodCostChange: r.foodCostChange.toFixed(2), movement: r.movement, severity: r.severity, action: r.action }));
  downloadCsv('snapshot-comparison.csv', ['comparisonFrom', 'comparisonTo', 'name', 'oldClassification', 'newClassification', 'movementType', 'priceChange', 'unitsChange', 'revenueChange', 'profitChange', 'foodCostChange', 'movement', 'severity', 'action'], rows);
}
function reviewSummaryText() {
  const totals = totalsFromItems((state.menuEngine?.items || []).map((i) => ({ ...i, action: recommendedAction(i), flags: getItemFlags(i) })));
  const lines = [
    `Menu Price Engine Stage 4 Review`,
    `Active items: ${totals.activeItems} | Units: ${fmtInt(totals.totalUnits)} | Revenue: ${fmtCurrency(totals.totalRevenue)} | Gross Profit: ${fmtCurrency(totals.totalGrossProfit)}`,
    `Stars: ${totals.stars}, Plowhorses: ${totals.plowhorses}, Puzzles: ${totals.puzzles}, Dogs: ${totals.dogs}`,
  ];
  const priorityPreview = dom.priorityList ? [...dom.priorityList.querySelectorAll('li')].slice(0, 5).map((li) => li.textContent.trim()) : [];
  if (priorityPreview.length) lines.push(`Top priorities:\n- ${priorityPreview.join('\n- ')}`);
  if (state.comparison) lines.push(`Comparison: ${state.comparison.leftLabel} -> ${state.comparison.rightLabel}; Revenue delta ${fmtCurrency(state.comparison.summary.revenueDelta)}, GP delta ${fmtCurrency(state.comparison.summary.grossProfitDelta)}, Class changes ${state.comparison.summary.changedClasses}.`);
  if (state.comparison?.notes) lines.push(`Comparison notes: ${state.comparison.notes}`);
  if (state.snapshots.length) lines.push(`Snapshot history: ${state.snapshots.length} total. Latest: ${state.snapshots.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].name}.`);
  else lines.push('Snapshot history: none yet.');
  return lines.join('\n');
}

function bindEvents() {
  dom.actions.addRow.addEventListener('click', () => { addRowToDom(defaultIngredientRow()); recalcAndRender(); });
  dom.actions.save.addEventListener('click', () => upsertRecipe('save')); dom.actions.update.addEventListener('click', () => upsertRecipe('update')); dom.actions.duplicate.addEventListener('click', duplicateRecipe); dom.actions.del.addEventListener('click', deleteRecipe); dom.actions.reset.addEventListener('click', resetRecipeForm); dom.actions.newRecipe.addEventListener('click', resetRecipeForm);
  dom.recipeSearch.addEventListener('input', (e) => { state.recipeSearch = e.target.value; renderRecipeList(); });
  dom.recipeStatusFilter.addEventListener('change', (e) => { state.recipeStatusFilter = e.target.value; renderRecipeList(); });
  Object.values(dom.fields).forEach((el) => { el.addEventListener('input', recalcAndRender); el.addEventListener('change', recalcAndRender); });
  dom.analysisSearch.addEventListener('input', (e) => { state.analysisSearch = e.target.value; renderDashboard(); }); dom.analysisClassFilter.addEventListener('change', (e) => { state.analysisClassFilter = e.target.value; renderDashboard(); });
  dom.analysisTable.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.sort; if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc'; else state.sort = { key: k, dir: 'asc' }; renderDashboard(); }));
  dom.compareSearch.addEventListener('input', (e) => { state.compareSearch = e.target.value; renderComparisonTable(); }); dom.compareMovementFilter.addEventListener('change', (e) => { state.compareMovementFilter = e.target.value; renderComparisonTable(); });
  dom.comparisonTable.querySelectorAll('th[data-csort]').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.csort; if (state.csort.key === k) state.csort.dir = state.csort.dir === 'asc' ? 'desc' : 'asc'; else state.csort = { key: k, dir: 'desc' }; renderComparisonTable(); }));

  dom.actions.openLib.addEventListener('click', () => dom.library.modal.classList.add('open')); dom.actions.closeLib.addEventListener('click', () => dom.library.modal.classList.remove('open')); dom.library.modal.addEventListener('click', (e) => { if (e.target.dataset.closeModal) dom.library.modal.classList.remove('open'); });
  dom.library.search.addEventListener('input', (e) => { state.ingredientSearch = e.target.value; renderIngredientLibrary(); });
  dom.library.add.addEventListener('click', () => {
    const i = readIngredientForm(); if (!i.name || i.packSize <= 0 || i.purchasePrice < 0 || !PACK_UNITS.includes(i.packUnit)) return setInlineMessage(dom.library.errors, 'Valid ingredient fields are required.');
    if (state.ingredients.some((x) => safeLower(x.name) === safeLower(i.name))) return setInlineMessage(dom.library.errors, 'Ingredient already exists.');
    state.ingredients.push({ id: uid('ing'), ...i }); persistAll(); clearIngredientForm(); renderIngredientLibrary(); refreshRowIngredientOptions();
  });
  dom.library.update.addEventListener('click', () => {
    if (!state.ingredientEditingId) return setInlineMessage(dom.library.errors, 'Select ingredient to update.'); const i = readIngredientForm();
    state.ingredients = state.ingredients.map((x) => x.id === state.ingredientEditingId ? { ...x, ...i } : x); persistAll(); clearIngredientForm(); renderIngredientLibrary(); refreshRowIngredientOptions();
  });
  dom.library.clear.addEventListener('click', clearIngredientForm);
  dom.library.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return; const ing = state.ingredients.find((x) => x.id === btn.dataset.id); if (!ing) return;
    if (btn.dataset.action === 'edit') { state.ingredientEditingId = ing.id; dom.library.name.value = ing.name; dom.library.price.value = ing.purchasePrice; dom.library.packSize.value = ing.packSize; dom.library.packUnit.value = ing.packUnit; dom.library.supplier.value = ing.supplier; dom.library.notes.value = ing.notes; return; }
    if (window.confirm(`Delete ingredient "${ing.name}"?`)) { state.ingredients = state.ingredients.filter((x) => x.id !== ing.id); persistAll(); renderIngredientLibrary(); refreshRowIngredientOptions(); }
  });

  dom.actions.createSnapshot.addEventListener('click', createSnapshot); dom.actions.runCompare.addEventListener('click', runComparison); dom.actions.clearCompare.addEventListener('click', clearComparison);
  dom.actions.exportCurrentCsv.addEventListener('click', exportCurrentCsv); dom.actions.exportCompareCsv.addEventListener('click', exportComparisonCsv);
  dom.actions.printSummary.addEventListener('click', () => window.print());
  dom.actions.copySummary.addEventListener('click', async () => { try { await navigator.clipboard.writeText(reviewSummaryText()); setInlineMessage(dom.snapshotFeedback, 'Summary copied to clipboard.', 'success'); } catch { setInlineMessage(dom.snapshotFeedback, 'Clipboard not available in this browser context.'); } });

  dom.snapshotList.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('button[data-snapshot-view]'); const delBtn = e.target.closest('button[data-snapshot-delete]');
    if (viewBtn) { const snap = state.snapshots.find((s) => s.id === viewBtn.dataset.snapshotView); if (!snap) return; state.comparison = { ...comparePeriods(snap.items, findPeriodBySelector('live').items), leftLabel: `${snap.name} (${snap.periodLabel})`, rightLabel: 'Current Live', notes: '' }; renderDashboard(); return; }
    if (delBtn) { const snap = state.snapshots.find((s) => s.id === delBtn.dataset.snapshotDelete); if (!snap) return; if (!window.confirm(`Delete snapshot "${snap.name}"?`)) return; state.snapshots = state.snapshots.filter((s) => s.id !== snap.id); persistAll(); renderSnapshotSelectors(); renderSnapshotList(); setInlineMessage(dom.snapshotFeedback, 'Snapshot deleted.', 'success'); }
  });
}

function init() {
  loadData(); bindEvents(); renderIngredientLibrary(); renderSnapshotSelectors();
  if (state.draft) { state.activeRecipeId = state.draft.id || null; setRecipeToForm(state.draft); }
  else if (state.recipes[0]) { state.activeRecipeId = state.recipes[0].id; setRecipeToForm(state.recipes[0]); }
  else resetRecipeForm();
  dom.comparisonNotes.value = state.comparisonNotes || '';
  renderRecipeList(); renderDashboard(); recalcAndRender();
}
init();
