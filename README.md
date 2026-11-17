# The Solar System

A quiet, realistic journey from the Sun out past the Oort cloud, in the browser. Every planet is at its real
position for today's date, at true size and true distance. Made for an 8-year-old; English and Swedish.

## Run it

It is a small web app (ES modules, ~50 MB of imagery), so it needs a local web server; opening `index.html`
directly from disk will not work.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ and click to begin.

## What you can do

- **The voyage** (default): a guided trip with 16 stops — close to the Sun, every planet, the asteroid belt,
  Pluto and the Kuiper belt, the heliopause with Voyager 1, the inner and outer Oort cloud, and a last look back
  at the Sun as one star among many. Speed grows with distance, so the Sun to Neptune takes about 4 minutes and
  Neptune to beyond the Oort cloud about 2 more. On screen: distance from the Sun, how long sunlight takes to get
  there, speed as a multiple of the speed of light, and a logarithmic distance bar.
- **Free flight**: fly anywhere; speed adjusts to how far you are from the nearest body.

| Key | Voyage | Free flight |
|---|---|---|
| Space | pause / continue | |
| ← → | previous / next stop | |
| F | switch to free flight | |
| W A S D, Q E | | fly, down / up |
| Shift, mouse wheel | | faster, speed |
| 0–9 | | fly to the Sun / a planet |
| V | | back to the voyage |
| Mouse drag | look around | look around |
| L / O / T / M | labels / orbits / time speed / music | |

## How it is made

- **Positions**: JPL approximate Keplerian elements for the planets, a Meeus lunar theory for the Moon, IAU
  rotation models for each body's orientation; spacecraft positions from JPL Horizons.
- **Belts**: 60,000 real asteroid orbits and all 8,325 known trans-Neptunian objects from the Minor Planet Center,
  positioned for today. The Oort cloud has never been observed; it is a model. In reality none of these would be
  visible to the eye, and the captions say so — they are drawn as faint markers.
- **Rendering**: three.js (r170). Floating origin in double precision plus a logarithmic depth buffer, so
  1 km and 100,000 AU coexist. HDR with an eye-adaptation model: the outer planets are seen in a deepening dusk
  (sunlight at Neptune is 1/900 of Earth's), stars fade next to anything sunlit.
- **Sky**: NASA SVS Deep Star Maps 2020 Milky Way, plus the Yale Bright Star Catalogue as point stars.

## Credits

Planet imagery comes from NASA, USGS, ESA, JHUAPL/SwRI spacecraft data (public domain), and from
**Solar System Scope (solarsystemscope.com), CC BY 4.0** for Venus' clouds, Saturn, its rings, Uranus and Neptune,
where no usable photographic global maps exist. Full per-file sources and licences are in
[`assets/CREDITS.md`](assets/CREDITS.md) and [`assets/manifest.json`](assets/manifest.json); the app shows them
in its About panel. three.js is MIT-licensed.

`tools/` holds the scripts that converted the raw downloads into `assets/`. The raw downloads (~1.2 GB) are not
in the repository.
