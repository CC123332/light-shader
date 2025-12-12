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

    uniform float uGridScale;     // cells per world unit (or vice versa depending on how you think)
    uniform float uLineWidth;     // thickness of grid lines in [0..0.5] (fraction of cell)
    uniform float uGridFeather;   // soft edge size (small, e.g. 0.01)

    varying vec4 vShadowCoord;
    varying vec3 vWorldPos;

    float shadowFactorHard() {
    vec3 proj = vShadowCoord.xyz / vShadowCoord.w;

    if (proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;

    float closestDepth = unpackRGBAToDepth(texture2D(uShadowMap, proj.xy));
    float currentDepth = proj.z;

    return (currentDepth - uShadowBias) <= closestDepth ? 1.0 : 0.0;
    }

    // Returns 1.0 on grid "lines", 0.0 inside cells (softened by feather)
    float gridLineMask(vec2 p, float scale, float lineWidth, float feather) {
    // Scale world coords into grid space
    vec2 g = p * scale;

    // Distance to nearest grid line in each axis (0 at line center, 0.5 at cell center)
    vec2 cell = abs(fract(g) - 0.5);

    // Take nearest line (x or y)
    float d = min(cell.x, cell.y);

    // Convert lineWidth (fraction of cell) into threshold
    // d is [0..0.5], so lineWidth should be <= 0.5
    float edge0 = lineWidth + feather;
    float edge1 = lineWidth;

    // 1 on/near line, 0 away from line
    return 1.0 - smoothstep(edge1, edge0, d);
    }

    void main() {
    float lit = shadowFactorHard(); // 1 lit, 0 shadowed

    // Shadow amount (1 in shadow, 0 in light), then mask by grid lines
    float shadowAmt = (1.0 - lit);

    // Grid in XZ plane (since floor is horizontal)
    float gridMask = gridLineMask(vWorldPos.xz, uGridScale, uLineWidth, uGridFeather);

    // Apply tint ONLY where both: in shadow AND on grid lines
    float tintedShadowAmt = shadowAmt * gridMask * uShadowDarkness;

    vec3 base = uFloorColor;

    // Blend toward tinted shadow color in masked regions
    vec3 color = mix(base, uShadowTint, tintedShadowAmt);

    gl_FragColor = vec4(color, 1.0);
    }
`;

