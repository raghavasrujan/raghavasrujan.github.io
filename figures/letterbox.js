/**
 * Letterbox: a mailbox on a post. The pointer's nearness raises the flag on a
 * spring, the closer the higher, falling off to a floor at the reach; over the
 * box, the door drops open and a letter slides out to lie half in the door.
 * At rest the flag stands half up and bright, and the door is ajar. The
 * read-out names the part under the pointer. The slider is the reach, in
 * viewBox units.
 *
 * The pattern: a continuous answer on a spring with a falloff that reaches a
 * floor, a discrete open on tweens, and a hit test on fixed regions taken
 * from the rest and open poses, so a part moving away cannot flip the choice.
 */
const {
  Cam, clamp, fillet, fit, hull, lerp, open, poly, proj, rad, rings, prism, seg, facing,
  spring, stepS, tween, tset, tval, tdone, disposer, mk, pointer, put, register, solid,
} = HL;

const L = 60, H = 13, WALL = 13, B = 1.6, ZB = 32, T = 1.4, PX = 27; // body length, half width, wall, rim, floor, door, post
const FX = 14, FY = H + 1.6, FZ = ZB + 12, TK = 1.2;                  // the flag's pivot and thickness
const REST = 45, FLOOR = 6, UP = 90, AJAR = 9, SEQ = 240;            // flag angles; the door ajar; door, then letter
const LW = 8.5, LL = 24, LZ = ZB + B + 0.2, IN = L - 46, OUT = L - 5;  // the letter: half width, length, height, poses

/** An arc of ring samples round (cu, cv), radius r, from a0 to a1 degrees. */
const arc = (cu, cv, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => {
  const a = rad(a0 + ((a1 - a0) * k) / n);
  return { u: cu + r * Math.cos(a), v: cv + r * Math.sin(a) };
});
/** The end profile, inset by b: a flat bottom with rounded corners and a round top. u is y, v is height. */
const dRing = (b) => [...arc(H - 3, 3, 3 - b, -90, 0, 4), ...arc(0, WALL, H - b, 0, 180, 18), ...arc(3 - H, 3, 3 - b, 180, 270, 4)];
const OD = dRing(0), ID = dRing(B);
const FS = fillet([[-3, -1.4], [24, -1.4], [24, -8.5], [35, -8.5], [35, 1.4], [-3, 1.4]], [1.4, 1, 1.6, 1.6, 1.6, 1.4]);

/** World points: the end profile at x; the flag at th degrees in the plane y; the door at th, w behind its outer face. */
const endW = (ring, x) => ring.map((q) => [x, q.u, ZB + q.v]);
const flagW = (th, y) => {
  const c = Math.cos(rad(th)), s = Math.sin(rad(th));
  return FS.map(([a, b]) => [FX + a * c - b * s, y, FZ + a * s + b * c]);
};
const doorW = (th, w, ring = OD) => {
  const c = Math.cos(rad(th)), s = Math.sin(rad(th));
  return ring.map((q) => [L + T - w * c + q.v * s, q.u, ZB + w * s + q.v * c]);
};

/** The falloff: 1 at the box, .31 at 42% of the reach, .09 at the reach and beyond. */
const fall = (u) => u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0.094;

const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const area = (q) => q.reduce((s, p, i) => s + cross([0, 0], p, q[(i + 1) % q.length]), 0);
const inside = (p, q) => { const sg = Math.sign(area(q)); return q.every((a, i) => sg * cross(a, q[(i + 1) % q.length], p) >= 0); };
/** How far a screen point is from a convex polygon: 0 inside. */
const dist = (p, q) => inside(p, q) ? 0 : Math.min(...q.map((a, i) => {
  const b = q[(i + 1) % q.length], d = [b[0] - a[0], b[1] - a[1]];
  const t = clamp(((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2 || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t);
}));
/** Sutherland–Hodgman: the part of pts inside the convex polygon win, in pts' order, its first point first when inside. */
function clip(pts, win) {
  const sg = Math.sign(area(win));
  for (let i = 0; i < win.length && pts.length; i++) {
    const a = win[i], b = win[(i + 1) % win.length], f = (p) => sg * cross(a, b, p), out = [];
    pts.forEach((p, j) => {
      const q = pts[(j + 1) % pts.length], fp = f(p), fq = f(q);
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) out.push([p[0] + ((q[0] - p[0]) * fp) / (fp - fq), p[1] + ((q[1] - p[1]) * fp) / (fp - fq)]);
    });
    pts = out;
  }
  return pts;
}
/** The part of the segment pq inside win, as one subpath. */
function clipSeg(p, q, win) {
  const c = clip([p, q], win), d = [q[0] - p[0], q[1] - p[1]], n = d[0] ** 2 + d[1] ** 2 || 1;
  const ts = c.map((r) => ((r[0] - p[0]) * d[0] + (r[1] - p[1]) * d[1]) / n), at = (t) => [p[0] + d[0] * t, p[1] + d[1] * t];
  return ts.length ? seg(at(Math.min(...ts)), at(Math.max(...ts))) : "";
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 3.1);
  const base = [[PX - 12, -12, 0], [PX + 12, 12, 0], [PX + 12, -12, 0], [PX - 12, 12, 0]];
  fit(C, [...endW(OD, 0), ...endW(OD, L), ...doorW(UP, 0), ...flagW(UP, FY), ...base], 200, 166);
  const P = proj(C), front = facing(C), pj = (pts) => pts.map((p) => P(p[0], p[1], p[2]));
  let R = value, ptr = null, isOpen = false, lOut = false;
  const drawn = [NaN, NaN, NaN];

  // Back to front: the base, the post, the body, the letter and the door (which swap), the flag on the near side.
  const g = mk("g", {}, svg);
  const [br, bi] = rings(PX - 12, -12, PX + 12, 12, 3, 1.2), [pr, pi] = rings(PX - 4.5, -4.5, PX + 4.5, 4.5, 2.4, 0.9);
  put(solid(g), prism(P, front, br, bi, 0, 3));
  const post = solid(g);
  put(post, prism(P, front, pr, pi, 3, ZB));
  // The body: a tunnel, the hull of its two end profiles; its crease is the mouth's rim, round the front.
  const body = solid(g), bodyHull = hull(pj(endW(OD, 0)).concat(pj(endW(OD, L)))), win = pj(endW(ID, L));
  put(body, { sil: poly(bodyHull), crease: poly(win) });
  const lg = mk("g", {}, g), lFace = mk("path", { class: "sil" }, lg), lFlap = mk("path", { class: "nf" }, lg);
  // the mouth's sides again, over the letter: what lies behind them shows only through the mouth
  mk("path", { class: "nf lo", d: open(pj(endW(ID.filter((q) => q.v > B + 1), L))) }, lg);
  const dg = mk("g", {}, g), dBack = mk("path", { class: "lo" }, dg), dFace = mk("path", { class: "sil" }, dg);
  const dPull = mk("path", { class: "nf" }, dg);
  const fg = mk("g", {}, g), fBack = mk("path", { class: "lo" }, fg), fFace = mk("path", { class: "sil" }, fg);
  mk("path", { d: poly(pj(arc(0, 0, 1.7, 0, 360, 12).map((q) => [FX + q.u, FY + 0.1, FZ + q.v]))) }, fg);

  function drawFlag(th) {
    fBack.setAttribute("d", poly(pj(flagW(th, FY - TK))));
    fFace.setAttribute("d", poly(pj(flagW(th, FY))));
  }
  // The door turns down about its outer bottom edge; whichever face looks at the camera is drawn last.
  const PULL = fillet([[-3.5, 21.4], [3.5, 21.4], [3.5, 23.6], [-3.5, 23.6]], [1, 1, 1, 1]).map(([u, v]) => ({ u, v }));
  function drawDoor(th) {
    const outer = pj(doorW(th, 0)), inner = pj(doorW(th, T)), outSeen = th < 50.8;
    dBack.setAttribute("d", poly(outSeen ? inner : outer));
    dFace.setAttribute("d", poly(outSeen ? outer : inner));
    dPull.setAttribute("d", outSeen ? poly(pj(doorW(th, -0.2, PULL))) : "");
  }
  // The letter: in front of the mouth's plane it shows whole; behind it, only through the mouth.
  const lp = (p) => P(p[0], p[1], LZ);
  const cnr = (cx, cy, a0) => arc(cx, cy, 1.2, a0, a0 + 90, 3).map((q) => [q.u, q.v]);
  function seen(a, b) {
    if ((a[0] - L) * (b[0] - L) >= 0) return a[0] >= L ? seg(lp(a), lp(b)) : clipSeg(lp(a), lp(b), win);
    const m = [L, a[1] + ((b[1] - a[1]) * (L - a[0])) / (b[0] - a[0])], [o, i] = a[0] > L ? [a, b] : [b, a];
    return seg(lp(o), lp(m)) + clipSeg(lp(m), lp(i), win);
  }
  function drawLetter(v) {
    const xa = lerp(IN, OUT, v), xb = xa + LL, xm = clamp(L, xa + 1.2, xb - 1.2), out = xm === L;
    const fr = [[xm, -LW], ...cnr(xb - 1.2, 1.2 - LW, -90), ...cnr(xb - 1.2, LW - 1.2, 0), [xm, LW]].map(lp);
    const bk = [[xm, LW], ...cnr(xa + 1.2, LW - 1.2, 90), ...cnr(xa + 1.2, 1.2 - LW, 180), [xm, -LW]].map(lp);
    const outline = out ? fr.concat(clip(bk, win)) : clip(fr.concat(bk), win);
    lFace.setAttribute("d", outline.length > 2 ? poly(outline) : "");
    const apex = [xb - LL / 2, 0];
    lFlap.setAttribute("d", seen([xb - 0.5, 0.5 - LW], apex) + seen(apex, [xb - 0.5, LW - 0.5]));
    // once the letter is out over the door it lies on it; back inside, the door closes in front of it
    if (out !== lOut) { lOut = out; if (out) lg.before(dg); else lg.after(dg); }
  }

  // Hit regions from the rest and open poses: they never move, and nothing draws them.
  const regions = [
    ["flag", hull(pj(flagW(REST, FY)).concat(pj(flagW(UP, FY))))],
    ["letter", hull([[OUT, -LW], [OUT + LL, -LW], [OUT + LL, LW], [OUT, LW]].map(lp))],
    ["door", hull(pj(doorW(AJAR, 0)).concat(pj(doorW(UP, 0))))],
  ];
  const zone = hull(regions.flatMap((r) => r[1]).concat(bodyHull));
  const postR = hull(pj([...base, [PX - 4.5, -4.5, ZB], [PX + 4.5, 4.5, ZB], [PX + 4.5, -4.5, ZB], [PX - 4.5, 4.5, ZB]]));
  const parts = [["flag", fFace], ["letter", lFace], ["door", dFace], ["box", body.sil], ["post", post.sil]];

  const fl = spring(REST, { eps: 0.05 }), door = tween(AJAR), lt = tween(0);
  const Bk = register(stage, (dt, now) => {
    const moving = stepS(fl, dt), th = tval(door, now), v = tval(lt, now);
    if (fl.x !== drawn[0]) drawFlag((drawn[0] = fl.x));
    if (th !== drawn[1]) drawDoor((drawn[1] = th));
    if (v !== drawn[2]) drawLetter((drawn[2] = v));
    return moving || !tdone(door, now) || !tdone(lt, now);
  });
  bag.add(Bk.unregister);

  function retarget() {
    const inZ = !!ptr && inside(ptr, zone), now = performance.now();
    const hit = ptr && [...regions, ["box", zone], ["post", postR]].find(([, q]) => inside(ptr, q));
    const name = hit ? hit[0] : "rest";
    fl.t = !ptr ? REST : inZ ? UP : lerp(FLOOR, UP, fall(dist(ptr, zone) / R));
    if (inZ !== isOpen) {
      isOpen = inZ;
      tset(door, inZ ? UP : AJAR, now, inZ ? 0 : SEQ);
      tset(lt, inZ ? 1 : 0, now, inZ ? SEQ : 0);
    }
    for (const [k, el] of parts) el.classList.toggle("hi", k === name || (k === "flag" && name === "rest"));
    read.textContent = name;
    Bk.wake();
  }
  for (const [k, el] of parts) el.classList.toggle("hi", k === "flag");

  bag.add(pointer(stage, {
    move: (p) => { ptr = p; retarget(); },
    leave: () => { ptr = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; if (ptr) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "letterbox",
  means: "A mailbox on a post: its flag rises as the pointer nears, and over the box the door drops open on a letter.",
  rules: [1, 3, 5, 8],
  range: [60, 110, 170],
  mount,
});
