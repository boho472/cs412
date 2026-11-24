# HW7 — The Last Voyage (Junho Lee)

University of New Mexico — CS 412 / 512 Computer Graphics

## Live link (after publishing to GitHub Pages)

https://boho472.github.io/cs412/hw7/hw7.html

For HW7, I implemented ray tracing using my sailing ship from HW3, adding realistic light transport, reflective brass, glass refraction, and an animated sea.

A red-and-gold signal pillar is placed behind the single glass sphere on the lighthouse to demonstrate refraction.

## Files

- `hw7.html` — UI and canvas. Open this URL directly when deployed.
- `raytracer.js` — GLSL ES 3.00 vertex and fragment shader code.
- `main.js` — WebGL2 host, controls, camera orbit, animation loop.
- `README.md` — details and testing instructions.

No 3D meshes, image assets, libraries or network calls are required. The scene
is entirely procedural. A fullscreen triangle is rasterized **only to generate
screen fragments**; every visible 3D object is intersected by scene ray tracing.

## Requirements / grading demonstration

1. **Intersections** — Signed distance functions (box, rounded box, ellipsoid,
   cylinder, sphere and capsules) are combined into a scene SDF. Iterative ray
   marching finds the nearest surface hit and estimates a normal by finite
   differences. This covers the boat, two square sails, rigging, lighthouse,
   the lighthouse glass lens, a striped signal pillar and the ocean.
2. **Local Phong** — Ambient, Lambertian diffuse and specular components are
   computed per hit in `localLight`. Materials have distinct albedo and gloss.
3. **Ray-traced shadows** — Each non-glass surface traces secondary rays toward
   both lights (`shadowRay`). A soft visibility term approximates penumbrae.
4. **Recursive reflection without GLSL recursion** — `traceRay` iterates up to
   six bounces while accumulating color and throughput. Brass and water reflect
   subsequent scene hits; the water uses angle-dependent Fresnel reflectivity.
5. **Glass refraction** — Material 7 uses Snell's law (`refract`), the correct
   entering/exiting IOR ratio, total-internal-reflection fallback and Schlick
   Fresnel blend. The lighthouse lens is the only glass sphere in the scene. The striped
   pillar sits behind that lens from the default camera view and its bands
   visibly bend when seen through the glass. The
   ship portholes use an opaque dark material, and there are no extra glass orbs
   on the ship or floating above the ocean.
6. **Two lights** — Warm gold key light and cool blue fill are independent,
   both affecting diffuse/specular lighting and cast shadows.
7. **Interactive controls** — Bounce count, IOR, shadow/reflection/refraction
   toggles, both light intensities, wave height, exposure,
   orbit/zoom, reset camera and pause animation.
8. **Bonus effects** — Procedural animated ocean, ship bob/roll, billowing sails,
   sunset sky, lighthouse glow, reflected ship/lighthouse and glass optics.

## Running locally

From the root of your `cs412` repository:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/hw7/hw7.html in Chrome or Safari. A modern browser
with WebGL2 enabled is required. The canvas always renders at 100% of its CSS
resolution (no resolution slider). On slower computers, lower the maximum bounce
count to improve responsiveness.

## Submission

Copy this directory into `cs412/hw7/`, then:

```bash
git add hw7

git commit -m "Add HW7 ray traced sailing ship"

git push origin main
```

Wait for the **pages build and deployment** workflow to succeed, then verify
https://boho472.github.io/cs412/hw7/hw7.html from a fresh browser tab and
submit that direct page URL to Canvas. Do not submit the repository URL.

## How to explain it to the instructor

> I reconstructed my HW3 ship as a signed-distance-field scene and ray marched
> it in the fragment shader. Each ray finds the nearest intersection, then I
> calculate local Phong illumination and shadow rays from two lights. I use a
> loop to simulate recursive reflection bounces, and Snell's law to refract
> rays through the lighthouse glass lens. The controls let me
> demonstrate each effect individually.

For the live demo: disable reflections, toggle shadows, alter glass IOR, then
increase bounce count from 1 to 4 to show the different light paths.

## Note on rendering

This is sphere tracing / SDF ray marching (a ray-tracing intersection method),
not a conventional triangle-mesh rasterizer. The glass reflection uses a
Schlick-weighted environment blend, while transmission continues as a traced
ray. Attenuation is included in direct lighting.
