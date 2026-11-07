// UNM CS412 / HW6 — Junho Lee
// Extends the professor's WebGL2 template: live GLSL editing, UV meshes, bump and
// tangent-space normal mapping. The cone receives real animated GPU texture pixels.

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aTexCoord;
layout(location=3) in vec3 aTangent;
uniform mat4 uModelView;
uniform mat4 uProjection;
out vec3 vPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec2 vTexCoord;
void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;
  // Correct normals under non-uniform model scaling.
  vNormal = transpose(inverse(mat3(uModelView))) * aNormal;
  vTangent = mat3(uModelView) * aTangent;
  vTexCoord = aTexCoord;
  gl_Position = uProjection * p;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec2 vTexCoord;
uniform sampler2D uTexture;
uniform sampler2D uNormalTexture;
uniform int uMapping; // 0 = ordinary, 1 = BUMP, 2 = NORMAL, 3 = unlit
uniform float uBumpScale;
uniform float uNormalStrength;
uniform vec3 uTint;
uniform float uSpecular;
uniform float uShininess;
uniform vec3 uLightPosA; // eye space
uniform vec3 uLightPosB;
uniform vec3 uLightColorA;
uniform vec3 uLightColorB;
uniform float uLightPowerA;
uniform float uLightPowerB;
out vec4 fragColor;

float heightFromBrick(vec2 uv) {
  vec3 c = texture(uTexture, uv).rgb;
  return 1.0 - dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 phongLight(vec3 normal, vec3 lightPos, vec3 lightColor,
                float power, vec3 albedo, vec3 V) {
  vec3 delta = lightPos - vPosition;
  float dist = length(delta);
  vec3 L = normalize(delta);
  float ndotl = max(dot(normal, L), 0.0);
  float spec = 0.0;
  if (ndotl > 0.0) {
    vec3 R = reflect(-L, normal);
    spec = pow(max(dot(R, V), 0.0), max(1.0, uShininess));
  }
  float attenuation = 1.0 / (1.0 + 0.025 * dist + 0.008 * dist * dist);
  return power * attenuation * lightColor *
         (albedo * 0.70 * ndotl + vec3(uSpecular * 0.45 * spec));
}

void main() {
  vec2 uv = vTexCoord;
  vec3 baseColor = texture(uTexture, uv).rgb * uTint;
  if (uMapping == 3) {
    fragColor = vec4(baseColor, 1.0); // emissive light markers
    return;
  }

  // Build the tangent frame in eye space; recompute B after orthogonalizing T.
  vec3 N = normalize(vNormal);
  vec3 T = normalize(vTangent - N * dot(vTangent, N));
  vec3 B = normalize(cross(N, T));
  mat3 TBN = mat3(T, B, N);

  if (uMapping == 1) {
    // BUMP mapping: derive height field from the brick albedo by grayscale.
    // Central finite differences approximate the slope in texture coordinates.
    vec2 px = 1.0 / vec2(textureSize(uTexture, 0));
    float dx = (heightFromBrick(uv + vec2(px.x,0.0)) -
                heightFromBrick(uv - vec2(px.x,0.0))) * 0.5;
    float dy = (heightFromBrick(uv + vec2(0.0,px.y)) -
                heightFromBrick(uv - vec2(0.0,px.y))) * 0.5;
    N = normalize(TBN * normalize(vec3(-uBumpScale*dx, -uBumpScale*dy, 1.0)));
  } else if (uMapping == 2) {
    // NORMAL mapping: decode [0,1] RGB into [-1,1] tangent-space normal.
    // Scaling XY without scaling Z preserves a neutral normal at strength 0.
    vec3 tNormal = texture(uNormalTexture, uv).rgb * 2.0 - 1.0;
    tNormal = normalize(vec3(tNormal.xy * uNormalStrength, tNormal.z));
    N = normalize(TBN * tNormal);
  }

  vec3 V = normalize(-vPosition);
  vec3 lit = 0.16 * baseColor;
  lit += phongLight(N,uLightPosA,uLightColorA,uLightPowerA,baseColor,V);
  lit += phongLight(N,uLightPosB,uLightColorB,uLightPowerB,baseColor,V);
  fragColor = vec4(lit, 1.0);
}`;

const canvas = document.getElementById('glcanvas');
const fatal = document.getElementById('fatal');
const gl = canvas.getContext('webgl2', { antialias:true, alpha:false });
if (!gl) {
  fatal.style.display = 'grid';
  fatal.textContent = 'WebGL2 is unavailable. Please open the published GitHub Pages URL in an up-to-date Chrome or Firefox browser.';
  throw new Error('WebGL2 unavailable');
}

const vertEditor = document.getElementById('vertEditor');
const fragEditor = document.getElementById('fragEditor');
const shaderError = document.getElementById('shaderError');
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

let program = null;
let loc = {};
function compile(type, source) {
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
    const msg=gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(msg);
  }
  return shader;
}
function makeProgram(vs,fs) {
  const v=compile(gl.VERTEX_SHADER,vs);
  let f;
  try { f=compile(gl.FRAGMENT_SHADER,fs); }
  catch(e){gl.deleteShader(v);throw e;}
  const p=gl.createProgram();
  gl.attachShader(p,v);gl.attachShader(p,f);
  gl.bindAttribLocation(p,0,'aPosition');
  gl.bindAttribLocation(p,1,'aNormal');
  gl.bindAttribLocation(p,2,'aTexCoord');
  gl.bindAttribLocation(p,3,'aTangent');
  gl.linkProgram(p);
  gl.detachShader(p,v);gl.detachShader(p,f);
  gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
    const msg=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error(msg);
  }
  return p;
}
function updateProgram(){
  try {
    const p=makeProgram(vertEditor.value,fragEditor.value);
    if(program)gl.deleteProgram(program);
    program=p;gl.useProgram(program);
    loc={};
    for (const k of [
      'uModelView','uProjection','uTexture','uNormalTexture','uMapping',
      'uBumpScale','uNormalStrength','uTint','uSpecular','uShininess',
      'uLightPosA','uLightPosB','uLightColorA','uLightColorB',
      'uLightPowerA','uLightPowerB'
    ])loc[k]=gl.getUniformLocation(program,k);
    gl.uniform1i(loc.uTexture,0);gl.uniform1i(loc.uNormalTexture,1);
    shaderError.textContent='';
  } catch(e) {shaderError.textContent='Shader compiler: '+e.message.replace(/\0/g,'');}
}
updateProgram();
vertEditor.addEventListener('input',updateProgram);
fragEditor.addEventListener('input',updateProgram);

const ATTR = {aPosition:[0,3,'positions'],aNormal:[1,3,'normals'],aTexCoord:[2,2,'texCoords'],aTangent:[3,3,'tangents']};
function createMesh(data) {
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  for(const [, [slot, width, prop]] of Object.entries(ATTR)) {
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,data[prop],gl.STATIC_DRAW);
    gl.enableVertexAttribArray(slot);
    gl.vertexAttribPointer(slot,width,gl.FLOAT,false,0,0);
  }
  const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return {vao,count:data.indices.length};
}
const meshes={
  cube:createMesh(createCube()), cylinder:createMesh(createCylinder()),
  sphere:createMesh(createSphere()), torus:createMesh(createTorus()),
  cone:createMesh(createCone())
};

function makeTexture(pixel=[255,255,255,255]) {
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixel));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  return tex;
}
const whiteTexture=makeTexture();
let loadedCount=0;
const statusText=document.getElementById('statusText');
function loadTexture(url,placeholder) {
  const tex=makeTexture(placeholder);const img=new Image();
  img.onload=()=>{
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    loadedCount++;
    statusText.textContent=`${loadedCount}/2 source images loaded · live GPU texture`;
  };
  img.onerror=()=>{
    statusText.textContent=`Couldn't load ${url} · use a local server or GitHub Pages`;
    shaderError.textContent=`Texture failed: ${url}. Serve via http://localhost:8000/ or GitHub Pages.`;
  };
  img.src=url;return tex;
}
const brick=loadTexture('textures/brick.png',[190,105,55,255]);
const hexNormal=loadTexture('textures/texture2.jpg',[128,128,255,255]);

// ----- Real animated texture (NOT merely moving the cone or its UV coordinates). -----
// A 512x512 Canvas2D changes its pixels in time. Upload to the GPU with texImage2D.
// Pausing texture animation leaves all geometric controls independent.
const flowCanvas=document.createElement('canvas');flowCanvas.width=512;flowCanvas.height=512;
const flowCtx=flowCanvas.getContext('2d');
const flowTexture=makeTexture([8,125,131,255]);
function paintFlow(time) {
  const ctx=flowCtx,w=512,h=512;
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,'#071c2f');bg.addColorStop(.38,'#075b76');
  bg.addColorStop(.65,'#0b827c');bg.addColorStop(1,'#08243b');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Two families of drifting neon wavefronts create flowing, layered motion.
  for(let k=-3;k<17;k++) {
    const cy=((k*49+time*105)%700)-90;
    ctx.beginPath();
    for(let x=0;x<=w;x+=5) {
      const y=cy+21*Math.sin(x*.021+time*1.3+k*.57)+7*Math.sin(x*.056-time*.9);
      if(x===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=k%3===0?'rgba(255,203,122,.88)':'rgba(91,251,218,.66)';
    ctx.lineWidth=k%3===0?7:4;ctx.shadowBlur=17;
    ctx.shadowColor=k%3===0?'#ffc070':'#47ffe1';ctx.stroke();
    ctx.shadowBlur=0;
  }
  for(let k=0;k<34;k++) {
    const x=(k*71+Math.sin(k*31.4)*89+time*16)%512;
    const y=(k*97-time*29+32000)%512;
    ctx.fillStyle=k%4===0?'rgba(255,225,148,.7)':'rgba(190,252,240,.5)';
    ctx.beginPath();ctx.arc(x,y,1+(k%3)*.7,0,2*Math.PI);ctx.fill();
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,flowTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,flowCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
}
paintFlow(0);

// Textured floor is another object, but the three NEW primitives are the hero exhibits.
const gridCanvas=document.createElement('canvas');gridCanvas.width=512;gridCanvas.height=512;
const gc=gridCanvas.getContext('2d');
gc.fillStyle='#101c2b';gc.fillRect(0,0,512,512);
for(let n=0;n<=16;n++){
  gc.strokeStyle=n%4===0?'#42647b':'#284258';gc.lineWidth=n%4===0?2:1;
  const q=n*32;gc.beginPath();gc.moveTo(q,0);gc.lineTo(q,512);gc.moveTo(0,q);gc.lineTo(512,q);gc.stroke();
}
const gridTexture=makeTexture();
gl.bindTexture(gl.TEXTURE_2D,gridTexture);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,gridCanvas);
gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);

// ----- UI (template's rotation controls preserved) -----
const state={bump:6,normal:1.2,flowSpeed:1,key:1.2,rim:.9,showGrid:true,
             lightMotion:true,flowing:true,spinning:false,spinSpeed:1,angle:0,
             spinAngle:0,flowTime:0,yaw:-.23,pitch:-.21,camX:0,camY:-.16,camZ:-11.4};
function range(id,key,suffix='',decimals=1){
  const slider=document.getElementById(id), output=document.getElementById(id+'Value');
  const fn=()=>{state[key]=Number(slider.value);output.textContent=state[key].toFixed(decimals)+suffix;};
  slider.addEventListener('input',fn);fn();
}
range('bumpStrength','bump','',1);range('normalStrength','normal','',1);
range('flowSpeed','flowSpeed','×',1);range('keyPower','key','×',1);
range('rimPower','rim','×',1);
const slider=document.getElementById('slider');
slider.addEventListener('input',()=>{
  state.angle=Number(slider.value);
  document.getElementById('sliderValue').textContent=state.angle+'°';
});
const axisSelect=document.getElementById('axisSelect');
const spinButton=document.getElementById('spinButton');
spinButton.addEventListener('click',()=>{
  state.spinning=!state.spinning;
  spinButton.textContent=state.spinning?'❚❚ Stop rotation':'▶ Start rotation';
});
const flowButton=document.getElementById('toggleFlow');
flowButton.addEventListener('click',()=>{
  state.flowing=!state.flowing;
  flowButton.textContent=state.flowing?'❚❚ Pause flowing texture':'▶ Resume flowing texture';
});
document.getElementById('lightMotion').addEventListener('change',e=>state.lightMotion=e.target.checked);
document.getElementById('showGrid').addEventListener('change',e=>state.showGrid=e.target.checked);
document.getElementById('resetButton').addEventListener('click',()=>{
  state.yaw=-.23;state.pitch=-.21;state.camX=0;state.camY=-.16;state.camZ=-11.4;
  state.spinAngle=0;state.spinning=false;spinButton.textContent='▶ Start rotation';
  state.flowing=true;state.flowTime=0;flowButton.textContent='❚❚ Pause flowing texture';
  slider.value='0';slider.dispatchEvent(new Event('input'));axisSelect.value='y';
  for(const [id,val] of [['bumpStrength',6],['normalStrength',1.2],['flowSpeed',1],['keyPower',1.2],['rimPower',.9]]){
    const input=document.getElementById(id);input.value=val;input.dispatchEvent(new Event('input'));
  }
  document.getElementById('lightMotion').checked=true;state.lightMotion=true;
  document.getElementById('showGrid').checked=true;state.showGrid=true;
});
let dragging=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{
  dragging=true;lastX=e.clientX;lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;
  state.yaw+=(e.clientX-lastX)*.007;
  state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(e.clientY-lastY)*.007));
  lastX=e.clientX;lastY=e.clientY;
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();state.camZ=Math.max(-20,Math.min(-6.8,state.camZ-e.deltaY*.012));
},{passive:false});
document.addEventListener('keydown',e=>{
  if(e.target.closest('textarea, input, select, button'))return;
  const step=.25;
  switch(e.code){
    case'ArrowUp':state.camY-=step;break;
    case'ArrowDown':state.camY+=step;break;
    case'ArrowLeft':state.camX+=step;break;
    case'ArrowRight':state.camX-=step;break;
    case'KeyW':state.camZ=Math.min(-6.8,state.camZ+step);break;
    case'KeyS':state.camZ=Math.max(-20,state.camZ-step);break;
    default:return;
  }
  e.preventDefault();
});

// ----- Render -----
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.disable(gl.CULL_FACE); // all exhibit parts visible, even inside torus
const bg=[.025,.052,.09];
gl.clearColor(...bg,1);
const projection=perspective(Math.PI/3.6,canvas.width/canvas.height,.1,100);
const DEG=Math.PI/180;
function paint(mesh,frame,{texture=whiteTexture,normal=hexNormal,mapping=0,bump=0,norm=1,
                           tint=[1,1,1],spec=.16,shine=25}={}){
  gl.uniformMatrix4fv(loc.uModelView,false,frame);
  gl.uniform1i(loc.uMapping,mapping);
  gl.uniform1f(loc.uBumpScale,bump);
  gl.uniform1f(loc.uNormalStrength,norm);
  gl.uniform3fv(loc.uTint,tint);
  gl.uniform1f(loc.uSpecular,spec);
  gl.uniform1f(loc.uShininess,shine);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normal);
  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
}
let lastT=0,lastFlowUpload=-10;
function render(ms) {
  const t=ms*.001,dt=Math.min(.05,Math.max(0,t-lastT));lastT=t;
  if(state.spinning) state.spinAngle+=dt*.29*state.spinSpeed;
  if(state.flowing && state.flowSpeed>0) state.flowTime+=dt*state.flowSpeed;
  if(state.flowing && state.flowSpeed>0 && ms-lastFlowUpload>55){
    paintFlow(state.flowTime);lastFlowUpload=ms;
  }
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!program){requestAnimationFrame(render);return;}
  gl.useProgram(program);
  gl.uniformMatrix4fv(loc.uProjection,false,projection);
  const view=compose(translate(state.camX,state.camY,state.camZ),rotateX(state.pitch),rotateY(state.yaw));
  const spin=ROTATE[axisSelect.value](state.angle*DEG+state.spinAngle);
  const world=compose(view,spin);
  // Both light positions are world-space positions transformed into eye space.
  const phase=state.lightMotion?t*.27:0;
  const lightA=[-3.7+Math.sin(phase)*.8,4.8,4.4+Math.cos(phase)*.5];
  const lightB=[3.9+Math.cos(phase+1)*1.1,2.9,-2.0+Math.sin(phase+1)*1.0];
  gl.uniform3fv(loc.uLightPosA,transformPoint(view,lightA));
  gl.uniform3fv(loc.uLightPosB,transformPoint(view,lightB));
  gl.uniform3fv(loc.uLightColorA,[1,.79,.62]);
  gl.uniform3fv(loc.uLightColorB,[.53,.79,1]);
  gl.uniform1f(loc.uLightPowerA,state.key);
  gl.uniform1f(loc.uLightPowerB,state.rim);

  if(state.showGrid){
    paint(meshes.cube,compose(world,translate(0,-1.75,0),scale(6,.055,3.0)),
      {texture:gridTexture,tint:[.56,.80,.95],spec:.10,shine:12});
  }
  for(const [i,x] of [-3.45,0,3.45].entries()) {
    paint(meshes.cylinder,compose(world,translate(x,-1.43,0),scale(1.22,.20,1.22)),
      {tint:[.20,.34,.44],spec:.44,shine:55});
    paint(meshes.cylinder,compose(world,translate(x,-1.21,0),scale(1.12,.036,1.12)),
      {tint:i===0?[.78,.48,.31]:i===1?[.37,.59,.89]:[.15,.68,.61],spec:.72,shine:86});
    paint(meshes.cylinder,compose(world,translate(x,-1.161,0),scale(.95,.018,.95)),
      {tint:[.045,.11,.19],spec:.3,shine:45});
  }

  // Sphere: curved UV primitive + RGB brick as ALBEDO + height-field BUMP.
  paint(meshes.sphere,compose(world,translate(-3.45,-.12,0),rotateY(t*.16),scale(.91,.91,.91)),
    {texture:brick,mapping:1,bump:state.bump,tint:[1,.94,.88],spec:.12,shine:25});
  // Torus: curved UV primitive + supplied hex RGB NORMAL image + visible color texture.
  paint(meshes.torus,compose(world,translate(0,-.05,0),rotateX(.32+Math.sin(t*.46)*.11),rotateY(t*.21),scale(1.00,1.00,1.00)),
    {texture:hexNormal,normal:hexNormal,mapping:2,norm:state.normal,
     tint:[.70,.84,1],spec:.75,shine:72});
  // Cone: curved UV primitive; flowing pixels are uploaded to its GPU albedo map.
  paint(meshes.cone,compose(world,translate(3.45,-.10,0),rotateY(.10),scale(.89,.99,.89)),
    {texture:flowTexture,tint:[.9,1,1],spec:.52,shine:54});

  // Geometric decorative light markers (emissive mode) make two sources obvious.
  paint(meshes.sphere,compose(view,translate(...lightA),scale(.125,.125,.125)),
    {mapping:3,tint:[1,.74,.40]});
  paint(meshes.sphere,compose(view,translate(...lightB),scale(.12,.12,.12)),
    {mapping:3,tint:[.34,.78,1]});
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
