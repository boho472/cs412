# UNM CS 412 — HW6: Texture Motion Laboratory
**Student:** Junho Lee
**Main entrypoint:** `hw6.html`
**GitHub Pages link after publishing:** https://boho472.github.io/cs412/hw6/hw6.html

Built by extending the professor's HW6 WebGL2 template (`hw6.html`, `main.js`, `models.js`, `transforms.js`). The original live GLSL editor, mouse orbit, keyboard camera movement, rotation slider, axis dropdown, and spinning button are preserved.

## Rubric map

| Requirement | Where to look |
| --- | --- |
| Three **new** textured geometric primitive types (6 pts) | `models.js`: `createSphere`, `createTorus`, `createCone` all generate explicit positions, normals, tangents, UVs and triangle indices; `main.js` renders all three visibly with textures. Sphere, torus and cone are all curved. Cube and cylinder from the template additionally form the exhibit floor and pedestals. |
| Animated texture (2 pts) | Right **cone**: `paintFlow()` redraws a 512×512 Canvas2D texture with scrolling, layered, glowing wavefronts. `gl.texImage2D` uploads changed pixel data to the GPU repeatedly in the render loop, so the surface pattern flows even with geometry rotation switched off. The *Texture flow speed* slider and *Pause flowing texture* button control it. This is a live animated GPU texture, rather than a static GIF sampled once. |
| Bump mapping (2 pts) | Left **sphere** uses the supplied `textures/brick.png`. GLSL `heightFromBrick` obtains height from grayscale luminance, and samples its UV finite-difference gradient to perturb the surface normal using a TBN tangent frame. The *Bump strength* slider can be set to zero for comparison. |
| Normal mapping (2 pts) | Middle **torus** samples `textures/texture2.jpg` as a tangent-space RGB normal image, decodes `rgb * 2 - 1`, transforms it through a TBN frame and applies Phong lighting. The *Normal strength* slider can be set to zero for comparison. |
| Creativity (optional +1) | Gallery/exhibition design, 3D UV grid floor, colored displays, two movable colored point lights, editable shaders, floating animated textured cone, independent material controls, camera controls and responsive interface. |
| Submission | Publish **all files** and submit the direct GitHub Pages URL `.../cs412/hw6/hw6.html`, not the repository URL. |

**Important note:** At least three primitives are genuinely created beyond the provided cube and cylinder. Mapping textures onto three copies of one primitive would not satisfy the three-type requirement; this implementation uses distinct sphere, torus and cone generators.

## Folder contents

```
hw6/
├── hw6.html                # HTML / CSS / UI / canvas
├── main.js                 # shaders, textures, animation, lighting and renderer
├── models.js               # five UV geometry generators
├── transforms.js           # inherited matrix utilities and scale/compose
├── textures/
│   ├── brick.png           # supplied brick image for bump + albedo
│   └── texture2.jpg        # supplied RGB tangent-space normal map
└── README.md
```

## Run locally

Texture images require HTTP(S), rather than `file://`.

```bash
cd hw6
python3 -m http.server 8000
```

Open `http://localhost:8000/hw6.html`. If port 8000 is in use, choose another port (`python3 -m http.server 8765`).

## GitHub Pages deployment

From the root of your existing `cs412` clone:

```bash
# Copy or unzip this HW6_Junho_Lee folder into the repository as hw6
# Then check the files exist as cs412/hw6/hw6.html and cs412/hw6/textures/brick.png

git add hw6
git commit -m "Add HW6 texture mapping and animated materials"
git push origin main
```

Ensure Settings → Pages publishes from **main** / **root**, and verify the **pages build and deployment** workflow reaches Success. Open `https://boho472.github.io/cs412/hw6/hw6.html` and confirm images load and controls affect the render. Don't push edits after the course deadline.

## Interactive controls

- Drag inside the WebGL viewport: orbit the entire exhibit.
- Mouse wheel or W/S: zoom. Arrow keys: translate camera.
- Rotation angle / axis / Start rotation: original template controls.
- Bump strength: left sphere's **computed height perturbation**, 0 = no bump.
- Normal strength: middle torus' **RGB normal perturbation**, 0 = unperturbed geometric normal.
- Texture flow speed / pause: right cone's independent **dynamic texture animation**.
- Two lighting sliders: warm key and cool fill brightness.
- Orbit light sources: toggles light movement.
- Show exhibition floor: toggles grid platform.
- Reset camera & controls: restores gallery settings.
- Expand "Editable GLSL shaders" to edit vertex/fragment shaders, with live compile errors and old shader retained on failure.

## Math and technical notes

The per-object vertex shader computes eye-space position and **inverse-transpose** transformed normal, so the floor, pedestals and textured models remain correct after nonuniform scaling. The fragment shader orthogonalizes `T` against `N` and constructs `TBN = mat3(T, cross(N,T), N)`.

For bump mapping, define `h(u,v) = 1 - (0.299 R + 0.587 G + 0.114 B)` and approximate partial derivatives by central differences at neighboring texels. The perturbed normal is `normalize(TBN * normalize(vec3(-strength * dh/du, -strength * dh/dv, 1)))`.

For normal mapping, decode `n_tex = 2 * texture(normalMap, uv).rgb - 1`, scale its XY components by a UI parameter, and transform the normalized tangent-space normal through the same TBN basis. The height-gradient computation and RGB normal decoding are **separate algorithms** rather than relabeling the same shader calculation.

For animation, each CPU Canvas2D redraw modifies actual albedo pixels. Each update uploads its pixel data to an existing `WebGLTexture` using `gl.texImage2D`. No external GIF/video codecs or cross-origin assets are required. The animated texture continues to update while the mesh is stationary and is fully GitHub Pages-compatible.

## Final visual QA before submitting

1. Confirm **sphere** shows photo bricks, **torus** shows blue/purple hexagon texture, and **cone** shows flowing cyan/gold bands.
2. Pause **Start rotation** (if active) and check the cone's pattern **still moves**. Then pause flowing texture and check pattern stops.
3. Set bump strength to 0 and 15; observe changed brick relief shading on sphere. Set normal strength to 0 and 2; observe changed highlights on torus.
4. Drag to orbit. Adjust each light brightness independently. Verify Chrome Developer Tools (F12) shows no errors and all assets have HTTP 200 responses.
5. Open the **published GitHub Pages link** in a private window to verify access.

