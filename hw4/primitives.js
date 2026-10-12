// =====================================================================
// HW3 Part 2: geometric primitives
// ---------------------------------------------------------------------
// Every maker returns { positions, colors, indices } so the renderer can
// treat all shapes the same way. Nothing is drawn here - these are just
// vertex lists.
//
// Convention: all shapes are centered on the origin and roughly 2 units
// tall, so they can be placed and scaled uniformly by the scene code.
// =====================================================================

// --- helpers ---------------------------------------------------------

// HSV -> RGB, h/s/v in 0..1. Used to give each shape a rainbow band.
function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

function emptyMesh() {
  return { pos: [], col: [], idx: [] };
}

// Appends one vertex and returns its index, so index bookkeeping never
// has to be done by hand.
function addVertex(m, x, y, z, c) {
  m.pos.push(x, y, z);
  m.col.push(c[0], c[1], c[2]);
  return m.pos.length / 3 - 1;
}

function finishMesh(m) {
  return {
    positions: new Float32Array(m.pos),
    colors: new Float32Array(m.col),
    indices: new Uint16Array(m.idx)
  };
}

// --- cube (the original primitive, unchanged) ------------------------

function makeCube() {
  return {
    positions: new Float32Array([
      -1, -1, -1,   1, -1, -1,   1,  1, -1,  -1,  1, -1,
      -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1
    ]),
    colors: new Float32Array([
      1,0,0,  0,1,0,  0,0,1,  1,1,0,  1,0,1,  0,1,1,  1,1,0,  1,0,1
    ]),
    indices: new Uint16Array([
      4, 5, 6,   4, 6, 7,   // front
      1, 0, 3,   1, 3, 2,   // back
      3, 7, 6,   3, 6, 2,   // top
      0, 1, 5,   0, 5, 4,   // bottom
      1, 2, 6,   1, 6, 5,   // right
      0, 4, 7,   0, 7, 3    // left
    ])
  };
}

// --- cylinder --------------------------------------------------------
// Side wall: a ring of quads, each split into two triangles.
// Caps: a triangle fan from a center vertex out to the rim.

function makeCylinder(radius = 1.0, height = 2.0, segments = 32) {
  const m = emptyMesh();
  const half = height / 2;

  // side wall - store the top/bottom index pair for each ring step
  const ring = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const c = hsv2rgb(i / segments, 0.9, 1.0);
    ring.push([
      addVertex(m, x,  half, z, c),
      addVertex(m, x, -half, z, c)
    ]);
  }
  for (let i = 0; i < segments; i++) {
    const [t0, b0] = ring[i];
    const [t1, b1] = ring[i + 1];
    m.idx.push(t0, b0, b1,   t0, b1, t1);
  }

  // top cap (counter-clockwise seen from +y)
  const topC = addVertex(m, 0, half, 0, [1.0, 1.0, 1.0]);
  const topRim = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    topRim.push(addVertex(m, Math.cos(a) * radius, half, Math.sin(a) * radius,
                          hsv2rgb(i / segments, 0.4, 1.0)));
  }
  for (let i = 0; i < segments; i++) m.idx.push(topC, topRim[i], topRim[i + 1]);

  // bottom cap (reverse winding so it faces -y)
  const botC = addVertex(m, 0, -half, 0, [0.25, 0.25, 0.30]);
  const botRim = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    botRim.push(addVertex(m, Math.cos(a) * radius, -half, Math.sin(a) * radius,
                          hsv2rgb(i / segments, 0.4, 0.55)));
  }
  for (let i = 0; i < segments; i++) m.idx.push(botC, botRim[i + 1], botRim[i]);

  return finishMesh(m);
}

// --- cone ------------------------------------------------------------
// Same idea as the cylinder, but the top ring collapses to a single apex.
// The apex is duplicated per segment so each side face gets its own color.

function makeCone(radius = 1.0, height = 2.0, segments = 32) {
  const m = emptyMesh();
  const half = height / 2;

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c = hsv2rgb(i / segments, 0.9, 1.0);
    const apex = addVertex(m, 0, half, 0, [1.0, 1.0, 1.0]);
    const p0 = addVertex(m, Math.cos(a0) * radius, -half, Math.sin(a0) * radius, c);
    const p1 = addVertex(m, Math.cos(a1) * radius, -half, Math.sin(a1) * radius, c);
    m.idx.push(apex, p0, p1);
  }

  const baseC = addVertex(m, 0, -half, 0, [0.25, 0.25, 0.30]);
  const rim = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    rim.push(addVertex(m, Math.cos(a) * radius, -half, Math.sin(a) * radius,
                       hsv2rgb(i / segments, 0.4, 0.55)));
  }
  for (let i = 0; i < segments; i++) m.idx.push(baseC, rim[i + 1], rim[i]);

  return finishMesh(m);
}

// --- sphere ----------------------------------------------------------
// Latitude/longitude grid. phi walks from the north pole (0) to the
// south pole (PI); theta walks around the equator.
//   x = r sin(phi) cos(theta)
//   y = r cos(phi)
//   z = r sin(phi) sin(theta)

function makeSphere(radius = 1.0, slices = 32, stacks = 20) {
  const m = emptyMesh();

  for (let st = 0; st <= stacks; st++) {
    const phi = (st / stacks) * Math.PI;
    for (let sl = 0; sl <= slices; sl++) {
      const th = (sl / slices) * Math.PI * 2;
      addVertex(m,
        radius * Math.sin(phi) * Math.cos(th),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(th),
        hsv2rgb(sl / slices, 0.85, 0.45 + 0.55 * Math.sin(phi)));
    }
  }

  const rowLen = slices + 1;   // one extra column closes the seam
  for (let st = 0; st < stacks; st++) {
    for (let sl = 0; sl < slices; sl++) {
      const a = st * rowLen + sl;
      const b = a + rowLen;
      m.idx.push(a, b, a + 1,   b, b + 1, a + 1);
    }
  }

  return finishMesh(m);
}

// --- torus -----------------------------------------------------------
// u walks around the big ring, v walks around the tube cross-section.
//   x = (R + r cos v) cos u
//   y =  r sin v
//   z = (R + r cos v) sin u

function makeTorus(R = 1.0, r = 0.30, tubular = 36, radial = 18) {
  const m = emptyMesh();

  for (let i = 0; i <= tubular; i++) {
    const u = (i / tubular) * Math.PI * 2;
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      addVertex(m,
        (R + r * Math.cos(v)) * Math.cos(u),
        r * Math.sin(v),
        (R + r * Math.cos(v)) * Math.sin(u),
        hsv2rgb(i / tubular, 0.9, 0.55 + 0.45 * Math.cos(v)));
    }
  }

  const rowLen = radial + 1;
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * rowLen + j;
      const b = a + rowLen;
      m.idx.push(a, b, a + 1,   b, b + 1, a + 1);
    }
  }

  return finishMesh(m);
}
