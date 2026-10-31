import { ROUTE } from './route.js';

const audioSamples = new Float32Array(256);

function readAudioPeak(sound) {
  if (!sound?.meter) return 0;
  sound.meter.getFloatTimeDomainData(audioSamples);
  let peak = 0;
  for (let i = 0; i < audioSamples.length; i++) {
    peak = Math.max(peak, Math.abs(audioSamples[i]));
  }
  return peak;
}

export function installDiagnostics(context) {
  const {
    game,
    player,
    follow,
    thread,
    threat,
    enemies,
    route,
    input,
    renderer,
    quality,
    world,
    camera,
  } = context;
  if (!import.meta.env.DEV) return;
  const debug = new URLSearchParams(location.search).has('debug');
  if (debug || new URLSearchParams(location.search).has('test-controls')) window.gameTest = context;
  const panel = document.createElement('div');
  panel.id = 'debug-controls';
  panel.hidden = !debug;
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Отладочная зона');
  for (let i = 0; i < ROUTE.length; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i + 1} · ${ROUTE[i].name}`;
    select.append(option);
  }
  const teleport = document.createElement('button');
  teleport.textContent = 'Телепорт';
  teleport.onclick = () => {
    if (game.phase !== 'playing') game.start(true);
    game.debugRun = true;
    thread.release();
    route.index = Number(select.value);
    route.completed = false;
    route.hold = 0;
    route.target.fromArray(route.current.position);
    route.marker.position.copy(route.target);
    player.reset(route.target);
    follow.ready = false;
  };
  const finish = document.createElement('button');
  finish.textContent = 'Сцена укуса';
  finish.onclick = () => {
    select.value = ROUTE.length - 1;
    teleport.onclick();
    route.marker.visible = false;
    for (const anchor of thread.anchors) {
      anchor.marker.visible = false;
      anchor.stalk.visible = false;
    }
    game.setPhase('ending');
  };
  panel.append(select, teleport, finish);
  document.body.append(panel);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'F3' && !event.repeat) panel.hidden = !panel.hidden;
  });
  if (debug) context.collisionDebug.group.visible = true;
  window.gameDiagnostics = (detailed = true) => ({
    version: '2.0.0',
    phase: game.phase,
    time: game.time,
    endingTime: context.ending.time,
    detections: game.detections || 0,
    defeats: game.defeats || 0,
    retries: game.retries,
    reason: game.reason,
    audioState: context.sound?.context?.state || 'not-started',
    audioEnabled: context.sound?.enabled ?? false,
    audioPeak: readAudioPeak(context.sound),
    position: player.position.toArray(),
    normal: player.normal.toArray(),
    velocity: player.velocity.toArray(),
    grounded: player.grounded,
    material: player.material,
    noise: threat.noise,
    awake: threat.awake,
    warning: threat.warning,
    dodges: threat.dodges,
    attached: Boolean(thread.anchor),
    candidate: thread.candidate?.id,
    ropeLength: thread.length,
    camera: camera.position.toArray(),
    cameraDistance: camera.position.distanceTo(follow.target),
    yaw: input.yaw,
    pitch: input.pitch,
    locked: input.locked,
    route: route.index,
    hold: route.hold,
    target: route.target.toArray(),
    checkpoint: route.checkpoint,
    cat: enemies.cat.position.toArray(),
    catMode: enemies.catMode,
    lamp: enemies.lampOn,
    wind: enemies.wind.toArray(),
    tape: enemies.tapeTime,
    swatter: enemies.swatWarning,
    swatTarget: enemies.swatTarget.toArray(),
    handTarget: threat.target.toArray(),
    quality: quality.level,
    pendingQuality: quality.pending,
    fps: quality.fps,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    objects: world.builder.objects.length,
    humanJoints:
      detailed && world.human.joints
        ? Object.fromEntries(
            [...world.human.joints]
              .filter(([name]) => /DEF.*(upper_arm|forearm|hand)/.test(name))
              .map(([name, point]) => [name, point.toArray()]),
          )
        : undefined,
    anchors: detailed
      ? thread.anchors.map((anchor) => {
          const projected = anchor.position.clone().project(camera);
          return {
            id: anchor.id,
            position: anchor.position.toArray(),
            screen: projected.toArray(),
            distance: player.position.distanceTo(anchor.position),
          };
        })
      : undefined,
  });
}
