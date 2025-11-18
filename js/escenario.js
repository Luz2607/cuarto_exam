// js/escenario.js
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRButton } from "three/addons/webxr/VRButton.js";

// --- Escena básica ---
const scene = new THREE.Scene();

// Fondo blanco del ambiente
scene.background = new THREE.Color(0xffffff);

// ==== LUCES ====
// Luz ambiente suave para levantar sombras
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

// Hemisférica (cielo / suelo)
const hemi = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.0);
scene.add(hemi);

// Direccional (como una ventana o foco principal)
const dir = new THREE.DirectionalLight(0xffffff, 1.3);
dir.position.set(3, 6, 2);
dir.castShadow = true;
scene.add(dir);

// Cámara y renderer
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

// posición del "jugador" (x,z) y altura de ojos (y)
const playerPosition = new THREE.Vector3(0, 1.6, 0);
camera.position.copy(playerPosition);

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");

// Salida en espacio de color sRGB (colores más reales)
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.getElementById("app").appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// --- OrbitControls para modo escritorio (solo rotación) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0);
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;

// --- HUD ---
const hud = document.getElementById("hud");
const btnCerrarHud = document.getElementById("btnCerrarHud");
const btnInfo = document.getElementById("btnInfo");

if (btnCerrarHud) {
  btnCerrarHud.addEventListener("click", () => {
    hud.classList.add("hidden");
  });
}
if (btnInfo) {
  btnInfo.addEventListener("click", () => {
    hud.classList.remove("hidden");
  });
}

// --- Variables para movimiento ---
const moveState = {
  forward: false,
  back: false,
  left: false,
  right: false,
};
const moveSpeed = 1.3; // m/s
const playerRadius = 0.35; // radio de colisión del jugador

// Límites del cuarto (se ajustan al cargar el modelo)
const roomBounds = {
  xMin: -2,
  xMax: 2,
  zMin: -2,
  zMax: 2,
};

// Altura global del piso para usarla en VR / escritorio
let floorY = 0;
let inVR = false;

// --- Teclado (modo no VR) ---
window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") moveState.forward = true;
  if (e.key === "s" || e.key === "ArrowDown") moveState.back = true;
  if (e.key === "a" || e.key === "ArrowLeft") moveState.left = true;
  if (e.key === "d" || e.key === "ArrowRight") moveState.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") moveState.forward = false;
  if (e.key === "s" || e.key === "ArrowDown") moveState.back = false;
  if (e.key === "a" || e.key === "ArrowLeft") moveState.left = false;
  if (e.key === "d" || e.key === "ArrowRight") moveState.right = false;
});

// --- Control VR ---
let xrSession = null;
renderer.xr.addEventListener("sessionstart", () => {
  xrSession = renderer.xr.getSession();
  inVR = true;
});

renderer.xr.addEventListener("sessionend", () => {
  xrSession = null;
  inVR = false;

  // De vuelta a escritorio: ojos a 1.6 m sobre el piso
  const eyeHeight = 1.6;
  playerPosition.y = floorY + eyeHeight;
  camera.position.y = floorY + eyeHeight;
});

// Grupo que contiene TODO el salón
const room = new THREE.Group();
scene.add(room);

// =====================================================
//               CARGAR EL FBX DEL CUARTO
// =====================================================

// Ruta del FBX
const FBX_PATH = "assets/models/cuarto_vr.fbx";

const fbxLoader = new FBXLoader();
fbxLoader.load(
  FBX_PATH,
  (fbx) => {
    fbx.scale.setScalar(1);

    const meshes = [];

    fbx.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material.side = THREE.DoubleSide;

        // Si tiene textura, marcarla también en sRGB
        if (child.material.map) {
          child.material.map.colorSpace = THREE.SRGBColorSpace;
        }

        // --- ARREGLO PARA LA MUJER MUY OSCURA ---
        // Si el material es extremadamente oscuro, lo aclaramos.
        const c = child.material.color;
        if (c && c.r < 0.15 && c.g < 0.15 && c.b < 0.15) {
          // Levantamos el color base
          child.material.color.setScalar(0.6);
        }

        // Si el nombre del mesh parece ser "mujer"/"woman"/"girl",
        // la aclaramos todavía más.
        const name = child.name.toLowerCase();
        if (name.includes("mujer") || name.includes("woman") || name.includes("girl")) {
          child.material.color.setScalar(0.8);
        }

        child.material.needsUpdate = true;
      }

      meshes.push(child);
    });

    room.add(fbx);

    // Caja del salón (ya dentro de room)
    const box = new THREE.Box3().setFromObject(room);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // ---------- CONFIGURAR COLISIONES Y CÁMARA ----------
    floorY = box.min.y;
    const eyeHeight = 1.6;
    const eyeY = floorY + eyeHeight;

    const wallOffset = playerRadius + 0.15;

    roomBounds.xMin = box.min.x + wallOffset;
    roomBounds.xMax = box.max.x - wallOffset;
    roomBounds.zMin = box.min.z + wallOffset;
    roomBounds.zMax = box.max.z - wallOffset;

    const startX = (roomBounds.xMin + roomBounds.xMax) / 2;
    const startZ = (roomBounds.zMin + roomBounds.zMax) / 2;

    playerPosition.set(startX, eyeY, startZ);
    camera.position.copy(playerPosition);

    camera.lookAt(startX, eyeY, startZ - 1);
    controls.target.set(startX, eyeY - 0.3, startZ - 1);
    controls.update();

    camera.near = 0.05;
    camera.far = Math.max(size.x, size.y, size.z) * 5;
    camera.updateProjectionMatrix();
  },
  (xhr) => {
    if (xhr.total) {
      console.log(`Cuarto FBX: ${((xhr.loaded / xhr.total) * 100).toFixed(1)}% cargado`);
    } else {
      console.log("Cargando cuarto FBX...");
    }
  },
  (error) => {
    console.error("Error al cargar el FBX del cuarto:", FBX_PATH, error);
  }
);

// =====================================================
//           MOVIMIENTO + COLISIONES
// =====================================================
const tempDir = new THREE.Vector3();
const tempSide = new THREE.Vector3();

function applyMovement(delta, isVRFrame = false, xrFrame = null) {
  let moveX = 0;
  let moveZ = 0;

  // 1) Teclado (no VR)
  if (!isVRFrame) {
    if (moveState.forward) moveZ -= 1;
    if (moveState.back) moveZ += 1;
    if (moveState.left) moveX -= 1;
    if (moveState.right) moveX += 1;
  }

  // 2) Control VR (sticks)
  if (isVRFrame && xrSession && xrFrame) {
    for (const src of xrSession.inputSources) {
      if (!src.gamepad) continue;
      const gp = src.gamepad;

      const ax0 = gp.axes[0] ?? 0;
      const ax1 = gp.axes[1] ?? 0;
      const ax2 = gp.axes[2] ?? 0;
      const ax3 = gp.axes[3] ?? 0;

      const stickX = Math.abs(ax2) > 0.15 ? ax2 : ax0;
      const stickY = Math.abs(ax3) > 0.15 ? ax3 : ax1;

      moveX += stickX;
      moveZ += stickY;

      // Botón principal para avanzar siempre hacia adelante
      const primaryPressed = gp.buttons[0]?.pressed;
      if (primaryPressed) {
        moveZ -= 0.8;
      }
    }
  }

  if (moveX === 0 && moveZ === 0) return;

  const moveVec = new THREE.Vector2(moveX, moveZ);
  if (moveVec.lengthSq() > 1e-4) moveVec.normalize();

  // Dirección adelante / derecha según la cámara
  camera.getWorldDirection(tempDir);
  tempDir.y = 0;
  tempDir.normalize();

  tempSide.set(tempDir.z, 0, -tempDir.x).normalize();

  const worldMove = new THREE.Vector3();
  worldMove
    .copy(tempDir)
    .multiplyScalar(moveVec.y)
    .add(tempSide.multiplyScalar(moveVec.x));

  const speed = moveSpeed * delta;
  worldMove.multiplyScalar(speed);

  const newPos = playerPosition.clone().add(worldMove);

  // Colisión con los límites del cuarto
  newPos.x = THREE.MathUtils.clamp(newPos.x, roomBounds.xMin, roomBounds.xMax);
  newPos.z = THREE.MathUtils.clamp(newPos.z, roomBounds.zMin, roomBounds.zMax);

  const eyeY = floorY + 1.6;
  newPos.y = eyeY;

  playerPosition.copy(newPos);
  camera.position.copy(playerPosition);
}

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Bucle de render ---
const clock = new THREE.Clock();

renderer.setAnimationLoop((time, frame) => {
  const delta = clock.getDelta();
  const isVR = renderer.xr.isPresenting;

  applyMovement(delta, isVR, frame);

  controls.update(); // suavidad en vista de escritorio

  renderer.render(scene, camera);
});
