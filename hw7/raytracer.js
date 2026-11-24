// HW7 — The Last Voyage: all visible scene geometry is evaluated by ray tracing.
// A signed-distance scene enables intersections with the hull, sails, masts,
// glass lens, lighthouse, island, and animated sea. No rasterized 3-D meshes.
const VERTEX_SOURCE = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID == 2) ? 3.0 : -1.0,
                (gl_VertexID == 1) ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCamera;
uniform vec3 uTarget;
uniform float uLightA;
uniform float uLightB;
uniform float uWave;
uniform float uIOR;
uniform int uBounces;
uniform bool uShadows;
uniform bool uReflections;
uniform bool uRefraction;
uniform float uExposure;

#define FAR 60.0
#define EPS 0.0025
#define MAX_STEPS 90
#define PI 3.14159265359

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p,vec3 b) { vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdRoundBox(vec3 p,vec3 b,float r) { return sdBox(p,b)-r; }
float sdCapsule(vec3 p,vec3 a,vec3 b,float r) {
  vec3 ab=b-a; float t=clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0);
  return length(p-a-ab*t)-r;
}
float sdCylinder(vec3 p,float radius,float halfHeight) {
  vec2 d=abs(vec2(length(p.xz),p.y))-vec2(radius,halfHeight);
  return min(max(d.x,d.y),0.0)+length(max(d,0.0));
}
float sdEllipsoid(vec3 p, vec3 r) {
  float k0=length(p/r); float k1=length(p/(r*r));
  return k0*(k0-1.0)/max(k1,0.001);
}
vec2 add(vec2 a,vec2 b){return (a.x<b.x)?a:b;}
mat2 rot(float a) {float s=sin(a),c=cos(a);return mat2(c,s,-s,c);}
float waterHeight(vec2 x) {
  // Fade distant micro-waves to avoid horizon aliasing in ray-marched water.
  float fade=1.0-smoothstep(8.0,31.0,length(x));
  return uWave*(0.065*sin(x.x*1.55+x.y*1.12+uTime*0.85)
    +0.037*sin(x.x*2.7-x.y*2.3-uTime*1.13)*mix(0.35,1.0,fade)
    +0.014*sin(x.x*4.7+x.y*2.0+uTime*1.65)*fade);
}
vec3 shipLocal(vec3 p) {
  p.y -= 0.05*sin(uTime*1.1);
  p.xy = rot(-0.045*sin(uTime*0.73))*p.xy;
  p.yz = rot(-0.025*sin(uTime*0.92))*p.yz;
  return p;
}
// material IDs: 1 hull, 2 deck, 3 canvas, 4 brass, 5 mast,
// 6 cabin, 7 lighthouse glass, 8 sea, 9 rock, 10 lighthouse, 11 emission, 13 dark porthole, 14 crimson/gold signal pillar.
vec2 shipScene(vec3 p) {
  vec2 o=vec2(1e5,-1.0);
  vec3 q=shipLocal(p);
  float hull=sdRoundBox(q-vec3(0.0,-0.36,0.0),vec3(0.65,0.34,1.90),0.16);
  hull=min(hull,sdEllipsoid(q-vec3(0.0,-0.38,1.86),vec3(0.75,0.44,0.72)));
  hull=min(hull,sdEllipsoid(q-vec3(0.0,-0.41,-1.88),vec3(0.70,0.39,0.37)));
  o=add(o,vec2(hull,1.0));
  o=add(o,vec2(sdRoundBox(q-vec3(0.0,0.08,0.0),vec3(0.69,0.07,1.92),0.045),2.0));
  o=add(o,vec2(sdRoundBox(q-vec3(0.0,0.47,-1.49),vec3(0.43,0.25,0.40),0.025),6.0));
  o=add(o,vec2(sdRoundBox(q-vec3(0.0,0.78,-1.49),vec3(0.50,0.085,0.48),0.025),4.0));
  // Three vertical spars: two primary masts and a short bowsprit.
  o=add(o,vec2(sdCylinder(q-vec3(0.0,1.38,-0.54),0.066,1.29),5.0));
  o=add(o,vec2(sdCylinder(q-vec3(0.0,1.20,0.82),0.060,1.08),5.0));
  o=add(o,vec2(sdCapsule(q,vec3(0,0.23,1.72),vec3(0,0.35,2.75),0.04),5.0));
  // Two square sails billow independently of the ship's global animation.
  vec3 sail1=q-vec3(0.0,1.82,-0.54);
  sail1.z-=0.13*(1.0-smoothstep(0.05,0.82,abs(sail1.x)))*sin(uTime*0.98+sail1.x*2.5);
  o=add(o,vec2(sdRoundBox(sail1,vec3(0.80,0.55,0.022),0.018),3.0));
  vec3 sail2=q-vec3(0.0,1.50,0.82);
  sail2.z-=0.12*(1.0-smoothstep(0.05,0.67,abs(sail2.x)))*sin(uTime*0.98+sail2.x*2.3+0.6);
  o=add(o,vec2(sdRoundBox(sail2,vec3(0.67,0.45,0.024),0.015),3.0));
  o=add(o,vec2(sdCapsule(q,vec3(-0.92,2.37,-0.54),vec3(0.92,2.37,-0.54),0.042),5.0));
  o=add(o,vec2(sdCapsule(q,vec3(-0.78,1.96,0.82),vec3(0.78,1.96,0.82),0.037),5.0));
  // Raised railings and rail posts.
  for (int side=0;side<2;side++) {
    float sx=(side==0)?-0.69:0.69;
    o=add(o,vec2(sdCapsule(q,vec3(sx,0.47,-1.76),vec3(sx,0.47,1.53),0.023),4.0));
    for(int j=0;j<5;j++) {
      float zz=-1.55+float(j)*0.71;
      o=add(o,vec2(sdCapsule(q,vec3(sx,0.14,zz),vec3(sx,0.49,zz),0.021),4.0));
    }
  }
  // Brass portholes and dark iron cannonballs.
  for(int j=0;j<4;j++) {
    float zz=-1.45+float(j)*0.88;
    for(int s=0;s<2;s++) {
      float xx=(s==0)?-0.797:0.797;
      o=add(o,vec2(sdSphere(q-vec3(xx,-0.31,zz),0.104),4.0));
      o=add(o,vec2(sdSphere(q-vec3(xx*1.015,-0.31,zz),0.070),13.0));
    }
  }
  for (int i=0;i<3;i++) {
    o=add(o,vec2(sdSphere(q-vec3(-0.26+float(i)*0.15,0.22,-0.88),0.077),5.0));
  }
  return o;
}
vec2 islandScene(vec3 p) {
  vec2 o=vec2(1e5,-1.0);
  vec3 q=p-vec3(-3.2,-0.64,-1.9);
  float r=sdEllipsoid(q,vec3(1.12,0.51,1.03));
  r+=0.045*sin(q.x*10.0)*sin(q.z*9.0);
  o=add(o,vec2(r,9.0));
  vec3 l=p-vec3(-3.2,0.55,-1.9);
  o=add(o,vec2(sdCylinder(l,0.35,1.15),10.0));
  o=add(o,vec2(sdCylinder(p-vec3(-3.2,1.74,-1.9),0.45,0.10),4.0));
  o=add(o,vec2(sdSphere(p-vec3(-3.2,2.04,-1.9),0.35),7.0));
  o=add(o,vec2(sdSphere(p-vec3(-3.2,2.04,-1.9),0.095),11.0));
  o=add(o,vec2(sdCylinder(p-vec3(-3.2,2.40,-1.9),0.42,0.095),4.0));
  return o;
}
// A single high-contrast signal pillar stands just left of the lighthouse in
// the default camera view. Its center is BEHIND the glass lens along the view
// direction, so the sphere visibly refracts the crimson/gold stripes.
vec2 signalPillarScene(vec3 p) {
  vec3 q=p-vec3(-2.70,0.0,-3.10);
  vec2 o=vec2(1e5,-1.0);
  // Plinth rests at the waterline, the 2.8-unit shaft rises behind the lens.
  o=add(o,vec2(sdCylinder(q-vec3(0.0,-0.65,0.0),0.31,0.14),4.0));
  o=add(o,vec2(sdCylinder(q-vec3(0.0,0.66,0.0),0.19,1.34),14.0));
  // Brass retaining bands and a cap create crisp reflective details.
  o=add(o,vec2(sdCylinder(q-vec3(0.0,0.04,0.0),0.235,0.075),4.0));
  o=add(o,vec2(sdCylinder(q-vec3(0.0,1.36,0.0),0.235,0.075),4.0));
  o=add(o,vec2(sdCylinder(q-vec3(0.0,2.05,0.0),0.265,0.11),4.0));
  return o;
}
vec2 scene(vec3 p){
  vec2 o=vec2(p.y+0.79-waterHeight(p.xz),8.0);
  // Bounding boxes avoid costly SDF calls for distant sea/shadow rays.
  if(abs(p.x)<3.5 && abs(p.z)<4.0 && p.y<4.2) o=add(o,shipScene(p));
  if(abs(p.x+3.2)<1.6 && abs(p.z+1.9)<1.6 && p.y<3.1) o=add(o,islandScene(p));
  if(abs(p.x+2.70)<0.65 && abs(p.z+3.10)<0.65 && p.y<2.35) o=add(o,signalPillarScene(p));
  return o;
}
vec3 surfaceNormal(vec3 p){
  vec2 e=vec2(0.004,0.0);
  return normalize(vec3(
    scene(p+e.xyy).x-scene(p-e.xyy).x,
    scene(p+e.yxy).x-scene(p-e.yxy).x,
    scene(p+e.yyx).x-scene(p-e.yyx).x));
}
vec2 march(vec3 ro,vec3 rd) {
  float t=0.014;
  float id=-1.0;
  for(int i=0;i<MAX_STEPS;i++) {
    vec2 s=scene(ro+rd*t);
    if(abs(s.x)<EPS*(1.0+t*0.025)) return vec2(t,s.y);
    t+=clamp(abs(s.x)*0.75,0.006,1.6);
    if(t>FAR) break;
  }
  return vec2(FAR,-1.0);
}
float shadowRay(vec3 ro,vec3 rd,float maxt) {
  float t=0.025;
  float soft=1.0;
  for(int i=0;i<30;i++) {
    if(t>=maxt) break;
    vec2 s=scene(ro+rd*t);
    if(s.x<0.003 && s.y!=7.0) return 0.12;
    float d=max(abs(s.x),0.008);
    soft=min(soft,12.0*d/max(t,0.04));
    t+=clamp(d,0.022,0.8);
  }
  return clamp(soft,0.16,1.0);
}
vec3 sky(vec3 d){
  float h=smoothstep(-0.22,0.95,d.y);
  vec3 c=mix(vec3(0.96,0.48,0.34),vec3(0.12,0.21,0.41),h);
  c=mix(c,vec3(0.035,0.074,0.18),smoothstep(0.48,1.0,d.y)*0.67);
  // Golden sun: drawn by shader, not by rasterized geometry.
  vec3 sd=normalize(vec3(-0.46,0.24,-0.85));
  float a=max(dot(d,sd),0.0);
  c+=vec3(1.00,0.58,0.27)*pow(a,160.0)*0.9;
  c+=vec3(1.0,0.35,0.13)*pow(a,15.0)*0.20;
  float cloud=sin(d.x*22.0+d.z*19.0+sin(d.y*31.0)*2.0);
  c+=vec3(0.19,0.10,0.13)*smoothstep(0.55,0.95,cloud)*smoothstep(-0.02,0.20,d.y)*0.24;
  return c;
}
vec3 albedo(float m,vec3 p) {
  vec3 q=shipLocal(p);
  if(m==1.0) return mix(vec3(0.20,0.075,0.049),vec3(0.38,0.19,0.105),0.5+0.5*sin(q.z*14.0));
  if(m==2.0) return vec3(0.54,0.30,0.16)*(0.83+0.17*sin(q.z*27.0));
  if(m==3.0) {
    float seam=1.0-0.12*step(0.92,fract(q.y*7.2));
    return vec3(0.92,0.84,0.68)*seam;
  }
  if(m==4.0) return vec3(0.86,0.56,0.18);
  if(m==5.0) return vec3(0.24,0.16,0.11);
  if(m==6.0) return vec3(0.40,0.19,0.125);
  if(m==8.0) return vec3(0.032,0.17,0.245);
  if(m==9.0) return vec3(0.32,0.32,0.31)*(0.82+0.15*sin(p.x*14.0+p.z*9.0));
  if(m==13.0) return vec3(0.045,0.070,0.085); // Opaque dark portholes, not glass spheres.
  if(m==14.0) {
    // Alternating painted crimson and pale-gold bands are very legible
    // when distorted by the lighthouse's refractive glass sphere.
    float stripe=step(0.5,fract((p.y+0.70)*2.9));
    return mix(vec3(0.67,0.055,0.065),vec3(0.97,0.70,0.27),stripe);
  }
  if(m==10.0) {
    float stripe=step(0.5,fract((p.y+0.8)*0.75));
    return mix(vec3(0.87,0.83,0.67),vec3(0.58,0.13,0.12),stripe);
  }
  return vec3(0.75);
}
float reflectivity(float m,vec3 N,vec3 rd) {
  if(!uReflections) return 0.0;
  if(m==4.0) return 0.62;
  if(m==14.0) return 0.10;
  if(m==8.0) {
    float f=pow(1.0-clamp(dot(N,-rd),0.0,1.0),5.0);
    return 0.25+0.53*f;
  }
  if(m==1.0) return 0.06;
  if(m==9.0) return 0.03;
  return 0.035;
}
vec3 localLight(float m,vec3 p,vec3 n,vec3 rd) {
  if(m==11.0) return vec3(3.7,1.47,0.28)*(0.78+0.22*sin(uTime*2.4));
  vec3 base=albedo(m,p);
  vec3 c=base*vec3(0.13,0.16,0.23);
  vec3 positions[2]=vec3[2](vec3(-3.2,5.2,-1.4),vec3(4.4,3.5,3.7));
  vec3 colors[2]=vec3[2](vec3(1.0,0.70,0.40),vec3(0.33,0.65,1.0));
  float strengths[2]=float[2](uLightA,uLightB);
  for(int i=0;i<2;i++) {
    vec3 delta=positions[i]-p;
    float dist=length(delta);
    vec3 L=delta/dist;
    float ndl=max(dot(n,L),0.0);
    if(ndl<=0.0) continue;
    float visibility=uShadows?shadowRay(p+n*0.018,L,dist-0.1):1.0;
    float attenuation=1.0/(1.0+0.035*dist*dist);
    vec3 V=normalize(-rd);
    vec3 R=reflect(-L,n);
    float gloss=(m==4.0)?105.0:((m==8.0)?95.0:((m==14.0)?48.0:25.0));
    float spec=pow(max(dot(R,V),0.0),gloss);
    float kspec=(m==4.0)?1.25:((m==8.0)?1.2:((m==14.0)?0.42:0.16));
    c+=strengths[i]*visibility*attenuation*colors[i]*(base*ndl*0.82 + kspec*spec);
  }
  if(m==8.0){
    float foam=smoothstep(0.08,0.14,abs(waterHeight(p.xz)));
    c+=vec3(0.02,0.08,0.10)*foam;
  }
  return c;
}
vec3 traceRay(vec3 ro,vec3 rd){
  vec3 radiance=vec3(0.0);
  vec3 throughput=vec3(1.0);
  for(int bounce=0;bounce<6;bounce++) {
    if(bounce>=uBounces) { radiance+=throughput*sky(rd); break; }
    vec2 hit=march(ro,rd);
    if(hit.y<0.0) { radiance+=throughput*sky(rd); break; }
    vec3 p=ro+hit.x*rd;
    vec3 n=surfaceNormal(p);
    float m=hit.y;
    if(m==7.0) {
      vec3 V=normalize(-rd);
      vec3 lightDir=normalize(vec3(-3.2,5.2,-1.4)-p);
      float sparkle=pow(max(dot(reflect(-lightDir,n),V),0.0),100.0);
      radiance+=throughput*vec3(1.0,0.72,0.40)*sparkle*0.65*uLightA;
      if(!uRefraction) {
        radiance+=throughput*vec3(0.17,0.48,0.68);
        break;
      }
      bool exiting=dot(rd,n)>0.0;
      vec3 nf=exiting?-n:n;
      float eta=exiting?uIOR:(1.0/uIOR);
      vec3 refracted=refract(rd,nf,eta);
      float cosTheta=clamp(dot(-rd,nf),0.0,1.0);
      float f0=pow((uIOR-1.0)/(uIOR+1.0),2.0);
      float fresnel=f0+(1.0-f0)*pow(1.0-cosTheta,5.0);
      // The course permits a blend approach: add an environment reflection
      // weighted by Fresnel, then continue the iterative ray as transmission.
      // Total internal reflection falls back to a bounced reflection ray.
      vec3 reflected=reflect(rd,nf);
      radiance+=throughput*fresnel*(sky(reflected)*0.80+vec3(0.05,0.11,0.15));
      bool tir=dot(refracted,refracted)<0.005;
      rd=normalize(tir?reflected:refracted);
      ro=p+rd*0.028;
      throughput*=tir?vec3(0.95):vec3(0.89,0.96,0.99)*(1.0-fresnel);
      continue;
    }
    vec3 direct=localLight(m,p,n,rd);
    if(m==8.0) {
      // Atmospheric perspective integrates distant sea with the sky.
      float mist=smoothstep(13.0,45.0,hit.x)*0.52;
      direct=mix(direct,sky(normalize(vec3(rd.x,0.05,rd.z)))*0.65,mist);
    }
    float kr=reflectivity(m,n,rd);
    radiance+=throughput*direct*(1.0-kr);
    if(kr<0.01 || bounce==uBounces-1) break;
    throughput*=kr*mix(vec3(1.0),albedo(m,p),m==8.0?0.16:0.22);
    rd=reflect(rd,n);
    ro=p+rd*0.023;
  }
  return radiance;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uResolution)/uResolution.y;
  vec3 forward=normalize(uTarget-uCamera);
  vec3 right=normalize(cross(forward,vec3(0,1,0)));
  vec3 up=normalize(cross(right,forward));
  vec3 ray=normalize(forward+uv.x*right*1.40+uv.y*up*1.40);
  vec3 c=traceRay(uCamera,ray);
  c=vec3(1.0)-exp(-c*uExposure);
  c=pow(c,vec3(1.0/2.2));
  float vignette=1.0-0.23*dot(uv,uv);
  c*=vignette;
  outColor=vec4(clamp(c,0.0,1.0),1.0);
}`;
