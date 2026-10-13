/**
 * Turntable: a record player on a rounded plinth, a record of four tracks on
 * its platter. The pointer is put back onto the record's top, which never
 * moves, and its distance from the spindle picks a track; the tonearm swings
 * to it on the 700ms ease, up on its cue for a long swing, and that track's
 * band of grooves takes the bright stroke. At rest the stylus sits in track
 * 1's lead-in. The slider is the platter's speed in rpm, shown by a mark on
 * the label going round.
 *
 * The pattern: one of many, by radius. Tweens for the arm and its cue, a hit
 * test on one fixed plane, and ambient spin that runs only through register().
 */
const {
  Cam, circ, facing, fit, hull, poly, prism, proj, rad, ringAt, rrect, seg, unproj,
  reducedMotion, tdone, tset, tval, tween, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const LX = 146, LY = 118, PH = 12;                                   // the plinth
const CX = 57, CY = 59, RP = 48, RR = 45.5, ZR = PH + 6, RL = 13.5;    // platter, record, label
const PX = 113, PY = 19, LS = 73, ZA = ZR + 6.5, ZC = ZR + 3.2, HOFF = rad(20);  // tonearm pivot, reach, height; cartridge foot
const LIFT = 3;                                                      // how far the cue raises the arm for a long swing
const COUNT = [3, 2, 3, 2], STEP = 1.6, GAP = 5.4;                   // grooves per track, outermost first

/** A ring moved to (x, y), or turned by th about (x, y). */
const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
const turn = (ring, th, x, y) => {
  const c = Math.cos(th), s = Math.sin(th);
  return ring.map((q) => ({ u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};
/** A round solid: footprint radius r at (x, y), crease inset b. */
const disc = (x, y, r, b, n) => [at(circ(r, n), x, y), at(circ(r - b, n), x, y)];

/** The tracks: each a list of groove radii, and the radius its band starts at, going in. */
const TRACKS = [];
{
  let r = RR - 2.6;
  for (const n of COUNT) {
    const g = [];
    for (let k = 0; k < n; k++) g.push(r - k * STEP);
    TRACKS.push({ g, mid: (g[0] + g[n - 1]) / 2, lo: g[n - 1] - GAP / 2 });
    r = g[n - 1] - GAP;
  }
}
/** The track at radius r from the spindle: the band it falls in, a gap going to the nearer band. */
const track = (r) => { const i = TRACKS.findIndex((t) => r >= t.lo); return i < 0 ? TRACKS.length - 1 : i; };

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let rpm = value, spin = 0, drawnTh = NaN, drawnLift = NaN;

  // fitted with the arm up on its cue, its highest pose
  const C = Cam(45, 0.5, 1.72);
  fit(C, [[0, 0, 0], [LX, 0, 0], [0, LY, 0], [LX, LY, 0], [0, 0, PH], [LX, 0, PH], [PX + 6, PY - 14, ZA + 5 + LIFT]], 200, 166);
  const P = proj(C), front = facing(C);

  // the arm's angle about the pivot that puts the stylus at radius r from the spindle
  const DX = CX - PX, DY = CY - PY, D = Math.hypot(DX, DY), PHI = Math.atan2(DY, DX);
  const aim = (r) => PHI - Math.acos((LS * LS + D * D - r * r) / (2 * LS * D));
  const TH = TRACKS.map((t) => aim(t.mid));

  const g = mk("g", {}, svg);
  const [pr, pi] = [rrect(0, 0, LX, LY, 11, 5), rrect(2.2, 2.2, LX - 2.2, LY - 2.2, 8.8, 5)];
  put(solid(g), prism(P, front, pr, pi, 0, PH));
  // a start knob in the front-left corner
  const [kr, ki] = disc(15, LY - 15, 5, 1.2, 32);
  put(solid(g), prism(P, front, kr, ki, PH, PH + 3));

  // the platter, its top edge the record's edge
  const plat = solid(g), rec = at(circ(RR, 128), CX, CY);
  put(plat, { sil: prism(P, front, at(circ(RP, 128), CX, CY), rec, PH, ZR).sil, crease: poly(ringAt(P, rec, ZR)) });
  const bands = TRACKS.map((t) => t.g.map((r) => mk("path", { d: poly(ringAt(P, at(circ(r, 96), CX, CY), ZR)), class: "nf" }, g)));
  mk("path", { d: poly(ringAt(P, at(circ(RL, 64), CX, CY), ZR)), class: "nf" }, g);
  const mark = flatDot(g, C, 0.85, "dot m");
  const [sr, si] = disc(CX, CY, 1.5, 0.5, 16);
  put(solid(g), prism(P, front, sr, si, ZR, ZR + 2.4));

  // the arm rest, beside the pivot, where the arm would lie when nothing plays
  const pa = TH[0] - rad(24), [rr, ri] = disc(PX + 0.58 * LS * Math.cos(pa), PY + 0.58 * LS * Math.sin(pa), 2.2, 0.7, 20);
  put(solid(g), prism(P, front, rr, ri, PH, ZA - 2));

  // the tonearm, back to front: counterweight, pivot, tube, stylus, cartridge, headshell
  const cw = solid(g), stub = solid(g);
  const [br, bi] = disc(PX, PY, 8.5, 1.6, 40), [cr, ci] = disc(PX, PY, 4, 1, 28);
  put(solid(g), prism(P, front, br, bi, PH, PH + 2.5));
  const post = solid(g), tube = solid(g), stylus = mk("path", { class: "nf" }, g), cart = solid(g), head = solid(g);

  /** A cylinder lying along direction d from a0 to a1 (distances from the pivot), radius R, its axis at height z.
   *  Its crease is the near cap inset by a unit, so it sits inside the silhouette, never on it. */
  function lying(d, a0, a1, R, z) {
    const ux = Math.cos(d), uy = Math.sin(d);
    const cap = (a, rr = R) => {
      const p = [];
      for (let k = 0; k < 24; k++) { const f = (k / 24) * 2 * Math.PI; p.push(P(PX + a * ux - uy * rr * Math.cos(f), PY + a * uy + ux * rr * Math.cos(f), z + rr * Math.sin(f))); }
      return p;
    };
    const nearA = front({ u: 0, v: 0, nu: ux, nv: uy }) ? a1 : a0;
    return { sil: poly(hull(cap(a0).concat(cap(a1)))), crease: poly(cap(nearA, R - 1)) };
  }

  /** The arm at angle th, raised by `lift` on the cue: the post's bearing rises with it, so the arm stays seated. */
  function drawArm(th, lift) {
    const sx = PX + LS * Math.cos(th), sy = PY + LS * Math.sin(th), hd = th + HOFF, za = ZA + lift, zc = ZC + lift;
    const bx = sx - 8.5 * Math.cos(hd), by = sy - 8.5 * Math.sin(hd);
    const ta = Math.atan2(by - PY, bx - PX), tl = Math.hypot(bx - PX, by - PY);
    const bar = (u0, u1, w, b) => [turn(rrect(u0, -w, u1, w, w, 3), ta, PX, PY), turn(rrect(u0 + b, -w + b, u1 - b, w - b, w - b, 3), ta, PX, PY)];
    const [s0, s1] = bar(-7.5, -3, 1.4, 0.55), [t0, t1] = bar(4, tl + 0.5, 1.4, 0.55);
    put(stub, prism(P, front, s0, s1, za - 1.4, za + 1.4));
    put(cw, lying(ta + Math.PI, 7.5, 16, 4.8, za));
    put(post, prism(P, front, cr, ci, PH + 2.5, za + 1.8));
    put(tube, prism(P, front, t0, t1, za - 1.4, za + 1.4));
    const shell = (u0, v0, u1, v1, r, b) => [turn(rrect(u0, v0, u1, v1, r, 3), hd, sx, sy), turn(rrect(u0 + b, v0 + b, u1 - b, v1 - b, r - b, 3), hd, sx, sy)];
    // the stylus hangs under the cartridge's nose, at (sx, sy); the cartridge, painted after it, hides its top
    const [c0, c1] = shell(-6.5, -1.9, 0.4, 1.9, 1, 0.5), [h0, h1] = shell(-9, -3.6, 2.6, 3.6, 1.7, 0.8);
    stylus.setAttribute("d", seg(P(sx, sy, zc), P(sx, sy, ZR + lift)));
    put(cart, prism(P, front, c0, c1, zc, za - 0.6));
    put(head, prism(P, front, h0, h1, za - 0.6, za + 0.6));
    light(track(Math.hypot(sx - CX, sy - CY)));
  }

  // the bright band is the one under the stylus, so it travels with the arm
  let lit = -1;
  function light(i) {
    if (i === lit) return;
    lit = i;
    bands.forEach((b, k) => b.forEach((el) => el.classList.toggle("hi", k === i)));
  }

  const drawMark = () => place(mark, P(CX + 9 * Math.cos(spin), CY + 9 * Math.sin(spin), ZR));

  // at rest the stylus sits in track 1's lead-in, just outside its first groove; a long swing goes on the cue
  const REST = aim(RR - 1.3), arm = tween(REST), cue = tween(0);
  let goal = REST, cued = false;
  drawMark();
  const B = register(stage, (dt, now) => {
    const th = tval(arm, now);
    if (cued && Math.abs(th - goal) < rad(1.5)) { cued = false; tset(cue, 0, now, 0); }
    const lift = tval(cue, now);
    if (th !== drawnTh || lift !== drawnLift) { drawnTh = th; drawnLift = lift; drawArm(th, lift); }
    let moving = !tdone(arm, now) || !tdone(cue, now);
    if (rpm > 0 && !reducedMotion()) { spin += (dt * rpm * 2 * Math.PI) / 60; drawMark(); moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The track under the pointer, by its distance from the spindle on the record's top, which never moves; -1 off
   *  the record. The label counts as the innermost track, so a sweep inward never throws its choice away. */
  function hit([x, y]) {
    const [u, v] = unproj(C, x, y, ZR), r = Math.hypot(u - CX, v - CY);
    return r > RR + 3 ? -1 : track(r);
  }

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    goal = a < 0 ? REST : TH[a];
    if (Math.abs(goal - tval(arm, now)) > rad(6)) { cued = true; tset(cue, LIFT, now, 0); }
    tset(arm, goal, now, 0);
    read.textContent = a < 0 ? "rest" : "track " + (a + 1);
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { rpm = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "turntable",
  means: "A record of four tracks: the pointer picks one by its distance from the spindle, and the tonearm swings over to play it.",
  rules: [1, 5, 7, 8],
  range: [0, 33, 45],
  mount,
});
