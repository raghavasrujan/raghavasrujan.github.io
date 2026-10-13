/**
 * Drawer: a tray of eight audit documents on a loop. A robot sweeps along the row,
 * pulling each document out to check it against the audit sample; the ones that
 * support it stay up and take the accent, then everything resets and it starts again.
 * The read-out follows the loop ("searching", then "found · ..."); hover a document
 * and it shows that document's name. Hover picks static bands on the ground plane.
 */
const {
  Cam, fit, proj, facing, unproj, rings, prism, solid, put, poly, seg, fillet, clamp, lerp, bezier,
  reducedMotion, disposer, mk, place, pointer, register,
} = HL;

const NAMES = ["Invoice 1", "Invoice 2", "PO 1", "PO 2", "GRN 1", "Contract", "Bank statement", "Delivery note"], MATCH = [1, 2];
const XD = NAMES.map((_, i) => 8 + 13 * i), SL = 600, SEARCH = 8 * SL, FOUND = 2200, BACK = 1000, CYC = SEARCH + FOUND + BACK;
const RY = 0, RZ = 8, K = 1.5, LIFT = 5, E = bezier(0.32, 0.72, 0, 1);
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

function mount({ stage, svg, read }) {
  const bag = disposer();
  let t0 = 0, hov = -1, lastCap = "";
  const C = Cam(45, 0.5, 3.2);
  fit(C, [[-4, 6, 0], [112, 6, 0], [-4, -6, 0], [112, -6, 0], [99, 0, 40], [8, 0, 40], [8, 19, 0], [112, 19, 0]], 200, 166);
  const P = proj(C), fr = facing(C), V = [P(0, 0, 1)[0] - P(0, 0, 0)[0], P(0, 0, 1)[1] - P(0, 0, 0)[1]];

  // the robot stands on a ledge behind the row, facing the viewer; the tray and documents are drawn over it
  box(svg, P, fr, -6, -5, 114, 5, 0, RZ, 1.5, 0.8);
  const bot = robot(svg, P, fr, 0, RY, RZ);
  // the tray, and the documents standing in it, far end first: a tab, a body, a few lines
  box(svg, P, fr, -4, 6, 112, 19, 0, 3, 1.5, 0.8);
  const docs = XD.map((x, i) => {
    const g = mk("g", {}, svg), tx = x + [-2, 0, 2][i % 3];
    box(g, P, fr, tx - 1.7, 12, tx + 1.7, 14.4, 18.5, 21, 1, 0.4);
    const s = box(g, P, fr, x - 4.2, 12, x + 4.2, 14.4, 3, 19, 1.2, 0.5);
    mk("path", { d: [8, 11, 14].map((z, k) => seg(P(x - 2.6, 14.4, z), P(x + 2.6 - k * 1.2, 14.4, z))).join(""), class: "nf lo" }, g);
    return { g, s, h: NaN };
  });
  const arm = bot.g.lastChild; svg.appendChild(arm);

  const B = register(stage, (_dt, now) => {
    if (!t0) t0 = now;
    const rm = reducedMotion(), t = rm ? SEARCH + 1000 : (now - t0) % CYC, lh = XD.map(() => 0);
    let rx = XD[0], e = 0, cap = "searching", on = false, cur = 0;
    if (t < SEARCH) {
      const i = Math.floor(t / SL), l = t - i * SL, hit = MATCH.includes(i);
      rx = lerp(XD[Math.max(i - 1, 0)], XD[i], E(clamp(l / 250, 0, 1))); cur = i;
      MATCH.forEach((j) => { if (j < i) lh[j] = LIFT; });
      lh[i] = hit ? LIFT * E(clamp((l - 200) / 300, 0, 1)) : LIFT * Math.sin(Math.PI * clamp((l - 200) / 400, 0, 1));
      e = Math.min(1, Math.sin(Math.PI * clamp((l - 100) / 500, 0, 1)) * 1.5); on = hit && l > 350;
    } else if (t < SEARCH + FOUND) {
      rx = XD[7]; MATCH.forEach((j) => { lh[j] = LIFT; }); e = -1; on = true;
      cap = "found · " + MATCH.map((j) => NAMES[j]).join(" · ");
    } else {
      const u = E((t - SEARCH - FOUND) / BACK);
      rx = lerp(XD[7], XD[0], u); MATCH.forEach((j) => { lh[j] = LIFT * (1 - E(clamp(u * 1.5, 0, 1))); });
    }
    docs.forEach((d, j) => {
      if (d.h !== lh[j]) { d.h = lh[j]; d.g.setAttribute("transform", `translate(${(V[0] * lh[j]).toFixed(2)} ${(V[1] * lh[j]).toFixed(2)})`); }
      d.s.sil.classList.toggle("hi", MATCH.includes(j) && lh[j] > 2.4);
    });
    const q = P(rx - 3.2 * K, RY, RZ), tr = `translate(${q[0].toFixed(2)} ${q[1].toFixed(2)}) scale(${K}) translate(${-bot.o[0].toFixed(2)} ${-bot.o[1].toFixed(2)})`;
    bot.g.setAttribute("transform", tr); arm.setAttribute("transform", tr);
    bot.reach((e < 0 ? [5, 0, 9] : [0, lerp(3, 14.4 - RY, e), lerp(-6, 21.5 + lh[cur] - RZ - 8 * K, e)]).map((v) => v / K)); bot.hi(on);
    if (hov >= 0) cap = NAMES[hov];
    if (cap !== lastCap) { lastCap = cap; read.textContent = cap; }
    return !rm;
  });
  bag.add(B.unregister);

  /** -1 none, 0-7 a document: static bands on the ground plane, whatever its lift. */
  function pick(pt) {
    const [x, y] = unproj(C, pt[0], pt[1], 11), k = XD.findIndex((d) => Math.abs(x - d) < 6.5);
    const h = y > 8 && y < 17 ? k : -1;
    if (h !== hov) { hov = h; B.wake(); }
  }
  bag.add(pointer(stage, { move: pick, leave: () => pick([-999, -999]) }));
  bag.add(() => svg.replaceChildren());
  return { set: () => {}, destroy: bag.dispose };
}

hairline({
  name: "drawer",
  means: "A robot pulls audit documents from a tray one by one; the ones that support the sample stay out, marked.",
  rules: [1, 4, 5, 6, 7],
  range: [0, 0.5, 1],
  mount,
});
