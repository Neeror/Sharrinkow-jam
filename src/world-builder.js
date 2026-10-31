import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class WorldBuilder {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.solids = [];
    this.batches = new Map();
    this.shapes = {
      box: new THREE.BoxGeometry(1, 1, 1),
      round: new RoundedBoxGeometry(1, 1, 1, 2, 0.09),
      ball: new THREE.SphereGeometry(1, 24, 16),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
    };
    this.objects = [];
    this.inverseScene = new THREE.Matrix4();
    this.localMatrix = new THREE.Matrix4();
  }

  add(shape, material, position, scale, options = {}) {
    const geometry = typeof shape === 'string' ? this.shapes[shape] : shape;
    const mesh = new THREE.Mesh(geometry, this.materials[material] || material);
    mesh.position.fromArray(position);
    mesh.scale.fromArray(scale);
    if (options.rotation) mesh.rotation.fromArray(options.rotation);
    mesh.castShadow = options.shadow !== false;
    mesh.receiveShadow = true;
    mesh.name = options.name || material;
    mesh.updateMatrix();
    const parent = options.parent || this.scene;
    if (options.dynamic || options.parent) parent.add(mesh);
    else {
      if (!this.batches.has(mesh.material)) this.batches.set(mesh.material, []);
      const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      if (baked.attributes.uv1) baked.deleteAttribute('uv1');
      this.batches.get(mesh.material).push(baked.applyMatrix4(mesh.matrix));
    }
    if (options.solid) {
      const inverse = mesh.matrix.clone().invert();
      this.solids.push({
        mesh,
        inverse,
        type: shape === 'ball' ? 'sphere' : 'box',
        material,
        moving: Boolean(options.parent || options.dynamic),
      });
    }
    this.objects.push(mesh.name);
    return mesh;
  }

  box(material, position, scale, options = {}) {
    return this.add('round', material, position, scale, options);
  }

  ball(material, position, scale, options = {}) {
    return this.add('ball', material, position, scale, options);
  }

  tube(material, points, radius = 0.035, parent = null) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.add(
      new THREE.TubeGeometry(curve, points.length * 8, radius, 6, false),
      material,
      [0, 0, 0],
      [1, 1, 1],
      { parent },
    );
  }

  finish() {
    for (const [material, geometries] of this.batches) {
      const combined = mergeGeometries(geometries, false);
      const mesh = new THREE.Mesh(combined, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'static-batch';
      this.scene.add(mesh);
      for (const geometry of geometries) geometry.dispose();
    }
    this.batches.clear();
    this.scene.updateMatrixWorld(true);
    this.sync();
  }

  sync() {
    this.scene.updateWorldMatrix(true, false);
    this.inverseScene.copy(this.scene.matrixWorld).invert();
    for (let i = 0; i < this.solids.length; i++) {
      const solid = this.solids[i];
      if (solid.moving) {
        solid.mesh.updateWorldMatrix(true, false);
        this.localMatrix.multiplyMatrices(this.inverseScene, solid.mesh.matrixWorld);
        solid.inverse.copy(this.localMatrix).invert();
      }
    }
  }
}
