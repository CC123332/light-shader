// src/shaders/floorShadowTint.js
export const floorVertexShader = /* glsl */ `
  precision highp float;

  uniform mat4 uShadowMatrix;   // lights.dirLight.shadow.matrix

  varying vec3 vWorldPos;
  varying vec4 vShadowCoord;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    // Shadow projection coordinates (already includes bias for 0..1 UV space)
    vShadowCoord = uShadowMatrix * worldPos;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const floorFragmentShader = /* glsl */ `
    precision highp float;

    float unpackRGBAToDepth(const in vec4 v) {
        const vec4 bitShift = vec4(
            1.0 / (256.0 * 256.0 * 256.0),
            1.0 / (256.0 * 256.0),
            1.0 / 256.0,
            1.0
        );
        return dot(v, bitShift);
    }

    uniform sampler2D uShadowMap;
    uniform float uShadowBias;
    uniform float uShadowDarkness;

    uniform vec3 uFloorColor;
    uniform vec3 uShadowTint;

    varying vec4 vShadowCoord;
    varying vec3 vWorldPos;

    float shadowFactorHard() {
        vec3 proj = vShadowCoord.xyz / vShadowCoord.w;

        if (proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;

        float closestDepth = unpackRGBAToDepth(texture2D(uShadowMap, proj.xy));
        float currentDepth = proj.z;

        return (currentDepth - uShadowBias) <= closestDepth ? 1.0 : 0.0;
    }

    // Returns 1.0 on the diagonal lines, 0.0 elsewhere.
    // worldPos: world-space position
    // lineWidth: line thickness in [0..0.5] (as a fraction of the line period)
    // period: distance between adjacent lines in world units (e.g., 0.25, 0.5, 1.0)
    float diagLinesMask(vec3 worldPos, float period, float lineWidth)
    {
        // Diagonal coordinate; use (x+z) for lines slanting one way.
        // Swap to (x-z) for the opposite slope.
        float u = (worldPos.x + worldPos.z) / period;

        // Sawtooth in [0,1)
        float f = fract(u);

        // Binary band around f=0 (also implicitly repeats each period)
        // Clamp width to avoid invalid ranges.
        float w = clamp(lineWidth, 0.0, 0.5);

        // 1 within the band, 0 outside
        return step(f, w) + step(1.0 - w, f) > 0.0 ? 1.0 : 0.0;
    }

    void main() {
        float lit = shadowFactorHard(); // 1 lit, 0 shadowed

        // Shadow amount (1 in shadow, 0 in light), then mask by grid lines
        float shadowAmt = (1.0 - lit);

        // Grid in XZ plane (since floor is horizontal)
        float gridMask = diagLinesMask(vWorldPos.xyz, 0.1, 0.2);

        // Apply tint ONLY where both: in shadow AND on grid lines
        float tintedShadowAmt = shadowAmt * gridMask * uShadowDarkness;

        vec3 base = uFloorColor;

        // Blend toward tinted shadow color in masked regions
        vec3 color = mix(base, uShadowTint, tintedShadowAmt);

        gl_FragColor = vec4(color, 1.0);
    }
`;

