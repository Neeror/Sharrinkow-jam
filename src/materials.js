import * as THREE from 'three';

export function randomSource(seed = 72) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surfaceMaps(kind, base) {
  const size = 256;
  const random = randomSource(91 + kind.length);
  const height = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(color.length);
  const tint = new THREE.Color(base);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const noise = random() - 0.5;
      let value = noise * 0.16;
      if (kind === 'wood')
        value += Math.sin(x * 0.34 + Math.sin(y * 0.024) * 4) * 0.22 + Math.sin(x * 1.8) * 0.04;
      if (kind === 'fabric')
        value += Math.sin((x * Math.PI) / 2) * Math.cos((y * Math.PI) / 2) * 0.26;
      if (kind === 'skin')
        value +=
          Math.pow(Math.abs(Math.sin(x * 0.08 + Math.sin(y * 0.05))), 22) * -0.2 +
          (random() > 0.97 ? -0.45 : 0);
      if (kind === 'metal') value += Math.sin(y * 2) * 0.035;
      height[i] = value;
      const brightness = 0.86 + value * 0.45;
      color[i * 4] = Math.min(255, tint.r * 255 * brightness);
      color[i * 4 + 1] = Math.min(255, tint.g * 255 * brightness);
      color[i * 4 + 2] = Math.min(255, tint.b * 255 * brightness);
      color[i * 4 + 3] = 255;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = (height[y * size + ((x + 1) % size)] - height[i]) * 1.8;
      const dy = (height[((y + 1) % size) * size + x] - height[i]) * 1.8;
      const length = Math.hypot(dx, dy, 1);
      normal[i * 4] = (0.5 - (dx / length) * 0.5) * 255;
      normal[i * 4 + 1] = (0.5 - (dy / length) * 0.5) * 255;
      normal[i * 4 + 2] = (0.5 + 0.5 / length) * 255;
      normal[i * 4 + 3] = 255;
    }
  }
  function texture(data) {
    const result = new THREE.DataTexture(data, size, size);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.magFilter = THREE.LinearFilter;
    result.minFilter = THREE.LinearMipmapLinearFilter;
    result.generateMipmaps = true;
    result.repeat.set(kind === 'fabric' ? 9 : 3, 3);
    result.needsUpdate = true;
    return result;
  }
  return { map: texture(color), normalMap: texture(normal) };
}

export function makeMaterials() {
  function material(kind, color, options = {}) {
    return new THREE.MeshStandardMaterial({
      ...surfaceMaps(kind, color),
      roughness: 0.76,
      ...options,
    });
  }
  const skin = new THREE.MeshPhysicalMaterial({
    ...surfaceMaps('skin', '#c59380'),
    roughness: 0.49,
    clearcoat: 0.23,
    clearcoatRoughness: 0.32,
  });
  skin.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
      outgoingLight += vec3(0.18, 0.022, 0.012) * rim;
      #include <opaque_fragment>
    `,
    );
  };
  return {
    wood: material('wood', '#795139'),
    darkWood: material('wood', '#382e2a'),
    floor: material('wood', '#9b7452'),
    wall: material('plaster', '#758a89'),
    trim: material('wood', '#b2ab92'),
    cloth: material('fabric', '#2b5961', { roughness: 0.98 }),
    sheet: material('fabric', '#b1b4a5', { roughness: 0.96 }),
    sofa: material('fabric', '#775649', { roughness: 0.98 }),
    rug: material('fabric', '#7d5040'),
    metal: material('metal', '#7f8587', { metalness: 0.78, roughness: 0.28 }),
    brass: material('metal', '#b89a58', { metalness: 0.72, roughness: 0.3 }),
    black: material('metal', '#131c23', { roughness: 0.36 }),
    paper: material('paper', '#c1b38c'),
    ceramic: material('plaster', '#597981', { roughness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x758fa6,
      metalness: 0.15,
      roughness: 0.12,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    }),
    skin,
    hair: new THREE.MeshStandardMaterial({ color: 0x29201b, roughness: 0.75 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xb9e9bc }),
    phone: new THREE.MeshBasicMaterial({ color: 0x7faebc }),
    shade: material('fabric', '#dfbb7a', {
      emissive: 0x4a260c,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    }),
  };
}
