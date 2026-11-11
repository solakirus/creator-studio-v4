/* Weight units. Stored in kg internally so history stays consistent when you
   switch; converted for display and input. */
(function(global){
  const KG_PER_LB = 0.45359237;
  let unit = null;

  async function get(){
    if(unit === null) unit = (await Store.get('settings','units')) || 'lb';
    return unit;
  }
  async function set(u){
    unit = (u === 'kg') ? 'kg' : 'lb';
    await Store.put('settings', unit, 'units');
    return unit;
  }

  const toDisplay = (kg, u) => u === 'kg' ? kg : kg / KG_PER_LB;
  const toKg = (val, u) => u === 'kg' ? val : val * KG_PER_LB;

  /* plates come in different sizes, so the step differs by unit */
  const step = u => u === 'kg' ? 2.5 : 5;
  const round = (v, u) => {
    const s = step(u);
    return Math.round(v / s) * s;
  };
  const label = u => u === 'kg' ? 'KG' : 'LB';
  const fmt = (kg, u) => {
    const v = round(toDisplay(kg, u), u);
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  };

  global.Units = { get, set, toDisplay, toKg, step, round, label, fmt, KG_PER_LB };
})(window);
