/**
 * Dominoes: a post office, on a loop. A postman robot walks door to door knocking and
 * every door is empty; the read-out counts the checks. Then it sits at a desk while
 * letters slide down a mail chute into the inbox and it picks each one up; the arriving
 * letter takes the accent. Then it walks back and the loop repeats. Nothing needs the pointer.
 */
const {
  Cam, fit, proj, facing, rings, prism, solid, put, poly, seg, fillet, clamp, lerp, bezier,
  reducedMotion, disposer, mk, place, pointer, register,
} = HL;

const XS = [10, 32, 54, 76], SEQ = [0, 1, 2, 3, 2, 1], PER = 1000, GAP = 1800, WALK = 1100, ROW = 7, DESK = [104, 27], SLOPE = -7 / 11;
const POLL = 6 * PER, LIS = 3 * GAP, CYC = POLL + LIS + 2 * WALK, E = bezier(0.32, 0.72, 0, 1);
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

function mount({ stage, svg, read }) {
  const bag = disposer();
  let t0 = 0, lastCap = "";
  const C = Cam(45, 0.5, 3.4);
  fit(C, [[-4, -4, 0], [114, -4, 0], [-4, 32, 0], [114, 32, 0], [104, 27, 22], [10, 7, 22]], 200, 166);
  const P = proj(C), fr = facing(C);
  const vp = (x0, x1, z0, z1, y, r = 1.2) => poly(fillet([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [r, r, r, r], 3).map(([x, z]) => P(x, y, z)));
  const flat = (x, y, z, sl, k = 1) => poly([[-2, -1.8], [2, -1.8], [2, 1.8], [-2, 1.8]].map(([u, v]) => P(x + u, y + v * k, z + v * sl)));

  // the wall of doors, the slot of the mail chute and its rails, the desk with its inbox tray
  box(svg, P, fr, 0, -2, 114, 2, 0, 18, 1.5, 0.8);
  for (const x of XS) {
    mk("path", { d: vp(x - 4, x + 4, 0, 12, 2.2, 1.5), class: "sil" }, svg);
    const k = mk("circle", { r: 0.8, class: "dot off" }, svg);
    place(k, P(x + 2.5, 2.2, 6));
  }
  const slot = mk("path", { d: vp(99, 109, 12.5, 16, 2.2, 0.8), class: "sil" }, svg);
  mk("path", { d: seg(P(100, 2, 14.5), P(100, 13, 7.5)) + seg(P(108, 2, 14.5), P(108, 13, 7.5)), class: "nf lo" }, svg);
  box(svg, P, fr, 96, 8, 114, 22, 0, 6, 1.5, 0.8);
  box(svg, P, fr, 99, 12.5, 109, 17.5, 6, 7.2, 0.8, 0.4);
  const pile = [0, 1, 2].map((k) => mk("path", { class: "sil" }, svg)), doc = mk("path", { class: "sil" }, svg);
  const w = robot(svg, P, fr, 0, 0, 0, 3);

  const reg = register(stage, (_dt, now) => {
    if (!t0) t0 = now;
    const rm = reducedMotion(), t = rm ? POLL + WALK + 1300 : (now - t0) % CYC, T1 = POLL + WALK, T2 = T1 + LIS;
    let x = XS[0], y = ROW, arm = [0, -1.5, -4], on = false, listen = false, cap = "", lt = -1, lift = 0;
    if (t < POLL) {
      const i = Math.floor(t / PER), f = t / PER - i, prev = XS[SEQ[Math.max(i - 1, 0)]], knock = Math.abs(Math.sin(clamp((f - 0.6) / 0.4, 0, 1) * Math.PI * 2));
      x = f < 0.6 ? lerp(prev, XS[SEQ[i]], E(f / 0.6)) : XS[SEQ[i]];
      arm = f < 0.6 ? [0, -2, -4] : [0, -4 - 2 * knock, -2]; on = f >= 0.6;
      cap = `polling · ${i + (f > 0.7 ? 1 : 0)} checks · 0 new`;
    } else if (t < T1) {
      const u = E((t - POLL) / WALK);
      x = lerp(XS[SEQ[5]], DESK[0], u); y = lerp(ROW, DESK[1], u); cap = "polling · 6 checks · 0 new";
    } else if (t < T2) {
      listen = true; lt = t - T1; x = DESK[0]; y = DESK[1];
    } else {
      const u = E((t - T2) / WALK);
      x = lerp(DESK[0], XS[0], u); y = lerp(DESK[1], ROW, u); cap = "polling · 0 checks · 0 new";
    }
    let arrived = 0, picked = 0, a = 0, pb = 0, show = false;
    if (listen) {
      const n = Math.floor(lt / GAP), loc = lt - n * GAP;
      a = E(clamp(loc / 900, 0, 1)); pb = E(clamp((loc - 1000) / 700, 0, 1));
      show = loc < 1700; arrived = n + (loc >= 900 ? 1 : 0); picked = n + (show ? 0 : 1); lift = Math.sin(Math.PI * clamp((loc - 900) / 800, 0, 1));
      arm = [0, -3 - 6 * lift, -1 + 2 * lift]; on = lift > 0.05; cap = `listening · ${arrived} arrived`;
    } else if (t >= T2) picked = 3;
    const q = P(x, y, 0);
    w.g.setAttribute("transform", `translate(${(q[0] - w.o[0]).toFixed(2)} ${(q[1] - w.o[1]).toFixed(2)})`);
    w.reach(arm); w.hi(on);
    // the arriving letter: down the chute, flat on the tray, then lifted away by the robot
    setD(doc, show ? flat(104, lerp(2, 13, a) + 9 * pb, lerp(14.5, 7.5, a) + 0.3 + 5 * pb, SLOPE * (1 - clamp((a - 0.8) / 0.2, 0, 1))) : "");
    doc.classList.toggle("hi", show);
    slot.classList.toggle("hi", listen && !show);
    pile.forEach((p, j) => setD(p, picked > j && t >= T1 ? flat(110.5, 18, 6.2 + j * 0.7, 0) : ""));
    if (cap !== lastCap) { lastCap = cap; read.textContent = cap; }
    return !rm;
  });
  bag.add(reg.unregister);
  bag.add(pointer(stage, { move: () => {}, leave: () => {} })); // the loop needs no pointer; the validator wants the handler
  bag.add(() => svg.replaceChildren());
  return { set: () => {}, destroy: bag.dispose };
}

hairline({
  name: "dominoes",
  means: "A postman robot knocks on empty doors, then sits at a desk while mail slides down a chute and lands in the inbox.",
  rules: [4, 5, 7, 8],
  range: [0, 0.5, 1],
  mount,
});
