/* Nutrition domain: meals, templates, planner, grocery, pantry, prep.
   Meals are the base unit — everything else derives from them. */
(function(global){
  const CATS = ['Breakfast','Lunch','Dinner','Snacks','Dessert','Drink','Entrees','Sauce','Sides'];
  const SLOTS = ['breakfast','lunch','dinner','snacks'];
  const DAYS  = ['sun','mon','tue','wed','thu','fri','sat'];

  const SEED_MEALS = [
    { id:'m1', title:"Coconut Mango Popsicles", category:'Dessert', source:'thelittleepicurean.com',
      tags:[], ingredients:[],
      steps:["In a blender or food processor, puree mango chunks and pineapple juice until smooth.",
             "Transfer to a bowl and set aside.",
             "In another bowl, combine coconut milk, sugar, yogurt, and water. Stir until homogenous.",
             "Pour 2 Tbsp of mango puree into each popsicle mold.",
             "Place in freezer for 15 minutes until almost solid.",
             "Remove mold, add 1 Tbsp coconut puree. Freeze 10 minutes. Add 1 Tbsp mango puree. Insert sticks.",
             "Freeze for another 10 minutes.",
             "Pour remaining coconut puree into molds until liquid reaches the top.",
             "Return mold to the freezer.",
             "Freeze for at least 4 hours to fully set."],
      createdAt: Date.now() - 6e8 },
    { id:'m2', title:"Overnight Oats", category:'Breakfast', source:'wholefully.com', tags:['high-protein'],
      ingredients:[{ n:'rolled oats', q:0.5, u:'cup' },{ n:'milk', q:0.5, u:'cup' },
                   { n:'greek yogurt', q:0.25, u:'cup' },{ n:'chia seeds', q:1, u:'tbsp' },
                   { n:'banana', q:1, u:'' }],
      steps:["Combine oats, milk, yogurt and chia in a jar.","Stir well and refrigerate overnight.","Top with banana before eating."],
      createdAt: Date.now() - 5e8 },
    { id:'m3', title:"Orange Kale Smoothie", category:'Drink', source:'nutriliving.com', tags:[],
      ingredients:[{ n:'kale', q:2, u:'cup' },{ n:'orange', q:2, u:'' },{ n:'banana', q:1, u:'' },
                   { n:'greek yogurt', q:0.5, u:'cup' },{ n:'ice', q:1, u:'cup' },{ n:'honey', q:1, u:'tbsp' }],
      steps:["Add everything to the blender.","Blend until smooth."],
      createdAt: Date.now() - 4e8 },
    { id:'m4', title:"Peanut Butter Protein Bars", category:'Dessert', source:'sugarfreelondoner.com',
      tags:['high-protein'],
      ingredients:[{ n:'peanut butter', q:1, u:'cup' },{ n:'protein powder', q:2, u:'scoop' },
                   { n:'almond flour', q:0.5, u:'cup' },{ n:'honey', q:2, u:'tbsp' }],
      steps:["Mix everything into a stiff dough.","Press into a lined tin.","Chill 2 hours, then cut into bars."],
      createdAt: Date.now() - 3e8 },
    { id:'m5', title:"Chicken & Rice Bowl", category:'Entrees', source:'', tags:['high-protein'],
      ingredients:[{ n:'chicken breast', q:300, u:'g' },{ n:'jasmine rice', q:1, u:'cup' },
                   { n:'soy sauce', q:2, u:'tbsp' }],
      steps:["Season chicken and pan-sear 6-7 min per side.","Cook rice according to package.",
             "Slice chicken, serve over rice with soy sauce."],
      createdAt: Date.now() - 2e8 }
  ];

  const cache = {};
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  async function load(store){
    if(cache[store]) return cache[store];
    const { values } = await Store.all(store);
    cache[store] = values;
    return cache[store];
  }
  async function loadSamples(){
    for(const m of SEED_MEALS) await Store.put('meals', m);
    invalidate('meals');
  }
  const invalidate = k => k ? delete cache[k] : Object.keys(cache).forEach(x => delete cache[x]);

  const meals     = () => load('meals');
  const templates = () => load('templates');
  const pantry    = () => load('pantry');
  const prep      = () => load('prep');

  async function save(store, rec, prefix){
    const r = { ...rec };
    if(!r.id){ r.id = uid(prefix); r.createdAt = Date.now(); }
    await Store.put(store, r);
    invalidate(store);
    return r;
  }
  async function remove(store, id){ await Store.del(store, id); invalidate(store); }

  /* ---- ISO week helpers ---- */
  /* Weeks run Sunday to Saturday, and a week is named by the date of its Sunday.
     A plain date is unambiguous in a way that week numbers are not — no arguing
     about which week owns January 1st. */
  function weekStart(d){
    const x = new Date(d || Date.now());
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - x.getDay());     /* getDay: Sunday is 0 */
    return x;
  }
  function isoWeek(d){
    const s = weekStart(d);
    const p = n => String(n).padStart(2, '0');
    return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
  }
  function weekRange(key){
    const [y, m, day] = String(key).split('-').map(Number);
    const sunday = new Date(y, (m || 1) - 1, day || 1);
    sunday.setHours(0,0,0,0);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const fmt = d => d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    return { sunday, saturday, start:sunday, end:saturday,
             monday:sunday,                 /* kept so older callers still work */
             label:`${fmt(sunday)} – ${fmt(saturday)}` };
  }
  function shiftWeek(key, delta){
    const { sunday: monday } = weekRange(key);
    const d = new Date(monday); d.setDate(d.getDate() + delta * 7);
    return isoWeek(d);
  }

  async function week(key){
    const rec = await Store.get('planner', key);
    return rec || { id:key, slots:{} };
  }
  async function setSlot(key, day, slot, mealId){
    const rec = await week(key);
    const k = `${day}-${slot}`;
    mealId ? rec.slots[k] = mealId : delete rec.slots[k];
    await Store.put('planner', rec);
    return rec;
  }
  async function applyTemplate(key, day, templateId){
    const [tpls, rec] = await Promise.all([templates(), week(key)]);
    const t = tpls.find(x => x.id === templateId);
    if(!t) return rec;
    SLOTS.forEach(s => { if(t[s]) rec.slots[`${day}-${s}`] = t[s]; });
    await Store.put('planner', rec);
    return rec;
  }

  /* ---- grocery: derived from the week's plan, minus the pantry ---- */
  const norm = s => String(s).trim().toLowerCase();
  async function groceryFor(key){
    const [rec, m, p, extraRec] = await Promise.all([
      week(key), meals(), pantry(), Store.get('grocery', key)
    ]);
    const byId = Object.fromEntries(m.map(x => [x.id, x]));
    const need = {};
    Object.values(rec.slots).forEach(id => {
      const meal = byId[id];
      if(!meal) return;
      (meal.ingredients || []).forEach(ing => {
        const k = norm(ing.n) + '|' + (ing.u || '');
        if(!need[k]) need[k] = { name:ing.n, unit:ing.u || '', qty:0, from:'plan' };
        need[k].qty += (+ing.q || 0);
      });
    });
    const extra = (extraRec && extraRec.extra) || [];
    extra.forEach(e => {
      const k = norm(e.name) + '|' + (e.unit || '');
      if(!need[k]) need[k] = { name:e.name, unit:e.unit || '', qty:0, from:'manual' };
      need[k].qty += (+e.qty || 0);
    });
    const have = new Set(p.map(x => norm(x.name)));
    const ticked = new Set((extraRec && extraRec.checked) || []);
    return Object.entries(need).map(([k,v]) => ({
      key:k, ...v, inPantry:have.has(norm(v.name)), checked:ticked.has(k)
    })).sort((a,b) => a.name.localeCompare(b.name));
  }
  async function toggleGrocery(key, itemKey){
    const rec = (await Store.get('grocery', key)) || { id:key, checked:[], extra:[] };
    rec.checked = rec.checked || [];
    rec.checked.includes(itemKey)
      ? rec.checked = rec.checked.filter(x => x !== itemKey)
      : rec.checked.push(itemKey);
    await Store.put('grocery', rec);
  }
  async function addGroceryExtra(key, name, qty, unit){
    const rec = (await Store.get('grocery', key)) || { id:key, checked:[], extra:[] };
    rec.extra = rec.extra || [];
    rec.extra.push({ name, qty:+qty || 1, unit:unit || '' });
    await Store.put('grocery', rec);
  }

  /* ---- prep sessions ---- */
  /* How many of each meal this session is making. A per-meal count wins over the
     session default, so one session can make two loaves and six portions of chilli. */
  const batchesOf = (session, mealId) => {
    const per = session.per || {};
    const n = per[mealId];
    return Math.max(1, +n || +session.batches || 1);
  };

  async function prepShopping(session){
    const m = await meals();
    const byId = Object.fromEntries(m.map(x => [x.id, x]));
    const need = {};
    (session.mealIds || []).forEach(id => {
      const meal = byId[id]; if(!meal) return;
      const mult = batchesOf(session, id);
      (meal.ingredients || []).forEach(ing => {
        const k = norm(ing.n) + '|' + (ing.u || '');
        if(!need[k]) need[k] = { name:ing.n, unit:ing.u || '', qty:0 };
        need[k].qty += (+ing.q || 0) * mult;
      });
    });
    return Object.values(need);
  }

  /* One meal's ingredients at the count this session is cooking. */
  function scaledIngredients(meal, mult){
    return (meal.ingredients || []).map(ing => ({
      name: ing.n,
      unit: ing.u || '',
      base: +ing.q || 0,
      qty: (+ing.q || 0) * Math.max(1, mult || 1)
    }));
  }
  async function markCooked(id){
    const all = await prep();
    const s = all.find(x => x.id === id);
    if(!s) return;
    s.cooked = true; s.cookedAt = Date.now();
    await Store.put('prep', s);
    invalidate('prep');
  }

  global.Nutrition = {
    CATS, SLOTS, DAYS, meals, templates, pantry, prep, save, remove, invalidate, loadSamples,
    isoWeek, weekRange, shiftWeek, week, setSlot, applyTemplate,
    groceryFor, toggleGrocery, addGroceryExtra, prepShopping, markCooked,
    batchesOf, scaledIngredients
  };
})(window);
