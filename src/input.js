export class Input {
  constructor(canvas, onPause) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0.2;
    this.mouseHeld = false;
    this.jumpQueued = false;
    this.enabled = false;
    this.locked = false;
    this.sensitivity = 1;
    this.invertY = false;
    this.horizontal = 0;
    this.vertical = 0;
    this.sprint = false;
    this.sneak = false;
    this.thread = false;
    this.reel = false;
    this.recoverQueued = false;
    this.descend = false;
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') {
        onPause();
        return;
      }
      if (!this.enabled) return;
      if (
        ['Space', 'ControlLeft', 'ControlRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE'].includes(
          event.code,
        )
      )
        event.preventDefault();
      if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
      if (event.code === 'KeyR' && !event.repeat) this.recoverQueued = true;
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    canvas.addEventListener('mousedown', (event) => {
      if (!this.enabled || event.button !== 0) return;
      this.mouseHeld = true;
      this.capture();
    });
    window.addEventListener('mouseup', () => {
      this.mouseHeld = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('mousemove', (event) => {
      if (!this.enabled || (!this.locked && event.buttons !== 2)) return;
      this.look(event.movementX, event.movementY);
    });
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (wasLocked && !this.locked && this.enabled) onPause(true);
    });
    window.addEventListener('blur', () => {
      this.clear();
      if (this.enabled) onPause(true);
    });
  }

  capture() {
    if (!this.locked) {
      this.canvas.requestPointerLock()?.catch(() => {});
    }
  }

  look(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.yaw += x * 0.0027 * this.sensitivity;
    this.pitch = Math.max(
      -1.45,
      Math.min(1.45, this.pitch + y * 0.0027 * this.sensitivity * (this.invertY ? -1 : 1)),
    );
  }

  clear() {
    this.keys.clear();
    this.mouseHeld = false;
    this.jumpQueued = false;
    this.recoverQueued = false;
    this.descend = false;
    this.horizontal = this.vertical = 0;
    this.thread = this.reel = this.sprint = this.sneak = false;
  }

  sample() {
    this.horizontal = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    this.vertical = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.sneak = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    this.thread = this.mouseHeld || this.keys.has('KeyE');
    this.reel = this.thread && this.keys.has('KeyW');
    this.descend = this.keys.has('KeyQ');
  }
}
