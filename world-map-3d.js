import {createWorldMonsterLayer} from "./scripts/world-monster-models.js";
import { castleSkinPalettes } from "./scripts/castle-skin-visuals.js";
import {worldTerrainHeight,worldTerrainBlend,worldRiverDistance,worldRiverRibbon} from "./scripts/world-map-terrain.js";
import * as THREE from "three";
import { readGraphicsChoice } from "./scripts/kingdom-visual-preferences.js";
import { selectKingdomQualityProfile } from "./scripts/kingdom-quality.js";
import { marchTimestamp, marchVisualProgress, marchVisualPoint, planMarchFormation, planMarchRepresentatives } from "./scripts/march-visual-path.js";
import { worldVisualKeys, worldCastleTier, throneVisualState } from "./scripts/world-map-visual-state.js";

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
  let visualKeys = null;
  let territoryLookup = new Map();
  const visualRebuilds = { home:0, features:0, routes:0, marches:0 };
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
  const valhallaModeHandler = event => {
    if (!disposed && !contextLost) setValhallaMode(event.detail?.active === true);
  };
  window.addEventListener("coi:valhalla-mode", valhallaModeHandler);

  const worldRoot = new THREE.Group();
  const terrainRoot = new THREE.Group();
  const routeRoot = new THREE.Group();
  const territoryRoot = new THREE.Group();
  const armyRoot = new THREE.Group();
  const monsterLayer=createWorldMonsterLayer(THREE,worldRoot,terrainHeight);
  const shared = {
    terrainGround: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    riverBank: new THREE.MeshStandardMaterial({ color: 0x9a9370, roughness: 1 }),
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
  const castleSkinMaterials = Object.fromEntries(
    Object.entries(castleSkinPalettes).map(([id, palette]) => [id, {
      wall: new THREE.MeshStandardMaterial({ color: palette.wall, roughness: .88 }),
      wallLight: new THREE.MeshStandardMaterial({ color: palette.stone, roughness: .82 }),
      roof: new THREE.MeshStandardMaterial({ color: palette.roof, roughness: .7 }),
      banner: new THREE.MeshStandardMaterial({ color: palette.banner, roughness: .78 }),
      accent: new THREE.MeshStandardMaterial({ color: palette.accent, metalness: .25, roughness: .48 })
    }])
  );


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
    return worldTerrainHeight(x,z);
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
        if (node.isInstancedMesh) node.dispose();
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
    const bank = new THREE.Color(0x9a9370),color=new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = -positions.getY(i);
      const h = terrainHeight(x, z);
      positions.setZ(i, h);
      const blend=worldTerrainBlend(x,z);
      color.copy(greenA).lerp(greenB,blend.meadow).lerp(marsh,blend.edge*.78).lerp(bank,blend.bank*.65);
      color.multiplyScalar(1-blend.edge*.12);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    const ground = makeMesh(geometry, shared.terrainGround, terrainRoot, 0, -.25, 0);
    ground.receiveShadow = true;

    const water = makeMesh(new THREE.PlaneGeometry(132, 112), shared.water, terrainRoot, 0, -1.2, 0);
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = false;

    // Two terrain-conforming ribbons instead of a buried fixed-height tube.
    // Road surfaces stay above the water; all march coordinates are unchanged.
    const segments=quality==="low"?48:96;
    for(const [width,offset,material] of [[1.45,-.13,shared.riverBank],[.82,-.045,shared.water]]){
      const ribbon=worldRiverRibbon({segments,halfWidth:width,offset});
      const meshGeometry=new THREE.BufferGeometry();
      meshGeometry.setAttribute("position",new THREE.Float32BufferAttribute(ribbon.positions,3));
      meshGeometry.setIndex(ribbon.indices);meshGeometry.computeVertexNormals();
      const surface=makeMesh(meshGeometry,material,terrainRoot,0,0,0);
      surface.castShadow=false;surface.receiveShadow=true;
    }

    const random = seeded(27011);
    const treeCount = quality === "low" ? 38 : quality === "high" ? 105 : 68;
    const forestPositions = [];
    for (let i = 0; i < treeCount; i++) {
      // Alternate scattered trees and compact woodland clusters at fixed locations.
      const clusters=[[-36,-26],[-29,20],[28,25],[36,-25],[-12,31]];
      const center=clusters[i%clusters.length],clustered=i%3!==0;
      const x=clustered?center[0]+(random()-.5)*15:(random()-.5)*96;
      const z=clustered?center[1]+(random()-.5)*12:(random()-.5)*72;
      if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
      if (worldRiverDistance(x,z)<3) continue;
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

  // One draw call for repeated stonework per material, even at the highest tier.
  function castleStonework(parent, material, pieces) {
    if(!pieces.length)return;
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,pieces.length);
    const dummy=new THREE.Object3D();
    for(let i=0;i<pieces.length;i++){
      const [x,y,z,w,h,d]=pieces[i];
      dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    mesh.castShadow=quality!=="low";mesh.receiveShadow=true;
    parent.add(mesh);
  }

  function createCastle(parent, x, z, scale = 1, color = "home", skinId = 0, level = 1) {
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x, z), z);
    group.scale.setScalar(scale);
    const theme=castleSkinMaterials[Number(skinId)]||null;
    const wall=theme?.wall||(color==="enemy"?shared.enemy:shared.stone);
    const wallLight=theme?.wallLight||shared.stoneLight;
    const roof=theme?.roof||shared.roof;
    const banner=theme?.banner||(color==="enemy"?shared.enemy:shared.banner);
    const accent=theme?.accent||shared.gold;
    const tier=worldCastleTier(level);
    group.userData.coICastleTier=tier;
    const rise=(tier-1)*.48, towerRise=(tier-1)*.25;
    const stone=[],trim=[],slits=[];
    // A stepped foundation, curtain walls, gatehouse and a visibly taller keep.
    box(group,5.9,.32,4.8,wallLight,0,.16,0);
    box(group,5.6,1.45,4.5,wall,0,1.02,0);
    box(group,3.1,2.8+rise,2.7,wallLight,0,2.72+rise/2,-.23);
    box(group,3.35,.22,2.96,wall,0,4.2+rise,-.23);
    box(group,1.52,1.65,.64,wallLight,0,1.12,2.27);
    box(group,1.03,1.26,.15,shared.leather,0,.85,2.64);
    box(group,1.2,.19,.22,accent,0,1.55,2.65);
    for(const [tx,tz] of [[-2.5,-1.9],[2.5,-1.9],[-2.5,1.9],[2.5,1.9]]){
      const tower=new THREE.Group();tower.position.set(tx,0,tz);group.add(tower);
      box(tower,1.28,2.7+towerRise,1.28,wall,0,1.35+towerRise/2,0);
      box(tower,1.48,.23,1.48,wallLight,0,2.72+towerRise,0);
      cone(tower,1.08,1.45+towerRise*.2,roof,0,3.55+towerRise,4);
      slits.push([tx,1.96+towerRise,tz+.65,.16,.45,.045]);
      if(quality!=="low"){
        trim.push([tx, .55,tz,1.40,.13,1.40],[tx,1.38,tz,1.33,.10,1.33]);
      }
    }
    // Curtain-wall merlons leave a clear opening over the gatehouse.
    for(const bx of [-1.62,-.95,.95,1.62]){
      stone.push([bx,1.9,2.1,.38,.38,.34],[bx,1.9,-2.1,.38,.38,.34]);
    }
    for(const bz of [-.9,0,.9])stone.push([-2.68,1.9,bz,.34,.38,.38],[2.68,1.9,bz,.34,.38,.38]);
    for(const bx of [-.92,0,.92])slits.push([bx,2.8+rise*.5,1.14,.19,.64,.05]);
    if(tier>=2){
      for(const bx of [-1.24,1.24])stone.push([bx,3.45+rise,1.15,.36,.66,.35]);
      trim.push([0,3.48+rise,1.16,2.7,.13,.16]);
    }
    if(tier>=3){
      // The upper tiers gain a separate raised hall and flanking spires.
      box(group,1.55,.66,1.58,wall,0,4.56+rise,-.23);
      for(const bx of [-1.05,1.05])cone(group,.55,1.18,roof,bx,4.82+rise,.55,4);
    }
    const roofY=4.99+rise+(tier>=3?.52:0);
    cone(group,1.78,1.42,roof,0,roofY,-.23,4);
    if(tier>=4){
      cone(group,.36,.9,accent,0,roofY+1.05,-.23,6);
      trim.push([0,2.15,2.58,1.7,.13,.15]);
    }
    castleStonework(group,wallLight,stone);
    castleStonework(group,wall,trim);
    castleStonework(group,shared.leather,slits);
    box(group,.08,1.45,.08,accent,.55,roofY+1.15,0);
    box(group,1.0,.48,.07,banner,1.02,roofY+1.49,0);
    // Keep an independent faction pennant: cosmetic colors never disguise ownership.
    box(group,.56,.24,.08,color==="enemy"?shared.enemy:shared.banner,.82,roofY+.97,0);
    parent.add(group);
    return group;
  }

  function createRoyalThrone(parent,x,z,visualState){
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
    if (visualState !== "idle") {
      const shielded = visualState === "shielded";
      const ringMaterial = shielded ? shared.blueTroop
        : visualState === "contest" ? shared.enemy : shared.gold;
      const halo=makeMesh(new THREE.TorusGeometry(4.6,.13,7,38),
        ringMaterial,group,0,shielded ? 2.0 : .39,0);
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

  function createTerritoryFeature(parent, territory, forestPositions) {
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
      createRoyalThrone(parent,x,z,throneVisualState(worldState));
      return;
    }
    if (territory.territory_kind === "castle") {
      createCastle(parent, x, z, ownership === "enemy" ? .92 : 1.1, ownership === "enemy" ? "enemy" : "home", territory.castle_skin_id, territory.castle_level ?? territory.level);
      return;
    }

    if (territory.terrain === "mountain") {
      for (let i = 0; i < 3; i++) {
        const rockX = x - .9 + i * .9;
        const rockZ = z + (i % 2 ? .6 : -.45);
        cone(parent, .72 + i * .09, 1.55 + i * .25, shared.stone, rockX, y + 1.1 + i * .1, rockZ, 5);
      }
    } else if (territory.terrain === "forest") {
      forestPositions.push(
        {x:x-.9,z:z-.1,scale:.74,variant:2},
        {x:x+.95,z:z+.45,scale:.68,variant:3},
        {x,z:z-1.05,scale:.62,variant:4}
      );
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
    const forestPositions = [];
    for (const territory of rows) createTerritoryFeature(territoryRoot, territory, forestPositions);
    addInstancedForest(territoryRoot, forestPositions);
  }

  function visualHome(){return {x:homeCastleGroup?.position.x??0,z:homeCastleGroup?.position.z??0};}

  function rebuildRoads() {
    clearGroup(routeRoot);
    const territories = Array.isArray(worldState?.territories) ? worldState.territories : [];
    for (const territory of territories) {
      const x = Number(territory.x) || 0;
      const z = Number(territory.z) || 0;
      const origin=visualHome();
      const points=Array.from({length:19},(_,i)=>{
        const p=marchVisualPoint(origin,{x,z},i/18);
        return new THREE.Vector3(p.x,terrainHeight(p.x,p.z)+.10,p.z);
      });
      const curve=new THREE.CatmullRomCurve3(points);
      makeMesh(new THREE.TubeGeometry(curve, 18, .14, 5, false), shared.roadEdge, routeRoot, 0, 0, 0);
      makeMesh(new THREE.TubeGeometry(curve, 18, .075, 5, false), shared.road, routeRoot, 0, .06, 0);
    }
  }

  function createSoldier(parent, material, x, z, variant = 0, type = "spearman") {
    const soldier = new THREE.Group();
    soldier.position.set(x, .1, z);
    soldier.userData.marchLegs=[];
    const siege=["catapult","ram","trebuchet"].includes(type);
    if(siege){
      box(soldier,.62,.23,.78,shared.wood,0,.22,0);
      for(const sx of [-.35,.35])for(const sz of [-.25,.25]){
        const wheel=makeMesh(new THREE.CylinderGeometry(.15,.15,.09,6),shared.leather,soldier,sx,.15,sz);
        wheel.rotation.z=Math.PI/2;
      }
      if(type==="ram")box(soldier,.24,.24,1.0,shared.spear,0,.48,.12);
      else {const arm=box(soldier,.12,.86,.12,shared.wood,0,.65,0);arm.rotation.x=-.6;box(soldier,.29,.17,.22,shared.spear,0,1,.28);}
      parent.add(soldier);return soldier;
    }
    const mounted=type==="cavalry"||type==="knight";
    if(mounted){
      box(soldier,.4,.36,.72,shared.leather,0,.31,0);
      box(soldier,.22,.3,.24,shared.leather,0,.55,.34);
      for(const sx of [-.13,.13])for(const sz of [-.24,.24])box(soldier,.09,.25,.09,shared.leather,sx,.13,sz);
    }
    const body = makeMesh(new THREE.CylinderGeometry(.22, .27, .78, 6), material, soldier, 0, .57, 0);
    body.castShadow = quality !== "low";
    makeMesh(new THREE.SphereGeometry(.19, 7, 6), shared.skin, soldier, 0, 1.12, 0);
    cone(soldier, .25, .32, shared.gold, 0, 1.34, 0, 5);
    box(soldier, .38, .43, .12, shared.leather, variant % 2 ? -.28 : .28, .6, .04);
    if(type==="archer"||type==="crossbowman"){
      const bow=makeMesh(new THREE.TorusGeometry(.22,.025,4,10,Math.PI),shared.wood,soldier,.31,.73,.12);
      bow.rotation.z=-Math.PI/2;
      if(type==="crossbowman")box(soldier,.1,.08,.38,shared.wood,.31,.73,.12);
    }else if(type==="mage"){
      box(soldier,.045,.98,.045,shared.wood,.31,.8,0);
      makeMesh(new THREE.OctahedronGeometry(.11),shared.gold,soldier,.31,1.33,0);
    }else if(type==="swordsman"||type==="militia"||type==="knight"){
      box(soldier,.08,.58,.035,shared.spear,.31,.91,0);
      box(soldier,.19,.045,.065,shared.gold,.31,.65,0);
    }else{
      const spear = makeMesh(new THREE.CylinderGeometry(.025,.035,1.35,5),shared.wood,soldier,.3,1.14,-.08);
      spear.rotation.z=-.16;
      cone(soldier,.085,.24,shared.spear,.3,1.85,-.08,4);
    }
    // Each soldier has a real parent; previous code allocated invisible meshes.
    const legs=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.115,.33,0);soldier.add(leg);
      box(leg,.13,.27,.14,shared.leather,0,-.12,0);
      box(leg,.16,.10,.24,shared.leather,0,-.27,.035);
      legs.push(leg);
    }
    soldier.userData.marchLegs=legs;
    parent.add(soldier);
    return soldier;
  }

  function createMarchFormation(march) {
    const group = new THREE.Group();
    const formation = planMarchFormation(march.march_type, quality);
    const material = formation.color === "red" ? shared.redTroop :
      formation.color === "green" ? shared.forest : formation.color === "gold" ? shared.neutral : shared.blueTroop;
    const representatives=planMarchRepresentatives(march.units_json,formation.positions.length);
    const positions=representatives.length?formation.positions.slice(0,representatives.length):formation.positions;
    const soldiers=positions.map(([x,z],index)=>createSoldier(group,material,x,z,index,representatives[index]||"spearman"));
    const flagPole = box(group, .07, 1.45, .07, shared.gold, 0, 1.25, -.72);
    flagPole.castShadow = false;
    box(group, .67, .35, .06, material, .3, 1.73, -.72);
    group.scale.setScalar(.9);
    armyRoot.add(group);
    return {
      id: Number(march.id),
      group,
      soldiers,
      startAt: marchTimestamp(march.started_at),
      endAt: marchTimestamp(march.arrives_at),
      targetId: Number(march.target_territory_id),
      monsterTarget: march.march_type==="hunt"?{x:march.monster_x,z:march.monster_z}:null
    };
  }

  function rebuildMarches() {
    clearGroup(armyRoot);
    activeMarches = [];
    const rows = (Array.isArray(worldState?.marches) ? worldState.marches : [])
      .filter(march => march.status === "marching" && Number.isFinite(marchTimestamp(march.arrives_at)));
    for (const march of rows.slice(0, 8)) activeMarches.push(createMarchFormation(march));
    updateMarchPositions(Date.now());
    animateMarches();
  }

  function updateMarchPositions(now) {
    for (const march of activeMarches) {
      const target = march.monsterTarget || territoryLookup.get(march.targetId);
      if (!target) continue;
      const progress=marchVisualProgress(now,march.startAt,march.endAt);
      const origin=visualHome();
      const point=marchVisualPoint(origin,{x:Number(target.x)||0,z:Number(target.z)||0},progress);
      march.group.position.set(point.x,terrainHeight(point.x,point.z)+.15,point.z);
      march.group.rotation.y=point.heading;
      const moving=!reduceMotion && quality!=="low" && progress>0 && progress<1;
      for(const [index,soldier] of march.soldiers.entries()){
        const phase=moving?Math.sin(now*.008+index*1.3):0;
        const legs=soldier.userData.marchLegs;
        if(legs.length===2){legs[0].rotation.x=phase*.38;legs[1].rotation.x=-phase*.38;}
      }
    }
  }

  // Read-only projection for independently managed map overlays (creatures).
  function projectMapPoint(x,z) {
    if (disposed || contextLost || !camera || !renderer) return null;
    const point = new THREE.Vector3(x,terrainHeight(x,z)+2.45,z).project(camera);
    if (!Number.isFinite(point.x)||!Number.isFinite(point.y)) return null;
    return {left:(point.x*.5+.5)*host.clientWidth,top:(-point.y*.5+.5)*host.clientHeight};
  }

  function projectTerritories() {
    if (disposed || contextLost || !camera || !renderer || !worldState) return;
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
    if (disposed || contextLost || !renderer || !scene || !camera) return;
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
    if (disposed || contextLost || !nextState || !Array.isArray(nextState.territories)) return;
    const keys = worldVisualKeys(nextState);
    const previous = visualKeys;
    worldState = nextState;
    territoryLookup = new Map(nextState.territories.map(item=>[Number(item.id),item]));
    if (keys.home !== previous?.home) {
      if(homeCastleGroup){
        terrainRoot.remove(homeCastleGroup);
        homeCastleGroup.traverse(node=>{if(node.isInstancedMesh)node.dispose();if(node.geometry)node.geometry.dispose();});
      }
      // Visual-only offset keeps the central Throne clear; D1 castle coordinates stay unchanged.
      const hasThrone=worldState.territories.some(row=>row.territory_kind==="throne");
      homeCastleGroup=createCastle(terrainRoot,hasThrone?13:0,hasThrone?-11:0,1.4,"home",Number(worldState.castleSkinId)||0,worldState.castleLevel);
      visualRebuilds.home++;
    }
    if(keys.features!==previous?.features){rebuildTerritories();visualRebuilds.features++;}
    if(keys.routes!==previous?.routes){rebuildRoads();visualRebuilds.routes++;}
    if(keys.marches!==previous?.marches){rebuildMarches();visualRebuilds.marches++;}
    else {updateMarchPositions(Date.now());syncMarchAnimation();}
    visualKeys=keys;
    draw();
  }

  function resize() {
    if (disposed || contextLost || !renderer || !camera || !host.clientWidth || !host.clientHeight) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const aspect = width / height;
    // The diagonal of the playable area must fit even on portrait screens.
    const viewWidth = Math.max(140, 94 * aspect);
    const viewHeight = viewWidth / aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    const maxPixelCount = quality === "high" ? 3200000 : quality === "balanced" ? 1800000 : 1000000;
    const pixelBudgetRatio = Math.sqrt(maxPixelCount / (width * height));
    const profileRatioCap = quality === "high" ? 1.5 : quality === "balanced" ? 1.15 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profileRatioCap, pixelBudgetRatio));
    renderer.setSize(width, height, false);
    draw();
    window.dispatchEvent(new CustomEvent("coi:world-map-projection-changed"));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("coi:valhalla-mode", valhallaModeHandler);
    stopMarchAnimation();
    resizeObserver?.disconnect();
    sceneVisibilityObserver?.disconnect();
    if (visibilityChangeHandler) document.removeEventListener("visibilitychange", visibilityChangeHandler);
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    monsterLayer.dispose();
    // Release geometry buffers of the scene on page navigation; all batches are
    // shared by the same renderer and must be disposed only once.
    const geometries = new Set();
    worldRoot.traverse(node => { if (node.isInstancedMesh) node.dispose(); if (node.geometry) geometries.add(node.geometry); });
    for (const geometry of geometries) geometry.dispose();
    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    }
    Object.values(shared).forEach(material => material.dispose());
    Object.values(castleSkinMaterials).forEach(theme => Object.values(theme).forEach(material => material.dispose()));
  }

  function activateMapFallback() {
    contextLost = true;
    host.classList.add("map-3d-fallback");
    canvas.hidden = true;
    delete window.__coiWorldMap3D;
    window.__coiWorldGraphicsQuality = "2d";
    // Disable the dead renderer before redrawing the tactical pins.
    try { dispose(); } finally {
      window.dispatchEvent(new CustomEvent("coi:world-map-2d-fallback"));
    }
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
      homeCastleGroup=createCastle(terrainRoot,0,0,1.4,"home",Number(window.__coiWorldMapState?.castleSkinId)||0,window.__coiWorldMapState?.castleLevel);
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
        activateMapFallback();
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
        project: projectTerritories,
        projectPoint: projectMapPoint,
        setMonsters(rows){if(!disposed&&!contextLost&&monsterLayer.update(rows))draw();},
        diagnostics: () => ({ rebuilds: {...visualRebuilds} })
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
      activateMapFallback();
      console.warn("Clash of Izzy: mapa 3D não pôde iniciar; mantendo mapa tático acessível.", error);
    }
  }

  init();
})();
