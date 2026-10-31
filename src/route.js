import * as THREE from 'three';

export const ROUTE = [
  {
    name: 'Под диваном',
    position: [-10.5, 0.2, 10],
    zone: 0,
    hint: 'Ткань глушит шаги. Держись края ковра: кот слышит бег по паркету.',
  },
  {
    name: 'Корешки книг',
    position: [-15, 0.2, -6],
    zone: 0,
    hint: 'Пройди вдоль дивана к книжной полке. Липкую ленту можно перепрыгнуть или обойти по стене.',
  },
  {
    name: 'Письменный стол',
    position: [-9, 4.8, -18],
    zone: 0,
    hint: 'Поднимись по ножке стола или используй подсвеченную привязку. Берегись вентилятора.',
  },
  {
    name: 'За шкафом',
    position: [17.6, 0.2, -10.5],
    zone: 0,
    hint: 'Спустись и обогни изголовье. Не беги возле кота. На стенах безопаснее.',
  },
  {
    name: 'Свет телефона',
    position: [13, 3.95, 8],
    zone: 0,
    hint: 'Доберись до тумбочки. Когда лампа вспыхнет, замри или уйди в тень.',
  },
  {
    name: 'Край одеяла',
    position: [6, 4.1, 3.3],
    zone: 1,
    checkpoint: true,
    hint: 'Первый чекпоинт. Поднимайся на кровать. Мухобойка отмечает место удара красным.',
  },
  {
    name: 'Левая складка',
    position: [0.15, 3.9, -5],
    zone: 1,
    hint: 'Проложи страховку по краю ткани, подальше от тяжёлого дыхания.',
  },
  {
    name: 'Подушка',
    position: [2, 4.3, -12.7],
    zone: 1,
    hint: 'Не прыгай у головы. На ткани можно подкрадываться почти бесшумно.',
  },
  {
    name: 'Правое плечо',
    position: [7.6, 4.95, -8],
    zone: 2,
    checkpoint: true,
    hint: 'Второй чекпоинт. Рука двигается. Держи нить наготове и следи за тенью.',
  },
  {
    name: 'Локоть',
    position: [8.4, 4.85, -5.2],
    zone: 2,
    hint: 'Здесь сон чуткий. Поры и волоски дают зацепы, но резкие рывки шумят.',
  },
  {
    name: 'Запястье',
    position: [8.6, 4.65, -1.4],
    zone: 2,
    hint: 'Последняя страховка. Ладонь бьёт туда, где ты был в начале предупреждения.',
  },
  {
    name: 'Кисть',
    position: [8.6, 4.5, 0.6],
    zone: 2,
    hint: 'Останься неподвижным у финиша и закончи путь.',
  },
];

export const ANCHOR_MARKER_HEIGHT = 0.5;

export function updateAnchorVisuals(anchor) {
  anchor.marker.position.copy(anchor.position);
  anchor.marker.position.y += ANCHOR_MARKER_HEIGHT;
  anchor.stalk.position.copy(anchor.position);
  anchor.stalk.position.y += ANCHOR_MARKER_HEIGHT / 2;
}

export function makeAnchors(scene, materials) {
  const locations = [
    [-7, 1.2, 18.8],
    [-11, 3, 10.5],
    [-11.2, 3.8, 1.4],
    [-16, 3, -5.8],
    [-13, 4.8, -16.8],
    [-9, 5.5, -18],
    [-4.8, 4.9, -19],
    [1, 5.7, -15.3],
    [10.8, 5.7, -15.3],
    [12, 8.5, -12.3],
    [18.7, 5, -5.5],
    [18.7, 5, 7.3],
    [13, 5.2, 8],
    [10.5, 5, 4],
    [5.8, 5.2, 3],
    [0.8, 5.1, -2],
    [0.7, 5.1, -7.5],
    [2, 5.4, -12.7],
    [7.6, 5.9, -8],
    [8.4, 5.6, -5],
    [8.6, 5.4, -1.8],
    [9, 5.2, 0.7],
  ];
  const geometry = new THREE.SphereGeometry(0.055, 10, 8);
  const ringGeometry = new THREE.TorusGeometry(0.12, 0.009, 4, 20);
  const stalkMaterial = materials.hair;
  return locations.map((position, index) => {
    const point = new THREE.Vector3(...position);
    const marker = new THREE.Mesh(geometry, materials.glow);
    marker.position.copy(point);
    const ring = new THREE.Mesh(ringGeometry, materials.glow);
    marker.add(ring);
    scene.add(marker);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.018, 0.5, 5), stalkMaterial);
    scene.add(stalk);
    const anchor = {
      id: index,
      position: point,
      marker,
      ring,
      stalk,
      base: point.y,
      human: index >= 18,
    };
    updateAnchorVisuals(anchor);
    return anchor;
  });
}

export class Route {
  constructor(scene) {
    this.index = 0;
    this.hold = 0;
    this.completed = false;
    this.checkpoint = 0;
    this.checkpointPosition = new THREE.Vector3(-7, 0.16, 21);
    this.justCheckpoint = false;
    this.target = new THREE.Vector3(...ROUTE[0].position);
    const material = new THREE.MeshBasicMaterial({
      color: 0xcce8a6,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.014, 5, 40), material);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.copy(this.target);
    scene.add(this.marker);
  }

  get current() {
    return ROUTE[Math.min(this.index, ROUTE.length - 1)];
  }

  update(dt, player) {
    this.justCheckpoint = false;
    if (this.completed) return;
    const close =
      player.position.distanceTo(this.target) < 1.25 &&
      Math.abs(player.position.y - this.target.y) < 0.5 &&
      player.normal.y > 0.45;
    if (close && player.speed < 0.25) this.hold += dt;
    else this.hold = Math.max(0, this.hold - dt * 2);
    if (this.hold >= (this.index === ROUTE.length - 1 ? 5 : 8)) {
      this.hold = 0;
      if (this.current.checkpoint) {
        this.checkpoint = this.index;
        this.checkpointPosition.copy(player.position);
        this.justCheckpoint = true;
      }
      this.index++;
      if (this.index >= ROUTE.length) {
        this.completed = true;
        this.marker.visible = false;
        return;
      }
      this.target.fromArray(this.current.position);
      this.marker.position.copy(this.target);
    }
    this.marker.rotation.z += dt;
  }

  restart(full) {
    this.index = full ? 0 : this.checkpoint;
    this.hold = 0;
    this.completed = false;
    if (full) {
      this.checkpoint = 0;
      this.checkpointPosition.set(-7, 0.16, 21);
    }
    this.target.fromArray(this.current.position);
    this.marker.position.copy(this.target);
    this.marker.visible = true;
  }
}
