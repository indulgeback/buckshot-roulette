import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

let scene, camera, renderer, shotgunGroup;
let composer, bloomPass;
let currentFlash = null;
let hangingLamp = null;
let lampBulb = null;
let tableGlow = null;
let dealerDemon = null;
let dustParticles = null;
const textureLoader = new THREE.TextureLoader();
const dealerDemonBaseY = -2.0;
const lampBaseIntensity = 26;
let lampFlickerPulse = 0;
const loader = new GLTFLoader();
const clock = new THREE.Clock();

// Animation queue
const animQueue = [];

function scheduleAnim(updateFn, durationMs, onComplete) {
  animQueue.push({
    update: updateFn,
    duration: durationMs / 1000,
    elapsed: 0,
    onComplete: onComplete || null,
  });
}

// Camera dynamic state
const cameraBase = { x: 0, y: 6, z: 10 };
const cameraState = {
  shake: { intensity: 0, decay: 0.92 },
  offset: { x: 0, y: 0, z: 0 },
};

// Dealer animation state
let dealerAnimState = "idle";
let dealerAnimTimer = 0;
let dealerAnimTimeout = null;

// Shotgun animation state
let shotgunAnimState = "idle";
let shotgunAnimTimeout = null;

// Lighting references
let redLightRef = null;
let yellowLightRef = null;
let ambientLightRef = null;

export function initScene() {
  const canvas = document.getElementById("game-canvas");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3b2618);
  scene.fog = new THREE.Fog(0x3b2618, 20, 60);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(cameraBase.x, cameraBase.y, cameraBase.z);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.9;

  // Post-processing
  setupPostProcessing();

  // Lights
  ambientLightRef = new THREE.AmbientLight(0xb89c76, 2.8);
  scene.add(ambientLightRef);
  scene.add(new THREE.HemisphereLight(0xffdfb6, 0x2f1c13, 1.4));

  redLightRef = new THREE.PointLight(0xff4444, 1.5, 26);
  redLightRef.position.set(-4, 6, 4);
  redLightRef.castShadow = true;
  scene.add(redLightRef);

  yellowLightRef = new THREE.PointLight(0xffbb66, 1.2, 24);
  yellowLightRef.position.set(4, 6, 4);
  yellowLightRef.castShadow = true;
  scene.add(yellowLightRef);

  // Old hanging lamp feel: warm vertical cone focused on the table.
  hangingLamp = new THREE.SpotLight(
    0xffcc7a,
    lampBaseIntensity,
    42,
    Math.PI / 8,
    0.7,
    1.0,
  );
  hangingLamp.position.set(0, 10, 0);
  hangingLamp.castShadow = true;
  hangingLamp.shadow.mapSize.width = 1024;
  hangingLamp.shadow.mapSize.height = 1024;
  hangingLamp.shadow.bias = -0.00008;
  scene.add(hangingLamp);

  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, -1.1, 0);
  scene.add(lampTarget);
  hangingLamp.target = lampTarget;

  // Visible warm bulb core for an old hanging-lamp feel.
  lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffd493,
      emissive: 0xffb253,
      emissiveIntensity: 2.2,
      roughness: 0.25,
      metalness: 0.0,
    }),
  );
  lampBulb.position.set(0, 9.6, 0);
  scene.add(lampBulb);

  // Floor
  const woodTex = textureLoader.load('images/17-tabletop-wood-texture.png');
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(6, 6);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: woodTex, color: 0x3b2b1e, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Soft warm highlight pool on the tabletop under the hanging lamp.
  tableGlow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffc171,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  tableGlow.rotation.x = -Math.PI / 2;
  tableGlow.position.set(0, -0.74, 0);
  tableGlow.renderOrder = 1;
  scene.add(tableGlow);

  // Fallback table
  const tableTex = woodTex.clone();
  tableTex.repeat.set(3, 2.5);
  const fallbackTable = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.5, 8),
    new THREE.MeshStandardMaterial({
      map: tableTex,
      color: 0x6a4f3a,
      roughness: 0.7,
      metalness: 0.1,
    }),
  );
  fallbackTable.position.y = -1;
  fallbackTable.receiveShadow = true;
  fallbackTable.castShadow = true;
  scene.add(fallbackTable);

  // Fallback shotgun
  const gunGroup = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 3, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.3,
    }),
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x3d2817 }),
  );
  stock.position.set(-1.5, 0, 0);
  stock.castShadow = true;
  gunGroup.add(stock);

  gunGroup.position.set(0, 0.3, 0);
  shotgunGroup = gunGroup;
  scene.add(shotgunGroup);

  // Load GLB models (replace fallbacks on success)
  loader.load(
    "models/table.glb",
    (gltf) => {
      const model = gltf.scene;
      model.scale.set(3, 3, 3);
      model.position.set(0, -1.8, 0);
      model.traverse((c) => {
        if (c.isMesh) {
          c.receiveShadow = true;
          c.castShadow = true;
        }
      });
      scene.add(model);
      scene.remove(fallbackTable);
    },
    undefined,
    () => console.log("Table model failed, using fallback"),
  );

  loader.load(
    "models/shotgun.glb",
    (gltf) => {
      scene.remove(shotgunGroup);
      const model = gltf.scene;
      model.scale.set(2, 2, 2);
      model.traverse((c) => {
        if (c.isMesh) c.castShadow = true;
      });
      shotgunGroup = new THREE.Group();
      shotgunGroup.add(model);
      scene.add(shotgunGroup);
    },
    undefined,
    () => console.log("Shotgun model failed, using fallback"),
  );

  // Opponent demon model
  loader.load(
    "models/demon.glb",
    (gltf) => {
      const model = gltf.scene;
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      const size = new THREE.Vector3();
      const box = new THREE.Box3().setFromObject(model);
      box.getSize(size);

      const targetHeight = 3.2;
      const sourceHeight = size.y > 0 ? size.y : 1;
      const uniformScale = targetHeight / sourceHeight;
      model.scale.setScalar(uniformScale);

      const fitted = new THREE.Box3().setFromObject(model);
      const fittedCenter = new THREE.Vector3();
      fitted.getCenter(fittedCenter);

      model.position.x -= fittedCenter.x;
      model.position.z -= fittedCenter.z;
      model.position.y -= fitted.min.y;

      dealerDemon = new THREE.Group();
      dealerDemon.position.set(0, dealerDemonBaseY, -6.2);
      dealerDemon.rotation.y = Math.PI;
      dealerDemon.add(model);
      scene.add(dealerDemon);
    },
    undefined,
    () => console.log("Demon model failed to load"),
  );

  // Environment dust particles
  createDustSystem();

  window.addEventListener("resize", onWindowResize);
  animate();
}

function setupPostProcessing() {
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3, // strength - subtle for dungeon atmosphere
      0.6, // radius
      0.85, // threshold - only bright emissives bloom
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch (e) {
    console.warn("Post-processing setup failed, using direct rendering:", e);
    composer = null;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

// ====== Particle System ======

function emitParticles(config) {
  const {
    count,
    position: pos,
    color,
    size,
    lifetime,
    gravity,
    spread,
  } = config;
  const velocity = config.velocity || { x: 2, y: 3, z: 2 };

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x + (Math.random() - 0.5) * (spread || 0.5);
    positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * (spread || 0.5);
    positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * (spread || 0.5);
    velocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * velocity.x,
        Math.random() * velocity.y,
        (Math.random() - 0.5) * velocity.z,
      ),
    );
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const grav = gravity || 0;
  scheduleAnim(
    (t) => {
      material.opacity = 1 - t;
      const posArr = geometry.attributes.position.array;
      for (let i = 0; i < velocities.length; i++) {
        velocities[i].y -= grav * 0.016;
        posArr[i * 3] += velocities[i].x * 0.016;
        posArr[i * 3 + 1] += velocities[i].y * 0.016;
        posArr[i * 3 + 2] += velocities[i].z * 0.016;
      }
      geometry.attributes.position.needsUpdate = true;
    },
    lifetime * 1000,
    () => {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  );
}

function createDustSystem() {
  const count = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 12 - 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x8b7355,
    size: 0.04,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  dustParticles = new THREE.Points(geometry, material);
  scene.add(dustParticles);
}

// ====== Animation Loop ======

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const t = performance.now() * 0.001;

  // Process animation queue
  for (let i = animQueue.length - 1; i >= 0; i--) {
    const anim = animQueue[i];
    anim.elapsed += dt;
    const progress = Math.min(anim.elapsed / anim.duration, 1);
    anim.update(progress, dt);
    if (progress >= 1) {
      animQueue.splice(i, 1);
      if (anim.onComplete) anim.onComplete();
    }
  }

  // Lamp flicker
  if (hangingLamp) {
    lampFlickerPulse = Math.max(0, lampFlickerPulse - 0.08);
    if (Math.random() < 0.03) {
      lampFlickerPulse = 0.6 + Math.random() * 1.6;
    }
    const wave = Math.sin(t * 22) * 0.8 + Math.sin(t * 37) * 0.35;
    const intensity = lampBaseIntensity + wave + lampFlickerPulse;
    hangingLamp.intensity = intensity;

    if (lampBulb) {
      lampBulb.material.emissiveIntensity =
        2.2 + (intensity - lampBaseIntensity) * 0.12;
    }

    if (tableGlow) {
      tableGlow.material.opacity =
        0.18 + (intensity - lampBaseIntensity) * 0.012;
    }
  }

  // Dealer animation
  if (dealerDemon) {
    switch (dealerAnimState) {
      case "idle":
        dealerDemon.position.y =
          dealerDemonBaseY + Math.sin(t * 1.15) * 0.03;
        dealerDemon.rotation.z = Math.sin(t * 0.7) * 0.01;
        break;
      case "agitated":
        dealerDemon.position.y =
          dealerDemonBaseY + Math.sin(t * 3.5) * 0.08;
        dealerDemon.rotation.z = Math.sin(t * 2.0) * 0.03;
        break;
      case "hit": {
        const decay = Math.max(0, 1 - dealerAnimTimer);
        dealerDemon.position.y =
          dealerDemonBaseY + Math.sin(t * 20) * 0.1 * decay;
        dealerDemon.rotation.z = Math.sin(t * 15) * 0.06 * decay;
        dealerAnimTimer += dt;
        break;
      }
      case "taunting":
        dealerDemon.rotation.x = Math.sin(t * 0.5) * 0.05 + 0.08;
        dealerDemon.position.y =
          dealerDemonBaseY + Math.sin(t * 1.5) * 0.05;
        break;
    }
  }

  // Shotgun animation
  if (shotgunGroup) {
    switch (shotgunAnimState) {
      case "idle":
        shotgunGroup.rotation.y += 0.003;
        break;
      case "spin_fast":
        shotgunGroup.rotation.y += 0.12;
        break;
    }
  }

  // Dust particles
  if (dustParticles) {
    const arr = dustParticles.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += 0.002;
      if (arr[i + 1] > 10) arr[i + 1] = -2;
    }
    dustParticles.geometry.attributes.position.needsUpdate = true;
    dustParticles.rotation.y += 0.0003;
  }

  // Camera dynamics
  if (cameraState.shake.intensity > 0.001) {
    camera.position.x =
      cameraBase.x +
      cameraState.offset.x +
      (Math.random() - 0.5) * cameraState.shake.intensity;
    camera.position.y =
      cameraBase.y +
      cameraState.offset.y +
      (Math.random() - 0.5) * cameraState.shake.intensity * 0.5;
    camera.position.z =
      cameraBase.z + cameraState.offset.z;
    cameraState.shake.intensity *= cameraState.shake.decay;
  } else {
    cameraState.shake.intensity = 0;
    camera.position.x = cameraBase.x + cameraState.offset.x;
    camera.position.y = cameraBase.y + cameraState.offset.y;
    camera.position.z = cameraBase.z + cameraState.offset.z;
  }
  camera.lookAt(0, 0, 0);

  // Render
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

// ====== Exported Animation Functions ======

export function animateShot() {
  // Clean up previous flash
  if (currentFlash) {
    scene.remove(currentFlash);
    currentFlash = null;
  }

  // Muzzle flash light
  const flash = new THREE.PointLight(0xffff00, 5, 15);
  flash.position.set(0, 0.5, 0);
  scene.add(flash);
  currentFlash = flash;

  // Muzzle flame particles
  emitParticles({
    count: 30,
    position: { x: 0, y: 0.5, z: 0 },
    velocity: { x: 3, y: 2, z: 3 },
    color: 0xff8800,
    size: 0.15,
    lifetime: 0.4,
    gravity: 2,
    spread: 0.3,
  });

  // Recoil
  if (shotgunGroup) {
    shotgunGroup.position.x -= 0.3;
    shotgunGroup.rotation.z = -0.2;
  }

  // Camera shake
  cameraState.shake.intensity = 0.15;

  // Bloom pulse
  if (bloomPass) {
    const origStrength = bloomPass.strength;
    bloomPass.strength = 0.8;
    setTimeout(() => {
      if (bloomPass) bloomPass.strength = origStrength;
    }, 200);
  }

  setTimeout(() => {
    if (shotgunGroup) {
      shotgunGroup.position.x += 0.3;
      shotgunGroup.rotation.z = 0;
    }
    scene.remove(flash);
    if (currentFlash === flash) currentFlash = null;
  }, 150);
}

export function animateHit(target) {
  const canvas = document.getElementById("game-canvas");
  canvas.style.animation = "shake 0.3s";

  const originalBg = scene.background.clone();
  scene.background.set(0xff0000);

  // Impact particles
  const hitPos =
    target === "dealer"
      ? { x: 0, y: 0, z: -4 }
      : { x: 0, y: 2, z: 4 };
  emitParticles({
    count: 20,
    position: hitPos,
    velocity: { x: 4, y: 3, z: 4 },
    color: 0xff2200,
    size: 0.12,
    lifetime: 0.5,
    gravity: 3,
    spread: 0.8,
  });

  // Red point light at hit location
  const hitLight = new THREE.PointLight(0xff0000, 3, 15);
  hitLight.position.set(hitPos.x, hitPos.y + 1, hitPos.z);
  scene.add(hitLight);

  // Camera shake for player hit
  if (target === "player") {
    cameraState.shake.intensity = 0.3;
  }

  setTimeout(() => {
    scene.remove(hitLight);
  }, 500);

  setTimeout(() => {
    scene.background.copy(originalBg);
    canvas.style.animation = "";
  }, 100);
}

export function animateRoundStart() {
  // Bloom pulse
  if (bloomPass) {
    const orig = bloomPass.strength;
    bloomPass.strength = 0.8;
    scheduleAnim(
      (t) => {
        bloomPass.strength = orig + (0.8 - orig) * (1 - t);
      },
      1500,
      () => {
        if (bloomPass) bloomPass.strength = orig;
      },
    );
  }

  // Camera settle from slightly pulled back
  cameraState.offset.z = 2;
  cameraState.offset.y = 1;
  scheduleAnim(
    (t) => {
      cameraState.offset.z = 2 * (1 - t);
      cameraState.offset.y = 1 * (1 - t);
    },
    2000,
  );

  // Smoke particles from table
  emitParticles({
    count: 20,
    position: { x: 0, y: -0.5, z: 0 },
    velocity: { x: 0.5, y: 1.5, z: 0.5 },
    color: 0xff9944,
    size: 0.08,
    lifetime: 1.5,
    gravity: -0.3,
    spread: 2,
  });

  // Dramatic lamp flicker
  lampFlickerPulse = 4;
}

export function animateShellReload() {
  // Fast spin shotgun
  const prevState = shotgunAnimState;
  shotgunAnimState = "idle"; // pause rotation
  if (shotgunAnimTimeout) clearTimeout(shotgunAnimTimeout);

  setTimeout(() => {
    shotgunAnimState = "spin_fast";
    shotgunAnimTimeout = setTimeout(() => {
      shotgunAnimState = "idle";
      shotgunAnimTimeout = null;
    }, 1000);
  }, 500);

  // Metal spark particles
  emitParticles({
    count: 10,
    position: { x: 0, y: 0.3, z: 0 },
    velocity: { x: 2, y: 3, z: 2 },
    color: 0xffdd44,
    size: 0.06,
    lifetime: 0.6,
    gravity: 4,
    spread: 0.3,
  });

  // Bloom pulse
  if (bloomPass) {
    const orig = bloomPass.strength;
    bloomPass.strength = 0.5;
    scheduleAnim(
      (t) => {
        bloomPass.strength = orig + (0.5 - orig) * (1 - t);
      },
      500,
    );
  }
}

export function animateItemUse(itemId) {
  const gunPos = { x: 0, y: 0.3, z: 0 };
  switch (itemId) {
    case "magnifying_glass": {
      // Brief focused blue light
      const light = new THREE.PointLight(0x4488ff, 3, 10);
      light.position.set(0, 1, 0);
      scene.add(light);
      scheduleAnim(
        (t) => {
          light.intensity = 3 * (1 - t);
        },
        800,
        () => scene.remove(light),
      );
      // Camera slight push in
      cameraState.offset.z = -0.5;
      scheduleAnim(
        (t) => {
          cameraState.offset.z = -0.5 * (1 - t);
        },
        300,
      );
      break;
    }
    case "beer":
      // Golden splash particles
      emitParticles({
        count: 15,
        position: gunPos,
        velocity: { x: 3, y: 4, z: 3 },
        color: 0xffaa00,
        size: 0.1,
        lifetime: 0.8,
        gravity: 5,
        spread: 0.5,
      });
      break;
    case "handsaw":
      // Spark particles
      emitParticles({
        count: 20,
        position: gunPos,
        velocity: { x: 4, y: 2, z: 4 },
        color: 0xffcc22,
        size: 0.05,
        lifetime: 0.5,
        gravity: 2,
        spread: 0.3,
      });
      if (bloomPass) {
        const orig = bloomPass.strength;
        bloomPass.strength = 0.6;
        scheduleAnim(
          (t) => {
            bloomPass.strength = orig + (0.6 - orig) * (1 - t);
          },
          400,
        );
      }
      break;
    case "cigarette":
      // Slow rising smoke
      emitParticles({
        count: 12,
        position: { x: -3, y: 0, z: 3 },
        velocity: { x: 0.2, y: 1.5, z: 0.2 },
        color: 0xccccbb,
        size: 0.1,
        lifetime: 2.0,
        gravity: -0.5,
        spread: 0.3,
      });
      break;
    case "handcuffs":
      // Blue/gray chain trail particles
      emitParticles({
        count: 15,
        position: { x: 0, y: 0.5, z: -3 },
        velocity: { x: 1, y: 2, z: 1 },
        color: 0x6688aa,
        size: 0.08,
        lifetime: 1.0,
        gravity: 1,
        spread: 1,
      });
      break;
    case "expired_medicine":
      // Green toxic flash
      emitParticles({
        count: 18,
        position: { x: -3, y: 0.5, z: 3 },
        velocity: { x: 1, y: 2, z: 1 },
        color: 0x44ff44,
        size: 0.1,
        lifetime: 1.0,
        gravity: 1,
        spread: 0.5,
      });
      // Brief green ambient shift
      if (ambientLightRef) {
        const origColor = ambientLightRef.color.clone();
        ambientLightRef.color.set(0x558855);
        scheduleAnim(
          (t) => {
            ambientLightRef.color.lerpColors(
              new THREE.Color(0x558855),
              origColor,
              t,
            );
          },
          800,
        );
      }
      break;

    case "inverter":
      // Purple swirl particles
      emitParticles({
        count: 20,
        position: gunPos,
        velocity: { x: 2, y: 3, z: 2 },
        color: 0xaa44ff,
        size: 0.1,
        lifetime: 0.8,
        gravity: 0,
        spread: 0.5,
      });
      {
        const invLight = new THREE.PointLight(0xaa44ff, 3, 12);
        invLight.position.set(0, 1, 0);
        scene.add(invLight);
        scheduleAnim(
          (t) => { invLight.intensity = 3 * (1 - t); },
          600,
          () => scene.remove(invLight),
        );
      }
      break;

    case "burner_phone":
      // Blue ring particles
      emitParticles({
        count: 15,
        position: { x: -3, y: 1, z: 3 },
        velocity: { x: 1.5, y: 2, z: 1.5 },
        color: 0x4488ff,
        size: 0.08,
        lifetime: 1.2,
        gravity: -0.5,
        spread: 0.8,
      });
      {
        const phoneLight = new THREE.PointLight(0x4488ff, 2, 10);
        phoneLight.position.set(-3, 2, 3);
        scene.add(phoneLight);
        scheduleAnim(
          (t) => { phoneLight.intensity = 2 * (1 - t); },
          400,
          () => scene.remove(phoneLight),
        );
      }
      break;

    case "adrenaline":
      // Red/orange burst (steal effect)
      emitParticles({
        count: 25,
        position: gunPos,
        velocity: { x: 4, y: 3, z: 4 },
        color: 0xff4422,
        size: 0.1,
        lifetime: 0.6,
        gravity: 2,
        spread: 1,
      });
      {
        const adrLight = new THREE.PointLight(0xff2200, 4, 15);
        adrLight.position.set(0, 2, 0);
        scene.add(adrLight);
        scheduleAnim(
          (t) => { adrLight.intensity = 4 * (1 - t); },
          500,
          () => scene.remove(adrLight),
        );
      }
      if (bloomPass) {
        const orig = bloomPass.strength;
        bloomPass.strength = 0.7;
        scheduleAnim(
          (t) => { bloomPass.strength = orig + (0.7 - orig) * (1 - t); },
          500,
        );
      }
      break;
  }
}

export function animateStageTransition(stageNum) {
  // Camera pull out
  scheduleAnim(
    (t) => {
      if (t < 0.5) {
        // Pull out in first half
        const p = t * 2;
        cameraState.offset.z = 2 * p;
        cameraState.offset.y = 1 * p;
      } else {
        // Return in second half
        const p = (t - 0.5) * 2;
        cameraState.offset.z = 2 * (1 - p);
        cameraState.offset.y = 1 * (1 - p);
      }
    },
    2000,
  );

  // Dramatic lamp flicker
  lampFlickerPulse = 6;

  // Pause shotgun rotation
  const prevShotgun = shotgunAnimState;
  shotgunAnimState = "idle";

  // Bloom intensity
  if (bloomPass) {
    const orig = bloomPass.strength;
    bloomPass.strength = 1.0;
    scheduleAnim(
      (t) => {
        bloomPass.strength = orig + (1.0 - orig) * (1 - t);
      },
      2000,
      () => {
        if (bloomPass) bloomPass.strength = orig;
        shotgunAnimState = prevShotgun || "idle";
      },
    );
  }

  // Dark red ash particles falling
  emitParticles({
    count: 30,
    position: { x: 0, y: 8, z: 0 },
    velocity: { x: 1, y: -0.5, z: 1 },
    color: 0x882222,
    size: 0.08,
    lifetime: 3.0,
    gravity: -0.2,
    spread: 6,
  });
}

export function animateVictory() {
  // Camera orbit
  const startTime = performance.now();
  const orbitDuration = 3000;
  const origOffset = { ...cameraState.offset };

  function orbitUpdate() {
    const elapsed = performance.now() - startTime;
    if (elapsed > orbitDuration) {
      cameraState.offset = origOffset;
      return;
    }
    const t = elapsed / orbitDuration;
    const angle = t * Math.PI * 2;
    cameraState.offset.x = Math.sin(angle) * 3;
    cameraState.offset.z = Math.cos(angle) * 3 - 3;
    cameraState.offset.y = Math.sin(t * Math.PI) * 2;
    requestAnimationFrame(orbitUpdate);
  }
  orbitUpdate();

  // Bloom boost
  if (bloomPass) {
    const orig = bloomPass.strength;
    bloomPass.strength = 1.5;
    scheduleAnim(
      (t) => {
        bloomPass.strength = orig + (1.5 - orig) * (1 - t);
      },
      3000,
    );
  }

  // Golden particles rising from demon position
  emitParticles({
    count: 40,
    position: { x: 0, y: -1, z: -6 },
    velocity: { x: 1.5, y: 4, z: 1.5 },
    color: 0xffd700,
    size: 0.12,
    lifetime: 2.5,
    gravity: -1,
    spread: 2,
  });

  // Light intensity boost
  if (hangingLamp) {
    const origIntensity = lampBaseIntensity;
    hangingLamp.intensity = origIntensity * 1.5;
    scheduleAnim(
      (t) => {
        hangingLamp.intensity =
          origIntensity * 1.5 + (origIntensity - origIntensity * 1.5) * t;
      },
      3000,
    );
  }
}

export function animateDefeat() {
  // Camera look down
  scheduleAnim(
    (t) => {
      cameraState.offset.y = -2 * t;
      cameraState.offset.z = 1 * t;
    },
    2000,
  );

  // Dim all lights
  if (redLightRef) {
    const orig = redLightRef.intensity;
    scheduleAnim(
      (t) => {
        redLightRef.intensity = orig * (1 - 0.7 * t);
      },
      2000,
    );
  }
  if (yellowLightRef) {
    const orig = yellowLightRef.intensity;
    scheduleAnim(
      (t) => {
        yellowLightRef.intensity = orig * (1 - 0.7 * t);
      },
      2000,
    );
  }

  // Kill bloom
  if (bloomPass) {
    const orig = bloomPass.strength;
    scheduleAnim(
      (t) => {
        bloomPass.strength = orig * (1 - t);
      },
      2000,
    );
  }

  // Dark particles falling
  emitParticles({
    count: 25,
    position: { x: 0, y: 8, z: 0 },
    velocity: { x: 0.5, y: -0.3, z: 0.5 },
    color: 0x441111,
    size: 0.1,
    lifetime: 3.0,
    gravity: -0.1,
    spread: 8,
  });

  // Increase fog density
  if (scene.fog) {
    const origNear = scene.fog.near;
    const origFar = scene.fog.far;
    scheduleAnim(
      (t) => {
        scene.fog.near = origNear * (1 - 0.5 * t);
        scene.fog.far = origFar * (1 - 0.4 * t);
      },
      2000,
    );
  }
}

export function setDealerAnim(state, durationMs) {
  dealerAnimState = state;
  dealerAnimTimer = 0;

  if (dealerAnimTimeout) clearTimeout(dealerAnimTimeout);
  if (durationMs) {
    dealerAnimTimeout = setTimeout(() => {
      dealerAnimState = "idle";
      if (dealerDemon) dealerDemon.rotation.x = 0;
      dealerAnimTimeout = null;
    }, durationMs);
  }
}

export function setSceneMood(mood) {
  switch (mood) {
    case "tense":
      if (redLightRef) redLightRef.intensity = 3.0;
      if (bloomPass) bloomPass.strength = 0.5;
      break;
    case "calm":
      if (redLightRef) redLightRef.intensity = 1.5;
      if (bloomPass) bloomPass.strength = 0.3;
      break;
    case "victory":
      if (bloomPass) bloomPass.strength = 1.5;
      break;
    case "defeat":
      if (redLightRef) redLightRef.intensity = 0.3;
      if (yellowLightRef) yellowLightRef.intensity = 0.3;
      if (bloomPass) bloomPass.strength = 0;
      break;
  }
}
