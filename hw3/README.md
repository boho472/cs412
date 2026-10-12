CS 412 HW3 - Junho Lee

https://boho472.github.io/cs412/hw3/hw3.html

I made a ship instead of just putting shapes in a row. Added cylinder,
cone, sphere, torus to primitives.js. Masts are cylinders, the cabin
roof is a cone, cannonballs are spheres. There's a menu to switch to
just the 5 shapes if you want to see them by themselves.

The ship bobs up and down and rolls a bit, and the sails scale and
shear so they look like they're catching wind. Checkboxes to turn each
transformation on/off, speed slider, and a button for
perspective/orthographic.

Needs to be opened over http, file:// doesn't load the js files in
Chrome. python3 -m http.server 8000
