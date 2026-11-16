/* Optional visual shaders. Animation is advanced by the caller's existing frame loop. */
export class AdvancedShaders {
  constructor(scene, renderer, camera, THREE) {
    if (!scene?.isScene || !renderer?.isWebGLRenderer || !camera || !THREE?.ShaderMaterial) {
      throw new TypeError("AdvancedShaders requer scene, renderer, camera e THREE.");
    }
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.THREE = THREE;
    this.materials = new Set();
    this.disposed = false;
  }

  createRealisticWater(position = new this.THREE.Vector3(), size = 200) {
    if (this.disposed) throw new Error("AdvancedShaders já foi descartado.");
    const THREE = this.THREE;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        deepColor: { value: new THREE.Color(0x063b58) },
        shallowColor: { value: new THREE.Color(0x2686a0) },
        sunColor: { value: new THREE.Color(0xffdf9a) },
        opacity: { value: .88 }
      },
      vertexShader: `
        uniform float time;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vWave;
        void main(){
          vec3 p=position;
          float wave=sin(p.x*.075+time*1.15)*.12+cos(p.y*.09-time*.82)*.09;
          p.z+=wave;
          vWave=wave;
          vec4 world=modelMatrix*vec4(p,1.0);
          vWorldPosition=world.xyz;
          vNormal=normalize(mat3(modelMatrix)*normal);
          gl_Position=projectionMatrix*viewMatrix*world;
        }`,
      fragmentShader: `
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 sunColor;
        uniform float opacity;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vWave;
        void main(){
          vec3 viewDir=normalize(cameraPosition-vWorldPosition);
          float fresnel=pow(1.0-max(dot(normalize(vNormal),viewDir),0.0),3.0);
          float ripple=.5+.5*sin(vWorldPosition.x*.11+vWorldPosition.z*.08+vWave*8.0);
          vec3 color=mix(deepColor,shallowColor,clamp(.28+ripple*.25+fresnel*.5,0.0,1.0));
          float highlight=pow(max(dot(reflect(-normalize(vec3(.35,.85,.4)),normalize(vNormal)),viewDir),0.0),28.0);
          color+=sunColor*(highlight*.42+fresnel*.2);
          gl_FragColor=vec4(color,opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.materials.add(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.userData.isWater = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  update(deltaSeconds) {
    if (this.disposed) return;
    const delta = Math.min(.05, Math.max(0, Number(deltaSeconds) || 0));
    for (const material of this.materials) {
      material.uniforms.time.value += delta;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const material of this.materials) material.dispose();
    this.materials.clear();
  }
}
