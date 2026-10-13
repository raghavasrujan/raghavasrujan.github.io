/**
 * Binder: a loose stack of fourteen punched pages at one end of a board and an
 * open ring binder at the other. Where the pointer is along the board sets how
 * much of the course is bound: each sheet's progress is the pointer's place
 * less its own index, clamped to 0..1, on its own spring, so the sheet at the
 * frontier hangs mid-air and carries the bright stroke. A sheet lifts off the
 * stack, is carried over the binder and drops down the rings; moving back
 * un-binds them, last in first out. The stagger runs from where the binding
 * stood toward the pointer, since a sheet can only leave the top of a stack.
 * The read-out counts lessons bound, of 28. The slider is the stagger, in ms.
 *
 * Depth: every sheet is a level plate, so of two things that overlap on screen
 * the higher is in front. Sheets are painted in order of height, and the rings
 * are cut into bands at the heights of the sheets threaded on them, each band
 * painted just after the sheet under it.
 */
const {
  Cam, clamp, facing, fillet, fit, lerp, open, poly, prism, proj, rad, rings, rrect, seg, unproj,
  spring, stepS, reducedMotion, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const N = 14, W = 36, L = 50, DZ = 0.75, LIFT = 20, REST = 4.86;
const SX = 18, SY = 25, BX = 68, BY = 25, BZ = 2.6, X0 = 6, X1 = 130;
const KY = [-16, 0, 16], HU = W / 2 - 3.5, RB = 3.8, RT = 18.6;
const OUT = rrect(-W / 2, -L / 2, W / 2, L / 2, 1.6, 3);
const smooth = (t) => t * t * (3 - 2 * t);
/** The stack is untidy: each sheet's own offset and turn, in degrees. */
const jit = (i) => [2.6 * Math.sin(i * 2.3 + 0.4), 2.2 * Math.cos(i * 1.7 + 1.1), 5.5 * Math.sin(i * 3.1 + 2)];

/** Sheet i at progress p: it lifts, is carried until it sits over the rings (h = 1), then drops. */
function at(i, p) {
  const [dx, dy, th] = jit(i), h = smooth(clamp(p / 0.7, 0, 1));
  return {
    x: lerp(SX + dx, BX, h), y: lerp(SY + dy, BY, h), th: lerp(th, 0, h), h,
    z: lerp(0.4 + (N - 1 - i) * DZ, BZ + i * DZ, p) + LIFT * 4 * p * (1 - p),
  };
}
/** A point (u, v) of a sheet in pose q, in world space. */
const onSheet = (q) => {
  const c = Math.cos(rad(q.th)), s = Math.sin(rad(q.th));
  return (u, v) => [q.x + u * c - v * s, q.y + u * s + v * c, q.z];
};
/** A lesson's ruled lines, flush at the punched margin: a short heading, then five rules, as [v, u at the ragged end]. */
const ruled = (i) => [[-L / 2 + 7, W / 2 - 19 - (i % 3) * 3],
  ...[13, 18, 23, 28, 33].map((d, k) => [-L / 2 + d, -W / 2 + 4 + (k === 4 ? 9 : ((i + k) % 3) * 2.5)])];

// A D ring in its own x-z plane: straight down through the holes to below the first sheet, back up to the bar, round over toward the spine.
const RING = fillet([[BX + HU, BZ - 0.3], [BX + HU + 10, RB], [BX + HU + 10, RT], [BX + HU, RT]], [1.5, 2.5, 5, 5], 6);
/** The runs of the ring whose height lies in [z0, z1], each a list of [x, z]. */
function band(z0, z1) {
  const runs = [];
  let run = null;
  RING.forEach((a, k) => {
    const b = RING[(k + 1) % RING.length], dz = b[1] - a[1];
    let t0 = 0, t1 = 1;
    if (dz === 0) { if (a[1] < z0 || a[1] > z1) t1 = -1; }
    else { const ta = (z0 - a[1]) / dz, tb = (z1 - a[1]) / dz; t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.min(1, Math.max(ta, tb)); }
    if (t0 >= t1) { run = null; return; }
    const q = (t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    if (run && t0 === 0) run.push(q(t1)); else runs.push((run = [q(t0), q(t1)]));
    if (t1 < 1) run = null;
  });
  return runs;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value, cur = REST, lit = null, seq = [], clock = 0;
  const bandKey = [], bandD = [];

  // Fitted to the board and to the highest arcs a sheet takes, so no pose leaves the frame.
  const C = Cam(45, 0.5, 1.76), pts = [[-9, -9, -3.5], [158, 59, -3.5], [158, -9, -3.5], [-9, 59, -3.5]];
  for (let p = 0.05; p < 1; p += 0.05) for (const i of [0, N - 1]) {
    const w = onSheet(at(i, p));
    for (const [u, v] of [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L / 2], [-W / 2, L / 2]]) pts.push(w(u, v));
  }
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);
  const slab = (g, x0, y0, x1, y1, r, b, z0, z1) => { const [o, n] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, o, n, z0, z1)); };

  // The board, then the binder from the far side: back cover, ring bar, spine, front cover and its pocket.
  const root = mk("g", {}, svg), base = mk("g", {}, root);
  slab(base, -9, -9, 158, 59, 8, 2.2, -3.5, 0);
  slab(base, 48, -4, 94, 54, 3, 1.4, 0, 2.2);
  slab(base, 87.8, 3, 93.2, 47, 2.6, 0.9, 2.2, RB);
  slab(base, 94.6, -4, 103.4, 54, 2, 0.9, 0, 1.6);
  slab(base, 103.6, -4, 149.6, 54, 3, 1.4, 0, 2.2);
  mk("path", { d: poly(fillet([[108, 50], [145, 50], [145, 24], [108, 33]], [2, 2, 2, 2]).map(([x, y]) => P(x, y, 2.2))), class: "nf lo" }, base);

  const sheets = [], bands = [];
  for (let i = 0; i < N; i++) {
    const g = mk("g", {}, root), t0 = clamp(REST - i, 0, 1);
    const face = mk("path", { class: "sil" }, g), lines = mk("path", { class: "nf lo" }, g);
    const holes = KY.map(() => flatDot(g, C, 1, "dot off"));
    // Progress 0..1 carries a sheet about L units, so the default eps (0.01) would snap half a unit at landing: settle within 0.03 units.
    sheets.push({ i, g, face, lines, holes, sp: spring(t0, { eps: 0.03 / L }), want: t0, due: null, drawn: NaN, q: at(i, t0) });
  }
  for (let k = 0; k <= N; k++) bands.push(mk("path", { class: "nf sil" }, root));

  /** Rewrites a sheet only when its spring has moved. */
  function draw(s) {
    const p = clamp(s.sp.x, 0, 1);
    if (p === s.drawn) return;
    s.drawn = p;
    const q = (s.q = at(s.i, p)), w = onSheet(q), Pw = (u, v) => P(...w(u, v));
    s.face.setAttribute("d", poly(OUT.map((o) => Pw(o.u, o.v))));
    s.lines.setAttribute("d", ruled(s.i).map(([v, u1]) => seg(Pw(W / 2 - 7, v), Pw(u1, v))).join(""));
    s.holes.forEach((el, k) => place(el, Pw(HU, KY[k])));
  }

  /** Cuts the rings at every threaded sheet, then paints sheets and ring bands in order of height. */
  function order() {
    const hs = sheets.filter((s) => s.q.h > 0.999 && s.q.z < RT).map((s) => s.q.z).sort((a, b) => a - b);
    const edges = [-Infinity, ...hs, Infinity];
    bands.forEach((el, k) => {
      const e = k > hs.length ? "" : edges[k] + "," + edges[k + 1];
      if (e === bandKey[k]) return;
      bandKey[k] = e;
      const d = e && band(edges[k], edges[k + 1]).map((run) => KY.map((ky) => open(run.map(([x, z]) => P(x, BY + ky, z)))).join("")).join("");
      if (d !== bandD[k]) { bandD[k] = d; el.setAttribute("d", d); }
    });
    const next = sheets.map((s) => [s.q.z, s.g]).concat(bands.map((el, k) => [edges[Math.min(k, hs.length + 1)] + 0.001, el]))
      .sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    if (next.some((el, k) => el !== seq[k])) { seq = next; root.append(...next); }
  }

  /** A sheet buried inside either pile, neither its top nor its bottom, takes the dim stroke; the lit one the bright. */
  function tone() {
    const on = (s) => s.sp.x > 0.999, off = (s) => s.sp.x < 0.001;
    const tb = sheets.reduce((m, s) => (on(s) ? s.i : m), -1), ts = sheets.reduceRight((m, s) => (off(s) ? s.i : m), N);
    for (const s of sheets) {
      const cls = s === lit ? "sil hi" : (on(s) && s.i > 0 && s.i < tb) || (off(s) && s.i < N - 1 && s.i > ts) ? "lo" : "sil";
      if (cls !== s.cls) { s.cls = cls; s.face.setAttribute("class", cls); }
    }
  }

  // The stagger is timed on the loop's own clock, so a slow frame slows it with the springs.
  const B = register(stage, (dt) => {
    let m = false;
    clock += dt * 1000;
    for (const s of sheets) {
      if (s.due !== null && clock >= s.due) { s.sp.t = s.want; s.due = null; }
      if (s.due !== null) m = true;
      if (stepS(s.sp, dt)) m = true;
      draw(s);
    }
    order();
    tone();
    return m;
  });
  bag.add(B.unregister);

  /** Sets the frontier to fN sheets bound; changes spread out from where the frontier stood. */
  function aim(fN, label) {
    const now = clock, from = clamp(Math.floor(cur), 0, N - 1), step = reducedMotion() ? 0 : stag;
    cur = fN;
    sheets.forEach((s, i) => {
      const t = clamp(fN - i, 0, 1);
      if (t === s.want) return;
      s.want = t;
      const due = now + Math.abs(i - from) * step;
      s.due = s.due === null ? due : Math.min(s.due, due);
    });
    lit = sheets[clamp(Math.floor(fN), 0, N - 1)];
    tone();
    read.textContent = label;
    B.wake();
  }

  lit = sheets[Math.floor(REST)];
  sheets.forEach(draw);
  order();
  tone();
  read.textContent = "rest";

  // The pointer is read on the board's top, which never moves: its x along the board is the frontier.
  const along = (p) => clamp((unproj(C, p[0], p[1], 0)[0] - X0) / (X1 - X0), 0, 1);
  bag.add(pointer(stage, {
    move: (p) => { const f = along(p); aim(f * N, String(Math.round(f * 28)).padStart(2, "0") + " / 28"); },
    leave: () => aim(REST, "rest"),
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "binder",
  means: "Pages lift off a loose stack and bind into a ring binder; where the pointer is along the board sets how much of the course is built.",
  rules: [2, 3, 6, 8],
  range: [30, 40, 60],
  mount,
});
