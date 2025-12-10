// src/scene.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import {
  lightingVertexShader,
  lightingFragmentShader
} from './shaders/lighting.js';

export function setupSceneContent({ scene, camera, renderer, lights }) {
  // 1. 地板：标准材质 + 接收阴影
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  floorGeo.rotateX(-Math.PI / 2);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x222228,
    roughness: 0.9,
    metalness: 0.0
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  scene.add(floor);

  // 2. 球：自定义 ShaderMaterial + 投影
  const sphereGeo = new THREE.SphereGeometry(0.7, 8, 8);

  const lightDir = lights?.dirLight
    ? lights.dirLight.position.clone().normalize()
    : new THREE.Vector3(1, 1, 1).normalize();

  const uniforms = {
    uTime: { value: 0.0 },
    uLightDir: { value: lightDir },
    uCameraPos: { value: camera.position },
    uAlbedo: { value: new THREE.Color(0x88b4ff) },
    uMetallic: { value: 0.1 },
    uRoughness: { value: 0.3 }
  };

  const sphereMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: lightingVertexShader,
    fragmentShader: lightingFragmentShader,
    lights: false
  });

  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.castShadow = true;
  sphere.position.y = 0.8;
  scene.add(sphere);

  return {
    update(dt, elapsed) {
      uniforms.uTime.value = elapsed;
      sphere.rotation.y += dt * 0.3;
    }
  };
}
