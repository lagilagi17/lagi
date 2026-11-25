/* HanQ Environment V2 — production materials for the approved environment preview.
 * Three.js r160. Rendering only: no terrain, collision, simulation or save mutations.
 * Depth textures belong to the host. R stores water depth / 30, not terrain height.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HanQEnvironmentV2 = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2.0.0';
  const QUALITY_PRESETS = Object.freeze({
    low: Object.freeze({ name: 'low', octaves: 2, waterSegments: 32, microDetail: 0 }),
    medium: Object.freeze({ name: 'medium', octaves: 3, waterSegments: 64, microDetail: 1 }),
    high: Object.freeze({ name: 'high', octaves: 4, waterSegments: 96, microDetail: 1 }),
    ultra: Object.freeze({ name: 'ultra', octaves: 5, waterSegments: 128, microDetail: 1 })
  });
  const PALETTES = Object.freeze({
    open: { sand: '#aa9c79', grass: '#546740', soil: '#635444', rock: '#72736c', snow: '#d6dcd8' },
    plains: { sand: '#aa9b77', grass: '#596d42', soil: '#695744', rock: '#74766e', snow: '#d7ddd9' },
    forest: { sand: '#948b70', grass: '#3d5738', soil: '#4d4037', rock: '#646b65', snow: '#d1d9d4' },
    mountain: { sand: '#968e74', grass: '#5f6747', soil: '#655c4d', rock: '#777a76', snow: '#e1e5e2' },
    desert: { sand: '#b19a70', grass: '#937c52', soil: '#986b49', rock: '#81725e', snow: '#d7ddd9' },
    assassin: { sand: '#aaa081', grass: '#526046', soil: '#665d4b', rock: '#747a70', snow: '#d6ddd5' }
  });

  function presetOf(name) { return QUALITY_PRESETS[name] || QUALITY_PRESETS.high; }
  function finite(value, fallback) { return Number.isFinite(value) ? value : fallback; }
  function sunDirection(T, sun) {
    const value = sun && sun.isVector3 ? sun.clone() : new T.Vector3(.42, .48, .76);
    return value.lengthSq() > 1e-8 ? value.normalize() : value.set(0, 1, 0);
  }
  function mark(material, kind, preset, uniforms) {
    material.name = 'HanQ Environment V2 ' + kind;
    material.userData.environmentV2 = true;
    material.userData.environmentVersion = VERSION;
    material.userData.environmentQuality = preset.name;
    material.userData.uniforms = uniforms;
    return material;
  }
  function defines(preset) {
    return { ENV_OCTAVES: preset.octaves, ENV_MICRO_DETAIL: preset.microDetail };
  }

  const NOISE = `
    float envHash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float envNoise2(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(envHash21(i), envHash21(i + vec2(1.0, 0.0)), f.x),
                 mix(envHash21(i + vec2(0.0, 1.0)), envHash21(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float envFbm(vec2 p) {
      float n = 0.0, a = .5, weight = 0.0;
      for (int i = 0; i < ENV_OCTAVES; i++) {
        n += envNoise2(p) * a; weight += a;
        p = mat2(1.62, -1.18, 1.18, 1.62) * p + 7.3; a *= .5;
      }
      return n / weight;
    }
  `;

  function makeSkyMaterial(T, options = {}) {
    const preset = presetOf(options.quality);
    const uniforms = {
      uTime: { value: 0 }, uSun: { value: sunDirection(T, options.sun) },
      uTop: { value: new T.Color(options.top || '#416eac') },
      uMid: { value: new T.Color(options.mid || '#91bbd9') },
      uHorizon: { value: new T.Color(options.horizon || '#d5dedb') },
      uSunColor: { value: new T.Color('#fff0d5') },
      uCloudDark: { value: new T.Color('#89949c') },
      uCloudLight: { value: new T.Color('#f3f1e7') },
      uCloudAmount: { value: finite(options.cloudAmount, .56) }
    };
    return mark(new T.ShaderMaterial({
      defines: defines(preset), uniforms,
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: `
        varying vec3 vEnvDir;
        void main() {
          vEnvDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSun, uTop, uMid, uHorizon, uSunColor, uCloudDark, uCloudLight;
        uniform float uTime, uCloudAmount;
        varying vec3 vEnvDir;
        ${NOISE}
        void main() {
          vec3 ray = normalize(vEnvDir), sun = normalize(uSun);
          float h = clamp(ray.y, 0.0, 1.0);
          float day = smoothstep(-.15, .18, sun.y);
          vec3 daytime = mix(uHorizon, mix(uMid, uTop, pow(h, .72)), pow(h, .28));
          vec3 nighttime = mix(vec3(.008, .012, .024), vec3(.0015, .003, .009), pow(h, .6));
          vec3 col = mix(nighttime, daytime, day);
          float sd = max(dot(ray, sun), 0.0);
          col += uSunColor * (pow(sd, 1600.0) * 4.8 + pow(sd, 22.0) * .20) * day;
          col += vec3(.08, .055, .028) * pow(1.0 - abs(ray.y), 8.0) * day;
          if (ray.y > -.03) {
            vec2 cp = ray.xz / (abs(ray.y) + .20) * 1.18 + vec2(uTime * .0036, uTime * .0014);
            float broad = envFbm(cp);
            float detail = envFbm(cp * 2.7 + 19.0);
            float cover = clamp(uCloudAmount, 0.0, 1.0);
            float cloud = smoothstep(.68 - cover * .22, .86 - cover * .22, broad + detail * .18);
            cloud *= smoothstep(-.03, .18, ray.y);
            float shade = clamp(broad * 1.30 - .12 + (detail - .5) * .25, 0.0, 1.0);
            vec3 cloudColor = mix(uCloudDark, uCloudLight, shade) * mix(.055, 1.0, day);
            float silver = pow(max(dot(ray, sun), 0.0), 12.0) * day;
            cloudColor += uSunColor * silver * .12;
            col = mix(col, cloudColor, cloud * .88);
            #if ENV_MICRO_DETAIL == 1
              vec2 cirrusUv = ray.xz / (abs(ray.y) + .12) * 3.8 + vec2(-uTime * .0021, uTime * .0009);
              float cirrus = smoothstep(.69, .81, envFbm(cirrusUv));
              col = mix(col, uCloudLight * mix(.04, .85, day), cirrus * .19 * smoothstep(.10, .45, ray.y));
            #endif
          }
          if (sun.y < .05) {
            float stars = step(.9977, envHash21(floor(ray.xz / (abs(ray.y) + .16) * 820.0)));
            stars *= smoothstep(.12, .65, ray.y) * (1.0 - smoothstep(-.08, .08, sun.y));
            col += vec3(stars * .55);
          }
          gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }), 'sky', preset, uniforms);
  }

  // Used in vertex and fragment stages. Every map has its own bounded domain;
  // sampling beyond it returns deep sea rather than extending a shoreline texel.
  const DEPTH = `
    uniform sampler2D uDepth, uDepthWest, uDepthNorth;
    uniform vec4 uDepthBox, uDepthWestBox, uDepthNorthBox;
    uniform float uDepthWestEnabled, uDepthNorthEnabled;
    float envDepthInMap(sampler2D depthMap, vec4 box, vec2 worldXZ) {
      if (box.z <= 0.0 || box.w <= 0.0) return 30.0;
      vec2 uv = (worldXZ - box.xy) / box.zw;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 30.0;
      return texture2D(depthMap, uv).r * 30.0;
    }
    float envDepthAt(vec2 worldXZ) {
      float depth = envDepthInMap(uDepth, uDepthBox, worldXZ);
      if (uDepthWestEnabled > .5) depth = min(depth, envDepthInMap(uDepthWest, uDepthWestBox, worldXZ));
      if (uDepthNorthEnabled > .5) depth = min(depth, envDepthInMap(uDepthNorth, uDepthNorthBox, worldXZ));
      return depth;
    }
  `;

  // The four approved swell directions, evaluated from an immutable WORLD base.
  // Sum of vertical amplitudes is at most .19 m, including maximum wind.
  const WAVES = `
    uniform float uTime, uWind;
    void envAddWave(vec2 xz, vec2 direction, float amplitude, float wavelength, float speed,
                    inout vec3 displacement, inout vec2 slope) {
      vec2 dir = normalize(direction);
      float k = 6.28318530718 / wavelength;
      float amount = .1 * clamp(.35 + uWind * .95, 0.0, 1.0);
      float phase = k * dot(dir, xz) + uTime * speed * (.7 + clamp(uWind, 0.0, 1.0) * .5);
      float sn = sin(phase), cs = cos(phase), a = amplitude * amount;
      displacement.y += a * sn;
      displacement.xz += dir * (a * .22 * cs);
      slope += a * k * dir * cs;
    }
    void envWavesAt(vec2 xz, out vec3 displacement, out vec2 slope) {
      displacement = vec3(0.0); slope = vec2(0.0);
      envAddWave(xz, vec2(1.0, .34), 1.0, 72.0, 1.05, displacement, slope);
      envAddWave(xz, vec2(-.28, 1.0), .56, 31.0, 1.62, displacement, slope);
      envAddWave(xz, vec2(.7, -.6), .24, 13.0, 2.35, displacement, slope);
      envAddWave(xz, vec2(-.9, -.2), .10, 5.5, 3.2, displacement, slope);
    }
  `;

  function makeWaterMaterial(T, options = {}) {
    const preset = presetOf(options.quality);
    // Clone only the fog scalar/color uniforms. Texture references are attached
    // afterwards, so the host's disposal and replacement refer to the real GPU map.
    const uniforms = Object.assign(T.UniformsUtils.clone(T.UniformsLib.fog), {
      uTime: { value: 0 }, uSun: { value: sunDirection(T, options.sun) },
      uWind: { value: finite(options.wind, .58) },
      uWaterLevel: { value: finite(options.waterLevel, 0) },
      uDeep: { value: new T.Color(options.deep || '#103e50') },
      uShallow: { value: new T.Color(options.shallow || '#408d91') },
      uSky: { value: new T.Color(options.sky || '#b2c8d2') },
      uFoam: { value: new T.Color(options.foam || '#d4e6e2') },
      uDepth: { value: null }, uDepthBox: { value: new T.Vector4(0, 0, 0, 0) },
      uDepthWest: { value: null }, uDepthWestBox: { value: new T.Vector4(0, 0, 0, 0) },
      uDepthWestEnabled: { value: 0 },
      uDepthNorth: { value: null }, uDepthNorthBox: { value: new T.Vector4(0, 0, 0, 0) },
      uDepthNorthEnabled: { value: 0 }
    });
    return mark(new T.ShaderMaterial({
      defines: defines(preset), uniforms,
      side: T.DoubleSide, transparent: false, depthWrite: true, fog: true,
      vertexShader: `
        varying vec3 vEnvWorld;
        ${DEPTH}
        ${WAVES}
        #include <fog_pars_vertex>
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vec3 displacement; vec2 slope;
          envWavesAt(world.xz, displacement, slope);
          float shoreAttenuation = smoothstep(.12, 3.4, envDepthAt(world.xz));
          world.xyz += displacement * shoreAttenuation;
          vEnvWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        uniform vec3 uSun, uDeep, uShallow, uSky, uFoam;
        uniform float uWaterLevel;
        varying vec3 vEnvWorld;
        ${DEPTH}
        ${WAVES}
        ${NOISE}
        #include <fog_pars_fragment>
        void main() {
          float depth = envDepthAt(vEnvWorld.xz);
          float shoreAttenuation = smoothstep(.12, 3.4, depth);
          vec3 displacement; vec2 slope;
          envWavesAt(vEnvWorld.xz, displacement, slope);
          // Analytic ripple derivatives stay detailed even between the large far
          // mesh cells. No finite-difference fBm triplet per screen pixel.
          float viewDistance = length(cameraPosition - vEnvWorld);
          float rippleFade = 1.0 - smoothstep(180.0, 1000.0, viewDistance);
          vec2 ripple = vec2(0.0);
          #if ENV_MICRO_DETAIL == 1
            ripple += vec2(.86, .51) * cos(dot(vEnvWorld.xz, vec2(.46, .27)) + uTime * 1.85) * .085;
            ripple += vec2(-.36, .93) * cos(dot(vEnvWorld.xz, vec2(-.37, .96)) - uTime * 2.1) * .052;
            ripple += vec2(.64, -.77) * cos(dot(vEnvWorld.xz, vec2(1.35, -1.62)) + uTime * 2.85) * .026;
          #else
            ripple = vec2(.86, .51) * cos(dot(vEnvWorld.xz, vec2(.46, .27)) + uTime * 1.85) * .065;
          #endif
          slope = (slope + ripple * rippleFade * (.35 + clamp(uWind, 0.0, 1.0) * .65)) * shoreAttenuation;
          vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
          if (!gl_FrontFacing) N = -N;
          vec3 V = normalize(cameraPosition - vEnvWorld), sun = normalize(uSun);
          float day = smoothstep(-.15, .18, sun.y);
          float fresnel = .025 + .975 * pow(1.0 - max(dot(V, N), 0.0), 5.0);
          float shallow = exp(-depth / 10.0);
          vec3 water = mix(uDeep, uShallow, shallow * .88);
          float macro = envNoise2(vEnvWorld.xz * .025 + vec2(uTime * .007, -uTime * .004));
          water *= .95 + .10 * macro;
          vec3 R = reflect(-V, N);
          vec3 reflectedSky = mix(uSky, uSky * vec3(.27, .48, .78), pow(clamp(R.y, 0.0, 1.0), .65));
          water = mix(water, reflectedSky, fresnel * .78) * mix(.075, 1.0, day);
          vec3 H = normalize(V + sun);
          water += vec3(1.0, .84, .57) * pow(max(dot(N, H), 0.0), 180.0) * 1.15 * day;
          float shore = 1.0 - smoothstep(.18, 2.2, depth);
          float chop = smoothstep(.48, .77, envNoise2(vEnvWorld.xz * .31 + vec2(-uTime * .08, uTime * .045)));
          float surf = .55 + .45 * sin(depth * 3.1 - uTime * 1.5);
          float crest = smoothstep(.075, .16, displacement.y) * shoreAttenuation;
          float foam = clamp(shore * (.43 + .30 * chop + .20 * surf) + crest * chop * .17, 0.0, .86);
          water = mix(water, uFoam * mix(.12, 1.0, day), foam * .78);
          gl_FragColor = vec4(max(water, vec3(0.0)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `
    }), 'water', preset, uniforms);
  }

  function makeWaterGeometry(T, options = {}) {
    const preset = presetOf(options.quality);
    const segments = preset.waterSegments;
    const extent = Math.max(32, finite(options.extent, 8000)), half = extent / 2;
    const side = segments + 1;
    const position = new Float32Array(side * side * 3);
    const normal = new Float32Array(side * side * 3);
    const uv = new Float32Array(side * side * 2);
    const indices = new Uint16Array(segments * segments * 6);
    const coord = i => {
      const a = i / segments * 2 - 1, b = Math.abs(a);
      return Math.sign(a) * half * (.008 * b + .992 * b * b * b);
    };
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
      const i = z * side + x;
      position[i * 3] = coord(x); position[i * 3 + 2] = coord(z);
      normal[i * 3 + 1] = 1;
      uv[i * 2] = x / segments; uv[i * 2 + 1] = z / segments;
    }
    let k = 0;
    for (let z = 0; z < segments; z++) for (let x = 0; x < segments; x++) {
      const a = z * side + x, b = a + 1, c = a + side, d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new T.BufferAttribute(normal, 3));
    geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geometry.setIndex(new T.BufferAttribute(indices, 1));
    geometry.boundingBox = new T.Box3(new T.Vector3(-half - .05, -.20, -half - .05), new T.Vector3(half + .05, .20, half + .05));
    geometry.boundingSphere = new T.Sphere(new T.Vector3(), Math.hypot(half + .05, half + .05, .20));
    geometry.name = 'HanQ Environment V2 adaptive water grid';
    geometry.userData.environmentV2 = true;
    geometry.userData.environmentQuality = preset.name;
    geometry.userData.waterSegments = segments;
    return geometry;
  }

  function makeTerrainMaterial(T, options = {}) {
    const preset = presetOf(options.quality);
    const preserve = options.preserveVertexColors !== false;
    const naturalMask = options.naturalMask !== false;
    const palette = PALETTES[options.biome] || PALETTES.open;
    const uniforms = {
      uTime: { value: 0 }, uWaterLevel: { value: finite(options.waterLevel, 0) },
      envCoastalBlend: { value: options.coastalBlend === false ? 0 : 1 },
      envSnowline: { value: finite(options.snowline, 118) },
      envSnowEnabled: { value: options.biome === 'mountain' || options.biome === 'open' ? 1 : 0 },
      envTone: { value: finite(options.tone, 1) },
      envSand: { value: new T.Color(palette.sand) }, envGrass: { value: new T.Color(palette.grass) },
      envSoil: { value: new T.Color(palette.soil) }, envRock: { value: new T.Color(palette.rock) },
      envSnow: { value: new T.Color(palette.snow) }
    };
    const material = new T.MeshStandardMaterial({
      color: '#ffffff', roughness: .94, metalness: 0, vertexColors: preserve, flatShading: false
    });
    material.defines = Object.assign(defines(preset), { ENV_PRESERVE_COLORS: preserve ? 1 : 0, ENV_NATURAL_MASK: naturalMask ? 1 : 0 });
    // Optional missing attribute defaults to natural terrain. This does not add
    // an attribute buffer or require changes to unpainted/fallback geometry.
    material.defaultAttributeValues = { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0], envNatural: [1] };
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vEnvWorld, vEnvNormal;
          varying float vEnvNatural;
          #if ENV_NATURAL_MASK == 1
            attribute float envNatural;
          #endif
        `)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 envWorldPosition = vec4(transformed, 1.0);
          #ifdef USE_BATCHING
            envWorldPosition = batchingMatrix * envWorldPosition;
          #endif
          #ifdef USE_INSTANCING
            envWorldPosition = instanceMatrix * envWorldPosition;
          #endif
          vEnvWorld = (modelMatrix * envWorldPosition).xyz;
          vEnvNormal = inverseTransformDirection(transformedNormal, viewMatrix);
          #if ENV_NATURAL_MASK == 1
            vEnvNatural = envNatural;
          #else
            vEnvNatural = 1.0;
          #endif
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vEnvWorld, vEnvNormal;
          varying float vEnvNatural;
          uniform float uTime, uWaterLevel, envCoastalBlend, envSnowline, envSnowEnabled, envTone;
          uniform vec3 envSand, envGrass, envSoil, envRock, envSnow;
          ${NOISE}
        `)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float envNaturalWeight = clamp(vEnvNatural, 0.0, 1.0);
          float envSlope = 1.0 - abs(normalize(vEnvNormal).y);
          float envDetailFade = 1.0 - smoothstep(65.0, 240.0, length(vEnvWorld - cameraPosition));
          float envMacro = envFbm(vEnvWorld.xz * .006);
          float envGrain = envNoise2(vEnvWorld.xz * .16);
          float envMicro = .5;
          #if ENV_MICRO_DETAIL == 1
            envMicro = envNoise2(vEnvWorld.xz * .72);
          #endif
          float envWet = (1.0 - smoothstep(uWaterLevel + .20, uWaterLevel + 2.6, vEnvWorld.y))
                         * smoothstep(uWaterLevel - .6, uWaterLevel + .20, vEnvWorld.y) * envCoastalBlend;
          #if ENV_PRESERVE_COLORS == 1
            // Existing colors encode biome, desert exclusion, roads, crops and
            // contact shade. No generic grass/snow palette overwrites those.
            float envVariation = (.96 + .08 * envMacro) * (.91 + .18 * envGrain)
                               * (1.0 + (envMicro - .5) * .065 * envDetailFade);
            diffuseColor.rgb *= mix(1.0, envVariation * envTone, envNaturalWeight);
            float envLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
            vec3 envMutedRock = mix(diffuseColor.rgb, vec3(envLuma), .28);
            diffuseColor.rgb = mix(diffuseColor.rgb, envMutedRock,
              smoothstep(.28, .64, envSlope) * envNaturalWeight * .18);
            diffuseColor.rgb *= 1.0 - envWet * envNaturalWeight * .17;
          #else
            vec3 envBase = mix(envGrass, envGrass * vec3(.80, .94, .82), smoothstep(.42, .72, envMacro));
            envBase = mix(envBase, envSoil, smoothstep(.55, .82, envGrain) * smoothstep(.05, .30, envSlope));
            envBase = mix(envBase, envRock, smoothstep(.28, .64, envSlope));
            float envCoast = (1.0 - smoothstep(uWaterLevel + 2.0, uWaterLevel + 12.0, vEnvWorld.y))
                             * (1.0 - smoothstep(.18, .40, envSlope)) * envCoastalBlend;
            envBase = mix(envBase, envSand, envCoast);
            float envSnowMix = smoothstep(envSnowline - 10.0, envSnowline + 20.0, vEnvWorld.y + envMacro * 8.0)
                               * (1.0 - smoothstep(.28, .56, envSlope)) * envSnowEnabled;
            envBase = mix(envBase, envSnow, envSnowMix);
            envBase *= (.88 + .22 * envGrain + (envMicro - .5) * .06 * envDetailFade) * (1.0 - envWet * .27);
            diffuseColor.rgb = envBase * envTone;
          #endif
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, min(roughnessFactor, .62), envWet * envNaturalWeight);
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #if ENV_MICRO_DETAIL == 1
            vec2 envP = vEnvWorld.xz;
            vec3 envMicroNormal = vec3(cos(envP.x * 1.7) * sin(envP.y * 1.3), 0.0,
                                      sin(envP.x * 1.7) * cos(envP.y * 1.3));
            normal = normalize(normal + mat3(viewMatrix) * envMicroNormal * .035 * envDetailFade * envNaturalWeight);
          #endif
        `);
      material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => 'hanq-environment-v2-terrain-' + VERSION + '-' + preset.name + '-' + preserve + '-' + naturalMask;
    return mark(material, 'terrain', preset, uniforms);
  }

  function makeGrassMaterial(T, options = {}) {
    const preset = presetOf(options.quality);
    const uniforms = { uTime: { value: 0 }, uWind: { value: finite(options.wind, .58) } };
    const material = new T.MeshStandardMaterial({
      color: options.color || (options.vertexColors ? '#ffffff' : '#61764a'),
      roughness: 1, metalness: 0, side: T.DoubleSide, vertexColors: !!options.vertexColors
    });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 envBase = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            envBase = instanceMatrix * envBase;
          #endif
          envBase = modelMatrix * envBase;
          float envTip = max(position.y, 0.0);
          float envGust = sin(uTime * 1.7 + envBase.x * .12 + envBase.z * .08)
                        + sin(envBase.z * .23 - uTime * 2.2) * .35;
          transformed.x += envGust * uWind * .10 * envTip;
          transformed.z += envGust * uWind * .045 * envTip;
        `);
      material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => 'hanq-environment-v2-grass-' + VERSION;
    return mark(material, 'grass', preset, uniforms);
  }

  return Object.freeze({ VERSION, QUALITY_PRESETS, presetOf, makeSkyMaterial, makeWaterMaterial,
    makeWaterGeometry, makeTerrainMaterial, makeGrassMaterial });
});
