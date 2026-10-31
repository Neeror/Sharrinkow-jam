import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Assets, MODEL_NAMES, SPIDER_SCALE } from './assets.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x273440);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.001, 100);
const controls = new OrbitControls(camera, renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x7d6755, 2.5));
const light = new THREE.DirectionalLight(0xffead1, 3);
light.position.set(3, 5, 4);
scene.add(light);
const assets = await new Assets().load((name, fraction) => {
  document.getElementById('progress').textContent = `${name}: ${Math.round(fraction * 100)}%`;
});
const select = document.getElementById('model');
let current;
const bounds = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();
const reports = {};
function show(name) {
  if (current) scene.remove(current);
  current = assets.instantiate(name, name === 'shelves' ? 2.1 : null);
  if (name === 'spider') {
    bounds.setFromObject(current, true).getSize(size);
    current.scale.setScalar(SPIDER_SCALE / Math.max(size.x, size.y, size.z));
  }
  scene.add(current);
  current.updateMatrixWorld(true);
  bounds.setFromObject(current, true);
  bounds.getSize(size);
  bounds.getCenter(center);
  const extent = Math.max(size.x, size.y, size.z);
  camera.position.copy(center).add(new THREE.Vector3(extent, extent * 0.7, extent * 1.4));
  controls.target.copy(center);
  controls.update();
  reports[name] = { dimensions: size.toArray(), meshes: 0, triangles: 0 };
  current.traverse((mesh) => {
    if (!mesh.isMesh) return;
    reports[name].meshes++;
    reports[name].triangles +=
      (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
  });
  document.getElementById('progress').textContent = `${name} · ${size
    .toArray()
    .map((value) => value.toFixed(3))
    .join(' × ')} м · ${reports[name].triangles.toLocaleString('ru')} треугольников`;
}
for (const name of MODEL_NAMES) select.add(new Option(name, name));
select.onchange = () => show(select.value);
show('bed');
await renderer.compileAsync(scene, camera);
window.modelReview = { reports, show, ready: true };
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
