import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import { lightingVertexShader, lightingFragmentShader } from './shaders/lighting.js';
import { floorVertexShader, floorFragmentShader } from './shaders/floorShadowTint.js';

export function setupSceneContent({ scene, camera, renderer, lights }) {
  // Ensure shadow mapping is enabled
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // fine even if our custom floor does hard compare

  // --- Floor (custom shadow-tint shader) ---
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  floorGeo.rotateX(-Math.PI / 2);

  const floorUniforms = {
    uShadowMap: { value: null }, // set after first render when available
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowBias: { value: 0.00005 },
    uShadowDarkness: { value: 0.75 },

    uFloorColor: { value: new THREE.Color(0x88b4ff) },
    uShadowTint: { value: new THREE.Color(0xFF0000) }
  };

  const floorMat = new THREE.ShaderMaterial({
    uniforms: floorUniforms,
    vertexShader: floorVertexShader,
    fragmentShader: floorFragmentShader
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true; // doesn't affect ShaderMaterial, but fine to keep
  scene.add(floor);



  // --- FBX Animated Model ---
  const fbxLoader = new FBXLoader();

  // Keep these references so update() can advance animation.
  let mixer = null;

  fbxLoader.load(
    './models/Walking.fbx', // <-- change to your FBX path
    (fbx) => {
      // Shadows + basic traversal setup
      fbx.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      // Typical FBX scale/position adjustments
      fbx.scale.setScalar(0.015);
      fbx.position.set(0, 0, 0);
      fbx.rotation.y = - Math.PI / 4;

      scene.add(fbx);

      // Animation: FBXLoader usually puts clips on fbx.animations
      if (fbx.animations && fbx.animations.length) {
        mixer = new THREE.AnimationMixer(fbx);

        // Play the first clip by default
        const action = mixer.clipAction(fbx.animations[0]);
        action.play();
      }
    },
    (err) => {
      console.error('FBX load error:', err);
    }
  );


  return {
    update(dt, elapsed) {
      const dirLight = lights.dirLight;

      // Keep shadow matrix current (includes bias transform)
      floorUniforms.uShadowMatrix.value.copy(dirLight.shadow.matrix);

      // Shadow map texture is created after at least one render
      if (dirLight.shadow.map && dirLight.shadow.map.texture) {
        floorUniforms.uShadowMap.value = dirLight.shadow.map.texture;
      }

      if (mixer) mixer.update(dt);
    }
  };
}
