// src/main.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { setupSceneContent } from './scene.js';
import GUI from 'https://unpkg.com/lil-gui@0.19.2/dist/lil-gui.esm.js';

const container = document.getElementById('app');

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000, 1.0);
container.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

// scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 3, 8);
scene.add(camera);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x202030, 0.5);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(-6.7, 4.82, 4.82);;
dirLight.castShadow = true;

dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 20;
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;

// IMPORTANT: add target to scene so direction controls work
scene.add(dirLight.target);
scene.add(dirLight);


// ----------------------
// Helpers (visualization)
// ----------------------

const helperParams = {
  showDirLightHelper: true,
  showShadowFrustum: true
};

const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 1.0);
scene.add(dirLightHelper);

const dirLightShadowHelper = new THREE.CameraHelper(dirLight.shadow.camera);
scene.add(dirLightShadowHelper);

// initial visibility from params
dirLightHelper.visible = helperParams.showDirLightHelper;
dirLightShadowHelper.visible = helperParams.showShadowFrustum;



// ----------------------
// GUI: dirLight controls
// ----------------------
const gui = new GUI({ title: 'Lighting' });

const dirParams = {
  // light properties
  color: `#${dirLight.color.getHexString()}`,
  intensity: dirLight.intensity,

  // position
  posX: dirLight.position.x,
  posY: dirLight.position.y,
  posZ: dirLight.position.z,

  // direction (implemented as target position)
  targetX: dirLight.target.position.x,
  targetY: dirLight.target.position.y,
  targetZ: dirLight.target.position.z
};

const dirFolder = gui.addFolder('Directional Light');

dirFolder
  .addColor(dirParams, 'color')
  .name('Color')
  .onChange((v) => dirLight.color.set(v));

dirFolder
  .add(dirParams, 'intensity', 0, 10, 0.01)
  .name('Intensity')
  .onChange((v) => (dirLight.intensity = v));

const posFolder = dirFolder.addFolder('Position');
posFolder.add(dirParams, 'posX', -20, 20, 0.01).name('X').onChange((v) => (dirLight.position.x = v));
posFolder.add(dirParams, 'posY', -20, 20, 0.01).name('Y').onChange((v) => (dirLight.position.y = v));
posFolder.add(dirParams, 'posZ', -20, 20, 0.01).name('Z').onChange((v) => (dirLight.position.z = v));

const dirTargetFolder = dirFolder.addFolder('Direction (Target)');
dirTargetFolder
  .add(dirParams, 'targetX', -20, 20, 0.01)
  .name('Target X')
  .onChange((v) => {
    dirLight.target.position.x = v;
    dirLight.target.updateMatrixWorld();
  });

dirTargetFolder
  .add(dirParams, 'targetY', -20, 20, 0.01)
  .name('Target Y')
  .onChange((v) => {
    dirLight.target.position.y = v;
    dirLight.target.updateMatrixWorld();
  });

dirTargetFolder
  .add(dirParams, 'targetZ', -20, 20, 0.01)
  .name('Target Z')
  .onChange((v) => {
    dirLight.target.position.z = v;
    dirLight.target.updateMatrixWorld();
  });

const helpersFolder = dirFolder.addFolder('Helpers');

helpersFolder
  .add(helperParams, 'showDirLightHelper')
  .name('DirectionalLightHelper')
  .onChange((v) => (dirLightHelper.visible = v));

helpersFolder
  .add(helperParams, 'showShadowFrustum')
  .name('Shadow Frustum')
  .onChange((v) => (dirLightShadowHelper.visible = v));

dirFolder.open();
posFolder.open();
dirTargetFolder.open();
helpersFolder.open();

// scene content
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
