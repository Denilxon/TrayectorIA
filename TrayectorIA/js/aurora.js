
/* TrayectorIA - Aurora azul estilo Gemini (v6) */
(() => {
  const canvas = document.getElementById('trayectoria-aurora');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  // =====================================================
  // CONFIGURACIÓN GENERAL
  // =====================================================

  const spacing = 15;

  // Velocidad de oscilación de las ondas
  const waveSpeed = 10.0;

  // Transparencia de los puntos
  const opacityFactor = 0.7;

  // Intensidad del resplandor azul
  const glowOpacity = 0.32;

  // Intensidad de las pulsaciones luminosas
  const lightIntensity = 0.35;

  let w = 0;
  let h = 0;
  let dpr = 1;

  let targetScroll = 0;
  let scroll = 0;

  let animationId = null;
  let previousFrame = 0;

  // =====================================================
  // ZONAS DE OSCILACIÓN INDEPENDIENTES
  // =====================================================

  const zones = [
    { phase: 0.2, speed: 0.23, amplitude: 66 },
    { phase: 2.3, speed: 0.17, amplitude: 83 },
    { phase: 4.6, speed: 0.27, amplitude: 72 },
    { phase: 1.5, speed: 0.19, amplitude: 92 },
    { phase: 3.8, speed: 0.24, amplitude: 76 },
    { phase: 5.1, speed: 0.16, amplitude: 84 },
    { phase: 2.8, speed: 0.21, amplitude: 69 }
  ];

  // =====================================================
  // SCROLL
  // =====================================================

  function readScroll() {
    const max = Math.max(
      0,
      document.documentElement.scrollHeight - innerHeight
    );

    targetScroll = max
      ? Math.min(1, Math.max(0, scrollY / max))
      : 0;

    if (reducedMotion.matches) {
      scroll = targetScroll;
      render(0);
    }
  }

  // =====================================================
  // TAMAÑO DEL CANVAS
  // =====================================================

  function resize() {
    w = innerWidth;
    h = innerHeight;

    dpr = Math.min(devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    readScroll();
    render(0);
  }

  // =====================================================
  // OSCILACIÓN DE LAS ONDAS
  // =====================================================

  function zoneHeight(i, t) {
    const z = zones[i];
    const time = t * waveSpeed;

    return z.amplitude * (
      0.72 * Math.sin(time * z.speed + z.phase) +
      0.28 * Math.sin(
        time * (z.speed * 0.57) + z.phase * 2.13
      )
    );
  }

  function upperEdge(x, t, base) {
    const position =
      (x / Math.max(w, 1)) * (zones.length - 1);

    const left = Math.min(
      zones.length - 2,
      Math.floor(position)
    );

    const fraction = Math.max(
      0,
      Math.min(1, position - left)
    );

    const blend =
      fraction * fraction * (3 - 2 * fraction);

    return base +
      zoneHeight(left, t) * (1 - blend) +
      zoneHeight(left + 1, t) * blend;
  }

  // =====================================================
  // INTERPOLACIÓN DE COLORES
  // =====================================================

  function mix(a, b, amount) {
    return a + (b - a) * amount;
  }

  // =====================================================
  // PULSACIONES LUMINOSAS
  // =====================================================

  function pulse(x, y, t, index) {
    const settings = [
      { x: 0.22, y: 0.76, phase: 0.0, speed: 0.38 },
      { x: 0.53, y: 0.89, phase: 2.1, speed: 0.29 },
      { x: 0.81, y: 0.69, phase: 4.3, speed: 0.34 }
    ];

    const p = settings[index];

    const centerX =
      w * p.x +
      Math.sin(t * 0.13 + p.phase) * w * 0.055;

    const centerY =
      h * p.y +
      Math.cos(t * 0.11 + p.phase) * h * 0.035;

    const expansion =
      0.5 + 0.5 * Math.sin(t * p.speed + p.phase);

    const radiusX = w * (0.08 + expansion * 0.19);
    const radiusY = h * (0.10 + expansion * 0.20);

    const dx = (x - centerX) / radiusX;
    const dy = (y - centerY) / radiusY;

    const distance = dx * dx + dy * dy;

    return Math.exp(-distance * 2.0) * expansion;
  }

  // =====================================================
  // RENDERIZADO
  // =====================================================

  function render(t) {
    ctx.clearRect(0, 0, w, h);

    // Posición de la onda según el scroll
    const base = h * (0.60 - 0.20 * scroll);

    // =================================================
    // RESPLANDOR AZUL DIFUMINADO
    // =================================================

    // Centro ligeramente inferior al medio de la pantalla
    const glowX = w * 0.50;
    const glowY = h * 0.4;

    // Resplandor elíptico para parecerse al fondo
    // de Gemini, sin un borde circular marcado
    ctx.save();

    ctx.translate(glowX, glowY);
    ctx.scale(1, 0.70);

    const radius = Math.max(w * 0.55, h * 0.65);

    const glow = ctx.createRadialGradient(
      0, 0, 0,
      0, 0, radius
    );

    glow.addColorStop(
      0,
      `rgba(35, 67, 165, ${glowOpacity})`
    );

    glow.addColorStop(
      0.35,
      `rgba(24, 48, 135, ${glowOpacity * 0.75})`
    );

    glow.addColorStop(
      0.65,
      `rgba(15, 29, 85, ${glowOpacity * 0.35})`
    );

    glow.addColorStop(
      1,
      'rgba(10, 18, 48, 0)'
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
      -radius,
      -radius,
      radius * 2,
      radius * 2
    );

    ctx.restore();

    // =================================================
    // PUNTOS DE LA AURORA
    // =================================================

    const columns = Math.ceil(w / spacing);
    const rows = Math.ceil(h / spacing);

    for (let col = 0; col <= columns; col++) {
      const x = col * spacing + 3;

      const edge = upperEdge(x, t, base);

      const firstRow = Math.max(
        0,
        Math.floor(edge / spacing)
      );

      for (let row = firstRow; row <= rows; row++) {
        const y = row * spacing + 3;
        const depth = y - edge;

        if (depth < 0 || y > h) continue;

        // Tamaño progresivo de los puntos
        const progress = Math.min(
          1,
          depth / Math.max(h * 0.50, 1)
        );

        const eased =
          progress * progress * (3 - 2 * progress);

        const radius = 0.65 + 5.0 * eased;

        // Opacidad reducida
        let alpha =
          (0.22 + 0.53 * eased) * opacityFactor;

        // Pulsaciones de color
        const illumination = Math.min(
          1,
          pulse(x, y, t, 0) +
          pulse(x, y, t, 1) +
          pulse(x, y, t, 2)
        ) * lightIntensity;

        // Azul principal
        const original = {
          r: 65,
          g: 95,
          b: 205
        };

        // Azul iluminado
        const illuminated = {
          r: 125,
          g: 155,
          b: 255
        };

        const r = Math.round(
          mix(original.r, illuminated.r, illumination)
        );

        const g = Math.round(
          mix(original.g, illuminated.g, illumination)
        );

        const b = Math.round(
          mix(original.b, illuminated.b, illumination)
        );

        alpha = Math.min(
          0.85,
          alpha * (1 + illumination * 0.22)
        );

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          `rgba(${r}, ${g}, ${b}, ${alpha})`;

        ctx.fill();
      }
    }
  }

  // =====================================================
  // ANIMACIÓN
  // =====================================================

  function tick(timestamp) {
    animationId = requestAnimationFrame(tick);

    // Aproximadamente 30 FPS
    if (timestamp - previousFrame < 32) return;

    previousFrame = timestamp;

    scroll += (targetScroll - scroll) * 0.08;

    render(timestamp / 1000);
  }

  // =====================================================
  // MOVIMIENTO REDUCIDO
  // =====================================================

  function motionChanged() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }

    animationId = null;
    scroll = targetScroll;

    render(0);

    if (!reducedMotion.matches) {
      animationId = requestAnimationFrame(tick);
    }
  }

  // =====================================================
  // EVENTOS
  // =====================================================

  addEventListener('scroll', readScroll, {
    passive: true
  });

  addEventListener('resize', resize);

  reducedMotion.addEventListener(
    'change',
    motionChanged
  );

  resize();
  motionChanged();
})();
