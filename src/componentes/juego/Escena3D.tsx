"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { NOMBRE_INSTALACION } from "@/componentes/formato";

export interface EdificioEscena {
  tipo: string;
  nivel: number;
  enObra: boolean;
}

interface Props {
  edificios: EdificioEscena[];
  elegido: string;
  onElegir: (tipo: string) => void;
  onFallo: () => void;
  principal: string;
  secundario: string;
}

/** Posición y huella (ancho × fondo) de cada edificio sobre el terreno. */
const SITIO: Record<string, { x: number; z: number; ancho: number; fondo: number }> = {
  ciudad_deportiva: { x: -9.6, z: -3.2, ancho: 4.6, fondo: 3.4 },
  sede: { x: -5.2, z: 0.5, ancho: 2.4, fondo: 2.4 },
  estadio: { x: 0.6, z: 0, ancho: 7, fondo: 5.4 },
  centro_medico: { x: 6.2, z: 0.8, ancho: 2.4, fondo: 2.4 },
  escuela_cantera: { x: 10.2, z: -3, ancho: 3.2, fondo: 2.6 },
};

const TIPOS = Object.keys(SITIO);

function material(color: string | number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });
}

function caja(g: THREE.Object3D, w: number, h: number, d: number, color: string | number, x: number, y: number, z: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, extra));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function textura(ancho: number, alto: number, pintar: (c: CanvasRenderingContext2D) => void, repetir?: [number, number]) {
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  pintar(lienzo.getContext("2d")!);
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetir[0], repetir[1]);
  }
  return t;
}

function texturaCampo() {
  return textura(256, 160, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#2c8b4d" : "#267d44";
      c.fillRect(i * 32, 0, 32, 160);
    }
    c.strokeStyle = "#f4f1e8";
    c.lineWidth = 3;
    c.strokeRect(8, 8, 240, 144);
    c.beginPath();
    c.moveTo(128, 8);
    c.lineTo(128, 152);
    c.stroke();
    c.beginPath();
    c.arc(128, 80, 20, 0, Math.PI * 2);
    c.stroke();
    c.strokeRect(8, 50, 36, 60);
    c.strokeRect(212, 50, 36, 60);
  });
}

function texturaVentanas(luz: string, cuerpo: string) {
  return textura(
    128,
    128,
    (c) => {
      c.fillStyle = cuerpo;
      c.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          c.fillStyle = (x * 3 + y * 5) % 7 === 0 ? luz : "#34495a";
          c.fillRect(10 + x * 30, 10 + y * 30, 20, 20);
        }
    },
    [1, 1],
  );
}

function foco(g: THREE.Object3D, x: number, z: number, alto: number) {
  caja(g, 0.12, alto, 0.12, "#59636a", x, 0, z);
  const cabeza = caja(g, 0.7, 0.28, 0.2, "#2b3438", x, alto, z, { emissive: new THREE.Color("#fff3b0"), emissiveIntensity: 0.55 });
  cabeza.rotation.y = Math.atan2(-x, -z) * 0 + 0.0;
}

function estadio(n: number, principal: string, secundario: string) {
  const g = new THREE.Group();
  const { ancho: W, fondo: F } = SITIO.estadio;
  const cesped = new THREE.Mesh(new THREE.PlaneGeometry(W - 2.4, F - 2.2), new THREE.MeshStandardMaterial({ map: texturaCampo(), roughness: 1 }));
  cesped.rotation.x = -Math.PI / 2;
  cesped.position.y = 0.03;
  cesped.receiveShadow = true;
  g.add(cesped);

  const h = 0.7 + 0.32 * n;
  const escalones = Math.min(4, n + 1);
  const grada = (w: number, d: number, x: number, z: number, hacia: "n" | "s" | "e" | "o", alto: number) => {
    for (let k = 0; k < escalones; k++) {
      const prof = d / escalones;
      const alt = (alto * (k + 1)) / escalones;
      const off = -d / 2 + prof * (k + 0.5);
      const dx = hacia === "e" ? -off : hacia === "o" ? off : 0;
      const dz = hacia === "n" ? off : hacia === "s" ? -off : 0;
      const horizontal = hacia === "n" || hacia === "s";
      caja(g, horizontal ? w : prof, alt, horizontal ? prof : w, k % 2 ? principal : "#d6d1c3", x + dx, 0, z + dz);
    }
  };
  // Fondo (norte, la más alta), frontal (sur, baja para ver el césped) y laterales
  grada(W, 1.1, 0, -F / 2 + 0.55, "n", h);
  grada(W, 0.9, 0, F / 2 - 0.45, "s", h * 0.55);
  grada(F - 2, 1.0, -W / 2 + 0.5, 0, "o", h * 0.8);
  grada(F - 2, 1.0, W / 2 - 0.5, 0, "e", h * 0.8);
  // Banda del club en el frontal
  caja(g, W, 0.16, 0.06, principal, 0, 0.3, F / 2 + 0.02);
  caja(g, W, 0.06, 0.06, secundario, 0, 0.18, F / 2 + 0.02);

  if (n >= 2) {
    const techo = n >= 4 ? principal : "#7e8a8f";
    caja(g, W + 0.3, 0.1, 1.5, techo, 0, h + 0.7, -F / 2 + 0.3);
    caja(g, 1.4, 0.1, F - 1.6, techo, -W / 2 + 0.2, h * 0.8 + 0.6, 0);
    caja(g, 1.4, 0.1, F - 1.6, techo, W / 2 - 0.2, h * 0.8 + 0.6, 0);
    for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) caja(g, 0.1, 0.7, 0.1, "#59636a", x, h, -F / 2 + 0.2);
  }
  if (n >= 3) for (const sx of [-1, 1]) for (const sz of [-1, 1]) foco(g, sx * (W / 2 + 0.25), sz * (F / 2 + 0.25), 3.6 + n * 0.2);
  if (n >= 5) {
    caja(g, W + 0.4, 0.34, 0.14, principal, 0, h + 1.2, -F / 2 + 1.0);
    caja(g, W + 0.2, 0.06, 0.16, secundario, 0, h + 1.12, -F / 2 + 1.0);
  }
  return g;
}

function sede(n: number, principal: string) {
  const g = new THREE.Group();
  const { ancho: W, fondo: F } = SITIO.sede;
  const plantas = 1 + n;
  const t = texturaVentanas("#f6d77a", "#e9e6dc");
  const alto = 0.62 * plantas;
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(W, alto, F), material("#ffffff", { map: t }));
  t.repeat.set(1, plantas / 2);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cuerpo.position.y = alto / 2;
  cuerpo.castShadow = cuerpo.receiveShadow = true;
  g.add(cuerpo);
  caja(g, W + 0.12, 0.16, F + 0.12, principal, 0, alto, 0);
  caja(g, 0.7, 0.45, 0.08, "#222c33", 0, 0, F / 2 + 0.02);
  if (n >= 4) {
    caja(g, 0.05, 1.2, 0.05, "#59636a", 0.6, alto + 0.16, 0);
    caja(g, 0.5, 0.3, 0.03, principal, 0.85, alto + 1.0, 0);
  }
  return g;
}

function ciudadDeportiva(n: number, principal: string) {
  const g = new THREE.Group();
  const campos = Math.min(3, 1 + Math.floor((n - 1) / 2));
  const tex = texturaCampo();
  for (let i = 0; i < campos; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    c.rotation.x = -Math.PI / 2;
    c.position.set(campos === 1 ? 0 : -1.0 + (i % 2) * 3.1, 0.03, -0.6 + Math.floor(i / 2) * 2.2);
    c.receiveShadow = true;
    g.add(c);
  }
  if (n >= 3) {
    caja(g, 1.3, 0.8, 1.0, "#e9e6dc", 1.5, 0, 1.0);
    caja(g, 1.4, 0.1, 1.1, principal, 1.5, 0.8, 1.0);
    caja(g, 0.7, 0.3, 0.04, "#34495a", 1.5, 0.3, 1.52);
  }
  if (n >= 5) foco(g, -2.2, 0.9, 2.6);
  if (n >= 4) foco(g, 2.3, -1.5, 2.2);
  return g;
}

function centroMedico(n: number) {
  const g = new THREE.Group();
  const { ancho: W, fondo: F } = SITIO.centro_medico;
  const t = texturaVentanas("#bfe3ef", "#f2f4f2");
  const alto = 0.55 * (n + 1);
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(W, alto, F), material("#ffffff", { map: t }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, (n + 1) / 2);
  cuerpo.position.y = alto / 2;
  cuerpo.castShadow = cuerpo.receiveShadow = true;
  g.add(cuerpo);
  caja(g, W + 0.1, 0.1, F + 0.1, "#c9d3cf", 0, alto, 0);
  caja(g, 0.7, 0.2, 0.2, "#c0392b", 0, alto + 0.1, 0);
  caja(g, 0.2, 0.7, 0.2, "#c0392b", 0, alto + 0.1, 0);
  caja(g, 0.6, 0.42, 0.08, "#34495a", 0, 0, F / 2 + 0.02);
  return g;
}

function escuela(n: number, principal: string) {
  const g = new THREE.Group();
  caja(g, 2.0, 0.9, 1.7, "#ead9b9", -0.5, 0, 0);
  const tejado = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.8, 4), material(principal));
  tejado.rotation.y = Math.PI / 4;
  tejado.scale.set(1, 1, 0.9);
  tejado.position.set(-0.5, 1.3, 0);
  tejado.castShadow = true;
  g.add(tejado);
  caja(g, 0.5, 0.5, 0.06, "#222c33", -0.5, 0, 0.88);
  for (const x of [-1.1, 0.1]) caja(g, 0.35, 0.3, 0.05, "#34495a", x, 0.4, 0.87);
  caja(g, 0.04, 1.2, 0.04, "#59636a", -0.5, 1.5, 0);
  caja(g, 0.4, 0.22, 0.03, "#ffffff", -0.3, 2.35, 0);
  if (n >= 2) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshStandardMaterial({ map: texturaCampo(), roughness: 1 }));
    c.rotation.x = -Math.PI / 2;
    c.position.set(1.0, 0.03, 0.45);
    g.add(c);
  }
  if (n >= 3) {
    caja(g, 0.9, 0.8, 1.2, "#dcc79f", 0.8, 0, -0.35);
    caja(g, 1.0, 0.08, 1.3, "#59636a", 0.8, 0.8, -0.35);
  }
  if (n >= 5) foco(g, 1.55, 1.0, 2.0);
  return g;
}

function solar(tipo: string, conCartel: boolean) {
  const g = new THREE.Group();
  const { ancho, fondo } = SITIO[tipo];
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), material("#c9a45c"));
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = 0.02;
  suelo.receiveShadow = true;
  g.add(suelo);
  const poste = (x: number, z: number) => caja(g, 0.05, 0.4, 0.05, "#6b4e1c", x, 0, z);
  for (let i = 0; i <= 6; i++) {
    poste(-ancho / 2 + (ancho * i) / 6, fondo / 2);
    poste(-ancho / 2 + (ancho * i) / 6, -fondo / 2);
  }
  caja(g, ancho, 0.04, 0.03, "#6b4e1c", 0, 0.28, fondo / 2);
  if (conCartel) {
    caja(g, 0.06, 0.9, 0.06, "#6b4e1c", -0.5, 0, fondo / 2 - 0.2);
    caja(g, 0.06, 0.9, 0.06, "#6b4e1c", 0.5, 0, fondo / 2 - 0.2);
    caja(g, 1.4, 0.5, 0.06, "#f4f1e8", 0, 0.7, fondo / 2 - 0.2);
  }
  return g;
}

function obra(tipo: string, nivel: number) {
  const g = new THREE.Group();
  const { ancho, fondo } = SITIO[tipo];
  const alto = nivel === 0 ? 1.2 : { estadio: 1.6 + nivel * 0.4, sede: 0.62 * (nivel + 2), centro_medico: 0.55 * (nivel + 2), escuela_cantera: 2.0, ciudad_deportiva: 1.0 }[tipo]!;
  const bordes = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ancho + 0.3, alto, fondo + 0.3)),
    new THREE.LineBasicMaterial({ color: "#e0a82e" }),
  );
  bordes.position.y = alto / 2;
  g.add(bordes);
  // Grúa en la esquina trasera derecha
  const x = ancho / 2 + 0.2;
  const z = -fondo / 2 - 0.2;
  const h = alto + 2.6;
  caja(g, 0.16, h, 0.16, "#e0a82e", x, 0, z);
  caja(g, 2.6, 0.12, 0.12, "#e0a82e", x - 0.9, h, z);
  caja(g, 0.5, 0.3, 0.3, "#59636a", x + 0.6, h - 0.1, z);
  caja(g, 0.04, 0.8, 0.04, "#2b3438", x - 1.8, h - 0.8, z);
  caja(g, 0.25, 0.18, 0.25, "#c0392b", x - 1.8, h - 0.98, z);
  return g;
}

export function Escena3D({ edificios, elegido, onElegir, onFallo, principal, secundario }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const etiquetas = useRef<Record<string, HTMLButtonElement | null>>({});
  const elegidoRef = useRef(elegido);
  const onElegirRef = useRef(onElegir);
  const firma = JSON.stringify(edificios) + principal + secundario;
  const estado = useRef<{ reconstruir: (e: EdificioEscena[], p: string, s: string) => void } | null>(null);

  useEffect(() => {
    elegidoRef.current = elegido;
    onElegirRef.current = onElegir;
  });

  // Montaje único: renderer, cámara, luces y bucle.
  useEffect(() => {
    const cont = contenedor.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onFallo();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    cont.prepend(renderer.domElement);
    renderer.domElement.className = "block h-full w-full touch-pan-y";

    const oscuro = window.matchMedia("(prefers-color-scheme: dark)");
    const escena = new THREE.Scene();
    const pintarCielo = () => {
      escena.background = new THREE.Color(oscuro.matches ? "#0f1f33" : "#bcd8e6");
      escena.fog = new THREE.Fog(oscuro.matches ? "#0f1f33" : "#cfe3e6", 38, 70);
    };
    pintarCielo();
    oscuro.addEventListener("change", pintarCielo);

    escena.add(new THREE.HemisphereLight("#ffffff", "#5b8a62", oscuro.matches ? 0.8 : 1.15));
    const sol = new THREE.DirectionalLight("#fff4de", oscuro.matches ? 1.0 : 2.0);
    sol.position.set(-9, 16, 11);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 12, bottom: -12, near: 1, far: 50 });
    sol.shadow.bias = -0.0005;
    escena.add(sol);

    // Terreno: césped segado, calle y colinas
    const suelo = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 70),
      new THREE.MeshStandardMaterial({
        map: textura(128, 128, (c) => {
          for (let i = 0; i < 4; i++) {
            c.fillStyle = i % 2 ? "#26753f" : "#2a7e44";
            c.fillRect(i * 32, 0, 32, 128);
          }
        }, [30, 18]),
        roughness: 1,
      }),
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escena.add(suelo);
    const calle = new THREE.Mesh(new THREE.PlaneGeometry(120, 2.2), material("#2d3a33"));
    calle.rotation.x = -Math.PI / 2;
    calle.position.set(0, 0.01, 5.2);
    calle.receiveShadow = true;
    escena.add(calle);
    for (let x = -28; x <= 28; x += 2.4) {
      const raya = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.08), material("#f4f1e8"));
      raya.rotation.x = -Math.PI / 2;
      raya.position.set(x, 0.02, 5.2);
      escena.add(raya);
    }
    for (const [x, z, r, a] of [[-30, -38, 11, 3.2], [-10, -42, 14, 3.8], [14, -40, 12, 3.4], [34, -37, 11, 3]] as const) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, a, 7), material(oscuro.matches ? "#1d3a2a" : "#8fb698"));
      c.position.set(x, a / 2 - 0.5, z);
      escena.add(c);
    }

    const edificiosGrupo = new THREE.Group();
    escena.add(edificiosGrupo);
    const resalte = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: "#f4f1e8", dashSize: 0.25, gapSize: 0.18 }));
    escena.add(resalte);

    const camara = new THREE.PerspectiveCamera(36, 2, 0.1, 150);
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0.2, 1.1, 0);
    controles.enableDamping = true;
    controles.enablePan = false;
    controles.minAzimuthAngle = -0.75;
    controles.maxAzimuthAngle = 0.75;
    controles.minPolarAngle = 0.55;
    controles.maxPolarAngle = 1.25;
    controles.minDistance = 9;
    controles.maxDistance = 38;
    controles.zoomSpeed = 0.7;

    let distanciaBase = 22;
    const ajustar = () => {
      const w = cont.clientWidth;
      const h = cont.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      const necesaria = 12.4 / (Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * camara.aspect);
      distanciaBase = Math.min(controles.maxDistance, Math.max(14, necesaria));
      const dir = new THREE.Vector3().subVectors(camara.position, controles.target).normalize();
      camara.position.copy(controles.target).addScaledVector(dir, distanciaBase);
    };
    camara.position.set(0, 7.5, 17);
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(cont);

    const reconstruir = (lista: EdificioEscena[], p: string, s: string) => {
      for (const hijo of [...edificiosGrupo.children]) {
        edificiosGrupo.remove(hijo);
        hijo.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
            o.geometry.dispose();
            const m = o.material as THREE.Material | THREE.Material[];
            (Array.isArray(m) ? m : [m]).forEach((x) => {
              (x as THREE.MeshStandardMaterial).map?.dispose();
              x.dispose();
            });
          }
        });
      }
      for (const e of lista) {
        const sitio = SITIO[e.tipo];
        const g = new THREE.Group();
        g.userData.tipo = e.tipo;
        if (e.nivel === 0) g.add(solar(e.tipo, !e.enObra));
        else if (e.tipo === "estadio") g.add(estadio(e.nivel, p, s));
        else if (e.tipo === "sede") g.add(sede(e.nivel, p));
        else if (e.tipo === "ciudad_deportiva") g.add(ciudadDeportiva(e.nivel, p));
        else if (e.tipo === "centro_medico") g.add(centroMedico(e.nivel));
        else if (e.tipo === "escuela_cantera") g.add(escuela(e.nivel, p));
        if (e.enObra) g.add(obra(e.tipo, e.nivel));
        // Caja invisible para que todo el solar sea clicable
        const pick = new THREE.Mesh(new THREE.BoxGeometry(sitio.ancho, 3, sitio.fondo), new THREE.MeshBasicMaterial({ visible: false }));
        pick.position.y = 1.5;
        g.add(pick);
        g.position.set(sitio.x, 0, sitio.z);
        edificiosGrupo.add(g);
      }
    };
    estado.current = { reconstruir };

    // Selección por clic (se ignora si se arrastró para girar la cámara)
    const rayo = new THREE.Raycaster();
    let inicio: { x: number; y: number } | null = null;
    const abajo = (ev: PointerEvent) => (inicio = { x: ev.clientX, y: ev.clientY });
    const arriba = (ev: PointerEvent) => {
      if (!inicio || Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      rayo.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camara);
      const toque = rayo.intersectObjects(edificiosGrupo.children, true)[0];
      let o: THREE.Object3D | null = toque?.object ?? null;
      while (o && !o.userData.tipo) o = o.parent;
      if (o) onElegirRef.current(o.userData.tipo);
    };
    renderer.domElement.addEventListener("pointerdown", abajo);
    renderer.domElement.addEventListener("pointerup", arriba);

    let anterior = "";
    let activo = true;
    const v = new THREE.Vector3();
    const bucle = () => {
      if (!activo) return;
      requestAnimationFrame(bucle);
      if (document.hidden) return;
      controles.update();
      const el = elegidoRef.current;
      if (el !== anterior) {
        anterior = el;
        const s = SITIO[el];
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(s.x + (a * (s.ancho + 0.7)) / 2, 0.06, s.z + (b * (s.fondo + 0.7)) / 2));
        resalte.geometry.setFromPoints(pts);
        resalte.computeLineDistances();
      }
      for (const t of TIPOS) {
        const b = etiquetas.current[t];
        if (!b) continue;
        const s = SITIO[t];
        v.set(s.x, 0, s.z + s.fondo / 2 + 1.0).project(camara);
        b.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * cont.clientWidth}px, ${((1 - v.y) / 2) * cont.clientHeight}px)`;
      }
      renderer.render(escena, camara);
    };
    bucle();

    return () => {
      activo = false;
      observador.disconnect();
      oscuro.removeEventListener("change", pintarCielo);
      renderer.domElement.removeEventListener("pointerdown", abajo);
      renderer.domElement.removeEventListener("pointerup", arriba);
      controles.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      estado.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    estado.current?.reconstruir(edificios, principal, secundario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  return (
    <div ref={contenedor} className="relative aspect-[4/3] w-full select-none sm:aspect-[2.3/1]" data-escena3d>
      {TIPOS.map((t) => (
        <button
          key={t}
          ref={(el) => {
            etiquetas.current[t] = el;
          }}
          type="button"
          onClick={() => onElegir(t)}
          aria-pressed={elegido === t}
          className={
            "titulo absolute top-0 left-0 rounded-md px-2 py-0.5 text-sm font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-tiza sm:text-lg " +
            (elegido === t ? "bg-tiza text-noche" : "bg-noche/80 text-tiza/90 hover:bg-noche")
          }
        >
          {NOMBRE_INSTALACION[t]}
        </button>
      ))}
    </div>
  );
}
