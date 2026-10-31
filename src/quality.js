export class Quality {
  constructor(apply) {
    this.apply = apply;
    this.level = 'high';
    this.pending = false;
    this.fps = 60;
    this.age = 0;
    this.duration = 0;
    this.frames = 0;
    this.poorSeconds = 0;
    this.manual = false;
  }

  select(level, manual = true) {
    this.level = level;
    this.manual = manual;
    this.pending = false;
    this.poorSeconds = 0;
    this.age = 0;
    this.apply(level);
  }

  sample(dt, playing, safe) {
    if (dt <= 0 || !playing) {
      this.duration = this.frames = this.poorSeconds = 0;
      if (safe) this.commit();
      return;
    }
    this.age += dt;
    this.duration += dt;
    this.frames++;
    if (this.duration >= 0.5) {
      this.fps = this.frames / this.duration;
      if (this.age > 12 && !this.manual && this.level !== 'low') {
        this.poorSeconds = this.fps < 40 ? this.poorSeconds + this.duration : 0;
        if (this.poorSeconds >= 4) this.pending = true;
        if (this.fps >= 55) this.pending = false;
      }
      this.duration = 0;
      this.frames = 0;
    }
    if (safe) this.commit();
  }

  commit() {
    if (!this.pending) return;
    this.select(this.level === 'high' ? 'medium' : 'low', false);
  }
}
