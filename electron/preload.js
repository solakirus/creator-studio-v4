/* The Capacitor-shaped bridge for the Windows app.

   The web layer looks for window.Capacitor.Plugins.<Name> and falls back
   gracefully when one is missing. Rather than teach eleven files about
   Electron, this offers the same names and call shapes Capacitor does, backed
   by main.js. Only these exist on Windows:

     App               deep links (cs4://), launch URL
     CapacitorHttp     requests without cross-site limits
     Filesystem/Share  write a file, then Save As
     LocalNotifications reminders while the app is open

   Not offered, on purpose: CSWidget, LiveStatus, SendIntent, Geolocation,
   BackgroundGeolocation. The app already hides or skips what needs them. */
const { contextBridge, ipcRenderer } = require('electron');

const listeners = { appUrlOpen: new Set(), backButton: new Set() };
ipcRenderer.on('cs3:link', (e, url) => listeners.appUrlOpen.forEach(cb => { try { cb({ url }); } catch (err) {} }));

const handle = (set, cb) => Promise.resolve({ remove: () => { set.delete(cb); return Promise.resolve(); } });

const App = {
  addListener(event, cb) {
    const set = listeners[event];
    if (!set || typeof cb !== 'function') return handle(new Set(), cb);
    set.add(cb);
    return handle(set, cb);
  },
  removeAllListeners() { Object.values(listeners).forEach(s => s.clear()); return Promise.resolve(); },
  getLaunchUrl: async () => { const url = await ipcRenderer.invoke('cs3:launch-url'); return url ? { url } : undefined; },
  exitApp: () => ipcRenderer.send('cs3:quit'),
  getInfo: async () => ({ name: 'Creator Studio v4', id: 'com.solakirus.creatorstudio4' })
};

const CapacitorHttp = {
  request: o => ipcRenderer.invoke('cs3:http', o),
  get: o => ipcRenderer.invoke('cs3:http', Object.assign({}, o, { method: 'GET' })),
  post: o => ipcRenderer.invoke('cs3:http', Object.assign({}, o, { method: 'POST' }))
};

const Filesystem = {
  writeFile: o => ipcRenderer.invoke('cs3:fs-write', {
    path: o.path, data: o.data, directory: o.directory, encoding: o.encoding }),
  /* enough for the backup sweep to keep the last few files and drop the rest */
  stat: o => ipcRenderer.invoke('cs3:fs-stat', { path: o.path, directory: o.directory }),
  readdir: o => ipcRenderer.invoke('cs3:fs-readdir', { path: o.path, directory: o.directory }),
  deleteFile: o => ipcRenderer.invoke('cs3:fs-delete', { path: o.path, directory: o.directory })
};

const Share = {
  share: o => ipcRenderer.invoke('cs3:share', { files: o.files, title: o.title, dialogTitle: o.dialogTitle }),
  canShare: async () => ({ value: true })
};

const granted = async () => ({ display: 'granted' });
const LocalNotifications = {
  checkPermissions: granted,
  requestPermissions: granted,
  schedule: o => ipcRenderer.invoke('cs3:notif-schedule', (o && o.notifications) || []),
  getPending: () => ipcRenderer.invoke('cs3:notif-pending'),
  cancel: o => ipcRenderer.invoke('cs3:notif-cancel', ((o && o.notifications) || []).map(n => n.id)),
  addListener: (event, cb) => handle(new Set(), cb)
};

/* The Library's laptop half (electron/library.js): folders on disk, Shot
   Library's grabber, and Shotline's own templates and boards. The phone has
   none of this, and the Library checks for window.CS3Lib before using it. */
const grabListeners = { line: new Set(), link: new Set(), done: new Set() };
ipcRenderer.on('cs3:grab-line', (e, v) => grabListeners.line.forEach(cb => { try { cb(v); } catch (err) {} }));
ipcRenderer.on('cs3:grab-link', (e, v) => grabListeners.link.forEach(cb => { try { cb(v); } catch (err) {} }));
ipcRenderer.on('cs3:grab-done', (e, v) => grabListeners.done.forEach(cb => { try { cb(v); } catch (err) {} }));
contextBridge.exposeInMainWorld('CS3Lib', {
  home: () => ipcRenderer.invoke('cs3:lib-home'),
  scan: roots => ipcRenderer.invoke('cs3:lib-scan', roots || []),
  pickFolder: () => ipcRenderer.invoke('cs3:lib-pick-folder'),
  open: target => ipcRenderer.invoke('cs3:lib-open', target),
  trash: list => ipcRenderer.invoke('cs3:lib-trash', list || []),
  boardFolder: o => ipcRenderer.invoke('cs3:lib-board-folder', o),
  shotline: () => ipcRenderer.invoke('cs3:lib-shotline'),
  grabFind: setting => ipcRenderer.invoke('cs3:grab-find', setting || ''),
  grabRun: o => ipcRenderer.invoke('cs3:grab-run', o),
  grabStop: () => ipcRenderer.invoke('cs3:grab-stop'),
  onGrab: (kind, cb) => { const s = grabListeners[kind]; if (s && typeof cb === 'function') { s.add(cb); return () => s.delete(cb); } return () => {}; }
});

/* Self-update: main.js downloads new web files from GitHub Pages and uses
   them from the next launch. The page says when it has started properly. */
const updateListeners = new Set();
ipcRenderer.on('cs3:update-ready', (e, build) => updateListeners.forEach(cb => { try { cb(build); } catch (err) {} }));
contextBridge.exposeInMainWorld('CS3Update', {
  ok: () => ipcRenderer.send('cs3:web-ok'),
  check: () => ipcRenderer.invoke('cs3:web-check'),
  info: () => ipcRenderer.invoke('cs3:web-info'),
  onReady: cb => { if (typeof cb === 'function') updateListeners.add(cb); }
});

contextBridge.exposeInMainWorld('Capacitor', {
  isNativePlatform: () => true,
  getPlatform: () => 'electron',
  isPluginAvailable: name => ['App', 'CapacitorHttp', 'Filesystem', 'Share', 'LocalNotifications'].includes(name),
  CapacitorHttp,
  Plugins: { App, CapacitorHttp, Filesystem, Share, LocalNotifications }
});
