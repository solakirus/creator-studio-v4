/* Service worker — what makes this installable and usable with no signal.

   The danger with these is the opposite of the one people expect: not failing
   to cache, but caching so well that a device is stranded on an old version
   forever. So:

     - BUILD is stamped by scripts/build-sw.js at deploy time, and the cache is
       named after it. A new deploy is a new cache; every older one is deleted
       on activate, so nothing accumulates and nothing old survives.
     - FILES is generated from what is actually on disk, so it can never drift
       out of step with index.html the way a hand-kept list would.
     - The page itself is network-first. If the network answers, you get the
       current app; the cache is only the fallback. Scripts and fonts are
       cache-first, because they are fetched dozens at a time and only change
       when BUILD does.

   The database is untouched by any of this. IndexedDB is not part of the cache
   and a service worker update never clears it. */

const BUILD = '7e902cb190ae';
const CACHE = 'cs4-' + BUILD;
const FILES = [
  "./index.html",
  "./board/board.html",
  "./board/fonts/bebas-neue-400.woff2",
  "./board/fonts/board-fonts.css",
  "./board/fonts/caveat-500.woff2",
  "./board/fonts/caveat-700.woff2",
  "./board/fonts/courier-prime-400.woff2",
  "./board/fonts/courier-prime-700.woff2",
  "./board/fonts/inter-400.woff2",
  "./board/fonts/inter-500.woff2",
  "./board/fonts/inter-600.woff2",
  "./board/fonts/inter-700.woff2",
  "./board/fonts/permanent-marker-400.woff2",
  "./board/fonts/playfair-display-600.woff2",
  "./board/fonts/playfair-display-700.woff2",
  "./board/fonts/source-serif-4-600.woff2",
  "./board/fonts/source-serif-4-700.woff2",
  "./fonts/dm-sans-latin-400-italic.woff2",
  "./fonts/dm-sans-latin-400-normal.woff2",
  "./fonts/dm-sans-latin-500-normal.woff2",
  "./fonts/dm-sans-latin-700-normal.woff2",
  "./fonts/fonts.css",
  "./fonts/nunito-latin-400-normal.woff2",
  "./fonts/nunito-latin-600-normal.woff2",
  "./fonts/nunito-latin-700-normal.woff2",
  "./fonts/quicksand-latin-500-normal.woff2",
  "./fonts/quicksand-latin-600-normal.woff2",
  "./fonts/quicksand-latin-700-normal.woff2",
  "./fonts/red-hat-display-latin-700-normal.woff2",
  "./fonts/red-hat-display-latin-800-normal.woff2",
  "./fonts/red-hat-display-latin-900-normal.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable.png",
  "./js/academy.js",
  "./js/app.js",
  "./js/aspectfix.js",
  "./js/avatars.js",
  "./js/awards.js",
  "./js/backup.js",
  "./js/boardlink.js",
  "./js/boardsync.js",
  "./js/celebrate.js",
  "./js/challenges.js",
  "./js/channels.js",
  "./js/clipcraft.js",
  "./js/clipflow.js",
  "./js/clipideas.js",
  "./js/cover.js",
  "./js/coverage.js",
  "./js/data.js",
  "./js/datasets.js",
  "./js/demoplay.js",
  "./js/embed.js",
  "./js/exercises.js",
  "./js/folders.js",
  "./js/foodgroups.js",
  "./js/frameget.js",
  "./js/habits.js",
  "./js/inkpad.js",
  "./js/levels.js",
  "./js/libview.js",
  "./js/lifecycle.js",
  "./js/linkmeta.js",
  "./js/loads.js",
  "./js/medialib.js",
  "./js/merge.js",
  "./js/metrics.js",
  "./js/months.js",
  "./js/multiselect.js",
  "./js/notebook.js",
  "./js/notes.js",
  "./js/notify.js",
  "./js/nutrition.js",
  "./js/pageseditor.js",
  "./js/palette.js",
  "./js/paper.js",
  "./js/phonelib.js",
  "./js/physique.js",
  "./js/pipeline.js",
  "./js/planimport.js",
  "./js/planpack.js",
  "./js/program.js",
  "./js/quarters.js",
  "./js/quickadd.js",
  "./js/rating.js",
  "./js/refs.js",
  "./js/reminders.js",
  "./js/research.js",
  "./js/routines.js",
  "./js/rungps.js",
  "./js/saver.js",
  "./js/scoreboard.js",
  "./js/screens.js",
  "./js/screens/academy-write.js",
  "./js/screens/academy.js",
  "./js/screens/avatars.js",
  "./js/screens/awards.js",
  "./js/screens/board.js",
  "./js/screens/calendar.js",
  "./js/screens/challenges.js",
  "./js/screens/channel.js",
  "./js/screens/channels-list.js",
  "./js/screens/clip-ideas.js",
  "./js/screens/clip.js",
  "./js/screens/clips-screen.js",
  "./js/screens/data-hub.js",
  "./js/screens/daysheet.js",
  "./js/screens/exercise-library.js",
  "./js/screens/exercise-picker.js",
  "./js/screens/exercise.js",
  "./js/screens/habits.js",
  "./js/screens/inbox.js",
  "./js/screens/ink-note.js",
  "./js/screens/inventory.js",
  "./js/screens/journal.js",
  "./js/screens/library.js",
  "./js/screens/loads.js",
  "./js/screens/meals.js",
  "./js/screens/months.js",
  "./js/screens/notes.js",
  "./js/screens/nutrition-home.js",
  "./js/screens/nutrition-plan.js",
  "./js/screens/nutrition-prep.js",
  "./js/screens/nutrition-shop.js",
  "./js/screens/paper-screen.js",
  "./js/screens/physique-compare.js",
  "./js/screens/physique.js",
  "./js/screens/planning.js",
  "./js/screens/profile.js",
  "./js/screens/program.js",
  "./js/screens/quarter.js",
  "./js/screens/rating.js",
  "./js/screens/reference.js",
  "./js/screens/research.js",
  "./js/screens/routines.js",
  "./js/screens/run-live.js",
  "./js/screens/runs.js",
  "./js/screens/seq-templates.js",
  "./js/screens/series-view.js",
  "./js/screens/session-view.js",
  "./js/screens/session.js",
  "./js/screens/settings.js",
  "./js/screens/shoot-run.js",
  "./js/screens/shot-list.js",
  "./js/screens/shot-templates.js",
  "./js/screens/shots-console.js",
  "./js/screens/starred.js",
  "./js/screens/streak.js",
  "./js/screens/swipe-sort.js",
  "./js/screens/swipe.js",
  "./js/screens/task.js",
  "./js/screens/video-page.js",
  "./js/screens/vlog-day.js",
  "./js/screens/vlog.js",
  "./js/screens/week-board.js",
  "./js/screens/workout-gallery.js",
  "./js/screens/workout.js",
  "./js/sectionart.js",
  "./js/seqlib.js",
  "./js/share.js",
  "./js/shopping.js",
  "./js/shortcuts.js",
  "./js/shotai.js",
  "./js/shotids.js",
  "./js/shotlib.js",
  "./js/shotlist.js",
  "./js/shots.js",
  "./js/shottemplates.js",
  "./js/stillspicker.js",
  "./js/store.js",
  "./js/story.js",
  "./js/storyboard.js",
  "./js/structures.js",
  "./js/swipecards.js",
  "./js/swipeimport.js",
  "./js/swipekey.js",
  "./js/swiperefs.js",
  "./js/swipetags.js",
  "./js/sync.js",
  "./js/taskform.js",
  "./js/taskframes.js",
  "./js/tasklib.js",
  "./js/taskpages.js",
  "./js/thumb.js",
  "./js/timeline.js",
  "./js/transfer.js",
  "./js/units.js",
  "./js/updater.js",
  "./js/util.js",
  "./js/versions.js",
  "./js/videos.js",
  "./js/videosheet.js",
  "./js/viewas.js",
  "./js/views/clips.js",
  "./js/views/content.js",
  "./js/views/draft.js",
  "./js/views/month.js",
  "./js/views/series.js",
  "./js/views/today.js",
  "./js/views/weekly.js",
  "./js/vlogtasks.js",
  "./js/widget.js",
  "./js/workouttypes.js",
  "./library.css",
  "./manifest.webmanifest",
  "./paper.css",
  "./styles.css"
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* One at a time rather than addAll: addAll rejects the whole install if a
       single file 404s, which would leave the app with no offline copy at all
       and no clue which file was missing. */
    await Promise.all(FILES.map(async f => {
      try { await c.add(new Request(f, { cache: 'reload' })); }
      catch (err) { console.warn('[sw] could not cache', f, err && err.message); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('cs4-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isPage = req => req.mode === 'navigate' ||
  (req.destination === '' && req.headers.get('accept') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     /* never touch anything off-site */

  if (isPage(req)) {
    /* network first, so a deploy is picked up as soon as there is signal */
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const hit = await caches.match(req) || await caches.match('./index.html');
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  /* everything else: cache first, fall back to the network, and keep what the
     network gave so a file added after install is there next time */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type === 'basic') {
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone());
    }
    return fresh;
  })());
});

/* The page can ask for the running build, which Settings shows, so "am I on
   the current version?" is answerable without guessing. */
self.addEventListener('message', e => {
  if (e.data === 'build' && e.source) e.source.postMessage({ build: BUILD });
});
