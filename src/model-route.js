import * as THREE from 'three';
import { ROUTE, updateAnchorVisuals } from './route.js';

export function bindModelRoute(world, collision, anchors) {
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const positions = [
    [-10.5, 0.2, 10],
    [-14.8, 0.2, -5],
    [-8.5, 5.4, -18],
    [17.6, 0.2, -10.5],
    [13, 3.95, 8],
    [6, 3, 2],
    [-1, 3, -4],
    [3, 4, -11.5],
  ];
  const jointNames = ['DEF-upper_armR', 'DEF-forearmR', 'DEF-forearmR001', 'DEF-handR'];
  for (const name of jointNames) {
    const point = world.human.joints.get(name);
    if (!point) throw new Error(`Missing route joint: ${name}`);
    positions.push(point.toArray());
  }
  for (let index = 0; index < positions.length; index++) {
    const position = positions[index];
    origin.set(position[0], index === 0 || index === 1 || index === 3 ? 0.8 : 9, position[2]);
    const hit = collision.cast(origin, down, 12);
    if (!hit) throw new Error(`Route marker has no surface: ${index}`);
    position[1] = hit.point.y + 0.16;
    ROUTE[index].position = position;
  }
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (index >= 18) {
      anchor.position.fromArray(ROUTE[index - 10].position);
      anchor.position.y -= 0.16;
    } else {
      origin.set(anchor.position.x, 16, anchor.position.z);
      const hit = collision.cast(origin, down, 18);
      if (hit) anchor.position.copy(hit.point);
    }
    anchor.position.y = Math.max(0, anchor.position.y);
    anchor.base = anchor.position.y;
    updateAnchorVisuals(anchor);
  }
}
