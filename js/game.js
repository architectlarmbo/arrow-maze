/* ============ PHASE 3: LEVEL MAKER ============ */
// Each arrow is a straight line of cells (tail first, head last) that slides out the way it points.
// We place arrows at random, then simulate clearing them. Any arrow that could never be cleared is dropped,
// so every level is guaranteed to be solvable.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gridSize(level) {
  return Math.min(5 + Math.floor(level / 2), 9);
}

function makeLevel(level) {
  const N = gridSize(level);
  for (let attempt = 0; attempt < 200; attempt++) {
    const rand = rng(level * 977 + attempt * 31 + 7);
    const occ = Array.from({ length: N }, () => Array(N).fill(-1));
    const arrows = [];
    const maxLen = level < 2 ? 3 : 4;
    let covered = 0;
    for (let t = 0; t < 800 && covered < N * N * 0.55; t++) {
      const horiz = rand() < 0.5;
      const len = 2 + Math.floor(rand() * (maxLen - 1));
      const sign = rand() < 0.5 ? 1 : -1;
      const r0 = Math.floor(rand() * N),
        c0 = Math.floor(rand() * N);
      const cells = [];
      let ok = true;
      for (let i = 0; i < len; i++) {
        const r = horiz ? r0 : r0 + i,
          c = horiz ? c0 + i : c0;
        if (r >= N || c >= N || occ[r][c] !== -1) {
          ok = false;
          break;
        }
        cells.push([r, c]);
      }
      if (!ok) continue;
      if (sign === -1) cells.reverse(); // head is the last cell
      const dir = horiz ? [0, sign] : [sign, 0];
      const id = arrows.length;
      cells.forEach(([r, c]) => (occ[r][c] = id));
      arrows.push({ id, cells, dir });
      covered += len;
    }
    // simulate clearing; keep only arrows that can be cleared
    const live = new Set(arrows.map((a) => a.id));
    const o = occ.map((row) => row.slice());
    let progress = true;
    while (progress) {
      progress = false;
      for (const a of arrows) {
        if (!live.has(a.id)) continue;
        if (pathFree(a, o, N)) {
          a.cells.forEach(([r, c]) => (o[r][c] = -1));
          live.delete(a.id);
          progress = true;
        }
      }
    }
    const keep = arrows.filter((a) => !live.has(a.id));
    if (keep.length >= Math.min(4 + level, 10)) {
      keep.forEach((a, i) => (a.id = i));
      return {
        N,
        arrows: keep.map((a) => ({ id: a.id, cells: a.cells, dir: a.dir })),
      };
    }
  }
  return null;
}

// Can this arrow slide out? Every cell from its head to the edge must be empty.
function pathFree(a, occ, N) {
  const [hr, hc] = a.cells[a.cells.length - 1];
  let r = hr + a.dir[0],
    c = hc + a.dir[1];
  while (r >= 0 && c >= 0 && r < N && c < N) {
    if (occ[r][c] !== -1 && occ[r][c] !== a.id) return false;
    r += a.dir[0];
    c += a.dir[1];
  }
  return true;
}

/* ============ PHASE 4: GAME STATE ============ */
const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
const COLORS = [
  "#c0362c",
  "#1f6fb2",
  "#e8a33d",
  "#3f8f6b",
  "#8a4fb0",
  "#2a9db8",
];
let level = 0,
  N,
  cell,
  arrows,
  occ,
  hearts,
  flash = {},
  exiting = [],
  hintId = -1,
  hintUntil = 0,
  over = false;

try {
  level = Math.max(
    0,
    parseInt(localStorage.getItem("larmbo-level") || "0", 10) || 0
  );
} catch (e) {}

function loadLevel(n) {
  const L = makeLevel(n);
  N = L.N;
  cell = cv.width / N;
  arrows = L.arrows.map((a) => ({ ...a, alive: true }));
  occ = Array.from({ length: N }, () => Array(N).fill(-1));
  arrows.forEach((a) => a.cells.forEach(([r, c]) => (occ[r][c] = a.id)));
  hearts = 3;
  flash = {};
  exiting = [];
  hintId = -1;
  over = false;
  document.getElementById("lvl").textContent = n + 1;
  showHearts();
  try {
    localStorage.setItem("larmbo-level", String(n));
  } catch (e) {}
}
function showHearts() {
  document.getElementById("hearts").textContent =
    "\u2764".repeat(hearts) + "\u2661".repeat(3 - hearts);
}

/* ============ PHASE 5: DRAWING ============ */
function drawArrow(a, offset, color) {
  const [dr, dc] = a.dir;
  const pts = a.cells.map(([r, c]) => [
    (c + 0.5 + dc * offset) * cell,
    (r + 0.5 + dr * offset) * cell,
  ]);
  const tail = pts[0],
    head = pts[pts.length - 1];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = cell * 0.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tail[0], tail[1]);
  ctx.lineTo(head[0], head[1]);
  ctx.stroke();
  const s = cell * 0.3,
    hx = head[0] + dc * cell * 0.12,
    hy = head[1] + dr * cell * 0.12;
  ctx.beginPath();
  ctx.moveTo(hx + dc * s, hy + dr * s);
  ctx.lineTo(hx - dc * s * 0.2 + dr * s, hy - dr * s * 0.2 + dc * s);
  ctx.lineTo(hx - dc * s * 0.2 - dr * s, hy - dr * s * 0.2 - dc * s);
  ctx.closePath();
  ctx.fill();
}

function draw(now) {
  const css = getComputedStyle(document.documentElement);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = css.getPropertyValue("--dot");
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      ctx.beginPath();
      ctx.arc((c + 0.5) * cell, (r + 0.5) * cell, cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  for (const a of arrows) {
    if (!a.alive) continue;
    let color = COLORS[a.id % COLORS.length];
    if (flash[a.id] && now < flash[a.id]) color = "#e11d2e";
    const pulse =
      a.id === hintId && now < hintUntil ? 1 + 0.12 * Math.sin(now / 90) : 1;
    ctx.save();
    if (pulse !== 1) {
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.scale(pulse, pulse);
      ctx.translate(-cv.width / 2, -cv.height / 2);
    }
    drawArrow(a, 0, color);
    ctx.restore();
  }
  for (const e of exiting)
    drawArrow(e.a, e.offset, COLORS[e.a.id % COLORS.length]);
}

/* ============ PHASE 6: TAP, SLIDE OUT, HEARTS ============ */
function tap(r, c) {
  if (over) return;
  const id = occ[r][c];
  if (id === -1) return;
  const a = arrows[id];
  if (pathFree(a, occ, N)) {
    a.cells.forEach(([rr, cc]) => (occ[rr][cc] = -1)); // free its lane right away
    a.alive = false;
    exiting.push({ a, offset: 0 });
    if (arrows.every((x) => !x.alive)) setTimeout(win, 450);
  } else {
    flash[id] = performance.now() + 350;
    hearts--;
    showHearts();
    if (hearts <= 0) setTimeout(lose, 400);
  }
}

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  for (const e of exiting) e.offset += dt * 14; // cells per second
  exiting = exiting.filter((e) => e.offset < N + 5);
  draw(now);
  requestAnimationFrame(loop);
}

/* ============ PHASE 7: WIN / LOSE / HINT ============ */
function showOverlay(title, text, btn) {
  over = true;
  document.getElementById("ovTitle").textContent = title;
  document.getElementById("ovText").textContent = text;
  document.getElementById("ovBtn").textContent = btn;
  document.getElementById("overlay").style.display = "flex";
}
let ovAction = null;
function win() {
  showOverlay("Level complete!", "You cleared every arrow.", "Next level");
  ovAction = () => {
    level++;
    loadLevel(level);
  };
}
function lose() {
  showOverlay("Out of hearts", "Plan the order and try again.", "Try again");
  ovAction = () => loadLevel(level);
}
document.getElementById("ovBtn").onclick = () => {
  document.getElementById("overlay").style.display = "none";
  ovAction && ovAction();
};
document.getElementById("reset").onclick = () => loadLevel(level);
document.getElementById("hintBtn").onclick = () => {
  const free = arrows.filter((a) => a.alive && pathFree(a, occ, N));
  if (free.length) {
    hintId = free[0].id;
    hintUntil = performance.now() + 1500;
  }
};

/* ============ PHASE 8: CONTROLS (TAP OR CLICK) ============ */
cv.addEventListener("pointerdown", (e) => {
  const rect = cv.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * cv.width;
  const y = ((e.clientY - rect.top) / rect.height) * cv.height;
  const c = Math.floor(x / cell),
    r = Math.floor(y / cell);
  if (r >= 0 && c >= 0 && r < N && c < N) tap(r, c);
});

/* ============ PHASE 9: START THE GAME ============ */
loadLevel(level);
requestAnimationFrame(loop);

/* ============ PHASE 10: SCREENS AND MENUS ============ */

// Show one screen and hide all the others
function showScreen(name) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
}

// Any button with data-go="something" opens that screen
document.querySelectorAll("[data-go]").forEach((b) => {
  b.onclick = () => showScreen(b.dataset.go);
});

// Pause menu
function openPause() {
  document.getElementById("pauseMenu").style.display = "flex";
}
function closePause() {
  document.getElementById("pauseMenu").style.display = "none";
}

// Where the Back button in Settings should go
let settingsReturn = "start";

document.getElementById("playBtn").onclick = () => showScreen("game");
document.getElementById("pauseBtn").onclick = openPause;
document.getElementById("resumeBtn").onclick = closePause;
document.getElementById("restartBtn").onclick = () => {
  closePause();
  loadLevel(level);
};
document.getElementById("homeBtn").onclick = () => {
  closePause();
  showScreen("start");
};

document.getElementById("startSettingsBtn").onclick = () => {
  settingsReturn = "start";
  showScreen("settings");
};
document.getElementById("pauseSettingsBtn").onclick = () => {
  settingsReturn = "game";
  closePause();
  showScreen("settings");
};
document.getElementById("settingsBackBtn").onclick = () => {
  showScreen(settingsReturn);
  if (settingsReturn === "game") openPause();
};

// Theme choice: auto, light or dark
function applyTheme(choice) {
  if (choice === "light" || choice === "dark") {
    document.documentElement.setAttribute("data-theme", choice);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  document.querySelectorAll("[data-theme-choice]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.themeChoice === choice);
  });
  try {
    localStorage.setItem("larmbo-theme", choice);
  } catch (e) {}
}
document.querySelectorAll("[data-theme-choice]").forEach((b) => {
  b.onclick = () => applyTheme(b.dataset.themeChoice);
});

let savedTheme = "auto";
try {
  savedTheme = localStorage.getItem("larmbo-theme") || "auto";
} catch (e) {}
applyTheme(savedTheme);

// Reset progress
document.getElementById("resetProgressBtn").onclick = () => {
  if (confirm("Reset your progress back to level 1?")) {
    level = 0;
    loadLevel(0);
  }
};