// src/main.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { setupSceneContent } from './scene.js';

const container = document.getElementById('app');

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000, 1.0);
container.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 1.5, 4);
scene.add(camera);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x202030, 0.5);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(3, 8, 2);
dirLight.castShadow = true;

dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 20;
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;

scene.add(dirLight);

const sceneState = setupSceneContent({
  scene,
  camera,
  renderer,
  lights: { dirLight, hemiLight }
});

let lastTime = performance.now();

function animate(now) {
  const dt = (now - lastTime) / 1000.0;
  lastTime = now;

  if (sceneState && typeof sceneState.update === 'function') {
    sceneState.update(dt, now / 1000.0);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// resize
window.addEventListener('resize', () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});
