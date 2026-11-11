/* Push/pop stack for screens that sit above the tab shell. */
(function(global){
  const registry = {};
  const stack = [];
  const listeners = [];

  function register(id, mount){ registry[id] = mount; }

  /* Who is on top, and a way to be told when that changes. The tab bar needs
     this: without it, backing out of a pushed screen left its tab lit. */
  const topId = () => stack.length ? stack[stack.length - 1].id : null;
  function onChange(fn){ if(typeof fn === 'function') listeners.push(fn); }
  function announce(){
    listeners.forEach(fn => { try { fn(topId()); } catch(e){ console.warn('Screen listener failed', e); } });
  }

  function push(id, params){
    /* a selection bar belongs to the list that opened it, not to the app */
    if(global.Select) Select.reset();
    const mount = registry[id];
    if(!mount) return U.toast(id + ' — not built yet');

    const host = document.getElementById('screens');
    const el = document.createElement('section');
    el.className = 'screen';
    el.dataset.screen = id;
    host.appendChild(el);

    const prev = stack[stack.length - 1];
    stack.push({ id, el, params: params || {} });

    mount(el, params || {});
    announce();
    requestAnimationFrame(() => {
      el.classList.add('in');
      if(prev) prev.el.classList.add('under');
    });
    return el;
  }

  function pop(){
    if(global.Select) Select.reset();
    const top = stack.pop();
    if(!top) return false;
    const prev = stack[stack.length - 1];
    if(prev) prev.el.classList.remove('under');
    top.el.classList.remove('in');
    setTimeout(() => top.el.remove(), 280);
    announce();
    return true;
  }

  /* Re-run whatever is on top, in place. Backing out of a screen that changed
     something used to leave the screen underneath showing what it had drawn
     before — the tab views get re-mounted by the shell, but a pushed screen
     under another pushed screen had nothing watching it. */
  function refreshTop(){
    const top = stack[stack.length - 1];
    if(!top) return false;
    const mount = registry[top.id];
    if(!mount) return false;
    top.el.innerHTML = '';
    mount(top.el, top.params || {});
    return true;
  }

  function replace(id, params){ pop(); setTimeout(() => push(id, params), 10); }
  const depth = () => stack.length;

  /* A screen header, since every pushed screen needs the same one. */
  function bar(opts){
    const o = opts || {};
    return `<header class="screenbar">
      <button class="back" data-pop aria-label="Back">${U.ICON.chevL}</button>
      <div class="mid">${o.kicker ? `<p class="kick">${o.kicker}</p>` : ''}<h1>${o.title || ''}</h1></div>
      ${o.actions ? `<div class="acts">${o.actions}</div>` : ''}
    </header>`;
  }

  document.addEventListener('click', e => {
    if(e.target.closest('[data-pop]')) pop();
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && depth()) pop();
  });

  /* Run a registered screen inside an element that is not a pushed screen —
     used by consoles that host two screens under one nav. */
  function mountInto(id, host, params){
    const mount = registry[id];
    if(!mount || !host) return false;
    host.innerHTML = '';
    mount(host, params || {});
    return true;
  }

  global.Screens = { register, push, pop, replace, depth, bar, mountInto, topId, onChange, refreshTop };
})(window);
