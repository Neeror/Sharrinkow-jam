import { saveBest } from './physics.js';
import { playerZone } from './location.js';

export class Game {
  constructor(player, route, thread, threat, enemies, ui, input, storage) {
    Object.assign(this, { player, route, thread, threat, enemies, ui, input, storage });
    this.phase = 'ready';
    this.time = 0;
    this.retries = 0;
    this.reason = '';
  }

  setPhase(phase) {
    this.phase = phase;
    this.input.enabled = phase === 'playing';
    this.input.clear();
    if (phase !== 'playing') {
      this.thread.release();
      this.thread.held = false;
      document.exitPointerLock();
    }
    if (phase === 'lost') this.defeats = (this.defeats || 0) + 1;
    this.ui.phase(
      phase,
      this.reason,
      this.time,
      this.retries,
      this.detections || 0,
      this.defeats || 0,
    );
  }

  start(full = true) {
    this.route.restart(full);
    this.player.reset(this.route.checkpointPosition);
    this.threat.reset();
    this.enemies.reset();
    this.thread.release();
    this.thread.held = false;
    if (full) {
      this.debugRun = false;
      this.time = 0;
      this.retries = 0;
      this.defeats = 0;
      this.detections = 0;
    } else {
      this.time += 15;
      this.retries++;
    }
    this.input.yaw = 0;
    this.input.pitch = 0.2;
    this.reason = '';
    this.setPhase('playing');
    this.input.capture();
  }

  finish() {
    if (!this.debugRun) saveBest(this.storage, this.time);
    this.ui.showBest();
    this.setPhase('won');
  }

  pause(force = false) {
    if (!['playing', 'paused'].includes(this.phase)) return;
    if (force && this.phase === 'paused') return;
    this.setPhase(this.phase === 'playing' ? 'paused' : 'playing');
    if (this.phase === 'playing') this.input.capture();
  }

  step(dt, world) {
    if (this.phase !== 'playing') return;
    if (this.input.recoverQueued) {
      this.input.recoverQueued = false;
      this.thread.release();
      this.player.reset(this.player.safePosition);
    }
    this.time += dt;
    const simulationDt = dt * (this.threat.slow > 0 ? 0.4 : 1);
    world.update(this.time, this.player.position, Math.max(this.threat.noise, this.threat.awake));
    this.player.step(simulationDt, this.input, this.enemies.wind, Boolean(this.thread.anchor));
    this.thread.step(simulationDt, this.player, this.input, this.enemies.wind);
    this.player.resolvePenetration();
    const strikes = this.threat.strikes;
    this.threat.update(dt, this.player, this.time, playerZone(this.player));
    this.detections = (this.detections || 0) + this.threat.strikes - strikes;
    this.enemies.update(
      dt,
      this.time,
      this.player,
      this.threat,
      playerZone(this.player),
      Boolean(this.thread.anchor),
    );
    this.route.update(dt, this.player);
    this.reason = this.threat.reason || this.enemies.reason;
    if (this.reason) this.setPhase('lost');
    else if (this.route.completed) this.setPhase('ending');
  }
}
