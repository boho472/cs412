// HW7 — WebGL host and user interface for the pure shader-based ray tracer.
'use strict';
const canvas = document.querySelector('#glcanvas');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
const message = document.querySelector('#message');
const shaderError = document.querySelector('#shaderError');
const vertEditor = document.querySelector('#vertEditor');
const fragEditor = document.querySelector('#fragEditor');
vertEditor.value = VERTEX_SOURCE;
fragEditor.value = FRAGMENT_SOURCE;
let program = null, vao = null, uniform = {}, compileTimeout;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}
function compileProgram() {
  if (!gl) return;
  let vs, fs, next;
  try {
    vs = compileShader(gl.VERTEX_SHADER, vertEditor.value);
    fs = compileShader(gl.FRAGMENT_SHADER, fragEditor.value);
    next = gl.createProgram();
    gl.attachShader(next, vs); gl.attachShader(next, fs);
    gl.linkProgram(next);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(next));
    const oldProgram = program;
    program = next;
    gl.useProgram(program);
    const names = ['uResolution','uTime','uCamera','uTarget','uLightA','uLightB','uWave','uIOR',
      'uBounces','uShadows','uReflections','uRefraction','uExposure'];
    uniform = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    if (oldProgram) gl.deleteProgram(oldProgram);
    shaderError.textContent = '';
    message.textContent = 'Renderer ready · SDF intersections, Phong, shadow rays, reflection & refraction';
  } catch (error) {
    shaderError.textContent = error.message;
    message.textContent = 'Shader error · open editor for details';
    if (next && next !== program) gl.deleteProgram(next);
  } finally {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
  }
}
function bindSlider(id, digits=2) {
  const el=document.querySelector('#'+id), output=document.querySelector('#'+id+'Value');
  function sync() { output.textContent=Number(el.value).toFixed(digits); }
  el.addEventListener('input',sync); sync();
  return () => Number(el.value);
}
const getBounces=bindSlider('bounces',0);
const getIOR=bindSlider('ior');
const getLightA=bindSlider('lightA');
const getLightB=bindSlider('lightB');
const getWave=bindSlider('wave');
const getExposure=bindSlider('exposure');
const isOn=id=>document.querySelector('#'+id).checked;
const sizeLabel=document.querySelector('#sizeLabel');
function resize() {
  // Fixed 100% render resolution: one framebuffer pixel per CSS canvas pixel.
  const displayWidth=Math.min(1110, Math.max(1,canvas.getBoundingClientRect().width));
  const w=Math.max(1, Math.round(displayWidth));
  const h=Math.round(w*10/16);
  if (canvas.width!==w || canvas.height!==h) {canvas.width=w;canvas.height=h;}
  sizeLabel.textContent=`${w} × ${h}`;
  gl.viewport(0,0,w,h);
}
let azimuth=-0.62, elevation=0.27, distance=6.5;
let playing=true, animatedTime=0, previousMs=0, previousFrame=0, frames=0;
const target=[-0.77,0.70,-0.18];
function cameraPosition(){
  return [target[0]+distance*Math.cos(elevation)*Math.sin(azimuth),
          target[1]+distance*Math.sin(elevation),
          target[2]+distance*Math.cos(elevation)*Math.cos(azimuth)];
}
function reset(){ azimuth=-0.62; elevation=0.27; distance=6.5; }
document.querySelector('#resetButton').addEventListener('click',reset);
document.querySelector('#playButton').addEventListener('click',()=>{
  playing=!playing;
  document.querySelector('#playButton').textContent=playing?'Pause animation':'Resume animation';
});
const POINTER={active:false,x:0,y:0};
canvas.addEventListener('pointerdown',e=>{ POINTER.active=true;POINTER.x=e.clientX;POINTER.y=e.clientY;canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup',()=>POINTER.active=false);
canvas.addEventListener('pointercancel',()=>POINTER.active=false);
canvas.addEventListener('pointermove',e=>{
  if (!POINTER.active) return;
  azimuth += (e.clientX-POINTER.x)*0.006;
  elevation=Math.max(-0.25,Math.min(1.15,elevation-(e.clientY-POINTER.y)*0.006));
  POINTER.x=e.clientX;POINTER.y=e.clientY;
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault(); distance=Math.max(5.3,Math.min(19,distance*Math.exp(e.deltaY*0.0009)));
},{passive:false});
vertEditor.addEventListener('input',()=>{ clearTimeout(compileTimeout);compileTimeout=setTimeout(compileProgram,380); });
fragEditor.addEventListener('input',()=>{ clearTimeout(compileTimeout);compileTimeout=setTimeout(compileProgram,380); });
function draw(ms){
  if (!gl || !program) return;
  const dt=previousMs?Math.min((ms-previousMs)/1000,0.075):0;
  previousMs=ms;
  if (playing) animatedTime+=dt;
  resize();
  gl.useProgram(program);
  gl.uniform2f(uniform.uResolution,canvas.width,canvas.height);
  gl.uniform1f(uniform.uTime,animatedTime);
  gl.uniform3fv(uniform.uCamera,cameraPosition());
  gl.uniform3fv(uniform.uTarget,target);
  gl.uniform1f(uniform.uLightA,getLightA());
  gl.uniform1f(uniform.uLightB,getLightB());
  gl.uniform1f(uniform.uWave,getWave());
  gl.uniform1f(uniform.uIOR,getIOR());
  gl.uniform1i(uniform.uBounces,getBounces());
  gl.uniform1i(uniform.uShadows,isOn('shadows')?1:0);
  gl.uniform1i(uniform.uReflections,isOn('reflections')?1:0);
  gl.uniform1i(uniform.uRefraction,isOn('refraction')?1:0);
  gl.uniform1f(uniform.uExposure,getExposure());
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES,0,3);
  frames++;
  if(ms-previousFrame>1500){
    document.querySelector('#fpsLabel').textContent=`FPS ${Math.round(frames*1000/(ms-previousFrame || 1500))}`;
    frames=0;previousFrame=ms;
  }
  requestAnimationFrame(draw);
}
if (!gl) {
  message.textContent='WebGL2 unavailable. Open this page in a modern browser with WebGL2 enabled.';
  shaderError.textContent='Unable to create WebGL2 context.';
} else {
  vao=gl.createVertexArray();
  gl.bindVertexArray(vao);
  compileProgram();
  requestAnimationFrame(draw);
}
