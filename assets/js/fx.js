/* =========================================================
   TOKANU MODA — efeitos: selo 3D com sacolinhas, logo 3D e Instagram 3D
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Ícone 3D do Instagram inclina com o dedo/mouse ---------- */
  function igTilt() {
    const card = $(".insta__card"), icon = $("#igTilt .ig3d");
    if (!card || !icon || reduce) return;
    card.addEventListener("pointermove", (e) => {
      const r = icon.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      icon.style.transform = `rotateY(${Math.max(-1, Math.min(1, x)) * 22}deg) rotateX(${Math.max(-1, Math.min(1, y)) * -22}deg)`;
    });
    card.addEventListener("pointerleave", () => (icon.style.transform = ""));
  }

  /* ---------- Selo 3D ---------- */
  function seal() {
    const root = $("#seal3d"), coin = $("#coin");
    if (!root || !coin) return;

    // Espessura da moeda: camadas empilhadas atrás da face
    const DEPTH = 22;
    for (let i = 1; i <= DEPTH; i++) {
      const l = document.createElement("div");
      l.className = "seal3d__layer" + (i > 1 && i < DEPTH ? " seal3d__layer--rim" : "");
      l.style.transform = `translateZ(${-i * 1.2}px)`;
      coin.prepend(l);
    }
    const back = $(".seal3d__face", coin).cloneNode();
    back.alt = "";
    back.style.transform = `translateZ(${-(DEPTH + 1) * 1.2}px) rotateY(180deg)`;
    coin.prepend(back);
    const gloss = document.createElement("div");
    gloss.className = "seal3d__face-gloss";
    coin.append(gloss);
    const shadow = $(".seal3d__shadow", root);

    // Sacolinhas de compra
    const imgs = ["sacola-rosa", "sacola-lilas", "sacola-champanhe", "sacola-ameixa", "sacola-blush", "sacola-branca", "sacola-rosa", "sacola-lilas"];
    const layer = $("#minis");
    const minis = imgs.map((name, i) => {
      const el = document.createElement("button");
      el.className = "mini";
      el.type = "button";
      el.tabIndex = -1;
      el.innerHTML = `<img src="assets/hero/${name}.svg" alt="" draggable="false">`;
      layer.append(el);
      return {
        el, base: (i / imgs.length) * Math.PI * 2, size: 0.085 + ((i * 37) % 5) * 0.012,
        x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, phase: i * 1.3, init: false
      };
    });

    // Estado da moeda
    let rx = 8, ry = -14, vrx = 0, vry = 0;
    let dragging = false, lastX = 0, lastY = 0, hover = null, pointer = null;
    let W = root.clientWidth, t0 = performance.now(), running = false, raf = 0;
    const ro = new ResizeObserver(() => (W = root.clientWidth));
    ro.observe(root);

    const local = (e) => { const r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    coin.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; vrx = vry = 0;
      coin.setPointerCapture(e.pointerId);
    });
    coin.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      ry += dx * 0.6; rx -= dy * 0.4;
      vry = dx * 0.6; vrx = -dy * 0.4;
    });
    const endDrag = () => (dragging = false);
    coin.addEventListener("pointerup", endDrag);
    coin.addEventListener("pointercancel", endDrag);

    root.addEventListener("pointermove", (e) => {
      pointer = local(e);
      if (e.pointerType === "mouse") hover = pointer;
    });
    root.addEventListener("pointerdown", (e) => (pointer = local(e)));
    root.addEventListener("pointerleave", () => { hover = null; pointer = null; });
    root.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") setTimeout(() => (pointer = null), 120); });

    // Toque numa sacolinha: pulo, giro e brilhos
    layer.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".mini");
      if (!el) return;
      e.stopPropagation();
      const m = minis.find((k) => k.el === el);
      const cx = W / 2, cy = W / 2;
      const dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy) || 1;
      m.vx += (dx / d) * W * 1.2 + (Math.random() - 0.5) * W * 0.6;
      m.vy += (dy / d) * W * 1.2 - W * 0.9;
      m.vr += (Math.random() > 0.5 ? 1 : -1) * (540 + Math.random() * 360);
      burst(m.x, m.y);
      if (navigator.vibrate && navigator.userActivation?.hasBeenActive) try { navigator.vibrate(12); } catch {}
      if (reduce) place();
    });

    function burst(x, y) {
      for (let i = 0; i < 8; i++) {
        const s = document.createElement("span");
        s.className = "spark";
        const a = (i / 8) * Math.PI * 2;
        s.style.left = x + "px"; s.style.top = y + "px";
        s.style.setProperty("--dx", Math.cos(a) * 36 + "px");
        s.style.setProperty("--dy", Math.sin(a) * 36 + "px");
        if (i % 2) s.style.background = "#fff";
        layer.append(s);
        setTimeout(() => s.remove(), 750);
      }
    }

    function home(m, t) {
      const a = m.base + t * 0.18;
      const R = W * (0.43 + 0.03 * Math.sin(m.phase + t * 0.5));
      return {
        x: W / 2 + Math.cos(a) * R,
        y: W / 2 + Math.sin(a) * R * 0.62 + Math.sin(t * 1.4 + m.phase) * W * 0.02,
        front: Math.sin(a) > -0.15
      };
    }

    function place(t = 0) {
      minis.forEach((m) => {
        const h = home(m, t);
        if (!m.init) { m.x = h.x; m.y = h.y; m.init = true; }
        render(m, h.front);
      });
    }
    function render(m, front) {
      const s = m.size * W;
      m.el.style.width = s + "px";
      m.el.style.zIndex = front ? 3 : 0;
      const sc = front ? 1 : 0.82;
      m.el.style.transform = `translate(${m.x - s / 2}px, ${m.y - s * 0.65}px) rotate(${m.rot}deg) scale(${sc})`;
      m.el.style.opacity = front ? 1 : 0.8;
    }

    let last = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;

      // Moeda: segue o mouse, ou balança suave quando parada (sem girar sozinha)
      if (!dragging) {
        let tx = 10 + Math.sin(t * 0.8) * 7, ty = Math.sin(t * 0.5) * 26;
        if (hover) { tx = (0.5 - hover.y / W) * 34; ty = (hover.x / W - 0.5) * 44; }
        vry *= 0.94; vrx *= 0.94;
        ry += vry; rx += vrx;
        // volta para a face da frente pelo caminho mais curto
        const k = Math.round((ry - ty) / 360) * 360;
        ry = lerp(ry, ty + k, Math.abs(vry) > 0.6 ? 0.01 : 0.06);
        rx = lerp(rx, tx, 0.06);
        if (Math.abs(vry) < 0.6 && Math.abs(ry - (ty + k)) < 0.5) ry -= k;
      }
      coin.style.setProperty("--rx", rx.toFixed(2) + "deg");
      coin.style.setProperty("--ry", ry.toFixed(2) + "deg");
      gloss.style.setProperty("--gx", 50 - (((ry % 360) + 540) % 360 - 180) * 0.8 + "%");
      gloss.style.setProperty("--gy", 40 + rx * 1.2 + "%");
      shadow.style.transform = `translateX(${Math.sin((ry * Math.PI) / 180) * -12}px) scaleX(${0.75 + 0.25 * Math.abs(Math.cos((ry * Math.PI) / 180))})`;

      // Sacolinhas: mola até a órbita + fogem do dedo/mouse
      minis.forEach((m) => {
        const h = home(m, t);
        m.vx += (h.x - m.x) * 9 * dt;
        m.vy += (h.y - m.y) * 9 * dt;
        if (pointer) {
          const dx = m.x - pointer.x, dy = m.y - pointer.y, d = Math.hypot(dx, dy);
          const R = W * 0.2;
          if (d < R && d > 0.1) {
            const f = (1 - d / R) * W * 9 * dt;
            m.vx += (dx / d) * f * 10; m.vy += (dy / d) * f * 10;
          }
        }
        const damp = Math.pow(0.08, dt);
        m.vx *= damp; m.vy *= damp;
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.x = Math.max(-W * 0.04, Math.min(W * 1.04, m.x));
        m.y = Math.max(-W * 0.04, Math.min(W * 1.04, m.y));
        m.vr *= Math.pow(0.25, dt);
        const idle = Math.sin(t * 1.6 + m.phase) * 8;
        m.rot = (m.rot + m.vr * dt);
        if (Math.abs(m.vr) < 20) m.rot = lerp(m.rot, Math.round(m.rot / 360) * 360 + idle, 0.08);
        render(m, h.front);
      });
    }

    function start() { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    place();
    if (reduce) return;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: "100px" }).observe(root);
    } else start();
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : null));
  }

  /* ---------- Botão flutuante do Instagram ---------- */
  function igFab() {
    const fab = $("#igFab"), wa = $("#waFab"), bar = $("#floatbar");
    if (!fab) return;
    const sync = () => {
      fab.classList.toggle("is-top", wa.classList.contains("is-top"));
      fab.classList.toggle("is-lifted", bar.classList.contains("is-visible"));
    };
    new MutationObserver(sync).observe(wa, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  /* ---------- Logo da Tokanu em 3D (notebook e celular do topo) ---------- */
  function logo3d() {
    document.querySelectorAll("[data-logo3d]").forEach((box) => {
      const DEPTH = 10;
      for (let i = 1; i <= DEPTH; i++) {
        const l = document.createElement("span");
        l.className = "logo3d__layer";
        l.style.transform = `translateZ(${-i * 1.6}px)`;
        box.prepend(l);
      }
      const glow = document.createElement("span");
      glow.className = "logo3d__glow";
      box.prepend(glow);
    });
  }

  function init() { logo3d(); igTilt(); seal(); igFab(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
