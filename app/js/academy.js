/* The Academy.

   Short courses on the things this app is actually for — forming habits,
   shipping work, and not falling apart in week three. Written to be read on a
   phone in five minutes, with one thing to try at the end of each chapter.

   Progress is stored per lesson, so a course can be picked up anywhere. */
(function(global){

  const COURSES = [
    {
      id:'habits',
      n:'Habit Formation Fundamentals',
      d:'How habits actually form, why willpower is the wrong tool, and what to build instead.',
      c:'#4B8A57',
      glyph:'M12 3a6 6 0 0 0-6 6c0 2 1 3 1 5v3h10v-3c0-2 1-3 1-5a6 6 0 0 0-6-6zM9 20h6',
      lessons:[
        {
          t:'You are not your willpower',
          min:5,
          body:[
            ['h','The two systems'],
            ['p',"Kahneman's split is useful here. System 1 is fast, automatic and cheap to run. System 2 is slow, deliberate and expensive. Trying to install a new behaviour using System 2 alone is like powering a house by pedalling a bike. It works for an afternoon. It collapses by week three."],
            ['p','The job is to move a behaviour down — from "I have to remember to do this" to "this is just what happens at seven." That migration is what habit formation actually is.'],
            ['try','The autopilot audit','24 hours',"Tomorrow, write down the first three things you do after waking. Change nothing, just notice. You are mapping the behaviours System 1 already runs without asking you."],
            ['p','When you stop trying to will yourself into a new self, and start designing the conditions under which the new self appears, the work gets easier. Not easy. Easier.']
          ],
          keys:[
            'Willpower is real but finite, and it is the worst tool for behaviour change.',
            'A large share of daily behaviour is habitual rather than chosen.',
            'The goal is to migrate behaviour from deliberate to automatic.'
          ]
        },
        {
          t:'Cue, craving, response, reward',
          min:6,
          body:[
            ['h','The loop'],
            ['p','Every habit runs the same circuit. A cue tells your brain a reward is available. A craving is the wanting that follows. The response is the behaviour. The reward is what you get. Break any link and the habit does not run.'],
            ['p','Most failed habits fail at the cue. People decide to do something "more often" without deciding when, where, or after what. An intention with no cue is a wish.'],
            ['try','Name your cue','10 minutes',"Take the one habit you most want. Finish this sentence with something specific: 'After I ____, I will ____.' The blank before the comma has to be something that already happens every day without fail."],
            ['p','Anchoring a new behaviour to an existing one borrows a cue that already works. You are not building a trigger from nothing; you are attaching to one that already fires.']
          ],
          keys:[
            'Habits run on cue, craving, response, reward.',
            'Most new habits die because no specific cue was chosen.',
            'Anchor new behaviour to something already automatic.'
          ]
        },
        {
          t:'Make it small enough to be stupid',
          min:4,
          body:[
            ['h','The two-minute version'],
            ['p','The version of the habit you can do on your worst day is the version that survives. Not the version you can do when rested, motivated and free. Your worst day is the one that decides whether the streak holds.'],
            ['p','Write the habit down, then halve it. Then halve it again. "Go to the gym" becomes "put on the shoes." That sounds like a trick, and it partly is — but the point is that showing up is the skill, and the volume comes later on its own.'],
            ['try','Set your floor','5 minutes',"For each habit you are building, define the smallest version that still counts. Write it down. On a bad day you do the floor and the day still counts as held."],
            ['p','A floor is not a low standard. It is the standard that keeps the identity intact when everything else goes wrong.']
          ],
          keys:[
            'Design for your worst day, not your best.',
            'Showing up consistently is a separate skill from doing a lot.',
            'A defined floor stops a bad day becoming a broken streak.'
          ]
        },
        {
          t:'Friction is the lever',
          min:5,
          body:[
            ['h','Seconds decide'],
            ['p','Behaviour is enormously sensitive to small amounts of effort. Twenty seconds of friction is often the entire difference between doing a thing and not. This works in both directions, which is what makes it the most useful lever you have.'],
            ['p','To do more of something, remove steps. Lay the gear out the night before. Keep the camera charged and on the desk rather than in a bag in a cupboard. To do less of something, add steps. Log out. Put the thing in another room.'],
            ['try','Cut one step','15 minutes',"Pick your most-avoided habit and remove exactly one step from the start of it. Just one. Notice whether the next attempt feels different."],
            ['p','You are not weak because you did not overcome the friction. The friction was designed, usually by someone selling you something. Design yours instead.']
          ],
          keys:[
            'Small amounts of friction have outsized effects on behaviour.',
            'Remove steps from what you want; add steps to what you do not.',
            'Environment beats intention most of the time.'
          ]
        },
        {
          t:'Never miss twice',
          min:4,
          body:[
            ['h','The rule that matters'],
            ['p','You will miss. Everyone misses. The research-backed finding worth internalising is that one missed day has almost no effect on habit formation. Two in a row is where the damage starts, because the second miss is where the identity shifts from "someone who does this" to "someone who used to."'],
            ['p','So the rule is simple. Miss once, fine. Never miss twice. That single rule does more for long-term consistency than any amount of motivation.'],
            ['try','Write the recovery plan','10 minutes',"Decide now, in advance, what you will do the day after a miss. Be specific about the floor version. Deciding this while calm means you do not have to decide it while disappointed."],
            ['p','Coming back the day after a break is the whole skill. It is worth more than a long run that has never been tested.']
          ],
          keys:[
            'One missed day barely matters; two in a row does.',
            'Recovery speed matters more than perfection.',
            'Plan the comeback before you need it.'
          ]
        },
        {
          t:'Identity does the heavy lifting',
          min:5,
          body:[
            ['h','Outcomes, process, identity'],
            ['p','Most people set goals about outcomes — the weight, the subscriber count, the revenue. Some get as far as the process. The layer underneath both is identity: the kind of person you believe you are.'],
            ['p','Behaviour that contradicts identity does not survive. Behaviour that confirms it feels natural. So the useful framing is not "I want to publish weekly" but "I am someone who ships." Every time you ship, you cast a vote for that.'],
            ['try','Cast three votes','3 days',"For three days, do the floor version of one habit and say — out loud or in writing — what it makes you. It feels ridiculous. Do it anyway; you are practising the sentence you want to believe."],
            ['p','The evidence accumulates. Eventually you stop having to convince yourself, because the record is sitting there.']
          ],
          keys:[
            'Identity sits underneath process and outcomes.',
            'Each repetition is evidence for the person you are becoming.',
            'Behaviour that contradicts identity rarely lasts.'
          ]
        },
        {
          t:'Tracking, and its traps',
          min:5,
          body:[
            ['h','Why measure at all'],
            ['p','Tracking works for three reasons. It makes the behaviour visible, it provides an immediate reward, and it produces a record you do not want to break. That third one is most of the power of a streak.'],
            ['p','The trap is measuring the wrong thing. A metric you can hit without doing the work becomes the work. If you track hours, you will find ways to spend hours. Track what you actually want: pieces shipped, sessions finished, days held.'],
            ['try','Audit one metric','10 minutes',"Take a number you currently track. Ask: could I improve this number without improving the underlying thing? If yes, change the metric."],
            ['p','And be careful about how much you enjoy the tracking. If the system becomes more fun than the work, you have built a very elaborate way to avoid the work.']
          ],
          keys:[
            'Tracking makes behaviour visible and rewarding.',
            'A bad metric becomes the work, replacing the work.',
            'Watch out for enjoying the system more than the output.'
          ]
        }
      ]
    },

    {
      id:'shipping',
      n:'Shipping Consistently',
      d:'Why creative work stalls, and the production habits that keep it moving.',
      c:'#C4613A',
      glyph:'M4 7h12l4 5v5H4zM7 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0',
      lessons:[
        {
          t:'Batch the setup, not the work',
          min:5,
          body:[
            ['h','The real cost'],
            ['p','The expensive part of making something is rarely the making. It is the setup: finding the gear, clearing the space, getting your head into it. That cost is roughly fixed whether you produce one piece or four.'],
            ['p','Which is why batching wins. If the lights are already up and the camera is already framed, the second and third pieces cost a fraction of the first. Filming three things on a Tuesday is not three times the work of filming one.'],
            ['try','Find your setup cost','1 shoot',"Next time you shoot, time two things separately: how long until you are rolling, and how long you actually roll. The ratio usually surprises people."],
            ['p','Schedule by the setup, not the output. Ask when the lights are already up rather than when you feel like making something.']
          ],
          keys:[
            'Setup cost is fixed; output is not.',
            'Batching amortises the expensive part.',
            'Plan around when conditions already exist.'
          ]
        },
        {
          t:'Publish on a slot, not on a feeling',
          min:4,
          body:[
            ['h','A commitment you can see'],
            ['p','Deciding to post "when it is ready" means posting when the discomfort of not posting exceeds the discomfort of posting. That threshold moves with your mood, which is why output from feeling-based schedules is so erratic.'],
            ['p','A slot is a commitment that exists whether or not you feel like it. Tuesday at six. The slot does not care how you feel, and that is the entire value of it.'],
            ['try','Claim two slots','10 minutes',"Pick two specific times each week for a specific channel. Write them down somewhere that will nag you. Two beats seven, because you will actually hold two."],
            ['p','An empty slot is information. It tells you the pipeline broke upstream, a week before the silence would otherwise have been visible.']
          ],
          keys:[
            'Feeling-based schedules produce erratic output.',
            'A slot is a commitment independent of mood.',
            'Empty slots surface pipeline problems early.'
          ]
        },
        {
          t:'Separate the maker from the editor',
          min:5,
          body:[
            ['h','Two incompatible jobs'],
            ['p','Making requires permission to be bad. Editing requires the opposite. Trying to do both at once is why people stare at a first line for forty minutes — one half is producing while the other half is rejecting in real time.'],
            ['p','Split them in time. Shoot everything, judge nothing. Edit on a different day, where the material is just material and your ego has had time to detach from it.'],
            ['try','A silent first pass','1 session',"On your next make session, ban yourself from reviewing anything until the end. No scrubbing back, no watching takes. Just capture."],
            ['p','You will shoot more and hate it less, and the edit will be faster because there is enough to choose from.']
          ],
          keys:[
            'Making and editing use opposite mindsets.',
            'Doing both at once stalls the work.',
            'Separate them by time, not by willpower.'
          ]
        },
        {
          t:'Finish ugly',
          min:4,
          body:[
            ['h','Done teaches, perfect does not'],
            ['p','An unpublished piece teaches you almost nothing. A published mediocre one teaches you what lands, what confuses people, and what you actually enjoy making. The feedback loop only closes on release.'],
            ['p','This is not an argument for low standards. It is an argument for where the standard gets applied — to the tenth piece rather than the first, informed by nine pieces of real information instead of nine months of guessing.'],
            ['try','Ship the one that scares you','This week',"Take the piece sitting at ninety percent and publish it as-is. Note what you assumed would matter, and whether it did."],
            ['p','Most things you agonise over are invisible to everyone else. The only reliable way to learn which is which is to release and watch.']
          ],
          keys:[
            'Unreleased work generates no information.',
            'Standards improve fastest when applied to real feedback.',
            'Most flaws you obsess over go unnoticed.'
          ]
        },
        {
          t:'Build the boring machine',
          min:5,
          body:[
            ['h','Systems outlive enthusiasm'],
            ['p','Enthusiasm is a starting fuel, not a running one. Everything you build that depends on feeling inspired will stop when the feeling does — which it will, usually around the point where it stops being novel.'],
            ['p','So write the process down. Where the files go. What gets shot first. Which day you edit. A documented process means a bad week costs you one week rather than the whole project, because you can restart without remembering how.'],
            ['try','Write your own checklist','20 minutes',"Document your last piece as a numbered list of steps. Then use it for the next one and fix what is wrong. You are building the thing that carries you through the unmotivated months."],
            ['p','The people who look prolific are rarely more inspired than you. They have usually just removed the decisions.']
          ],
          keys:[
            'Enthusiasm starts projects; systems finish them.',
            'A written process survives bad weeks.',
            'Prolific output usually means fewer decisions, not more inspiration.'
          ]
        }
      ]
    },

    {
      id:'procrastination',
      n:'Beating Procrastination',
      d:'It is not laziness. It is how we cope with difficult feelings — and there are better ways.',
      c:'#7B4FA8',
      glyph:'M12 3v9l5 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
      lessons:[
        {
          t:'It is an emotion problem',
          min:5,
          body:[
            ['h','Not a time problem'],
            ['p','Procrastination correlates poorly with laziness and strongly with mood. You avoid the task because approaching it produces an unpleasant feeling — boredom, anxiety, self-doubt, resentment — and avoidance relieves that feeling immediately.'],
            ['p','It is a functioning coping mechanism. That is precisely why it is so persistent: it works, in the short term, every single time.'],
            ['try','Name the feeling','5 minutes',"Next time you avoid something, stop and name what the task makes you feel. Not why you are avoiding it — what the feeling is. Naming it reliably reduces its grip."],
            ['p','Once you see it as mood repair rather than character failure, the useful question changes from "why am I so lazy" to "what about this feels bad, and can I make that smaller."']
          ],
          keys:[
            'Procrastination is mood regulation, not laziness.',
            'Avoidance works immediately, which is why it sticks.',
            'Naming the feeling reduces its power.'
          ]
        },
        {
          t:'Shrink the first move',
          min:4,
          body:[
            ['h','Starting is the whole problem'],
            ['p','Resistance is concentrated almost entirely at the start. Once you are three minutes in, the feeling that stopped you has usually gone. Which means the design problem is not "how do I do this task" but "how do I make the first move trivially small."'],
            ['p','Open the file. Write one bad sentence. Put the tripod up. The goal is to get the first domino down; you are allowed to stop immediately afterwards, and you usually will not want to.'],
            ['try','The two-minute start','Today',"Pick your most-avoided task and commit to two minutes. Set a timer. When it goes, you may stop with no guilt. Notice how often you carry on."],
            ['p','You are not tricking yourself. You are removing the part that was actually hard.']
          ],
          keys:[
            'Resistance peaks before starting, not during.',
            'Make the first action small enough to be trivial.',
            'Permission to stop makes starting easier.'
          ]
        },
        {
          t:'Vague tasks do not get done',
          min:4,
          body:[
            ['h','Ambiguity is friction'],
            ['p','"Work on the video" is not a task; it is a topic. Faced with it, you have to decide what it means before you can begin, and that decision costs energy at exactly the moment you have least of it.'],
            ['p','A real task names its first physical action. "Import the Tuesday footage and cut the intro." Now there is nothing to decide, only something to do.'],
            ['try','Rewrite your list','10 minutes',"Take today's list and rewrite anything vague so it names a physical first action. Count how many were actually topics."],
            ['p','Most lists are half topics. That is why they feel heavy and move slowly.']
          ],
          keys:[
            'Vague items force a decision before action.',
            'A good task names its first physical action.',
            'Ambiguity is a form of friction.'
          ]
        },
        {
          t:'The cost of switching',
          min:5,
          body:[
            ['h','You do not multitask'],
            ['p','What feels like multitasking is rapid switching, and each switch leaves a residue — part of your attention stays on the previous thing. The cost is largest for demanding work, which is exactly the work you most want to protect.'],
            ['p','A fragmented two hours produces noticeably less than an unbroken hour. This is not about discipline; it is about how attention reassembles after interruption.'],
            ['try','One unbroken block','This week',"Protect a single hour with the phone in another room. Not the whole day. One hour. Compare what comes out of it against a normal fragmented two."],
            ['p','Protecting blocks matters more than lengthening days.']
          ],
          keys:[
            'Switching leaves attention residue.',
            'Fragmented time underperforms unbroken time.',
            'Protect blocks rather than adding hours.'
          ]
        },
        {
          t:'Self-criticism makes it worse',
          min:4,
          body:[
            ['h','The counterintuitive finding'],
            ['p','Being hard on yourself after procrastinating predicts more procrastination, not less. The self-criticism produces exactly the negative mood that avoidance exists to relieve, which sets the loop running again.'],
            ['p','Self-forgiveness after a lapse predicts less procrastination next time. This is not softness; it is the intervention that measurably works.'],
            ['try','Drop it once','Next lapse',"The next time you lose a day, write one sentence: what happened, and what you will do tomorrow. No commentary on your character. Then close it."],
            ['p','The bad day already cost you the day. Spending the evening on self-criticism costs you tomorrow as well.']
          ],
          keys:[
            'Self-criticism after a lapse predicts more avoidance.',
            'Self-forgiveness predicts faster recovery.',
            'Handle the lapse, then drop it.'
          ]
        }
      ]
    }
  ];

  /* Shipped courses plus anything imported, so a sheet of your own reading sits
     alongside the built-in ones. */
  let MERGED = null;
  async function all(){
    if(MERGED) return MERGED;
    let mine = [];
    try { const { values } = await Store.all('courses'); mine = values; }
    catch(e){ mine = []; }
    MERGED = [...COURSES, ...mine.filter(c => !COURSES.some(x => x.id === c.id))];
    return MERGED;
  }
  const byId = id => (MERGED || COURSES).find(c => c.id === id);

  /* progress: a set of "courseId:index" keys */
  let cache = null;
  async function done(){
    if(cache) return cache;
    try { cache = new Set((await Store.get('settings', 'academy')) || []); }
    catch(e){ cache = new Set(); }
    return cache;
  }
  const key = (cid, i) => `${cid}:${i}`;

  async function isDone(cid, i){ return (await done()).has(key(cid, i)); }
  async function complete(cid, i, on){
    const set = await done();
    on === false ? set.delete(key(cid, i)) : set.add(key(cid, i));
    await Store.put('settings', [...set], 'academy');
    return set.size;
  }
  async function courseProgress(cid){
    const set = await done();
    await all();
    const c = byId(cid);
    if(!c) return { n:0, of:0 };
    const n = c.lessons.filter((_, i) => set.has(key(cid, i))).length;
    return { n, of:c.lessons.length };
  }
  async function totalDone(){ return (await done()).size; }
  const totalLessons = () => (MERGED || COURSES).reduce((a,c) => a + c.lessons.length, 0);
  const minutes = c => c.lessons.reduce((a,l) => a + l.min, 0);

  /* ---- writing your own ----

     A chapter is stored as blocks, but nobody wants to type an array on a phone.
     This is the plain-text form: hash for a heading, "try:" for the exercise at
     the end, asterisk for a key point, and everything else is a paragraph. Blank
     lines separate blocks. It round-trips, so an existing chapter can be opened,
     edited and written back without losing its shape. */
  /* Inline formatting. The text is escaped first, so a chapter is text that gets
     decorated rather than markup that gets trusted. */
  function rich(str){
    const esc = String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function parseBody(text){
    const body = [], keys = [];
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    let para = [], tryBlock = null, bullets = [];

    const flushPara = () => {
      if(para.length){ body.push(['p', para.join(' ').trim()]); para = []; }
    };
    const flushList = () => {
      if(bullets.length){ body.push(['ul', bullets.slice()]); bullets = []; }
    };
    const flushTry = () => {
      if(tryBlock){
        body.push(['try', tryBlock.title, tryBlock.dur, tryBlock.text.join(' ').trim()]);
        tryBlock = null;
      }
    };

    lines.forEach(raw => {
      const line = raw.trim();

      if(!line){ flushPara(); flushList(); flushTry(); return; }

      const heading = line.match(/^#+\s+(.*)$/);
      if(heading){ flushPara(); flushList(); flushTry(); body.push(['h', heading[1].trim()]); return; }

      /* a bullet in the body of the chapter */
      const bullet = line.match(/^-\s+(.*)$/);
      if(bullet){ flushPara(); flushTry(); bullets.push(bullet[1].trim()); return; }

      /* a line worth setting apart */
      const quote = line.match(/^>\s+(.*)$/);
      if(quote){ flushPara(); flushList(); flushTry(); body.push(['q', quote[1].trim()]); return; }

      const key = line.match(/^\*\s+(.*)$/);
      if(key){ flushPara(); flushList(); flushTry(); keys.push(key[1].trim()); return; }

      const start = line.match(/^try:\s*(.*)$/i);
      if(start){
        flushPara(); flushList(); flushTry();
        const [title, dur] = start[1].split('|');
        tryBlock = { title:(title || 'Try this').trim(), dur:(dur || '10 minutes').trim(), text:[] };
        return;
      }

      if(tryBlock) tryBlock.text.push(line);
      else para.push(line);
    });
    flushPara(); flushList(); flushTry();
    return { body, keys };
  }

  function bodyToText(body, keys){
    const out = [];
    (body || []).forEach(b => {
      if(b[0] === 'h') out.push('# ' + b[1]);
      else if(b[0] === 'p') out.push(b[1]);
      else if(b[0] === 'ul') (b[1] || []).forEach(x => out.push('- ' + x));
      else if(b[0] === 'q') out.push('> ' + b[1]);
      else if(b[0] === 'try') out.push(`try: ${b[1]} | ${b[2]}`, b[3]);
      out.push('');
    });
    (keys || []).forEach(k => out.push('* ' + k));
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* An honest read time beats a guess: 200 words a minute, never under one. */
  function readMinutes(body){
    const words = (body || []).reduce((n, b) => {
      const last = b[b.length - 1];
      const str = Array.isArray(last) ? last.join(' ') : String(last || '');
      return n + str.split(/\s+/).filter(Boolean).length;
    }, 0);
    return Math.max(1, Math.round(words / 200));
  }

  const uid = () => 'own_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  async function saveCourse(course){
    const c = Object.assign({}, course);
    if(!c.id) c.id = uid();
    c.own = true;
    c.lessons = (c.lessons || []).map(l => Object.assign({}, l, { min: l.min || readMinutes(l.body) }));
    await Store.put('courses', c);
    cache = null; MERGED = null;
    return c;
  }

  async function deleteCourse(id){
    await Store.del('courses', id);
    cache = null; MERGED = null;
  }

  global.Academy = { COURSES, all, byId, isDone, complete, courseProgress,
                     parseBody, bodyToText, readMinutes, saveCourse, deleteCourse, rich,
                     totalDone, totalLessons, minutes,
                     get list(){ return MERGED || COURSES; },
                     invalidate: () => { cache = null; MERGED = null; } };
})(window);
