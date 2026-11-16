/* Lightweight ambient particles for the existing Three.js frame loop.
 * Usage: const fx = new AmbientParticles(scene, THREE);
 * on each existing frame: fx.animate(deltaSeconds). Never starts its own RAF.
 */
export class AmbientParticles {
  constructor(scene, THREE) {
    if (!scene?.isScene || !THREE?.BufferGeometry || !THREE?.Points) {
      throw new TypeError("AmbientParticles requer uma THREE.Scene e o namespace THREE.");
    }
    this.scene = scene;
    this.THREE = THREE;
    this.systems = [];
    this.disposed = false;
  }

  createSnowfall(count = 180, area = 240) {
    if (this.disposed) throw new Error("O sistema de partículas já foi descartado.");
    const THREE = this.THREE;
    const safeCount = Math.max(1, Math.min(600, Math.floor(Number(count) || 180)));
    const safeArea = Math.max(20, Math.min(500, Number(area) || 240));
    const positions = new Float32Array(safeCount * 3);
    const velocities = new Float32Array(safeCount);
    for (let i = 0; i < safeCount; i += 1) {
      positions[i * 3] = (Math.random() - .5) * safeArea;
      positions[i * 3 + 1] = Math.random() * 45 + 4;
      positions[i * 3 + 2] = (Math.random() - .5) * safeArea;
      velocities[i] = 2 + Math.random() * 3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xe8f3ff, size: .48, transparent: true, opacity: .78,
      depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 2;
    this.scene.add(points);
    const system = { points, velocities, area: safeArea, kind: "snow" };
    this.systems.push(system);
    return system;
  }

  animate(deltaSeconds) {
    if (this.disposed) return;
    const delta = Math.min(.05, Math.max(0, Number(deltaSeconds) || 0));
    for (const system of this.systems) {
      if (system.kind !== "snow") continue;
      const attribute = system.points.geometry.getAttribute("position");
      const positions = attribute.array;
      for (let i = 0; i < system.velocities.length; i += 1) {
        const offset = i * 3;
        positions[offset + 1] -= system.velocities[i] * delta;
        positions[offset] += Math.sin((positions[offset + 2] + i) * .025) * delta * .45;
        if (positions[offset + 1] < 0) {
          positions[offset + 1] = 35 + Math.random() * 12;
          positions[offset] = (Math.random() - .5) * system.area;
          positions[offset + 2] = (Math.random() - .5) * system.area;
        }
      }
      attribute.needsUpdate = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const system of this.systems) {
      this.scene.remove(system.points);
      system.points.geometry.dispose();
      system.points.material.dispose();
    }
    this.systems.length = 0;
  }
}
