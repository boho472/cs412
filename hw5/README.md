# CS 412/512 — Homework 5: Lighting & Shading
**Student:** Junho Lee

## Overview
Extended the provided `hw5.html`, `main.js`, `models.js`, and `transforms.js` instructor template into an interactive **Lighting & Shading Laboratory**. The rendering pipeline and live GLSL shader editors from the template are preserved.

## Rubric checklist

### 1. Hierarchical geometric primitives (2 points)

The robotic arm has **six articulated levels**, with the parent's joint transform inherited by each child:

```
Base (cylinder)                              — Level 1
└── Shoulder / lower arm (cylinder)          — Level 2
    └── Elbow / upper arm (cube)             — Level 3
        └── Wrist (torus)                    — Level 4
            └── Gripper (cylinder)          — Level 5
                ├── Left finger (cube)      — Level 6
                │   └── Tip (cone)
                └── Right finger (cube)     — Level 6
                    └── Tip (cone)
```

Additional *sphere* primitive instances form the bearings and sample object. **Five distinct primitive types** appear in the actual hierarchical model: cube, cylinder, sphere, cone, torus.

Each part gets its own geometry scale/offset (`node.shape`), and descendants inherit only the joint frame (`node.joint`). The recursion in `drawTree` uses `childFrame = parentFrame × node.joint`, with the geometry separately drawn using `childFrame × node.shape`. This keeps parent scaling from incorrectly stretching the children.

### 2. Reflection and shading (4 points)

- **Diffuse + specular (Phong) reflection:** `main.js` fragment shader evaluates Lambertian diffuse and a Phong reflection-vector specular highlight for each light. The lower arm is shiny/metallic; the upper arm is matte/diffuse. Sliders can dynamically adjust both materials.
- **Flat vs. smooth shading:** The two side spheres have *identical tessellation and color/material*. The left mesh uses `makeFlatShaded()` to duplicate each triangle's vertices and assign the same face normal to all three. The right mesh uses analytic smooth sphere vertex normals, interpolated by the GPU. The contrast is shown simultaneously.
- **Correct normal transformation:** The vertex shader uses the inverse transpose of the model-view matrix to keep normals accurate under nonuniform scaling.

### 3. Two light sources (2 points)

- **Warm Key Light A** at world position `[3.5, 3.1, 2.6]`.
- **Cool Fill Light B** at world position `[-3.3, 2.0, -1.5]`.

Light positions are transformed from world to eye space every frame. Both intensities are adjustable independently. The small emissive spheres visualize the sources.

### 4. Interactive controls (4 points)

- **Additional joint movement UI:** sliders for shoulder, elbow, wrist, and finger opening, beyond the original whole-model rotation controls. Parents carry their children, so moving the shoulder affects the elbow, wrist, and gripper.
- **Per-part material UI:** independent specular sliders for the lower (metal) and upper (matte) arms, plus a highlight sharpness slider.
- **Light UI:** independent brightness sliders for both lights.

Original starter controls preserved: whole-model rotation angle, axis selector, Start/Stop Rotation, mouse orbit, keyboard camera movement, and live editable vertex/fragment shaders.

### 5. Creativity (+1 bonus candidate)

Custom dark laboratory UI, floor grid, colored emissive light indicators, flat/smooth side-by-side shading exhibit, robot gripper with sample sphere, optional joint choreography, and Reset Pose.

## Running

Place **all four code files in the same folder**:

```
HW5_Junho_Lee/
├── hw5.html
├── main.js
├── models.js
├── transforms.js
└── README.md
```

From the folder containing `hw5.html`, launch a local server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/hw5.html> in Chrome (WebGL2 required).

## Submission via GitHub Pages

If the repository is `https://github.com/boho472/cs412`, place the four code files and README into `cs412/hw5/`. When the Pages deployment succeeds, use:

<https://boho472.github.io/cs412/hw5/hw5.html>

The above is a *proposed* URL; verify deployment in your own browser. **Do not push further commits after the deadline** if submitting a Pages URL, per the instructor's timestamp warning.

Alternatively upload a ZIP of the `HW5_Junho_Lee` folder to Canvas.
