// src/scene.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import {
  lightingVertexShader,
  lightingFragmentShader
} from './shaders/lighting.js';

export function setupSceneContent({ scene, camera, renderer, lights }) {
  const lightCam = lights.dirLight.shadow.camera;

  lightCam.updateMatrixWorld();          // make sure matrices are fresh
  lightCam.updateProjectionMatrix();

  const lightViewMatrix = lightCam.matrixWorldInverse;       // V_light
  const lightProjMatrix = lightCam.projectionMatrix;         // P_light

  const lightViewProj = new THREE.Matrix4().multiplyMatrices(
    lightProjMatrix,       // P
    lightViewMatrix        // * V
  );


  // Sphere
  const sphereGeo = new THREE.SphereGeometry(0.7, 4, 4);

  const lightDir = lights?.dirLight
    ? lights.dirLight.position.clone().normalize()
    : new THREE.Vector3(1, 1, 1).normalize();

  const uniforms = {
    uTime: { value: 0.0 },
    uLightDir: { value: lightDir },
    uLightViewProj: { value: lightViewProj },
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
  scene.add(sphere);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  floorGeo.rotateX(-Math.PI / 2);

  const floorMat = new THREE.MeshStandardMaterial({
    uniforms,
    vertexShader: lightingVertexShader,
    fragmentShader: lightingFragmentShader
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  scene.add(floor);

  return {
    update(dt, elapsed) {
      uniforms.uTime.value = elapsed;
      sphere.rotation.y += dt * 0.3;
    }
  };
}
