/* Shared, bounded projectile visuals. Local +Z is the direction of flight. */
(function (global) {
  'use strict';
  const VERSION = '1.0.0';
  const KINDS = ['shell', 'rocket', 'missile', 'mortar', 'grenadeRound'];

  function create(T, options = {}) {
    const capacity = Math.max(1, Math.min(256, Math.floor(Number(options.capacity) || 96)));
    const root = new T.Group();
    root.name = 'HanQ projectile visuals';
    root.userData.ordnanceVisuals = true;
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .54, metalness: .38 });
    material.name = 'Ordnance metal and paint';
    const exhaustMaterial = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .86,
      blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    exhaustMaterial.name = 'Ordnance directional exhaust';
    const colors = {};
    const palette = {
      steel: '#9aa8af', light: '#dce7e9', dark: '#253037', copper: '#d29b53',
      olive: '#657052', oliveLight: '#8d9876', white: '#d9e0dc', yellow: '#e7bc42',
      fin: '#53636a', finEdge: '#b3c0c4', flameWhite: '#fff6c7', flameGold: '#ffd06a',
      flameOrange: '#ff8838', flameRed: '#d84014'
    };
    for (const key of Object.keys(palette)) colors[key] = new T.Color(palette[key]);

    // Build colored surfaces into one geometry, so fins and bands add no draws.
    function builder() {
      const positions = [], normals = [], vertexColors = [];
      function vertex(x, y, z, nx, ny, nz, color) {
        positions.push(x, y, z); normals.push(nx, ny, nz);
        vertexColors.push(color.r, color.g, color.b);
      }
      function triangle(a, b, c, color) {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
        for (const p of [a, b, c]) vertex(p[0], p[1], p[2], nx, ny, nz, color);
      }
      function profile(rings, segments = 14) {
        for (let j = 1; j < rings.length; j++) {
          const a = rings[j - 1], b = rings[j], dz = b[0] - a[0], dr = b[1] - a[1];
          const length = Math.hypot(dz, dr) || 1, radial = dz / length, nz = -dr / length;
          const ca = colors[a[2]], cb = colors[b[2]];
          for (let i = 0; i < segments; i++) {
            const u = i / segments * Math.PI * 2, v = (i + 1) / segments * Math.PI * 2;
            const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
            if (a[1] > 0) {
              vertex(a[1] * cu, a[1] * su, a[0], radial * cu, radial * su, nz, ca);
              vertex(a[1] * cv, a[1] * sv, a[0], radial * cv, radial * sv, nz, ca);
              vertex(b[1] * cv, b[1] * sv, b[0], radial * cv, radial * sv, nz, cb);
            }
            if (b[1] > 0) {
              vertex(a[1] * cu, a[1] * su, a[0], radial * cu, radial * su, nz, ca);
              vertex(b[1] * cv, b[1] * sv, b[0], radial * cv, radial * sv, nz, cb);
              vertex(b[1] * cu, b[1] * su, b[0], radial * cu, radial * su, nz, cb);
            }
          }
        }
      }
      function fins(points, thickness, color, count = 4, offset = Math.PI / 4) {
        for (let f = 0; f < count; f++) {
          const a = offset + f * Math.PI * 2 / count, c = Math.cos(a), s = Math.sin(a);
          const sides = [-1, 1].map(side => points.map(p => [p[0] * c - side * thickness * s,
            p[0] * s + side * thickness * c, p[1]]));
          for (let i = 1; i + 1 < points.length; i++) {
            triangle(sides[0][0], sides[0][i], sides[0][i + 1], colors[color]);
            triangle(sides[1][0], sides[1][i + 1], sides[1][i], colors[color]);
          }
          for (let i = 0; i < points.length; i++) {
            const next = (i + 1) % points.length;
            triangle(sides[0][i], sides[1][i], sides[1][next], colors.finEdge);
            triangle(sides[0][i], sides[1][next], sides[0][next], colors.finEdge);
          }
        }
      }
      function finish() {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(vertexColors, 3));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return geometry;
      }
      return { profile, fins, finish };
    }

    function makeBody(kind) {
      const b = builder();
      if (kind === 'shell') {
        b.profile([[-.82, 0, 'dark'], [-.82, .105, 'dark'], [-.77, .14, 'fin'],
          [-.69, .14, 'fin'], [-.67, .163, 'copper'], [-.60, .163, 'copper'],
          [-.57, .145, 'steel'], [.29, .145, 'steel'], [.40, .132, 'light'],
          [.67, .077, 'light'], [.88, 0, 'steel']]);
        b.fins([[.105, -.78], [.29, -.76], [.235, -.53], [.13, -.42]], .012, 'fin');
      } else if (kind === 'rocket') {
        b.profile([[-1.10, 0, 'dark'], [-1.10, .10, 'dark'], [-1.05, .13, 'fin'],
          [-.96, .13, 'fin'], [-.91, .15, 'oliveLight'], [.36, .15, 'oliveLight'],
          [.37, .153, 'yellow'], [.45, .153, 'yellow'], [.46, .15, 'olive'],
          [.64, .14, 'olive'], [.83, .108, 'dark'], [1.03, .055, 'dark'], [1.15, 0, 'dark']]);
        b.fins([[.12, -1.00], [.36, -.96], [.29, -.61], [.145, -.42]], .014, 'olive');
      } else if (kind === 'missile') {
        b.profile([[-1.25, 0, 'dark'], [-1.25, .10, 'dark'], [-1.19, .132, 'fin'],
          [-1.10, .145, 'white'], [.62, .145, 'white'], [.63, .148, 'yellow'],
          [.71, .148, 'yellow'], [.72, .14, 'white'], [.82, .13, 'dark'],
          [1.04, .098, 'dark'], [1.24, .043, 'dark'], [1.35, 0, 'dark']]);
        b.fins([[.13, -1.12], [.42, -.98], [.30, -.56], [.14, -.39]], .013, 'white');
        b.fins([[.14, .20], [.28, .24], [.19, .60], [.14, .66]], .010, 'fin');
      } else if (kind === 'mortar') {
        b.profile([[-.46, 0, 'dark'], [-.46, .052, 'fin'], [-.18, .065, 'fin'],
          [-.12, .115, 'olive'], [.13, .14, 'oliveLight'], [.23, .13, 'oliveLight'],
          [.25, .127, 'yellow'], [.29, .112, 'yellow'], [.40, .065, 'steel'], [.50, 0, 'steel']]);
        b.fins([[.045, -.44], [.185, -.43], [.17, -.26], [.065, -.14]], .010, 'fin');
      } else {
        b.profile([[-.26, 0, 'dark'], [-.26, .102, 'copper'], [-.20, .106, 'copper'],
          [-.17, .10, 'olive'], [.10, .10, 'oliveLight'], [.20, .082, 'oliveLight'],
          [.27, .038, 'steel'], [.29, 0, 'steel']], 12);
      }
      const geometry = b.finish(); geometry.name = 'Ordnance ' + kind;
      return geometry;
    }

    const specs = {
      shell: { tail: -.82, width: .045, flame: .42 },
      rocket: { tail: -1.10, width: .14, flame: .95 },
      missile: { tail: -1.25, width: .15, flame: 1.10 },
      mortar: { tail: -.46, width: .027, flame: .23 },
      grenadeRound: { tail: -.26, width: 0, flame: 0 }
    };
    const pools = {};
    const stats = { capacity, active: 0, dropped: 0, invalid: 0, exhaust: 0, drawCalls: 0, instances: {} };
    for (const kind of KINDS) {
      const mesh = new T.InstancedMesh(makeBody(kind), material, capacity);
      mesh.name = 'ordnance-body-' + kind;
      mesh.userData.ordnanceKind = kind; mesh.userData.ordnanceRole = 'body';
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      root.add(mesh); pools[kind] = mesh; stats.instances[kind] = 0;
    }
    const flameBuilder = builder();
    flameBuilder.profile([[-1, 0, 'flameRed'], [-.72, .26, 'flameOrange'],
      [-.24, .78, 'flameGold'], [-.035, .32, 'flameWhite'], [0, 0, 'flameWhite']], 10);
    const exhaust = new T.InstancedMesh(flameBuilder.finish(), exhaustMaterial, capacity);
    exhaust.name = 'ordnance-exhaust'; exhaust.userData.ordnanceRole = 'exhaust';
    exhaust.count = 0; exhaust.visible = false; exhaust.frustumCulled = false;
    exhaust.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(exhaust);

    const dummy = new T.Object3D(), flameDummy = new T.Object3D();
    const forward = new T.Vector3(0, 0, 1), direction = new T.Vector3(), rear = new T.Vector3();
    let disposed = false;
    function begin() {
      if (disposed) return false;
      stats.active = stats.dropped = stats.invalid = stats.exhaust = stats.drawCalls = 0;
      for (const kind of KINDS) { pools[kind].count = 0; pools[kind].visible = false; stats.instances[kind] = 0; }
      exhaust.count = 0; exhaust.visible = false;
      return true;
    }
    function add(kind, x, h, y, vx, vh, vy, scale = 1, time = 0) {
      if (disposed) return false;
      const mesh = pools[kind];
      if (!mesh || !Number.isFinite(x) || !Number.isFinite(h) || !Number.isFinite(y) || !Number.isFinite(scale) || scale <= 0) {
        stats.invalid++; return false;
      }
      if (stats.active >= capacity) { stats.dropped++; return false; }
      const speed = Math.hypot(vx, vh, vy);
      if (Number.isFinite(speed) && speed > 1e-8) direction.set(vx / speed, vh / speed, vy / speed);
      else direction.copy(forward);
      dummy.position.set(x, h, y); dummy.quaternion.setFromUnitVectors(forward, direction);
      dummy.scale.setScalar(scale); dummy.updateMatrix();
      mesh.setMatrixAt(mesh.count++, dummy.matrix); mesh.visible = true;
      stats.active++; stats.instances[kind]++;
      const spec = specs[kind];
      if (spec.flame > 0) {
        // Offset in model space before rotation; the flame always stays behind the nozzle.
        rear.set(0, 0, spec.tail * scale).applyQuaternion(dummy.quaternion).add(dummy.position);
        const t = Number.isFinite(time) ? time : 0;
        const pulse = .88 + .12 * Math.sin(t * 43 + x * .17 + y * .11);
        flameDummy.position.copy(rear); flameDummy.quaternion.copy(dummy.quaternion);
        flameDummy.scale.set(spec.width * scale, spec.width * scale, spec.flame * scale * pulse);
        flameDummy.updateMatrix(); exhaust.setMatrixAt(exhaust.count++, flameDummy.matrix);
        exhaust.visible = true; stats.exhaust++;
      }
      return true;
    }
    function end() {
      if (disposed) return stats;
      stats.drawCalls = 0;
      for (const kind of KINDS) {
        const mesh = pools[kind]; mesh.visible = mesh.count > 0;
        if (mesh.count) { mesh.instanceMatrix.needsUpdate = true; stats.drawCalls++; }
      }
      exhaust.visible = exhaust.count > 0;
      if (exhaust.count) { exhaust.instanceMatrix.needsUpdate = true; stats.drawCalls++; }
      return stats;
    }
    function dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent();
      for (const kind of KINDS) { pools[kind].geometry.dispose(); pools[kind].dispose(); }
      exhaust.geometry.dispose(); exhaust.dispose(); material.dispose(); exhaustMaterial.dispose();
      root.clear();
    }
    return { root, begin, add, end, dispose, stats };
  }
  global.HanQOrdnance = Object.freeze({ version: VERSION, create });
})(typeof window !== 'undefined' ? window : globalThis);
