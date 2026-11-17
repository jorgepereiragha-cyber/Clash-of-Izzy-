/* Optional post-processing pipeline. Caller owns the render loop and calls render(). */
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

const NordicGrade = {
  uniforms: { tDiffuse: { value: null }, intensity: { value: .16 } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float intensity;varying vec2 vUv;
  void main(){vec4 c=texture2D(tDiffuse,vUv);vec3 cool=c.rgb*vec3(.96,1.0,1.055);vec3 gold=vec3(c.r*1.035,c.g*1.005,c.b*.94);gl_FragColor=vec4(mix(cool,gold,intensity),c.a);}`
};

export class PostProcessing {
  constructor(renderer, scene, camera, THREE, options = {}) {
    if (!renderer?.isWebGLRenderer || !scene?.isScene || !camera || !THREE?.Vector2) {
      throw new TypeError("PostProcessing requer renderer, scene, camera e THREE.");
    }
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.THREE = THREE;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gradePass = new ShaderPass(NordicGrade);
    this.composer.addPass(this.gradePass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), .42, .55, .82);
    this.bloomPass.enabled = options.quality !== "low" && options.bloom !== false;
    if (this.bloomPass.enabled) this.composer.addPass(this.bloomPass);
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);
    this.resize();
  }

  resize(width, height) {
    const w = Math.max(1, Number(width) || this.renderer.domElement.clientWidth || 1);
    const h = Math.max(1, Number(height) || this.renderer.domElement.clientHeight || 1);
    this.composer.setSize(w, h);
    const pixelRatio = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms.resolution.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
    this.bloomPass.setSize(w, h);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.passes.forEach(pass => pass.dispose?.());
    this.composer.renderTarget1?.dispose();
    this.composer.renderTarget2?.dispose();
  }
}
