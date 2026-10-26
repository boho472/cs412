// CS412 HW5 — Lighting & Shading Laboratory — Junho Lee
// Built by extending the instructor's WebGL2 + joint-tree template.

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModelView;
uniform mat4 uProjection;
out vec3 vPosition;
out vec3 vNormal;
void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;
  // Inverse-transpose is essential for non-uniformly scaled arm segments.
  vNormal = mat3(transpose(inverse(uModelView))) * aNormal;
  gl_Position = uProjection * p;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vPosition;
in vec3 vNormal;
uniform vec3 uLightPosA;      // Both lights are converted to eye space in JS.
uniform vec3 uLightPosB;
uniform vec3 uLightColorA;
uniform vec3 uLightColorB;
uniform float uLightPowerA;
uniform float uLightPowerB;
uniform vec3 uColor;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;
uniform vec3 uEmissive;
out vec4 fragColor;

vec3 phongLight(vec3 lightPos, vec3 lightColor, float power, vec3 N, vec3 V) {
  vec3 L = normalize(lightPos - vPosition);
  float diff = max(dot(N, L), 0.0);
  // No Phong highlight on a face facing away from the light.
  vec3 R = reflect(-L, N);
  float spec = diff > 0.0 ? pow(max(dot(R, V), 0.0), uShininess) : 0.0;
  return power * lightColor * (uColor * uDiffuse * diff + vec3(uSpecular * spec));
}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vPosition);
  vec3 linearRGB = uColor * 0.13 + uEmissive;
  linearRGB += phongLight(uLightPosA, uLightColorA, uLightPowerA, N, V);
  linearRGB += phongLight(uLightPosB, uLightColorB, uLightPowerB, N, V);
  // Approximate conversion from linear light to display RGB.
  vec3 displayRGB = pow(max(linearRGB, vec3(0.0)), vec3(1.0 / 2.2));
  fragColor = vec4(clamp(displayRGB, 0.0, 1.0), 1.0);
}`;

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2', { antialias: true });
const errorBox = document.getElementById('shaderError');
if (!gl) throw new Error('WebGL2 is required to run HW5.');

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(reason);
  }
  return shader;
}

// VAO attribute locations stay unchanged when shaders are edited live.
const ATTRIBUTES = { aPosition: 0, aNormal: 1 };
function createProgram(vsSource, fsSource) {
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  let fs;
  try { fs = compile(gl.FRAGMENT_SHADER, fsSource); }
  catch (e) { gl.deleteShader(vs); throw e; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const reason = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(reason);
  }
  return prog;
}

const vertEditor = document.getElementById('vertEditor');
const fragEditor = document.getElementById('fragEditor');
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;
let program = null;
let uniforms = {};
const UNIFORM_NAMES = [
  'uModelView', 'uProjection', 'uLightPosA', 'uLightPosB',
  'uLightColorA', 'uLightColorB', 'uLightPowerA', 'uLightPowerB',
  'uColor', 'uDiffuse', 'uSpecular', 'uShininess', 'uEmissive'
];
function updateProgram() {
  try {
    const newProgram = createProgram(vertEditor.value, fragEditor.value);
    if (program) gl.deleteProgram(program);
    program = newProgram;
    uniforms = Object.fromEntries(UNIFORM_NAMES.map(name => [name, gl.getUniformLocation(program, name)]));
    errorBox.textContent = '';
  } catch (e) {
    errorBox.textContent = e.message.replace(/\0/g, '');
    // Keep last successfully linked program active while an edit has errors.
  }
}
updateProgram();
vertEditor.addEventListener('input', updateProgram);
fragEditor.addEventListener('input', updateProgram);

function bindAttribute(slot, array) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
  gl.vertexAttribPointer(slot, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(slot);
}
function createMesh({ positions, normals, indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute(ATTRIBUTES.aPosition, positions);
  bindAttribute(ATTRIBUTES.aNormal, normals);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: indices.length };
}

const sphereGeometry = createSphere(20, 12);
const meshes = {
  cube: createMesh(createCube()),
  cylinder: createMesh(createCylinder(36)),
  cone: createMesh(createCone(32)),
  sphere: createMesh(sphereGeometry),
  flatSphere: createMesh(makeFlatShaded(sphereGeometry)),
  torus: createMesh(createTorus())
};

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.027, 0.045, 0.075, 1);
gl.viewport(0, 0, canvas.width, canvas.height);
const projection = perspective(Math.PI/4, canvas.width / canvas.height, 0.1, 100);
const identity = translate(0,0,0);
const deg = d => d * Math.PI / 180;
const shape = (x,y,z,sx,sy,sz) => multiply(translate(x,y,z), scale(sx,sy,sz));

// Materials: diffuse-painted frame, metallic lower arm, matte upper arm,
// glossy joints and emissive light indicators. Material sliders below change
// BOTH arm parts independently, not just a global scene-wide setting.
const material = (color, diffuse=.8, specular=.2, shininess=32, emissive=[0,0,0]) =>
  ({ color, diffuse, specular, shininess, emissive });
const M = {
  base: material([.26,.43,.62],.85,.3,30),
  dark: material([.13,.19,.29],.8,.32,44),
  lower: material([.23,.73,.9],.78,.85,64),
  upper: material([.98,.48,.25],.93,.08,16),
  chrome: material([.47,.71,.84],.7,1.10,96),
  rubber: material([.17,.23,.32],.92,.04,8),
  comparison: material([.25,.77,.73],.82,.85,48),
  plinth: material([.17,.24,.35],.85,.22,30),
  grid: material([.035,.09,.15],.48,.02,8,[.007,.017,.03]),
  gold: material([.93,.58,.24],.88,.5,44),
  brightA: material([.96,.61,.32],.0,0,8,[1.25,.72,.36]),
  brightB: material([.35,.61,1.0],.0,0,8,[.30,.65,1.35]),
  orb: material([.29,.73,.94],.25,.65,64,[.08,.25,.42])
};

// Each node's shape scales its OWN mesh, while its joint frame is inherited
// by all descendants. This is the essential hierarchical modeling rule.
function createNode(name, mesh, mat, localShape=identity, joint=identity) {
  return { name, mesh, mat, shape:localShape, joint, children:[] };
}
function add(parent, child) { parent.children.push(child); return child; }

// Six articulated levels:
// base -> shoulder -> elbow -> wrist -> gripper -> (left/right fingers).
const base = createNode('base [level 1]',meshes.cylinder,M.base,shape(0,.05,0,.92,.20,.92));
add(base,createNode('base hub',meshes.cylinder,M.dark,shape(0,.35,0,.38,.30,.38)));
const shoulder = add(base,createNode('shoulder [level 2]',meshes.cylinder,M.lower,shape(0,.80,0,.24,.80,.24)));
add(shoulder,createNode('shoulder bearing',meshes.sphere,M.chrome,shape(0,0,0,.34,.34,.34)));
add(shoulder,createNode('shoulder trim',meshes.cylinder,M.gold,shape(0,.90,0,.265,.055,.265)));
const elbow = add(shoulder,createNode('elbow [level 3]',meshes.cube,M.upper,shape(0,.70,0,.205,.70,.20)));
add(elbow,createNode('elbow bearing',meshes.sphere,M.chrome,shape(0,0,0,.29,.29,.29)));
add(elbow,createNode('elbow trim',meshes.cylinder,M.gold,shape(0,.75,0,.23,.055,.23)));
const wrist = add(elbow,createNode('wrist [level 4]',meshes.torus,M.chrome,shape(0,0,0,.35,.28,.35)));
const gripper = add(wrist,createNode('gripper [level 5]',meshes.cylinder,M.dark,shape(0,.19,0,.29,.19,.29)));
const leftFinger = add(gripper,createNode('left finger [level 6]',meshes.cube,M.rubber,shape(0,.30,0,.085,.31,.12)));
const rightFinger = add(gripper,createNode('right finger [level 6]',meshes.cube,M.rubber,shape(0,.30,0,.085,.31,.12)));
add(leftFinger, createNode('left fingertip',meshes.cone,M.gold,shape(0,.65,0,.08,.14,.08)));
add(rightFinger, createNode('right fingertip',meshes.cone,M.gold,shape(0,.65,0,.08,.14,.08)));
add(gripper,createNode('captured sample sphere',meshes.sphere,M.orb,shape(0,.29,0,.11,.11,.11)));

// Original template camera / axis + spin interactions.
let dragRotX=.08, dragRotY=-.42;
let camX=0, camY=-.45, camZ=-10.8;
let spinAngle=0, spinning=false, lastTime=0;
const axisSelect=document.getElementById('axisSelect');
let mouseDown=false, lastX=0, lastY=0;
canvas.addEventListener('pointerdown',e=>{
  mouseDown=true; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup',()=>mouseDown=false);
canvas.addEventListener('pointercancel',()=>mouseDown=false);
canvas.addEventListener('pointermove',e=>{
  if (!mouseDown) return;
  dragRotY+=(e.clientX-lastX)*.007;
  dragRotX+=(e.clientY-lastY)*.007;
  lastX=e.clientX; lastY=e.clientY;
});
document.addEventListener('keydown',e=>{
  const tag=e.target.tagName;
  if (tag==='TEXTAREA'||tag==='INPUT'||tag==='SELECT') return;
  const step=.22;
  switch (e.code) {
    case 'ArrowUp':camY-=step;break;
    case 'ArrowDown':camY+=step;break;
    case 'ArrowLeft':camX+=step;break;
    case 'ArrowRight':camX-=step;break;
    case 'KeyW':camZ+=step;break;
    case 'KeyS':camZ-=step;break;
    default:return;
  }
  e.preventDefault();
});

let autoMotion=false;
const defaults={ slider:0, shoulderAngle:20, elbowAngle:-35, wristAngle:22, gripOpen:50,
  light1:1.15, light2:.95, shoulderSpec:.85, forearmSpec:.10, shininess:64 };
const controlIds=Object.keys(defaults);
const input=id=>document.getElementById(id);
const val=id=>Number(input(id).value);
const formatValue=(id,v)=>{
  if (['slider','shoulderAngle','elbowAngle','wristAngle'].includes(id)) return Math.round(v)+'°';
  if (id==='gripOpen') return Math.round(v)+'%';
  if (id==='shininess') return String(Math.round(v));
  if (id==='light1'||id==='light2') return Number(v).toFixed(2)+'×';
  return Number(v).toFixed(2);
};
function syncControl(id) { input(id+'Value').textContent=formatValue(id,val(id)); }
for (const id of controlIds) input(id).addEventListener('input',()=>syncControl(id));
for (const id of controlIds) syncControl(id);
function stopAuto() {
  autoMotion=false;
  input('autoButton').textContent='▶ Auto choreography';
}
for (const id of ['shoulderAngle','elbowAngle','wristAngle','gripOpen']) {
  input(id).addEventListener('input',stopAuto);
}
input('autoButton').addEventListener('click',()=>{
  autoMotion=!autoMotion;
  input('autoButton').textContent=autoMotion?'❚❚ Pause choreography':'▶ Auto choreography';
});
input('spinButton').addEventListener('click',()=>spinning=!spinning);
input('resetButton').addEventListener('click',()=>{
  stopAuto(); spinning=false; spinAngle=0;
  camX=0;camY=-.45;camZ=-10.8;dragRotX=.08;dragRotY=-.42;
  axisSelect.value='y';
  for (const id of controlIds) { input(id).value=defaults[id]; syncControl(id); }
});

function setMaterialUniforms(mat) {
  gl.uniform3fv(uniforms.uColor,mat.color);
  gl.uniform1f(uniforms.uDiffuse,mat.diffuse);
  gl.uniform1f(uniforms.uSpecular,mat.specular);
  gl.uniform1f(uniforms.uShininess,mat.shininess);
  gl.uniform3fv(uniforms.uEmissive,mat.emissive);
}
function drawMesh(mesh, world, mat, view) {
  if (!mesh) return;
  gl.uniformMatrix4fv(uniforms.uModelView,false,multiply(view,world));
  setMaterialUniforms(mat);
  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
}
function drawTree(root,parentFrame,view) {
  const stack=[[root,parentFrame]];
  while (stack.length) {
    const [node,parent]=stack.pop();
    const frame=multiply(parent,node.joint);
    drawMesh(node.mesh,multiply(frame,node.shape),node.mat,view);
    for (const child of node.children) stack.push([child,frame]);
  }
}
function drawEnvironment(view,lightA,lightB) {
  // 2D ground grid: a simple stage that helps judge the robot's 3D motion.
  const gridY=-1.97;
  for (let i=-6;i<=6;i++) {
    drawMesh(meshes.cube,shape(i*.7,gridY,0,.008,.009,4.3),M.grid,view);
    drawMesh(meshes.cube,shape(0,gridY,i*.7,4.3,.009,.008),M.grid,view);
  }
  // Two identical spheres, one faceted and one smoothly normal-interpolated.
  for (const [x,mesh] of [[-2.75,meshes.flatSphere],[2.75,meshes.sphere]]) {
    drawMesh(meshes.cylinder,shape(x,-1.72,0,.77,.18,.77),M.plinth,view);
    drawMesh(meshes.cylinder,shape(x,-1.52,0,.65,.025,.65),M.gold,view);
    drawMesh(mesh,shape(x,-.78,0,.52,.52,.52),M.comparison,view);
  }
  // Visible light markers use emissive materials (their positions equal the lights).
  drawMesh(meshes.sphere,multiply(translate(...lightA),scale(.145,.145,.145)),M.brightA,view);
  drawMesh(meshes.sphere,multiply(translate(...lightB),scale(.145,.145,.145)),M.brightB,view);
}

const lightWorldA=[3.5,3.1,2.6];
const lightWorldB=[-3.3,2.0,-1.5];
function render(timeMS) {
  const t=timeMS/1000;
  const dt=Math.min(.05,lastTime? t-lastTime:0);
  lastTime=t;
  if (spinning) spinAngle+=.75*dt;
  if (autoMotion) {
    const animated={
      shoulderAngle:17+30*Math.sin(t*.9),
      elbowAngle:-40+38*Math.sin(t*1.2+.8),
      wristAngle:10+44*Math.sin(t*1.5+1.2),
      gripOpen:50+40*Math.sin(t*1.8+1.8)
    };
    for (const [id,value] of Object.entries(animated)) {
      input(id).value=value;
      syncControl(id);
    }
  }
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if (!program) { requestAnimationFrame(render); return; }
  gl.useProgram(program);

  // View rotation affects scene and lights equally. Light positions are in eye space.
  const view=multiply(multiply(translate(camX,camY,camZ),rotateX(dragRotX)),rotateY(dragRotY));
  gl.uniformMatrix4fv(uniforms.uProjection,false,projection);
  gl.uniform3fv(uniforms.uLightPosA,transformPoint(view,lightWorldA));
  gl.uniform3fv(uniforms.uLightPosB,transformPoint(view,lightWorldB));
  gl.uniform3fv(uniforms.uLightColorA,[1.0,.78,.58]);
  gl.uniform3fv(uniforms.uLightColorB,[.52,.70,1.0]);
  gl.uniform1f(uniforms.uLightPowerA,val('light1'));
  gl.uniform1f(uniforms.uLightPowerB,val('light2'));

  M.lower.specular=val('shoulderSpec');
  M.upper.specular=val('forearmSpec');
  M.lower.shininess=val('shininess');
  M.chrome.shininess=val('shininess');

  const angle=deg(val('slider'))+spinAngle;
  const rootRotation=ROTATE[axisSelect.value](angle);
  base.joint=multiply(translate(0,-1.66,0),rootRotation);
  shoulder.joint=multiply(translate(0,.60,0),rotateZ(deg(val('shoulderAngle'))));
  elbow.joint=multiply(translate(0,1.60,0),rotateZ(deg(val('elbowAngle'))));
  wrist.joint=multiply(translate(0,1.40,0),rotateZ(deg(val('wristAngle'))));
  gripper.joint=translate(0,.23,0);
  const gap=.18+val('gripOpen')*.0024;
  leftFinger.joint=translate(-gap,.35,0);
  rightFinger.joint=translate(gap,.35,0);

  drawEnvironment(view,lightWorldA,lightWorldB);
  drawTree(base,identity,view);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
