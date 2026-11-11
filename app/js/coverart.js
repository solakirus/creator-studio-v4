/* Drawn cover art.

   Every course, chapter and section gets a composition built from its own id, so
   the same thing always looks the same and nothing has to ship as an image. The
   shapes are abstract on purpose — an illustration of "habits" would be worse
   than a pattern you learn to recognise. */
(function(global){

  /* A small deterministic generator: same seed, same picture, every time. */
  function rng(seed){
    let h = 2166136261;
    for(let i = 0; i < seed.length; i++){
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 10000) / 10000;
    };
  }

  const mix = (hex, pct, toward) => {
    const p = Math.max(0, Math.min(1, pct));
    const a = [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16));
    const b = toward === 'light' ? [255,255,255] : [10,8,6];
    return '#' + a.map((v,i) => Math.round(v + (b[i]-v)*p).toString(16).padStart(2,'0')).join('');
  };

  /* ---- the five compositions ---- */

  /* concentric arcs, like a signal or a ripple */
  function arcs(r, c, w, h){
    const cx = w * (0.2 + r() * 0.25), cy = h * (0.95 + r() * 0.2);
    let out = '';
    for(let i = 7; i >= 1; i--){
      const rad = (w * 0.16) * i;
      out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}"
        fill="none" stroke="${mix(c, 0.1 + i * 0.09, 'light')}"
        stroke-width="${(2 + r() * 2).toFixed(1)}" opacity="${(0.16 + i * 0.05).toFixed(2)}"/>`;
    }
    return out;
  }

  /* a rising stack, like progress or a city */
  function bars(r, c, w, h){
    let out = '';
    const n = 7 + Math.floor(r() * 4);
    const bw = w / n;
    for(let i = 0; i < n; i++){
      const bh = h * (0.18 + (i / n) * 0.62 + r() * 0.14);
      out += `<rect x="${(i * bw + bw * 0.16).toFixed(1)}" y="${(h - bh).toFixed(1)}"
        width="${(bw * 0.68).toFixed(1)}" height="${bh.toFixed(1)}" rx="3"
        fill="${mix(c, 0.12 + (i / n) * 0.5, 'light')}" opacity="${(0.24 + (i/n) * 0.4).toFixed(2)}"/>`;
    }
    return out;
  }

  /* overlapping ridges, like layers settling */
  function ridges(r, c, w, h){
    let out = '';
    for(let i = 0; i < 4; i++){
      const base = h * (0.44 + i * 0.16);
      const peak = base - h * (0.16 + r() * 0.2);
      const mid = w * (0.18 + r() * 0.62);
      out += `<path d="M0 ${h} L0 ${base.toFixed(0)} L${mid.toFixed(0)} ${peak.toFixed(0)}
        L${w} ${(base - h * 0.06).toFixed(0)} L${w} ${h} Z"
        fill="${mix(c, 0.55 - i * 0.13, 'dark')}" opacity="${(0.5 + i * 0.14).toFixed(2)}"/>`;
    }
    return out;
  }

  /* a loose grid with some cells lit — repetition, made visible */
  function grid(r, c, w, h){
    let out = '';
    const cols = 6, rows = 4;
    const cw = w / cols, ch = h / rows;
    for(let y = 0; y < rows; y++){
      for(let x = 0; x < cols; x++){
        const on = r() > 0.52;
        out += `<rect x="${(x * cw + cw * 0.14).toFixed(1)}" y="${(y * ch + ch * 0.14).toFixed(1)}"
          width="${(cw * 0.72).toFixed(1)}" height="${(ch * 0.72).toFixed(1)}" rx="3"
          fill="${on ? mix(c, 0.28, 'light') : 'none'}"
          stroke="${mix(c, 0.2, 'light')}" stroke-width="1.4"
          opacity="${on ? 0.55 : 0.2}"/>`;
      }
    }
    return out;
  }

  /* a path winding upward — the long way round */
  function path(r, c, w, h){
    const steps = 5;
    let d = `M${(w * 0.1).toFixed(0)} ${h}`;
    for(let i = 1; i <= steps; i++){
      const x = w * (0.1 + (i / steps) * 0.8);
      const y = h * (1 - (i / steps) * 0.78);
      const cxp = x - w * 0.16;
      d += ` Q${cxp.toFixed(0)} ${(y + h * 0.12).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}`;
    }
    let out = `<path d="${d}" fill="none" stroke="${mix(c, 0.45, 'light')}"
      stroke-width="3.5" opacity=".55" stroke-linecap="round"/>`;
    for(let i = 1; i <= steps; i++){
      const x = w * (0.1 + (i / steps) * 0.8);
      const y = h * (1 - (i / steps) * 0.78);
      out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(4 + r() * 3).toFixed(1)}"
        fill="${mix(c, 0.5, 'light')}" opacity=".8"/>`;
    }
    return out;
  }

  const SHAPES = [arcs, bars, ridges, grid, path];

  /* A full cover: gradient ground, one composition, a soft vignette. */
  function cover(seed, colour, w, h, shapeIndex){
    const r = rng(seed);
    const c = colour || '#FB6900';
    const pick = shapeIndex === undefined
      ? SHAPES[Math.floor(r() * SHAPES.length) % SHAPES.length]
      : SHAPES[shapeIndex % SHAPES.length];
    const W = w || 400, H = h || 220;
    const id = 'cv' + Math.abs(seed.split('').reduce((a,ch) => a + ch.charCodeAt(0), 0));

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${mix(c, 0.32, 'dark')}"/>
          <stop offset="1" stop-color="${mix(c, 0.68, 'dark')}"/>
        </linearGradient>
        <radialGradient id="${id}v" cx="0.5" cy="0.32" r="0.8">
          <stop offset="0" stop-color="#000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity=".42"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#${id})"/>
      ${pick(r, c, W, H)}
      <rect width="${W}" height="${H}" fill="url(#${id}v)"/>
    </svg>`;
  }

  global.CoverArt = { cover, rng, mix, SHAPES };
})(window);
