import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function makeEffects(renderer, scene, camera) {
  const depthTarget = new THREE.WebGLRenderTarget(
    Math.ceil(innerWidth / 2),
    Math.ceil(innerHeight / 2),
  );
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    blending: THREE.NoBlending,
  });
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const depth = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
      focus: { value: 3 },
      nearPlane: { value: camera.near },
      farPlane: { value: camera.far },
      strength: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      #include <packing>
      uniform vec2 resolution;
      uniform float focus;
      uniform float nearPlane;
      uniform float farPlane;
      uniform float strength;
      varying vec2 vUv;
      void main() {
        float z = unpackRGBAToDepth(texture2D(tDepth, vUv));
        float distance = nearPlane * farPlane / (farPlane - z * (farPlane - nearPlane));
        float radius = clamp(abs(distance - focus) / max(distance, 0.01) * 3.0, 0.0, 2.0) * strength;
        vec2 offset = radius / resolution;
        vec3 color = texture2D(tDiffuse, vUv).rgb * 0.2;
        for (int i = 0; i < 8; i++) {
          float angle = float(i) * 0.785398;
          color += texture2D(tDiffuse, vUv + vec2(cos(angle), sin(angle)) * offset).rgb * 0.1;
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  depth.uniforms.tDepth.value = depthTarget.texture;
  composer.addPass(depth);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth / 2, innerHeight / 2),
    0.24,
    0.5,
    0.95,
  );
  composer.addPass(bloom);
  const film = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float time;
      varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5;
        vec2 offset = q * 0.0008;
        vec3 color = texture2D(tDiffuse, vUv).rgb;
        color.r = texture2D(tDiffuse, vUv + offset).r;
        color.b = texture2D(tDiffuse, vUv - offset).b;
        float grain = fract(sin(dot(vUv + fract(time), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        color *= 1.0 - dot(q, q) * 0.5;
        color += grain * 0.009;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  composer.addPass(film);
  composer.addPass(new OutputPass());
  return {
    composer,
    async prepare() {
      scene.overrideMaterial = depthMaterial;
      await renderer.compileAsync(scene, camera);
      scene.overrideMaterial = null;
      for (let i = 0; i < 3; i++) {
        this.render();
        await new Promise(requestAnimationFrame);
      }
    },
    update(time, player) {
      film.uniforms.time.value = time;
      depth.uniforms.focus.value = camera.position.distanceTo(player.renderPosition);
    },
    render() {
      if (depth.enabled) {
        const background = scene.background;
        scene.background = null;
        scene.overrideMaterial = depthMaterial;
        renderer.setRenderTarget(depthTarget);
        renderer.setClearColor(0xffffff);
        renderer.clear();
        const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        renderer.render(scene, camera);
        renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        scene.overrideMaterial = null;
        scene.background = background;
        renderer.setRenderTarget(null);
      }
      composer.render();
    },
    resize() {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(innerWidth, innerHeight);
      depthTarget.setSize(Math.ceil(innerWidth / 2), Math.ceil(innerHeight / 2));
      depth.uniforms.resolution.value.set(
        innerWidth * renderer.getPixelRatio(),
        innerHeight * renderer.getPixelRatio(),
      );
    },
    quality(level) {
      depth.enabled = level === 'high';
      bloom.enabled = level !== 'low';
      this.resize();
    },
  };
}
