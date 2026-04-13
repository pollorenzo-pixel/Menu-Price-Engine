/* ==============================
   Constants and Storage Keys
================================ */
const STORAGE_VERSION = 3;
const STORAGE_KEYS = {
  ingredients: 'mpe_v3_ingredients',
  recipes: 'mpe_v3_recipes',
  draft: 'mpe_v3_active_draft',
  seeded: 'mpe_v3_seeded',
  prefs: 'mpe_v3_dashboard_prefs',
  legacyIngredients: 'mpe_v2_ingredients',
  legacyRecipes: 'mpe_v2_recipes',
  legacyDraft: 'mpe_v2_active_draft',
  legacySeeded: 'mpe_v2_seeded',
};

const PACK_UNITS = ['g', 'kg', 'ml', 'l', 'unit'];
const UNIT_GROUP = { g: 'weight', kg: 'weight', ml: 'volume', l: 'volume', unit: 'count' };
const BASE_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, unit: 1 };
const FOOD_COST_TARGET_DEFAULT = 30;

/* ==============================
   Utility Helpers
================================ */
const nowIso = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const cleanText = (v) => String(v ?? '').trim();
const safeLower = (v) => cleanText(v).toLowerCase();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ==============================
   Formatting Helpers
================================ */
const fmtCurrency = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number.isFinite(value) ? value : 0);
const fmtNumber = (value, digits = 2) => (Number.isFinite(value) ? value : 0).toFixed(digits);
const fmtPercent = (value) => `${fmtNumber(value, 2)}%`;

function setInlineMessage(el, message, type = 'warn') {
  el.textContent = message || '';
  el.classList.toggle('success', type === 'success');
}

/* ==============================
   Storage Helpers
================================ */
function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function getStoredArray(key) {
  const parsed = safeParse(localStorage.getItem(key), []);
  return Array.isArray(parsed) ? parsed : [];
}

function getStoredObject(key, fallback = {}) {
  const parsed = safeParse(localStorage.getItem(key), fallback);
  return parsed && typeof parsed === 'object' ? parsed : fallback;
}

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ==============================
   Unit Conversion
================================ */
function convertUnit(value, fromUnit, toUnit) {
  if (!fromUnit || !toUnit) return { ok: false, value: null, reason: 'Missing units' };
  if (UNIT_GROUP[fromUnit] !== UNIT_GROUP[toUnit]) return { ok: false, value: null, reason: `Cannot convert ${fromUnit} to ${toUnit}` };
  return { ok: true, value: (value * BASE_FACTOR[fromUnit]) / BASE_FACTOR[toUnit], reason: '' };
}

/* ==============================
   App State
================================ */
const state = {
  ingredients: [],
  recipes: [],
  activeRecipeId: null,
  ingredientEditingId: null,
  recipeSearch: '',
  recipeStatusFilter: 'all',
  ingredientSearch: '',
  analysisSearch: '',
  analysisClassFilter: 'all',
  sort: { key: 'name', dir: 'asc' },
  draft: null,
  prefs: { foodCostFlagTarget: 32, lowUnitsThreshold: 25 },
  menuEngine: null,
};

/* ==============================
   Defaults + Sample Data
================================ */
function defaultIngredientRow() {
  return {
    rowId: uid('row'), ingredientId: '', ingredientNameSnapshot: '',
    purchasePriceSnapshot: 0, packSizeSnapshot: 1, packUnitSnapshot: 'g',
    amountUsed: 0, useUnit: 'g', calculatedCostUsed: 0,
  };
}

function defaultRecipe() {
  return {
    id: null,
    name: '',
    category: '',
    portionsYielded: 10,
    packagingCostPerPortion: 0,
    labourCostPerPortion: 0,
    targetFoodCostPercent: FOOD_COST_TARGET_DEFAULT,
    vatRatePercent: 20,
    deliveryCommissionPercent: 30,
    roundingRule: 0.25,
    manualMenuPrice: '',
    ingredientRows: [defaultIngredientRow()],
    sellingPrice: 0,
    unitsSold: 0,
    reportingPeriod: 'Last 30 Days',
    internalScore: '',
    isActive: true,
    itemNotes: '',
    revenueOverride: '',
    storageVersion: STORAGE_VERSION,
    createdAt: null,
    updatedAt: null,
  };
}

function sampleIngredients() {
  return [
    { id: uid('ing'), name: 'Baguette', purchasePrice: 8.4, packSize: 12, packUnit: 'unit', supplier: 'Metro Bakery', notes: 'Case of 12' },
    { id: uid('ing'), name: 'Chicken Thigh', purchasePrice: 24, packSize: 5, packUnit: 'kg', supplier: 'Kiju Butchery', notes: 'Boneless' },
    { id: uid('ing'), name: 'Tofu', purchasePrice: 9.8, packSize: 2, packUnit: 'kg', supplier: 'Tofu House', notes: '' },
    { id: uid('ing'), name: 'Chicken Wings', purchasePrice: 18, packSize: 5, packUnit: 'kg', supplier: 'Kiju Butchery', notes: '' },
    { id: uid('ing'), name: 'Pickled Carrot', purchasePrice: 3.9, packSize: 1, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Daikon', purchasePrice: 2.8, packSize: 1, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Cucumber', purchasePrice: 5.5, packSize: 10, packUnit: 'unit', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Coriander', purchasePrice: 1.6, packSize: 100, packUnit: 'g', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Spring Onion', purchasePrice: 1.2, packSize: 100, packUnit: 'g', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Mayo', purchasePrice: 7.2, packSize: 2, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Soy Glaze', purchasePrice: 5.8, packSize: 1, packUnit: 'l', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Chilli Sauce', purchasePrice: 4.6, packSize: 1, packUnit: 'l', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Salad Leaves', purchasePrice: 6.9, packSize: 500, packUnit: 'g', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Rice Noodles', purchasePrice: 12, packSize: 3, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Takeaway Wrapper', purchasePrice: 5.2, packSize: 100, packUnit: 'unit', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Takeaway Bowl', purchasePrice: 12, packSize: 100, packUnit: 'unit', supplier: '', notes: '' },
  ];
}

function sampleRecipes(ingredients) {
  const find = (name) => ingredients.find((ing) => safeLower(ing.name) === safeLower(name));
  const row = (name, amountUsed, useUnit) => {
    const ing = find(name);
    return {
      rowId: uid('row'), ingredientId: ing?.id ?? '', ingredientNameSnapshot: ing?.name ?? name,
      purchasePriceSnapshot: ing?.purchasePrice ?? 0, packSizeSnapshot: ing?.packSize ?? 1, packUnitSnapshot: ing?.packUnit ?? useUnit,
      amountUsed, useUnit, calculatedCostUsed: 0,
    };
  };

  const base = [
    {
      name: 'Chicken Banh Mi', category: 'Sandwich', portionsYielded: 10, packagingCostPerPortion: 0.32, labourCostPerPortion: 0.6,
      targetFoodCostPercent: 28, vatRatePercent: 20, deliveryCommissionPercent: 30, roundingRule: 0.25, manualMenuPrice: 8.5,
      sellingPrice: 8.5, unitsSold: 320, reportingPeriod: 'Last 30 Days', internalScore: 8.9, isActive: true, revenueOverride: '',
      ingredientRows: [
        row('Baguette', 10, 'unit'), row('Chicken Thigh', 1500, 'g'), row('Pickled Carrot', 300, 'g'),
        row('Daikon', 200, 'g'), row('Coriander', 20, 'g'), row('Spring Onion', 20, 'g'),
        row('Mayo', 180, 'g'), row('Soy Glaze', 80, 'ml'), row('Chilli Sauce', 70, 'ml'), row('Takeaway Wrapper', 10, 'unit'),
      ],
    },
    {
      name: 'Chicken Salad Bowl', category: 'Bowl', portionsYielded: 8, packagingCostPerPortion: 0.42, labourCostPerPortion: 0.8,
      targetFoodCostPercent: 30, vatRatePercent: 20, deliveryCommissionPercent: 32, roundingRule: 0.5, manualMenuPrice: 10.5,
      sellingPrice: 10.5, unitsSold: 260, reportingPeriod: 'Last 30 Days', internalScore: 8.2, isActive: true, revenueOverride: '',
      ingredientRows: [
        row('Chicken Thigh', 1600, 'g'), row('Salad Leaves', 320, 'g'), row('Cucumber', 4, 'unit'), row('Pickled Carrot', 220, 'g'),
        row('Spring Onion', 25, 'g'), row('Soy Glaze', 120, 'ml'), row('Takeaway Bowl', 8, 'unit'),
      ],
    },
    {
      name: 'Tofu Salad Bowl', category: 'Bowl', portionsYielded: 8, packagingCostPerPortion: 0.42, labourCostPerPortion: 0.7,
      targetFoodCostPercent: 29, vatRatePercent: 20, deliveryCommissionPercent: 32, roundingRule: 0.5, manualMenuPrice: 9.95,
      sellingPrice: 9.95, unitsSold: 65, reportingPeriod: 'Last 30 Days', internalScore: 7.3, isActive: true, revenueOverride: '',
      ingredientRows: [
        row('Tofu', 1500, 'g'), row('Salad Leaves', 350, 'g'), row('Cucumber', 5, 'unit'), row('Pickled Carrot', 220, 'g'),
        row('Spring Onion', 25, 'g'), row('Soy Glaze', 140, 'ml'), row('Takeaway Bowl', 8, 'unit'),
      ],
    },
    {
      name: 'Wings', category: 'Sides', portionsYielded: 10, packagingCostPerPortion: 0.22, labourCostPerPortion: 0.45,
      targetFoodCostPercent: 27, vatRatePercent: 20, deliveryCommissionPercent: 30, roundingRule: 0.25, manualMenuPrice: 7.75,
      sellingPrice: 7.75, unitsSold: 95, reportingPeriod: 'Last 30 Days', internalScore: 7.1, isActive: true, revenueOverride: '',
      ingredientRows: [
        row('Chicken Wings', 1800, 'g'), row('Soy Glaze', 110, 'ml'), row('Chilli Sauce', 120, 'ml'), row('Spring Onion', 30, 'g'), row('Takeaway Wrapper', 10, 'unit'),
      ],
    },
  ];

  const stamp = nowIso();
  return base.map((r) => ({ ...defaultRecipe(), ...r, id: uid('rec'), createdAt: stamp, updatedAt: stamp, storageVersion: STORAGE_VERSION }));
}

/* ==============================
   Migration Helpers
================================ */
function migrateIngredient(raw) {
  return {
    id: cleanText(raw?.id) || uid('ing'),
    name: cleanText(raw?.name),
    purchasePrice: Math.max(0, toNumber(raw?.purchasePrice, 0)),
    packSize: Math.max(0.0001, toNumber(raw?.packSize, 1)),
    packUnit: PACK_UNITS.includes(raw?.packUnit) ? raw.packUnit : 'g',
    supplier: cleanText(raw?.supplier),
    notes: cleanText(raw?.notes),
  };
}

function migrateIngredientRow(raw) {
  return {
    rowId: cleanText(raw?.rowId) || uid('row'),
    ingredientId: cleanText(raw?.ingredientId),
    ingredientNameSnapshot: cleanText(raw?.ingredientNameSnapshot ?? raw?.name ?? ''),
    purchasePriceSnapshot: Math.max(0, toNumber(raw?.purchasePriceSnapshot ?? raw?.purchasePrice, 0)),
    packSizeSnapshot: Math.max(0.0001, toNumber(raw?.packSizeSnapshot ?? raw?.packSize, 1)),
    packUnitSnapshot: PACK_UNITS.includes(raw?.packUnitSnapshot ?? raw?.packUnit) ? (raw?.packUnitSnapshot ?? raw?.packUnit) : 'g',
    amountUsed: Math.max(0, toNumber(raw?.amountUsed, 0)),
    useUnit: PACK_UNITS.includes(raw?.useUnit) ? raw.useUnit : 'g',
    calculatedCostUsed: Math.max(0, toNumber(raw?.calculatedCostUsed, 0)),
  };
}

function migrateRecipe(raw) {
  const seeded = { ...defaultRecipe(), ...raw };
  const calc = calculateRecipeMetrics({ ...seeded, ingredientRows: (raw?.ingredientRows || []).map(migrateIngredientRow) }, { suppressWarnings: true });
  const roundedSuggestion = calc.roundedSellingPrice;
  return {
    ...seeded,
    id: cleanText(raw?.id) || uid('rec'),
    name: cleanText(raw?.name),
    category: cleanText(raw?.category),
    portionsYielded: Math.max(0.01, toNumber(raw?.portionsYielded, 10)),
    packagingCostPerPortion: Math.max(0, toNumber(raw?.packagingCostPerPortion, 0)),
    labourCostPerPortion: Math.max(0, toNumber(raw?.labourCostPerPortion, 0)),
    targetFoodCostPercent: clamp(toNumber(raw?.targetFoodCostPercent, FOOD_COST_TARGET_DEFAULT), 0.01, 99.99),
    vatRatePercent: Math.max(0, toNumber(raw?.vatRatePercent, 20)),
    deliveryCommissionPercent: Math.max(0, toNumber(raw?.deliveryCommissionPercent, 30)),
    roundingRule: toNumber(raw?.roundingRule, 0.25) || 0.25,
    manualMenuPrice: raw?.manualMenuPrice === '' ? '' : Math.max(0, toNumber(raw?.manualMenuPrice, 0)),
    sellingPrice: Math.max(0, toNumber(raw?.sellingPrice, roundedSuggestion || toNumber(raw?.manualMenuPrice, 0))),
    unitsSold: Math.max(0, toNumber(raw?.unitsSold, 0)),
    reportingPeriod: cleanText(raw?.reportingPeriod || 'Last 30 Days'),
    internalScore: raw?.internalScore === '' ? '' : clamp(toNumber(raw?.internalScore, 0), 0, 10),
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : true,
    itemNotes: cleanText(raw?.itemNotes),
    revenueOverride: raw?.revenueOverride === '' ? '' : Math.max(0, toNumber(raw?.revenueOverride, 0)),
    ingredientRows: Array.isArray(raw?.ingredientRows) && raw.ingredientRows.length ? raw.ingredientRows.map(migrateIngredientRow) : [defaultIngredientRow()],
    storageVersion: STORAGE_VERSION,
    createdAt: cleanText(raw?.createdAt) || nowIso(),
    updatedAt: cleanText(raw?.updatedAt) || nowIso(),
  };
}

/* ==============================
   Calculation Engine (Stage 2 + 3)
================================ */
function calculateRowCost(row) {
  const purchasePrice = Math.max(0, toNumber(row.purchasePriceSnapshot, 0));
  const packSize = Math.max(0.0001, toNumber(row.packSizeSnapshot, 1));
  const amountUsed = Math.max(0, toNumber(row.amountUsed, 0));

  const converted = convertUnit(amountUsed, row.useUnit, row.packUnitSnapshot);
  if (!converted.ok) return { cost: 0, warning: converted.reason };

  const unitCost = purchasePrice / packSize;
  return { cost: unitCost * converted.value, warning: '' };
}

function roundToRule(value, rule = 0.25) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(rule) || rule <= 0) return value;
  return Math.round(value / rule) * rule;
}

function calculateRecipeMetrics(recipe, options = {}) {
  const warnings = [];
  const rows = Array.isArray(recipe.ingredientRows) ? recipe.ingredientRows : [];
  let totalIngredientCost = 0;
  const computedRows = rows.map((row) => {
    const calc = calculateRowCost(row);
    if (calc.warning && !options.suppressWarnings) warnings.push(`${row.ingredientNameSnapshot || 'Row'}: ${calc.warning}`);
    totalIngredientCost += calc.cost;
    return { ...row, calculatedCostUsed: calc.cost };
  });

  const portions = Math.max(0.01, toNumber(recipe.portionsYielded, 10));
  const ingredientCostPerPortion = totalIngredientCost / portions;
  const totalCostPerPortionExclLabour = ingredientCostPerPortion + Math.max(0, toNumber(recipe.packagingCostPerPortion, 0));
  const totalCostPerPortionInclLabour = totalCostPerPortionExclLabour + Math.max(0, toNumber(recipe.labourCostPerPortion, 0));
  const targetFoodCostPct = clamp(toNumber(recipe.targetFoodCostPercent, FOOD_COST_TARGET_DEFAULT), 0.01, 99.99);
  const suggestedNetSellingPrice = targetFoodCostPct > 0 ? totalCostPerPortionExclLabour / (targetFoodCostPct / 100) : 0;
  const roundedSellingPrice = roundToRule(suggestedNetSellingPrice, toNumber(recipe.roundingRule, 0.25));
  const vatInclusivePrice = roundedSellingPrice * (1 + Math.max(0, toNumber(recipe.vatRatePercent, 20)) / 100);
  const deliveryAdjustedRecommendation = roundedSellingPrice / Math.max(0.01, 1 - Math.max(0, toNumber(recipe.deliveryCommissionPercent, 30)) / 100);

  const sellingPrice = Math.max(0, toNumber(recipe.sellingPrice, 0));
  const manualMenuPrice = recipe.manualMenuPrice === '' ? null : Math.max(0, toNumber(recipe.manualMenuPrice, 0));
  const effectiveMenuPrice = sellingPrice > 0 ? sellingPrice : (manualMenuPrice ?? roundedSellingPrice);
  const foodCostPercent = effectiveMenuPrice > 0 ? (totalCostPerPortionExclLabour / effectiveMenuPrice) * 100 : 0;
  const grossProfitPerPortion = effectiveMenuPrice - totalCostPerPortionExclLabour;
  const foodCostManualPercent = manualMenuPrice && manualMenuPrice > 0 ? (totalCostPerPortionExclLabour / manualMenuPrice) * 100 : null;

  const unitsSold = Math.max(0, toNumber(recipe.unitsSold, 0));
  const rawRevenue = effectiveMenuPrice * unitsSold;
  const revenue = recipe.revenueOverride === '' ? rawRevenue : Math.max(0, toNumber(recipe.revenueOverride, rawRevenue));
  const totalIngredientCostPeriod = totalCostPerPortionExclLabour * unitsSold;
  const totalGrossProfit = grossProfitPerPortion * unitsSold;

  return {
    ...recipe,
    ingredientRows: computedRows,
    totalIngredientCost,
    ingredientCostPerPortion,
    totalCostPerPortionExclLabour,
    totalCostPerPortionInclLabour,
    suggestedNetSellingPrice,
    roundedSellingPrice,
    vatInclusivePrice,
    deliveryAdjustedRecommendation,
    effectiveMenuPrice,
    foodCostPercent,
    foodCostManualPercent,
    grossProfitPerPortion,
    contributionPerItemSold: grossProfitPerPortion,
    unitsSold,
    revenue,
    totalIngredientCostPeriod,
    totalGrossProfit,
    warnings,
  };
}

/* ==============================
   Menu Engineering Engine
================================ */
function classifyMenuItems(recipesWithMetrics) {
  const activeItems = recipesWithMetrics.filter((r) => r.isActive && Number.isFinite(r.unitsSold) && Number.isFinite(r.grossProfitPerPortion));
  if (activeItems.length < 2) {
    return {
      averages: { unitsSold: 0, grossProfitPerPortion: 0 },
      items: recipesWithMetrics.map((r) => ({ ...r, classification: 'Unclassified', popularityBand: 'n/a', profitabilityBand: 'n/a' })),
      fallback: 'Not enough active item data to classify. Add at least 2 active items with units sold and selling price.',
    };
  }

  const avgUnits = activeItems.reduce((sum, item) => sum + item.unitsSold, 0) / activeItems.length;
  const avgGross = activeItems.reduce((sum, item) => sum + item.grossProfitPerPortion, 0) / activeItems.length;

  const items = recipesWithMetrics.map((item) => {
    if (!item.isActive) return { ...item, classification: 'Inactive', popularityBand: 'n/a', profitabilityBand: 'n/a' };
    const highPopularity = item.unitsSold >= avgUnits;
    const highProfitability = item.grossProfitPerPortion >= avgGross;
    let classification = 'Dog';
    if (highPopularity && highProfitability) classification = 'Star';
    else if (highPopularity && !highProfitability) classification = 'Plowhorse';
    else if (!highPopularity && highProfitability) classification = 'Puzzle';
    return {
      ...item,
      classification,
      popularityBand: highPopularity ? 'high' : 'low',
      profitabilityBand: highProfitability ? 'high' : 'low',
    };
  });

  return {
    averages: { unitsSold: avgUnits, grossProfitPerPortion: avgGross },
    items,
    fallback: '',
  };
}

function getRecommendedAction(item, prefs = state.prefs) {
  if (!item.isActive) return 'Inactive item. Keep for reference or reactivate.';
  const foodCostFlag = item.foodCostPercent > prefs.foodCostFlagTarget;
  if (item.grossProfitPerPortion <= 0) return 'Urgent: negative margin, reprice or redesign immediately.';
  const byClass = {
    Star: 'Promote and protect.',
    Plowhorse: 'Review pricing or reduce cost.',
    Puzzle: 'Improve visibility and push sales.',
    Dog: 'Consider removing or redesigning.',
    Unclassified: 'Collect more data before deciding.',
  };

  let text = byClass[item.classification] || 'Review performance and adjust.';
  if (foodCostFlag && item.unitsSold >= state.prefs.lowUnitsThreshold) text += ' Sells well but margin needs work.';
  if (item.classification === 'Puzzle' && item.grossProfitPerPortion > state.menuEngine?.averages?.grossProfitPerPortion) text += ' Profitable but may need stronger menu placement.';
  return text;
}

function getItemFlags(item, prefs = state.prefs) {
  const flags = [];
  if (!item.isActive) flags.push('Inactive item');
  if (item.foodCostPercent > prefs.foodCostFlagTarget) flags.push(`Food cost > ${prefs.foodCostFlagTarget}%`);
  if (item.effectiveMenuPrice < item.roundedSellingPrice) flags.push('Selling price below recommendation');
  if (item.unitsSold <= prefs.lowUnitsThreshold) flags.push('Low units sold');
  if (item.grossProfitPerPortion <= 0.15) flags.push('Near-zero or negative margin');
  if (!Number.isFinite(item.effectiveMenuPrice) || item.effectiveMenuPrice <= 0 || item.unitsSold === null || item.unitsSold === undefined) flags.push('Missing performance data');
  return flags;
}

function buildDashboard(items, menuEngine) {
  const activeItems = items.filter((i) => i.isActive);
  const classified = activeItems.filter((i) => ['Star', 'Plowhorse', 'Puzzle', 'Dog'].includes(i.classification));

  const totals = {
    totalActiveItems: activeItems.length,
    totalUnitsSold: activeItems.reduce((sum, i) => sum + i.unitsSold, 0),
    totalRevenue: activeItems.reduce((sum, i) => sum + i.revenue, 0),
    totalGrossProfit: activeItems.reduce((sum, i) => sum + i.totalGrossProfit, 0),
    avgSellingPrice: activeItems.length ? activeItems.reduce((sum, i) => sum + i.effectiveMenuPrice, 0) / activeItems.length : 0,
    avgFoodCostPercent: activeItems.length ? activeItems.reduce((sum, i) => sum + i.foodCostPercent, 0) / activeItems.length : 0,
    avgGrossProfitPerPortion: activeItems.length ? activeItems.reduce((sum, i) => sum + i.grossProfitPerPortion, 0) / activeItems.length : 0,
    stars: classified.filter((i) => i.classification === 'Star').length,
    plowhorses: classified.filter((i) => i.classification === 'Plowhorse').length,
    puzzles: classified.filter((i) => i.classification === 'Puzzle').length,
    dogs: classified.filter((i) => i.classification === 'Dog').length,
  };

  const topUnits = [...activeItems].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 3);
  const topProfit = [...activeItems].sort((a, b) => b.totalGrossProfit - a.totalGrossProfit).slice(0, 3);
  const lowMargin = [...activeItems].sort((a, b) => a.grossProfitPerPortion - b.grossProfitPerPortion).slice(0, 3);
  const highFoodCost = activeItems.filter((i) => i.foodCostPercent > state.prefs.foodCostFlagTarget);

  const flagCounts = {
    aboveFoodCostTarget: activeItems.filter((i) => i.foodCostPercent > state.prefs.foodCostFlagTarget).length,
    pricedBelowRecommendation: activeItems.filter((i) => i.effectiveMenuPrice < i.roundedSellingPrice).length,
    needsReview: activeItems.filter((i) => getItemFlags(i).length > 0).length,
    missingSalesData: activeItems.filter((i) => i.unitsSold <= 0).length,
  };

  const insights = [];
  if (totals.dogs > 0) insights.push(`${totals.dogs} Dog item(s) need redesign or removal review.`);
  if (highFoodCost.length > 0) insights.push(`${highFoodCost.length} item(s) are above food cost target (${state.prefs.foodCostFlagTarget}%).`);
  if (totals.puzzles > 0) insights.push(`${totals.puzzles} Puzzle item(s) are profitable but under-ordered.`);
  if (topProfit[0]) insights.push(`Top profit driver: ${topProfit[0].name} (${fmtCurrency(topProfit[0].totalGrossProfit)}).`);
  if (!insights.length) insights.push('Menu performance is stable. Continue monitoring stars and margins weekly.');

  return { totals, topUnits, topProfit, lowMargin, highFoodCost, flagCounts, insights, averages: menuEngine.averages };
}

/* ==============================
   DOM Cache
================================ */
const $ = (id) => document.getElementById(id);
const dom = {
  recipeList: $('recipe-list'), recipeSearch: $('recipe-search'), recipeCount: $('recipe-count'), recipeStatusFilter: $('recipe-status-filter'),
  editorErrors: $('editor-errors'), calcWarnings: $('calc-warnings'), ingredientRows: $('ingredient-rows'), template: $('ingredient-row-template'),
  insightList: $('insight-list'), itemFlagList: $('item-flag-list'), draftState: $('draft-state'),
  analysisSearch: $('analysis-search'), analysisClassFilter: $('analysis-class-filter'), analysisBody: $('analysis-body'), analysisTable: $('analysis-table'),
  dashboardCards: $('dashboard-cards'), bulkFlagSummary: $('bulk-flag-summary'), topUnitsList: $('top-units-list'), topProfitList: $('top-profit-list'),
  menuInsightList: $('menu-insight-list'), matrixChart: $('matrix-chart'), matrixFallback: $('matrix-fallback'), periodLabel: $('period-label'),
  results: {
    totalIngredient: $('res-total-ingredient'), ingredientPortion: $('res-ingredient-portion'), totalPortion: $('res-total-portion'),
    totalLabour: $('res-total-labour'), suggestedNet: $('res-suggested-net'), rounded: $('res-rounded'), vat: $('res-vat'), delivery: $('res-delivery'),
    gross: $('res-gross'), foodRounded: $('res-food-rounded'), totalRevenue: $('res-total-revenue'), totalGrossProfit: $('res-total-gross-profit'),
    classification: $('res-classification'), action: $('res-action'),
  },
  fields: {
    name: $('recipe-name'), category: $('recipe-category'), portions: $('portions-yielded'), packaging: $('packaging-cost'), labour: $('labour-cost'),
    target: $('target-food-cost'), vat: $('vat-rate'), delivery: $('delivery-commission'), rounding: $('rounding-rule'), manual: $('manual-price'),
    sellingPrice: $('selling-price'), unitsSold: $('units-sold'), reportingPeriod: $('reporting-period'), internalScore: $('internal-score'),
    isActive: $('is-active'), itemNotes: $('item-notes'), revenueOverride: $('revenue-override'),
  },
  actions: {
    newRecipe: $('new-recipe-btn'), save: $('save-recipe-btn'), update: $('update-recipe-btn'), duplicate: $('duplicate-recipe-btn'),
    del: $('delete-recipe-btn'), reset: $('reset-form-btn'), addRow: $('add-row-btn'), openLib: $('open-library-btn'), closeLib: $('close-library-btn'),
  },
  library: {
    modal: $('library-modal'), errors: $('library-errors'), count: $('ingredient-count'), search: $('ingredient-search'), body: $('ingredient-library-body'),
    name: $('lib-name'), price: $('lib-price'), packSize: $('lib-pack-size'), packUnit: $('lib-pack-unit'), supplier: $('lib-supplier'), notes: $('lib-notes'),
    add: $('add-ingredient-btn'), update: $('update-ingredient-btn'), clear: $('clear-ingredient-form-btn'),
  },
};

/* ==============================
   Validation
================================ */
function validateRecipe(recipe) {
  const errors = [];
  if (!recipe.name) errors.push('Recipe name is required.');
  if (!(recipe.portionsYielded > 0)) errors.push('Portions yielded must be greater than 0.');
  if (!(recipe.targetFoodCostPercent > 0 && recipe.targetFoodCostPercent < 100)) errors.push('Target food cost must be between 0 and 100.');
  if (recipe.sellingPrice < 0) errors.push('Selling price must be 0 or greater.');
  if (recipe.unitsSold < 0) errors.push('Units sold must be 0 or greater.');
  return errors;
}

function clearValidationState() {
  Object.values(dom.fields).forEach((el) => el.classList.remove('is-invalid'));
}

function markValidation(recipe) {
  clearValidationState();
  if (!recipe.name) dom.fields.name.classList.add('is-invalid');
  if (!(recipe.portionsYielded > 0)) dom.fields.portions.classList.add('is-invalid');
  if (!(recipe.targetFoodCostPercent > 0 && recipe.targetFoodCostPercent < 100)) dom.fields.target.classList.add('is-invalid');
  if (recipe.sellingPrice < 0) dom.fields.sellingPrice.classList.add('is-invalid');
  if (recipe.unitsSold < 0) dom.fields.unitsSold.classList.add('is-invalid');
}

function validateIngredientInput(input, editingId = null) {
  const errors = [];
  if (!input.name) errors.push('Ingredient name is required.');
  if (input.purchasePrice < 0) errors.push('Purchase price must be 0 or greater.');
  if (!(input.packSize > 0)) errors.push('Pack size must be greater than 0.');
  if (!PACK_UNITS.includes(input.packUnit)) errors.push('Pack unit is required.');
  const duplicate = state.ingredients.some((ing) => safeLower(ing.name) === safeLower(input.name) && ing.id !== editingId);
  if (duplicate) errors.push('An ingredient with this name already exists.');
  return errors;
}

/* ==============================
   Form and Row Helpers
================================ */
function readRowsFromDom() {
  const rows = [...dom.ingredientRows.querySelectorAll('tr')].map((tr) => {
    const q = (s) => tr.querySelector(s);
    return migrateIngredientRow({
      rowId: tr.dataset.rowId,
      ingredientId: q('.row-lib-select').value,
      ingredientNameSnapshot: q('.row-name').value,
      purchasePriceSnapshot: q('.row-price').value,
      packSizeSnapshot: q('.row-pack-size').value,
      packUnitSnapshot: q('.row-pack-unit').value,
      amountUsed: q('.row-amount').value,
      useUnit: q('.row-use-unit').value,
      calculatedCostUsed: toNumber(q('.row-cost').dataset.cost, 0),
    });
  });
  return rows.length ? rows : [defaultIngredientRow()];
}

function readRecipeFromForm() {
  const raw = {
    id: state.activeRecipeId,
    name: cleanText(dom.fields.name.value),
    category: cleanText(dom.fields.category.value),
    portionsYielded: toNumber(dom.fields.portions.value, 0),
    packagingCostPerPortion: toNumber(dom.fields.packaging.value, 0),
    labourCostPerPortion: toNumber(dom.fields.labour.value, 0),
    targetFoodCostPercent: toNumber(dom.fields.target.value, 0),
    vatRatePercent: toNumber(dom.fields.vat.value, 0),
    deliveryCommissionPercent: toNumber(dom.fields.delivery.value, 0),
    roundingRule: toNumber(dom.fields.rounding.value, 0.25),
    manualMenuPrice: dom.fields.manual.value === '' ? '' : toNumber(dom.fields.manual.value, 0),
    sellingPrice: toNumber(dom.fields.sellingPrice.value, 0),
    unitsSold: toNumber(dom.fields.unitsSold.value, 0),
    reportingPeriod: cleanText(dom.fields.reportingPeriod.value || 'Last 30 Days'),
    internalScore: dom.fields.internalScore.value === '' ? '' : clamp(toNumber(dom.fields.internalScore.value, 0), 0, 10),
    isActive: dom.fields.isActive.value === 'true',
    itemNotes: cleanText(dom.fields.itemNotes.value),
    revenueOverride: dom.fields.revenueOverride.value === '' ? '' : toNumber(dom.fields.revenueOverride.value, 0),
    ingredientRows: readRowsFromDom(),
  };
  return migrateRecipe(raw);
}

function setRecipeToForm(recipe) {
  dom.fields.name.value = recipe.name;
  dom.fields.category.value = recipe.category;
  dom.fields.portions.value = recipe.portionsYielded;
  dom.fields.packaging.value = recipe.packagingCostPerPortion;
  dom.fields.labour.value = recipe.labourCostPerPortion;
  dom.fields.target.value = recipe.targetFoodCostPercent;
  dom.fields.vat.value = recipe.vatRatePercent;
  dom.fields.delivery.value = recipe.deliveryCommissionPercent;
  dom.fields.rounding.value = String(recipe.roundingRule);
  dom.fields.manual.value = recipe.manualMenuPrice === '' ? '' : recipe.manualMenuPrice;
  dom.fields.sellingPrice.value = recipe.sellingPrice;
  dom.fields.unitsSold.value = recipe.unitsSold;
  dom.fields.reportingPeriod.value = recipe.reportingPeriod;
  dom.fields.internalScore.value = recipe.internalScore === '' ? '' : recipe.internalScore;
  dom.fields.isActive.value = String(recipe.isActive);
  dom.fields.itemNotes.value = recipe.itemNotes;
  dom.fields.revenueOverride.value = recipe.revenueOverride === '' ? '' : recipe.revenueOverride;

  dom.ingredientRows.innerHTML = '';
  (recipe.ingredientRows?.length ? recipe.ingredientRows : [defaultIngredientRow()]).forEach(addRowToDom);
  recalcAndRender();
}

function addRowToDom(rowData = defaultIngredientRow()) {
  const fragment = dom.template.content.cloneNode(true);
  const tr = fragment.querySelector('tr');
  tr.dataset.rowId = rowData.rowId || uid('row');

  const select = tr.querySelector('.row-lib-select');
  select.innerHTML = '<option value="">Manual / Snapshot</option>';
  state.ingredients.forEach((ing) => {
    const opt = document.createElement('option');
    opt.value = ing.id;
    opt.textContent = ing.name;
    select.appendChild(opt);
  });

  const nameInput = tr.querySelector('.row-name');
  const priceInput = tr.querySelector('.row-price');
  const sizeInput = tr.querySelector('.row-pack-size');
  const packUnit = tr.querySelector('.row-pack-unit');
  const amountInput = tr.querySelector('.row-amount');
  const useUnit = tr.querySelector('.row-use-unit');
  const costSpan = tr.querySelector('.row-cost');

  select.value = rowData.ingredientId || '';
  nameInput.value = rowData.ingredientNameSnapshot || '';
  priceInput.value = rowData.purchasePriceSnapshot;
  sizeInput.value = rowData.packSizeSnapshot;
  packUnit.value = rowData.packUnitSnapshot;
  amountInput.value = rowData.amountUsed;
  useUnit.value = rowData.useUnit;

  select.addEventListener('change', () => {
    const ing = state.ingredients.find((x) => x.id === select.value);
    if (ing) {
      nameInput.value = ing.name;
      priceInput.value = ing.purchasePrice;
      sizeInput.value = ing.packSize;
      packUnit.value = ing.packUnit;
      useUnit.value = ing.packUnit;
    }
    recalcAndRender();
  });

  [nameInput, priceInput, sizeInput, packUnit, amountInput, useUnit].forEach((el) => {
    el.addEventListener('input', recalcAndRender);
    el.addEventListener('change', recalcAndRender);
  });

  tr.querySelector('.row-remove').addEventListener('click', () => {
    tr.remove();
    if (!dom.ingredientRows.querySelector('tr')) addRowToDom(defaultIngredientRow());
    recalcAndRender();
  });

  dom.ingredientRows.appendChild(fragment);
  const calc = calculateRowCost(migrateIngredientRow({
    purchasePriceSnapshot: priceInput.value,
    packSizeSnapshot: sizeInput.value,
    packUnitSnapshot: packUnit.value,
    amountUsed: amountInput.value,
    useUnit: useUnit.value,
  }));
  costSpan.dataset.cost = String(calc.cost);
  costSpan.textContent = fmtCurrency(calc.cost);
}

function resetRecipeForm() {
  state.activeRecipeId = null;
  clearValidationState();
  setRecipeToForm(defaultRecipe());
  setInlineMessage(dom.editorErrors, '', 'warn');
}

/* ==============================
   Persistence
================================ */
function persistAll() {
  setStored(STORAGE_KEYS.ingredients, state.ingredients);
  setStored(STORAGE_KEYS.recipes, state.recipes);
  setStored(STORAGE_KEYS.prefs, state.prefs);
}

function persistDraft() {
  const recipe = readRecipeFromForm();
  recipe.updatedAt = nowIso();
  state.draft = recipe;
  setStored(STORAGE_KEYS.draft, recipe);
  dom.draftState.textContent = `Draft autosaved ${new Date().toLocaleTimeString()}`;
}

function loadData() {
  const currentIngredients = getStoredArray(STORAGE_KEYS.ingredients);
  const currentRecipes = getStoredArray(STORAGE_KEYS.recipes);

  let ingredients = currentIngredients;
  let recipes = currentRecipes;

  if (!ingredients.length && !recipes.length) {
    const legacyIngredients = getStoredArray(STORAGE_KEYS.legacyIngredients);
    const legacyRecipes = getStoredArray(STORAGE_KEYS.legacyRecipes);
    if (legacyIngredients.length || legacyRecipes.length) {
      ingredients = legacyIngredients;
      recipes = legacyRecipes;
    }
  }

  state.ingredients = ingredients.map(migrateIngredient);
  state.recipes = recipes.map(migrateRecipe);
  state.prefs = { ...state.prefs, ...getStoredObject(STORAGE_KEYS.prefs, {}) };

  const seededFlag = localStorage.getItem(STORAGE_KEYS.seeded) || localStorage.getItem(STORAGE_KEYS.legacySeeded);
  if (!state.ingredients.length && !state.recipes.length && !seededFlag) {
    const seeds = sampleIngredients();
    state.ingredients = seeds;
    state.recipes = sampleRecipes(seeds);
    localStorage.setItem(STORAGE_KEYS.seeded, '1');
    persistAll();
  }

  const storedDraft = safeParse(localStorage.getItem(STORAGE_KEYS.draft), null) || safeParse(localStorage.getItem(STORAGE_KEYS.legacyDraft), null);
  state.draft = storedDraft ? migrateRecipe(storedDraft) : null;

  persistAll();
}

/* ==============================
   Rendering
================================ */
function getBadgeClass(classification) {
  if (classification === 'Star') return 'badge-star';
  if (classification === 'Plowhorse') return 'badge-plowhorse';
  if (classification === 'Puzzle') return 'badge-puzzle';
  if (classification === 'Dog') return 'badge-dog';
  return 'badge-inactive';
}

function renderRecipeList() {
  const search = safeLower(state.recipeSearch);
  const filtered = state.recipes
    .map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }))
    .filter((r) => {
      const searchMatch = !search || safeLower(r.name).includes(search);
      const statusMatch = state.recipeStatusFilter === 'all' || (state.recipeStatusFilter === 'active' ? r.isActive : !r.isActive);
      return searchMatch && statusMatch;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  dom.recipeCount.textContent = String(filtered.length);
  dom.recipeList.innerHTML = '';

  filtered.forEach((recipe) => {
    const li = document.createElement('li');
    li.className = `recipe-item ${state.activeRecipeId === recipe.id ? 'active' : ''}`;
    li.innerHTML = `
      <h4>${recipe.name || '(Untitled Recipe)'}</h4>
      <p>${recipe.category || 'No category'} · ${recipe.reportingPeriod}</p>
      <div class="recipe-meta-row"><span>${fmtCurrency(recipe.effectiveMenuPrice)}</span><span>${fmtPercent(recipe.foodCostPercent)}</span></div>
      <div class="recipe-meta-row"><span>${recipe.isActive ? 'Active' : 'Inactive'}</span><span>${recipe.unitsSold} units</span></div>
    `;
    li.addEventListener('click', () => {
      state.activeRecipeId = recipe.id;
      setRecipeToForm(migrateRecipe(recipe));
      renderRecipeList();
    });
    dom.recipeList.appendChild(li);
  });
}

function renderIngredientLibrary() {
  const search = safeLower(state.ingredientSearch);
  const usageCount = new Map();
  state.recipes.forEach((r) => (r.ingredientRows || []).forEach((row) => {
    if (row.ingredientId) usageCount.set(row.ingredientId, (usageCount.get(row.ingredientId) || 0) + 1);
  }));

  const rows = state.ingredients.filter((ing) => !search || safeLower(ing.name).includes(search));
  dom.library.count.textContent = String(rows.length);
  dom.library.body.innerHTML = '';

  rows.forEach((ing) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ing.name}</td>
      <td>${fmtCurrency(ing.purchasePrice)}</td>
      <td>${fmtNumber(ing.packSize, 3)} ${ing.packUnit}</td>
      <td>${ing.supplier || '—'}</td>
      <td>${ing.notes || '—'}</td>
      <td>${usageCount.get(ing.id) || 0}</td>
      <td>
        <button class="btn btn-secondary" data-action="edit" data-id="${ing.id}">Edit</button>
        <button class="btn btn-danger" data-action="delete" data-id="${ing.id}">Delete</button>
      </td>
    `;
    dom.library.body.appendChild(tr);
  });
}

function renderInsights(metrics, classifiedItem) {
  const insights = [];
  if (metrics.foodCostPercent > metrics.targetFoodCostPercent) insights.push(`Food cost (${fmtPercent(metrics.foodCostPercent)}) is above target (${fmtPercent(metrics.targetFoodCostPercent)}).`);
  if (metrics.grossProfitPerPortion <= 0) insights.push('Margin is negative or zero. Reprice or reduce cost now.');
  if (metrics.deliveryAdjustedRecommendation > metrics.effectiveMenuPrice) insights.push('Delivery-adjusted recommendation is above current selling price.');
  if (classifiedItem && classifiedItem.classification !== 'Unclassified' && classifiedItem.classification !== 'Inactive') insights.push(`This item is currently classified as ${classifiedItem.classification}.`);
  if (!insights.length) insights.push('Costing and menu performance are within reasonable range.');
  dom.insightList.innerHTML = insights.map((i) => `<li>${i}</li>`).join('');

  const flags = getItemFlags(classifiedItem || metrics);
  dom.itemFlagList.innerHTML = flags.length ? flags.map((f) => `<li>${f}</li>`).join('') : '<li>No major operational flags.</li>';
}

function recalcAndRender() {
  const recipe = readRecipeFromForm();
  const metrics = calculateRecipeMetrics(recipe);

  [...dom.ingredientRows.querySelectorAll('tr')].forEach((tr, idx) => {
    const costSpan = tr.querySelector('.row-cost');
    const cost = metrics.ingredientRows[idx]?.calculatedCostUsed ?? 0;
    costSpan.dataset.cost = String(cost);
    costSpan.textContent = fmtCurrency(cost);
  });

  dom.results.totalIngredient.textContent = fmtCurrency(metrics.totalIngredientCost);
  dom.results.ingredientPortion.textContent = fmtCurrency(metrics.ingredientCostPerPortion);
  dom.results.totalPortion.textContent = fmtCurrency(metrics.totalCostPerPortionExclLabour);
  dom.results.totalLabour.textContent = fmtCurrency(metrics.totalCostPerPortionInclLabour);
  dom.results.suggestedNet.textContent = fmtCurrency(metrics.suggestedNetSellingPrice);
  dom.results.rounded.textContent = fmtCurrency(metrics.roundedSellingPrice);
  dom.results.vat.textContent = fmtCurrency(metrics.vatInclusivePrice);
  dom.results.delivery.textContent = fmtCurrency(metrics.deliveryAdjustedRecommendation);
  dom.results.gross.textContent = fmtCurrency(metrics.grossProfitPerPortion);
  dom.results.foodRounded.textContent = fmtPercent(metrics.foodCostPercent);
  dom.results.totalRevenue.textContent = fmtCurrency(metrics.revenue);
  dom.results.totalGrossProfit.textContent = fmtCurrency(metrics.totalGrossProfit);

  const ifLoaded = state.menuEngine?.items?.find((x) => x.id === metrics.id);
  const label = ifLoaded?.classification || 'Unclassified';
  dom.results.classification.textContent = label;
  dom.results.action.textContent = getRecommendedAction(ifLoaded || { ...metrics, classification: label, isActive: metrics.isActive });

  setInlineMessage(dom.calcWarnings, metrics.warnings.join(' · '), 'warn');
  renderInsights(metrics, ifLoaded || { ...metrics, classification: label, isActive: metrics.isActive });

  if (document.activeElement !== dom.fields.sellingPrice && (!recipe.sellingPrice || recipe.sellingPrice === 0) && metrics.roundedSellingPrice > 0) {
    dom.fields.sellingPrice.value = fmtNumber(metrics.roundedSellingPrice, 2);
  }

  persistDraft();
}

function renderDashboard() {
  const metricsItems = state.recipes.map((r) => calculateRecipeMetrics(r, { suppressWarnings: true }));
  state.menuEngine = classifyMenuItems(metricsItems);
  const classified = state.menuEngine.items.map((item) => ({ ...item, action: getRecommendedAction(item), flags: getItemFlags(item) }));
  const dashboard = buildDashboard(classified, state.menuEngine);

  dom.periodLabel.textContent = `Reporting period: ${classified.find((i) => i.reportingPeriod)?.reportingPeriod || 'mixed'}`;

  const cards = [
    ['Active Items', dashboard.totals.totalActiveItems],
    ['Total Units Sold', dashboard.totals.totalUnitsSold],
    ['Total Revenue', fmtCurrency(dashboard.totals.totalRevenue)],
    ['Total Gross Profit', fmtCurrency(dashboard.totals.totalGrossProfit)],
    ['Avg Selling Price', fmtCurrency(dashboard.totals.avgSellingPrice)],
    ['Avg Food Cost %', fmtPercent(dashboard.totals.avgFoodCostPercent)],
    ['Avg GP / Portion', fmtCurrency(dashboard.totals.avgGrossProfitPerPortion)],
    ['Stars', dashboard.totals.stars],
    ['Plowhorses', dashboard.totals.plowhorses],
    ['Puzzles', dashboard.totals.puzzles],
    ['Dogs', dashboard.totals.dogs],
  ];
  dom.dashboardCards.innerHTML = cards.map(([k, v]) => `<div class="metric-card"><span>${k}</span><strong>${v}</strong></div>`).join('');

  dom.bulkFlagSummary.innerHTML = `
    <li>Items above food cost target: ${dashboard.flagCounts.aboveFoodCostTarget}</li>
    <li>Items priced below recommendation: ${dashboard.flagCounts.pricedBelowRecommendation}</li>
    <li>Items needing review: ${dashboard.flagCounts.needsReview}</li>
    <li>Items missing sales data: ${dashboard.flagCounts.missingSalesData}</li>
  `;

  dom.topUnitsList.innerHTML = dashboard.topUnits.map((i) => `<li>${i.name} (${i.unitsSold} units)</li>`).join('') || '<li>No active items.</li>';
  dom.topProfitList.innerHTML = dashboard.topProfit.map((i) => `<li>${i.name} (${fmtCurrency(i.totalGrossProfit)})</li>`).join('') || '<li>No active items.</li>';
  dom.menuInsightList.innerHTML = dashboard.insights.map((text) => `<li>${text}</li>`).join('');

  renderAnalysisTable(classified);
  renderMatrix(classified, state.menuEngine);

  const activeId = state.activeRecipeId;
  if (activeId) {
    const activeClassified = classified.find((x) => x.id === activeId);
    if (activeClassified) {
      dom.results.classification.textContent = activeClassified.classification;
      dom.results.action.textContent = activeClassified.action;
      renderInsights(activeClassified, activeClassified);
    }
  }
}

function renderAnalysisTable(classifiedItems) {
  let rows = classifiedItems.filter((item) => item.isActive);
  const q = safeLower(state.analysisSearch);
  if (q) rows = rows.filter((i) => safeLower(i.name).includes(q));
  if (state.analysisClassFilter !== 'all') rows = rows.filter((i) => i.classification === state.analysisClassFilter);

  const key = state.sort.key;
  const dir = state.sort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
    return (toNumber(av, 0) - toNumber(bv, 0)) * dir;
  });

  dom.analysisBody.innerHTML = rows.map((item) => {
    const badge = `<span class="badge ${getBadgeClass(item.classification)}">${item.classification}</span>`;
    const flags = item.flags.map((f) => `<span class="badge badge-flag">${f}</span>`).join('') || '—';
    return `
      <tr>
        <td>${item.name}</td>
        <td>${badge}</td>
        <td>${fmtCurrency(item.effectiveMenuPrice)}</td>
        <td>${fmtCurrency(item.totalCostPerPortionExclLabour)}</td>
        <td class="${item.grossProfitPerPortion > 0 ? 'value-good' : 'value-bad'}">${fmtCurrency(item.grossProfitPerPortion)}</td>
        <td class="${item.foodCostPercent > state.prefs.foodCostFlagTarget ? 'value-warn' : ''}">${fmtPercent(item.foodCostPercent)}</td>
        <td>${item.unitsSold}</td>
        <td>${fmtCurrency(item.revenue)}</td>
        <td>${fmtCurrency(item.totalGrossProfit)}</td>
        <td>${item.action}</td>
        <td>${flags}</td>
      </tr>
    `;
  }).join('');
}

function renderMatrix(classifiedItems, menuEngine) {
  const active = classifiedItems.filter((i) => i.isActive && i.classification !== 'Unclassified');
  dom.matrixChart.innerHTML = '';
  ['star', 'plowhorse', 'puzzle', 'dog'].forEach((c) => {
    const label = document.createElement('div');
    label.className = `matrix-quad-label ${c}`;
    label.textContent = c[0].toUpperCase() + c.slice(1);
    dom.matrixChart.appendChild(label);
  });

  if (menuEngine.fallback || active.length < 2) {
    dom.matrixFallback.textContent = menuEngine.fallback || 'Add more active items to view matrix.';
    return;
  }
  dom.matrixFallback.textContent = `High popularity threshold: ${fmtNumber(menuEngine.averages.unitsSold, 1)} units · High profitability threshold: ${fmtCurrency(menuEngine.averages.grossProfitPerPortion)}`;

  const maxUnits = Math.max(...active.map((i) => i.unitsSold), menuEngine.averages.unitsSold);
  const maxProfit = Math.max(...active.map((i) => i.grossProfitPerPortion), menuEngine.averages.grossProfitPerPortion, 0.01);

  active.forEach((item) => {
    const xPct = clamp((item.unitsSold / maxUnits) * 100, 4, 96);
    const yPct = clamp((item.grossProfitPerPortion / maxProfit) * 100, 4, 96);
    const point = document.createElement('div');
    point.className = `matrix-point ${getBadgeClass(item.classification)}`;
    point.style.left = `${xPct}%`;
    point.style.bottom = `${yPct}%`;
    point.title = `${item.name} · ${item.classification}`;
    point.textContent = item.name;
    dom.matrixChart.appendChild(point);
  });
}

/* ==============================
   Actions - Ingredient Library
================================ */
function readIngredientForm() {
  return {
    name: cleanText(dom.library.name.value),
    purchasePrice: toNumber(dom.library.price.value, 0),
    packSize: toNumber(dom.library.packSize.value, 0),
    packUnit: dom.library.packUnit.value,
    supplier: cleanText(dom.library.supplier.value),
    notes: cleanText(dom.library.notes.value),
  };
}

function clearIngredientForm() {
  state.ingredientEditingId = null;
  dom.library.name.value = '';
  dom.library.price.value = '';
  dom.library.packSize.value = '';
  dom.library.packUnit.value = '';
  dom.library.supplier.value = '';
  dom.library.notes.value = '';
  setInlineMessage(dom.library.errors, '', 'warn');
}

function onAddIngredient() {
  const input = readIngredientForm();
  const errors = validateIngredientInput(input);
  if (errors.length) return setInlineMessage(dom.library.errors, errors.join(' '), 'warn');

  state.ingredients.push({ id: uid('ing'), ...input });
  persistAll();
  clearIngredientForm();
  renderIngredientLibrary();
  refreshRowIngredientOptions();
}

function onUpdateIngredient() {
  if (!state.ingredientEditingId) return setInlineMessage(dom.library.errors, 'Select an ingredient to update.', 'warn');
  const input = readIngredientForm();
  const errors = validateIngredientInput(input, state.ingredientEditingId);
  if (errors.length) return setInlineMessage(dom.library.errors, errors.join(' '), 'warn');

  state.ingredients = state.ingredients.map((ing) => (ing.id === state.ingredientEditingId ? { ...ing, ...input } : ing));
  persistAll();
  clearIngredientForm();
  renderIngredientLibrary();
  refreshRowIngredientOptions();
}

function refreshRowIngredientOptions() {
  const rows = readRowsFromDom();
  dom.ingredientRows.innerHTML = '';
  rows.forEach(addRowToDom);
}

function onIngredientTableClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const ing = state.ingredients.find((x) => x.id === id);
  if (!ing) return;

  if (btn.dataset.action === 'edit') {
    state.ingredientEditingId = id;
    dom.library.name.value = ing.name;
    dom.library.price.value = ing.purchasePrice;
    dom.library.packSize.value = ing.packSize;
    dom.library.packUnit.value = ing.packUnit;
    dom.library.supplier.value = ing.supplier;
    dom.library.notes.value = ing.notes;
    setInlineMessage(dom.library.errors, 'Ingredient loaded for editing.', 'success');
    return;
  }

  const usage = state.recipes.some((r) => (r.ingredientRows || []).some((row) => row.ingredientId === id));
  if (usage && !window.confirm('This ingredient is linked in saved recipes. Delete anyway?')) return;
  state.ingredients = state.ingredients.filter((x) => x.id !== id);
  persistAll();
  renderIngredientLibrary();
  refreshRowIngredientOptions();
}

/* ==============================
   Actions - Recipe CRUD
================================ */
function upsertRecipe(mode) {
  const recipe = readRecipeFromForm();
  const errors = validateRecipe(recipe);
  markValidation(recipe);
  if (errors.length) return setInlineMessage(dom.editorErrors, errors.join(' '), 'warn');

  if (mode === 'save') {
    recipe.id = uid('rec');
    recipe.createdAt = nowIso();
    recipe.updatedAt = nowIso();
    state.recipes.unshift(recipe);
    state.activeRecipeId = recipe.id;
    setInlineMessage(dom.editorErrors, 'Recipe saved.', 'success');
  } else if (mode === 'update') {
    if (!state.activeRecipeId) return setInlineMessage(dom.editorErrors, 'Select a recipe to update.', 'warn');
    recipe.id = state.activeRecipeId;
    const existing = state.recipes.find((r) => r.id === state.activeRecipeId);
    recipe.createdAt = existing?.createdAt || nowIso();
    recipe.updatedAt = nowIso();
    state.recipes = state.recipes.map((r) => (r.id === recipe.id ? recipe : r));
    setInlineMessage(dom.editorErrors, 'Recipe updated.', 'success');
  }

  persistAll();
  renderRecipeList();
  renderDashboard();
}

function duplicateRecipe() {
  if (!state.activeRecipeId) return setInlineMessage(dom.editorErrors, 'Select a recipe to duplicate.', 'warn');
  const source = state.recipes.find((r) => r.id === state.activeRecipeId);
  if (!source) return;
  const copy = migrateRecipe({ ...source, id: uid('rec'), name: `${source.name} (Copy)`, createdAt: nowIso(), updatedAt: nowIso() });
  state.recipes.unshift(copy);
  state.activeRecipeId = copy.id;
  persistAll();
  setRecipeToForm(copy);
  setInlineMessage(dom.editorErrors, 'Recipe duplicated.', 'success');
  renderRecipeList();
  renderDashboard();
}

function deleteRecipe() {
  if (!state.activeRecipeId) return setInlineMessage(dom.editorErrors, 'Select a recipe to delete.', 'warn');
  const current = state.recipes.find((r) => r.id === state.activeRecipeId);
  if (!current) return;
  if (!window.confirm(`Delete "${current.name}"? This cannot be undone.`)) return;
  state.recipes = state.recipes.filter((r) => r.id !== state.activeRecipeId);
  state.activeRecipeId = null;
  persistAll();
  resetRecipeForm();
  setInlineMessage(dom.editorErrors, 'Recipe deleted.', 'success');
  renderRecipeList();
  renderDashboard();
}

/* ==============================
   Event Wiring
================================ */
function bindEvents() {
  dom.actions.addRow.addEventListener('click', () => {
    addRowToDom(defaultIngredientRow());
    recalcAndRender();
  });

  dom.actions.save.addEventListener('click', () => upsertRecipe('save'));
  dom.actions.update.addEventListener('click', () => upsertRecipe('update'));
  dom.actions.duplicate.addEventListener('click', duplicateRecipe);
  dom.actions.del.addEventListener('click', deleteRecipe);
  dom.actions.reset.addEventListener('click', resetRecipeForm);
  dom.actions.newRecipe.addEventListener('click', resetRecipeForm);

  dom.recipeSearch.addEventListener('input', (e) => {
    state.recipeSearch = e.target.value;
    renderRecipeList();
  });
  dom.recipeStatusFilter.addEventListener('change', (e) => {
    state.recipeStatusFilter = e.target.value;
    renderRecipeList();
  });

  [...Object.values(dom.fields)].forEach((el) => {
    el.addEventListener('input', recalcAndRender);
    el.addEventListener('change', recalcAndRender);
  });

  dom.analysisSearch.addEventListener('input', (e) => {
    state.analysisSearch = e.target.value;
    renderDashboard();
  });
  dom.analysisClassFilter.addEventListener('change', (e) => {
    state.analysisClassFilter = e.target.value;
    renderDashboard();
  });

  dom.analysisTable.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key, dir: 'asc' };
      renderDashboard();
    });
  });

  dom.actions.openLib.addEventListener('click', () => dom.library.modal.classList.add('open'));
  dom.actions.closeLib.addEventListener('click', () => dom.library.modal.classList.remove('open'));
  dom.library.modal.addEventListener('click', (e) => {
    if (e.target.dataset.closeModal) dom.library.modal.classList.remove('open');
  });

  dom.library.search.addEventListener('input', (e) => {
    state.ingredientSearch = e.target.value;
    renderIngredientLibrary();
  });
  dom.library.add.addEventListener('click', onAddIngredient);
  dom.library.update.addEventListener('click', onUpdateIngredient);
  dom.library.clear.addEventListener('click', clearIngredientForm);
  dom.library.body.addEventListener('click', onIngredientTableClick);
}

/* ==============================
   Init
================================ */
function init() {
  loadData();
  bindEvents();
  renderIngredientLibrary();

  if (state.draft) {
    state.activeRecipeId = state.draft.id || null;
    setRecipeToForm(state.draft);
  } else if (state.recipes[0]) {
    state.activeRecipeId = state.recipes[0].id;
    setRecipeToForm(state.recipes[0]);
  } else {
    resetRecipeForm();
  }

  renderRecipeList();
  renderDashboard();
  recalcAndRender();
}

init();
