/**
 * Agentline: an isometric audit floor on a loop. A document sheet rides a belt through
 * five stations on its own; at each one the robot plays its action (classify, extract,
 * map, vouch, report) and an orchestrator robot points at it. The read-out follows.
 * Hover a station to hold the line on it. The slider is the time at each station, in ms.
 */
const {
  Cam, fit, proj, facing, unproj, rings, prism, solid, put, poly, open, seg, fillet, clamp, lerp, bezier,
  spring, stepS, reducedMotion, disposer, mk, place, pointer, register,
} = HL;

const XS = [12, 36, 60, 84, 108], WY = 16, BY = 26, BZ = 4, OX = 60, OY = -14, E = bezier(0.32, 0.72, 0, 1);
const NAMES = ["classify · bin · built by me", "extract · fields", "map · tag · built by me", "vouch · stamp", "report · cells"];
const POSE = [[0, 7, -1], [0, 4, 0.5], [0, 6, 2], null, [0, 7, 2]];

/** A rounded box from two rings: silhouette plus one crease. */
const box = (g, P, fr, x0, y0, x1, y1, z0, z1, r = 1, b = 0.7) => {
  const [a, c] = rings(x0, y0, x1, y1, r, b), s = solid(g);
  put(s, prism(P, fr, a, c, z0, z1));
  return s;
};
/** The shared robot (isometric): legs, torso with a chest screen, cube head with visor, eyes, antenna and one box arm on its right. face is where it looks: 0 +x, 1 -x, 2 +y, 3 -y. Camera: the visible vertical faces are +x and +y, so a robot facing -x or -y shows its back (a plain panel, no eyes). */
function robot(g, P, fr, x, y, z = 0, face = 2) {
  const w = mk("g", {}, g), b = (a, c, d, e, z0, z1, r, k) => box(w, P, fr, x + a, y + c, x + d, y + e, z + z0, z + z1, r, k);
  const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][face], t = [n[1], -n[0]], seen = n[0] + n[1] > 0, o = seen ? 1 : -1;
  // F(h, r, hf)(s, v): a point on the vertical face h out from the centre, s to the robot's right, v up; a rounded corner of radius r pulls the surface in
  const F = (h, r, hf) => (s, v) => { const d = Math.max(0, Math.abs(s) - (hf - r)), q = h - (r - Math.sqrt(Math.max(0, r * r - d * d))); return P(x + o * n[0] * q + t[0] * s, y + o * n[1] * q + t[1] * s, z + v); };
  const dense = (pts) => pts.flatMap((p, i) => { const q = pts[(i + 1) % pts.length]; return [0, 1, 2, 3, 4, 5].map((j) => [p[0] + ((q[0] - p[0]) * j) / 6, p[1] + ((q[1] - p[1]) * j) / 6]); });
  const rr = (W, u0, v0, u1, v1, r, cls) => mk("path", { d: poly(dense(fillet([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [r, r, r, r], 3)).map(([u, v]) => W(u, v))), class: cls }, w);
  const ln = (W, s0, s1, v) => [0, 1, 2, 3].map((j) => seg(W(s0 + ((s1 - s0) * j) / 4, v), W(s0 + ((s1 - s0) * (j + 1)) / 4, v))).join("");
  b(-2.4, -1, -0.6, 1, 0, 3.2, 0.8, 0.35); b(0.6, -1, 2.4, 1, 0, 3.2, 0.8, 0.35);
  const body = b(-3.2, -3.2, 3.2, 3.2, 3, 10, 1.5, 0.6), T = F(3.2, 1.5, 3.2), H = F(2.6, 1.8, 2.6);
  const head = b(-2.6, -2.6, 2.6, 2.6, 10, 15.4, 1.8, 0.6);
  if (seen) { // the face is toward the viewer: chest screen, visor and eyes, centred on that one face
    rr(T, -1.9, 4.8, 1.9, 8.2, 0.6, "lo");
    mk("path", { d: ln(T, -1, 1, 7.2) + ln(T, -1, 0.2, 5.8), class: "nf lo" }, w);
    rr(H, -2, 11.1, 2, 14.3, 0.8, "lo"); rr(H, -1.4, 11.9, -0.4, 13.5, 0.45, "dot m"); rr(H, 0.4, 11.9, 1.4, 13.5, 0.45, "dot m");
  } else mk("path", { d: ln(T, -1.5, 1.5, 7) + ln(T, -1.5, 1.5, 5.4), class: "nf lo" }, w); // facing away: only a back panel line
  mk("path", { d: seg(P(x, y, z + 15.4), P(x, y, z + 19)), class: "nf lo" }, w);
  const dot = mk("circle", { r: 1.1, class: "dot off" }, w), arm = mk("path", { class: "sil" }, w);
  place(dot, P(x, y, z + 19.6));
  const sh = [x + t[0] * 3.2, y + t[1] * 3.2, z + 8];
  return {
    g: w, o: P(x, y, z),
    hi: (on) => { [head.sil, body.sil, arm].forEach((e) => e.classList.toggle("hi", on)); dot.classList.toggle("off", !on); },
    reach(d) {
      const h = [sh[0] + d[0], sh[1] + d[1], sh[2] + d[2]], a = P(...sh), c = P(...h), n = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      const u = [(-(c[1] - a[1]) * 1.7) / n, ((c[0] - a[0]) * 1.7) / n], q = (p, k) => [p[0] + k * u[0], p[1] + k * u[1]];
      arm.setAttribute("d", poly(fillet([q(a, 1), q(c, 1), q(c, -1), q(a, -1)], [0.8, 0.8, 0.8, 0.8], 3)));
      return h;
    },
  };
}
const setD = (el, d) => { if (el._d !== d) { el._d = d; el.setAttribute("d", d); } };
/** Where the loop is at time t: k the station (5 the sheet leaving, 6 a pause), tr its walk-in, p its work, q the exit. */
function phase(t, step) {
  const k = Math.floor(t / step), l = t - k * step;
  if (k < 5) return { k, tr: clamp(l / (0.3 * step), 0, 1), p: clamp((l - 0.3 * step) / (0.7 * step), 0, 1), q: 0 };
  const q = (t - 5 * step) / (0.8 * step);
  return { k: q < 1 ? 5 : 6, tr: 1, p: 1, q: clamp(q, 0, 1) };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let step = value, pin = -1, t0 = 0, pt = 0, bin = 0, lastCap = "";
  const C = Cam(45, 0.5, 2.85);
  fit(C, [[-4, -22, 0], [134, -22, 0], [-4, 40, 0], [134, 40, 0], [60, -14, 25], [12, 3, 25]], 200, 166);
  const P = proj(C), fr = facing(C);
  /** A plate standing in an x-z plane at y. */
  const vp = (x0, x1, z0, z1, y, r = 1.2) => poly(fillet([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [r, r, r, r], 3).map(([x, z]) => P(x, y, z)));
  const flat = (xc, yc, zc, pts) => poly(pts.map(([u, v]) => P(xc + u, yc + v, zc)));
  const SH = fillet([[-3.5, -3], [3.5, -3], [3.5, 3], [-3.5, 3]], [1, 1, 1, 1], 3);

  // back layer: hand-off line, platform and orchestrator, pin-board and spreadsheet panel
  const back = mk("g", {}, svg), dash = mk("path", { class: "nf dash" }, back);
  box(back, P, fr, 52, -21, 68, -7, 0, 4, 2, 0.8);
  const orch = robot(back, P, fr, OX, OY, BZ);
  mk("path", { d: vp(100.5, 115.5, 8.5, 18.5, 3), class: "sil" }, back);
  mk("path", { d: seg(P(105.5, 3, 8.5), P(105.5, 3, 18.5)) + seg(P(110.5, 3, 8.5), P(110.5, 3, 18.5)) + seg(P(100.5, 3, 11.83), P(115.5, 3, 11.83)) + seg(P(100.5, 3, 15.17), P(115.5, 3, 15.17)), class: "nf lo" }, back);
  mk("path", { d: vp(52, 68, 8, 20, 3), class: "sil" }, back);
  mk("path", { d: vp(62, 66, 13, 16, 3, 0.8), class: "lo" }, back);
  const cellEls = [];
  for (let k = 0; k < 9; k++) { const c = mk("circle", { r: 0.9, class: "dot off" }, back); place(c, P(103 + (k % 3) * 5, 3, 10.17 + Math.floor(k / 3) * 3.33)); cellEls.push(c); }

  const work = mk("g", {}, svg), ws = XS.map((x) => robot(work, P, fr, x, WY));
  const front = mk("g", {}, svg);
  box(front, P, fr, -2, 22, 134, 30, 0, BZ, 1.5, 0.8);
  for (let k = 0; k < 3; k++) box(front, P, fr, XS[0] - 8 + k * 8 - 3, 33, XS[0] - 8 + k * 8 + 3, 38, 0, 3, 1, 0.6);
  mk("path", { d: flat(124.4, 26, BZ + 0.3, SH), class: "sil" }, front);
  mk("path", { d: flat(123.8, 26.4, BZ + 0.9, SH), class: "sil" }, front);
  const sheet = mk("path", { class: "sil" }, front), check = mk("path", { class: "nf sil" }, front), light = mk("path", { class: "nf" }, front);
  mk("path", { d: vp(41, 46, 5.5, 10.5, 20.5, 0.8), class: "sil" }, front);
  const lines = mk("path", { class: "nf lo" }, front), thread = mk("path", { class: "nf lo" }, front);
  const [sr, si] = rings(82, 24, 86, 28, 1.2, 0.5), stamp = solid(front);

  const sx = spring(0), sy = spring(0), sz = spring(-4);
  const cap = (a) => (a < 0 ? "next document" : String(a + 1).padStart(2, "0") + " · " + NAMES[a]);

  const B = register(stage, (dt, now) => {
    if (!t0) t0 = now;
    const rm = reducedMotion(), cyc = step * 6.1, n = Math.floor((now - t0) / cyc);
    const s = rm ? { k: 1, tr: 1, p: 0.85, q: 0 } : pin >= 0 ? { k: pin, tr: 1, p: clamp(((now - pt) % (1.5 * step)) / step, 0, 1), q: 0 } : phase((now - t0) % cyc, step);
    const { k, tr, p, q } = s, act = k < 5 ? k : k === 5 ? 4 : -1, bn = pin >= 0 ? bin : n % 3;
    const U = [0, 1, 2, 3, 4].map((i) => (k === 6 ? 0 : k === i ? p : k > i ? 1 : 0));
    // the sheet: walks in to each station, hops into a bin at 0, lands on the stack after 4
    const b = Math.sin(Math.PI * clamp((U[0] - 0.5) * 2, 0, 1)) * (k === 0 ? 1 : 0), e = E(q);
    const xc = (k < 5 ? lerp(k ? XS[k - 1] : -6, XS[k], E(tr)) : lerp(XS[4], 124.4, e)) + (bn - 1) * 8 * b, yc = BY + 9.5 * b, zc = BZ + 0.2 - 0.9 * b + 1.1 * e;
    setD(sheet, k === 6 ? "" : flat(xc, yc, zc, SH));
    setD(check, U[3] > 0.5 && k < 6 ? open([[-2, -0.5], [-0.8, 1.4], [2.2, -1.8]].map(([a, c]) => P(xc + a, yc + c, zc + 0.1))) : "");
    const lx = xc - 3.5 + 7 * U[0] * 2;
    setD(light, U[0] > 0 && U[0] < 0.5 ? seg(P(lx, 23.5, BZ + 0.4), P(lx, 28.5, BZ + 0.4)) : "");
    setD(lines, [0, 1, 2, 3].filter((j) => j < Math.floor(U[1] * 5)).map((j) => seg(P(40.4, 20.5, 9.3 - j), P(40.4 + 3.4 - (j % 2) * 1.2, 20.5, 9.3 - j))).join(""));
    const tag = P(64, 3.2, 14.5), tp = clamp(U[2] * 1.4, 0, 1), a0 = P(60, BY, BZ + 0.4);
    setD(thread, tp > 0 ? seg(a0, [lerp(a0[0], tag[0], tp), lerp(a0[1], tag[1], tp)]) : "");
    cellEls.forEach((el, j) => { const on = j < Math.floor(U[4] * 10); el.classList.toggle("off", !on); el.classList.toggle("m", on); });
    const pp = U[3] < 0.5 ? clamp((U[3] - 0.15) / 0.25, 0, 1) : 1 - clamp((U[3] - 0.5) / 0.25, 0, 1), zs = BZ + 0.4 + (1 - pp) * 7;
    if (stamp._z !== zs) { stamp._z = zs; put(stamp, prism(P, fr, sr, si, zs, zs + 5)); }
    ws.forEach((w, i) => {
      const E2 = i === act ? Math.min(1, Math.sin(Math.PI * p) * 2.2) : 0, pose = i === 3 ? [-1, 8, zs + 3 - 8] : POSE[i];
      w.reach(pose.map((v, j) => lerp([0, 1.5, -4][j], v, E2)));
      w.hi(i === act);
    });
    // orchestrator: signal arm toward the active robot, dashed hand-off to its head
    const dx = act >= 0 ? XS[act] - OX : 0, dy = act >= 0 ? WY - OY : 0, nn = Math.hypot(dx, dy) || 1;
    sx.t = (dx / nn) * 8; sy.t = (dy / nn) * 8; sz.t = act >= 0 ? 1 : -4;
    let mv = false;
    for (const sp of [sx, sy, sz]) mv = stepS(sp, dt) || mv;
    const h = orch.reach([sx.x, sy.x, sz.x]);
    setD(dash, act >= 0 ? seg(P(...h), P(XS[act], WY, 12.5)) : "");
    orch.hi(act < 0);
    const c = cap(act);
    if (c !== lastCap) { lastCap = c; read.textContent = c; }
    return !rm || mv;
  });
  bag.add(B.unregister);

  /** -1 none, 0-4 a station: static columns on the ground plane. */
  function hit(pt) {
    const [x, y] = unproj(C, pt[0], pt[1], 8);
    return y < 2 || y > 42 || x < 0 || x > 120 ? -1 : clamp(Math.round((x - 12) / 24), 0, 4);
  }
  function setPin(m) {
    if (m === pin) return;
    if (m >= 0) { pt = performance.now(); bin = (bin + 1) % 3; }
    pin = m;
    B.wake();
  }
  bag.add(pointer(stage, { move: (p) => setPin(hit(p)), leave: () => setPin(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { step = v; }, destroy: bag.dispose };
}

hairline({
  name: "agentline",
  means: "A sheet rides a belt through five agent stations on its own; an orchestrator points at whichever one is working.",
  rules: [4, 5, 6, 7, 8],
  range: [600, 1300, 2000],
  mount,
});
