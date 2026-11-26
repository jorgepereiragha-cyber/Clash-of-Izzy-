import * as THREE from "three";
import { readGraphicsChoice } from "./scripts/kingdom-visual-preferences.js";
import { selectKingdomQualityProfile } from "./scripts/kingdom-quality.js";

/*
 * Strategic world map for Clash of Izzy.
 * The map is server-state driven: territory ownership and active marches are
 * visualized from the same D1 snapshot used by the tactical controls.
 * Marching formations travel from the home keep to their actual destination;
 * there is no free-roaming hero or random left/right character animation.
 */
(() => {
  "use strict";

  const host = document.getElementById("worldMap");
  const canvas = document.getElementById("world3d");
  if (!host || !canvas) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const saveData = connection?.saveData === true;
  // Reading the storage property itself may throw in restricted WebViews.
  let preference = "auto";
  try { preference = readGraphicsChoice(window.localStorage); } catch { /* Use automatic quality safely. */ }
  // Same device policy as the city. Re-evaluate with the actual GPU capability
  // after creating the context; the map retains its smaller pixel budget.
  const mapProfile = maxTextureSize => selectKingdomQualityProfile({
    deviceMemory:memory,hardwareConcurrency:cores,viewportWidth:host.clientWidth||window.innerWidth,
    maxTextureSize,saveData,prefersReducedMotion:reduceMotion,preferredTier:preference
  });
  let quality = mapProfile(8192).tier;
  window.__coiWorldGraphicsQuality = quality;

  let renderer = null;
  let scene = null;
  let camera = null;
  let resizeObserver = null;
  let sceneVisibilityObserver = null;
  let visibilityChangeHandler = null;
  let resizeHandler = null;
  let frame = 0;
  let disposed = false;
  let contextLost = false;
  let sceneInViewport = true;
  let worldState = null;
  let activeMarches = [];
  let homeCastleGroup = null;
  let projectionButtons = new Map();
  let lastFrameTime = 0;
  let lastFpsCheck = 0;
  let fpsSamples = [];
  let qualityDowngraded = false;
  let valhallaModeActive = window.__COI_VALHALLA_ACTIVE === true;
  let valhallaAuroraLight = null;
  let worldHemisphereLight = null;
  let worldSunLight = null;

  function setValhallaMode(active) {
    valhallaModeActive = Boolean(active);
    if (!scene) return;
    scene.background = new THREE.Color(valhallaModeActive ? 0x0a0510 : 0x355d69);
    scene.fog = valhallaModeActive
      ? new THREE.FogExp2(0x1a0f25, 0.0025)
      : new THREE.Fog(0x355d69, 78, 155);
    if (worldHemisphereLight) worldHemisphereLight.intensity = valhallaModeActive ? 1.05 : 2.05;
    if (worldSunLight) worldSunLight.intensity = valhallaModeActive ? 1.35 : 2.6;
    if (valhallaAuroraLight) {
      scene.remove(valhallaAuroraLight);
      valhallaAuroraLight = null;
    }
    if (valhallaModeActive) {
      valhallaAuroraLight = new THREE.DirectionalLight(0x9b59b6, 0.75);
      valhallaAuroraLight.position.set(22, 48, -38);
      scene.add(valhallaAuroraLight);
    }
  }
  window.addEventListener("coi:valhalla-mode", event => {
    setValhallaMode(event.detail?.active === true);
  });

  const worldRoot = new THREE.Group();
  const terrainRoot = new THREE.Group();
  const routeRoot = new THREE.Group();
  const territoryRoot = new THREE.Group();
  const armyRoot = new THREE.Group();
  const shared = {
    grass: new THREE.MeshStandardMaterial({ color: 0x668b4f, roughness: 1 }),
    grassLight: new THREE.MeshStandardMaterial({ color: 0x8eaa62, roughness: 1 }),
    forest: new THREE.MeshStandardMaterial({ color: 0x315f43, roughness: 1 }),
    forestLight: new THREE.MeshStandardMaterial({ color: 0x47764e, roughness: 1 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x735038, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x89918e, roughness: .94 }),
    stoneLight: new THREE.MeshStandardMaterial({ color: 0xb4b9a8, roughness: .9 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x395d84, roughness: .78 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe7bd68, metalness: .28, roughness: .5 }),
    banner: new THREE.MeshStandardMaterial({ color: 0x285f9b, roughness: .72 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0x9d3939, roughness: .75 }),
    neutral: new THREE.MeshStandardMaterial({ color: 0xc28b39, roughness: .75 }),
    road: new THREE.MeshStandardMaterial({ color: 0xb99c6b, roughness: 1 }),
    roadEdge: new THREE.MeshStandardMaterial({ color: 0x5d513d, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x315f78, roughness: .32, metalness: .04 }),
    food: new THREE.MeshStandardMaterial({ color: 0x97ad4c, roughness: .9 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x806044, roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x879da6, metalness: .35, roughness: .65 }),
    blueTroop: new THREE.MeshStandardMaterial({ color: 0x2c70ab, roughness: .7 }),
    redTroop: new THREE.MeshStandardMaterial({ color: 0xa83d3d, roughness: .7 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x57402f, roughness: 1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd9ad82, roughness: .9 }),
    spear: new THREE.MeshStandardMaterial({ color: 0x9ca9a5, metalness: .38, roughness: .55 })
  };
  const castleSkinMaterials = {
    1:{wall:new THREE.MeshStandardMaterial({color:0xc7a86f,roughness:.88}),wallLight:new THREE.MeshStandardMaterial({color:0xead5a3,roughness:.82}),roof:new THREE.MeshStandardMaterial({color:0x9b6627,roughness:.7}),banner:new THREE.MeshStandardMaterial({color:0x8d401f,roughness:.78}),accent:new THREE.MeshStandardMaterial({color:0xf1d078,metalness:.25,roughness:.48})},
    2:{wall:new THREE.MeshStandardMaterial({color:0xd2d0c5,roughness:.88}),wallLight:new THREE.MeshStandardMaterial({color:0xf1ead4,roughness:.82}),roof:new THREE.MeshStandardMaterial({color:0x264d77,roughness:.7}),banner:new THREE.MeshStandardMaterial({color:0x17385f,roughness:.78}),accent:new THREE.MeshStandardMaterial({color:0xe4bd68,metalness:.25,roughness:.48})},
    3:{wall:new THREE.MeshStandardMaterial({color:0x887767,roughness:.9}),wallLight:new THREE.MeshStandardMaterial({color:0xb69b75,roughness:.82}),roof:new THREE.MeshStandardMaterial({color:0x5a3828,roughness:.72}),banner:new THREE.MeshStandardMaterial({color:0x5a2724,roughness:.78}),accent:new THREE.MeshStandardMaterial({color:0xc6a15d,metalness:.25,roughness:.5})},
    4:{wall:new THREE.MeshStandardMaterial({color:0xaaa2c8,roughness:.86}),wallLight:new THREE.MeshStandardMaterial({color:0xd8cbed,roughness:.8}),roof:new THREE.MeshStandardMaterial({color:0x5a4b8c,roughness:.7}),banner:new THREE.MeshStandardMaterial({color:0x342d6f,roughness:.78}),accent:new THREE.MeshStandardMaterial({color:0xe2caef,metalness:.22,roughness:.5})},
    5:{wall:new THREE.MeshStandardMaterial({color:0x9fb8ca,roughness:.88}),wallLight:new THREE.MeshStandardMaterial({color:0xd9e8ee,roughness:.8}),roof:new THREE.MeshStandardMaterial({color:0x3e6b91,roughness:.7}),banner:new THREE.MeshStandardMaterial({color:0x264869,roughness:.78}),accent:new THREE.MeshStandardMaterial({color:0xc2e1ec,metalness:.22,roughness:.5})},
    6:{wall:new THREE.MeshStandardMaterial({color:0xd29b65,roughness:.88}),wallLight:new THREE.MeshStandardMaterial({color:0xf2c68a,roughness:.8}),roof:new THREE.MeshStandardMaterial({color:0x9e3d27,roughness:.7}),banner:new THREE.MeshStandardMaterial({color:0x7c241f,roughness:.78}),accent:new THREE.MeshStandardMaterial({color:0xf5cf63,metalness:.28,roughness:.46})}
  };


  function seeded(seed) {
    let value = (Number(seed) || 1) >>> 0;
    return () => {
      value = (Math.imul(value ^ (value >>> 15), 1 | value) + 0x6d2b79f5) | 0;
      let out = value;
      out = Math.imul(out ^ (out >>> 7), 61 | out);
      return ((out ^ (out >>> 14)) >>> 0) / 4294967296;
    };
  }

  function terrainHeight(x, z) {
    return Math.sin(x * .095) * .48 + Math.cos(z * .13) * .34
      + Math.sin((x + z) * .055) * .28 + Math.cos((x - z) * .035) * .22;
  }

  function makeMesh(geometry, material, parent, x, y, z) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.castShadow = quality !== "low";
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }

  function box(parent, width, height, depth, material, x, y, z) {
    return makeMesh(new THREE.BoxGeometry(width, height, depth), material, parent, x, y, z);
  }

  function cone(parent, radius, height, material, x, y, z, sides = 5) {
    return makeMesh(new THREE.ConeGeometry(radius, height, sides), material, parent, x, y, z);
  }

  // One instanced batch per tree component/material instead of three draw calls
  // per tree. Keep terrain positions deterministic and do not add GPU animations.
  function addInstancedForest(parent, positions) {
    if (!positions.length) return;
    const trunkGeo = new THREE.CylinderGeometry(.13, .18, .85, 5);
    const crownGeo = new THREE.ConeGeometry(.72, 1.35, 6);
    const crownTopGeo = new THREE.ConeGeometry(.48, .95, 6);
    const lightCount = positions.filter((p) => p.variant % 2 === 1).length;
    const darkCount = positions.length - lightCount;
    const trunks = new THREE.InstancedMesh(trunkGeo, shared.trunk, positions.length);
    const tops = new THREE.InstancedMesh(crownTopGeo, shared.forest, positions.length);
    const darkCrowns = darkCount ? new THREE.InstancedMesh(crownGeo, shared.forest, darkCount) : null;
    const lightCrowns = lightCount ? new THREE.InstancedMesh(crownGeo, shared.forestLight, lightCount) : null;
    const dummy = new THREE.Object3D();
    let dark = 0, light = 0;
    for (let i = 0; i < positions.length; i++) {
      const { x, z, scale, variant } = positions[i];
      const y = terrainHeight(x, z);
      dummy.scale.setScalar(scale);
      dummy.position.set(x, y + .4 * scale, z);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 1.86 * scale;
      dummy.updateMatrix();
      tops.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 1.2 * scale;
      dummy.updateMatrix();
      if (variant % 2) lightCrowns.setMatrixAt(light++, dummy.matrix);
      else darkCrowns.setMatrixAt(dark++, dummy.matrix);
    }
    for (const batch of [trunks, tops, darkCrowns, lightCrowns]) {
      if (!batch) continue;
      batch.instanceMatrix.needsUpdate = true;
      batch.castShadow = quality !== "low";
      batch.receiveShadow = false;
      batch.computeBoundingSphere();
      parent.add(batch);
    }
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      child.traverse(node => {
        if (node.geometry) node.geometry.dispose();
      });
      group.remove(child);
    }
  }

  function createGround() {
    const geometry = new THREE.PlaneGeometry(112, 92, 56, 46);
    const positions = geometry.attributes.position;
    const colors = [];
    const greenA = new THREE.Color(0x658950);
    const greenB = new THREE.Color(0x8ca75e);
    const marsh = new THREE.Color(0x526f50);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = -positions.getY(i);
      const h = terrainHeight(x, z);
      positions.setZ(i, h);
      const edge = Math.pow(x / 56, 2) + Math.pow(z / 46, 2);
      const noise = (Math.sin(x * .31) + Math.cos(z * .27)) * .035;
      const color = edge > .9 ? marsh.clone() : (noise > 0 ? greenB.clone() : greenA.clone());
      color.multiplyScalar(1 - Math.max(0, edge - .58) * .23);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const ground = makeMesh(geometry, material, terrainRoot, 0, -.25, 0);
    ground.receiveShadow = true;

    const water = makeMesh(new THREE.PlaneGeometry(132, 112), shared.water, terrainRoot, 0, -1.2, 0);
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = false;

    // River and old trade roads establish a readable strategic landscape.
    const river = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-50, -.86, -22),
      new THREE.Vector3(-30, -.82, -10),
      new THREE.Vector3(-10, -.82, -14),
      new THREE.Vector3(12, -.82, -5),
      new THREE.Vector3(34, -.84, -13),
      new THREE.Vector3(52, -.86, -7)
    ]);
    makeMesh(new THREE.TubeGeometry(river, 48, .72, 7, false), shared.water, terrainRoot, 0, 0, 0);

    const random = seeded(27011);
    const treeCount = quality === "low" ? 38 : quality === "high" ? 105 : 68;
    const forestPositions = [];
    for (let i = 0; i < treeCount; i++) {
      const x = (random() - .5) * 96;
      const z = (random() - .5) * 72;
      // Keep the main roads and central settlement readable.
      if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
      if (Math.abs(z + 10) < 3 && x > -52 && x < 52) continue;
      forestPositions.push({ x, z, scale: .62 + random() * .58, variant: i });
    }
    addInstancedForest(terrainRoot, forestPositions);

    // A few ridges make the mountain belt visible even before a territory is selected.
    for (const [x, z, scale] of [[-42, -31, 1.5], [-30, 34, 1.25], [43, 28, 1.65], [47, -36, 1.15], [0, 37, .9]]) {
      const rock = cone(terrainRoot, 4.2 * scale, 7.2 * scale, shared.stone, x, terrainHeight(x, z) + 3.1 * scale, z, 5);
      rock.rotation.y = .35;
      const snow = cone(terrainRoot, 1.45 * scale, 2.4 * scale, shared.stoneLight, x, terrainHeight(x, z) + 6.2 * scale, z, 5);
      snow.rotation.y = .35;
    }
  }

  function makeTower(parent, x, z, height = 3, material = shared.stone) {
    const y = terrainHeight(x, z);
    box(parent, 1.1, height, 1.1, material, x, y + height / 2, z);
    box(parent, 1.35, .22, 1.35, shared.stoneLight, x, y + height, z);
    cone(parent, .92, 1.3, shared.roof, x, y + height + .75, z, 4);
    const pole = box(parent, .08, 1.45, .08, shared.gold, x + .24, y + height + 1.55, z);
    pole.castShadow = false;
    box(parent, .8, .42, .06, shared.banner, x + .61, y + height + 1.82, z);
  }

  function createCastle(parent, x, z, scale = 1, color = "home", skinId = 0) {
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x, z), z);
    group.scale.setScalar(scale);
    const theme=castleSkinMaterials[Number(skinId)]||null;
    const wall=theme?.wall||(color==="enemy"?shared.enemy:shared.stone);
    const wallLight=theme?.wallLight||shared.stoneLight;
    const roof=theme?.roof||shared.roof;
    const banner=theme?.banner||(color==="enemy"?shared.enemy:shared.banner);
    const accent=theme?.accent||shared.gold;
    box(group,5.6,1.35,4.5,wall,0,.76,0);
    box(group,3.2,2.8,3.1,wallLight,0,2.55,0);
    box(group,1.15,1.9,.18,shared.wood,0,1.1,1.64);
    for(const [tx,tz] of [[-2.5,-1.9],[2.5,-1.9],[-2.5,1.9],[2.5,1.9]]){
      const tower=new THREE.Group();tower.position.set(tx,0,tz);group.add(tower);
      box(tower,1.25,2.6,1.25,wall,0,1.3,0);
      box(tower,1.42,.2,1.42,wallLight,0,2.65,0);
      cone(tower,1.05,1.45,roof,0,3.45,0,4);
    }
    cone(group,1.8,1.25,roof,0,4.55,0,4);
    box(group,.08,1.85,.08,accent,.55,5.45,0);
    box(group,1.0,.48,.07,banner,1.02,5.83,0);
    parent.add(group);
    return group;
  }

  function createRoyalThrone(parent,x,z,shielded){
    // Original low-poly model made from procedural geometry. No downloads/GLB.
    const group=new THREE.Group();
    group.position.set(x,terrainHeight(x,z)+.2,z);
    makeMesh(new THREE.CylinderGeometry(4.2,4.6,.48,8),shared.stone,group,0,.1,0);
    makeMesh(new THREE.CylinderGeometry(3.2,3.6,.38,8),shared.stoneLight,group,0,.5,0);
    box(group,2.5,.55,2.1,shared.gold,0,1.1,0);
    box(group,1.7,2.6,.45,shared.stone,0,2.45,-.84);
    box(group,1.95,.28,.62,shared.gold,0,3.9,-.84);
    box(group,.5,1.5,.45,shared.gold,-1.35,2.0,-.66);
    box(group,.5,1.5,.45,shared.gold,1.35,2.0,-.66);
    for(const dx of [-1.1,0,1.1]){
      cone(group,.44,.75,shared.gold,dx,4.45,-.84,4);
    }
    for(const dx of [-3.8,3.8]){
      makeTower(group,dx,2.6,3,shared.stone);
    }
    if(shielded){
      const halo=makeMesh(new THREE.TorusGeometry(4.6,.13,7,38),
        shared.blueTroop,group,0,2.0,0);
      halo.rotation.x=Math.PI/2;
      halo.castShadow=false;
    }
    parent.add(group);
    return group;
  }

  function createMine(parent, x, z, resource) {
    const material = resource === "iron" ? shared.iron : resource === "stone" ? shared.stoneLight : resource === "food" ? shared.food : shared.wood;
    const y = terrainHeight(x, z);
    box(parent, 2.5, 1.55, 2.1, shared.wood, x, y + .78, z);
    cone(parent, 1.9, .9, shared.roof, x, y + 1.95, z, 4);
    box(parent, .65, 1.05, .12, material, x + .5, y + .62, z + 1.1);
  }

  function createTerritoryFeature(parent, territory) {
    const x = Number(territory.x) || 0;
    const z = Number(territory.z) || 0;
    const y = terrainHeight(x, z);
    const ownId = Number(worldState?.kingdomId || 0);
    const ownerId = Number(territory.owner_kingdom_id || 0);
    const ownership = ownerId && ownId && ownerId === ownId ? "owned" : ownerId ? "enemy" : "neutral";
    const padMaterial = ownership === "owned" ? shared.banner : ownership === "enemy" ? shared.enemy : shared.neutral;
    const pad = makeMesh(new THREE.CylinderGeometry(2.65, 2.9, .32, 6), padMaterial, parent, x, y + .12, z);
    pad.rotation.y = Math.PI / 6;
    const inset = makeMesh(new THREE.CylinderGeometry(2.1, 2.2, .12, 6), shared.stoneLight, parent, x, y + .31, z);
    inset.rotation.y = Math.PI / 6;

    if (territory.territory_kind === "throne") {
      createRoyalThrone(parent,x,z,worldState?.throneShielded===true);
      return;
    }
    if (territory.territory_kind === "castle") {
      createCastle(parent, x, z, ownership === "enemy" ? .92 : 1.1, ownership === "enemy" ? "enemy" : "home", territory.castle_skin_id);
      return;
    }

    if (territory.terrain === "mountain") {
      for (let i = 0; i < 3; i++) {
        const rockX = x - .9 + i * .9;
        const rockZ = z + (i % 2 ? .6 : -.45);
        cone(parent, .72 + i * .09, 1.55 + i * .25, shared.stone, rockX, y + 1.1 + i * .1, rockZ, 5);
      }
    } else if (territory.terrain === "forest") {
      addTree(parent, x - .9, z - .1, .74, 2);
      addTree(parent, x + .95, z + .45, .68, 3);
      addTree(parent, x, z - 1.05, .62, 4);
    } else {
      box(parent, 1.25, .58, 1.15, shared.food, x, y + .78, z);
      cone(parent, .9, .55, shared.roof, x, y + 1.32, z, 4);
    }

    if (territory.resource_type === "iron" || territory.resource_type === "stone" || territory.resource_type === "wood") {
      createMine(parent, x + 1.55, z + .8, territory.resource_type);
    }
    if (ownership === "owned" || ownership === "enemy") {
      makeTower(parent, x - 1.35, z - 1.15, 2.4, ownership === "enemy" ? shared.enemy : shared.stone);
    }
  }

  function rebuildTerritories() {
    clearGroup(territoryRoot);
    const rows = Array.isArray(worldState?.territories) ? worldState.territories : [];
    for (const territory of rows) createTerritoryFeature(territoryRoot, territory);
  }

  function marchPath(target,arrivalHeight=.35){
    const home=homeCastleGroup?.position;
    const sx=home?.x||0,sz=home?.z||0,x=Number(target.x)||0,z=Number(target.z)||0;
    const mx=sx+(x-sx)*.44,mz=sz+(z-sz)*.44;
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx,terrainHeight(sx,sz)+.15,sz),
      new THREE.Vector3(mx,Math.max(1.55,terrainHeight(mx,mz)+.85),mz),
      new THREE.Vector3(x,terrainHeight(x,z)+arrivalHeight,z)
    );
  }
  function rebuildRoads() {
    clearGroup(routeRoot);
    const territories = Array.isArray(worldState?.territories) ? worldState.territories : [];
    for (const territory of territories) {
      const curve = marchPath(territory,.12);
      makeMesh(new THREE.TubeGeometry(curve, 18, .14, 5, false), shared.roadEdge, routeRoot, 0, 0, 0);
      makeMesh(new THREE.TubeGeometry(curve, 18, .075, 5, false), shared.road, routeRoot, 0, .06, 0);
    }
  }

  function createSoldier(parent, material, x, z, variant = 0) {
    const soldier = new THREE.Group();
    soldier.position.set(x, .1, z);
    const body = makeMesh(new THREE.CylinderGeometry(.22, .27, .78, 6), material, soldier, 0, .57, 0);
    body.castShadow = quality !== "low";
    makeMesh(new THREE.SphereGeometry(.19, 7, 6), shared.skin, soldier, 0, 1.12, 0);
    cone(soldier, .25, .32, shared.gold, 0, 1.34, 0, 5);
    box(soldier, .38, .43, .12, shared.leather, variant % 2 ? -.28 : .28, .6, .04);
    const spear = makeMesh(new THREE.CylinderGeometry(.025, .035, 1.35, 5), shared.wood, soldier, .3, 1.14, -.08);
    spear.rotation.z = -.16;
    cone(soldier, .085, .24, shared.spear, .3, 1.85, -.08, 4);
    return soldier;
  }

  function createMarchFormation(march) {
    const group = new THREE.Group();
    const material = march.march_type === "attack" ? shared.redTroop : shared.blueTroop;
    const soldiers=[
      createSoldier(group, material, -.42, -.28, 0),
      createSoldier(group, material, .42, -.28, 1),
      createSoldier(group, material, 0, .48, 2)
    ];
    const flagPole = box(group, .07, 1.45, .07, shared.gold, 0, 1.25, -.72);
    flagPole.castShadow = false;
    const flag=box(group, .67, .35, .06, material, .3, 1.73, -.72);
    group.scale.setScalar(.9);
    armyRoot.add(group);
    return {
      id: Number(march.id),
      group,
      startAt: Date.parse(march.started_at || ""),
      endAt: Date.parse(march.arrives_at || ""),
      targetId: Number(march.target_territory_id),
      marchType: march.march_type,
      soldiers, flag, curve:null, point:new THREE.Vector3(), tangent:new THREE.Vector3()
    };
  }

  function rebuildMarches() {
    clearGroup(armyRoot);
    activeMarches = [];
    const rows = (Array.isArray(worldState?.marches) ? worldState.marches : [])
      .filter(march => march.status === "marching" && Number.isFinite(Date.parse(march.arrives_at || "")));
    for (const march of rows.slice(0, 8)) activeMarches.push(createMarchFormation(march));
    updateMarchPositions(Date.now());
    animateMarches();
  }

  function updateMarchPositions(now) {
    const territories = new Map((worldState?.territories || []).map(item => [Number(item.id), item]));
    for (const march of activeMarches) {
      const target = territories.get(march.targetId);
      if (!target) continue;
      const start = Number.isFinite(march.startAt) ? march.startAt : now;
      const end = Number.isFinite(march.endAt) ? march.endAt : now + 1000;
      const progress = THREE.MathUtils.clamp((now - start) / Math.max(1000, end - start), 0, 1);
      // Curves and scratch vectors live for the state snapshot, not per frame.
      if(!march.curve)march.curve=marchPath(target);
      march.curve.getPoint(progress,march.point);
      march.curve.getTangent(progress,march.tangent);
      march.group.position.copy(march.point);
      if(Math.hypot(march.tangent.x,march.tangent.z)>.0001)march.group.rotation.y=Math.atan2(march.tangent.x,march.tangent.z);
      const moving=!reduceMotion&&quality!=="low"&&progress>0&&progress<1;
      const t=(now%60000)*.009+march.id;
      for(let i=0;i<march.soldiers.length;i++){
        const soldier=march.soldiers[i];
        soldier.position.y=.1+(moving?Math.sin(t+i*2.1)*.045:0);
        soldier.rotation.x=moving?Math.sin(t+i*2.1)*.055:0;
      }
      march.flag.rotation.y=moving?Math.sin(t*.46)*.16:0;
    }
  }

  function projectTerritories() {
    if (!camera || !renderer || !worldState) return;
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    const rows = Array.isArray(worldState.territories) ? worldState.territories : [];
    for (const territory of rows) {
      const button = projectionButtons.get(Number(territory.id));
      if (!button) continue;
      const point = new THREE.Vector3(
        Number(territory.x) || 0,
        terrainHeight(Number(territory.x) || 0, Number(territory.z) || 0) + 2.45,
        Number(territory.z) || 0
      ).project(camera);
      button.style.left = ((point.x * .5 + .5) * width) + "px";
      button.style.top = ((-point.y * .5 + .5) * height) + "px";
    }
  }

  function draw() {
    if (disposed || !renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    projectTerritories();
  }

  function canAnimateMarches() {
    return !disposed && !contextLost && !reduceMotion && !document.hidden && sceneInViewport;
  }

  function stopMarchAnimation() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrameTime = 0;
    lastFpsCheck = 0;
    fpsSamples = [];
  }

  function checkAndDowngradeQuality(timestamp) {
    if (qualityDowngraded || quality === "low" || !renderer) return;
    if (!lastFpsCheck) lastFpsCheck = timestamp;
    // With extremely low FPS, allow the sample window to exceed three seconds.
    // Otherwise a 5-FPS device would never accumulate the minimum 20 samples.
    if (timestamp - lastFpsCheck < 3000 || fpsSamples.length < 20) return;
    lastFpsCheck = timestamp;
    const samples = fpsSamples;
    fpsSamples = [];
    const avg = samples.reduce((total, fps) => total + fps, 0) / samples.length;
    if (avg >= 22) return;

    // A visual-only update would not improve FPS: actually lower GPU work.
    quality = "low";
    qualityDowngraded = true;
    window.__coiWorldGraphicsQuality = "low";
    renderer.shadowMap.enabled = false;
    if (worldSunLight) worldSunLight.castShadow = false;
    worldRoot.traverse(object => { if ("castShadow" in object) object.castShadow = false; });
    resize(); // Reapplies the low-end pixel budget and ratio cap.
    console.warn("Clash of Izzy: qualidade reduzida para low (FPS médio: " + avg.toFixed(1) + ").");
    window.dispatchEvent(new CustomEvent("coi:quality-downgraded", { detail: { avg } }));
  }

  function syncMarchAnimation() {
    if (canAnimateMarches() && activeMarches.some(march => Date.now() < march.endAt)) animateMarches();
    else stopMarchAnimation();
  }

  function animateMarches() {
    if (frame || !canAnimateMarches() || !activeMarches.length) return;
    lastFrameTime = 0;
    const tick = timestamp => {
      frame = 0;
      if (!canAnimateMarches() || !renderer || !scene) return;
      // Only measure continuous, visible march frames; exclude tab resumption gaps.
      if (lastFrameTime > 0) {
        const delta = timestamp - lastFrameTime;
        if (delta >= 8 && delta <= 1000) {
          fpsSamples.push(1000 / delta);
          if (fpsSamples.length > 60) fpsSamples.shift();
        }
      }
      lastFrameTime = timestamp;
      checkAndDowngradeQuality(timestamp);
      const now = Date.now();
      updateMarchPositions(now);
      renderer.render(scene, camera);
      // Territory anchors are static during march animation. draw(), resize()
      // and camera/state updates already project them when their positions change.
      if (activeMarches.some(march => now < march.endAt) && canAnimateMarches()) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
  }

  function setWorldState(nextState) {
    if (!nextState || !Array.isArray(nextState.territories)) return;
    worldState = nextState;
    if(homeCastleGroup){
      terrainRoot.remove(homeCastleGroup);
      homeCastleGroup.traverse(node=>{if(node.geometry)node.geometry.dispose();});
    }
    // Visual-only offset keeps the central Throne clear; D1 castle coordinates stay unchanged.
    const hasThrone=worldState.territories.some(row=>row.territory_kind==="throne");
    if(hasThrone){
      homeCastleGroup=createCastle(terrainRoot,13,-11,1.4,"home",Number(worldState.castleSkinId)||0);
    }else{
      homeCastleGroup=createCastle(terrainRoot,0,0,1.4,"home",Number(worldState.castleSkinId)||0);
    }
    rebuildTerritories();
    rebuildRoads();
    rebuildMarches();
    draw();
  }

  function resize() {
    if (!renderer || !camera || !host.clientWidth || !host.clientHeight) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const aspect = width / height;
    const viewHeight = 94;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    const maxPixelCount = quality === "high" ? 3200000 : quality === "balanced" ? 1800000 : 1000000;
    const pixelBudgetRatio = Math.sqrt(maxPixelCount / (width * height));
    const profileRatioCap = quality === "high" ? 1.5 : quality === "balanced" ? 1.15 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profileRatioCap, pixelBudgetRatio));
    renderer.setSize(width, height, false);
    draw();
  }

  function dispose() {
    disposed = true;
    stopMarchAnimation();
    resizeObserver?.disconnect();
    sceneVisibilityObserver?.disconnect();
    if (visibilityChangeHandler) document.removeEventListener("visibilitychange", visibilityChangeHandler);
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    // Release geometry buffers of the scene on page navigation; all batches are
    // shared by the same renderer and must be disposed only once.
    const geometries = new Set();
    worldRoot.traverse(node => { if (node.geometry) geometries.add(node.geometry); });
    for (const geometry of geometries) geometry.dispose();
    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    }
    Object.values(shared).forEach(material => material.dispose());
    Object.values(castleSkinMaterials).forEach(theme => Object.values(theme).forEach(material => material.dispose()));
  }

  function init() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: quality !== "low",
        powerPreference: preference === "high" ? "high-performance" : "default",
        stencil: false,
        depth: true
      });
      quality = mapProfile(renderer.capabilities.maxTextureSize).tier;
      window.__coiWorldGraphicsQuality = quality;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = quality !== "low";
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.6 : 1.15));
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x355d69);
      scene.fog = new THREE.Fog(0x355d69, 78, 155);
      camera = new THREE.OrthographicCamera(-56, 56, 47, -47, .1, 220);
      camera.position.set(58, 78, 62);
      camera.lookAt(0, 0, 0);
      worldHemisphereLight = new THREE.HemisphereLight(0xe8f0d7, 0x43513e, 2.05);
      scene.add(worldHemisphereLight);
      worldSunLight = new THREE.DirectionalLight(0xffe0a4, 2.6);
      worldSunLight.position.set(-35, 62, 32);
      worldSunLight.castShadow = quality !== "low";
      if (worldSunLight.castShadow) worldSunLight.shadow.mapSize.set(quality === "high" ? 1024 : 512, quality === "high" ? 1024 : 512);
      scene.add(worldSunLight);
      setValhallaMode(valhallaModeActive);
      scene.add(worldRoot);
      worldRoot.add(terrainRoot, routeRoot, territoryRoot, armyRoot);
      createGround();
      homeCastleGroup=createCastle(terrainRoot,0,0,1.4,"home",Number(window.__coiWorldMapState?.castleSkinId)||0);
      resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(host);
      resizeHandler = resize;
      window.addEventListener("resize", resizeHandler, { passive: true });
      visibilityChangeHandler = syncMarchAnimation;
      document.addEventListener("visibilitychange", visibilityChangeHandler);
      if ("IntersectionObserver" in window) {
        sceneVisibilityObserver = new IntersectionObserver(entries => {
          const entry = entries[entries.length - 1];
          sceneInViewport = entry?.isIntersecting === true;
          syncMarchAnimation();
        }, { threshold: 0.01 });
        sceneVisibilityObserver.observe(host);
      }
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        contextLost = true;
        stopMarchAnimation();
        canvas.hidden = true;
        host.classList.add("map-3d-fallback");
        console.warn("Clash of Izzy: WebGL do mapa indisponível; marcadores táticos continuam ativos.");
      }, { once: true });
      resize();
      window.__coiWorldMap3D = {
        update: setWorldState,
        setValhallaMode,
        setProjectionButtons(buttons) {
          projectionButtons = buttons instanceof Map ? buttons : new Map();
          projectTerritories();
        },
        project: projectTerritories
      };
      window.dispatchEvent(new CustomEvent("coi:world-map-3d-ready"));
      if (window.__coiWorldMapState) setWorldState(window.__coiWorldMapState);
      if (window.__coiWorldMapButtons) projectionButtons = window.__coiWorldMapButtons;
      projectTerritories();
      window.addEventListener("pagehide", event => {
        if (!event.persisted) dispose();
      });
      window.addEventListener("pageshow", event => {
        if (event.persisted && !disposed) {
          resize();
          draw();
          syncMarchAnimation();
        }
      });
    } catch (error) {
      canvas.hidden = true;
      host.classList.add("map-3d-fallback");
      console.warn("Clash of Izzy: mapa 3D não pôde iniciar; mantendo mapa tático acessível.", error);
    }
  }

  init();
})();
