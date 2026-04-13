const STORAGE_KEYS = {
  ingredients: 'mpe_v5_ingredients',
  recipes: 'mpe_v5_recipes',
  dishes: 'mpe_v5_dishes',
  snapshots: 'mpe_v5_snapshots',
  weeklyReviews: 'mpe_v5_weekly_reviews',
  legacyIngredients: 'mpe_v4_ingredients',
  legacyRecipes: 'mpe_v4_recipes',
  legacySnapshots: 'mpe_v4_snapshots',
  legacyWeekly: 'mpe_v4_weekly_reviews',
};

const UNITS = ['g', 'kg', 'ml', 'l', 'unit'];
const UNIT_GROUP = { g: 'w', kg: 'w', ml: 'v', l: 'v', unit: 'c' };
const UNIT_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, unit: 1 };

const $ = (id) => document.getElementById(id);
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();
const n = (v, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
const t = (v) => String(v ?? '').trim();
const money = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n(v));

const state = {
  ingredients: [],
  recipes: [],
  dishes: [],
  snapshots: [],
  weeklyReviews: [],
  editIngredientId: null,
  editRecipeId: null,
  editDishId: null,
  mode: 'home',
};

function safeParse(k, fallback) {
  try {
    const val = JSON.parse(localStorage.getItem(k));
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

function setStored(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function persist() {
  setStored(STORAGE_KEYS.ingredients, state.ingredients);
  setStored(STORAGE_KEYS.recipes, state.recipes);
  setStored(STORAGE_KEYS.dishes, state.dishes);
  setStored(STORAGE_KEYS.snapshots, state.snapshots);
  setStored(STORAGE_KEYS.weeklyReviews, state.weeklyReviews);
}

function convertUnit(value, from, to) {
  if (!from || !to || UNIT_GROUP[from] !== UNIT_GROUP[to]) return { ok: false, value: 0 };
  return { ok: true, value: (n(value) * UNIT_FACTOR[from]) / UNIT_FACTOR[to] };
}

function rowIngredientCost(input) {
  const ing = state.ingredients.find((i) => i.id === input.sourceId);
  if (!ing) return 0;
  const cv = convertUnit(input.quantityUsed, input.useUnit, ing.packUnit);
  if (!cv.ok) return 0;
  return (ing.purchasePrice / Math.max(ing.packSize, 0.0001)) * cv.value;
}

function recipeMetrics(recipe) {
  const rows = (recipe.ingredientInputs || []).map((r) => ({ ...r, calculatedCost: rowIngredientCost(r) }));
  const totalBatchCost = rows.reduce((s, r) => s + r.calculatedCost, 0);
  const costPerYieldUnit = totalBatchCost / Math.max(n(recipe.yieldQuantity, 1), 0.0001);
  return { rows, totalBatchCost, costPerYieldUnit };
}

function dishComponentCost(component) {
  if (component.sourceType === 'ingredient') {
    const ing = state.ingredients.find((i) => i.id === component.sourceId);
    if (!ing) return 0;
    const cv = convertUnit(component.quantityUsed, component.useUnit, ing.packUnit);
    if (!cv.ok) return 0;
    return (ing.purchasePrice / Math.max(ing.packSize, 0.0001)) * cv.value;
  }
  const recipe = state.recipes.find((r) => r.id === component.sourceId);
  if (!recipe) return 0;
  const rm = recipeMetrics(recipe);
  const cv = convertUnit(component.quantityUsed, component.useUnit, recipe.yieldUnit);
  if (!cv.ok) return 0;
  return rm.costPerYieldUnit * cv.value;
}

function dishMetrics(dish) {
  const components = (dish.components || []).map((c) => ({ ...c, calculatedCost: dishComponentCost(c) }));
  const componentCost = components.reduce((s, c) => s + c.calculatedCost, 0);
  const totalPortionCost = componentCost + n(dish.packagingCostPerPortion, 0);
  const suggestedPrice = totalPortionCost / (Math.max(n(dish.targetFoodCostPercent, 30), 0.01) / 100);
  const rule = Math.max(n(dish.roundingRule, 0.25), 0.01);
  const roundedPrice = Math.round(suggestedPrice / rule) * rule;
  const effectivePrice = n(dish.manualPriceOverride, 0) > 0 ? n(dish.manualPriceOverride) : (n(dish.currentSellingPrice, 0) > 0 ? n(dish.currentSellingPrice) : roundedPrice);
  const foodCostPercent = effectivePrice > 0 ? (totalPortionCost / effectivePrice) * 100 : 0;
  const unitsSold = Math.max(0, Math.round(n(dish.unitsSold, 0)));
  const revenue = effectivePrice * unitsSold;
  const totalGrossProfit = (effectivePrice - totalPortionCost) * unitsSold;
  const grossProfitPerPortion = effectivePrice - totalPortionCost;
  return { components, totalPortionCost, suggestedPrice, roundedPrice, effectivePrice, foodCostPercent, revenue, totalGrossProfit, grossProfitPerPortion, unitsSold };
}

function classifyDishes(items) {
  const active = items.filter((d) => d.active);
  if (active.length < 2) return items.map((d) => ({ ...d, classification: d.active ? 'Unclassified' : 'Inactive' }));
  const avgUnits = active.reduce((s, d) => s + d.unitsSold, 0) / active.length;
  const avgGp = active.reduce((s, d) => s + d.grossProfitPerPortion, 0) / active.length;
  return items.map((d) => {
    if (!d.active) return { ...d, classification: 'Inactive' };
    const highUnits = d.unitsSold >= avgUnits;
    const highGp = d.grossProfitPerPortion >= avgGp;
    const classification = highUnits && highGp ? 'Star' : highUnits ? 'Plowhorse' : highGp ? 'Puzzle' : 'Dog';
    return { ...d, classification };
  });
}

function isLegacyDishLikeRecipe(raw) {
  const keys = ['targetFoodCostPercent', 'targetFoodCost', 'sellingPrice', 'currentSellingPrice', 'unitsSold', 'packagingCost', 'packagingCostPerPortion', 'deliveryCommissionPercent', 'vatRatePercent', 'roundingRule'];
  return keys.some((k) => raw && raw[k] !== undefined && raw[k] !== null && raw[k] !== '');
}

function migrateLegacyData() {
  const v5 = safeParse(STORAGE_KEYS.ingredients, null);
  if (Array.isArray(v5)) {
    state.ingredients = v5;
    state.recipes = safeParse(STORAGE_KEYS.recipes, []);
    state.dishes = safeParse(STORAGE_KEYS.dishes, []);
    state.snapshots = safeParse(STORAGE_KEYS.snapshots, []);
    state.weeklyReviews = safeParse(STORAGE_KEYS.weeklyReviews, []);
    return;
  }

  const legacyIngredients = safeParse(STORAGE_KEYS.legacyIngredients, []);
  const legacyRecipes = safeParse(STORAGE_KEYS.legacyRecipes, []);
  state.ingredients = (legacyIngredients || []).map((i) => ({
    id: t(i.id) || uid('ing'),
    name: t(i.name),
    purchasePrice: Math.max(0, n(i.purchasePrice, i.price)),
    packSize: Math.max(0.0001, n(i.packSize, 1)),
    packUnit: UNITS.includes(i.packUnit) ? i.packUnit : 'g',
    supplier: t(i.supplier),
    notes: t(i.notes),
    createdAt: t(i.createdAt) || now(),
    updatedAt: now(),
  }));

  state.recipes = [];
  state.dishes = [];

  (legacyRecipes || []).forEach((r) => {
    const id = t(r.id) || uid('legacy');
    const rows = Array.isArray(r.ingredientRows) ? r.ingredientRows : [];
    const ingredientInputs = rows.map((row) => ({
      id: uid('rin'),
      sourceId: t(row.ingredientId),
      sourceNameSnapshot: t(row.ingredientNameSnapshot || row.name),
      quantityUsed: Math.max(0, n(row.amountUsed)),
      useUnit: UNITS.includes(row.useUnit) ? row.useUnit : 'g',
      calculatedCost: 0,
    }));

    if (isLegacyDishLikeRecipe(r)) {
      state.dishes.push({
        id: uid('dish'),
        name: t(r.name) || `Migrated Dish ${id}`,
        category: t(r.category),
        active: typeof r.isActive === 'boolean' ? r.isActive : true,
        components: ingredientInputs.map((ri) => ({ ...ri, sourceType: 'ingredient' })),
        packagingCostPerPortion: Math.max(0, n(r.packagingCostPerPortion, r.packagingCost)),
        targetFoodCostPercent: Math.max(0.01, n(r.targetFoodCostPercent, r.targetFoodCost, 30)),
        vatRatePercent: Math.max(0, n(r.vatRatePercent, 20)),
        deliveryCommissionPercent: Math.max(0, n(r.deliveryCommissionPercent, 30)),
        roundingRule: Math.max(0.01, n(r.roundingRule, 0.25)),
        currentSellingPrice: Math.max(0, n(r.currentSellingPrice, r.sellingPrice)),
        manualPriceOverride: n(r.manualMenuPrice, 0) || '',
        unitsSold: Math.max(0, Math.round(n(r.unitsSold, 0))),
        reportingPeriod: t(r.reportingPeriod) || 'Migrated',
        notes: t(r.itemNotes),
        createdAt: t(r.createdAt) || now(),
        updatedAt: now(),
      });
    } else {
      state.recipes.push({
        id: uid('rec'),
        name: t(r.name) || `Migrated Recipe ${id}`,
        category: t(r.category),
        yieldQuantity: Math.max(0.01, n(r.yieldQuantity, r.portionsYielded, 1)),
        yieldUnit: UNITS.includes(r.yieldUnit) ? r.yieldUnit : 'unit',
        ingredientInputs,
        notes: t(r.notes || r.itemNotes),
        totalBatchCost: 0,
        costPerYieldUnit: 0,
        createdAt: t(r.createdAt) || now(),
        updatedAt: now(),
      });
    }
  });

  state.snapshots = safeParse(STORAGE_KEYS.legacySnapshots, []);
  state.weeklyReviews = safeParse(STORAGE_KEYS.legacyWeekly, []);
  persist();
}

function modeSwitch(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  document.querySelectorAll('.mode-panel').forEach((p) => {
    const active = p.dataset.panel === mode;
    p.classList.toggle('active', active);
    p.hidden = !active;
  });
  $('mode-indicator').textContent = `Mode: ${document.querySelector(`.mode-tab[data-mode="${mode}"]`).textContent}`;
}

function renderIngredients() {
  $('ing-body').innerHTML = state.ingredients.map((i) => `<tr><td>${i.name}</td><td>${money(i.purchasePrice)}</td><td>${i.packSize} ${i.packUnit}</td><td>${i.supplier || '—'}</td><td><button class="btn" data-ing-edit="${i.id}">Edit</button> <button class="btn danger" data-ing-del="${i.id}">Delete</button></td></tr>`).join('');
}

function fillRecipeRowOptions(row) {
  const sel = row.querySelector('.src-id');
  sel.innerHTML = '<option value="">Select ingredient</option>' + state.ingredients.map((i) => `<option value="${i.id}">${i.name}</option>`).join('');
}
function addRecipeRow(data = null) {
  const row = $('recipe-row-template').content.firstElementChild.cloneNode(true);
  fillRecipeRowOptions(row);
  if (data) {
    row.querySelector('.src-id').value = data.sourceId;
    row.querySelector('.qty').value = data.quantityUsed;
    row.querySelector('.unit').value = data.useUnit;
  }
  row.querySelector('.remove').addEventListener('click', () => { row.remove(); renderRecipeMetrics(); });
  row.querySelectorAll('select,input').forEach((el) => el.addEventListener('input', renderRecipeMetrics));
  $('rec-rows').appendChild(row);
}

function readRecipeForm() {
  const ingredientInputs = [...$('rec-rows').querySelectorAll('tr')].map((tr) => ({
    id: uid('rin'),
    sourceId: tr.querySelector('.src-id').value,
    sourceNameSnapshot: state.ingredients.find((i) => i.id === tr.querySelector('.src-id').value)?.name || '',
    quantityUsed: Math.max(0, n(tr.querySelector('.qty').value, 0)),
    useUnit: tr.querySelector('.unit').value,
    calculatedCost: n(tr.querySelector('.cost').dataset.value, 0),
  })).filter((r) => r.sourceId && r.quantityUsed > 0);

  return {
    id: state.editRecipeId || uid('rec'),
    name: t($('rec-name').value),
    category: t($('rec-category').value),
    yieldQuantity: Math.max(0.01, n($('rec-yield-qty').value, 1)),
    yieldUnit: $('rec-yield-unit').value,
    ingredientInputs,
    notes: t($('rec-notes').value),
    totalBatchCost: 0,
    costPerYieldUnit: 0,
    createdAt: state.editRecipeId ? state.recipes.find((r) => r.id === state.editRecipeId)?.createdAt || now() : now(),
    updatedAt: now(),
  };
}

function renderRecipeMetrics() {
  const recipe = readRecipeForm();
  const metrics = recipeMetrics(recipe);
  [...$('rec-rows').querySelectorAll('tr')].forEach((tr, idx) => {
    const val = metrics.rows[idx]?.calculatedCost || 0;
    const el = tr.querySelector('.cost');
    el.textContent = money(val);
    el.dataset.value = String(val);
  });
  $('rec-metrics').innerHTML = `Total Batch Cost: <strong>${money(metrics.totalBatchCost)}</strong> · Cost per ${recipe.yieldUnit}: <strong>${money(metrics.costPerYieldUnit)}</strong>`;
}

function setRecipeForm(recipe = null) {
  state.editRecipeId = recipe?.id || null;
  $('rec-name').value = recipe?.name || '';
  $('rec-category').value = recipe?.category || '';
  $('rec-yield-qty').value = recipe?.yieldQuantity || 1;
  $('rec-yield-unit').value = recipe?.yieldUnit || 'unit';
  $('rec-notes').value = recipe?.notes || '';
  $('rec-rows').innerHTML = '';
  (recipe?.ingredientInputs?.length ? recipe.ingredientInputs : [{}]).forEach((r) => addRecipeRow(r.sourceId ? r : null));
  renderRecipeMetrics();
}

function renderRecipes() {
  $('rec-list').innerHTML = state.recipes.map((r) => {
    const m = recipeMetrics(r);
    return `<li><strong>${r.name}</strong> (${r.category || '—'}) · Batch ${money(m.totalBatchCost)} · ${money(m.costPerYieldUnit)}/${r.yieldUnit}
      <button class="btn" data-rec-edit="${r.id}">Edit</button>
      <button class="btn danger" data-rec-del="${r.id}">Delete</button></li>`;
  }).join('') || '<li>No recipes yet.</li>';
}

function fillDishSourceOptions(row) {
  const type = row.querySelector('.src-type').value;
  const sel = row.querySelector('.src-id');
  const items = type === 'ingredient' ? state.ingredients : state.recipes;
  sel.innerHTML = '<option value="">Select source</option>' + items.map((i) => `<option value="${i.id}">${i.name}</option>`).join('');
}
function addDishRow(data = null) {
  const row = $('dish-row-template').content.firstElementChild.cloneNode(true);
  if (data?.sourceType) row.querySelector('.src-type').value = data.sourceType;
  fillDishSourceOptions(row);
  if (data) {
    row.querySelector('.src-id').value = data.sourceId;
    row.querySelector('.qty').value = data.quantityUsed;
    row.querySelector('.unit').value = data.useUnit;
  }
  row.querySelector('.src-type').addEventListener('change', () => { fillDishSourceOptions(row); renderDishMetrics(); });
  row.querySelector('.remove').addEventListener('click', () => { row.remove(); renderDishMetrics(); });
  row.querySelectorAll('select,input').forEach((el) => el.addEventListener('input', renderDishMetrics));
  $('dish-rows').appendChild(row);
}

function readDishForm() {
  const components = [...$('dish-rows').querySelectorAll('tr')].map((tr) => {
    const sourceType = tr.querySelector('.src-type').value;
    const sourceId = tr.querySelector('.src-id').value;
    const source = sourceType === 'ingredient' ? state.ingredients.find((i) => i.id === sourceId) : state.recipes.find((r) => r.id === sourceId);
    return {
      id: uid('cmp'),
      sourceType,
      sourceId,
      sourceNameSnapshot: source?.name || '',
      quantityUsed: Math.max(0, n(tr.querySelector('.qty').value, 0)),
      useUnit: tr.querySelector('.unit').value,
      calculatedCost: n(tr.querySelector('.cost').dataset.value, 0),
    };
  }).filter((c) => c.sourceId && c.quantityUsed > 0);

  return {
    id: state.editDishId || uid('dish'),
    name: t($('dish-name').value),
    category: t($('dish-category').value),
    active: $('dish-active').value === 'true',
    components,
    packagingCostPerPortion: Math.max(0, n($('dish-packaging').value, 0)),
    targetFoodCostPercent: Math.max(0.01, n($('dish-target').value, 30)),
    vatRatePercent: Math.max(0, n($('dish-vat').value, 20)),
    deliveryCommissionPercent: Math.max(0, n($('dish-delivery').value, 30)),
    roundingRule: Math.max(0.01, n($('dish-rounding').value, 0.25)),
    currentSellingPrice: Math.max(0, n($('dish-price').value, 0)),
    manualPriceOverride: Math.max(0, n($('dish-manual').value, 0)) || '',
    unitsSold: Math.max(0, Math.round(n($('dish-units').value, 0))),
    reportingPeriod: t($('dish-period').value) || 'Last 30 Days',
    notes: t($('dish-notes').value),
    createdAt: state.editDishId ? state.dishes.find((d) => d.id === state.editDishId)?.createdAt || now() : now(),
    updatedAt: now(),
  };
}

function renderDishMetrics() {
  const dish = readDishForm();
  const metrics = dishMetrics(dish);
  [...$('dish-rows').querySelectorAll('tr')].forEach((tr, idx) => {
    const val = metrics.components[idx]?.calculatedCost || 0;
    const el = tr.querySelector('.cost');
    el.textContent = money(val);
    el.dataset.value = String(val);
  });
  $('dish-metrics').innerHTML = `Total Portion Cost: <strong>${money(metrics.totalPortionCost)}</strong> · Suggested: <strong>${money(metrics.suggestedPrice)}</strong> · Rounded: <strong>${money(metrics.roundedPrice)}</strong> · Actual Food Cost: <strong>${metrics.foodCostPercent.toFixed(2)}%</strong> · Revenue: <strong>${money(metrics.revenue)}</strong>`;
}

function setDishForm(dish = null) {
  state.editDishId = dish?.id || null;
  $('dish-name').value = dish?.name || '';
  $('dish-category').value = dish?.category || '';
  $('dish-active').value = String(dish?.active ?? true);
  $('dish-packaging').value = dish?.packagingCostPerPortion ?? 0;
  $('dish-target').value = dish?.targetFoodCostPercent ?? 30;
  $('dish-vat').value = dish?.vatRatePercent ?? 20;
  $('dish-delivery').value = dish?.deliveryCommissionPercent ?? 30;
  $('dish-rounding').value = dish?.roundingRule ?? 0.25;
  $('dish-price').value = dish?.currentSellingPrice ?? '';
  $('dish-manual').value = dish?.manualPriceOverride ?? '';
  $('dish-units').value = dish?.unitsSold ?? 0;
  $('dish-period').value = dish?.reportingPeriod || 'Last 30 Days';
  $('dish-notes').value = dish?.notes || '';
  $('dish-rows').innerHTML = '';
  (dish?.components?.length ? dish.components : [{}]).forEach((c) => addDishRow(c.sourceId ? c : null));
  renderDishMetrics();
}

function renderDishes() {
  const evaluated = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  $('dish-list').innerHTML = evaluated.map((d) => `<li><strong>${d.name}</strong> · ${d.classification} · Price ${money(d.effectivePrice)} · FC ${d.foodCostPercent.toFixed(2)}%
    <button class="btn" data-dish-edit="${d.id}">Edit</button>
    <button class="btn danger" data-dish-del="${d.id}">Delete</button></li>`).join('') || '<li>No dishes yet.</li>';
}

function renderHome() {
  const dishes = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  const active = dishes.filter((d) => d.active);
  const totals = {
    dishes: active.length,
    revenue: active.reduce((s, d) => s + d.revenue, 0),
    gp: active.reduce((s, d) => s + d.totalGrossProfit, 0),
    avgFc: active.length ? active.reduce((s, d) => s + d.foodCostPercent, 0) / active.length : 0,
  };
  $('home-kpis').innerHTML = [
    ['Active Dishes', totals.dishes],
    ['Revenue', money(totals.revenue)],
    ['Total Gross Profit', money(totals.gp)],
    ['Avg Food Cost %', `${totals.avgFc.toFixed(2)}%`],
  ].map(([k, v]) => `<div class="kpi"><span>${k}</span><strong>${v}</strong></div>`).join('');

  const risky = dishes.filter((d) => d.foodCostPercent > d.targetFoodCostPercent || d.classification === 'Dog').slice(0, 5);
  $('home-attention').innerHTML = risky.length
    ? risky.map((d) => `<li><strong>${d.name}</strong>: ${d.classification}, FC ${d.foodCostPercent.toFixed(2)}% (target ${d.targetFoodCostPercent}%).</li>`).join('')
    : '<li>No urgent dish flags right now.</li>';
}

function actionForDish(d) {
  if (d.foodCostPercent > d.targetFoodCostPercent + 5) return 'Reprice or reduce component cost';
  if (d.classification === 'Dog') return 'Test redesign or remove';
  if (d.classification === 'Puzzle') return 'Promote placement/visibility';
  if (d.classification === 'Plowhorse') return 'Try small price lift';
  return 'Maintain and monitor';
}

function renderAnalysis() {
  const dishes = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  $('analysis-body').innerHTML = dishes.map((d) => `<tr><td>${d.name}</td><td>${d.classification}</td><td>${money(d.effectivePrice)}</td><td>${d.foodCostPercent.toFixed(2)}%</td><td>${d.unitsSold}</td><td>${money(d.revenue)}</td><td>${money(d.totalGrossProfit)}</td><td>${actionForDish(d)}</td></tr>`).join('') || '<tr><td colspan="8">No dishes available.</td></tr>';
}

function createSnapshot() {
  const name = t($('snap-name').value);
  if (!name) return;
  const periodLabel = t($('snap-period').value) || 'Unspecified';
  const items = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  state.snapshots.unshift({ id: uid('snap'), name, periodLabel, createdAt: now(), items });
  persist();
  renderReports();
}

function renderReports() {
  $('snap-list').innerHTML = state.snapshots.map((s) => `<li><strong>${s.name}</strong> (${s.periodLabel}) · ${new Date(s.createdAt).toLocaleString()} · ${s.items.length} dishes</li>`).join('') || '<li>No snapshots yet.</li>';
  const current = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  const totalRev = current.reduce((a, b) => a + b.revenue, 0);
  const totalGp = current.reduce((a, b) => a + b.totalGrossProfit, 0);
  $('report-summary').innerHTML = `Current Dish Revenue: <strong>${money(totalRev)}</strong> · Current Dish GP: <strong>${money(totalGp)}</strong> · Snapshots: <strong>${state.snapshots.length}</strong>`;
}

function renderWeekly() {
  const dishes = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  $('weekly-items').innerHTML = dishes.map((d) => `<label><input type="checkbox" data-weekly-dish="${d.id}" /> ${d.name} (${d.classification})</label>`).join('') || 'No dishes available.';
  $('weekly-log').innerHTML = state.weeklyReviews.map((w) => `<li><strong>${w.name}</strong> · ${new Date(w.createdAt).toLocaleString()} · ${w.decisions.length} decisions</li>`).join('') || '<li>No weekly reviews saved.</li>';
}

function saveWeekly() {
  const selected = [...document.querySelectorAll('[data-weekly-dish]:checked')].map((el) => el.dataset.weeklyDish);
  const dishes = classifyDishes(state.dishes.map((d) => ({ ...d, ...dishMetrics(d) })));
  const decisions = dishes.filter((d) => selected.includes(d.id)).map((d) => ({
    dishId: d.id,
    dishName: d.name,
    classification: d.classification,
    recommendedAction: actionForDish(d),
  }));
  state.weeklyReviews.unshift({
    id: uid('wrev'),
    name: `Weekly Review ${new Date().toLocaleDateString('en-GB')}`,
    createdAt: now(),
    notes: t($('weekly-notes').value),
    decisions,
  });
  persist();
  renderWeekly();
}

function bindEvents() {
  $('mode-nav').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-mode]');
    if (!tab) return;
    modeSwitch(tab.dataset.mode);
  });

  $('ing-save').addEventListener('click', () => {
    const ingredient = {
      id: state.editIngredientId || uid('ing'),
      name: t($('ing-name').value),
      purchasePrice: Math.max(0, n($('ing-price').value, 0)),
      packSize: Math.max(0.0001, n($('ing-pack-size').value, 1)),
      packUnit: $('ing-pack-unit').value,
      supplier: t($('ing-supplier').value),
      notes: t($('ing-notes').value),
      createdAt: state.editIngredientId ? state.ingredients.find((i) => i.id === state.editIngredientId)?.createdAt || now() : now(),
      updatedAt: now(),
    };
    if (!ingredient.name) return;
    if (state.editIngredientId) state.ingredients = state.ingredients.map((i) => i.id === state.editIngredientId ? ingredient : i);
    else state.ingredients.push(ingredient);
    state.editIngredientId = null;
    $('ing-reset').click();
    persist(); renderAll();
  });
  $('ing-reset').addEventListener('click', () => {
    state.editIngredientId = null;
    ['ing-name', 'ing-price', 'ing-pack-size', 'ing-supplier', 'ing-notes'].forEach((id) => $(id).value = '');
    $('ing-pack-unit').value = 'g';
  });
  $('ing-body').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-ing-edit]');
    const del = e.target.closest('[data-ing-del]');
    if (edit) {
      const i = state.ingredients.find((x) => x.id === edit.dataset.ingEdit);
      if (!i) return;
      state.editIngredientId = i.id;
      $('ing-name').value = i.name; $('ing-price').value = i.purchasePrice; $('ing-pack-size').value = i.packSize;
      $('ing-pack-unit').value = i.packUnit; $('ing-supplier').value = i.supplier; $('ing-notes').value = i.notes;
    }
    if (del) {
      state.ingredients = state.ingredients.filter((x) => x.id !== del.dataset.ingDel);
      persist(); renderAll();
    }
  });

  $('rec-add-row').addEventListener('click', () => addRecipeRow());
  ['rec-name', 'rec-category', 'rec-yield-qty', 'rec-yield-unit', 'rec-notes'].forEach((id) => $(id).addEventListener('input', renderRecipeMetrics));
  $('rec-save').addEventListener('click', () => {
    const r = readRecipeForm();
    if (!r.name) return;
    const m = recipeMetrics(r);
    r.totalBatchCost = m.totalBatchCost;
    r.costPerYieldUnit = m.costPerYieldUnit;
    if (state.editRecipeId) state.recipes = state.recipes.map((x) => x.id === state.editRecipeId ? r : x);
    else state.recipes.push(r);
    setRecipeForm(null);
    persist(); renderAll();
  });
  $('rec-reset').addEventListener('click', () => setRecipeForm(null));
  $('rec-list').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-rec-edit]');
    const del = e.target.closest('[data-rec-del]');
    if (edit) setRecipeForm(state.recipes.find((x) => x.id === edit.dataset.recEdit));
    if (del) {
      state.recipes = state.recipes.filter((x) => x.id !== del.dataset.recDel);
      persist(); renderAll();
    }
  });

  $('dish-add-row').addEventListener('click', () => addDishRow());
  ['dish-name', 'dish-category', 'dish-active', 'dish-packaging', 'dish-target', 'dish-vat', 'dish-delivery', 'dish-rounding', 'dish-price', 'dish-manual', 'dish-units', 'dish-period', 'dish-notes'].forEach((id) => $(id).addEventListener('input', renderDishMetrics));
  $('dish-save').addEventListener('click', () => {
    const d = readDishForm();
    if (!d.name) return;
    if (state.editDishId) state.dishes = state.dishes.map((x) => x.id === state.editDishId ? d : x);
    else state.dishes.push(d);
    setDishForm(null);
    persist(); renderAll();
  });
  $('dish-reset').addEventListener('click', () => setDishForm(null));
  $('dish-list').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-dish-edit]');
    const del = e.target.closest('[data-dish-del]');
    if (edit) setDishForm(state.dishes.find((x) => x.id === edit.dataset.dishEdit));
    if (del) {
      state.dishes = state.dishes.filter((x) => x.id !== del.dataset.dishDel);
      persist(); renderAll();
    }
  });

  $('snap-create').addEventListener('click', createSnapshot);
  $('weekly-save').addEventListener('click', saveWeekly);
}

function renderAll() {
  renderIngredients();
  renderRecipes();
  renderDishes();
  renderHome();
  renderAnalysis();
  renderReports();
  renderWeekly();
  renderRecipeMetrics();
  renderDishMetrics();
}

function init() {
  migrateLegacyData();
  bindEvents();
  setRecipeForm(null);
  setDishForm(null);
  renderAll();
  modeSwitch('home');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
