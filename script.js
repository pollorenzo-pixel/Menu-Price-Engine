/* ==============================
   Constants & Storage Keys
================================ */
const STORAGE_KEYS = {
  ingredients: 'mpe_v2_ingredients',
  recipes: 'mpe_v2_recipes',
  draft: 'mpe_v2_active_draft',
  seeded: 'mpe_v2_seeded',
};

const PACK_UNITS = ['g', 'kg', 'ml', 'l', 'unit'];
const UNIT_GROUP = { g: 'weight', kg: 'weight', ml: 'volume', l: 'volume', unit: 'count' };
const BASE_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, unit: 1 };

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
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* ==============================
   Format Helpers
================================ */
const fmtCurrency = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number.isFinite(value) ? value : 0);
const fmtPercent = (value) => `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;

function setInlineMessage(el, message, type = 'warn') {
  el.textContent = message || '';
  el.classList.toggle('success', type === 'success');
}

/* ==============================
   Unit Conversion
================================ */
function convertUnit(value, fromUnit, toUnit) {
  if (!fromUnit || !toUnit) return { ok: false, value: null, reason: 'Missing units' };
  if (UNIT_GROUP[fromUnit] !== UNIT_GROUP[toUnit]) {
    return { ok: false, value: null, reason: `Cannot convert ${fromUnit} to ${toUnit}` };
  }
  return { ok: true, value: (value * BASE_FACTOR[fromUnit]) / BASE_FACTOR[toUnit], reason: '' };
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

function setStored(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
  ingredientSearch: '',
  draft: null,
};

/* ==============================
   Defaults + Sample Data
================================ */
function defaultRecipe() {
  return {
    id: null,
    name: '',
    category: '',
    portionsYielded: 10,
    packagingCostPerPortion: 0,
    labourCostPerPortion: 0,
    targetFoodCostPercent: 30,
    vatRatePercent: 20,
    deliveryCommissionPercent: 30,
    roundingRule: 0.25,
    manualMenuPrice: '',
    ingredientRows: [defaultIngredientRow()],
    createdAt: null,
    updatedAt: null,
  };
}

function defaultIngredientRow() {
  return {
    rowId: uid('row'),
    ingredientId: '',
    ingredientNameSnapshot: '',
    purchasePriceSnapshot: 0,
    packSizeSnapshot: 1,
    packUnitSnapshot: 'g',
    amountUsed: 0,
    useUnit: 'g',
    calculatedCostUsed: 0,
  };
}

function sampleIngredients() {
  return [
    { id: uid('ing'), name: 'Baguette', purchasePrice: 8.4, packSize: 12, packUnit: 'unit', supplier: 'Metro Bakery', notes: 'Case of 12' },
    { id: uid('ing'), name: 'Chicken Thigh', purchasePrice: 24, packSize: 5, packUnit: 'kg', supplier: 'Kiju Butchery', notes: 'Boneless' },
    { id: uid('ing'), name: 'Pickled Carrot', purchasePrice: 3.9, packSize: 1, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Daikon', purchasePrice: 2.8, packSize: 1, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Cucumber', purchasePrice: 5.5, packSize: 10, packUnit: 'unit', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Coriander', purchasePrice: 1.6, packSize: 100, packUnit: 'g', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Spring Onion', purchasePrice: 1.2, packSize: 100, packUnit: 'g', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Mayo', purchasePrice: 7.2, packSize: 2, packUnit: 'kg', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Soy Glaze', purchasePrice: 5.8, packSize: 1, packUnit: 'l', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Chilli Sauce', purchasePrice: 4.6, packSize: 1, packUnit: 'l', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Salad Leaves', purchasePrice: 6.9, packSize: 500, packUnit: 'g', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Takeaway Wrapper', purchasePrice: 5.2, packSize: 100, packUnit: 'unit', supplier: '', notes: '' },
    { id: uid('ing'), name: 'Takeaway Bowl', purchasePrice: 12, packSize: 100, packUnit: 'unit', supplier: '', notes: '' },
  ];
}

function sampleRecipes(ingredients) {
  const find = (name) => ingredients.find((ing) => safeLower(ing.name) === safeLower(name));
  const buildRow = (name, amountUsed, useUnit) => {
    const ing = find(name);
    return {
      rowId: uid('row'), ingredientId: ing?.id ?? '', ingredientNameSnapshot: ing?.name ?? name,
      purchasePriceSnapshot: ing?.purchasePrice ?? 0, packSizeSnapshot: ing?.packSize ?? 1, packUnitSnapshot: ing?.packUnit ?? useUnit,
      amountUsed, useUnit, calculatedCostUsed: 0,
    };
  };

  const r1 = {
    ...defaultRecipe(), id: uid('rec'), name: 'Chicken Banh Mi', category: 'Sandwich', portionsYielded: 10,
    packagingCostPerPortion: 0.32, labourCostPerPortion: 0.6, targetFoodCostPercent: 28, vatRatePercent: 20,
    deliveryCommissionPercent: 30, roundingRule: 0.25, manualMenuPrice: 8.5,
    ingredientRows: [
      buildRow('Baguette', 10, 'unit'), buildRow('Chicken Thigh', 1500, 'g'), buildRow('Pickled Carrot', 300, 'g'),
      buildRow('Daikon', 200, 'g'), buildRow('Coriander', 20, 'g'), buildRow('Spring Onion', 20, 'g'),
      buildRow('Mayo', 180, 'g'), buildRow('Soy Glaze', 80, 'ml'), buildRow('Chilli Sauce', 70, 'ml'), buildRow('Takeaway Wrapper', 10, 'unit'),
    ],
  };
  const r2 = {
    ...defaultRecipe(), id: uid('rec'), name: 'Chicken Salad Bowl', category: 'Bowl', portionsYielded: 8,
    packagingCostPerPortion: 0.42, labourCostPerPortion: 0.8, targetFoodCostPercent: 30, vatRatePercent: 20,
    deliveryCommissionPercent: 32, roundingRule: 0.5, manualMenuPrice: 9.95,
    ingredientRows: [
      buildRow('Chicken Thigh', 1600, 'g'), buildRow('Salad Leaves', 320, 'g'), buildRow('Cucumber', 4, 'unit'),
      buildRow('Pickled Carrot', 220, 'g'), buildRow('Spring Onion', 25, 'g'), buildRow('Soy Glaze', 120, 'ml'), buildRow('Takeaway Bowl', 8, 'unit'),
    ],
  };

  const stamp = nowIso();
  [r1, r2].forEach((r) => {
    r.createdAt = stamp;
    r.updatedAt = stamp;
  });
  return [r1, r2];
}

/* ==============================
   DOM Cache
================================ */
const $ = (id) => document.getElementById(id);
const dom = {
  recipeList: $('recipe-list'), recipeSearch: $('recipe-search'), recipeCount: $('recipe-count'),
  editorErrors: $('editor-errors'), calcWarnings: $('calc-warnings'),
  ingredientRows: $('ingredient-rows'), template: $('ingredient-row-template'),
  insightList: $('insight-list'), draftState: $('draft-state'),
  results: {
    totalIngredient: $('res-total-ingredient'), ingredientPortion: $('res-ingredient-portion'), totalPortion: $('res-total-portion'),
    totalLabour: $('res-total-labour'), suggestedNet: $('res-suggested-net'), rounded: $('res-rounded'), vat: $('res-vat'),
    delivery: $('res-delivery'), gross: $('res-gross'), foodRounded: $('res-food-rounded'), foodManual: $('res-food-manual'),
  },
  fields: {
    name: $('recipe-name'), category: $('recipe-category'), portions: $('portions-yielded'), packaging: $('packaging-cost'), labour: $('labour-cost'),
    target: $('target-food-cost'), vat: $('vat-rate'), delivery: $('delivery-commission'), rounding: $('rounding-rule'), manual: $('manual-price'),
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
  if (!cleanText(recipe.name)) errors.push('Recipe name is required.');
  if (!(recipe.portionsYielded > 0)) errors.push('Portions yielded must be greater than 0.');
  if (!(recipe.targetFoodCostPercent > 0 && recipe.targetFoodCostPercent < 100)) errors.push('Target food cost must be between 0 and 100.');
  if (recipe.vatRatePercent < 0) errors.push('VAT cannot be negative.');
  if (recipe.deliveryCommissionPercent < 0) errors.push('Delivery commission cannot be negative.');
  return errors;
}

function clearRecipeValidationState() {
  [dom.fields.name, dom.fields.portions, dom.fields.target, dom.fields.vat, dom.fields.delivery].forEach((el) => el.classList.remove('is-invalid'));
}

function markRecipeValidation(recipe) {
  clearRecipeValidationState();
  if (!cleanText(recipe.name)) dom.fields.name.classList.add('is-invalid');
  if (!(recipe.portionsYielded > 0)) dom.fields.portions.classList.add('is-invalid');
  if (!(recipe.targetFoodCostPercent > 0 && recipe.targetFoodCostPercent < 100)) dom.fields.target.classList.add('is-invalid');
  if (recipe.vatRatePercent < 0) dom.fields.vat.classList.add('is-invalid');
  if (recipe.deliveryCommissionPercent < 0) dom.fields.delivery.classList.add('is-invalid');
}

function validateIngredientInput(input, editingId = null) {
  const errors = [];
  if (!input.name) errors.push('Ingredient name is required.');
  if (input.purchasePrice < 0) errors.push('Purchase price must be 0 or greater.');
  if (!(input.packSize > 0)) errors.push('Pack size must be greater than 0.');
  if (!PACK_UNITS.includes(input.packUnit)) errors.push('Pack unit is required.');

  const duplicate = state.ingredients.some((ing) => safeLower(ing.name) === safeLower(input.name) && ing.id !== editingId);
  if (duplicate) errors.push('An ingredient with this name already exists (case-insensitive).');
  return errors;
}

/* ==============================
   Recipe Form + Rows
================================ */
function readRecipeFromForm() {
  return {
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
    ingredientRows: readRowsFromDom(),
    createdAt: null,
    updatedAt: null,
  };
}

function setRecipeToForm(recipe) {
  dom.fields.name.value = recipe.name ?? '';
  dom.fields.category.value = recipe.category ?? '';
  dom.fields.portions.value = recipe.portionsYielded ?? 10;
  dom.fields.packaging.value = recipe.packagingCostPerPortion ?? 0;
  dom.fields.labour.value = recipe.labourCostPerPortion ?? 0;
  dom.fields.target.value = recipe.targetFoodCostPercent ?? 30;
  dom.fields.vat.value = recipe.vatRatePercent ?? 20;
  dom.fields.delivery.value = recipe.deliveryCommissionPercent ?? 30;
  dom.fields.rounding.value = String(recipe.roundingRule ?? 0.25);
  dom.fields.manual.value = recipe.manualMenuPrice === '' ? '' : (recipe.manualMenuPrice ?? '');

  dom.ingredientRows.innerHTML = '';
  (Array.isArray(recipe.ingredientRows) && recipe.ingredientRows.length ? recipe.ingredientRows : [defaultIngredientRow()]).forEach(addRowToDom);

  recalcAndRender();
}

function addRowToDom(rowData = defaultIngredientRow()) {
  const fragment = dom.template.content.cloneNode(true);
  const tr = fragment.querySelector('tr');
  tr.dataset.rowId = rowData.rowId || uid('row');

  const select = tr.querySelector('.row-lib-select');
  const setLibOptions = () => {
    select.innerHTML = '<option value="">Manual / Snapshot</option>';
    state.ingredients.forEach((ing) => {
      const opt = document.createElement('option');
      opt.value = ing.id;
      opt.textContent = ing.name;
      select.appendChild(opt);
    });
  };
  setLibOptions();

  const nameInput = tr.querySelector('.row-name');
  const priceInput = tr.querySelector('.row-price');
  const sizeInput = tr.querySelector('.row-pack-size');
  const packUnit = tr.querySelector('.row-pack-unit');
  const amountInput = tr.querySelector('.row-amount');
  const useUnit = tr.querySelector('.row-use-unit');

  select.value = rowData.ingredientId || '';
  nameInput.value = rowData.ingredientNameSnapshot ?? '';
  priceInput.value = rowData.purchasePriceSnapshot ?? 0;
  sizeInput.value = rowData.packSizeSnapshot ?? 1;
  packUnit.value = rowData.packUnitSnapshot ?? 'g';
  amountInput.value = rowData.amountUsed ?? 0;
  useUnit.value = rowData.useUnit ?? 'g';

  select.addEventListener('change', () => {
    const ing = state.ingredients.find((x) => x.id === select.value);
    if (ing) {
      nameInput.value = ing.name;
      priceInput.value = ing.purchasePrice;
      sizeInput.value = ing.packSize;
      packUnit.value = ing.packUnit;
    }
    recalcAndRender();
    saveDraft();
  });

  tr.querySelector('.row-remove').addEventListener('click', () => {
    tr.remove();
    if (!dom.ingredientRows.querySelector('tr')) addRowToDom();
    recalcAndRender();
    saveDraft();
  });

  tr.querySelectorAll('input,select').forEach((el) => {
    el.addEventListener('input', () => {
      recalcAndRender();
      saveDraft();
    });
  });

  dom.ingredientRows.appendChild(fragment);
}

function readRowsFromDom() {
  return [...dom.ingredientRows.querySelectorAll('tr')].map((tr) => ({
    rowId: tr.dataset.rowId,
    ingredientId: tr.querySelector('.row-lib-select').value,
    ingredientNameSnapshot: cleanText(tr.querySelector('.row-name').value),
    purchasePriceSnapshot: toNumber(tr.querySelector('.row-price').value, 0),
    packSizeSnapshot: toNumber(tr.querySelector('.row-pack-size').value, 1),
    packUnitSnapshot: tr.querySelector('.row-pack-unit').value,
    amountUsed: toNumber(tr.querySelector('.row-amount').value, 0),
    useUnit: tr.querySelector('.row-use-unit').value,
    calculatedCostUsed: 0,
  }));
}

/* ==============================
   Calculation Engine
================================ */
function calcRowCost(row) {
  if (!(row.packSizeSnapshot > 0) || row.purchasePriceSnapshot < 0 || row.amountUsed < 0) {
    return { cost: 0, warning: 'Row has invalid numeric values.' };
  }
  const converted = convertUnit(row.amountUsed, row.useUnit, row.packUnitSnapshot);
  if (!converted.ok) return { cost: 0, warning: `${row.ingredientNameSnapshot || 'Row'}: ${converted.reason}.` };

  const cost = (converted.value / row.packSizeSnapshot) * row.purchasePriceSnapshot;
  return { cost: Number.isFinite(cost) ? cost : 0, warning: Number.isFinite(cost) ? '' : 'Invalid row cost.' };
}

function roundByRule(value, step) {
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}

function calculateRecipe(recipe) {
  const warnings = [];
  let totalIngredientCost = 0;
  const rowCosts = [];

  recipe.ingredientRows.forEach((row) => {
    const res = calcRowCost(row);
    row.calculatedCostUsed = res.cost;
    rowCosts.push(res.cost);
    totalIngredientCost += res.cost;
    if (res.warning) warnings.push(res.warning);
  });

  const portions = recipe.portionsYielded > 0 ? recipe.portionsYielded : 0;
  const ingredientCostPerPortion = portions ? totalIngredientCost / portions : 0;
  const portionCostExclLabour = ingredientCostPerPortion + Math.max(0, recipe.packagingCostPerPortion);
  const portionCostInclLabour = portionCostExclLabour + Math.max(0, recipe.labourCostPerPortion);

  const targetRatio = recipe.targetFoodCostPercent > 0 ? recipe.targetFoodCostPercent / 100 : 0;
  const suggestedNetSellingPrice = targetRatio > 0 ? portionCostExclLabour / targetRatio : 0;
  const roundedSellingPrice = roundByRule(suggestedNetSellingPrice, recipe.roundingRule);
  const vatInclusivePrice = roundedSellingPrice * (1 + Math.max(0, recipe.vatRatePercent) / 100);

  const commissionRatio = Math.max(0, recipe.deliveryCommissionPercent) / 100;
  const deliveryAdjustedRecommendation = commissionRatio < 1 ? roundedSellingPrice / (1 - commissionRatio) : 0;

  const grossProfitPerPortion = roundedSellingPrice - portionCostExclLabour;
  const actualFoodCostRounded = roundedSellingPrice > 0 ? (portionCostExclLabour / roundedSellingPrice) * 100 : 0;
  const actualFoodCostManual = recipe.manualMenuPrice !== '' && recipe.manualMenuPrice > 0
    ? (portionCostExclLabour / recipe.manualMenuPrice) * 100
    : null;

  if (!portions) warnings.push('Portions must be greater than 0 for per-portion calculations.');
  if (!(recipe.targetFoodCostPercent > 0 && recipe.targetFoodCostPercent < 100)) warnings.push('Target food cost % should be between 0 and 100.');
  if (recipe.deliveryCommissionPercent >= 100) warnings.push('Delivery commission >= 100% makes delivery recommendation invalid.');

  return {
    warnings,
    rowCosts,
    totalIngredientCost,
    ingredientCostPerPortion,
    portionCostExclLabour,
    portionCostInclLabour,
    suggestedNetSellingPrice,
    roundedSellingPrice,
    vatInclusivePrice,
    deliveryAdjustedRecommendation,
    grossProfitPerPortion,
    actualFoodCostRounded,
    actualFoodCostManual,
  };
}

/* ==============================
   Insights
================================ */
function buildInsights(calc, recipe) {
  const items = [];
  if (calc.actualFoodCostRounded > recipe.targetFoodCostPercent + 2) items.push('Food cost is above target at rounded price. Consider increasing price by £0.50.');
  if (calc.grossProfitPerPortion < 1.5) items.push('Gross profit per portion is tight for this item.');
  if (calc.grossProfitPerPortion >= 2.5) items.push('This appears strongly profitable for dine-in.');
  if (recipe.manualMenuPrice !== '' && recipe.manualMenuPrice < calc.roundedSellingPrice - 0.3) items.push('Manual price is below recommendation; margin may be under pressure.');
  if (calc.deliveryAdjustedRecommendation > calc.roundedSellingPrice + 0.5) items.push('Margin may be tight for delivery platforms at current price.');
  items.push('Labour is not included in target food cost pricing baseline.');
  return items.slice(0, 4);
}

/* ==============================
   Render Functions
================================ */
function renderRecipes() {
  const q = safeLower(state.recipeSearch);
  const recipes = [...state.recipes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter((r) => safeLower(r.name).includes(q));

  dom.recipeList.innerHTML = '';
  if (!recipes.length) {
    const li = document.createElement('li');
    li.className = 'recipe-item';
    li.innerHTML = '<h4>No recipes found</h4><p>Try another search or create a new recipe.</p>';
    dom.recipeList.appendChild(li);
  }
  recipes.forEach((recipe) => {
    const calc = calculateRecipe(structuredClone(recipe));
    const li = document.createElement('li');
    li.className = `recipe-item ${recipe.id === state.activeRecipeId ? 'active' : ''}`;
    li.innerHTML = `
      <h4>${escapeHtml(recipe.name)}</h4>
      <div class="recipe-meta-row">
        <span>${escapeHtml(recipe.category || 'Uncategorized')}</span>
        <span class="mini-pill">${fmtCurrency(calc.roundedSellingPrice)}</span>
      </div>
      <p>Food cost ${fmtPercent(calc.actualFoodCostRounded)} · updated ${new Date(recipe.updatedAt).toLocaleString()}</p>`;
    li.addEventListener('click', () => {
      state.activeRecipeId = recipe.id;
      setRecipeToForm(structuredClone(recipe));
      renderRecipes();
      saveDraft();
    });
    dom.recipeList.appendChild(li);
  });
  dom.recipeCount.textContent = `${recipes.length} shown / ${state.recipes.length} total`;
}

function renderLibrary() {
  const q = safeLower(state.ingredientSearch);
  const ingredients = state.ingredients.filter((ing) => safeLower(ing.name).includes(q));
  dom.library.body.innerHTML = '';
  if (!ingredients.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7">No ingredients match this search.</td>';
    dom.library.body.appendChild(tr);
  }
  ingredients.forEach((ing) => {
    const useCount = state.recipes.filter((recipe) => recipe.ingredientRows.some((row) => row.ingredientId === ing.id)).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(ing.name)}</td>
      <td>${fmtCurrency(ing.purchasePrice)}</td>
      <td>${ing.packSize} ${ing.packUnit}</td>
      <td>${escapeHtml(ing.supplier || '—')}</td>
      <td>${escapeHtml(ing.notes || '—')}</td>
      <td>${useCount}</td>
      <td>
        <button class="btn btn-secondary lib-edit" data-id="${ing.id}" type="button">Edit</button>
        <button class="btn btn-danger lib-delete" data-id="${ing.id}" type="button">Delete</button>
      </td>`;
    dom.library.body.appendChild(tr);
  });
  dom.library.count.textContent = `${ingredients.length} shown / ${state.ingredients.length} total`;

  dom.library.body.querySelectorAll('.lib-edit').forEach((btn) => btn.addEventListener('click', () => editIngredient(btn.dataset.id)));
  dom.library.body.querySelectorAll('.lib-delete').forEach((btn) => btn.addEventListener('click', () => deleteIngredient(btn.dataset.id)));
}

function renderResults(calc, recipe) {
  dom.results.totalIngredient.textContent = fmtCurrency(calc.totalIngredientCost);
  dom.results.ingredientPortion.textContent = fmtCurrency(calc.ingredientCostPerPortion);
  dom.results.totalPortion.textContent = fmtCurrency(calc.portionCostExclLabour);
  dom.results.totalLabour.textContent = fmtCurrency(calc.portionCostInclLabour);
  dom.results.suggestedNet.textContent = fmtCurrency(calc.suggestedNetSellingPrice);
  dom.results.rounded.textContent = fmtCurrency(calc.roundedSellingPrice);
  dom.results.vat.textContent = fmtCurrency(calc.vatInclusivePrice);
  dom.results.delivery.textContent = fmtCurrency(calc.deliveryAdjustedRecommendation);
  dom.results.gross.textContent = fmtCurrency(calc.grossProfitPerPortion);
  dom.results.foodRounded.textContent = fmtPercent(calc.actualFoodCostRounded);
  dom.results.foodManual.textContent = calc.actualFoodCostManual === null ? '—' : fmtPercent(calc.actualFoodCostManual);

  dom.results.foodRounded.className = '';
  if (calc.actualFoodCostRounded <= recipe.targetFoodCostPercent) dom.results.foodRounded.classList.add('value-good');
  else if (calc.actualFoodCostRounded <= recipe.targetFoodCostPercent + 3) dom.results.foodRounded.classList.add('value-warn');
  else dom.results.foodRounded.classList.add('value-bad');

  dom.insightList.innerHTML = '';
  buildInsights(calc, recipe).forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    dom.insightList.appendChild(li);
  });

  dom.calcWarnings.textContent = calc.warnings.join(' ');
}

function recalcAndRender() {
  const recipe = readRecipeFromForm();
  const calc = calculateRecipe(recipe);
  dom.ingredientRows.querySelectorAll('tr').forEach((tr, index) => {
    const costCell = tr.querySelector('.row-cost');
    if (costCell) costCell.textContent = fmtCurrency(calc.rowCosts[index] ?? 0);
  });
  renderResults(calc, recipe);
}

/* ==============================
   Ingredient Library Functions
================================ */
function readIngredientForm() {
  return {
    name: cleanText(dom.library.name.value),
    purchasePrice: toNumber(dom.library.price.value, -1),
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
  setInlineMessage(dom.library.errors, '');
}

function addIngredient() {
  const input = readIngredientForm();
  const errors = validateIngredientInput(input);
  if (errors.length) {
    setInlineMessage(dom.library.errors, errors.join(' '));
    return;
  }
  state.ingredients.push({ id: uid('ing'), ...input });
  persistIngredients();
  clearIngredientForm();
  refreshIngredientSelects();
  renderLibrary();
  setInlineMessage(dom.library.errors, 'Ingredient added.', 'success');
}

function editIngredient(id) {
  const ing = state.ingredients.find((x) => x.id === id);
  if (!ing) return;
  state.ingredientEditingId = id;
  dom.library.name.value = ing.name;
  dom.library.price.value = ing.purchasePrice;
  dom.library.packSize.value = ing.packSize;
  dom.library.packUnit.value = ing.packUnit;
  dom.library.supplier.value = ing.supplier;
  dom.library.notes.value = ing.notes;
}

function updateIngredient() {
  if (!state.ingredientEditingId) {
    setInlineMessage(dom.library.errors, 'Select an ingredient to edit first.');
    return;
  }
  const input = readIngredientForm();
  const errors = validateIngredientInput(input, state.ingredientEditingId);
  if (errors.length) {
    setInlineMessage(dom.library.errors, errors.join(' '));
    return;
  }
  state.ingredients = state.ingredients.map((ing) => (ing.id === state.ingredientEditingId ? { ...ing, ...input } : ing));
  persistIngredients();
  clearIngredientForm();
  refreshIngredientSelects();
  renderLibrary();
  setInlineMessage(dom.library.errors, 'Ingredient updated.', 'success');
}

function deleteIngredient(id) {
  const linkedRecipes = state.recipes.filter((recipe) => recipe.ingredientRows.some((row) => row.ingredientId === id));
  const warning = linkedRecipes.length
    ? `This ingredient is linked in ${linkedRecipes.length} saved recipe(s). Rows keep snapshot data so costing will still work. Delete anyway?`
    : 'Delete this ingredient from the library?';

  if (!window.confirm(warning)) return;

  state.ingredients = state.ingredients.filter((ing) => ing.id !== id);
  persistIngredients();
  refreshIngredientSelects();
  renderLibrary();
  setInlineMessage(dom.library.errors, 'Ingredient deleted.', 'success');
}

function refreshIngredientSelects() {
  const existingRows = readRowsFromDom();
  dom.ingredientRows.innerHTML = '';
  existingRows.forEach((row) => addRowToDom(row));
}

function persistIngredients() {
  setStored(STORAGE_KEYS.ingredients, state.ingredients);
}

/* ==============================
   Recipe CRUD Functions
================================ */
function persistRecipes() {
  setStored(STORAGE_KEYS.recipes, state.recipes);
}

function saveDraft() {
  const draft = readRecipeFromForm();
  draft.id = state.activeRecipeId;
  draft.savedAt = nowIso();
  setStored(STORAGE_KEYS.draft, draft);
  dom.draftState.textContent = `Draft saved ${new Date().toLocaleTimeString()}`;
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
  dom.draftState.textContent = 'Draft cleared';
}

function newRecipe() {
  state.activeRecipeId = null;
  setInlineMessage(dom.editorErrors, '');
  clearRecipeValidationState();
  setRecipeToForm(defaultRecipe());
  saveDraft();
  renderRecipes();
}

function saveRecipe() {
  const recipe = readRecipeFromForm();
  const errors = validateRecipe(recipe);
  if (errors.length) {
    markRecipeValidation(recipe);
    setInlineMessage(dom.editorErrors, errors.join(' '));
    return;
  }
  const stamp = nowIso();
  recipe.id = uid('rec');
  recipe.createdAt = stamp;
  recipe.updatedAt = stamp;
  state.recipes.push(recipe);
  state.activeRecipeId = recipe.id;
  persistRecipes();
  saveDraft();
  renderRecipes();
  clearRecipeValidationState();
  setInlineMessage(dom.editorErrors, 'Recipe saved.', 'success');
}

function updateRecipe() {
  if (!state.activeRecipeId) {
    setInlineMessage(dom.editorErrors, 'Load a saved recipe first, or use Save Recipe.');
    return;
  }
  const recipe = readRecipeFromForm();
  const errors = validateRecipe(recipe);
  if (errors.length) {
    markRecipeValidation(recipe);
    setInlineMessage(dom.editorErrors, errors.join(' '));
    return;
  }

  const existing = state.recipes.find((r) => r.id === state.activeRecipeId);
  if (!existing) {
    setInlineMessage(dom.editorErrors, 'Selected recipe was not found.');
    return;
  }

  recipe.id = existing.id;
  recipe.createdAt = existing.createdAt;
  recipe.updatedAt = nowIso();

  state.recipes = state.recipes.map((r) => (r.id === existing.id ? recipe : r));
  persistRecipes();
  saveDraft();
  renderRecipes();
  clearRecipeValidationState();
  setInlineMessage(dom.editorErrors, 'Recipe updated.', 'success');
}

function duplicateRecipe() {
  const source = state.activeRecipeId ? state.recipes.find((r) => r.id === state.activeRecipeId) : readRecipeFromForm();
  if (!source || !cleanText(source.name)) {
    setInlineMessage(dom.editorErrors, 'Provide a recipe name before duplicating.');
    return;
  }
  const copy = structuredClone(source);
  copy.id = uid('rec');
  copy.name = `${copy.name} (Copy)`;
  copy.createdAt = nowIso();
  copy.updatedAt = copy.createdAt;
  copy.ingredientRows = (copy.ingredientRows || []).map((row) => ({ ...row, rowId: uid('row') }));

  state.recipes.push(copy);
  state.activeRecipeId = copy.id;
  setRecipeToForm(copy);
  persistRecipes();
  saveDraft();
  renderRecipes();
  setInlineMessage(dom.editorErrors, 'Recipe duplicated.', 'success');
}

function deleteRecipe() {
  if (!state.activeRecipeId) {
    setInlineMessage(dom.editorErrors, 'Select a recipe to delete.');
    return;
  }
  const recipe = state.recipes.find((r) => r.id === state.activeRecipeId);
  if (!recipe) return;
  if (!window.confirm(`Delete recipe "${recipe.name}"?`)) return;

  state.recipes = state.recipes.filter((r) => r.id !== recipe.id);
  persistRecipes();
  newRecipe();
  renderRecipes();
}

/* ==============================
   Modal Controls
================================ */
function openLibraryModal() {
  dom.library.modal.classList.add('open');
  dom.library.modal.setAttribute('aria-hidden', 'false');
}

function closeLibraryModal() {
  dom.library.modal.classList.remove('open');
  dom.library.modal.setAttribute('aria-hidden', 'true');
}

/* ==============================
   Bootstrap / Init
================================ */
function bindEvents() {
  dom.recipeSearch.addEventListener('input', () => {
    state.recipeSearch = dom.recipeSearch.value;
    renderRecipes();
  });

  Object.values(dom.fields).forEach((el) => {
    el.addEventListener('input', () => {
      if (el.classList.contains('is-invalid')) el.classList.remove('is-invalid');
      if (dom.editorErrors.textContent && !dom.editorErrors.classList.contains('success')) setInlineMessage(dom.editorErrors, '');
      recalcAndRender();
      saveDraft();
    });
  });

  dom.actions.addRow.addEventListener('click', () => {
    addRowToDom();
    recalcAndRender();
    saveDraft();
  });

  dom.actions.newRecipe.addEventListener('click', newRecipe);
  dom.actions.save.addEventListener('click', saveRecipe);
  dom.actions.update.addEventListener('click', updateRecipe);
  dom.actions.duplicate.addEventListener('click', duplicateRecipe);
  dom.actions.del.addEventListener('click', deleteRecipe);
  dom.actions.reset.addEventListener('click', () => {
    if (window.confirm('Reset current form and clear draft?')) {
      state.activeRecipeId = null;
      clearDraft();
      setRecipeToForm(defaultRecipe());
      setInlineMessage(dom.editorErrors, '');
      renderRecipes();
    }
  });

  dom.actions.openLib.addEventListener('click', openLibraryModal);
  dom.actions.closeLib.addEventListener('click', closeLibraryModal);
  dom.library.modal.addEventListener('click', (e) => {
    if (e.target.dataset.closeModal === 'true') closeLibraryModal();
  });

  dom.library.search.addEventListener('input', () => {
    state.ingredientSearch = dom.library.search.value;
    renderLibrary();
  });

  [dom.library.name, dom.library.price, dom.library.packSize, dom.library.packUnit].forEach((el) => {
    el.addEventListener('input', () => {
      if (!dom.library.errors.classList.contains('success')) setInlineMessage(dom.library.errors, '');
    });
  });

  dom.library.add.addEventListener('click', addIngredient);
  dom.library.update.addEventListener('click', updateIngredient);
  dom.library.clear.addEventListener('click', clearIngredientForm);
}

function seedIfNeeded() {
  const seeded = localStorage.getItem(STORAGE_KEYS.seeded);
  const existingIngredients = getStoredArray(STORAGE_KEYS.ingredients);
  const existingRecipes = getStoredArray(STORAGE_KEYS.recipes);
  if (!seeded && !existingIngredients.length && !existingRecipes.length) {
    const ingredients = sampleIngredients();
    const recipes = sampleRecipes(ingredients);
    setStored(STORAGE_KEYS.ingredients, ingredients);
    setStored(STORAGE_KEYS.recipes, recipes);
    localStorage.setItem(STORAGE_KEYS.seeded, '1');
  }
}

function initState() {
  seedIfNeeded();
  state.ingredients = getStoredArray(STORAGE_KEYS.ingredients);
  state.recipes = getStoredArray(STORAGE_KEYS.recipes);
  state.draft = safeParse(localStorage.getItem(STORAGE_KEYS.draft), null);

  renderLibrary();
  renderRecipes();

  if (state.draft) {
    state.activeRecipeId = state.draft.id || null;
    setRecipeToForm({ ...defaultRecipe(), ...state.draft });
    dom.draftState.textContent = `Draft restored ${new Date(state.draft.savedAt || Date.now()).toLocaleString()}`;
  } else if (state.recipes.length) {
    const latest = [...state.recipes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    state.activeRecipeId = latest.id;
    setRecipeToForm(structuredClone(latest));
  } else {
    setRecipeToForm(defaultRecipe());
  }
}

bindEvents();
initState();
