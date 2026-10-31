import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const SPIDER_SCALE = 0.09;
export const MODEL_NAMES = [
  'bed',
  'spider',
  'sofa',
  'desk',
  'shelves',
  'lamp',
  'picture',
  'statue',
  'human',
];

export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();
  }

  async load(progress = () => {}) {
    for (let index = 0; index < MODEL_NAMES.length; index++) {
      const name = MODEL_NAMES[index];
      const model = await this.loader.loadAsync(`/models/${name}.glb`, (event) => {
        progress(
          name,
          (index + (event.total ? event.loaded / event.total : 0)) / MODEL_NAMES.length,
        );
      });
      this.cache.set(name, model);
      progress(name, (index + 1) / MODEL_NAMES.length);
    }
    return this;
  }

  instantiate(name, height = null) {
    const asset = this.cache.get(name);
    if (!asset) throw new Error(`Model not loaded: ${name}`);
    const object = clone(asset.scene);
    object.updateMatrixWorld(true);
    object.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.isSkinnedMesh) mesh.computeBoundingBox();
    });
    const bounds = new THREE.Box3().setFromObject(object, true);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const factor = height ? height / size.y : 1;
    const group = new THREE.Group();
    object.position.x -= center.x;
    object.position.y -= bounds.min.y;
    object.position.z -= center.z;
    group.add(object);
    group.scale.setScalar(factor);
    group.name = name;
    group.userData.animations = asset.animations;
    group.userData.model = object;
    return group;
  }
}
