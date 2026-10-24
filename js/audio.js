/* אפקטי סאונד מסונתזים ב־WebAudio, בלי קבצים חיצוניים ובלי בעיות זכויות יוצרים. */
const Sound = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('endoEscape.muted') === '1'; } catch (e) { /* ignore */ }

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = 'sine', vol = 0.15, slideTo = null) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    isMuted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('endoEscape.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (!muted) this.ok();
      return muted;
    },
    ok()   { tone(660, 0, .12, 'triangle'); tone(880, .1, .12, 'triangle'); tone(1320, .2, .22, 'triangle'); },
    bad()  { tone(180, 0, .25, 'sawtooth', .12, 90); },
    pager() { for (let i = 0; i < 3; i++) { tone(1800, i * .22, .1, 'square', .07); tone(1400, i * .22 + .1, .08, 'square', .07); } },
    // צלצול רך של פעמון: שלושה צלילים עולים שדועכים לאט
    ring() { tone(784, 0, .6, 'sine', .12); tone(1046, .14, .8, 'sine', .1); tone(1318, .28, 1.1, 'sine', .08); },
    key()  { tone(1046, 0, .1, 'triangle'); tone(1318, .09, .1, 'triangle'); tone(1568, .18, .1, 'triangle'); tone(2093, .27, .35, 'triangle'); },
    door() { tone(90, 0, .5, 'sawtooth', .12, 60); tone(220, .5, .9, 'square', .06, 440); this.key(); },
    // צפצופי מוניטור לפי דופק
    heart(bpm, beats = 4) {
      const gap = 60 / Math.max(30, bpm);
      for (let i = 0; i < beats; i++) tone(1000, i * gap, .09, 'sine', .14);
    }
  };
})();
