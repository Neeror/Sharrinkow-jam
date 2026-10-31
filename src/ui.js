import { ROUTE } from './route.js';
import { readBest } from './physics.js';
import { playerZone } from './location.js';
import { STRINGS } from './strings.js';

const ZONES = ['01 / ПОЛ И МЕБЕЛЬ', '02 / КРОВАТЬ', '03 / РУКА ЧЕЛОВЕКА'];
const ids = [
  'loading',
  'intro',
  'paused',
  'end',
  'hud',
  'timer',
  'zone',
  'noise',
  'awake',
  'noise-value',
  'awake-value',
  'warning',
  'objective-title',
  'objective-detail',
  'objective-label',
  'route-progress',
  'status',
  'compass',
  'crosshair',
  'anchor-hint',
  'quality-status',
  'performance',
  'best',
  'end-label',
  'end-title',
  'end-detail',
  'checkpoint',
];

export class UI {
  constructor(storage) {
    this.nodes = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
    this.storage = storage;
    this.lastUpdate = -1;
    this.showBest();
  }

  showBest() {
    const best = readBest(this.storage);
    this.nodes.best.textContent = `Рекорд этой спальни: ${best ? this.clock(best) : '—'}`;
  }

  clock(time) {
    return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
  }

  phase(phase, reason, time, retries, detections = 0, defeats = 0) {
    this.nodes.loading.classList.add('hidden');
    this.nodes.intro.classList.toggle('hidden', phase !== 'ready');
    this.nodes.paused.classList.toggle('hidden', phase !== 'paused');
    this.nodes.end.classList.toggle('hidden', !['won', 'lost'].includes(phase));
    this.nodes.hud.classList.toggle('hidden', phase !== 'playing');
    document.body.classList.toggle('playing', phase === 'playing');
    if (phase === 'won' || phase === 'lost') {
      this.nodes['end-title'].textContent = phase === 'won' ? STRINGS.victory : STRINGS.defeat;
      this.nodes['end-label'].textContent =
        phase === 'won' ? STRINGS.victoryLabel : 'НОЧЬ ЕЩЁ НЕ ЗАКОНЧЕНА';
      this.nodes['end-detail'].textContent =
        phase === 'won'
          ? `Время: ${this.clock(time)}. Обнаружений: ${detections}. Поражений: ${defeats}. Возвратов: ${retries}. Лучший результат: ${this.clock(readBest(this.storage) || time)}.`
          : reason;
      this.nodes.checkpoint.classList.toggle('hidden', phase === 'won');
    }
  }

  update(now, game, player, route, threat, enemies, thread, input, quality) {
    if (now - this.lastUpdate < 100) return;
    this.lastUpdate = now;
    const n = this.nodes;
    n.timer.textContent = this.clock(game.time);
    const zone = playerZone(player);
    n.zone.textContent = ZONES[zone];
    n.noise.style.width = `${threat.noise * 100}%`;
    n.awake.style.width = `${threat.awake * 100}%`;
    n['noise-value'].textContent = `${Math.round(threat.noise * 100)}%`;
    n['awake-value'].textContent = `${Math.round(threat.awake * 100)}%`;
    const warning = threat.warning > 0 ? 'ТЕНЬ ЛАДОНИ · УХОДИ С МЕСТА УДАРА' : enemies.warning;
    n.warning.classList.toggle('hidden', !warning);
    n.warning.textContent = warning;
    n['objective-title'].textContent = route.current.name;
    n['objective-detail'].textContent =
      zone !== route.current.zone
        ? `${zone === 1 ? 'Ты на кровати. Q — спуск на нити у края; R — безопасная точка.' : zone === 2 ? 'Ты на человеке. Двигайся тихо и следи за тенью.' : 'Ты в комнате. Используй мебель и подсвеченные привязки.'} Следующая незавершённая страховка: ${route.current.name}.`
        : route.current.hint;
    n['objective-label'].textContent =
      `СТРАХОВОЧНЫЙ МАРШРУТ ${Math.min(route.index + 1, ROUTE.length)} / ${ROUTE.length}`;
    n['route-progress'].style.width =
      `${(route.hold / (route.index === ROUTE.length - 1 ? 5 : 8)) * 100}%`;
    n.status.textContent =
      route.hold > 0
        ? 'Плетёшь страховку. Стой спокойно, пока кольцо не заполнится.'
        : threat.slow > 0
          ? 'УКЛОНЕНИЕ · МГНОВЕНИЕ ТВОЁ'
          : thread.anchor
            ? 'W — подтянуться · отпусти нить, чтобы сохранить инерцию'
            : 'Замри в светящемся кольце, чтобы закрепить страховочную нить.';
    const dx = route.target.x - player.position.x;
    const dz = route.target.z - player.position.z;
    let angle = Math.atan2(dx, -dz) - input.yaw;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    n.compass.textContent = `${Math.abs(angle) < 0.4 ? '↑' : angle > 0 ? '→' : '←'} ${route.current.name} · ${(Math.hypot(dx, dz) * 0.15).toFixed(1)} м`;
    n.crosshair.classList.toggle('ready', Boolean(thread.candidate));
    n['anchor-hint'].textContent =
      thread.candidate && !thread.anchor ? 'E / ЛКМ — выпустить нить' : '';
    n.performance.textContent = `${Math.round(quality.fps)} FPS · ${quality.level === 'high' ? 'ВЫСОКОЕ' : quality.level === 'medium' ? 'СРЕДНЕЕ' : 'НИЗКОЕ'}`;
    n['quality-status'].textContent = quality.pending
      ? 'НИЗКИЙ FPS: СНИЖЕНИЕ КАЧЕСТВА НА ПАУЗЕ'
      : 'НОЧНАЯ СПАЛЬНЯ / THREE.JS';
  }
}
