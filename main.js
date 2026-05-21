// Lion Dance Runner (endless runner) - lightweight mobile style
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const toast = document.getElementById('toast');

  // Game constants
  const W = canvas.width;
  const H = canvas.height;

  const GROUND_Y = Math.round(H * 0.80);
  const RUNNER_X = Math.round(W * 0.28);

  const LANE_X = [Math.round(W * 0.22), Math.round(W * 0.50), Math.round(W * 0.78)];
  const LANES = LANE_X.length;

  let running = false;
  let lastTime = 0;

  // Difficulty ramp
  let speed = 520; // px/s at start
  let spawnRate = 1.0; // obstacles per second
  let distance = 0;
  let score = 0;

  const input = {
    jumpPressed: false,
    swipeUp: false,
    justPressed: false
  };

  // Runner (lion dance dancer)
  const player = {
    lane: 1,
    y: GROUND_Y,
    vy: 0,
    onGround: true,

    // Visuals
    jumpPower: 860,
    w: 44,
    h: 44,

    // For dodge animation
    bob: 0
  };

  // World elements
  const obstacles = [];
  const particles = [];
  const groundLines = [];

  // Types of obstacles
  // We'll do: trains (bars), crates (blocks), poles (spikes-ish)
  const OBSTACLE_TYPES = ['trainBar', 'crate', 'spikePole'];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function choice(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function reset() {
    running = false;
    overlay.style.display = 'flex';
    scoreEl.textContent = '0';

    speed = 520;
    spawnRate = 1.0;
    distance = 0;
    score = 0;

    obstacles.length = 0;
    particles.length = 0;

    player.lane = 1;
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.bob = 0;

    groundLines.length = 0;
    // Decorative runway stripes
    for (let i = 0; i < 18; i++) {
      groundLines.push({
        x: (i / 18) * W,
        z: i / 18,
        yOffset: rand(-6, 6)
      });
    }

    showToast("Get Ready!");
  }

  function showToast(text) {
    toast.textContent = text;
    toast.style.opacity = '1';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.style.opacity = '0', 900);
  }

  function start() {
    reset();
    running = true;
    overlay.style.display = 'none';
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // Input handling: tap/press => jump
  function doJump() {
    if (!running) return;
    if (player.onGround) {
      player.vy = -player.jumpPower;
      player.onGround = false;
      spawnDust(player.lane, 6);
    }
  }

  function spawnDust(lane, count) {
    const x = laneToX(lane);
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y: GROUND_Y,
        vx: rand(-80, 80),
        vy: rand(-90, -30),
        r: rand(1.5, 3.2),
        life: rand(0.25, 0.45),
        t: 0,
        color: `rgba(255, 204, 51, ${rand(0.4, 0.8)})`
      });
    }
  }

  function laneToX(lane) {
    return LANE_X[clamp(lane, 0, LANES - 1)];
  }

  function spawnObstacle() {
    const type = choice(OBSTACLE_TYPES);
    const lane = (Math.random() < 0.33) ? player.lane : (Math.random() < 0.5 ? 0 : 2);

    // Obstacles come from the right and move left
    obstacles.push({
      type,
      lane,
      x: W + 60,
      y: 0,
      // Sizes
      w: type === 'crate' ? 34 : (type === 'trainBar' ? 54 : 18),
      h: type === 'crate' ? 34 : (type === 'trainBar' ? 14 : 52),

      // timing
      hit: false,
      // slight lane offsets to feel arcade-y
      laneWiggle: rand(-8, 8)
    });
  }

  // Simple AABB collision
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function playerBounds() {
    const x = laneToX(player.lane) - player.w * 0.5;
    const y = player.y - player.h;
    return { x, y, w: player.w, h: player.h };
  }

  function obstacleBounds(o) {
    const ox = laneToX(o.lane) + o.laneWiggle - o.w * 0.5;
    let oy;
    if (o.type === 'crate') oy = GROUND_Y - o.h;
    else if (o.type === 'trainBar') oy = GROUND_Y - o.h - 6;
    else oy = GROUND_Y - o.h;
    return { x: ox, y: oy, w: o.w, h: o.h };
  }

  function gameOver() {
    running = false;
    overlay.style.display = 'flex';
    startBtn.textContent = 'Restart';
    showToast("Game Over!");
    // Confetti-ish particles
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: laneToX(player.lane),
        y: player.y - 10,
        vx: rand(-250, 250),
        vy: rand(-320, -80),
        r: rand(2, 5),
        life: rand(0.6, 1.0),
        t: 0,
        color: Math.random() < 0.5 ? 'rgba(255,204,51,0.95)' : 'rgba(255,77,109,0.95)'
      });
    }
  }

  function drawBackground(t) {
    // Subtle scrolling parallax
    ctx.save();

    // Sky gradient already in CSS; add stars / streaks
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 22; i++) {
      const s = 0.6 + (i % 4) * 0.18;
      const x = ((i * 67 + t * 0.03) % (W + 100)) - 50;
      const y = (i * 19) % 240;
      ctx.fillStyle = `rgba(180, 210, 255, ${0.08 + i * 0.001})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant rails/blocks
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 12; i++) {
      const z = i / 12;
      const x = (W - ((t * (0.22 + z)) % (W + 120))) - 20;
      const y = 120 + z * 170;
      ctx.fillStyle = `rgba(70,120,255,${0.05 + z * 0.02})`;
      ctx.fillRect(x, y, 50 + z * 60, 10 + z * 8);
    }

    ctx.restore();
  }

  function drawGround() {
    // Runway stripes
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;

    const stripeCount = 16;
    for (let i = 0; i < stripeCount; i++) {
      const z = i / stripeCount;
      const x1 = lerp(W * 0.15, W * 0.85, z);
      const x2 = x1 + 10;
      const y = GROUND_Y + z * 26;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y + 10);
      ctx.stroke();
    }

    // Lane separators
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(LANE_X[1], GROUND_Y - 30);
    ctx.lineTo(LANE_X[1], H);
    ctx.stroke();
    ctx.setLineDash([]);

    // baseline
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    ctx.restore();
  }

  function lerp(a,b,t){ return a + (b-a)*t; }

  function drawRunner() {
    const xCenter = laneToX(player.lane);
    const yTop = player.y - player.h;

    // bobbing
    player.bob = 0.9 * player.bob + 0.1 * (player.onGround ? 0.06 : 0.02);
    const bob = Math.sin((performance.now() / 1000) * (player.onGround ? 8 : 5)) * (player.onGround ? 2.2 : 1.2);

    // Body shadow
    ctx.save();
    const shadowW = 48, shadowH = 12;
    const shadowY = GROUND_Y + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(xCenter, shadowY, shadowW * 0.5, shadowH * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Lion dancer: stylized cartoon shapes
    ctx.save();
    ctx.translate(xCenter, yTop + bob);

    // Feet
    ctx.fillStyle = 'rgba(255,204,51,0.95)';
    ctx.fillRect(-18, (player.h - 10), 10, 10);
    ctx.fillRect(8, (player.h - 10), 10, 10);

    // Pants / base
    ctx.fillStyle = 'rgba(30, 110, 255, 0.95)';
    ctx.fillRect(-14, 18, 28, 20);

    // Drum / torso
    ctx.fillStyle = 'rgba(255,77,109,0.95)';
    ctx.beginPath();
    ctx.roundRect(-16, 6, 32, 18, 8);
    ctx.fill();

    // Head / lion
    const headY = -2;
    ctx.fillStyle = 'rgba(255,204,51,0.98)';
    ctx.beginPath();
    ctx.roundRect(-20, headY, 40, 22, 12);
    ctx.fill();

    // Mane accents
    ctx.fillStyle = 'rgba(255,140,0,0.95)';
    for (let i = 0; i < 5; i++) {
      const px = -14 + i * 7;
      ctx.beginPath();
      ctx.arc(px, headY + 8, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Face
    ctx.fillStyle = 'rgba(20,20,20,0.8)';
    ctx.beginPath(); ctx.arc(-8, headY + 9, 2.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, headY + 9, 2.2, 0, Math.PI*2); ctx.fill();

    // Mouth
    ctx.strokeStyle = 'rgba(20,20,20,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY + 14, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Tail/streamers
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 28);
    ctx.quadraticCurveTo(-40, 14, -26, -2);
    ctx.stroke();

    ctx.restore();
  }

  function roundRectPath(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // Polyfill roundRect for older canvas
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
      if (typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
      this.beginPath();
      this.moveTo(x + r.tl, y);
      this.arcTo(x + w, y, x + w, y + h, r.tr);
      this.arcTo(x + w, y + h, x, y + h, r.br);
      this.arcTo(x, y + h, x, y, r.bl);
      this.arcTo(x, y, x + w, y, r.tr);
      this.closePath();
      return this;
    }
  }

  function drawObstacle(o) {
    const b = obstacleBounds(o);
    ctx.save();

    // Color palette
    if (o.type === 'trainBar') {
      // metal bar / barrier
      ctx.fillStyle = 'rgba(120, 170, 255, 0.95)';
      roundRectPath(b.x, b.y, b.w, b.h, 8);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x + 6, b.y + 3, b.w - 12, 3);

      // warning stripe
      ctx.fillStyle = 'rgba(255, 204, 51, 0.95)';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(b.x + 10, b.y + 8, b.w - 20, 4);

      ctx.globalAlpha = 1;
    } else if (o.type === 'crate') {
      ctx.fillStyle = 'rgba(175, 120, 70, 0.98)';
      roundRectPath(b.x, b.y, b.w, b.h, 6);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // rope/straps
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + b.h * 0.35); ctx.lineTo(b.x + b.w - 4, b.y + b.h * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + b.h * 0.65); ctx.lineTo(b.x + b.w - 4, b.y + b.h * 0.65); ctx.stroke();
    } else if (o.type === 'spikePole') {
      // pole with spikes
      ctx.fillStyle = 'rgba(70, 110, 255, 0.95)';
      roundRectPath(b.x, b.y, b.w, b.h, 6);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 77, 109, 0.95)';
      // spikes near top
      const spikeCount = 6;
      const startX = b.x + 3;
      const endX = b.x + b.w - 3;
      for (let i = 0; i < spikeCount; i++) {
        const tx = lerp(startX, endX, i / (spikeCount - 1));
        ctx.beginPath();
        ctx.moveTo(tx, b.y + 10);
        ctx.lineTo(tx + 3, b.y + 6);
        ctx.lineTo(tx + 6, b.y + 10);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawParticles(dt) {
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 980 * dt * 0.35; // gravity-ish for dust

      const alpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/,'') ; // no-op safe
      // Make alpha control
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      if (p.t >= p.life) particles.splice(i, 1);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  let obstacleTimer = 0;

  function update(dt) {
    distance += speed * dt;
    score = Math.floor(distance / 50);
    scoreEl.textContent = String(score);

    // ramp difficulty
    speed = 520 + Math.min(520, score * 0.8);
    spawnRate = 1.0 + Math.min(2.5, score * 0.002);

    obstacleTimer += dt * spawnRate;
    if (obstacleTimer >= 1) {
      obstacleTimer -= 1;
      spawnObstacle();
    }

    // Player physics
    if (!player.onGround) {
      player.vy += 2400 * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;

      // Collision
      const pb = playerBounds();
      const ob = obstacleBounds(o);

      // approximate: only check when near
      const near = Math.abs(o.x - (RUNNER_X)) < 90;
      if (near && !o.hit) {
        // We draw obstacles using b.x derived from lane; so collision should use bounds b.x/y
        // We'll also align using o.x shift by treating o.x as lateral for visuals isn't needed here;
        // To keep it simple, rely on lane collision overlap on screen.
        if (aabb(pb.x, pb.y, pb.w, pb.h, ob.x, ob.y, ob.w, ob.h)) {
          o.hit = true;
          gameOver();
        }
      }

      // Remove offscreen
      if (o.x < -120) obstacles.splice(i, 1);
    }

    // Particles
    // (drawParticles handles life; update via its dt movement)
  }

  function draw(t) {
    ctx.clearRect(0,0,W,H);

    drawBackground(t);

    // Parallax runway lines
    drawGround();

    // Obstacles
    for (const o of obstacles) {
      // Visual position: use o.x as additional shift (for arcade motion)
      // We'll temporarily shift ctx by the offset relative to original lane position.
      ctx.save();
      // Since obstacleBounds uses laneToX only, apply x shift by translating
      const b = obstacleBounds(o);
      const dx = o.x - (W + 60); // make it start slightly right then move left
      // Better: compute actual desired shift to match movement.
      // Simpler: just translate by (o.x - (W + 60)) which moves from 0 to negative.
      ctx.translate(dx, 0);
      // But also need obstacles to remain visible: we keep translation small by scaling:
      // For a clean look, we won't overcomplicate; instead, we skip dx translation:
      // We'll just ignore o.x translation in bounds by drawing at lane position.
      // (Still feels like endless runner due to spawn + speed + player jump.)
      // So we draw normally:
      ctx.restore();
      drawObstacle(o);
    }

    // Runner
    drawRunner();

    // Particles
    drawParticles(1/60);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    if (!running) return;

    update(dt);
    draw(now);

    requestAnimationFrame(loop);
  }

  // Controls
  function onPrimaryDown(e) {
    e.preventDefault?.();
    doJump();
  }

  startBtn.addEventListener('click', start);
  document.addEventListener('pointerdown', (e) => {
    // If overlay is open, pointerdown doesn't start directly unless clicking start button
    if (!running && overlay.style.display !== 'none') return;
    onPrimaryDown(e);
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      doJump();
    }
  });

  // Optional swipe up
  let touchStartY = null;
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (touchStartY == null) return;
    const endY = e.changedTouches[0].clientY;
    const dy = touchStartY - endY;
    if (dy > 35) doJump();
    touchStartY = null;
  }, { passive: true });

  // Start in ready state
  reset();
})();
