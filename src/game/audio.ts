// Procedural WebAudio. Everything is synthesized — no assets, no dependencies.
// The game must run fine if audio is unavailable.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
      return this.ctx;
    } catch {
      return null;
    }
  }

  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  private startAmbient(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    // Very quiet filtered hum — "server room" bed.
    const gain = ctx.createGain();
    gain.gain.value = 0.018;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;
    filter.Q.value = 0.8;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 55.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    o1.start(); o2.start(); lfo.start();
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const ctx = this.ensure();
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  place(): void { this.blip(220, 0.12, 'triangle', 0.25, 140); this.blip(440, 0.08, 'square', 0.08, 330, 0.02); }
  connect(): void { this.blip(520, 0.07, 'square', 0.12); this.blip(780, 0.1, 'square', 0.12, undefined, 0.07); }
  remove(): void { this.blip(300, 0.14, 'sawtooth', 0.12, 90); }
  buy(): void { this.blip(660, 0.07, 'triangle', 0.16); this.blip(990, 0.1, 'triangle', 0.14, undefined, 0.06); }
  upgrade(): void { this.blip(392, 0.08, 'square', 0.12); this.blip(523, 0.08, 'square', 0.12, undefined, 0.07); this.blip(659, 0.12, 'square', 0.12, undefined, 0.14); }
  error(): void { this.blip(160, 0.16, 'sawtooth', 0.14, 90); }
  tech(): void { this.blip(523, 0.1, 'triangle', 0.16); this.blip(784, 0.16, 'triangle', 0.16, undefined, 0.09); }
  ach(): void { this.blip(784, 0.08, 'triangle', 0.14); this.blip(988, 0.08, 'triangle', 0.14, undefined, 0.07); this.blip(1319, 0.16, 'triangle', 0.14, undefined, 0.14); }
  goal(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.16, undefined, i * 0.12));
  }
  fragment(): void { this.blip(880, 0.05, 'sine', 0.05, 1100); }
}
