/* Import and export, one place, one shape per dataset.

   Exporting an empty dataset still gives the full column list and a worked
   example, so the export is the template you fill in. */
(function(){

  async function mount(el, params){
    let counts = {};

    async function load(){
      counts = {};
      for(const d of Datasets.DATASETS){
        try { counts[d.id] = await d.count(); } catch(e){ counts[d.id] = 0; }
      }
    }

    function render(){
      el.innerHTML = Screens.bar({ kicker:'Settings', title:'Import and export',
        actions:`<button class="btn-sm accent" data-a="all">Export all</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">
          Every sheet exports with its full column list and one example row, even when empty —
          so an export is also the template. The example row starts with a # and is skipped
          when you bring it back.</p>

        ${Datasets.DATASETS.map(d => `
          <div class="ds-row">
            <div class="dh-row-head">
              <b>${d.n}</b>
              <span class="n">${counts[d.id] || 0}</span>
            </div>
            <p>${d.d}</p>
            <div class="ds-cols">${d.cols.join(', ')}</div>
            ${d.help ? `<p style="font-size:12.5px;color:var(--dim)">${d.help}</p>` : ''}
            <div class="ds-acts">
              <button data-tpl="${d.id}">Template</button>
              <button data-exp="${d.id}">Export</button>
              <button class="imp" data-imp="${d.id}">Import</button>
            </div>
          </div>`).join('')}

        <p class="note">Pictures travel as links. A sheet cannot carry an image, so any
          <code>_url</code> column is stored as a link — the app shows it straight away and you can
          swap in a local file later.</p>
      </div>`;
    }

    async function exportOne(id, templateOnly){
      const d = Datasets.byId(id);
      let csv = await Datasets.toCSV(id);
      if(templateOnly){
        /* header and example only, so a fresh sheet is not full of existing rows */
        csv = csv.split('\n').slice(0, 2).join('\n');
      }
      const name = `creator-studio-${id}${templateOnly ? '-template' : ''}.csv`;
      await Saver.save(name, csv, 'text/csv;charset=utf-8', d.n);
    }

    async function exportAll(){
      /* This used to stack every sheet into one file with banners between them.
         It read fine and imported nowhere — a CSV has one header row, and
         Notion or Sheets sees the second one as data. So: one file per sheet,
         and only the ones with something in them, which is usually three or
         four rather than a dozen. */
      const wanted = [];
      for(const d of Datasets.DATASETS){
        let n = 0;
        try { n = await d.count(); } catch(e){ n = 0; }
        if(n > 0) wanted.push({ d, n });
      }

      if(!wanted.length) return U.toast('Nothing to export yet');

      App.sheet(`
        <h2 style="margin:0 0 3px">Export everything</h2>
        <p class="hintline" style="margin:0 0 14px">One file per sheet, so each one
          opens straight into Notion or Sheets. ${wanted.length} file${
          wanted.length === 1 ? '' : 's'}, one share sheet each.</p>
        <div class="group compact" style="margin:0 0 14px;max-height:44vh;overflow-y:auto">
          ${wanted.map(({ d, n }) => `<div class="row" style="cursor:default">
            <span class="lbl">${d.n}<small>${n} row${n === 1 ? '' : 's'}</small></span>
          </div>`).join('')}
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-go>Export ${wanted.length}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-go]')) return;
          App.closeSheet();

          for(const { d } of wanted){
            const csv = await Datasets.toCSV(d.id);
            await Saver.save(`creator-studio-${d.id}.csv`, csv,
              'text/csv;charset=utf-8', d.n);
          }
          U.toast(`${wanted.length} file${wanted.length === 1 ? '' : 's'} exported`);
        });
      });
    }

    function importOne(id){
      const d = Datasets.byId(id);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.addEventListener('change', async () => {
        const file = (input.files || [])[0];
        input.remove();
        if(!file) return;
        try {
          const text = await file.text();
          const rows = Transfer.toObjects(text);
          if(!rows.length) return U.toast('Nothing in that file');

          /* warn about columns we do not know, rather than silently dropping them */
          const seen = Object.keys(rows[0] || {});
          const unknown = seen.filter(k => !d.cols.includes(k));

          App.sheet(`
            <h2>Import ${d.n}</h2>
            <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.6">
              ${rows.length} row${rows.length === 1 ? '' : 's'} found.
              Rows starting with # are skipped.</p>
            ${unknown.length ? `<p style="margin:0 0 14px;padding:11px 12px;border-radius:var(--r);
              background:rgba(232,163,61,.1);border:1px solid rgba(232,163,61,.35);
              font-size:13.5px;color:var(--amber);line-height:1.5">
              Columns this sheet does not use: ${unknown.join(', ')}</p>` : ''}
            <p style="margin:0 0 16px;font-size:13.5px;color:var(--dim);line-height:1.5">
              Importing adds to what is already there — it never replaces it.</p>
            <div class="sheetcta">
              <button class="btn-primary" data-go>Import them</button>
              <button class="btn-ghost" data-cancel>Cancel</button>
            </div>`, sheetEl => {
            sheetEl.addEventListener('click', async e => {
              if(e.target.closest('[data-cancel]')) return App.closeSheet();
              if(!e.target.closest('[data-go]')) return;
              try {
                const n = await d.load(rows);
                App.closeSheet();
                U.toast(`${n} ${d.n.toLowerCase()} imported`);
                await load(); render();
                params && params.onChange && params.onChange();
              } catch(err){
                console.error(err);
                App.closeSheet();
                U.toast('That import failed — check the columns');
              }
            });
          });
        } catch(e){
          console.error(e);
          U.toast('Could not read that file');
        }
      });
      input.click();
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'all') return exportAll();

      const tpl = e.target.closest('[data-tpl]');
      if(tpl) return exportOne(tpl.dataset.tpl, true);

      const exp = e.target.closest('[data-exp]');
      if(exp) return exportOne(exp.dataset.exp, false);

      const imp = e.target.closest('[data-imp]');
      if(imp) return importOne(imp.dataset.imp);
    });

    await load();
    render();
  }

  Screens.register('data-hub', mount);
})();
