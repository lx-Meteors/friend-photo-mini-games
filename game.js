const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const screens = {
  home: $('#homeScreen'),
  game: $('#gameScreen'),
  result: $('#resultScreen')
};

const state = {
  faces: [],
  round: 0,
  score: 0,
  results: [],
  timerId: null,
  animationId: null,
  cleanup: [],
  finished: false
};

const rounds = [
  { id: 'catch', instruction: '接住！', hint: '拖动主角，接住 5 个好东西', duration: 9 },
  { id: 'hold', instruction: '忍住！', hint: '按住按钮 3 秒，千万别松手', duration: 7 },
  { id: 'find', instruction: '找到他！', hint: '从人群中找到指定主角', duration: 8 },
  { id: 'style', instruction: '对上！', hint: '把冠军帽拖到主角头上', duration: 8 }
];

const sampleFaces = [
  makeAvatar('阿橙', '#ff765d', '😎'),
  makeAvatar('小蓝', '#61d5ff', '😳'),
  makeAvatar('大黄', '#ffd84d', '🤪'),
  makeAvatar('桃子', '#ff8eb2', '😂')
];

function makeAvatar(name, color, emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" rx="52" fill="${color}"/><circle cx="150" cy="132" r="86" fill="#fff3d7"/><text x="150" y="169" font-size="92" text-anchor="middle">${emoji}</text><text x="150" y="268" font-family="sans-serif" font-size="31" font-weight="900" text-anchor="middle" fill="#1f1b2d">${name}</text></svg>`;
  return { name, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, sample: true };
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function activeFaces() {
  return state.faces.length ? state.faces : sampleFaces;
}

function renderFacePreview() {
  const faces = activeFaces();
  $('#facePreview').innerHTML = faces.slice(0, 4).map((face) =>
    `<img class="preview-face" src="${face.url}" alt="${face.name}">`
  ).join('') + (faces.length > 4 ? `<span class="preview-more">+${faces.length - 4}</span>` : '');
}

function handlePhotos(files) {
  state.faces.forEach((face) => {
    if (!face.sample && face.url.startsWith('blob:')) URL.revokeObjectURL(face.url);
  });
  state.faces = [...files].slice(0, 12).map((file, index) => ({
    name: `主角 ${index + 1}`,
    url: URL.createObjectURL(file),
    sample: false
  }));
  renderFacePreview();
}

$('#photoInput').addEventListener('change', (event) => handlePhotos(event.target.files));
$('#demoButton').addEventListener('click', () => { state.faces = []; renderFacePreview(); startRun(); });
$('#startButton').addEventListener('click', startRun);
$('#exitButton').addEventListener('click', () => { cleanRound(); showScreen('home'); });
$('#replayButton').addEventListener('click', startRun);
$('#changePhotosButton').addEventListener('click', () => { showScreen('home'); setTimeout(() => $('#photoInput').click(), 200); });
$('#saveButton').addEventListener('click', saveResultCard);

function startRun() {
  state.round = 0;
  state.score = 0;
  state.results = [];
  state.finished = false;
  $('#scoreBadge').textContent = '0 分';
  showScreen('game');
  launchRound();
}

function cleanRound() {
  clearInterval(state.timerId);
  cancelAnimationFrame(state.animationId);
  state.timerId = null;
  state.animationId = null;
  state.cleanup.splice(0).forEach((fn) => fn());
  $('#gameStage').replaceChildren();
  $('#feedback').classList.remove('show');
}

function launchRound() {
  cleanRound();
  state.finished = false;
  const round = rounds[state.round];
  $('#roundLabel').textContent = `ROUND ${state.round + 1} / ${rounds.length}`;
  $('#instruction').textContent = round.instruction;
  $('#hint').textContent = round.hint;
  $$('.round-progress span').forEach((bar, index) => {
    bar.className = index < state.round ? 'done' : index === state.round ? 'current' : '';
  });

  const builders = { catch: buildCatch, hold: buildHold, find: buildFind, style: buildStyle };
  builders[round.id]();
  startTimer(round.duration);
}

function startTimer(seconds) {
  const startedAt = performance.now();
  const fill = $('#timerFill');
  fill.style.transform = 'scaleX(1)';
  state.timerId = setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / (seconds * 1000));
    fill.style.transform = `scaleX(${1 - progress})`;
    fill.style.background = progress > .72 ? '#ff3c3c' : '#ff5c35';
    if (progress >= 1) finishRound(false, '超时啦');
  }, 30);
}

function finishRound(success, message = success ? '漂亮！' : '差一点！') {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerId);
  cancelAnimationFrame(state.animationId);
  const gained = success ? 100 : 35;
  state.score += gained;
  state.results.push({ success, gained, id: rounds[state.round].id });
  $('#scoreBadge').textContent = `${state.score} 分`;
  const feedback = $('#feedback');
  feedback.textContent = message;
  feedback.style.background = success ? 'var(--lime)' : 'var(--pink)';
  feedback.classList.add('show');

  setTimeout(() => {
    if (!screens.game.classList.contains('active')) return;
    state.round += 1;
    if (state.round >= rounds.length) showResults();
    else launchRound();
  }, 900);
}

function buildCatch() {
  const stage = $('#gameStage');
  const face = activeFaces()[0];
  stage.innerHTML = `<div class="counter-chip">接住 <b id="catchCount">0</b>/5</div><div class="catcher"><img class="face-bubble" src="${face.url}" alt="${face.name}"><div class="catch-basket">好运接收器</div></div>`;
  const catcher = stage.querySelector('.catcher');
  let x = stage.clientWidth / 2 - 50;
  let caught = 0;
  let lastDrop = 0;
  const items = [];
  catcher.style.left = `${x}px`;

  const move = (clientX) => {
    const rect = stage.getBoundingClientRect();
    x = Math.max(0, Math.min(rect.width - 100, clientX - rect.left - 50));
    catcher.style.left = `${x}px`;
  };
  const pointerMove = (event) => move(event.clientX);
  stage.addEventListener('pointerdown', pointerMove);
  stage.addEventListener('pointermove', (event) => { if (event.buttons) pointerMove(event); });

  function loop(time) {
    if (state.finished) return;
    if (time - lastDrop > 660) {
      lastDrop = time;
      const item = document.createElement('div');
      item.className = 'falling-item';
      item.textContent = ['🍗', '💰', '⭐', '🍰', '🎁'][Math.floor(Math.random() * 5)];
      const data = { el: item, x: Math.random() * (stage.clientWidth - 50), y: -50, speed: 3.2 + Math.random() * 1.8 };
      item.style.left = `${data.x}px`;
      stage.appendChild(item);
      items.push(data);
    }

    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      item.y += item.speed;
      item.el.style.transform = `translateY(${item.y}px) rotate(${item.y * 1.2}deg)`;
      const hitY = stage.clientHeight - 135;
      if (item.y > hitY && item.y < hitY + 45 && item.x + 45 > x && item.x < x + 100) {
        item.el.remove();
        items.splice(index, 1);
        caught += 1;
        $('#catchCount').textContent = caught;
        catcher.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 220 });
        if (caught >= 5) finishRound(true, '接满啦！');
      } else if (item.y > stage.clientHeight + 20) {
        item.el.remove();
        items.splice(index, 1);
      }
    }
    state.animationId = requestAnimationFrame(loop);
  }
  state.animationId = requestAnimationFrame(loop);
}

function buildHold() {
  const stage = $('#gameStage');
  const face = activeFaces()[0];
  stage.innerHTML = `<div class="hold-scene"><div class="hold-ring"></div><img class="hold-face" src="${face.url}" alt="${face.name}"><div class="hold-button">按住：保持正经</div><span class="distraction" style="left:9%;top:22%">🪿</span><span class="distraction" style="right:9%;top:30%;animation-delay:.2s">🍌</span><span class="distraction" style="left:14%;bottom:18%;animation-delay:.4s">🤡</span></div>`;
  const button = stage.querySelector('.hold-button');
  const ring = stage.querySelector('.hold-ring');
  let holding = false;
  let held = 0;
  let previous = 0;

  function down(event) {
    event.preventDefault();
    holding = true;
    button.classList.add('pressed');
    button.setPointerCapture?.(event.pointerId);
  }
  function up() {
    holding = false;
    button.classList.remove('pressed');
    if (held > 200 && held < 3000) {
      held = Math.max(0, held - 350);
      button.textContent = '别松！重新按住';
    }
  }
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);

  function loop(time) {
    if (!previous) previous = time;
    const delta = time - previous;
    previous = time;
    if (holding) held += delta;
    const progress = Math.min(1, held / 3000);
    ring.style.transform = `rotate(${progress * 360}deg)`;
    ring.style.borderTopColor = progress > .7 ? 'var(--lime)' : 'var(--orange)';
    if (progress >= 1) finishRound(true, '绷住了！');
    else state.animationId = requestAnimationFrame(loop);
  }
  state.animationId = requestAnimationFrame(loop);
}

function buildFind() {
  const stage = $('#gameStage');
  const pool = [...activeFaces()];
  while (pool.length < 4) pool.push(sampleFaces[pool.length]);
  const shuffled = pool.slice(0, 4).sort(() => Math.random() - .5);
  const target = shuffled[Math.floor(Math.random() * shuffled.length)];
  $('#hint').textContent = `快找到：${target.name}`;
  const grid = document.createElement('div');
  grid.className = 'find-grid';
  shuffled.forEach((face, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'find-card';
    card.innerHTML = `<img src="${face.url}" alt="${face.name}"><span>${face.name}</span>`;
    card.addEventListener('click', () => {
      if (face === target) finishRound(true, '就是他！');
      else {
        card.classList.remove('wrong');
        void card.offsetWidth;
        card.classList.add('wrong');
        state.score = Math.max(0, state.score - 10);
        $('#scoreBadge').textContent = `${state.score} 分`;
      }
    });
    grid.appendChild(card);
  });
  stage.appendChild(grid);
}

function buildStyle() {
  const stage = $('#gameStage');
  const face = activeFaces()[Math.min(1, activeFaces().length - 1)];
  stage.innerHTML = `<div class="style-scene"><div class="style-target"><div class="drop-zone"></div><img src="${face.url}" alt="${face.name}"></div><div class="hat" aria-label="可拖动的帽子">👑</div></div>`;
  const hat = stage.querySelector('.hat');
  const zone = stage.querySelector('.drop-zone');
  let drag = null;

  hat.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const rect = hat.getBoundingClientRect();
    drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    hat.classList.add('dragging');
    hat.setPointerCapture?.(event.pointerId);
  });
  hat.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const rect = stage.getBoundingClientRect();
    hat.style.left = `${event.clientX - rect.left - drag.dx}px`;
    hat.style.top = `${event.clientY - rect.top - drag.dy}px`;
    hat.style.bottom = 'auto';
  });
  const drop = () => {
    if (!drag) return;
    drag = null;
    hat.classList.remove('dragging');
    const a = hat.getBoundingClientRect();
    const b = zone.getBoundingClientRect();
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (overlapX > 25 && overlapY > 20) {
      const stageRect = stage.getBoundingClientRect();
      hat.style.left = `${b.left - stageRect.left + 5}px`;
      hat.style.top = `${b.top - stageRect.top - 10}px`;
      finishRound(true, '登基成功！');
    }
  };
  hat.addEventListener('pointerup', drop);
  hat.addEventListener('pointercancel', drop);
}

function showResults() {
  cleanRound();
  const faces = activeFaces();
  const successCount = state.results.filter((result) => result.success).length;
  const ranks = ['还算正经', '开始失控', '离谱小队', '全员失控', '荒诞传奇'];
  $('#resultFaces').innerHTML = faces.slice(0, 3).map((face) => `<img src="${face.url}" alt="${face.name}">`).join('');
  $('#resultScore').textContent = state.score;
  $('#resultRank').textContent = ranks[successCount];
  $('#resultStats').innerHTML = state.results.map((result, index) => `<div class="result-stat"><b>${result.success ? '✓' : '×'}</b><span>${rounds[index].instruction}</span></div>`).join('');
  showScreen('result');
}

async function saveResultCard() {
  const saveButton = $('#saveButton');
  const originalLabel = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = '正在生成结果图…';
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffd84d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fffdf4';
  ctx.strokeStyle = '#1f1b2d';
  ctx.lineWidth = 18;
  roundRect(ctx, 90, 90, 900, 1260, 45);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#9b4030';
  ctx.font = '800 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('脸红心跳研究所 · 实验报告', 540, 180);

  const faces = activeFaces().slice(0, 3);
  for (let index = 0; index < faces.length; index++) {
    try {
      const image = await loadImage(faces[index].url);
      const x = 540 + (index - (faces.length - 1) / 2) * 180;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, 365, 110, 0, Math.PI * 2);
      ctx.clip();
      drawCover(ctx, image, x - 110, 255, 220, 220);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, 365, 110, 0, Math.PI * 2);
      ctx.strokeStyle = '#1f1b2d';
      ctx.lineWidth = 14;
      ctx.stroke();
    } catch { /* Keep exporting even if one local image fails. */ }
  }

  const successCount = state.results.filter((result) => result.success).length;
  const ranks = ['还算正经', '开始失控', '离谱小队', '全员失控', '荒诞传奇'];
  ctx.fillStyle = '#ff5c35';
  ctx.strokeStyle = '#1f1b2d';
  ctx.lineWidth = 12;
  ctx.font = '900 220px Impact, sans-serif';
  ctx.strokeText(String(state.score), 540, 720);
  ctx.fillText(String(state.score), 540, 720);
  ctx.fillStyle = '#1f1b2d';
  ctx.font = '900 70px sans-serif';
  ctx.fillText(ranks[successCount], 540, 830);

  state.results.forEach((result, index) => {
    const x = 210 + index * 220;
    ctx.fillStyle = result.success ? '#b9f23c' : '#ff8eb2';
    ctx.fillRect(x - 80, 920, 160, 150);
    ctx.strokeRect(x - 80, 920, 160, 150);
    ctx.fillStyle = '#1f1b2d';
    ctx.font = '900 60px sans-serif';
    ctx.fillText(result.success ? '✓' : '×', x, 985);
    ctx.font = '800 30px sans-serif';
    ctx.fillText(rounds[index].instruction, x, 1040);
  });

  ctx.font = '900 42px sans-serif';
  ctx.fillText('今日结论：正经不了一点', 540, 1185);
  ctx.font = '700 28px sans-serif';
  ctx.fillStyle = '#746d77';
  ctx.fillText('照片只在本地处理 · 原型版本', 540, 1260);

  canvas.toBlob((blob) => {
    if (!blob) {
      saveButton.disabled = false;
      saveButton.textContent = '生成失败，再试一次';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `脸红心跳研究所-${state.score}分.png`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveButton.textContent = '结果图已保存 ✓';
    setTimeout(() => {
      saveButton.disabled = false;
      saveButton.textContent = originalLabel;
    }, 1800);
  }, 'image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

renderFacePreview();
