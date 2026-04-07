# 3D Carousel Project

## Stack
Vanilla HTML + CSS + Three.js (CDN). No build tools.

## Structure
- index.html — page structure, font/lib imports
- styles.css — layout and typography
- carousel.js — Three.js scene, carousel logic
- logo.png — brand logo (NOIA)
- 3d-carousel-images/ — 13 card images (PNG)

## Conventions
- CSS custom properties for repeated values (colors, sizes, timing)
- BEM-lite naming for CSS classes
- Comments in English, UI text as-is from design
- No npm/build — all via CDN

## 3D Carousel (Three.js)
- PerspectiveCamera + WebGLRenderer
- 13 PlaneGeometry meshes with image textures
- Cylinder arrangement: radius ~800, angle step 2pi/13
- Group rotation with lerp easing
- Scroll/touch driven

## Fonts
- Inter (Google Fonts) — nav, body text
- Apple Garamond Light (system) — card titles, fallback: Garamond, serif
