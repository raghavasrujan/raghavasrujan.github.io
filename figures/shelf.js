/**
 * Shelf: a wall shelf on two brackets holding eight books, one per semester,
 * closed by an L-shaped bookend. The book under the pointer tips out toward
 * the viewer on its bottom front edge and lifts a little; its neighbours lean
 * into the gap it leaves, staggered outwards. At rest the last books lean on
 * the bookend and the eighth is drawn forward, bright. The slider is the
 * stagger, in ms.
 *
 * The pattern: discrete items, as Riffle. Tweens, a stagger by distance, a hit
 * test against each book's rest silhouette, and paint order along the row,
 * which stays true because a book only ever tips in its own slot.
 */
const {
  Cam, facing, fillet, fit, hull, open, poly, prism, proj, rad, rings, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// each book: thickness, height, depth, and its spine bands as shares of its height
const BOOKS = [
  [11, 46, 27, [0.82, 0.2]], [13, 53, 30, [0.87, 0.81]], [9, 41, 25, [0.74]], [12, 56, 29, [0.88, 0.16]],
  [10, 48, 27, [0.84, 0.78]], [14, 44, 30, [0.7]], [10, 51, 26, [0.86, 0.2]], [12, 53, 29, [0.85, 0.79, 0.16]],
];
const N = 8, D = 30, GAP = 1.2, PT = 4, FT = 1.6, HB = 30, BT = 1.6, BL = 27, BH = 34;
const TIP = 18, SLIDE = 12, LIFT = 6, LEAN = 8, REST_LEAN = [0, 0, 0, 0, 0, 3, 6, 10], REST_PULL = 0.3;

/** The share of the full lean d books from the one pulled: 1, .55, .3, … down to a floor of .08. */
const fall = (d) => Math.max(0.08, 0.55 ** (d - 1));
/** Book i's lean in degrees (positive leans toward the bookend) and its pull, 0 to 1, when book a is chosen. */
const leanFor = (i, a) => {
  if (a < 0) return REST_LEAN[i];
  if (i === a) return 0;
  const w = fall(Math.abs(i - a));
  return REST_LEAN[i] * (1 - w) + Math.sign(a - i) * LEAN * w;
};
const pullFor = (i, a) => (a < 0 ? (i === N - 1 ? REST_PULL : 0) : i === a ? 1 : 0);

/** The row, made fresh for each mount: each book's x on the shelf, its rings; the eighth stands on the bookend's foot. */
function row() {
  let x = 0;
  return BOOKS.map(([t, h, d, bands], i) => {
    const [ring, inner] = rings(0, D - d, t, D, 3, 1.1), b = { t, h, d, bands, ring, inner, x0: x, z0: i === N - 1 ? FT : 0 };
    x += t + GAP;
    return b;
  });
}
// the bookend stands where the eighth book, leaning at rest, meets its top edge
const XR = BOOKS.reduce((s, [t]) => s + t + GAP, -GAP), XE = XR + (HB - FT) * Math.tan(rad(REST_LEAN[N - 1]));
const X0 = -7, X1 = XE + BT + 7, Y0 = -3, Y1 = D + 5;

/**
 * Book b leaning `lean` degrees on its bottom side edge, then tipped forward by
 * `pull` on its bottom front edge, slid out and lifted: `pt` takes a point in
 * its own frame (u across, v the world y, w up) to the world, and `faces`
 * says whether a ring sample's side turns toward the viewer V.
 */
function pose(b, lean, pull, V) {
  const ph = rad(lean), th = rad(pull * TIP), F = pull * pull * SLIDE, L = pull * pull * LIFT;
  const pv = lean > 0 ? b.t : 0, cp = Math.cos(ph), sp = Math.sin(ph), ct = Math.cos(th), st = Math.sin(th);
  const pt = (u, v, w) => {
    const xr = u - pv, z1 = w * cp - xr * sp, yr = v - D;
    return [b.x0 + pv + xr * cp + w * sp, D + F + yr * ct + z1 * st, b.z0 + L + z1 * ct - yr * st];
  };
  const faces = (q) => {
    const nz = -q.nu * sp;
    return q.nu * cp * V[0] + (q.nv * ct + nz * st) * V[1] + (nz * ct - q.nv * st) * V[2] > 0;
  };
  return { pt, faces };
}

/** Whether screen point p is inside the convex polygon pts. */
function inside(pts, [x, y]) {
  let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
    const c = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    if (c && s && c !== s) return false;
    if (c) s = c;
  }
  return true;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const ROW = row();

  // Fitted to the shelf with every book at rest and every book pulled, so no pose leaves the frame.
  const C = Cam(45, 0.5, 2.2);
  const ext = [[X0, Y0, -PT - BH], [X1, Y0, -PT - BH], [X0, Y1, -PT], [X1, Y1, -PT]];
  ROW.forEach((b, i) => [[leanFor(i, -1), pullFor(i, -1)], [0, 1]].forEach(([l, p]) => {
    const { pt } = pose(b, l, p);
    for (const u of [0, b.t]) for (const v of [D - b.d, D]) ext.push(pt(u, v, 0), pt(u, v, b.h));
  }));
  fit(C, ext, 200, 166);
  const P = proj(C), front = facing(C), O = P(0, 0, 0), ax = [P(1, 0, 0), P(0, 1, 0), P(0, 0, 1)].map((q) => [q[0] - O[0], q[1] - O[1]]);
  // toward the viewer, for the sides of a book that tips: the one direction the camera flattens to a point
  let V = [ax[1][0] * ax[2][1] - ax[2][0] * ax[1][1], ax[2][0] * ax[0][1] - ax[0][0] * ax[2][1], ax[0][0] * ax[1][1] - ax[1][0] * ax[0][1]];
  if (V[2] < 0) V = V.map((c) => -c);

  const g = mk("g", {}, svg);
  /** A plate standing in the y–z plane at x, as its far outline and its near one: the second line is its thickness. */
  const plate = (x, prof, cls) => [x, x + BT].map((px, k) => {
    const pts = prof.map(([y, z]) => P(px, y, z));
    mk("path", { d: poly(pts), class: k ? cls : "lo" }, g);
    return pts;
  })[1];

  // brackets on the wall, then the plank on them
  const arm = fillet([[Y0, -PT], [Y0 + BL, -PT], [Y0 + 3, -PT - BH], [Y0, -PT - BH]], [0.6, 1.6, 2.4, 0.6]);
  const web = fillet([[Y0 + 2.5, -PT - 2.5], [Y0 + BL - 8, -PT - 2.5], [Y0 + 2.5, -PT - BH + 7]], [1.4, 1.4, 1.4]);
  for (const xb of [X0 + 13, X1 - 15]) {
    plate(xb, arm, "sil");
    mk("path", { d: poly(web.map(([y, z]) => P(xb + BT, y, z))), class: "nf lo" }, g);
  }
  const [pr, pi] = rings(X0, Y0, X1, Y1, 3.5, 1.4);
  put(solid(g), prism(P, front, pr, pi, -PT, 0));
  // the bookend's foot, under the eighth book
  const [fr, fi] = rings(ROW[N - 1].x0 + 1.5, D - 25, XE + BT, D + 2.5, 0.8, 0.5);
  put(solid(g), prism(P, front, fr, fi, 0, FT));

  // the books, along the row from the far end: each covers the one before it
  ROW.forEach((b, i) => {
    b.el = solid(g);
    b.band = mk("path", { class: "nf" }, b.el.g);
    b.lean = tween(leanFor(i, -1));
    b.pull = tween(pullFor(i, -1));
    // the hit area: the book's silhouette at rest, which never moves
    const { pt } = pose(b, leanFor(i, -1), pullFor(i, -1), V);
    b.area = hull(b.ring.map((q) => P(...pt(q.u, q.v, 0))).concat(b.ring.map((q) => P(...pt(q.u, q.v, b.h)))));
  });

  // the bookend's upright, nearest of all
  const end = plate(XE, fillet([[D - 25, 0], [D + 2.5, 0], [D + 2.5, HB], [D - 25, HB]], [0.6, 0.6, 5, 5]), "sil");

  function draw(b, lean, pull) {
    const { pt, faces } = pose(b, lean, pull, V), at = (w) => (q) => P(...pt(q.u, q.v, w));
    put(b.el, {
      sil: poly(hull(b.ring.map(at(0)).concat(b.ring.map(at(b.h))))),
      crease: open(run(b.inner, faces).map(at(b.h))),
    });
    const spine = run(b.ring, (q) => q.nv > 0.3 && faces(q));
    b.band.setAttribute("d", b.bands.map((f) => open(spine.map(at(f * b.h)))).join(""));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    ROW.forEach((b) => {
      const l = tval(b.lean, now), p = tval(b.pull, now);
      if (l !== b.dl || p !== b.dp) { b.dl = l; b.dp = p; draw(b, l, p); }
      if (!tdone(b.lean, now) || !tdone(b.pull, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  /** The front-most book whose rest silhouette holds the point, or -1; the bookend, in front of them all, holds none. */
  const hit = (p) => (inside(end, p) ? -1 : ROW.reduce((a, b, i) => (inside(b.area, p) ? i : a), -1));

  let act = null;
  /** Pulls book a (-1 puts them all back); the stagger spreads out from the book pulled, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act ?? N - 1;
    act = a;
    ROW.forEach((b, i) => {
      const delay = Math.abs(i - from) * stag;
      tset(b.lean, leanFor(i, a), now, delay);
      tset(b.pull, pullFor(i, a), now, delay);
      b.el.sil.classList.toggle("hi", i === (a < 0 ? N - 1 : a));
    });
    read.textContent = a < 0 ? "rest" : SUBJECTS[a];
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

const SUBJECTS = ["Programming in C", "Data Structures", "Digital Logic", "DBMS", "Operating Systems", "Computer Networks", "Machine Learning", "Deep Learning"];

hairline({
  name: "shelf",
  means: "Eight books on a shelf, one per semester: the one under the pointer tips out, and its neighbours lean into the gap.",
  rules: [1, 2, 5, 6],
  range: [0, 40, 90],
  mount,
});
