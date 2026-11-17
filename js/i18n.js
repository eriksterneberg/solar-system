// Strings (EN + SV) and locale-aware number / duration formatting.
const PARAMS = new URLSearchParams(location.search);

export const LANGS = {
  en: {
    title: 'The Solar System', h2: 'A journey from the Sun out into space', real: 'Real positions for today, true sizes',
    go: 'Click to begin', loadingTxt: 'loading…', loadingDone: 'ready', about: 'About', aboutTitle: 'About and credits', close: 'Close', aboutMissing: 'The credits are being collected.',
    kVoyage: 'The voyage', kFlight: 'Free flight', kMore: 'Everything',
    kSpace: 'Space', cPause: 'pause / continue', cSkip: 'previous / next stop', kMouse: 'Mouse', cLook: 'drag to look around', cFree: 'fly freely',
    kWheel: 'Wheel', cFly: 'fly', cUpDown: 'down / up', cBoost: '10 × faster', cSpeed: 'speed', cGoto: 'fly to a planet (0 = Sun)', cBack: 'back to the voyage',
    cLabels: 'names', cOrbits: 'orbits', cTime: 'speed of time', cMusic: 'music', cRestart: 'start again',
    kShift: 'Shift',
    bPrev: 'Previous stop', bNext: 'Next stop', bPause: 'Pause', bPlay: 'Continue', bFree: 'Free flight', bVoyage: 'Back to the voyage', paused: 'Paused',
    flightHint: 'Free flight. Click to look with the mouse, Esc lets go.', dragHint: 'Free flight. Drag the mouse to look.',
    names: { sun: 'The Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'The Moon', mars: 'Mars', belt: 'The asteroid belt', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
      pluto: 'Pluto', kuiper: 'The Kuiper belt', helio: 'The edge of the Sun’s wind', oort1: 'The Oort cloud', oort2: 'The edge of the Oort cloud', back: 'Looking back' },
    // names as they appear inside a sentence ("from the Sun to Mercury")
    inl: { sun: 'the Sun', mercury: 'Mercury', venus: 'Venus', earth: 'the Earth', mars: 'Mars', belt: 'the asteroid belt', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
      pluto: 'Pluto', kuiper: 'the Kuiper belt', helio: 'the edge of the Sun’s wind', oort1: 'the inner Oort cloud', oort2: 'the outer Oort cloud', back: 'the far side' },
    bar: { au: 'AU', ly: '1 light-year', helio: 'Heliopause', oort: 'Oort cloud', kuiper: 'Kuiper belt', belt: 'Asteroids' },
    // captions: [title shown above, [parts]]
    cap: {
      sun: ['This is our Sun. It is 109 Earths wide, and it weighs more than everything else in the solar system put together — 99.8 % of it all.', 'Its light needs 8 minutes and 20 seconds to reach the Earth. Now we travel outwards.'],
      mercury: ['Mercury is the smallest planet. It has no air, so even by day its sky is black.', 'One day and night here last 176 Earth days.'],
      venus: ['Venus is the hottest planet, about 465 °C. Thick clouds and air made of carbon dioxide trap the heat.', 'It spins backwards, so the Sun rises in the west.'],
      earth: ['This is home. The Earth is the only place we know of where there is life.', 'The Moon is 384 400 km away. All the other planets would just about fit side by side in the space between us and it.'],
      mars: ['Mars is red because there is rust in its soil. Olympus Mons, the biggest volcano we know of, is here.', 'Right now, robots are driving around on Mars.'],
      belt: ['Between Mars and Jupiter there are millions of rocks, called asteroids. They are so far apart that you would never see one.', 'Here they are marked as dots. In real life they are far too small and dark to see.'],
      jupiter: ['Jupiter is so big that 1 300 Earths would fit inside it.', 'The Great Red Spot is a storm bigger than the Earth. It has been blowing for at least 190 years.'],
      saturn: ['Saturn is so light that it would float in a giant bathtub. The rings are mostly ice, in pieces from dust-size to house-size, but only tens of metres thick.', 'Right now the rings are almost edge-on to the Sun, so they look thin and dark. That happens every 15 years.'],
      uranus: ['Uranus is tipped over on its side, as if it were rolling around the Sun.', 'A season here lasts 21 years.'],
      neptune: ['Neptune is the windiest planet, with storms of about 2 000 km/h. One trip around the Sun takes 165 years.', 'Sunlight here is 900 times weaker than on Earth.'],
      pluto: ['Pluto is a dwarf planet. It has a heart-shaped glacier of frozen nitrogen.', 'Sunlight takes about {lt} to get here.'],
      kuiper: ['Beyond Neptune lies the Kuiper belt, a ring of icy worlds. Pluto is one of them.', 'Thousands are known. Here some are marked as dots; the real ones are far too dim to see.'],
      helio: ['The Sun blows a wind of tiny particles. About 120 AU away it meets the wind from other stars. That edge is called the heliopause.', 'Voyager 1, launched in 1977, crossed it in 2012. It is the farthest thing people ever made.'],
      oort1: ['This is the Oort cloud: a giant sphere of icy lumps, perhaps hundreds of billions of them. Nobody has ever seen it directly.', 'Long comets come from here. The dots are only markers; the real lumps are invisible.'],
      oort2: ['This is the outer edge of the Oort cloud, about 100 000 AU from the Sun: {ly} light-years.', 'The nearest star, Proxima Centauri, is 4.24 light-years away. We are more than a third of the way.'],
      back: ['Look back. From here the Sun is just one bright star among many.', 'Everything and everyone we know is next to that small light.'],
      backEnd: ['You can stay as long as you like.', 'Press F to fly around freely, or R to begin again.']
    },
    leg: {
      au: 'In space we measure with AU. 1 AU is the distance from the Earth to the Sun: 150 million km.',
      head: 'From {a} to {b} is {d}.',
      car: 'A car driving 100 km/h would need {t}.', jet: 'A passenger jet would need {t}.', voy: 'Voyager 1, flying 17 km/s, would need {t}.', light: 'Light needs {t}.'
    },
    ro: { dist: 'Distance from the Sun', light: 'Sunlight takes {t} to get here', lightLess: 'Sunlight takes less than a second to get here', speedC: 'Travelling at {x} × the speed of light', speedKm: 'Travelling at {x} km/s', speedSlow: 'Drifting slowly', ly: '{x} light-years',
      mult: { million: 'million' } },
    time: ['Real time', '1 day per second', '30 days per second', '1 year per second'],
    u: { s: ['second', 'seconds'], min: ['minute', 'minutes'], h: ['hour', 'hours'], d: ['day', 'days'], mo: ['month', 'months'], y: ['year', 'years'], th: 'thousand', mi: ['million', 'million'], bi: ['billion', 'billion'], lt1: 'less than a second', km: 'km', mkm: 'million km' },
    sc: { 'Voyager 1': 'Voyager 1', 'Voyager 2': 'Voyager 2', 'Pioneer 10': 'Pioneer 10', 'Pioneer 11': 'Pioneer 11', 'New Horizons': 'New Horizons' },
    ver: 'Voyager 1 is here'
  },
  sv: {
    title: 'Solsystemet', h2: 'En resa från Solen ut i rymden', real: 'Planeternas riktiga lägen idag, i verklig storlek',
    go: 'Klicka för att börja', loadingTxt: 'laddar…', loadingDone: 'klart', about: 'Om', aboutTitle: 'Om och tack', close: 'Stäng', aboutMissing: 'Tacklistan håller på att samlas ihop.',
    kVoyage: 'Resan', kFlight: 'Fritt flyg', kMore: 'Allt',
    kSpace: 'Mellanslag', cPause: 'pausa / fortsätt', cSkip: 'förra / nästa stopp', kMouse: 'Mus', cLook: 'dra för att titta omkring', cFree: 'flyg fritt',
    kWheel: 'Hjul', cFly: 'flyg', cUpDown: 'ner / upp', cBoost: '10 gånger snabbare', cSpeed: 'fart', cGoto: 'flyg till en planet (0 = Solen)', cBack: 'tillbaka till resan',
    cLabels: 'namn', cOrbits: 'banor', cTime: 'tidens fart', cMusic: 'musik', cRestart: 'börja om',
    kShift: 'Skift',
    bPrev: 'Förra stoppet', bNext: 'Nästa stopp', bPause: 'Pausa', bPlay: 'Fortsätt', bFree: 'Flyg fritt', bVoyage: 'Tillbaka till resan', paused: 'Pausad',
    flightHint: 'Fritt flyg. Klicka för att titta med musen, Esc släpper den.', dragHint: 'Fritt flyg. Dra med musen för att titta.',
    names: { sun: 'Solen', mercury: 'Merkurius', venus: 'Venus', earth: 'Jorden', moon: 'Månen', mars: 'Mars', belt: 'Asteroidbältet', jupiter: 'Jupiter', saturn: 'Saturnus', uranus: 'Uranus', neptune: 'Neptunus',
      pluto: 'Pluto', kuiper: 'Kuiperbältet', helio: 'Solvindens kant', oort1: 'Oorts moln', oort2: 'Oorts moln, yttersta kanten', back: 'Tillbakablick' },
    inl: { sun: 'Solen', mercury: 'Merkurius', venus: 'Venus', earth: 'Jorden', mars: 'Mars', belt: 'asteroidbältet', jupiter: 'Jupiter', saturn: 'Saturnus', uranus: 'Uranus', neptune: 'Neptunus',
      pluto: 'Pluto', kuiper: 'Kuiperbältet', helio: 'solvindens kant', oort1: 'inre delen av Oorts moln', oort2: 'yttre kanten av Oorts moln', back: 'andra sidan' },
    bar: { au: 'AU', ly: '1 ljusår', helio: 'Heliopausen', oort: 'Oorts moln', kuiper: 'Kuiperbältet', belt: 'Asteroider' },
    cap: {
      sun: ['Det här är Solen. Den är 109 jordklot bred och väger mer än allt annat i solsystemet tillsammans – 99,8 procent av allt.', 'Dess ljus behöver 8 minuter och 20 sekunder för att nå Jorden. Nu reser vi utåt.'],
      mercury: ['Merkurius är den minsta planeten. Där finns ingen luft, så himlen är svart även mitt på dagen.', 'En dag och natt varar i 176 jorddygn.'],
      venus: ['Venus är den varmaste planeten, ungefär 465 °C. Tjocka moln och luft av koldioxid håller kvar värmen.', 'Den snurrar baklänges, så Solen går upp i väster.'],
      earth: ['Det här är hemma. Jorden är den enda plats vi vet om där det finns liv.', 'Månen är 384 400 km bort. Alla de andra planeterna skulle nästan få plats på rad i mellanrummet mellan oss och Månen.'],
      mars: ['Mars är röd för att det finns rost i marken. Här finns Olympus Mons, den största vulkanen vi känner till.', 'Just nu kör robotar omkring på Mars.'],
      belt: ['Mellan Mars och Jupiter finns miljontals stenar, som kallas asteroider. De ligger så långt ifrån varandra att du aldrig skulle se en enda.', 'Här är de utmärkta som prickar. I verkligheten är de alldeles för små och mörka för att synas.'],
      jupiter: ['Jupiter är så stor att 1 300 jordklot skulle få plats inuti.', 'Den stora röda fläcken är en storm som är större än Jorden. Den har blåst i minst 190 år.'],
      saturn: ['Saturnus är så lätt att den skulle flyta i ett jättestort badkar. Ringarna är mest is, i bitar från dammkorn till husstora block, men bara några tiotals meter tjocka.', 'Just nu är ringarna nästan kantställda mot Solen, så de ser tunna och mörka ut. Det händer var 15:e år.'],
      uranus: ['Uranus ligger på sidan, som om den rullade runt Solen.', 'En årstid varar i 21 år.'],
      neptune: ['Neptunus är den blåsigaste planeten, med storm på ungefär 2 000 km/h. Ett varv runt Solen tar 165 år.', 'Solljuset här är 900 gånger svagare än på Jorden.'],
      pluto: ['Pluto är en dvärgplanet. Den har en hjärtformad glaciär av fruset kväve.', 'Solljuset behöver ungefär {lt} hit.'],
      kuiper: ['Bortom Neptunus ligger Kuiperbältet, en ring av isvärldar. Pluto är en av dem.', 'Tusentals är kända. Här är några utmärkta som prickar. I verkligheten är de alldeles för svaga för att synas.'],
      helio: ['Solen blåser ut en vind av små partiklar. Ungefär 120 AU bort möter den vinden från andra stjärnor. Gränsen kallas heliopausen.', 'Voyager 1 sköts upp 1977 och korsade den 2012. Inget som människor har byggt har kommit så långt bort.'],
      oort1: ['Det här är Oorts moln: ett gigantiskt klot av isklumpar, kanske hundratals miljarder. Ingen har någonsin sett det direkt.', 'Kometer med långa banor kommer härifrån. Prickarna är bara markörer. I verkligheten går klumparna inte att se.'],
      oort2: ['Det här är yttersta kanten av Oorts moln, ungefär 100 000 AU från Solen: {ly} ljusår.', 'Den närmaste stjärnan, Proxima Centauri, är 4,24 ljusår bort. Vi har rest mer än en tredjedel av vägen.'],
      back: ['Titta tillbaka. Härifrån är Solen bara en ljus stjärna bland många.', 'Allt och alla vi känner finns vid det lilla ljuset.'],
      backEnd: ['Du kan stanna så länge du vill.', 'Tryck F för att flyga fritt, eller R för att börja om.']
    },
    leg: {
      au: 'I rymden mäter vi med AU. 1 AU är avståndet från Jorden till Solen: 150 miljoner km.',
      head: 'Från {a} till {b} är det {d}.',
      car: 'En bil som kör 100 km/h skulle behöva {t}.', jet: 'Ett passagerarplan skulle behöva {t}.', voy: 'Voyager 1, som flyger 17 km/s, skulle behöva {t}.', light: 'Ljuset klarar det på {t}.'
    },
    ro: { dist: 'Avstånd från Solen', light: 'Solljuset behöver {t} hit', lightLess: 'Solljuset behöver mindre än en sekund hit', speedC: 'Du reser {x} gånger ljusets hastighet', speedKm: 'Du reser {x} km/s', speedSlow: 'Du glider långsamt', ly: '{x} ljusår',
      mult: { million: 'miljoner' } },
    time: ['Verklig tid', '1 dygn per sekund', '30 dygn per sekund', '1 år per sekund'],
    u: { s: ['sekund', 'sekunder'], min: ['minut', 'minuter'], h: ['timme', 'timmar'], d: ['dygn', 'dygn'], mo: ['månad', 'månader'], y: ['år', 'år'], th: 'tusen', mi: ['miljon', 'miljoner'], bi: ['miljard', 'miljarder'], lt1: 'mindre än en sekund', km: 'km', mkm: 'miljoner km' },
    sc: { 'Voyager 1': 'Voyager 1', 'Voyager 2': 'Voyager 2', 'Pioneer 10': 'Pioneer 10', 'Pioneer 11': 'Pioneer 11', 'New Horizons': 'New Horizons' },
    ver: 'Voyager 1 finns här'
  }
};

const KEY = 'solarsystem.lang';
let LANG = (() => {
  const q = PARAMS.get('lang'); if (q && LANGS[q]) return q;
  try { const s = localStorage.getItem(KEY); if (s && LANGS[s]) return s; } catch (e) { /* storage blocked */ }
  return (navigator.language || 'en').toLowerCase().startsWith('sv') ? 'sv' : 'en';
})();
const listeners = [];
export const getLang = () => LANG;
export const onLang = f => listeners.push(f);
const dig = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function T(path, params) {
  let v = dig(LANGS[LANG], path); if (v == null) v = dig(LANGS.en, path); if (v == null) return path;
  if (typeof v === 'string' && params) v = v.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return v;
}
export function setLang(l, persist = true) {
  if (!LANGS[l]) return; LANG = l; nfCache.clear();
  if (persist) try { localStorage.setItem(KEY, l); } catch (e) { /* storage blocked */ }
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = T(e.dataset.i18n); });
  document.querySelectorAll('#lang span').forEach(e => e.classList.toggle('on', e.dataset.lang === l));
  document.title = T('title');
  listeners.forEach(f => f(l));
}

/* ---------- numbers ---------- */
const nfCache = new Map();
export function nf(n, frac = 0, group = true) {
  const key = LANG + frac + group;
  let f = nfCache.get(key); if (!f) { f = new Intl.NumberFormat(LANG === 'sv' ? 'sv-SE' : 'en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac, useGrouping: group }); nfCache.set(key, f); }
  // thin no-break space between thousands in Swedish already comes from Intl; keep it
  return f.format(n);
}
const plural = (n, pair) => (Math.round(n) === 1 ? pair[0] : pair[1]);
// "<n> <unit>" with the unit in the right number
const cnt = (n, unitKey, frac = 0) => `${nf(n, frac)} ${(LANG === 'sv' ? LANGS.sv : LANGS.en).u[unitKey][(frac === 0 && Math.round(n) === 1) ? 0 : 1]}`;

const YEAR = 31557600;
// seconds -> "4 hours 10 minutes", "8 minutes 20 seconds", "1.6 years", "28 thousand years", "17 million years"
export function fmtDur(sec) {
  const U = LANGS[LANG].u;
  if (!(sec >= 1)) return U.lt1;
  if (sec < 60) return cnt(Math.round(sec), 's');
  if (sec < 3600) { const m = Math.floor(sec / 60), s = Math.round(sec - m * 60); if (m >= 10 || s === 0 || s === 60) return cnt(Math.round(sec / 60), 'min'); return `${cnt(m, 'min')} ${cnt(s, 's')}`; }
  if (sec < 86400) { let h = Math.floor(sec / 3600), m = Math.round((sec - h * 3600) / 60); if (m === 60) { h++; m = 0; } return m ? `${cnt(h, 'h')} ${cnt(m, 'min')}` : cnt(h, 'h'); }
  const days = sec / 86400;
  if (days < 60) return cnt(Math.round(days), 'd');
  const y = sec / YEAR;
  if (y < 2) return cnt(Math.round(days / 30.44), 'mo');
  if (y < 10) return `${nf(y, 1)} ${U.y[1]}`;
  if (y < 1000) return `${nf(Math.round(y), 0)} ${U.y[1]}`;
  if (y < 1e6) { const k = y / 1000; return `${k < 10 ? nf(k, 1) : nf(Math.round(k), 0)} ${U.th} ${U.y[1]}`; }
  if (y < 1e9) { const m = y / 1e6; return `${m < 10 ? nf(m, 1) : nf(Math.round(m), 0)} ${plural(m, U.mi)} ${U.y[1]}`; }
  const b = y / 1e9; return `${b < 10 ? nf(b, 1) : nf(Math.round(b), 0)} ${plural(b, U.bi)} ${U.y[1]}`;
}

const AUKM = 149597870.7, LYAU = 63241.077;
// distance from the Sun for the readout
export function fmtDist(km) {
  const au = km / AUKM;
  if (au < 0.1) return `${nf(Math.round(km / 1000) * 1000, 0)} km`;
  let s;
  if (au < 10) s = nf(au, 1) + ' AU'; else if (au < 100) s = nf(au, 1) + ' AU'; else s = nf(Math.round(au), 0) + ' AU';
  if (au >= 5000) s += ` (${T('ro.ly', { x: nf(au / LYAU, au / LYAU < 10 ? 2 : 1) })})`;
  return s;
}
// leg length for the comparison caption
export function fmtLeg(km) {
  const au = km / AUKM;
  if (au < 1) return `${nf(Math.round(km / 1e6), 0)} ${LANGS[LANG].u.mkm}`;
  if (au < 10) return `${nf(au, 1)} AU`;
  return `${nf(Math.round(au >= 100 ? Math.round(au / 10) * 10 : au), 0)} AU`;
}
export function fmtMult(x) {
  if (x >= 1e6) { const m = x / 1e6; return `${nf(m, m < 10 ? 1 : 0)} ${LANGS[LANG].ro.mult.million}`; }
  if (x >= 10) return nf(Math.round(x), 0);
  if (x >= 1) return nf(x, 1);
  return nf(x, 2);
}
export function fmtDate(jd) { return new Date((jd - 2440587.5) * 86400000).toLocaleDateString(LANG === 'sv' ? 'sv-SE' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
export function fmtLight(km) {
  const s = km / 299792.458;
  return s < 1 ? T('ro.lightLess') : T('ro.light', { t: fmtDur(s) });
}
