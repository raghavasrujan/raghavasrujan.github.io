/**
 * Reviewloop: an auto-playing loop. Parcels ride the main belt; the classifier tags each one, the
 * reviewer inspects it at the scan gate and passes it to the approved pile. Every so often one
 * is flagged (accent): a diverter rod pushes it onto the return belt behind the line, the classifier
 * re-labels it, and it passes on its second trip. Both workers stand behind the belt and face it.
 * Nothing needs the pointer. The slider is how long a parcel waits at the gate, in ms.
 */
const {
  Cam, fit, proj, facing, rings, prism, solid, put, poly, seg, fillet, clamp, lerp, bezier,
  reducedMotion, disposer, mk, place, pointer, register,
} = HL;

const Z = 4, GX = 76, DX = 92, TX = 32, V = 0.03, CYC = 17500, E = bezier(0.32, 0.72, 0, 1);
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
// a parcel's trip: a polyline walked at speed V, with stops [waypoint, dwell ms (0 = the gate hold), kind]; K are [time, distance] keys
function plan(pts, stops, H) {
  const c = [0], K = [[0, 0]], ev = [];
  let t = 0;
  for (let i = 1; i < pts.length; i++) {
    c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    K.push([(t += (c[i] - c[i - 1]) / V), c[i]]);
    const s = stops.find((q) => q[0] === i);
    if (s) { const d = s[1] || H; ev.push({ a: t, b: t + d, kind: s[2] }); K.push([(t += d), c[i]]); }
  }
  return {
    ev, end: t,
    at(u) {
      let i = 1;
      while (i < K.length - 1 && K[i][0] < u) i++;
      const d = lerp(K[i - 1][1], K[i][1], clamp((u - K[i - 1][0]) / (K[i][0] - K[i - 1][0] || 1), 0, 1));
      let j = 1;
      while (j < c.length - 1 && c[j] < d) j++;
      const f = (d - c[j - 1]) / (c[j] - c[j - 1] || 1);
      return [lerp(pts[j - 1][0], pts[j][0], f), lerp(pts[j - 1][1], pts[j][1], f)];
    },
  };
}
const MAIN = [[16, 26], [TX, 26], [GX, 26], [108, 26]];
// parcel 4 is flagged at the gate, pushed onto the return belt, re-labelled at the classifier, and passes the gate again
const LOOP = [[16, 26], [TX, 26], [GX, 26], [DX, 26], [DX, 4], [14, 4], [14, 26], [TX, 26], [GX, 26], [108, 26]];
const PARCELS = [{ id: 3, off: 0 }, { id: 4, off: 2200, flag: 1 }, { id: 5, off: 4400 }, { id: 6, off: 6600 }];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let H = value, t0 = 0, lastCap = "in review", plans = [];
  const C = Cam(45, 0.5, 3);
  fit(C, [[4, -2, 0], [122, -2, 0], [4, 42, 0], [122, 42, 0], [GX, 39, 22], [14, 39, 22], [TX, 14, 22], [GX - 20, 14, 22], [14, 4, 8]], 200, 166);
  const P = proj(C), fr = facing(C);
  const flat = (x, y, z, pts) => poly(pts.map(([u, v]) => P(x + u, y + v, z)));
  const TAG = fillet([[-1, -0.8], [1, -0.8], [1, 0.8], [-1, 0.8]], [0.5, 0.5, 0.5, 0.5], 2);
  const build = () => { plans = PARCELS.map((p) => plan(p.flag ? LOOP : MAIN, p.flag ? [[1, 500, "tag"], [2, 0, "gate"], [3, 500, "push"], [7, 900, "tag2"], [8, 0, "gate2"]] : [[1, 500, "tag"], [2, 0, "gate"]], H)); };
  build();

  // far to near: return belt and its links, parcels on the return side, both workers (behind the belt, facing it), then the main belt and pallet
  const back = mk("g", {}, svg);
  box(back, P, fr, 8, 0, 98, 8, 0, Z, 1.5, 0.8);
  box(back, P, fr, 10, 8, 18, 20, 0, Z, 1, 0.6);
  box(back, P, fr, DX - 4, 8, DX + 4, 20, 0, Z, 1, 0.6);
  const pb = mk("g", {}, svg), cls = robot(svg, P, fr, TX, 14, 0, 2), rev = robot(svg, P, fr, GX - 20, 14, 0, 2);
  box(svg, P, fr, 8, 19.5, 100, 32.5, 0, Z, 1.5, 0.8);
  box(svg, P, fr, 102, 19, 118, 33, 0, Z, 1.5, 0.8);
  box(svg, P, fr, 8, 36, 12, 40, 0, 4, 1, 0.5);
  box(svg, P, fr, GX - 1, 17, GX + 1, 19, 0, 12, 0.8, 0.4);
  const pf = mk("g", {}, svg), fx = mk("g", {}, svg), light = mk("path", { class: "nf" }, fx);
  box(fx, P, fr, GX - 1, 33, GX + 1, 35, 0, 12, 0.8, 0.4);
  box(fx, P, fr, GX - 1, 17, GX + 1, 35, 12, 14, 1, 0.5);
  box(fx, P, fr, DX - 3, 35, DX + 3, 39, 0, 7, 1, 0.5);
  const rod = solid(fx);

  const mkParcel = (g) => ({ s: solid(g), tag: mk("path", { class: "lo" }, g), t2: mk("path", { class: "nf lo" }, g) });
  const paint = (p, x, y, z, tg, re) => {
    const [r, c] = rings(x - 1.7, y - 1.7, x + 1.7, y + 1.7, 1, 0.45), key = x.toFixed(1) + y.toFixed(1) + z;
    if (p.key !== key) { p.key = key; put(p.s, prism(P, fr, r, c, z, z + 3.4)); setD(p.tag, flat(x, y, z + 3.5, TAG)); }
    setD(p.t2, re ? seg(P(x - 0.5, y, z + 3.6), P(x + 0.5, y, z + 3.6)) : "");
    p.tag.setAttribute("display", tg ? "inline" : "none");
  };
  for (let k = 0; k < 2; k++) paint(mkParcel(pf), 112, 26, Z + k * 3.6, 1, 0);
  const ps = PARCELS.map(() => mkParcel(pf)), lay = { pb: { g: pb, key: "" }, pf: { g: pf, key: "" } };

  const reg = register(stage, (_dt, now) => {
    if (!t0) t0 = now;
    const rm = reducedMotion(), tt = rm ? 5100 : (now - t0) % CYC;
    let cw = 0, rw = 0, cap = "", sw = -1, tip = 33;
    const seen = { pb: [], pf: [] };
    PARCELS.forEach((q, i) => {
      const pl = plans[i], p = ps[i], t = tt - q.off, els = [p.s.g, p.tag, p.t2];
      if (t < 0 || t >= pl.end) { els.forEach((e) => { e.setAttribute("display", "none"); }); return; }
      els.forEach((e) => { e.setAttribute("display", "inline"); });
      const [x, y] = pl.at(t), tag = pl.ev[0], tag2 = pl.ev.find((e) => e.kind === "tag2"), gate = pl.ev[1];
      pl.ev.forEach((e) => {
        if (t < e.a || t > e.b) return;
        const u = (t - e.a) / (e.b - e.a), w = Math.min(1, Math.sin(Math.PI * u) * 2.2);
        if (e.kind === "tag" || e.kind === "tag2") { cw = Math.max(cw, w); cap = cap ? cap : e.kind === "tag" ? "parcel " + q.id + " · classify" : "refining"; }
        else if (e.kind === "push") { cap = "parcel " + q.id + " · flagged · refine"; tip = lerp(33, 28.4, E(clamp((t - e.a) / 250, 0, 1))); }
        else { rw = Math.max(rw, w); sw = u; cap = e.kind === "gate2" ? "refined · pass" : "parcel " + q.id + (q.flag ? " · flagged · refine" : " · pass"); }
      });
      if (q.flag && t > pl.ev[2].b && t < pl.ev[2].b + 600) tip = lerp(28.4, 33, E((t - pl.ev[2].b) / 600));
      paint(p, x, y, Z, t > tag.a + 250, q.flag && t > tag2.a + 450);
      p.s.sil.classList.toggle("hi", !!q.flag && t > gate.a && t < pl.ev[4].b);
      seen[y < 12 ? "pb" : "pf"].push({ k: x + y, p });
    });
    for (const n in seen) {
      const key = seen[n].sort((a, b) => a.k - b.k).map((o) => ps.indexOf(o.p)).join();
      if (key !== lay[n].key) { lay[n].key = key; seen[n].forEach((o) => [o.p.s.g, o.p.tag, o.p.t2].forEach((e) => lay[n].g.append(e))); }
    }
    setD(light, sw >= 0 ? seg(P(GX, 21, lerp(11, Z + 0.5, sw)), P(GX, 31, lerp(11, Z + 0.5, sw))) : "");
    if (rod._tip !== tip) { rod._tip = tip; const [r, c] = rings(DX - 0.7, tip, DX + 0.7, 35, 0.5, 0.2); put(rod, prism(P, fr, r, c, 4.6, 6.6)); }
    rev.reach([lerp(0, 16.8, rw), lerp(1.5, 12, rw), lerp(-4, -0.6, rw)]);
    cls.reach([lerp(0, -3.2, cw), lerp(1.5, 12, cw), lerp(-4, -0.6, cw)]);
    rev.hi(rw > 0.05); cls.hi(cw > 0.05);
    if (cap && cap !== lastCap) { lastCap = cap; read.textContent = cap; }
    return !rm;
  });
  bag.add(reg.unregister);
  bag.add(pointer(stage, { move: () => {}, leave: () => {} })); // the loop needs no pointer; the validator wants the handler
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { H = v; build(); }, destroy: bag.dispose };
}

hairline({
  name: "reviewloop",
  means: "Parcels ride a belt past a reviewer; a flagged one is pushed onto a return belt, re-labelled, and passes on its second trip.",
  rules: [4, 5, 6, 7, 8],
  range: [200, 600, 1400],
  mount,
});
