// Synthesized, very quiet, somber music. Space is silent, so this is music and not sound effects:
//  - a slow pad (detuned sines/triangles through a long reverb) whose chord changes every ~16 s
//  - a soft breath-like swell that follows how fast we travel
//  - a faint bell when we arrive at a stop
export const Audio = {
  ctx: null, on: true, level: 0.5,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.on ? this.level : 0;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
      this.master.connect(comp); comp.connect(c.destination);
      // reverb: generated impulse response (exponentially decaying, darkening noise)
      const sr = c.sampleRate, len = sr * 6, ir = c.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.5 * t); d[i] = lp * Math.pow(1 - t, 2.6); } }
      this.rev = c.createConvolver(); this.rev.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.9; this.rev.connect(wet); wet.connect(this.master);
      // feedback delay as a second, slower echo
      const dl = c.createDelay(2); dl.delayTime.value = 0.61; const fb = c.createGain(); fb.gain.value = 0.5; const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 900;
      dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(this.rev);
      this.bus = c.createGain(); this.bus.gain.value = 1;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.2;
      this.bus.connect(lp); const dry = c.createGain(); dry.gain.value = 0.35; lp.connect(dry); dry.connect(this.master); lp.connect(this.rev); lp.connect(dl);
      this.padLP = lp;
      this.chords = [[73.42, 110, 164.81, 196, 293.66], [58.27, 116.54, 174.61, 220, 293.66], [65.41, 98, 146.83, 196, 261.63], [55, 110, 164.81, 207.65, 246.94], [73.42, 110, 174.61, 220, 329.63], [49, 98, 146.83, 233.08, 293.66]];
      this.voices = []; this.ci = 0;
      for (let i = 0; i < 5; i++) {
        const g = c.createGain(); g.gain.value = 0; g.connect(this.bus);
        const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = i < 2 ? 'sine' : 'triangle'; o2.type = 'sine'; o1.detune.value = -6 - i; o2.detune.value = 7 + i;
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.04 + 0.013 * i; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain);
        o1.connect(g); o2.connect(g); o1.frequency.value = o2.frequency.value = 100; o1.start(); o2.start(); lfo.start();
        this.voices.push({ g, o1, o2 });
      }
      this.nextChord(); this.timer = setInterval(() => this.nextChord(), 16000);
      // travel swell: filtered noise
      const nb = c.createBuffer(1, sr * 4, sr), d = nb.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.03 * (Math.random() * 2 - 1)) / 1.03; d[i] = last * 4; }
      const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true; ns.start();
      this.swellF = c.createBiquadFilter(); this.swellF.type = 'lowpass'; this.swellF.frequency.value = 160; this.swellF.Q.value = 0.7;
      this.swellG = c.createGain(); this.swellG.gain.value = 0; ns.connect(this.swellF); this.swellF.connect(this.swellG); this.swellG.connect(this.rev); this.swellG.connect(this.master);
      const un = () => { if (c.state === 'suspended') c.resume().catch(() => {}); };
      addEventListener('pointerdown', un); addEventListener('keydown', un);
    } catch (e) { this.ctx = null; }
  },
  nextChord() {
    const c = this.ctx; if (!c) return; const ch = this.chords[this.ci++ % this.chords.length], t = c.currentTime;
    this.voices.forEach((v, i) => {
      const f = ch[i]; v.o1.frequency.setTargetAtTime(f, t, 2.5); v.o2.frequency.setTargetAtTime(f, t, 2.5);
      v.g.gain.setTargetAtTime((i === 0 ? 0.05 : 0.032) * (i === 4 ? 0.55 : 1), t, 3);
    });
  },
  // x: 0..1 how fast we are travelling
  setTravel(x) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    this.swellG.gain.setTargetAtTime(0.5 * x * x, t, 1.2);
    this.swellF.frequency.setTargetAtTime(130 + 330 * x, t, 1.5);
    this.padLP.frequency.setTargetAtTime(1100 + 500 * x, t, 2);
  },
  chime() {
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime;
    for (const [f, a, d] of [[523.25, 0.05, 4.5], [783.99, 0.028, 3.6], [1174.66, 0.012, 2.6]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.rev); g.connect(this.master); o.start(t); o.stop(t + d + 0.1);
    }
  },
  toggle() { this.on = !this.on; if (this.ctx) this.master.gain.setTargetAtTime(this.on ? this.level : 0, this.ctx.currentTime, 0.4); return this.on; }
};
