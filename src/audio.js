import { SOFT_MATERIALS } from './surfaces.js';

export class Sound {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.voices = [];
    this.voiceIndex = 0;
    this.nextBeat = 0;
    this.nextTick = 0;
    this.nextStep = 0;
    this.nextCreak = 0;
    this.lastCat = 'patrol';
    this.lastImpact = -10;
  }

  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      const context = this.context;
      this.master = context.createGain();
      this.master.gain.value = 0.3;
      this.meter = context.createAnalyser();
      this.meter.fftSize = 256;
      this.master.connect(this.meter).connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.04) / 1.02;
        data[i] = brown * 3;
      }
      this.airSource = context.createBufferSource();
      this.airSource.buffer = buffer;
      this.airSource.loop = true;
      this.airFilter = context.createBiquadFilter();
      this.airFilter.type = 'lowpass';
      this.air = context.createGain();
      this.air.gain.value = 0;
      this.airSource.connect(this.airFilter).connect(this.air).connect(this.master);
      this.airSource.start();
      this.music = context.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.master);
      for (const frequency of [55, 82.41, 110.3]) {
        const tone = context.createOscillator();
        tone.type = 'sine';
        tone.frequency.value = frequency;
        tone.connect(this.music);
        tone.start();
      }
      for (let i = 0; i < 16; i++) {
        const oscillator = context.createOscillator();
        oscillator.type = i < 8 ? 'sine' : 'triangle';
        const gain = context.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain).connect(this.master);
        oscillator.start();
        this.voices.push({ oscillator, gain });
      }
    }
    await this.context.resume();
  }

  tone(frequency, duration, volume, delay = 0, end = frequency * 0.6) {
    if (!this.context || !this.enabled) return;
    const voice = this.voices[this.voiceIndex++ % this.voices.length];
    const now = this.context.currentTime + delay;
    voice.oscillator.frequency.cancelScheduledValues(now);
    voice.oscillator.frequency.setValueAtTime(frequency, now);
    voice.oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0.0001, now);
    voice.gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  silence() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const { gain } of this.voices) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.025);
    }
    this.air.gain.setTargetAtTime(0, now, 0.025);
    this.music.gain.setTargetAtTime(0, now, 0.025);
  }

  endingStart() {
    this.silence();
    this.endingBeat = 0;
    this.endingImpact = false;
    this.endingSilent = false;
    this.tone(130, 0.6, 0.035, 0, 55);
    if (this.context && this.enabled) {
      const now = this.context.currentTime;
      this.airFilter.frequency.setValueAtTime(850, now);
      this.air.gain.cancelScheduledValues(now);
      this.air.gain.setValueAtTime(0.025, now);
      this.air.gain.linearRampToValueAtTime(0.07, now + 2.8);
      this.air.gain.linearRampToValueAtTime(0.025, now + 3.7);
      this.air.gain.linearRampToValueAtTime(0.3, now + 3.95);
      this.air.gain.exponentialRampToValueAtTime(0.0001, now + 4.65);
    }
  }

  endingUpdate(time) {
    if (time >= 6) {
      if (!this.endingSilent) this.silence();
      this.endingSilent = true;
      return;
    }
    if (time >= this.endingBeat) {
      this.endingBeat = time + (time < 3.8 ? 0.8 : 0.28);
      this.tone(65, 0.14, 0.16);
      this.tone(54, 0.12, 0.08, 0.12);
    }
    if (time >= 3.8 && !this.endingImpact) {
      this.endingImpact = true;
      this.tone(95, 0.15, 0.2, 0, 26);
      this.tone(480, 0.65, 0.08, 0.08, 1400);
      this.tone(2300, 1.8, 0.025, 0.7, 1700);
    }
  }

  async toggle() {
    await this.start();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(this.enabled ? 0.3 : 0, this.context.currentTime, 0.1);
    return this.enabled;
  }

  update(game, player, threat, enemies) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const active = game.phase === 'playing';
    const breath = (Math.sin(game.time * 1.3) + 1) * 0.5;
    this.air.gain.setTargetAtTime(
      active ? 0.02 + breath * breath * 0.11 + (threat.warning > 0 ? 0.17 : 0) : 0,
      now,
      0.08,
    );
    this.airFilter.frequency.setTargetAtTime(
      280 + threat.awake * 850 + (threat.warning > 0 ? 600 : 0),
      now,
      0.08,
    );
    this.music.gain.setTargetAtTime(
      active ? 0.012 + threat.awake * 0.025 + threat.noise * 0.025 : 0,
      now,
      0.2,
    );
    if (!active || !this.enabled) return;
    if (now > this.nextBeat) {
      this.nextBeat = now + 1.05 - threat.awake * 0.45;
      this.tone(58 + threat.awake * 30, 0.18, 0.16);
      this.tone(53 + threat.awake * 30, 0.15, 0.1, 0.17);
    }
    if (now > this.nextTick) {
      this.nextTick = now + 1;
      this.tone(1800, 0.035, 0.015);
    }
    if (player.grounded && player.speed > 0.2 && now > this.nextStep) {
      this.nextStep = now + 0.22 / Math.max(0.6, player.speed);
      const soft = SOFT_MATERIALS.has(player.material);
      this.tone(soft ? 110 : 620, soft ? 0.045 : 0.025, soft ? 0.018 : 0.035);
    }
    if (player.position.y > 3 && now > this.nextCreak) {
      this.nextCreak = now + 8;
      this.tone(240, 0.6, 0.045, 0, 95);
    }
    if (enemies.catMode === 'chase' && this.lastCat !== 'chase') this.tone(420, 0.65, 0.1, 0, 710);
    if (threat.lastImpact !== this.lastImpact && threat.lastImpact >= 0) {
      this.tone(70, 0.7, 0.13, 0, 35);
    }
    this.lastCat = enemies.catMode;
    this.lastImpact = threat.lastImpact;
  }
}
