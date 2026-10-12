# CS 412 / 512 — Homework 4: Hierarchical Modeling

**Student:** Junho Lee  
**Demo:** `hw4.html`

## Running

From this directory, run:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000/hw4.html` in a browser with WebGL2 enabled. The project uses no CDN or external library.

## Requirements

**Hierarchical structures (2 pts):** 5 levels: (1) rotating base → (2) shoulder → (3) elbow → (4) wrist → (5) two-finger gripper. See `buildHierarchy()` in `hw4.html` for the explicit parent-to-child matrix chain. Changes to an upstream joint propagate to all downstream joints.

**Model movements (2 pts):** All five levels move. The base rotates about Y; the shoulder, elbow, and wrist pitch about local Z; the gripper jaws open and close.

**Two or more UI elements (2 pts):** Five independent joint sliders; a Start/Pause auto demo button; reset pose; animation speed; camera projection and reset buttons. Mouse drag orbits the scene and the wheel zooms.

**Creative effects (bonus):** Individually lit 3D primitive meshes, pulsing emissive accent rings, animated floating energy core, illuminated reference grid, and a toggleable glowing end-effector motion trail.

## Files

- `hw4.html` — UI, shaders, hierarchy, input, drawing, animation.
- `primitives.js` — 3D primitive mesh generators reused from HW3.
- `transformations.js` — matrix/projection functions reused from HW3.
