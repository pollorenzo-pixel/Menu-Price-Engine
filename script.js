const STORAGE_KEY = 'menuPriceEngineStateV1';

const UNIT_GROUPS = {
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  l: 'volume',
  unit: 'count',
};

const UNIT_FACTORS = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  unit: 1,
};

const DEFAULT_STATE = {
  itemName: '',
  itemCategory: '',
  portions: 1,
  packagingCost: 0,
  labourCost: 0,
  targetFoodCost: 28,
  vatRate: 20,
  deliveryCommission: 30,
  roundingRule: 0.1,
  manualPrice: '',
  ingredients: [
    {
      name: '',
      packPrice: 0,
      packSize: 1,
      packUnit: 'g',
      amountUsed: 0,
      useUnit: 'g',
    },
  ],
};

const EXAMPLE_STATE = {
  itemName: 'Chicken Banh Mi',
  itemCategory: 'Sandwich',
  portions: 10,
  packagingCost: 0.35,
  labourCost: 0.6,
  targetFoodCost: 28,
  vatRate: 20,
  deliveryCommission: 30,
  roundingRule: 0.25,
  manualPrice: 8.5,
  ingredients: [
    { name: 'Chicken thigh', packPrice: 22, packSize: 5, packUnit: 'kg', amountUsed: 1.5, useUnit: 'kg' },
    { name: 'Baguette', packPrice: 8.4, packSize: 12, packUnit: 'unit', amountUsed: 10, useUnit: 'unit' },
    { name: 'Pickled veg mix', packPrice: 4.2, packSize: 2, packUnit: 'kg', amountUsed: 0.5, useUnit: 'kg' },
    { name: 'Mayo + sauce blend', packPrice: 9, packSize: 1, packUnit: 'kg', amountUsed: 0.2, useUnit: 'kg' },
    { name: 'Fresh herbs', packPrice: 1.8, packSize: 100, packUnit: 'g', amountUsed: 30, useUnit: 'g' },
  ],
};

const els = {
  form: document.getElementById('pricing-form'),
  warnings: document.getElementById('warnings'),
  ingredientsBody: document.getElementById('ingredients-body'),
  ingredientTemplate: document.getElementById('ingredient-row-template'),
  addIngredient: document.getElementById('add-ingredient'),
  loadExample: document.getElementById('load-example'),
  resetForm: document.getElementById('reset-form'),
  fields: {
    itemName: document.getElementById('item-name'),
    itemCategory: document.getElementById('item-category'),
    portions: document.getElementById('portions'),
    packagingCost: document.getElementById('packaging-cost'),
    labourCost: document.getElementById('labour-cost'),
    targetFoodCost: document.getElementById('target-food-cost'),
    vatRate: document.getElementById('vat-rate'),
    deliveryCommission: document.getElementById('delivery-commission'),
    roundingRule: document.getElementById('rounding-rule'),
    manualPrice: document.getElementById('manual-price'),
  },
  results: {
    totalIngredient: document.getElementById('res-total-ingredient'),
    ingredientPortion: document.getElementById('res-ingredient-portion'),
    totalPortion: document.getElementById('res-total-portion'),
    totalPortionLabour: document.getElementById('res-total-portion-labour'),
    suggestedNet: document.getElementById('res-suggested-net'),
    rounded: document.getElementById('res-rounded'),
    vat: document.getElementById('res-vat'),
    delivery: document.getElementById('res-delivery'),
    grossProfit: document.getElementById('res-gross-profit'),
    foodCostRounded: document.getElementById('res-food-cost-rounded'),
    foodCostManual: document.getElementById('res-food-cost-manual'),
  },
  insightText: document.getElementById('insight-text'),
  insightBox: document.getElementById('pricing-insight'),
};

function gbp(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number.isFinite(value) ? value : 0);
}

function pct(value) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function parseNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeState(raw) {
  const merged = {
    ...DEFAULT_STATE,
    ...(raw || {}),
  };
  merged.ingredients = Array.isArray(raw?.ingredients) && raw.ingredients.length ? raw.ingredients : DEFAULT_STATE.ingredients;
  return merged;
}

function createIngredientRow(data = DEFAULT_STATE.ingredients[0]) {
  const fragment = els.ingredientTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.ingredient-row');

  row.querySelector('.ing-name').value = data.name ?? '';
  row.querySelector('.ing-pack-price').value = data.packPrice ?? 0;
  row.querySelector('.ing-pack-size').value = data.packSize ?? 1;
  row.querySelector('.ing-pack-unit').value = data.packUnit ?? 'g';
  row.querySelector('.ing-amount-used').value = data.amountUsed ?? 0;
  row.querySelector('.ing-use-unit').value = data.useUnit ?? 'g';

  row.querySelector('.remove-ingredient').addEventListener('click', () => {
    row.remove();
    if (!els.ingredientsBody.querySelector('.ingredient-row')) {
      addIngredientRow();
    }
    updateEverything();
  });

  row.querySelectorAll('input, select').forEach((input) => {
    input.addEventListener('input', updateEverything);
  });

  els.ingredientsBody.appendChild(fragment);
}

function addIngredientRow(data) {
  createIngredientRow(data);
}

function readIngredientsFromDom() {
  return [...els.ingredientsBody.querySelectorAll('.ingredient-row')].map((row) => ({
    row,
    name: row.querySelector('.ing-name').value.trim(),
    packPrice: parseNum(row.querySelector('.ing-pack-price').value),
    packSize: parseNum(row.querySelector('.ing-pack-size').value),
    packUnit: row.querySelector('.ing-pack-unit').value,
    amountUsed: parseNum(row.querySelector('.ing-amount-used').value),
    useUnit: row.querySelector('.ing-use-unit').value,
  }));
}

function convertAmount(value, fromUnit, toUnit) {
  if (UNIT_GROUPS[fromUnit] !== UNIT_GROUPS[toUnit]) return null;
  return (value * UNIT_FACTORS[fromUnit]) / UNIT_FACTORS[toUnit];
}

function computeIngredientCost(ingredient) {
  const convertedAmountUsed = convertAmount(ingredient.amountUsed, ingredient.useUnit, ingredient.packUnit);
  if (convertedAmountUsed === null || ingredient.packSize <= 0) return { cost: NaN, error: true };

  const cost = (convertedAmountUsed / ingredient.packSize) * ingredient.packPrice;
  return { cost, error: false };
}

function roundToRule(value, step) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function getFormState() {
  return {
    itemName: els.fields.itemName.value.trim(),
    itemCategory: els.fields.itemCategory.value.trim(),
    portions: parseNum(els.fields.portions.value, 1),
    packagingCost: parseNum(els.fields.packagingCost.value),
    labourCost: parseNum(els.fields.labourCost.value),
    targetFoodCost: parseNum(els.fields.targetFoodCost.value, 28),
    vatRate: parseNum(els.fields.vatRate.value, 20),
    deliveryCommission: parseNum(els.fields.deliveryCommission.value, 30),
    roundingRule: parseNum(els.fields.roundingRule.value, 0.1),
    manualPrice: els.fields.manualPrice.value === '' ? '' : parseNum(els.fields.manualPrice.value),
    ingredients: readIngredientsFromDom().map(({ row, ...item }) => item),
  };
}

function setFormState(state) {
  const data = normalizeState(state);

  els.fields.itemName.value = data.itemName;
  els.fields.itemCategory.value = data.itemCategory;
  els.fields.portions.value = data.portions;
  els.fields.packagingCost.value = data.packagingCost;
  els.fields.labourCost.value = data.labourCost;
  els.fields.targetFoodCost.value = data.targetFoodCost;
  els.fields.vatRate.value = data.vatRate;
  els.fields.deliveryCommission.value = data.deliveryCommission;
  els.fields.roundingRule.value = String(data.roundingRule);
  els.fields.manualPrice.value = data.manualPrice;

  els.ingredientsBody.innerHTML = '';
  data.ingredients.forEach((ingredient) => addIngredientRow(ingredient));

  updateEverything();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormState()));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function clearWarnings() {
  els.warnings.textContent = '';
}

function setWarning(message) {
  els.warnings.textContent = message;
}

function applySignalClass(el, mode) {
  el.classList.remove('value-good', 'value-warn', 'value-bad');
  if (mode) el.classList.add(mode);
}

function calculatePricing(state) {
  const warnings = [];
  const ingredientRows = [...els.ingredientsBody.querySelectorAll('.ingredient-row')];
  let totalIngredientCost = 0;

  state.ingredients.forEach((ingredient, index) => {
    const result = computeIngredientCost(ingredient);
    const costCell = ingredientRows[index]?.querySelector('.ing-cost-used');

    if (result.error || result.cost < 0 || !Number.isFinite(result.cost)) {
      if (costCell) costCell.textContent = 'Invalid';
      warnings.push(`Ingredient row ${index + 1} has invalid units or pack size.`);
      return;
    }

    totalIngredientCost += result.cost;
    if (costCell) costCell.textContent = gbp(result.cost);
  });

  if (state.portions <= 0) warnings.push('Portions yielded must be greater than 0.');
  if (state.targetFoodCost <= 0 || state.targetFoodCost >= 100) warnings.push('Target food cost % must be between 0 and 100.');
  if (state.deliveryCommission >= 100) warnings.push('Delivery commission % must be below 100.');

  const safePortions = state.portions > 0 ? state.portions : NaN;
  const ingredientCostPerPortion = totalIngredientCost / safePortions;
  const totalPortionCost = ingredientCostPerPortion + state.packagingCost;
  const totalPortionCostWithLabour = totalPortionCost + state.labourCost;
  const suggestedNet = totalPortionCost / (state.targetFoodCost / 100);
  const roundedSuggested = roundToRule(suggestedNet, state.roundingRule);
  const vatInclusive = roundedSuggested * (1 + state.vatRate / 100);

  // Protects same post-commission net revenue as dine-in rounded price.
  const deliveryAdjusted = roundedSuggested / (1 - state.deliveryCommission / 100);

  const grossProfit = roundedSuggested - totalPortionCost;
  const actualFoodCostRounded = (totalPortionCost / roundedSuggested) * 100;

  const manualPrice = state.manualPrice === '' ? NaN : Number(state.manualPrice);
  const actualFoodCostManual = Number.isFinite(manualPrice) && manualPrice > 0 ? (totalPortionCost / manualPrice) * 100 : NaN;

  return {
    warnings,
    totalIngredientCost,
    ingredientCostPerPortion,
    totalPortionCost,
    totalPortionCostWithLabour,
    suggestedNet,
    roundedSuggested,
    vatInclusive,
    deliveryAdjusted,
    grossProfit,
    actualFoodCostRounded,
    actualFoodCostManual,
  };
}

function deriveInsight(results) {
  const fc = results.actualFoodCostRounded;
  if (!Number.isFinite(fc)) {
    return { text: 'Please resolve invalid values to view pricing guidance.', mode: 'value-bad' };
  }
  if (fc <= 26) {
    return { text: 'This item appears strongly profitable.', mode: 'value-good' };
  }
  if (fc <= 32) {
    return { text: 'This price looks healthy for dine-in.', mode: 'value-good' };
  }
  if (fc <= 38) {
    return { text: 'Margin may be too tight for delivery platforms.', mode: 'value-warn' };
  }
  return { text: 'Consider increasing price or reducing garnish cost.', mode: 'value-bad' };
}

function renderResults(results) {
  const safeMoney = (v) => (Number.isFinite(v) ? gbp(v) : '—');
  const safePct = (v) => (Number.isFinite(v) ? pct(v) : '—');

  els.results.totalIngredient.textContent = safeMoney(results.totalIngredientCost);
  els.results.ingredientPortion.textContent = safeMoney(results.ingredientCostPerPortion);
  els.results.totalPortion.textContent = safeMoney(results.totalPortionCost);
  els.results.totalPortionLabour.textContent = safeMoney(results.totalPortionCostWithLabour);
  els.results.suggestedNet.textContent = safeMoney(results.suggestedNet);
  els.results.rounded.textContent = safeMoney(results.roundedSuggested);
  els.results.vat.textContent = safeMoney(results.vatInclusive);
  els.results.delivery.textContent = safeMoney(results.deliveryAdjusted);
  els.results.grossProfit.textContent = safeMoney(results.grossProfit);
  els.results.foodCostRounded.textContent = safePct(results.actualFoodCostRounded);
  els.results.foodCostManual.textContent = safePct(results.actualFoodCostManual);

  applySignalClass(els.results.grossProfit, results.grossProfit >= 0 ? 'value-good' : 'value-bad');
  const fcClass = !Number.isFinite(results.actualFoodCostRounded)
    ? 'value-bad'
    : results.actualFoodCostRounded <= 32
      ? 'value-good'
      : results.actualFoodCostRounded <= 38
        ? 'value-warn'
        : 'value-bad';
  applySignalClass(els.results.foodCostRounded, fcClass);

  const insight = deriveInsight(results);
  els.insightText.textContent = insight.text;
  applySignalClass(els.insightText, insight.mode);
}

function updateEverything() {
  const state = getFormState();
  const results = calculatePricing(state);

  clearWarnings();
  if (results.warnings.length) setWarning(results.warnings[0]);

  renderResults(results);
  saveState();
}

function resetToDefaults() {
  localStorage.removeItem(STORAGE_KEY);
  setFormState(DEFAULT_STATE);
}

function init() {
  els.addIngredient.addEventListener('click', () => {
    addIngredientRow();
    updateEverything();
  });

  els.loadExample.addEventListener('click', () => {
    setFormState(EXAMPLE_STATE);
  });

  els.resetForm.addEventListener('click', resetToDefaults);

  els.form.addEventListener('input', updateEverything);

  const saved = loadState();
  if (saved) {
    setFormState(saved);
  } else {
    setFormState(DEFAULT_STATE);
  }
}

init();
