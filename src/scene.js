import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { lightingVertexShader, lightingFragmentShader } from './shaders/lighting.js';
import { floorVertexShader, floorFragmentShader } from './shaders/floorShadowTint.js';

export function setupSceneContent({ scene, camera, renderer, lights }) {
  // Ensure shadow mapping is enabled
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // fine even if our custom floor does hard compare

  // --- Sphere (your existing shader material) ---
  const sphereGeo = new THREE.SphereGeometry(0.7, 4, 4);

  const lightDir = lights?.dirLight
    ? lights.dirLight.position.clone().normalize()
    : new THREE.Vector3(1, 1, 1).normalize();

  const uniforms = {
    uTime: { value: 0.0 },
    uLightDir: { value: lightDir },
    uLightViewProj: { value: new THREE.Matrix4() }, // keep your existing pipeline if needed
    uCameraPos: { value: camera.position },
    uAlbedo: { value: new THREE.Color(0x88b4ff) },
    uMetallic: { value: 0.6 },
    uRoughness: { value: 0.3 }
  };

  const sphereMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: lightingVertexShader,
    fragmentShader: lightingFragmentShader
  });

  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.y = 0.8;
  sphere.castShadow = true;
  scene.add(sphere);

  // --- Floor (custom shadow-tint shader) ---
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  floorGeo.rotateX(-Math.PI / 2);

  const floorUniforms = {
    uShadowMap: { value: null }, // set after first render when available
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowBias: { value: 0.00005 },
    uShadowDarkness: { value: 0.75 },

    uFloorColor: { value: new THREE.Color(0x88b4ff) },
    uShadowTint: { value: new THREE.Color(0xFF0000) }, // pick any tint color you want

    uGridScale:   { value: 20. },   // try 1.0, 2.0, 5.0
    uLineWidth:   { value: 0.2 },  // <= 0.5; typical 0.03–0.12
    uGridFeather: { value: 0.01 }   // small soften amount
  };

  const floorMat = new THREE.ShaderMaterial({
    uniforms: floorUniforms,
    vertexShader: floorVertexShader,
    fragmentShader: floorFragmentShader
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true; // doesn't affect ShaderMaterial, but fine to keep
  scene.add(floor);

  return {
    update(dt, elapsed) {
      uniforms.uTime.value = elapsed;
      sphere.rotation.y += dt * 0.3;

      const dirLight = lights.dirLight;

      // Keep shadow matrix current (includes bias transform)
      floorUniforms.uShadowMatrix.value.copy(dirLight.shadow.matrix);

      // Shadow map texture is created after at least one render
      if (dirLight.shadow.map && dirLight.shadow.map.texture) {
        floorUniforms.uShadowMap.value = dirLight.shadow.map.texture;
      }
    }
  };
}
