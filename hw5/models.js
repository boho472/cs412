// HW5 primitives: positions, normals and triangle indices.
// Every mesh uses the same layout expected by the provided WebGL template.

function createCube() {
  const positions = new Float32Array([
    -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
     1,-1,-1, -1,-1,-1, -1, 1,-1,  1, 1,-1,
    -1, 1, 1,  1, 1, 1,  1, 1,-1, -1, 1,-1,
    -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1,
     1,-1, 1,  1,-1,-1,  1, 1,-1,  1, 1, 1,
    -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1
  ]);
  const faces = [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]];
  const normals = new Float32Array(faces.flatMap(n => [ ...n, ...n, ...n, ...n ]));
  const indices = new Uint16Array(Array.from({ length: 6 }, (_, i) => {
    const o = i * 4;
    return [o, o+1, o+2, o, o+2, o+3];
  }).flat());
  return { positions, normals, indices };
}

// A cylinder with smooth side normals and flat cap normals.
function createCylinder(segments = 32) {
  const pos=[], nrm=[], idx=[];
  for (let i=0; i<=segments; i++) {
    const a=i*Math.PI*2/segments, x=Math.cos(a), z=Math.sin(a);
    pos.push(x,-1,z, x,1,z);
    nrm.push(x,0,z, x,0,z);
  }
  for (let i=0; i<segments; i++) {
    const b=i*2; idx.push(b,b+1,b+3, b,b+3,b+2);
  }
  for (const y of [-1, 1]) {
    const center=pos.length/3;
    pos.push(0,y,0); nrm.push(0,y,0);
    for (let i=0; i<=segments; i++) {
      const a=i*Math.PI*2/segments;
      pos.push(Math.cos(a),y,Math.sin(a)); nrm.push(0,y,0);
    }
    for (let i=1; i<=segments; i++) {
      if (y>0) idx.push(center, center+i+1, center+i);
      else idx.push(center, center+i, center+i+1);
    }
  }
  return { positions:new Float32Array(pos), normals:new Float32Array(nrm), indices:new Uint16Array(idx) };
}

// Sphere uses smoothly varying analytic normals at shared vertices.
function createSphere(slices = 28, stacks = 18) {
  const pos=[], nrm=[], idx=[];
  for (let j=0; j<=stacks; j++) {
    const phi=Math.PI*j/stacks;
    for (let i=0; i<=slices; i++) {
      const theta=2*Math.PI*i/slices;
      const x=Math.sin(phi)*Math.cos(theta);
      const y=Math.cos(phi);
      const z=Math.sin(phi)*Math.sin(theta);
      pos.push(x,y,z); nrm.push(x,y,z);
    }
  }
  const n=slices+1;
  for (let j=0; j<stacks; j++) for (let i=0; i<slices; i++) {
    const a=j*n+i, b=a+n;
    idx.push(a,a+1,b, b,a+1,b+1);
  }
  return { positions:new Float32Array(pos), normals:new Float32Array(nrm), indices:new Uint16Array(idx) };
}

// Crucial HW5 comparison: same triangle positions, but NO vertex sharing.
// Every triangle gets a single face normal -> constant shading across the triangle.
function makeFlatShaded(source) {
  const pos=[], nrm=[], idx=[];
  const p=source.positions, original=source.indices;
  for (let i=0; i<original.length; i+=3) {
    const a=original[i]*3, b=original[i+1]*3, c=original[i+2]*3;
    const ax=p[a], ay=p[a+1], az=p[a+2];
    const bx=p[b], by=p[b+1], bz=p[b+2];
    const cx=p[c], cy=p[c+1], cz=p[c+2];
    const ux=bx-ax, uy=by-ay, uz=bz-az;
    const vx=cx-ax, vy=cy-ay, vz=cz-az;
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    const magnitude=Math.hypot(nx,ny,nz);
    if (magnitude<1e-8) {
      // Triangles at UV sphere poles may be degenerate. Reuse analytic normal.
      nx=source.normals[a]; ny=source.normals[a+1]; nz=source.normals[a+2];
    } else { nx/=magnitude; ny/=magnitude; nz/=magnitude; }
    const offset=pos.length/3;
    pos.push(ax,ay,az, bx,by,bz, cx,cy,cz);
    nrm.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
    idx.push(offset,offset+1,offset+2);
  }
  return { positions:new Float32Array(pos), normals:new Float32Array(nrm), indices:new Uint16Array(idx) };
}

function createCone(segments=32) {
  const pos=[], nrm=[], idx=[];
  const add=(x,y,z,n)=>{
    const at=pos.length/3; pos.push(x,y,z); nrm.push(...n); return at;
  };
  for (let i=0; i<segments; i++) {
    const a=2*Math.PI*i/segments, b=2*Math.PI*(i+1)/segments;
    const mid=(a+b)/2, nx=Math.cos(mid), nz=Math.sin(mid);
    const len=Math.hypot(nx,0.5,nz), normal=[nx/len,0.5/len,nz/len];
    const i0=add(0,1,0,normal), i1=add(Math.cos(a),-1,Math.sin(a),normal), i2=add(Math.cos(b),-1,Math.sin(b),normal);
    idx.push(i0,i1,i2);
  }
  const center=add(0,-1,0,[0,-1,0]);
  for (let i=0; i<segments; i++) {
    const a=2*Math.PI*i/segments, b=2*Math.PI*(i+1)/segments;
    const i0=add(Math.cos(a),-1,Math.sin(a),[0,-1,0]);
    const i1=add(Math.cos(b),-1,Math.sin(b),[0,-1,0]);
    idx.push(center,i0,i1);
  }
  return { positions:new Float32Array(pos), normals:new Float32Array(nrm), indices:new Uint16Array(idx) };
}

function createTorus(major=0.78, minor=0.22, rings=36, tubes=16) {
  const pos=[], nrm=[], idx=[];
  for (let i=0; i<=rings; i++) {
    const u=2*Math.PI*i/rings, cu=Math.cos(u), su=Math.sin(u);
    for (let j=0; j<=tubes; j++) {
      const v=2*Math.PI*j/tubes, cv=Math.cos(v), sv=Math.sin(v);
      pos.push((major+minor*cv)*cu,minor*sv,(major+minor*cv)*su);
      nrm.push(cv*cu,sv,cv*su);
    }
  }
  const n=tubes+1;
  for (let i=0; i<rings; i++) for (let j=0; j<tubes; j++) {
    const a=i*n+j, b=a+n;
    idx.push(a,b,a+1, b,b+1,a+1);
  }
  return { positions:new Float32Array(pos), normals:new Float32Array(nrm), indices:new Uint16Array(idx) };
}
