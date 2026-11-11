/* Recipe amounts are not shopping amounts.

   A recipe says five cups of milk; the shop sells gallons. This turns what the
   week needs into what you actually put in the trolley, and keeps the recipe
   figure alongside so you can still check it. */
(function(global){

  /* ---- canonical measures: everything converts to ml or g ---- */
  const VOLUME = {
    tsp:4.93, teaspoon:4.93, tsps:4.93,
    tbsp:14.79, tablespoon:14.79, tbsps:14.79,
    'fl oz':29.57, floz:29.57, 'fluid ounce':29.57,
    cup:236.6, cups:236.6, c:236.6,
    pint:473.2, pt:473.2,
    quart:946.4, qt:946.4,
    gallon:3785, gal:3785,
    ml:1, millilitre:1, milliliter:1,
    l:1000, litre:1000, liter:1000
  };
  const WEIGHT = {
    g:1, gram:1, grams:1, gm:1,
    kg:1000, kilo:1000, kilogram:1000,
    oz:28.35, ounce:28.35, ounces:28.35,
    lb:453.6, lbs:453.6, pound:453.6, pounds:453.6
  };

  const norm = s => String(s || '').trim().toLowerCase();

  function measure(qty, unit){
    const u = norm(unit);
    const q = +qty || 0;
    if(VOLUME[u]) return { kind:'volume', base: q * VOLUME[u] };
    if(WEIGHT[u]) return { kind:'weight', base: q * WEIGHT[u] };
    return { kind:'count', base: q };          /* eggs, onions, tins */
  }

  /* ---- how things are actually sold ----
     Matched on the ingredient name, most specific first. Each pack is given in
     the canonical measure, and the smallest one that covers the need wins. */
  const SHELF = [
    { m:/\b(milk|buttermilk|cream|half and half)s?\b/, kind:'volume', packs:[
      { n:'pint', base:473 }, { n:'quart', base:946 },
      { n:'half gallon', base:1893 }, { n:'gallon', base:3785 } ] },

    { m:/\b(stock|broth)s?\b/, kind:'volume', packs:[
      { n:'carton', base:946 } ] },

    { m:/\b(oil|vinegar)s?\b/, kind:'volume', packs:[
      { n:'small bottle', base:473 }, { n:'bottle', base:946 } ] },

    { m:/\b(juice|soda|water)s?\b/, kind:'volume', packs:[
      { n:'bottle', base:946 }, { n:'half gallon', base:1893 }, { n:'gallon', base:3785 } ] },

    { m:/\b(yogh?urt|sour cream)s?\b/, kind:'weight', packs:[
      { n:'small tub', base:170 }, { n:'tub', base:454 }, { n:'large tub', base:907 } ] },

    { m:/\b(flour|sugar|rice|oats)\b/, kind:'weight', packs:[
      { n:'bag', base:907 }, { n:'large bag', base:2268 } ] },

    { m:/\b(butter)\b/, kind:'weight', packs:[
      { n:'stick', base:113 }, { n:'box', base:454 } ] },

    { m:/\b(cheese)s?\b/, kind:'weight', packs:[
      { n:'block', base:227 }, { n:'large block', base:454 } ] },

    { m:/\b(chicken|beef|pork|turkey|mince|steak|thighs?|breasts?|salmon|fish)\b/, kind:'weight', packs:[
      { n:'lb', base:454 } ] },

    { m:/\b(pasta|spaghetti|noodles?)\b/, kind:'weight', packs:[
      { n:'box', base:454 } ] },

    { m:/\beggs?\b/, kind:'count', packs:[
      { n:'half dozen', base:6 }, { n:'dozen', base:12 }, { n:'18-pack', base:18 } ] },

    { m:/\b(bread|loaf|loaves|tortillas?|buns?|bagels?)\b/, kind:'count', packs:[
      { n:'loaf', base:1 } ] },

    { m:/\b(salt|pepper|spice|cumin|paprika|oregano|thyme|cinnamon|garlic powder)\b/,
      kind:'any', packs:[ { n:'jar', base:Infinity } ] },

    /* the honest default for produce: you buy the thing, not a weight */
    { m:/\b(onions?|garlic|lemons?|limes?|apples?|bananas?|avocados?|peppers?|potatoes?|tomatoes?|carrots?)\b/,
      kind:'count', packs:[ { n:'', base:1 } ] }
  ];

  /* Generic fallbacks when nothing matches by name. */
  const GENERIC = {
    volume: [ { n:'pint', base:473 }, { n:'quart', base:946 },
              { n:'half gallon', base:1893 }, { n:'gallon', base:3785 } ],
    weight: [ { n:'lb', base:454 }, { n:'2 lb', base:907 }, { n:'5 lb', base:2268 } ],
    count:  [ { n:'', base:1 } ]
  };

  const tidy = n => {
    const r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r);
  };

  /* Turn a need into a shelf quantity. */
  function toPurchase(name, qty, unit){
    const m = measure(qty, unit);
    if(!m.base) return null;

    const rule = SHELF.find(r => r.m.test(norm(name)));

    /* seasonings: you buy a jar and stop thinking about it */
    if(rule && rule.kind === 'any') return { label:'1 jar', note:'have some in' };

    /* Flour by the cup is a volume; flour is sold by weight. Rather than invent a
       density, leave it as the recipe stated it — a wrong conversion is worse than
       no conversion. */
    if(rule && rule.kind !== m.kind) return null;

    /* Nothing recognised the name, so there is no shelf size to be confident about.
       Guessing "a gallon of mystery thing" helps nobody. */
    if(!rule) return null;

    const packs = rule.packs;
    if(!packs) return null;

    /* counts with no pack size are just the number of things */
    if(m.kind === 'count' && packs.length === 1 && packs[0].base === 1){
      const n = Math.ceil(m.base);
      return { label: `${n}`, note:null };
    }

    /* the smallest single pack that covers it */
    const single = packs.find(p => p.base >= m.base);
    if(single) return { label: label(1, single.n), note:null };

    /* nothing covers it on its own — multiples of the biggest */
    const big = packs[packs.length - 1];
    const n = Math.ceil(m.base / big.base);
    return { label: label(n, big.n), note:null };
  }

  function label(n, unitName){
    if(!unitName) return String(n);
    if(n === 1) return `1 ${unitName}`;
    /* "2 gallon" reads wrong; "2 gallons" does not */
    const plural = /s$|dozen|lb$/.test(unitName) ? unitName
                 : /(x|ch|sh)$/.test(unitName) ? unitName + 'es'
                 : unitName + 's';
    return `${n} ${plural}`;
  }

  /* What the recipe asked for, for the line underneath. */
  function recipeAmount(qty, unit){
    const q = +qty || 0;
    if(!q) return '';
    return `${tidy(q)}${unit ? ' ' + unit : ''}`;
  }

  /* The display pair for one grocery line. */
  function line(item){
    const buy = toPurchase(item.name, item.qty, item.unit);
    const recipe = recipeAmount(item.qty, item.unit);
    return {
      buy: buy ? buy.label : recipe,      /* if we cannot convert, show the raw figure */
      note: buy && buy.note ? buy.note : null,
      recipe,
      converted: !!buy && buy.label !== recipe
    };
  }

  /* The only units anyone should be able to enter. Typing them by hand invites
     'tbs', 'Tbsp', 'tablespoons' and three more spellings, none of which convert. */
  const UNITS = [
    { g:'Count',  list:[
      { v:'',      n:'(just a number)' },
      { v:'pcs',   n:'pieces' },
      { v:'clove', n:'cloves' },
      { v:'slice', n:'slices' },
      { v:'can',   n:'cans' },
      { v:'pack',  n:'packs' },
      { v:'bunch', n:'bunches' }
    ]},
    { g:'Volume', list:[
      { v:'tsp',   n:'teaspoons' },
      { v:'tbsp',  n:'tablespoons' },
      { v:'fl oz', n:'fluid ounces' },
      { v:'cup',   n:'cups' },
      { v:'pint',  n:'pints' },
      { v:'quart', n:'quarts' },
      { v:'gallon',n:'gallons' },
      { v:'ml',    n:'millilitres' },
      { v:'l',     n:'litres' }
    ]},
    { g:'Weight', list:[
      { v:'g',  n:'grams' },
      { v:'kg', n:'kilograms' },
      { v:'oz', n:'ounces' },
      { v:'lb', n:'pounds' }
    ]}
  ];

  const ALL_UNITS = UNITS.flatMap(g => g.list);

  /* What a cupboard actually holds. A recipe wants 300 grams; a shelf holds two
     bags. Counting stock in recipe units is how inventories get abandoned. */
  const STOCK_UNITS = [
    { g:'Packaging', list:[
      { v:'',          n:'(just a number)' },
      { v:'bag',       n:'bags' },
      { v:'box',       n:'boxes' },
      { v:'can',       n:'cans' },
      { v:'jar',       n:'jars' },
      { v:'bottle',    n:'bottles' },
      { v:'carton',    n:'cartons' },
      { v:'tub',       n:'tubs' },
      { v:'pack',      n:'packs' },
      { v:'container', n:'containers' },
      { v:'block',     n:'blocks' },
      { v:'loaf',      n:'loaves' },
      { v:'stick',     n:'sticks' }
    ]},
    { g:'Loose', list:[
      { v:'pcs',   n:'pieces' },
      { v:'bunch', n:'bunches' },
      { v:'clove', n:'cloves' },
      { v:'slice', n:'slices' },
      { v:'dozen', n:'dozen' }
    ]},
    { g:'By size', list:[
      { v:'gallon',    n:'gallons' },
      { v:'half gal',  n:'half gallons' },
      { v:'quart',     n:'quarts' },
      { v:'pint',      n:'pints' },
      { v:'lb',        n:'pounds' },
      { v:'kg',        n:'kilograms' }
    ]}
  ];

  const ALL_STOCK = STOCK_UNITS.flatMap(g => g.list);

  /* A <select> of units, with whatever is already set chosen.
     `which` picks the vocabulary: recipe measures, or what a shelf holds. */
  function unitSelect(attrs, selected, which){
    const groups = which === 'stock' ? STOCK_UNITS : UNITS;
    const cur = norm(selected);
    const known = groups.flatMap(g => g.list).some(u => norm(u.v) === cur);
    return `<select ${attrs || ''}>
      ${groups.map(g => `<optgroup label="${g.g}">
        ${g.list.map(u => `<option value="${u.v}"${
          norm(u.v) === cur ? ' selected' : ''}>${u.n}${u.v ? ` (${u.v})` : ''}</option>`).join('')}
      </optgroup>`).join('')}
      ${!known && cur ? `<optgroup label="Already set">
        <option value="${selected}" selected>${selected}</option></optgroup>` : ''}
    </select>`;
  }

  /* Stock units answer to their own list first. */
  function normaliseStock(unit){
    const u = norm(unit);
    if(!u) return '';
    const exact = ALL_STOCK.find(x => norm(x.v) === u);
    if(exact) return exact.v;
    const singular = u.replace(/e?s$/, '');
    const near = ALL_STOCK.find(x => norm(x.v) === singular);
    if(near) return near.v;
    const named = ALL_STOCK.find(x => norm(x.n) === u || norm(x.n) === u + 's');
    if(named) return named.v;
    return normalise(unit);          /* fall back to the recipe vocabulary */
  }

  /* Anything already stored as free text, mapped onto the closest real unit.
     Matched within its own family — a pound must never come back as a gram. */
  function normalise(unit){
    const u = norm(unit);
    if(!u) return '';

    const exact = ALL_UNITS.find(x => norm(x.v) === u);
    if(exact) return exact.v;

    if(VOLUME[u] !== undefined){
      const hit = ALL_UNITS.find(x => VOLUME[norm(x.v)] === VOLUME[u]);
      return hit ? hit.v : '';
    }
    if(WEIGHT[u] !== undefined){
      const hit = ALL_UNITS.find(x => WEIGHT[norm(x.v)] === WEIGHT[u]);
      return hit ? hit.v : '';
    }

    /* plain plurals, and the spelled-out names shown in the picker */
    const singular = u.replace(/e?s$/, '');
    const near = ALL_UNITS.find(x => norm(x.v) === singular);
    if(near) return near.v;
    const named = ALL_UNITS.find(x => norm(x.n) === u || norm(x.n) === u + 's');
    return named ? named.v : '';
  }

  global.Shopping = { line, toPurchase, recipeAmount, measure, SHELF,
                      UNITS, ALL_UNITS, STOCK_UNITS, ALL_STOCK,
                      unitSelect, normalise, normaliseStock };
})(window);
