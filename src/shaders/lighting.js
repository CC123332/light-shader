// src/shaders/lighting.js

export const lightingVertexShader = /* glsl */ `
  precision highp float;

  // three.js includes:
  // attribute vec3 position;
  // attribute vec3 normal;
  // uniform mat4 modelMatrix;
  // uniform mat4 viewMatrix;
  // uniform mat4 projectionMatrix;
  // uniform mat3 normalMatrix;

  uniform mat4 uLightViewProj;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec4 vShadowCoord;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);

    // compute shadow coord
    vShadowCoord = uLightViewProj * worldPos;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;


export const lightingFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec4 vShadowCoord;

  uniform vec3 uCameraPos;
  uniform vec3 uLightDir;
  uniform vec3 uAlbedo;
  uniform float uMetallic;
  uniform float uRoughness;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);

    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = uAlbedo * NdotL;

    // Blinn-Phong specular
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), mix(8.0, 64.0, 1.0 - uRoughness))
               * mix(0.1, 0.6, uMetallic);

    gl_FragColor = vec4(diffuse + vec3(spec), 1.0);
  }
`;