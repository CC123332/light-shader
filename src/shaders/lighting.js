// src/shaders/lighting.js

export const lightingVertexShader = /* glsl */ `
  precision highp float;

  // three.js 内建:
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

    // 从光的视角看这个点的位置（clip space）
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
  uniform float uTime;

  uniform sampler2D uShadowMap;
  uniform vec2 uShadowMapSize;

  const vec3 AMBIENT_COLOR = vec3(0.04);

  // 计算阴影因子：1 = 无阴影, 0 = 完全在阴影中
    float computeShadow(vec3 N, vec3 L) {
        // 从 clip space -> NDC
        vec3 projCoords = vShadowCoord.xyz / vShadowCoord.w;

        // 不在 light frustum 内，直接当作无阴影
        if (projCoords.z < -1.0 || projCoords.z > 1.0) {
            return 1.0;
        }

        // NDC [-1,1] -> [0,1]
        vec2 uv = projCoords.xy * 0.5 + 0.5;
        float depth = projCoords.z * 0.5 + 0.5;

        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            return 1.0;
        }

        // 从 shadow map 读出最近深度
        float closestDepth = texture2D(uShadowMap, uv).r;

        // bias：防止 self-shadow acne
        float cosTheta = max(dot(N, L), 0.0);
        float bias = max(0.0005 * (1.0 - cosTheta), 0.0005);

        // depth 比 shadow map 里的深度更大（加上 bias）→ 在阴影里
        float shadow = (depth - bias > closestDepth) ? 0.0 : 1.0;
        return shadow;
    }


  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    // 阴影因子
    float shadowFactor = computeShadow(N, L);

    // Diffuse - Lambert
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = uAlbedo * NdotL;

    // Specular - Blinn-Phong
    float NdotH = max(dot(N, H), 0.0);
    float shininess = mix(8.0, 64.0, 1.0 - uRoughness);
    float specStrength = mix(0.1, 0.6, uMetallic);
    float spec = pow(NdotH, shininess) * specStrength;

    // 环境光不受阴影影响（或者你可以弱一点）
    vec3 ambient = AMBIENT_COLOR * uAlbedo;

    // 把阴影打到 direct lighting 上（diffuse + spec）
    vec3 color = ambient + shadowFactor * (diffuse + vec3(spec));

    color = pow(color, vec3(1.0 / 2.2));
    gl_FragColor = vec4(color, 1.0);
  }
`;

