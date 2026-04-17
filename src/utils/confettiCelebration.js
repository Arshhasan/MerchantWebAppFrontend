/**
 * One-shot confetti burst (no external deps). Full-screen canvas, removed when done.
 * @returns {function} Teardown — call on unmount or to cancel early
 */
export function runConfettiCelebration() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:9999',
  ].join(';');

  const colors = [
    '#03c55b', '#16a34a', '#22c55e', '#4ade80',
    '#fbbf24', '#f472b6', '#38bdf8', '#a78bfa',
  ];

  let width = window.innerWidth;
  let height = window.innerHeight;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  };
  resize();
  document.body.appendChild(canvas);
  window.addEventListener('resize', resize);

  const ctx = canvas.getContext('2d');
  const n = 130;
  const particles = [];
  const originX = width * 0.5;
  const originY = height * 0.18;

  for (let i = 0; i < n; i += 1) {
    const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.8;
    const sp = 5 + Math.random() * 10;
    particles.push({
      x: originX + (Math.random() - 0.5) * 60,
      y: originY + Math.random() * 30,
      vx: Math.cos(a) * sp * (0.35 + Math.random() * 0.65),
      vy: Math.sin(a) * sp * 0.45 - 3 - Math.random() * 5,
      w: 4 + Math.random() * 5,
      h: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  const maxFrames = 170;
  let frame = 0;
  let raf = 0;
  let removed = false;

  const teardown = () => {
    if (removed) return;
    removed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };

  const step = () => {
    frame += 1;
    ctx.clearRect(0, 0, width, height);

    const fade = Math.min(1, frame / maxFrames);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.vx *= 0.997;
      p.rot += p.vr;

      const alpha = Math.max(0, 1 - fade * 1.05);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    if (frame < maxFrames) {
      raf = requestAnimationFrame(step);
    } else {
      teardown();
    }
  };

  raf = requestAnimationFrame(step);

  return teardown;
}
