"use client";

import { useEffect, useRef } from "react";

/**
 * Moneda 3D de MarkovLab (versión "A · Oro y esmalte azul"): canto y aro de oro, cara de
 * esmalte azul y el logo X2 en relieve. Three.js se carga solo en el navegador y después
 * del primer render, para no pesar en la carga inicial de la página.
 *
 * Gira sola; con un puntero fino (mouse) también se puede arrastrar. Si el sistema pide
 * menos movimiento, queda quieta. El render se pausa cuando la moneda sale de la pantalla.
 */

// Perfil del logo X2 en unidades de la cara: dos picos en ±1.3.
const bump = (x: number, mu: number) => Math.exp(-(((x - mu) / 0.45) ** 2) / 2);
const profile = (x: number) => 1.9 * (bump(x, -1.3) + bump(x, 1.3));
// Los nueve estados del logo, a igual longitud de arco sobre la curva.
const STATES = [-2.6, -1.98, -1.42, -0.62, 0, 0.62, 1.42, 1.98, 2.6];

const FACE = { gradient: ["#2f5fb3", "#1b3c7a", "#0f2350"], logo: "#e8b43a", ring: "#d9a22c", node: "#4f95ff" };

/**
 * Dibuja la cara de la moneda en un lienzo de 1024 × 1024. Con `relief` dibuja el mapa de
 * relieve (blanco = alto) en lugar de los colores. `font` es la familia de Young Serif que
 * genera next/font.
 */
function drawFace(relief: boolean, font: string) {
  const size = 1024;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (relief) {
    ctx.fillStyle = "#000";
  } else {
    const gradient = ctx.createRadialGradient(half * 0.8, half * 0.7, 40, half, half, half);
    gradient.addColorStop(0, FACE.gradient[0]);
    gradient.addColorStop(0.6, FACE.gradient[1]);
    gradient.addColorStop(1, FACE.gradient[2]);
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, size, size);

  const fg = relief ? "#fff" : FACE.logo;
  const ring = relief ? "#999" : FACE.ring;

  // Aro interior y anillo de puntos, como en una moneda acuñada.
  ctx.strokeStyle = ring;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(half, half, size * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ring;
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(half + Math.cos(a) * size * 0.47, half + Math.sin(a) * size * 0.47, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Logo X2 centrado: la línea base queda en 0.65 de la altura y el nombre debajo.
  const base = size * 0.65;
  const scale = size * 0.13;
  const toX = (x: number) => half + x * scale;
  const toY = (y: number) => base - 0.05 * size - y * scale;
  ctx.strokeStyle = fg;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.lineWidth = 22;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const x = -2.6 + (5.2 * i) / 200;
    if (i === 0) ctx.moveTo(toX(x), toY(profile(x)));
    else ctx.lineTo(toX(x), toY(profile(x)));
  }
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(toX(-2.9), base);
  ctx.lineTo(toX(2.9), base);
  ctx.stroke();
  STATES.forEach((x, i) => {
    ctx.fillStyle = relief ? "#fff" : i === 0 ? FACE.node : fg;
    ctx.beginPath();
    ctx.arc(toX(x), toY(profile(x)), i === 0 ? 30 : 21, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = fg;
  ctx.font = `64px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText("MarkovLab", half, base + size * 0.13);
  return canvas;
}

export function Coin({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed) return;

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const finePointer = matchMedia("(pointer: fine)").matches;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.8;

      const scene = new THREE.Scene();
      // Entorno de estudio: sin algo que reflejar, el metal se ve gris y apagado.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = environment;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.5, 7.6);
      scene.add(new THREE.HemisphereLight(0xcfdcff, 0x0a0d14, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(4, 6, 5);
      const rim = new THREE.DirectionalLight(0x5a9bfc, 1.4);
      rim.position.set(-5, 2, -4);
      scene.add(key, rim);

      const font = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "Georgia, serif";
      const faceTexture = new THREE.CanvasTexture(drawFace(false, font));
      faceTexture.colorSpace = THREE.SRGBColorSpace;
      const reliefTexture = new THREE.CanvasTexture(drawFace(true, font));
      // La tapa del cilindro mapea la textura girada; se corrige para que el logo quede derecho.
      for (const texture of [faceTexture, reliefTexture]) {
        texture.center.set(0.5, 0.5);
        texture.rotation = Math.PI / 2;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }

      const gold = new THREE.MeshStandardMaterial({ color: 0xd49a22, roughness: 0.22, metalness: 1 });
      const face = new THREE.MeshStandardMaterial({
        map: faceTexture,
        roughness: 0.35,
        metalness: 0,
        bumpMap: reliefTexture,
        bumpScale: 3,
      });

      const coin = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.22, 160), [gold, face, face]);
      body.rotation.x = Math.PI / 2;
      coin.add(body);
      // Canto estriado: 120 estrías finas alrededor del borde.
      const ridgeGeometry = new THREE.BoxGeometry(0.02, 0.2, 0.03);
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const ridge = new THREE.Mesh(ridgeGeometry, gold);
        ridge.position.set(Math.cos(a) * 1.705, 0, Math.sin(a) * 1.705);
        ridge.rotation.y = -a;
        body.add(ridge);
      }
      // Borde levantado en ambas caras.
      const rimGeometry = new THREE.TorusGeometry(1.64, 0.055, 12, 120);
      for (const y of [0.115, -0.115]) {
        const raised = new THREE.Mesh(rimGeometry, gold);
        raised.rotation.x = Math.PI / 2;
        raised.position.y = y;
        body.add(raised);
      }
      scene.add(coin);

      const controls = new OrbitControls(camera, canvas);
      controls.enabled = finePointer;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 2.2;

      function resize() {
        const width = canvas!.clientWidth;
        const height = canvas!.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      resize();

      // Solo se dibuja mientras la moneda está en pantalla.
      let visible = true;
      const intersectionObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      intersectionObserver.observe(canvas);
      renderer.setAnimationLoop(() => {
        if (!visible) return;
        controls.update();
        renderer.render(scene, camera);
      });

      // La fuente del nombre puede cargar después; se redibuja la cara cuando esté lista.
      document.fonts.ready.then(() => {
        if (disposed) return;
        faceTexture.image = drawFace(false, font);
        reliefTexture.image = drawFace(true, font);
        faceTexture.needsUpdate = reliefTexture.needsUpdate = true;
      });

      cleanup = () => {
        renderer.setAnimationLoop(null);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        [gold, face, faceTexture, reliefTexture, environment, pmrem].forEach((resource) => resource.dispose());
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Moneda de MarkovLab: oro y esmalte azul con el logo en relieve"
    />
  );
}
