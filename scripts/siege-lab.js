import * as THREE from "three";
import { createSiegeScenario, advanceSiegeTurn } from "./siege-lab-sim.js";

const byId = id => document.getElementById(id);
const format = amount => Number(amount || 0).toLocaleString("pt-BR");
let state = createSiegeScenario();
let scene, renderer, camera, gate, wallLeft, wallRight, tower;
let resizeObserver = null;
const host = byId("siegeViewport");

function makeBox(parent, size, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: .92 })
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildScene() {
  if (!host) return;
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x526b80);
    camera = new THREE.OrthographicCamera(-7, 7, 5.2, -5.2, .1, 80);
    camera.position.set(12, 12, 17);
    camera.lookAt(0, 1, 0);
    renderer = new THREE.WebGLRenderer({
      antialias: false, alpha: false, powerPreference: "default"
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xe5f0fa, 0x34432d, 2.2));
    const sun = new THREE.DirectionalLight(0xffda95, 2);
    sun.position.set(-5, 10, 8);
    scene.add(sun);
    const floor = makeBox(scene, [15, .3, 12], [0, -.3, 0], 0x4b6c45);
    floor.castShadow = false;
    wallLeft = makeBox(scene, [4.3, 3, 1], [-3.2, 1.5, -2.5], 0x8f9792);
    wallRight = makeBox(scene, [4.3, 3, 1], [3.2, 1.5, -2.5], 0x8f9792);
    gate = makeBox(scene, [2.15, 2.8, 1.15], [0, 1.4, -2.4], 0x825532);
    makeBox(gate, [.1, .85, 1.2], [-.3, .25, 0], 0xccab70);
    makeBox(gate, [.1, .85, 1.2], [.3, .25, 0], 0xccab70);
    tower = new THREE.Group();
    tower.position.set(5.2, 0, -2.3);
    scene.add(tower);
    makeBox(tower, [2, 4.2, 2], [0, 2.1, 0], 0xabb6ad);
    makeBox(tower, [2.4, .35, 2.4], [0, 4.25, 0], 0xd8c9a1);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.75, 1.9, 4),
      new THREE.MeshStandardMaterial({ color: 0x36577b, roughness: .8 })
    );
    roof.position.y = 5.4;
    roof.rotation.y = Math.PI / 4;
    tower.add(roof);
    const batteringRam = new THREE.Group();
    batteringRam.position.set(-1, 0, 3.1);
    scene.add(batteringRam);
    makeBox(batteringRam, [1.7, .75, 2.7], [0, .9, 0], 0x795032);
    makeBox(batteringRam, [.5, .5, 3.6], [0, 1, -.55], 0xa98b57);
    for (const side of [-1, 1]) {
      for (const depth of [-.85, .85]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(.4, .4, .22, 10),
          new THREE.MeshStandardMaterial({ color: 0x463728 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * .95, .43, depth);
        batteringRam.add(wheel);
      }
    }
    const troops = new THREE.Group();
    troops.position.set(2.5, 0, 3.3);
    scene.add(troops);
    for (let i = 0; i < 6; i++) {
      const soldier = new THREE.Group();
      soldier.position.set((i % 3 - 1) * .65, 0, Math.floor(i / 3) * .75);
      troops.add(soldier);
      makeBox(soldier, [.4, .8, .36], [0, .65, 0], 0x547ca5);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(.22, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0xd3b67e })
      );
      helmet.position.y = 1.2;
      soldier.add(helmet);
    }
    const resize = () => {
      if (!renderer || !host.clientWidth || !host.clientHeight) return;
      const aspect = host.clientWidth / host.clientHeight;
      camera.left = -5.5 * aspect;
      camera.right = 5.5 * aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.render(scene, camera);
    };
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }
    renderer.domElement.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      renderer = null;
      byId("siegeStatus").textContent = "Visualização 3D indisponível. Os cálculos do laboratório continuam.";
    }, { once: true });
    resize();
  } catch {
    byId("siegeStatus").textContent = "GPU não disponível. Use os controles e os relatórios do cenário.";
  }
}

function render() {
  for (const key of ["gate", "wall", "tower", "ram", "infantry"]) {
    const hp = state[key + "Hp"];
    byId(key + "Value").textContent = format(hp);
    byId(key + "Meter").value = hp;
  }
  const won = Boolean(state.winner);
  byId("attackGate").disabled = won || state.ramHp === 0;
  byId("attackWall").disabled = won || state.ramHp === 0;
  const description = state.winner === "attackers" ? "Fortificação dominada no cenário de teste."
    : state.winner === "defenders" ? "A defesa resistiu ao cerco."
    : "Rodada " + state.round + " · " + (state.gateHp === 0 || state.wallHp === 0 ? "Passagem aberta." : "Muralha protegida.");
  byId("siegeStatus").textContent = description;
  if (gate && renderer) {
    const gateRatio = state.gateHp / 1300;
    gate.scale.y = Math.max(.02, gateRatio);
    gate.position.y = 1.4 * gateRatio;
    const wallRatio = Math.max(.12, state.wallHp / 2200);
    wallLeft.scale.y = wallRatio;
    wallRight.scale.y = wallRatio;
    wallLeft.position.y = 1.5 * wallRatio;
    wallRight.position.y = 1.5 * wallRatio;
    tower.visible = state.towerHp > 0;
    renderer.render(scene, camera);
  }
}

function advance(target) {
  state = advanceSiegeTurn(state, target);
  const attack = state.events?.[0];
  const infantry = state.events?.[1];
  byId("siegeLog").textContent = [
    "Rodada " + state.round + ": aríetes no " + (target === "gate" ? "portão" : "trecho de muralha") + ".",
    "Dano do aríete: " + format(attack?.damage) + ".",
    "Dano da infantaria à torre: " + format(infantry?.damage) + ".",
    state.winner === "attackers" ? "Ataque vitorioso (somente laboratório)." : "",
    state.winner === "defenders" ? "Defesa vitoriosa (somente laboratório)." : ""
  ].filter(Boolean).join("\n");
  render();
}

byId("attackGate")?.addEventListener("click", () => advance("gate"));
byId("attackWall")?.addEventListener("click", () => advance("wall"));
byId("resetSiege")?.addEventListener("click", () => {
  state = createSiegeScenario();
  byId("siegeLog").textContent = "Rodada 0 · Cenário reiniciado sem alterar dados do jogo.";
  render();
});
window.addEventListener("pagehide", () => {
  resizeObserver?.disconnect();
  if (scene) {
    const geometry = new Set();
    const materials = new Set();
    scene.traverse(node => {
      if (node.geometry) geometry.add(node.geometry);
      if (node.material) materials.add(node.material);
    });
    for (const item of geometry) item.dispose();
    for (const item of materials) item.dispose();
  }
  renderer?.dispose();
}, { once: true });
buildScene();
render();
