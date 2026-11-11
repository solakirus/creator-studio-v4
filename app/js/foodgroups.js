/* What kind of food a thing is.

   Used to group the pantry into sections you can actually scan, and to walk an
   inventory one group at a time rather than one long undifferentiated list. */
(function(global){

  const GROUPS = [
    { id:'produce', n:'Fruit & veg',  c:'#5BBE6A',
      m:/\b(apple|banana|orange|lemon|lime|berry|berries|strawberr|blueberr|grape|melon|mango|peach|pear|pineapple|avocado|tomato|potato|onion|garlic|carrot|celery|lettuce|spinach|kale|broccoli|cauliflower|bell pepper|red pepper|green pepper|peppers|cucumber|zucchini|squash|mushroom|corn|bean sprout|cabbage|ginger|herb|cilantro|parsley|basil|scallion|green onion)/ },

    { id:'meat', n:'Meat & fish', c:'#E2564A',
      m:/\b(chicken|beef|steak|mince|ground|pork|bacon|sausage|ham|turkey|lamb|salmon|tuna|shrimp|prawn|fish|cod|tilapia|thigh|breast|wing|rib)/ },

    { id:'dairy', n:'Dairy & eggs', c:'#F0C24A',
      m:/\b(milk|cream|butter|cheese|cheddar|mozzarella|parmesan|yogh?urt|egg|sour cream|cottage)/ },

    { id:'grain', n:'Grains & bread', c:'#C18A2E',
      m:/\b(bread|loaf|loaves|rice|pasta|spaghetti|noodle|flour|oat|cereal|tortilla|bagel|bun|cracker|quinoa|couscous|barley)/ },

    { id:'pantry', n:'Tins & staples', c:'#9AA3AD',
      m:/\b(oil|vinegar|stock|broth|tin|can|canned|sauce|paste|beans|lentil|chickpea|peanut butter|jam|honey|syrup|coconut milk|tomato paste)/ },

    { id:'spice', n:'Spices & seasoning', c:'#A855F7',
      m:/\b(salt|black pepper|peppercorn|white pepper|spice|cumin|paprika|oregano|thyme|rosemary|cinnamon|nutmeg|chilli|chili|curry|turmeric|bay leaf|seasoning|powder|extract|vanilla)/ },

    { id:'sweet', n:'Sweets & baking', c:'#E1477E',
      m:/\b(sugar|chocolate|cocoa|candy|sweet|biscuit|cookie|cake|baking powder|baking soda|yeast|icing|marshmallow)/ },

    { id:'frozen', n:'Frozen', c:'#3B9EFF',
      m:/\b(frozen|ice cream|popsicle)/ },

    { id:'drink', n:'Drinks', c:'#22C7B8',
      m:/\b(juice|soda|coffee|tea|water|beer|wine|drink)/ },

    { id:'other', n:'Everything else', c:'#7A7268', m:null }
  ];

  const byId = Object.fromEntries(GROUPS.map(g => [g.id, g]));

  /* Best guess from the name, checked in an order that avoids the obvious traps:
     frozen peas are frozen, not produce; orange juice is a drink, not an orange;
     black pepper is a spice, not a vegetable. */
  const FIRST = ['frozen', 'drink', 'spice'];

  function guess(name){
    const n = String(name || '').toLowerCase();
    for(const id of FIRST){
      const g = byId[id];
      if(g && g.m && g.m.test(n)) return id;
    }
    const hit = GROUPS.find(g => g.m && !FIRST.includes(g.id) && g.m.test(n));
    return hit ? hit.id : 'other';
  }

  /* Whatever the item says, or a guess if it has never been told. */
  const of = item => (item && item.group) || guess(item && item.name);

  const label = id => (byId[id] || byId.other).n;
  const colour = id => (byId[id] || byId.other).c;

  /* Split a list into groups, in the order above, dropping empty ones. */
  function bucket(items){
    const out = {};
    items.forEach(i => { const g = of(i); (out[g] = out[g] || []).push(i); });
    return GROUPS
      .filter(g => out[g.id] && out[g.id].length)
      .map(g => ({ ...g, items: out[g.id].sort((a,b) => a.name.localeCompare(b.name)) }));
  }

  global.FoodGroups = { GROUPS, guess, of, label, colour, bucket, byId };
})(window);
