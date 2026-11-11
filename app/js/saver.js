/* Getting a file out of the app.

   A Blob download works in a browser and does nothing at all in an Android
   WebView — no error, no file, just a tap that appears to work. So when the
   native plugins are there, write to disk and open the share sheet; otherwise
   fall back to the browser behaviour. */
(function(global){

  const plugins = () => (global.Capacitor && global.Capacitor.Plugins) || {};
  const native = () => {
    const p = plugins();
    return !!(p.Filesystem && p.Share);
  };

  /* Capacitor's Filesystem wants base64 for binary and takes text directly. */
  function blobToBase64(blob){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  function browserSave(name, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* Write the file, then hand it to the share sheet so it can go to Drive,
     email, a messaging app, or straight to Files. */
  async function save(name, data, mime, title){
    const blob = data instanceof Blob
      ? data
      : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });

    if(!native()){
      browserSave(name, blob);
      U.toast('Saved to your downloads');
      return 'browser';
    }

    const { Filesystem, Share } = plugins();
    try {
      const isText = typeof data === 'string';
      const written = await Filesystem.writeFile({
        path: name,
        data: isText ? data : await blobToBase64(blob),
        directory: 'CACHE',
        encoding: isText ? 'utf8' : undefined
      });

      await Share.share({
        title: title || name,
        files: [written.uri],
        dialogTitle: title || 'Save or send'
      });
      return 'shared';
    } catch(e){
      /* the user dismissing the share sheet is not a failure */
      if(e && /cancel/i.test(e.message || '')) return 'cancelled';
      console.warn('Native save failed, falling back', e);
      try { browserSave(name, blob); U.toast('Saved to your downloads'); return 'browser'; }
      catch(err){ console.error(err); U.toast('Could not save that file'); return false; }
    }
  }

  /* Same thing, but always writes rather than offering to share. */
  async function saveOnly(name, data, mime){
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    if(!native()){ browserSave(name, blob); U.toast('Saved to your downloads'); return 'browser'; }

    const { Filesystem } = plugins();
    try {
      const isText = typeof data === 'string';
      await Filesystem.writeFile({
        path: name,
        data: isText ? data : await blobToBase64(blob),
        directory: 'DOCUMENTS',
        encoding: isText ? 'utf8' : undefined,
        recursive: true
      });
      U.toast('Saved to Documents');
      return 'documents';
    } catch(e){
      console.warn('Write failed, falling back', e);
      browserSave(name, blob);
      return 'browser';
    }
  }

  global.Saver = { save, saveOnly, native, blobToBase64 };
})(window);
