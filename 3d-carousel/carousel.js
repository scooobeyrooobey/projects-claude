import * as THREE from 'three';

// ── Card Data ──
const BASE_CARDS = [
  { image: '3d-carousel-images/01_SS26 Mauritania Trip.png', title: 'SS26 Mauritania Trip' },
  { image: '3d-carousel-images/02_FW25 Campaign.png', title: 'FW25 Campaign' },
  { image: '3d-carousel-images/03_SS26 Lookbook.png', title: 'SS26 Lookbook' },
  { image: '3d-carousel-images/04_SS25 Lookbook.png', title: 'SS25 Lookbook' },
  { image: '3d-carousel-images/05_SS25 Campaign.png', title: 'SS25 Campaign' },
  { image: '3d-carousel-images/06_FW25 Lookbook.png', title: 'FW25 Lookbook' },
  { image: '3d-carousel-images/07_SS24 Campaign.png', title: 'SS24 Campaign' },
  { image: '3d-carousel-images/08_FW24 Campaign.png', title: 'FW24 Campaign' },
  { image: '3d-carousel-images/09_SS24 Campaign.png', title: 'SS24 Campaign' },
  { image: '3d-carousel-images/10_FW24 Lookbook.png', title: 'FW24 Lookbook' },
  { image: '3d-carousel-images/11_SS24 Lookbook.png', title: 'SS24 Lookbook' },
  { image: '3d-carousel-images/12_SS23 Lookbook.png', title: 'SS23 Lookbook' },
  { image: '3d-carousel-images/13_FW23 Lookbook.png', title: 'FW23 Lookbook' },
];

// Duplicate to 26 cards
const cards = [...BASE_CARDS, ...BASE_CARDS];

// ── Constants ──
const CARD_COUNT = cards.length;
const ANGLE_STEP = (Math.PI * 2) / CARD_COUNT;

// Base scene dimensions — camera and geometry use these
// Group.scale makes everything viewport-relative
const RADIUS = 480;           // +20% от предыдущих 400
const CARD_W = 200;
const CARD_H = 136;

// ~55° Y-offset — selected card toward upper-left of carousel area
const ROTATION_OFFSET = Math.PI * 275 / 180; // 255° + 20°

// Animation
const LERP = 0.07;
const SCROLL_THRESHOLD = 50;
const SCROLL_COOLDOWN = 520;
const LIFT_PX = 100;          // lift along Y axis
const LIFT_MS = 300;

// ── Easing ──
function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── DOM ──
const container = document.getElementById('carousel-container');
const selectedImage = document.getElementById('selected-image');
const selectedTitle = document.getElementById('selected-title');
const selectCard = document.querySelector('.select-card');

// ── State ──
let currentIndex = 0;
let targetRot = 0;
let currentRot = 0;
let scrollAcc = 0;
let onCooldown = false;

// Mouse tilt state
let mouseNX = 0, mouseNY = 0;   // normalized mouse [-1, 1]
let tiltX = 0, tiltY = 0;       // current tilt values (lerped)
const MAX_TILT_X = 0.40;        // max vertical tilt ~23°
const MAX_TILT_Y = 0.55;        // max horizontal tilt ~31°
const TILT_LERP = 0.04;         // smoothing factor

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Camera fixed — scaling handled by group.scale
const camera = new THREE.PerspectiveCamera(55, 1, 1, 6000);
camera.position.set(0, 300, 1500);
camera.lookAt(0, -80, 0);

// Renderer — appended to body so it covers full viewport (no clipping)
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ── Tilt Group — mouse-following wrapper ──
const tiltGroup = new THREE.Group();
tiltGroup.position.y = -89;   // shifted 20px more down
tiltGroup.position.x = 11;   // shifted 30px right (~56 world units)
scene.add(tiltGroup);

// ── Carousel Group — child of tiltGroup ──
const carouselGroup = new THREE.Group();
carouselGroup.rotation.x = 10 * Math.PI / 180;  // 10° stack tilt
tiltGroup.add(carouselGroup);

// ── Cards ──
const meshes = [];
const textureLoader = new THREE.TextureLoader();

cards.forEach((card, i) => {
  const texture = textureLoader.load(card.image);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);

  const angle = i * ANGLE_STEP;
  mesh.position.set(
    Math.sin(angle) * RADIUS,
    0,
    Math.cos(angle) * RADIUS
  );
  // +90° so cards show edge-on
  mesh.rotation.y = angle + Math.PI / 2;

  // Per-card Y-lift animation state
  mesh.userData = {
    currentLift: 0,
    targetLift: 0,
    startLift: 0,
    animating: false,
    animStart: 0,
  };

  carouselGroup.add(mesh);
  meshes.push(mesh);
});

// Lift initial active card on Y
meshes[0].position.y = LIFT_PX;
meshes[0].userData.currentLift = LIFT_PX;
meshes[0].userData.targetLift = LIFT_PX;

// ── Viewport-Relative Scale ──
// Carousel scales proportionally to container size.
// Reference height: 830px → scale 1.0
const SCALE_REF = 830;

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Scale group so carousel fills the viewport proportionally
  const scale = Math.min(w, h) / SCALE_REF * 1.2; // 1.5 * 0.8 = -20%
  carouselGroup.scale.setScalar(scale);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener('resize', onResize);
onResize();

// ── Select Card Panel ──
function updatePanel(dir) {
  const idx = ((currentIndex % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
  const exitClass    = dir >= 0 ? 'select-card--fading'          : 'select-card--fading-reverse';
  const incomingClass = dir >= 0 ? 'select-card--incoming'        : 'select-card--incoming-reverse';

  selectCard.classList.add(exitClass);
  // 270ms > 220ms transition — ensures exit animation is fully complete before swap
  setTimeout(() => {
    selectedImage.src = cards[idx].image;
    selectedImage.alt = cards[idx].title;
    selectedTitle.textContent = cards[idx].title;

    // Instantly reposition to enter-start, no transition
    selectCard.classList.remove(exitClass);
    selectCard.classList.add(incomingClass);
    void selectCard.offsetWidth; // force reflow to register new position

    // Wait for image to decode, then trigger enter animation
    selectedImage.decode()
      .catch(() => {})
      .then(() => selectCard.classList.remove(incomingClass));
  }, 270);
}

selectedImage.src = cards[0].image;
selectedImage.alt = cards[0].title;
selectedTitle.textContent = cards[0].title;

// ── Card Lift Animation (Y axis) ──
function animateLift(index, targetLift) {
  const idx = ((index % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
  const u = meshes[idx].userData;
  u.startLift = u.currentLift;
  u.targetLift = targetLift;
  u.animating = true;
  u.animStart = performance.now();
}

// ── Scroll Handler ──
function handleScroll(delta) {
  if (onCooldown) return;
  scrollAcc += delta;

  if (Math.abs(scrollAcc) >= SCROLL_THRESHOLD) {
    const dir = scrollAcc > 0 ? 1 : -1;
    scrollAcc = 0;

    animateLift(currentIndex, 0);
    currentIndex += dir;
    targetRot = currentIndex * -ANGLE_STEP;
    animateLift(currentIndex, LIFT_PX);
    updatePanel(dir);

    onCooldown = true;
    setTimeout(() => { onCooldown = false; }, SCROLL_COOLDOWN);
  }
}

window.addEventListener('wheel', (e) => {
  e.preventDefault();
  handleScroll(e.deltaY);
}, { passive: false });

let touchY = 0;
window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchmove', (e) => {
  e.preventDefault();
  handleScroll(touchY - e.touches[0].clientY);
  touchY = e.touches[0].clientY;
}, { passive: false });

// ── Mouse tilt tracking ──
// Use the full page so tilt works even when cursor is over the left panel
window.addEventListener('mousemove', (e) => {
  // Normalize relative to full viewport center → [-1, 1]
  mouseNX = (e.clientX / window.innerWidth)  * 2 - 1;
  mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
});

// Ease back to neutral when cursor leaves window
window.addEventListener('mouseleave', () => {
  mouseNX = 0;
  mouseNY = 0;
});

// ── Animation Loop ──
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();

  // Mouse tilt — lerp toward target
  tiltX += (mouseNY * MAX_TILT_X - tiltX) * TILT_LERP;
  tiltY += (mouseNX * MAX_TILT_Y - tiltY) * TILT_LERP;
  tiltGroup.rotation.x = tiltX;
  tiltGroup.rotation.y = tiltY;

  // Smooth group Y rotation + 30° offset to put selected card on the left
  currentRot += (targetRot - currentRot) * LERP;
  carouselGroup.rotation.y = currentRot + ROTATION_OFFSET;

  // Per-card Y lift
  meshes.forEach((mesh) => {
    const u = mesh.userData;
    if (!u.animating) return;

    const t = Math.min((now - u.animStart) / LIFT_MS, 1);
    u.currentLift = u.startLift + (u.targetLift - u.startLift) * easeInOutSine(t);
    mesh.position.y = u.currentLift;

    if (t >= 1) {
      u.currentLift = u.targetLift;
      mesh.position.y = u.targetLift;
      u.animating = false;
    }
  });

  renderer.render(scene, camera);
}

animate();
