import * as THREE from 'three';

export class CollisionDebug {
  constructor(root, collision, player) {
    this.collision = collision;
    if (!import.meta.env.DEV) {
      this.group = { visible: false };
      return;
    }
    this.player = player;
    this.group = new THREE.Group();
    this.group.visible = false;
    root.add(this.group);
    this.material = new THREE.MeshBasicMaterial({
      color: 0x43ffd1,
      wireframe: true,
      depthTest: false,
      transparent: true,
      opacity: 0.35,
    });
    this.meshes = collision.solids.map((solid) => {
      const geometry =
        solid.type === 'mesh'
          ? solid.geometry
          : solid.type === 'sphere'
            ? new THREE.SphereGeometry(1, 12, 8)
            : new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 100;
      this.group.add(mesh);
      return mesh;
    });
    this.directions = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];
    this.arrows = this.directions.map(() => {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        player.position,
        0.8,
        0xffcf54,
      );
      this.group.add(arrow);
      return arrow;
    });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'F3' || event.repeat) return;
      event.preventDefault();
      this.group.visible = !this.group.visible;
    });
  }

  update() {
    if (!this.group.visible) return;
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].matrix.copy(this.collision.solids[i].inverse).invert();
    }
    this.directions[0].copy(this.player.facing);
    this.directions[1].copy(this.player.normal).negate();
    this.directions[2].crossVectors(this.player.facing, this.player.normal).normalize();
    this.directions[3].copy(this.directions[2]).negate();
    for (let i = 0; i < this.arrows.length; i++) {
      const direction = this.directions[i];
      const hit = this.collision.cast(this.player.position, direction, 0.8);
      const arrow = this.arrows[i];
      arrow.position.copy(this.player.position);
      arrow.setDirection(direction);
      arrow.setLength(hit ? hit.distance : 0.8, 0.06, 0.04);
      arrow.setColor(hit ? 0xff5959 : 0xffcf54);
    }
  }
}
