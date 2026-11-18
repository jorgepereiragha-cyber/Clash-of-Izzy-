/* Particulas 2D sutis da cidade. Sem novo contexto WebGL ou dependencias externas. */
(() => {
  "use strict";
  const host = document.getElementById("city");
  if (!host || host.querySelector(".coi-ambient-layer")) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = connection?.saveData === true;
  const memory = Number(navigator.deviceMemory || 4);
  if (reduceMotion || saveData || (Number.isFinite(memory) && memory <= 2)) return;

  const mobile = window.matchMedia?.("(max-width: 760px)")?.matches === true;
  const count = mobile ? (memory <= 4 ? 12 : 18) : (memory <= 4 ? 24 : 36);
  const pixelRatioCap = mobile ? 1.25 : 1.5;
  const canvas = document.createElement("canvas");
  canvas.className = "coi-ambient-layer";
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  host.append(canvas);

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    canvas.remove();
    return;
  }

  const particles = [];
  let width = 0, height = 0, frame = 0, lastFrame = 0;
  let visible = true, disposed = false;
  let resizeObserver = null, intersectionObserver = null;

  function resize() {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    if (nextWidth <= 1 || nextHeight <= 1) return;
    width = nextWidth;
    height = nextHeight;
    const dpr = Math.min(pixelRatioCap, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!particles.length) {
      for (let i = 0; i < count; i++) particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: .6 + Math.random() * 1.25,
        speed: .1 + Math.random() * .24,
        alpha: .14 + Math.random() * .28,
        phase: Math.random() * Math.PI * 2,
      });
    } else {
      for (const particle of particles) {
        particle.x = Math.min(width, particle.x);
        particle.y = Math.min(height, particle.y);
      }
    }
  }

  function draw(timestamp) {
    frame = 0;
    if (disposed || !visible || document.hidden || width <= 1 || height <= 1) return;
    const delta = Math.min(2, (timestamp - lastFrame) / 16.67 || 1);
    lastFrame = timestamp;
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.y -= particle.speed * delta;
      particle.x += Math.sin(timestamp * .00035 + particle.phase) * .14 * delta;
      if (particle.y < -4) {
        particle.y = height + 4;
        particle.x = Math.random() * width;
      }
      context.globalAlpha = particle.alpha;
      context.fillStyle = particle.phase % 2 < 1 ? "#f5d995" : "#d9ecff";
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    frame = window.requestAnimationFrame(draw);
  }

  function start() {
    if (disposed || frame || !visible || document.hidden || width <= 1 || height <= 1) return;
    lastFrame = 0;
    frame = window.requestAnimationFrame(draw);
  }
  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }
  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
  }
  function onPageHide(event) {
    if (event.persisted) {
      stop();
      return;
    }
    dispose();
  }
  function onPageShow(event) {
    if (!event.persisted || disposed) return;
    resize();
    start();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("resize", resize);
    canvas.remove();
  }

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }
  if ("IntersectionObserver" in window) {
    intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[entries.length - 1]?.isIntersecting === true;
      if (visible) { resize(); start(); }
      else stop();
    }, { threshold: 0.01 });
    intersectionObserver.observe(host);
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  resize();
  start();
})();
