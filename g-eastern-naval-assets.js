/* Eastern naval theatre: shared, batched procedural ship models.
 * Local coordinates: +Z bow, +Y up, waterline Y=0. No scene or game state.
 * The parked carrier aircraft are scenery; controllable aircraft belong to
 * the native game simulation and may be placed on the clear flight deck.
 */
(function (global) {
  'use strict';
  const METRICS = Object.freeze({
    carrier: Object.freeze({ length: 240, width: 64, deckY: 14, draft: 8.5 }),
    destroyer: Object.freeze({ length: 76, width: 15, deckY: 5.2, draft: 4.6 }),
    patrol: Object.freeze({ length: 18, width: 5, deckY: 2.2, draft: 1.4 })
  });
  function create(THREE) {
    if (!THREE || !THREE.BufferGeometry || !THREE.Group) throw new Error('Naval assets require THREE.');
    const geometries = new Set(), materials = new Set();
    const primitiveCache = new Map(), materialCache = new Map(), templates = new Map(), turretTemplates = new Map();
    let disposed = false;
    const V = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
    function keep(g) { geometries.add(g); return g; }
    function primitive(key, build) {
      if (!primitiveCache.has(key)) primitiveCache.set(key, keep(build()));
      return primitiveCache.get(key);
    }
    const unitBox = () => primitive('box', () => new THREE.BoxGeometry(1, 1, 1));
    const unitCylinder = (top = 1, bottom = 1, sides = 12) => primitive('cylinder:' + top + ':' + bottom + ':' + sides,
      () => new THREE.CylinderGeometry(top, bottom, 1, sides, 1));
    const unitSphere = () => primitive('sphere', () => new THREE.SphereGeometry(1, 8, 5));
    function material(name, color, extras = {}) {
      const key = name + ':' + color;
      if (!materialCache.has(key)) {
        const m = new THREE.MeshStandardMaterial({ color, roughness: .76, metalness: .28, ...extras });
        m.name = name; materialCache.set(key, m); materials.add(m);
      }
      return materialCache.get(key);
    }
    function palette(faction) {
      const enemy = faction === 'enemy';
      return {
        hull: material('naval-hull', enemy ? 0x586068 : 0x617987),
        light: material('naval-superstructure', enemy ? 0x7a8188 : 0x8a9da9),
        dark: material('naval-dark-steel', enemy ? 0x303940 : 0x304551),
        deck: material('naval-deck', enemy ? 0x3c4349 : 0x394d58, { roughness: .94, metalness: .08 }),
        nonslip: material('naval-nonslip', 0x26363e, { roughness: .96, metalness: .04 }),
        red: material('naval-antifouling', enemy ? 0x7d3031 : 0x7b403c, { roughness: .86, metalness: .1 }),
        steel: material('naval-metal', 0xa3b1b6, { roughness: .45, metalness: .65 }),
        black: material('naval-rubber', 0x17232b, { roughness: .9, metalness: .04 }),
        white: material('naval-paint-white', 0xe2e8e6, { roughness: .8, metalness: .08 }),
        yellow: material('naval-paint-yellow', 0xeac466, { roughness: .8, metalness: .08 }),
        accent: material('naval-faction', enemy ? 0xc77b4e : 0x45bbc5, { roughness: .58, metalness: .15 }),
        glass: material('naval-glass', enemy ? 0x223d47 : 0x174653, { roughness: .2, metalness: .5 }),
        window: material('naval-window-reflection', enemy ? 0x638993 : 0x73a9b4, { roughness: .35, metalness: .4 }),
        green: material('naval-nav-green', 0x38b98d, { emissive: 0x1b7050, emissiveIntensity: .35 }),
        port: material('naval-nav-red', 0xc45341, { emissive: 0x842c22, emissiveIntensity: .3 }),
        lamp: material('naval-light', 0xf6dfaa, { emissive: 0xc9a55f, emissiveIntensity: .4 })
      };
    }
    function matrix(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
      return new M4().compose(new V(x, y, z), new Q().setFromEuler(new THREE.Euler(rx, ry, rz)), new V(sx, sy, sz));
    }
    // Merge static geometry by material. All instances of a kind/faction share
    // the finished buffers; only explicitly tagged weapon/radar pivots rotate.
    function Pack() { this.groups = new Map(); this.base = new M4(); }
    Pack.prototype.add = function (geometry, mat, transform) {
      let a = this.groups.get(mat); if (!a) this.groups.set(mat, a = []);
      a.push({ geometry, matrix: this.base.clone().multiply(transform || new M4()) });
    };
    Pack.prototype.box = function (w, h, d, x, y, z, mat, ry = 0, rx = 0, rz = 0) {
      this.add(unitBox(), mat, matrix(x, y, z, w, h, d, rx, ry, rz));
    };
    Pack.prototype.cylinder = function (radius, height, x, y, z, mat, top = 1, sides = 12, rx = 0, rz = 0) {
      this.add(unitCylinder(top, 1, sides), mat, matrix(x, y, z, radius, height, radius, rx, 0, rz));
    };
    Pack.prototype.sphere = function (radius, x, y, z, mat, sy = 1) {
      this.add(unitSphere(), mat, matrix(x, y, z, radius, radius * sy, radius));
    };
    Pack.prototype.line = function (a, b, radius, mat, sides = 6) {
      const from = new V(...a), to = new V(...b), delta = to.clone().sub(from), length = delta.length();
      if (length < .0001) return;
      const transform = new M4().compose(from.add(to).multiplyScalar(.5),
        new Q().setFromUnitVectors(new V(0, 1, 0), delta.divideScalar(length)), new V(radius, length, radius));
      this.add(unitCylinder(1, 1, sides), mat, transform);
    };
    Pack.prototype.scope = function (transform, fn) { const prev = this.base; this.base = prev.clone().multiply(transform); fn(this); this.base = prev; };
    Pack.prototype.finish = function (parent) {
      const p = new V(), n = new V();
      for (const [mat, entries] of this.groups) {
        const count = entries.reduce((sum, entry) => sum + (entry.geometry.index ? entry.geometry.index.count : entry.geometry.attributes.position.count), 0);
        const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
        let cursor = 0;
        for (const entry of entries) {
          const g = entry.geometry, pos = g.attributes.position, normal = g.attributes.normal;
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(entry.matrix), indices = g.index;
          const length = indices ? indices.count : pos.count;
          for (let i = 0; i < length; i++) {
            const j = indices ? indices.getX(i) : i;
            p.fromBufferAttribute(pos, j).applyMatrix4(entry.matrix);
            if (normal) n.fromBufferAttribute(normal, j).applyNormalMatrix(normalMatrix); else n.set(0, 1, 0);
            positions[cursor] = p.x; normals[cursor++] = n.x;
            positions[cursor] = p.y; normals[cursor++] = n.y;
            positions[cursor] = p.z; normals[cursor++] = n.z;
          }
        }
        const geometry = keep(new THREE.BufferGeometry());
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, mat); mesh.name = 'naval-batch-' + mat.name;
        mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
      }
      return parent;
    };
    function ringHull(outline, rings) {
      let area = 0;
      for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; area += a[0] * b[1] - b[0] * a[1]; }
      if (area < 0) outline = outline.slice().reverse();
      const vertices = [], faces = [], count = outline.length;
      for (const ring of rings) for (const point of outline) vertices.push(point[0] * ring[1], ring[0], point[1] * ring[2]);
      for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < count; i++) {
        const j = (i + 1) % count, a = r * count + i, b = r * count + j, c = (r + 1) * count + i, d = (r + 1) * count + j;
        faces.push(a, c, b, b, c, d);
      }
      const contour = outline.map(p => new THREE.Vector2(p[0], p[1]));
      for (const tri of THREE.ShapeUtils.triangulateShape(contour, [])) {
        faces.push(tri[0], tri[1], tri[2]);
        const o = (rings.length - 1) * count;
        faces.push(o + tri[2], o + tri[1], o + tri[0]);
      }
      const indexed = new THREE.BufferGeometry();
      indexed.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); indexed.setIndex(faces);
      const g = indexed.toNonIndexed(); indexed.dispose(); g.computeVertexNormals(); return keep(g);
    }
    function plan(length, width) {
      return [[-width * .37, -length * .5], [width * .37, -length * .5], [width * .5, -length * .42],
        [width * .5, length * .19], [width * .39, length * .35], [width * .19, length * .46], [0, length * .5],
        [-width * .19, length * .46], [-width * .39, length * .35], [-width * .5, length * .19], [-width * .5, -length * .42]];
    }
    function hull(pack, p, length, width, deckY, draft) {
      const outline = plan(length, width);
      pack.add(ringHull(outline, [[-draft, .44, .86], [-draft * .56, .74, .94], [.06, .91, .98]]), p.red);
      pack.add(ringHull(outline, [[.06, .91, .98], [deckY * .55, 1, 1], [deckY - .35, 1, 1]]), p.hull);
      pack.add(ringHull(outline, [[.06, .915, .981], [.32, .922, .983]]), p.dark);
      pack.add(ringHull(outline, [[deckY - .35, 1.01, 1], [deckY, 1.01, 1]]), p.deck);
    }
    function paintLine(pack, p, a, b, width, y, mat = p.white) {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      pack.box(width, .035, Math.hypot(dx, dz), (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, mat, Math.atan2(dx, dz));
    }
    function railing(pack, p, a, b, y, height = 1.1, every = 7) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.round(length / every));
      for (let i = 0; i <= count; i++) {
        const x = a[0] + (b[0] - a[0]) * i / count, z = a[1] + (b[1] - a[1]) * i / count;
        pack.line([x, y, z], [x, y + height, z], .06, p.steel);
      }
      pack.line([a[0], y + height, a[1]], [b[0], y + height, b[1]], .065, p.steel);
      pack.line([a[0], y + height * .52, a[1]], [b[0], y + height * .52, b[1]], .035, p.steel);
    }
    function digits(pack, p, text, x, z, y, size, mat) {
      const segments = { 0: [0, 1, 2, 3, 4, 5], 1: [1, 2], 2: [0, 1, 6, 4, 3], 3: [0, 1, 6, 2, 3],
        4: [5, 6, 1, 2], 5: [0, 5, 6, 2, 3], 6: [0, 5, 6, 4, 2, 3], 7: [0, 1, 2], 8: [0, 1, 2, 3, 4, 5, 6], 9: [0, 1, 2, 3, 5, 6] };
      const points = [[0, 1.4, 1, .14], [.48, .72, .14, 1.15], [.48, -.72, .14, 1.15], [0, -1.4, 1, .14], [-.48, -.72, .14, 1.15], [-.48, .72, .14, 1.15], [0, 0, 1, .14]];
      for (let i = 0; i < text.length; i++) for (const segment of segments[text[i]] || []) {
        const s = points[segment]; pack.box(s[2] * size, .04, s[3] * size, x + i * size * 1.5 + s[0] * size, y, z + s[1] * size, mat || p.white);
      }
    }
    function hatch(pack, p, x, y, z, w = 2, d = 3) {
      pack.box(w, .09, d, x, y, z, p.dark); pack.box(w - .18, .1, d - .18, x, y + .05, z, p.light);
      pack.line([x - w * .25, y + .13, z], [x + w * .25, y + .13, z], .055, p.black);
    }
    function jet(pack, p, x, y, z, yaw, scale = 1) {
      pack.scope(matrix(x, y, z, scale, scale, scale, 0, yaw, 0), q => {
        q.box(1.2, .8, 8.2, 0, 1.05, -.8, p.light);
        q.add(ringHull([[0, 7.5], [1.05, 1.7], [.95, -5], [-.95, -5], [-1.05, 1.7]], [[.8, 1, 1], [1.65, .75, .92]]), p.light);
        q.add(ringHull([[-.8, 1.3], [-5.9, -2.8], [-5.6, -4.7], [-.55, -3.1]], [[1.05, 1, 1], [1.22, 1, 1]]), p.hull);
        q.add(ringHull([[.8, 1.3], [5.9, -2.8], [5.6, -4.7], [.55, -3.1]], [[1.05, 1, 1], [1.22, 1, 1]]), p.hull);
        q.box(1.1, .65, 2.8, 0, 1.82, 2.25, p.glass, 0, -.08);
        q.box(.15, 2.4, 2.1, -.85, 2.35, -3.7, p.dark, 0, -.22, -.18);
        q.box(.15, 2.4, 2.1, .85, 2.35, -3.7, p.dark, 0, -.22, .18);
        for (const side of [-1, 1]) {
          q.cylinder(.43, 2.1, side * .64, .98, -4.4, p.black, 1, 8, Math.PI / 2);
          q.box(2.1, .12, 1.15, side * 1.45, 1.35, -4, p.light, -side * .45);
          q.cylinder(.28, .32, side * .62, .35, -1.7, p.black, 1, 8, 0, Math.PI / 2);
          q.box(.18, .45, .18, side * .62, .6, -1.7, p.steel);
          q.box(.65, .06, .6, side * 3.3, 1.3, -2.8, p.accent);
        }
        q.cylinder(.25, .25, 0, .3, 3.9, p.black, 1, 8, 0, Math.PI / 2);
      });
    }
    function turret(kind, p, faction) {
      const key = faction + ':' + kind;
      if (!turretTemplates.has(key)) {
        const root = new THREE.Group(), q = new Pack();
        root.name = 'naval-' + kind; root.userData.navalPart = 'turret'; root.userData.weaponKind = kind;
        if (kind === 'gun') {
          q.cylinder(2.5, .55, 0, .25, 0, p.dark);
          q.box(4.2, 2.3, 4.4, 0, 1.55, -.3, p.light);
          q.box(3.7, 1.5, 1.1, 0, 1.7, 2, p.hull, 0, -.28);
          q.cylinder(.24, 6.3, 0, 1.8, 4.2, p.dark, 1, 10, Math.PI / 2);
          q.cylinder(.36, 1.5, 0, 1.8, 2.5, p.hull, 1, 10, Math.PI / 2);
          q.box(.5, .45, .6, 1.4, 2.8, -.2, p.glass);
          root.userData.muzzle = { x: 0, y: 1.8, z: 7.35 };
        } else if (kind === 'ciws') {
          q.cylinder(1.1, .45, 0, .2, 0, p.dark);
          q.box(1.8, 1.9, 1.7, 0, 1.25, 0, p.light);
          q.cylinder(.76, 1.5, 0, 2.6, -.2, p.white, 1, 12);
          q.sphere(.76, 0, 3.3, -.2, p.white, .65);
          for (let k = 0; k < 6; k++) {
            const a = k * Math.PI / 3;
            q.cylinder(.075, 2.8, Math.cos(a) * .2, 1.55 + Math.sin(a) * .2, 1.85, p.black, 1, 6, Math.PI / 2);
          }
          q.cylinder(.32, .18, 0, 1.55, 3.1, p.dark, 1, 8, Math.PI / 2);
          root.userData.muzzle = { x: 0, y: 1.55, z: 3.25 };
        } else {
          q.cylinder(.55, .25, 0, .13, 0, p.dark, 1, 10);
          q.box(.85, .7, 1.2, 0, .7, 0, p.hull);
          q.box(1.2, 1.05, .15, 0, 1, .45, p.light);
          q.cylinder(.075, 1.8, 0, 1.05, 1.1, p.black, 1, 6, Math.PI / 2);
          q.box(.48, .37, .5, -.5, .85, -.1, p.dark);
          root.userData.muzzle = { x: 0, y: 1.05, z: 2 };
        }
        q.finish(root); turretTemplates.set(key, root);
      }
      return turretTemplates.get(key).clone(true);
    }
    function addTurret(root, type, p, faction, x, y, z, yaw = 0) {
      const t = turret(type, p, faction); t.position.set(x, y, z); t.rotation.y = yaw; t.userData.restYaw = yaw; root.add(t);
    }
    function addRadar(root, p, x, y, z, size = 1) {
      const pivot = new THREE.Group(), q = new Pack(); pivot.position.set(x, y, z); pivot.name = 'naval-radar'; pivot.userData.navalPart = 'radar';
      q.box(5.3 * size, 1.8 * size, .25 * size, 0, 0, 0, p.dark);
      q.box(5 * size, .11 * size, .31 * size, 0, .4 * size, 0, p.steel);
      q.box(5 * size, .11 * size, .31 * size, 0, -.4 * size, 0, p.steel);
      for (let i = -2; i <= 2; i++) q.box(.08 * size, 1.55 * size, .32 * size, i * size, 0, 0, p.steel);
      q.cylinder(.22 * size, 1.2 * size, 0, -.9 * size, 0, p.dark); q.finish(pivot); root.add(pivot);
    }
    function addPropellers(root, p, length, width, draft, count = 2) {
      for (let side = 0; side < count; side++) {
        const x = count === 1 ? 0 : (side / (count - 1) - .5) * width * .5;
        const pivot = new THREE.Group(), q = new Pack(); pivot.position.set(x, -draft * .64, -length * .43);
        pivot.userData.navalPart = 'propeller'; pivot.name = 'naval-propeller';
        q.cylinder(width * .055, .6, 0, 0, 0, p.steel, .6, 8, Math.PI / 2);
        for (let k = 0; k < 4; k++) q.box(width * .04, width * (count === 4 ? .13 : .23), .12, 0, 0, 0, p.steel, 0, 0, k * Math.PI / 2 + .18);
        q.finish(pivot); root.add(pivot);
      }
    }
    function buildCarrier(faction, omitAircraft = false) {
      const root = new THREE.Group(), q = new Pack(), p = palette(faction), enemy = faction === 'enemy';
      hull(q, p, 236, 49, 13.25, 8.5);
      const deck = [[-29, -120], [26, -120], [32, -103], [31, 90], [15, 120], [-7, 120], [-21, 102], [-25, 47], [-32, 13], [-32, -80]];
      q.add(ringHull(deck, [[13.3, 1, 1], [14, 1, 1]]), p.deck);
      for (const side of [-1, 1]) {
        q.box(1.5, .8, 153, side * 24.7, 10.1, -10, p.light);
        for (let z = -93; z <= 75; z += 21) {
          q.box(.2, 4.5, .25, side * 24.9, 7.2, z, p.dark);
          q.box(.18, 1.3, 3.7, side * 25.04, 9, z, p.black);
        }
        for (let z = -85; z <= 35; z += 24) {
          q.box(3.3, .3, 7.6, side * 26.5, 11.7, z, p.dark);
          for (let k = 0; k < 3; k++) q.cylinder(.6, 2.1, side * 26.6, 12.5, z + (k - 1) * 2.1, p.white, 1, 8, Math.PI / 2);
        }
      }
      // The aft service dock is visible from the water and has an external stair.
      q.box(17, .7, 7, 0, 2.2, -116.5, p.dark); q.box(14.5, 4.1, .4, 0, 4.3, -117.8, p.black);
      q.box(15, .4, 1, 0, 6.5, -118, p.light);
      for (let i = 0; i < 18; i++) q.box(2.5, .2, 1, 11, 2.7 + i * .6, -117 + i * 1.45, p.steel);
      railing(q, p, [9.7, -118], [9.7, -91], 13.1, .9);
      // Angled landing lane and separated forward catapult lanes.
      const a = [-15.5, -105], b = [-5.5, 65];
      paintLine(q, p, [a[0] - 9.8, a[1]], [b[0] - 9.8, b[1]], .38, 14.03);
      paintLine(q, p, [a[0] + 9.8, a[1]], [b[0] + 9.8, b[1]], .38, 14.03);
      for (let i = 0; i < 20; i++) {
        const t = i / 20, z = a[1] + (b[1] - a[1]) * t, x = a[0] + (b[0] - a[0]) * t;
        paintLine(q, p, [x, z], [x + .29, z + 5], .3, 14.055, p.yellow);
      }
      for (const x of [8, 18]) {
        q.box(.65, .05, 73, x, 14.06, 57, p.black);
        q.box(.15, .06, 73, x - .65, 14.07, 57, p.white);
        q.box(.15, .06, 73, x + .65, 14.07, 57, p.white);
        q.box(5.3, .07, .8, x, 14.08, 17, p.yellow);
        for (let i = 0; i < 4; i++) q.box(4.2, .05, .4, x, 14.06, 91 + i * 1.3, p.white);
      }
      for (let z = -77; z <= -47; z += 10) paintLine(q, p, [-26, z], [4, z - 2], .16, 14.08, p.steel);
      for (const z of [-87, 56]) {
        q.box(17, .06, 24, 21.6, 14.05, z, p.dark); q.box(15.8, .07, 22.8, 21.6, 14.09, z, p.hull);
        for (let k = 0; k < 9; k++) q.box(1, .08, .55, 14.6 + k * 1.75, 14.13, z + 10.8, k % 2 ? p.black : p.yellow);
      }
      for (let z = -105; z < 96; z += 14) {
        q.box(.85, .11, 1.8, -28.7 + Math.max(0, z - 35) * .1, 14.1, z, p.yellow);
        q.box(.85, .11, 1.8, 29.1 - Math.max(0, z - 80) * .3, 14.1, z, p.yellow);
      }
      // Three open vertical-launch cells, clear of the aircraft and island.
      // Native forward/side/height launch coordinates are Z/-X/15.8.
      const missileLaunchPoints = [-49, -45, -41].map(z => ({ x: 29, y: 15.8, z }));
      for (const point of missileLaunchPoints) {
        q.box(2.9, .04, 3.1, point.x, 14.1, point.z, p.yellow);
        q.box(2.6, .2, 2.8, point.x, 14.23, point.z, p.dark);
        q.box(2.3, 1.15, 2.4, point.x, 14.875, point.z, p.hull);
        q.box(1.8, .045, 1.9, point.x, 15.47, point.z, p.black);
        q.box(2.3, .12, .16, point.x, 15.55, point.z - 1.12, p.steel);
        q.box(2.3, .12, .16, point.x, 15.55, point.z + 1.12, p.steel);
        q.box(.16, .12, 2.1, point.x - 1.07, 15.55, point.z, p.steel);
        q.box(.16, .12, 2.1, point.x + 1.07, 15.55, point.z, p.steel);
        q.box(2.1, .16, 2.3, point.x + 1.2, 16.12, point.z, p.light, 0, 0, .72);
        q.box(.3, .07, 1.8, point.x + 1.3, 16.31, point.z, p.accent, 0, 0, .72);
      }
      digits(q, p, enemy ? '31' : '07', -6, 99, 14.11, 3.5);
      digits(q, p, enemy ? '31' : '07', 3, -107, 14.11, 2.2, p.yellow);
      // Bridge/island tiers: broad bridge glazing and an open lattice radar mast.
      const ix = 22.5, iz = enemy ? -3 : -13;
      q.box(11.8, 10.2, 34, ix, 19.1, iz, p.hull);
      q.box(13.8, .6, 28.8, ix - .4, 24.5, iz + 1, p.light);
      q.box(12.4, 4.5, 24.2, ix - .4, 27, iz + 1, p.light);
      q.box(12.8, 2.4, .3, ix - .4, 27.3, iz + 13.25, p.glass);
      q.box(.3, 2.4, 16, ix - 6.75, 27.3, iz + 4.7, p.glass);
      q.box(.3, 2.4, 16, ix + 5.95, 27.3, iz + 4.7, p.glass);
      for (let i = -3; i <= 3; i++) q.box(.15, 2.55, .35, ix + i * 1.65, 27.3, iz + 13.4, p.light);
      for (let i = -2; i <= 2; i++) q.box(.36, 2.55, .16, ix - 6.8, 27.3, iz + i * 3 + 5, p.light);
      q.box(13.5, .65, 25.4, ix - .4, 29.5, iz + 1, p.dark);
      q.box(8.4, 4.4, 10, ix + .5, 31.8, iz - 4, p.hull);
      q.box(9, .5, 10.7, ix + .5, 34.2, iz - 4, p.light);
      q.box(7.1, 1.2, .24, ix + .5, 32.6, iz + 1.08, p.glass);
      for (const dz of [-13, -7]) {
        q.box(3.4, 6.4, 4.1, ix + 1.7, 32, iz + dz, p.dark);
        q.box(3, .3, 3.8, ix + 1.7, 35.4, iz + dz, p.black);
      }
      for (const x of [ix - 1.8, ix + 1.8]) for (const z of [iz + 2.4, iz + 6])
        q.line([x, 29.7, z], [ix + (x - ix) * .42, 44, iz + 4.2], .18, p.light);
      for (const y of [34, 38, 42]) q.box(5.5 - (y - 34) * .3, .22, 5.1 - (y - 34) * .3, ix, y, iz + 4.2, p.steel);
      q.cylinder(.16, 8, ix, 46.5, iz + 4.2, p.dark, 1, 8);
      q.sphere(1.25, ix - 4, 31.1, iz + 10, p.white);
      q.sphere(1.4, ix + 4, 36, iz - 4, p.white);
      q.box(.16, 2, 3.2, ix, 47, iz + 5.8, p.accent);
      q.box(.3, 1.35, 10.8, ix - 6.02, 21.4, iz + 2, p.accent);
      railing(q, p, [ix - 7.1, iz - 12.7], [ix - 7.1, iz + 14.8], 29.7, 1);
      // A restrained parked air wing keeps the central operational deck clear.
      if (!omitAircraft) {
        jet(q, p, 20, 14, -69, -.15, .93);
        jet(q, p, 20, 14, -47, -.15, .93);
        jet(q, p, -23, 14, 24, .17, .82);
        jet(q, p, -19, 14, 50, .17, .82);
      }
      q.box(2.8, 1.3, 4.7, 11, 14.8, -72, p.yellow);
      for (const x of [9.6, 12.4]) for (const z of [-73.6, -70.4]) q.cylinder(.55, .4, x, 14.5, z, p.black, 1, 8, 0, Math.PI / 2);
      for (const [x, z, yaw] of [[-27, -103, Math.PI], [28, -101, Math.PI], [-23, 78, 0], [27, 72, 0]]) {
        q.box(6, .65, 7, x, 12, z, p.dark); addTurret(root, 'ciws', p, faction, x, 12.4, z, yaw);
      }
      q.box(1, .3, 1.8, -25, 14.5, 78, p.port); q.box(1, .3, 1.8, 27, 14.5, 78, p.green);
      q.finish(root); addRadar(root, p, ix, 43.8, iz + 4.2, 1.25); addRadar(root, p, ix - 1, 35.4, iz + 10, .62);
      addPropellers(root, p, 236, 49, 8.5, 4);
      root.userData.decorativeAircraft = omitAircraft ? 0 : 4; root.userData.flightDeck = { minX: -22, maxX: 11, minZ: -95, maxZ: 75, y: 14 };
      root.userData.missileLaunchPoints = missileLaunchPoints;
      return root;
    }
    function buildDestroyer(faction) {
      const root = new THREE.Group(), q = new Pack(), p = palette(faction), enemy = faction === 'enemy';
      hull(q, p, 76, 14.8, 5.2, 4.6);
      q.box(10.3, 1.8, 30, 0, 5.95, -1, p.hull);
      q.box(9.3, 4.6, 13, 0, 8.9, 4, p.light);
      q.box(10.1, .45, 14.2, 0, 11.45, 4, p.dark);
      q.box(9.4, 1.7, .24, 0, 9.9, 10.6, p.glass);
      q.box(.24, 1.7, 8, -4.75, 9.9, 6.5, p.glass); q.box(.24, 1.7, 8, 4.75, 9.9, 6.5, p.glass);
      for (let x = -3.6; x <= 3.6; x += 1.2) q.box(.12, 1.8, .3, x, 9.9, 10.75, p.light);
      q.box(6.2, 4.4, 7.4, 0, 13.6, 1.4, p.hull);
      q.box(4.5, 4.8, 4, 0, 18, 1.4, p.dark);
      for (const [x, z, yaw] of [[0, 3.5, 0], [2.35, 1.4, Math.PI / 2], [0, -.7, Math.PI], [-2.35, 1.4, -Math.PI / 2]]) {
        q.box(3.7, 3.1, .15, x, 18.1, z, p.glass, yaw);
        q.box(3.95, .12, .18, x, 19.75, z, p.steel, yaw);
      }
      q.cylinder(.13, 7.5, 0, 24, 1.4, p.dark, 1, 8); q.box(.12, 1.4, 2.1, 0, 25.5, 2.5, p.accent);
      // Recessed vertical-launch banks ahead of the bridge.
      q.box(8.8, .4, 9, 0, 5.45, 18.4, p.dark);
      for (let x = -3; x <= 3; x += 2) for (let z = 15.2; z <= 21.3; z += 2) {
        q.box(1.65, .12, 1.65, x, 5.72, z, p.light); q.box(1.38, .04, .07, x, 5.8, z, p.dark);
      }
      for (const z of [-5.6, -12]) {
        q.box(5.4, 4.8, 4.5, 0, 9.7, z, p.hull); q.box(4.8, .25, 3.9, 0, 12.25, z, p.black);
        for (let k = -1; k <= 1; k++) q.box(.14, .3, 3.5, k * 1.3, 12.4, z, p.steel);
      }
      // Helipad with visible safety circles, tie downs, and aft hangar doors.
      q.box(11.3, .14, 17, 0, 5.31, -27, p.nonslip);
      for (let k = 0; k < 24; k++) {
        const a = k * Math.PI / 12, b = (k + 1) * Math.PI / 12;
        paintLine(q, p, [Math.sin(a) * 4.5, -27 + Math.cos(a) * 6], [Math.sin(b) * 4.5, -27 + Math.cos(b) * 6], .15, 5.4, p.yellow);
      }
      q.box(.35, .045, 5.5, -1.5, 5.45, -27, p.white); q.box(.35, .045, 5.5, 1.5, 5.45, -27, p.white); q.box(3, .045, .4, 0, 5.45, -27, p.white);
      q.box(7, 5.4, 7.8, 0, 8.2, -16, p.light); q.box(5.7, 4.5, .15, 0, 7.8, -20, p.dark);
      for (let x = -2.5; x <= 2.5; x += .5) q.box(.07, 4.4, .2, x, 7.8, -20.1, p.hull);
      for (const side of [-1, 1]) {
        railing(q, p, [side * 6.8, -31], [side * 6.8, 19], 5.2, .85, 6);
        q.box(.18, .65, 5.2, side * 7.15, 3.8, 1, p.accent);
        for (const z of [-13, -5]) q.cylinder(.43, 2.1, side * 6, 6.1, z, p.white, 1, 8, Math.PI / 2);
        q.box(1.1, 1.1, 4, side * 5.8, 6.1, -3, p.dark);
        for (let k = 0; k < 2; k++) q.cylinder(.34, 3.5, side * 5.8, 6.7 + k * .65, -3, p.hull, 1, 8, Math.PI / 2);
      }
      hatch(q, p, 0, 5.3, 34, 2.6, 2.3); digits(q, p, enemy ? '31' : '07', -1.5, 29.3, 5.4, 1.4);
      q.box(.4, .2, .8, -5.4, 11.7, 8, p.port); q.box(.4, .2, .8, 5.4, 11.7, 8, p.green);
      q.finish(root); addTurret(root, 'gun', p, faction, 0, 5.25, 27.5);
      addTurret(root, 'ciws', p, faction, 0, 11.05, -16, Math.PI); addRadar(root, p, 0, 22, 1.4, .72);
      addPropellers(root, p, 76, 14.8, 4.6); return root;
    }
    function buildPatrol(faction) {
      const root = new THREE.Group(), q = new Pack(), p = palette(faction);
      hull(q, p, 18, 4.95, 2.2, 1.4);
      q.box(3.4, 2.7, 5, 0, 3.55, .1, p.light);
      q.box(3.65, .25, 5.5, 0, 5.05, .1, p.dark);
      q.box(3.22, 1.08, .16, 0, 4, 2.63, p.glass);
      q.box(.16, 1.08, 3.8, -1.75, 4, .45, p.glass); q.box(.16, 1.08, 3.8, 1.75, 4, .45, p.glass);
      q.box(.16, 1.15, .23, 0, 4, 2.73, p.light);
      q.box(2.9, .3, 1.1, 0, 5.4, -.9, p.accent);
      for (const x of [-1, 1]) q.line([x, 5.2, -1.3], [x * .5, 7.8, -1.3], .085, p.dark);
      q.box(1.6, .12, .7, 0, 7.1, -1.3, p.dark); q.cylinder(.055, 3, -.6, 7.9, -1.2, p.steel, 1, 6);
      q.box(.08, .8, 1.1, -.6, 8.5, -.6, p.accent);
      q.box(3.1, .2, 3.2, 0, 2.37, -5.2, p.nonslip);
      for (const side of [-1, 1]) {
        railing(q, p, [side * 2.15, -6.7], [side * 2.15, 4.7], 2.2, .65, 2.7);
        q.box(.1, .45, 5.6, side * 2.38, 1.65, -.7, p.accent);
        for (const z of [-5.8, -3.6, 1.7]) q.cylinder(.33, .32, side * 2.3, 1.5, z, p.black, 1, 10, 0, Math.PI / 2);
        q.box(.7, .55, 1.6, side * 1.4, 2.57, -5.1, p.hull);
      }
      hatch(q, p, 0, 2.25, 6.6, 1.1, 1.2); q.box(.3, .17, .45, -1.8, 5.2, 1.7, p.port); q.box(.3, .17, .45, 1.8, 5.2, 1.7, p.green);
      q.finish(root); addTurret(root, 'machinegun', p, faction, 0, 2.25, 4.6); addTurret(root, 'machinegun', p, faction, 0, 2.45, -5.4, Math.PI);
      addRadar(root, p, 0, 7.6, -1.3, .2); addPropellers(root, p, 18, 4.95, 1.4); return root;
    }
    function buildShip(spec = {}) {
      if (disposed) throw new Error('Naval asset factory is disposed.');
      const kind = Object.prototype.hasOwnProperty.call(METRICS, spec.kind) ? spec.kind : 'patrol';
      const faction = spec.faction === 'enemy' ? 'enemy' : 'ally', omitAircraft = kind === 'carrier' && spec.omitAircraft === true;
      const key = kind + ':' + faction + (omitAircraft ? ':native-aircraft' : '');
      if (!templates.has(key)) templates.set(key, kind === 'carrier' ? buildCarrier(faction, omitAircraft) : kind === 'destroyer' ? buildDestroyer(faction) : buildPatrol(faction));
      const root = templates.get(key).clone(true); root.name = spec.name || spec.id || 'naval-' + key;
      root.userData.navalId = spec.id || null; root.userData.kind = kind; root.userData.faction = faction;
      root.userData.metrics = { ...METRICS[kind] };
      root.userData.navalParts = { turrets: [], radars: [], propellers: [] };
      root.traverse(obj => {
        const part = obj.userData.navalPart;
        if (part === 'turret') root.userData.navalParts.turrets.push(obj);
        if (part === 'radar') root.userData.navalParts.radars.push(obj);
        if (part === 'propeller') root.userData.navalParts.propellers.push(obj);
      });
      return root;
    }
    function buildDock(spec = {}) {
      if (disposed) throw new Error('Naval asset factory is disposed.');
      const length = Number.isFinite(spec.length) ? Math.max(24, Math.min(600, spec.length)) : 104;
      const width = Number.isFinite(spec.width) ? Math.max(12, Math.min(40, spec.width)) : 18;
      const deckY = Number.isFinite(spec.deckY) ? spec.deckY : 2.2;
      const key = 'dock:' + length + ':' + width + ':' + deckY;
      if (!templates.has(key)) {
        const root = new THREE.Group(), q = new Pack(), p = palette('ally');
        const concrete = material('naval-pier-concrete', 0x949e9e, { roughness: .96, metalness: 0 });
        q.box(width, .9, length, 0, deckY - .45, 0, concrete);
        q.box(width * .64, .055, length - 2, 0, deckY + .03, 0, p.deck);
        for (let z = -length / 2 + 4; z <= length / 2 - 4; z += 12) {
          for (const side of [-1, 1]) {
            q.cylinder(.7, 6, side * (width / 2 - 1.5), deckY - 3.7, z, p.dark, 1, 10);
            q.cylinder(.3, .6, side * (width / 2 - .65), deckY + .3, z, p.steel, 1, 8);
            q.box(.95, .2, .3, side * (width / 2 - .65), deckY + .6, z, p.steel);
            q.cylinder(.6, .45, side * (width / 2 + .1), deckY - .5, z, p.black, 1, 10, 0, Math.PI / 2);
          }
          q.box(.18, .04, 5, 0, deckY + .07, z, p.yellow);
        }
        for (const side of [-1, 1]) q.box(.25, .1, length - 1, side * (width / 2 - .5), deckY + .05, 0, p.yellow);
        // Keep the centre access lane clear all the way from shore to boarding.
        const storeZ = -length * .27, storeWidth = Math.min(7.4, width * .34), storeX = -width / 2 + storeWidth / 2 + .6;
        q.box(storeWidth, 5.3, 17, storeX, deckY + 2.65, storeZ, p.hull);
        q.box(storeWidth + .4, .4, 18.1, storeX, deckY + 5.45, storeZ, p.dark);
        q.box(storeWidth - .8, 3.6, .2, storeX, deckY + 1.8, storeZ + 8.62, p.black);
        for (let x = -storeWidth / 2 + .5; x <= storeWidth / 2 - .4; x += .5) q.box(.06, 3.4, .25, storeX + x, deckY + 1.8, storeZ + 8.72, p.steel);
        q.box(storeWidth - .4, .65, .26, storeX, deckY + 4.4, storeZ + 8.75, p.accent);
        for (let z = storeZ - 6; z <= storeZ + 6; z += 4) for (const side of [-1, 1])
          q.box(.12, 1.1, 2.3, storeX + side * (storeWidth / 2 + .06), deckY + 3.8, z, p.glass);
        const lightZ = -length / 2 + 6, lightX = -width * .34;
        q.cylinder(1.65, 8.3, lightX, deckY + 4.15, lightZ, p.white, .76, 8);
        q.cylinder(1.42, 1.1, lightX, deckY + 5.4, lightZ, p.accent, .97, 8);
        q.cylinder(1.7, .25, lightX, deckY + 8.45, lightZ, p.dark, 1, 8);
        q.cylinder(1.28, 1.6, lightX, deckY + 9.35, lightZ, p.glass, 1, 8);
        q.sphere(.7, lightX, deckY + 9.4, lightZ, p.lamp);
        q.cylinder(1.75, 1.25, lightX, deckY + 10.65, lightZ, p.dark, 0, 8);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          q.line([lightX + Math.sin(a) * 1.34, deckY + 8.6, lightZ + Math.cos(a) * 1.34], [lightX + Math.sin(a) * 1.34, deckY + 10.15, lightZ + Math.cos(a) * 1.34], .07, p.steel);
        }
        // Compact loading crane, supplies, hose reel, and end-of-pier boarding apron.
        const craneX = width * .31, craneZ = length * .19;
        q.box(2.2, 1.1, 2.2, craneX, deckY + .55, craneZ, p.dark);
        q.box(.65, 8.7, .65, craneX, deckY + 5.4, craneZ, p.yellow);
        q.line([craneX, deckY + 9.5, craneZ], [width * .88, deckY + 10.8, craneZ], .25, p.yellow, 8);
        q.line([craneX, deckY + 7, craneZ], [width * .72, deckY + 10.5, craneZ], .15, p.dark);
        q.line([width * .88, deckY + 10.7, craneZ], [width * .88, deckY + 3.1, craneZ], .035, p.black);
        q.box(.6, .65, .4, width * .88, deckY + 2.9, craneZ, p.dark);
        for (let i = 0; i < 5; i++) q.box(1.7, 1.5 + (i % 2) * .6, 2.3, -width * .3 + (i % 2) * 2.1, deckY + .75 + (i % 2) * .3, length * .1 + Math.floor(i / 2) * 3, i % 2 ? p.dark : p.hull);
        q.cylinder(.75, .55, width * .3, deckY + .8, length * .33, p.dark, 1, 12, 0, Math.PI / 2);
        for (const z of [-length * .08, length * .32]) {
          q.cylinder(.11, 7.1, -width * .43, deckY + 3.55, z, p.steel, 1, 8);
          q.line([-width * .43, deckY + 7, z], [-width * .24, deckY + 7, z], .09, p.steel);
          q.box(1.1, .25, .6, -width * .24, deckY + 6.9, z, p.lamp);
        }
        q.box(width * .85, .09, 7, 0, deckY + .07, length / 2 - 4, p.nonslip);
        for (let i = 0; i < 7; i++) q.box(.6, .04, 2.8, -3 + i, deckY + .14, length / 2 - 4, i % 2 ? p.yellow : p.white);
        q.finish(root); root.userData.metrics = { length, width, deckY }; templates.set(key, root);
      }
      const root = templates.get(key).clone(true); root.name = spec.name || spec.id || 'naval-allied-pier';
      root.userData.navalId = spec.id || 'eastern-naval-dock'; root.userData.kind = 'dock';
      return root;
    }
    function dispose() {
      if (disposed) return; disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
      geometries.clear(); materials.clear(); primitiveCache.clear(); materialCache.clear(); templates.clear(); turretTemplates.clear();
    }
    return Object.freeze({ buildShip, buildDock, dispose });
  }
  global.HanQEasternNavalAssets = Object.freeze({ create, metrics: METRICS, version: 'eastern-naval-assets-v1' });
})(typeof window !== 'undefined' ? window : globalThis);
