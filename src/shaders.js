// Custom ShaderMaterial for the reveal effect
// Uses stencil-like approach: fragment shader discards based on mouse distance

export const revealVertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const ruinFragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform bool hasMap;
  uniform vec3 baseColor;
  uniform float opacity;
  uniform vec3 uMouseWorld;
  uniform float uRevealRadius;
  uniform float uRevealSoftness;
  uniform bool uRevealActive;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vec3 color = baseColor;
    if (hasMap) {
      color = texture2D(map, vUv).rgb;
    }

    // Multi-dir lighting for bright neutral look
    vec3 lightDir1 = normalize(vec3(0.5, 1.0, 0.3));
    vec3 lightDir2 = normalize(vec3(-0.4, 0.6, -0.5));
    float diff = max(dot(vNormal, lightDir1), 0.0);
    float fill = max(dot(vNormal, lightDir2), 0.0) * 0.3;
    color *= 0.5 + 0.4 * diff + fill;

    float alpha = opacity;

    // If reveal is active, fade OUT the ruin near the mouse
    if (uRevealActive) {
      float dist = distance(vWorldPosition, uMouseWorld);
      float reveal = smoothstep(uRevealRadius - uRevealSoftness, uRevealRadius + uRevealSoftness, dist);
      alpha *= reveal;
      if (alpha < 0.01) discard;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

export const reconstructionFragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform bool hasMap;
  uniform vec3 baseColor;
  uniform float opacity;
  uniform vec3 uMouseWorld;
  uniform float uRevealRadius;
  uniform float uRevealSoftness;
  uniform bool uRevealActive;
  uniform bool uShowAlways;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vec3 color = baseColor;
    if (hasMap) {
      color = texture2D(map, vUv).rgb;
    }

    // Multi-dir lighting
    vec3 lightDir1 = normalize(vec3(0.5, 1.0, 0.3));
    vec3 lightDir2 = normalize(vec3(-0.4, 0.6, -0.5));
    float diff = max(dot(vNormal, lightDir1), 0.0);
    float fill = max(dot(vNormal, lightDir2), 0.0) * 0.3;
    color *= 0.5 + 0.4 * diff + fill;

    float alpha = opacity;

    if (uShowAlways) {
      // Alignment mode: show as-is with opacity
      gl_FragColor = vec4(color, alpha);
      return;
    }

    // If reveal is active, fade IN the reconstruction near the mouse
    if (uRevealActive) {
      float dist = distance(vWorldPosition, uMouseWorld);
      float reveal = 1.0 - smoothstep(uRevealRadius - uRevealSoftness, uRevealRadius + uRevealSoftness, dist);
      alpha *= reveal;
      if (alpha < 0.01) discard;
    } else {
      discard;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

// Sky shader for animated clouds
export const skyVertexShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const skyFragmentShader = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Simplex-ish noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
           + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float y = dir.y;

    // Cloud UV based on direction
    vec2 cloudUV = dir.xz / (abs(y) + 0.3) * 1.5;

    float t = uTime * 0.015;

    // Layer clouds
    float n1 = snoise(cloudUV * 0.8 + vec2(t, t * 0.5)) * 0.5 + 0.5;
    float n2 = snoise(cloudUV * 1.6 + vec2(-t * 0.7, t * 0.3)) * 0.5 + 0.5;
    float n3 = snoise(cloudUV * 3.2 + vec2(t * 0.4, -t * 0.6)) * 0.5 + 0.5;

    float clouds = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    clouds = smoothstep(0.3, 0.7, clouds);

    // Sky gradient (Evening / Sunset)
    vec3 skyTop = vec3(0.12, 0.16, 0.35);
    vec3 skyBottom = vec3(0.85, 0.35, 0.15);
    vec3 horizon = vec3(0.95, 0.55, 0.25);
    vec3 cloudColor = vec3(0.95, 0.65, 0.45);
    vec3 cloudShadow = vec3(0.35, 0.25, 0.35);

    float heightMix = smoothstep(0.0, 0.8, y);
    vec3 sky = mix(horizon, mix(skyBottom, skyTop, heightMix), heightMix);

    vec3 cloudFinal = mix(cloudShadow, cloudColor, n1);
    vec3 color = mix(sky, cloudFinal, clouds * smoothstep(0.0, 0.2, y));

    // Fog at horizon
    float horizonFog = 1.0 - smoothstep(0.0, 0.15, abs(y));
    color = mix(color, horizon, horizonFog);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Grass plane shader
export const grassVertexShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const grassFragmentShader = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 worldUV = vWorldPos.xz * 0.15;

    float n1 = snoise(worldUV * 2.0 + uTime * 0.02) * 0.5 + 0.5;
    float n2 = snoise(worldUV * 5.0 - uTime * 0.015) * 0.5 + 0.5;
    float detail = n1 * 0.6 + n2 * 0.4;

    vec3 grassDark = vec3(0.22, 0.38, 0.15);
    vec3 grassLight = vec3(0.42, 0.55, 0.25);
    vec3 grassYellow = vec3(0.52, 0.50, 0.22);

    vec3 color = mix(grassDark, grassLight, detail);
    color = mix(color, grassYellow, smoothstep(0.6, 0.9, n2) * 0.3);

    // Distance fade to horizon color
    float dist = length(vWorldPos.xz);
    float fade = smoothstep(20.0, 90.0, dist);
    vec3 horizonColor = vec3(0.95, 0.55, 0.25);
    color = mix(color, horizonColor, fade);

    gl_FragColor = vec4(color, 1.0);
  }
`;
