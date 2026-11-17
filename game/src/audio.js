// audio.js — all sound is synthesized with WebAudio. No audio files,
// no network: engine hum, sirens, gunshots, pickups and a bass groove.
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false, engineOsc: null, engineGain: null,
    musicTimer: 0, sirenOn: false,
  };

  audio.ensure = function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.35;
      audio.master.connect(audio.ctx.destination);
      // Engine hum: a low sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
    } catch (e) { audio.ctx = null; }
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.35;
  };

  audio.setEngine = function setEngine(speed01, on) {
    if (!audio.ctx || !audio.engineGain) return;
    const t = audio.ctx.currentTime;
    audio.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
  };

  audio.blip = function blip(freq, dur, type, vol) {
    if (!audio.ctx || audio.muted) return;
    try {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, audio.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      o.connect(g); g.connect(audio.master);
      o.start(); o.stop(audio.ctx.currentTime + dur);
    } catch (e) {}
  };

  audio.noiseBurst = function noiseBurst(dur, vol, lowpass) {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.25;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass || 1800;
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start();
    } catch (e) {}
  };

  audio.gunshot = function gunshot() { audio.noiseBurst(0.12, 0.3, 2400); };
  audio.punch = function punch() { audio.noiseBurst(0.08, 0.2, 700); };
  audio.pickup = function pickup() { audio.blip(880, 0.12, 'sine', 0.15); audio.blip(1320, 0.18, 'sine', 0.12); };
  audio.cash = function cash() { audio.blip(660, 0.1, 'triangle', 0.15); setTimeout(() => audio.blip(990, 0.14, 'triangle', 0.15), 90); };
  audio.sirenBlip = function sirenBlip() { audio.blip(720, 0.28, 'sine', 0.06); setTimeout(() => audio.blip(960, 0.28, 'sine', 0.06), 300); };
  audio.missionDone = function missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.blip(f, 0.22, 'triangle', 0.16), i * 110));
  };
  audio.fail = function fail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => audio.blip(f, 0.3, 'sawtooth', 0.1), i * 160));
  };

  // A lazy two-bar bass groove, stepped from the game clock.
  audio.musicStep = function musicStep(dt, wanted) {
    if (!audio.ctx || audio.muted) return;
    audio.musicTimer -= dt;
    if (audio.musicTimer > 0) return;
    audio.musicTimer = wanted > 0 ? 0.21 : 0.27;
    const bassLine = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
    const step = Math.floor(performance.now() / 270) % bassLine.length;
    const f = bassLine[step];
    if (f) audio.blip(f, 0.2, 'triangle', wanted > 0 ? 0.14 : 0.09);
    if (wanted > 0 && step % 2 === 0) audio.sirenBlip();
  };

  return audio;
}
