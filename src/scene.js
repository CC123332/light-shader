import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { floorVertexShader, floorFragmentShader } from './shaders/floorShadowTint.js';

export function setupSceneContent({ scene, camera, renderer, lights }) {
  // Ensure shadow mapping is enabled
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // fine even if our custom floor does hard compare

  // --- Floor (custom shadow-tint shader) ---
  const floorGeo = new THREE.PlaneGeometry(20, 60);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.rotateY(-Math.PI / 4);

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
  floor.receiveShadow = true;
  floor.position.set(24, 0, -12);
  scene.add(floor);


  function makeDashedLineShadowMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      metalness: .0
    });

    mat.onBeforeCompile = (shader) => {
      const usesPCFragColor = shader.fragmentShader.includes('pc_fragColor');
      const outVar = usesPCFragColor ? 'pc_fragColor' : 'gl_FragColor';

      /* ============================
        Vertex shader modifications
        ============================ */

      // Pass object-space position to fragment shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vObjectPosition;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vObjectPosition = position;
        `
      );

      /* ============================
        Fragment shader modifications
        ============================ */

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
          #include <common>
          varying vec3 vObjectPosition;

          // localXZ: object-space XZ position (model-relative)
          // period: distance between lines in object units
          // lineWidth: thickness in [0..0.5]
          // angle: rotation in radians in the XZ plane
          float diagLinesMask(vec2 localXZ, float period, float lineWidth, float angle)
          {
              float c = cos(angle);
              float s = sin(angle);

              // Rotate in XZ plane
              vec2 rotated = vec2(
                  c * localXZ.x - s * localXZ.y,
                  s * localXZ.x + c * localXZ.y
              );

              float u = (rotated.x + rotated.y) / period;
              float f = fract(u);
              float w = clamp(lineWidth, 0.0, 0.5);

              return (step(f, w) + step(1.0 - w, f)) > 0.0 ? 1.0 : 0.0;
          }

        `
      );

      /* ============================
        Final color override
        ============================ */

      shader.fragmentShader = shader.fragmentShader.replace(
        /}\s*$/,
        `
          vec3 currentRGB = ${outVar}.rgb;

          // Luminance of the shaded surface
          float val = dot(currentRGB, vec3(0.2126, 0.7152, 0.0722));

          // Smooth black/white classification
          float threshold = 0.3;
          float edge = fwidth(val);
          float bw = smoothstep(threshold - edge, threshold + edge, val);
          // bw = 0 -> black region, bw = 1 -> white region

          // Hatch parameters
          float period = 4.0;
          float lineWidth = 0.08;
          float angle = 0.0;

          // Anti-aliased hatch (object-space XY)
          float hatch = diagLinesMask(vObjectPosition.xy, period, lineWidth, angle);

          // Blend hatch into black region, solid white elsewhere
          float colorBW = mix(hatch, 1.0, bw);

          ${outVar} = vec4(vec3(colorBW), ${outVar}.a);
        }
        `
      );

      mat.userData.shader = shader;
    };

    mat.needsUpdate = true;
    return mat;
  }

  function makeDotShadowMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      metalness: 0.0
    });

    mat.onBeforeCompile = (shader) => {
      const usesPCFragColor = shader.fragmentShader.includes('pc_fragColor');
      const outVar = usesPCFragColor ? 'pc_fragColor' : 'gl_FragColor';

      /* ============================
        Fragment shader modifications
        ============================ */

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
          #include <common>

          // Screen-space dot mask in *pixel* units using gl_FragCoord.xy.
          // fragPx: pixel coords (gl_FragCoord.xy)
          // periodPx: spacing between dot centers (pixels)
          // radiusPx: dot radius (pixels)
          // angle: rotation (radians)
          float dotMaskPx(vec2 fragPx, float periodPx, float radiusPx, float angle)
          {
            float c = cos(angle);
            float s = sin(angle);

            // Rotate around origin in screen space
            vec2 r = vec2(
              c * fragPx.x - s * fragPx.y,
              s * fragPx.x + c * fragPx.y
            );

            // Repeating cell centered at 0 in pixel units
            vec2 cell = fract(r / periodPx + 0.5) - 0.5;

            // Pixel distance to dot center
            float d = length(cell * periodPx);

            // Anti-alias in pixel space
            float aa = fwidth(d);

            return smoothstep(radiusPx - aa, radiusPx + aa, d);
          }
        `
      );

      /* ============================
        Final color override
        ============================ */

      shader.fragmentShader = shader.fragmentShader.replace(
        /}\s*$/,
        `
          vec3 currentRGB = ${outVar}.rgb;

          // Luminance of the shaded surface
          float val = dot(currentRGB, vec3(0.2126, 0.7152, 0.0722));

          // Smooth black/white classification
          float threshold = 0.5;
          float edge = fwidth(val);
          float bw = smoothstep(threshold - edge, threshold + edge, val);
          // bw = 0 -> "black region", bw = 1 -> "white region"

          // Pixel coords (no stretching)
          vec2 fragPx = gl_FragCoord.xy;

          // Dot parameters in pixels
          float periodPx = 8.0; // spacing in pixels
          float angle    = 0.0; // rotate dot grid if desired

          // Radius selection based on luminance
          float radiusPx;
          if (val < 0.1) {
            radiusPx = 3.0;
          } else if (val < 0.3) {
            radiusPx = 2.0;
          } else {
            radiusPx = 1.0;
          }

          float dots = dotMaskPx(fragPx, periodPx, radiusPx, angle);

          // Dots in the black region, solid white elsewhere
          float colorBW = mix(dots, 1.0, bw);

          ${outVar} = vec4(vec3(colorBW), ${outVar}.a);

        }
        `
      );

      mat.userData.shader = shader;
    };

    mat.needsUpdate = true;
    return mat;
  }

function makeNoiseShadowMaterial(noiseTexture) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0
  });

  // Texture setup for mask usage
  noiseTexture.wrapS = THREE.RepeatWrapping;
  noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTexture.magFilter = THREE.LinearFilter;
  noiseTexture.generateMipmaps = true;

  mat.onBeforeCompile = (shader) => {
    const usesPCFragColor = shader.fragmentShader.includes('pc_fragColor');
    const outVar = usesPCFragColor ? 'pc_fragColor' : 'gl_FragColor';

    // Inject uniforms
    shader.uniforms.uNoiseTex = { value: noiseTexture };
    shader.uniforms.uNoiseScalePx = { value: 200.0 }; // pixels per noise tile

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>

      uniform sampler2D uNoiseTex;
      uniform float uNoiseScalePx;

      // Screen-space noise lookup in pixel units
      float noiseMaskPx(vec2 fragPx, float scalePx) {
        // Convert pixel coordinates into repeating UVs
        vec2 uv = fragPx / scalePx;
        return texture2D(uNoiseTex, uv).r;
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      /}\s*$/,
      `
      vec3 currentRGB = ${outVar}.rgb;

      // Luminance
      float val = dot(currentRGB, vec3(0.2126, 0.7152, 0.0722));

      vec2 fragPx = gl_FragCoord.xy;

      // Noise sample (0..1)
      float n = noiseMaskPx(fragPx, uNoiseScalePx);

      // Luminance-driven noise contrast
      float cutoff;
      if (val < 0.3) {
        cutoff = 0.7;
      } else if (val < 0.6) {
        cutoff = 0.6;
      } else {
        cutoff = 0.5;
      }

      float aa = fwidth(n);
      float noiseBW = smoothstep(cutoff - aa, cutoff + aa, n);

      // Noise only in dark regions
      float colorBW = noiseBW;

      ${outVar} = vec4(vec3(colorBW), ${outVar}.a);
      }
      `
    );

    mat.userData.shader = shader;
  };

  mat.needsUpdate = true;
  return mat;
}


  let fbxRoot = null;
  let mixer = null;

  const fbxLoader = new FBXLoader();

  fbxLoader.load('./models/character.fbx', (fbx) => {
    fbxRoot = fbx;
    fbxRoot.scale.setScalar(0.03);
    fbxRoot.position.set(0, 0, 0);
    fbxRoot.rotation.y =  - Math.PI / 4;
    scene.add(fbxRoot);

    fbxRoot.traverse((obj) => {
      if (obj.isSkinnedMesh) {
        // const m = makeDotShadowMaterial();
        const noiseTexturePath = './src/noise3.png';
        const noiseTexture = new THREE.TextureLoader().load(noiseTexturePath);
        const m = makeNoiseShadowMaterial(noiseTexture);
        m.skinning = true;          // important for SkinnedMesh
        obj.material = m;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });


    // if (fbx.animations?.length) {
    //   mixer = new THREE.AnimationMixer(fbxRoot);
    //   mixer.clipAction(fbx.animations[0]).play();
    // }
  });


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
