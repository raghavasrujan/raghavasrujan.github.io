/*
 * The page's own script: it hosts the Hairline figures and drives the header
 * counter and the chapter rail.
 *
 * Figures are the hairline-create skill's format, unchanged: each module ends
 * with hairline({ name, means, rules, range, mount }). This file defines that
 * hairline() before the modules run, and mounts each figure into the card
 * whose data-figure matches its name, the way the skill's bench does: a
 * 400 × 320 svg, a read-out object, and mount() given the middle of range.
 * Load it as a classic script after the kernel and before the figure modules.
 */
(() => {
  "use strict";

  /* ------------------------------------------------------------ figures */

  const cards = new Map();
  for (const card of document.querySelectorAll("[data-figure]")) cards.set(card.dataset.figure, card);
  const mounted = new Map();

  function mountFigure(figure) {
    const card = cards.get(figure && figure.name);
    if (!card || mounted.has(figure.name)) return;
    const stage = card.querySelector(".fig__stage");
    const out = card.querySelector(".fig__read");
    const restLabel = card.dataset.rest || "rest";

    HL.inject(document);
    stage.setAttribute("data-hairline", figure.name);
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", figure.means);
    const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);

    let text = null;
    const read = {
      get textContent() { return text; },
      set textContent(value) {
        text = value == null ? "" : String(value);
        if (out) out.textContent = text === "rest" ? restLabel : text;
      },
    };

    const value = Array.isArray(figure.range) ? figure.range[1] : undefined;
    try {
      const handle = figure.mount({ stage, svg, read }, value);
      if (text === null) read.textContent = "rest";
      mounted.set(figure.name, handle);
      card.classList.add("is-live");
    } catch (error) {
      svg.replaceChildren();
      console.error(`figure "${figure.name}" failed to mount`, error);
    }
  }

  window.hairline = mountFigure;

  /* ------------------------------------------------ counter and rail */

  const chapters = [...document.querySelectorAll(".chapter[id]")];
  const total = String(chapters.length).padStart(2, "0");
  const num = document.querySelector(".counter b");
  const of = document.querySelector(".counter__total");
  const title = document.querySelector(".counter__title");
  const rail = document.querySelector(".rail");
  if (of) of.textContent = total;

  const ticks = [];
  if (rail) {
    chapters.forEach((section, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      const n = String(i + 1).padStart(2, "0");
      a.href = "#" + section.id;
      a.setAttribute("aria-label", `${n} · ${section.dataset.title}`);
      a.title = section.dataset.title;
      li.append(a);
      rail.append(li);
      ticks.push(a);
    });
  }

  let current = -1;
  function setCurrent(i) {
    if (i === current || i < 0) return;
    current = i;
    if (num) num.textContent = String(i + 1).padStart(2, "0");
    if (title) title.textContent = chapters[i].dataset.title;
    ticks.forEach((a, k) => a.setAttribute("aria-current", String(k === i)));
  }

  /* The current chapter is the one under a line 40% down the viewport. */
  function pick() {
    const line = window.innerHeight * 0.4;
    let best = 0;
    for (let i = 0; i < chapters.length; i++) {
      const r = chapters[i].getBoundingClientRect();
      if (r.top <= line) best = i;
      else break;
    }
    setCurrent(best);
  }

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; pick(); });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  pick();
})();
