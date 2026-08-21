const $ = (selector) => document.querySelector(selector);
const gameId = document.body.dataset.game;

const configs = {
  catch: { duration: 30, command: '接住！', sub: '连击加分，小心炸弹', success: '满载而归！', fail: '还差一点！', emoji: '🎁' },
  hold: { duration: 15, command: '忍住！', sub: '按住蓄力，松手会倒退', success: '定力之王！', fail: '功亏一篑！', emoji: '😶' },
  find: { duration: 30, command: '找到他！', sub: '连续找出 10 个目标', success: '人脸雷达！', fail: '眼神飘了！', emoji: '🔎' },
  style: { duration: 15, command: '对上！', sub: '完成四轮离谱变装', success: '造型大师！', fail: '还没穿完！', emoji: '👑' },
  swat: { duration: 10, damageCap: 25, command: '拍掉！', sub: '10 秒疯狂拍，能拍多少算多少', success: '主角已经认不出来了！', fail: '主角已经认不出来了！', emoji: '🐷' },
  wake: { duration: 15, command: '叫醒！', sub: '连点加速，别让困意反扑', success: '彻底清醒！', fail: '睡得真香！', emoji: '⏰' },
  feed: { duration: 30, command: '喂一口！', sub: '连续投喂，避开黑暗料理', success: '吃播冠军！', fail: '还没吃饱！', emoji: '🥟' },
  snap: { duration: 30, command: '抢拍！', sub: '完成五轮反应抓拍', success: '抓拍大师！', fail: '拍糊啦！', emoji: '📸' },
  shake: { duration: 15, command: '摇醒！', sub: '三档加速，把魂摇回来', success: '满血复活！', fail: '还在梦游！', emoji: '🫨' },
  wipe: { duration: 15, command: '擦干净！', sub: '污渍会反扑，快速清场', success: '焕然一新！', fail: '越擦越脏！', emoji: '🧻' }
};
const config = configs[gameId];

const state = {
  faces: [],
  timer: null,
  frame: null,
  finished: false,
  startedAt: 0,
  launchTimeout: null,
  resultTimeout: null,
  extraTimeouts: [],
  onTimeUp: null,
  score: 0
};

let swatAudioContext = null;
let swatMusicTimer = null;
let swatMusicStep = 0;

function getSwatAudioContext() {
  if (gameId !== 'swat') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!swatAudioContext) swatAudioContext = new AudioContextClass();
  if (swatAudioContext.state === 'suspended') swatAudioContext.resume().catch(() => {});
  return swatAudioContext;
}

function playSwatTone(frequency, duration, volume, type = 'sine', delay = 0) {
  const audio = getSwatAudioContext();
  if (!audio) return;
  const startAt = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, startAt + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + .02);
}

function startSwatMusic() {
  if (gameId !== 'swat') return;
  getSwatAudioContext();
  clearInterval(swatMusicTimer);
  swatMusicStep = 0;
  const notes = [262, 330, 392, 330, 294, 370, 440, 370];
  const tick = () => {
    if (state.finished) return;
    const note = notes[swatMusicStep % notes.length];
    playSwatTone(note, .12, .022, 'square');
    if (swatMusicStep % 2 === 0) playSwatTone(note / 2, .09, .018, 'triangle');
    swatMusicStep += 1;
  };
  tick();
  swatMusicTimer = setInterval(tick, 220);
}

function stopSwatMusic() {
  clearInterval(swatMusicTimer);
  swatMusicTimer = null;
}

function playSwatHit() {
  const audio = getSwatAudioContext();
  if (!audio) return;
  const duration = .11;
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const decay = 1 - index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * Math.pow(decay, 2.35);
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const crackFilter = audio.createBiquadFilter();
  const crackGain = audio.createGain();
  crackFilter.type = 'bandpass';
  crackFilter.frequency.value = 1150;
  crackFilter.Q.value = .7;
  crackGain.gain.setValueAtTime(.18, audio.currentTime);
  crackGain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  noise.connect(crackFilter).connect(crackGain).connect(audio.destination);

  const bodyFilter = audio.createBiquadFilter();
  const bodyGain = audio.createGain();
  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.value = 430;
  bodyGain.gain.setValueAtTime(.12, audio.currentTime);
  bodyGain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration * .9);
  noise.connect(bodyFilter).connect(bodyGain).connect(audio.destination);
  noise.start();

  const thump = audio.createOscillator();
  const thumpGain = audio.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(138, audio.currentTime);
  thump.frequency.exponentialRampToValueAtTime(58, audio.currentTime + .105);
  thumpGain.gain.setValueAtTime(.105, audio.currentTime);
  thumpGain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .115);
  thump.connect(thumpGain).connect(audio.destination);
  thump.start();
  thump.stop(audio.currentTime + .13);
}

function playSwatCry() {
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
  window.speechSynthesis.cancel();
  const cry = new SpeechSynthesisUtterance('哎呀！');
  cry.lang = 'zh-CN';
  cry.rate = 1.28;
  cry.pitch = 1.32;
  cry.volume = .82;
  window.speechSynthesis.speak(cry);
}

function playSwatMiss() {
  playSwatTone(145, .12, .035, 'sawtooth');
  playSwatTone(112, .16, .03, 'sawtooth', .08);
}

function playSwatFinish() {
  [392, 330, 262, 196].forEach((note, index) => playSwatTone(note, .2, .05, 'triangle', index * .1));
}

const samples = [
  avatar('阿橙', '#ff765d', '😎'), avatar('小蓝', '#61d5ff', '😳'),
  avatar('大黄', '#ffd84d', '🤪'), avatar('桃子', '#ff8eb2', '😂')
];
if (gameId === 'swat') {
  samples[0] = { name: '阿橙', url: 'assets/swat-default-victim.png?v=4dd01a3', sample: true };
}

function avatar(name, color, emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" rx="52" fill="${color}"/><circle cx="150" cy="132" r="86" fill="#fff3d7"/><text x="150" y="169" font-size="92" text-anchor="middle">${emoji}</text><text x="150" y="268" font-family="sans-serif" font-size="31" font-weight="900" text-anchor="middle" fill="#1f1b2d">${name}</text></svg>`;
  return { name, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, sample: true };
}

function faces() { return state.faces.length ? state.faces : samples; }

function renderPreview() {
  const limit = gameId === 'find' ? 4 : 1;
  $('#singlePreview').innerHTML = faces().slice(0, limit).map((face) => `<img src="${face.url}" alt="${face.name}">`).join('');
}

let faceModelPromise = null;
let replacingVictimFromResult = false;

function loadPhoto(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', reject, { once: true });
    image.src = url;
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function canvasToObjectUrl(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', .92)), 'image/jpeg', .92);
  });
}

async function ensureFaceModel() {
  if (!window.faceapi) throw new Error('face detector unavailable');
  if (!faceModelPromise) faceModelPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('assets/face-model'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('assets/face-model')
  ]);
  return faceModelPromise;
}

async function detectMainFace(image) {
  await ensureFaceModel();
  const detections = await faceapi
    .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: .25 }))
    .withFaceLandmarks(true);
  const largest = detections.sort((a, b) => b.detection.box.width * b.detection.box.height - a.detection.box.width * a.detection.box.height)[0];
  return largest ? {
    box: largest.detection.box,
    nose: largest.landmarks.getNose(),
    leftEye: largest.landmarks.getLeftEye(),
    rightEye: largest.landmarks.getRightEye()
  } : null;
}

async function autoCenterFace(face) {
  const image = await loadPhoto(face.url);
  let detection = null;
  try {
    detection = await detectMainFace(image);
  } catch (error) {
    console.warn('Face detection fallback:', error);
  }

  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  const shortestSide = Math.min(imageWidth, imageHeight);
  const box = detection?.box;
  const cropSize = box
    ? Math.min(shortestSide, Math.max(box.width * 1.9, box.height * 1.72))
    : shortestSide;
  const centerX = box ? box.x + box.width / 2 : imageWidth / 2;
  const centerY = box ? box.y + box.height * .52 : imageHeight / 2;
  const sourceX = clamp(centerX - cropSize / 2, 0, imageWidth - cropSize);
  const sourceY = clamp(centerY - cropSize / 2, 0, imageHeight - cropSize);
  const outputSize = 640;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize);

  const fallbackBox = { x: .2, y: .13, width: .6, height: .72 };
  const mappedBox = box ? {
    x: clamp((box.x - sourceX) / cropSize, 0, 1),
    y: clamp((box.y - sourceY) / cropSize, 0, 1),
    width: clamp(box.width / cropSize, .2, 1),
    height: clamp(box.height / cropSize, .24, 1)
  } : fallbackBox;
  const mapPoint = (point) => ({
    x: clamp((point.x - sourceX) / cropSize, 0, 1),
    y: clamp((point.y - sourceY) / cropSize, 0, 1)
  });
  const averagePoint = (points) => points?.length ? {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length
  } : null;
  const nostrils = detection?.nose?.length >= 9 ? {
    left: mapPoint(detection.nose[5]),
    right: mapPoint(detection.nose[7])
  } : null;
  const leftEyeCenter = averagePoint(detection?.leftEye);
  const rightEyeCenter = averagePoint(detection?.rightEye);
  const eyes = leftEyeCenter && rightEyeCenter ? {
    left: mapPoint(leftEyeCenter),
    right: mapPoint(rightEyeCenter)
  } : null;
  const centeredUrl = await canvasToObjectUrl(canvas);
  if (face.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(face.objectUrl);
  return { ...face, url: centeredUrl, objectUrl: centeredUrl, faceBox: mappedBox, nostrils, eyes, detected: Boolean(box && nostrils && eyes) };
}

if (gameId === 'swat') {
  setTimeout(() => ensureFaceModel().catch(() => {}), 180);
}

$('#singlePhotoInput').addEventListener('change', async (event) => {
  const selectedFiles = [...event.target.files].slice(0, gameId === 'find' ? 8 : 1);
  if (!selectedFiles.length) return;
  if (replacingVictimFromResult) {
    clean();
    $('.single-play').hidden = true;
    $('#singleResult').hidden = true;
    $('.single-intro').hidden = false;
    replacingVictimFromResult = false;
  }
  state.faces.forEach((face) => { if (face.objectUrl?.startsWith('blob:')) URL.revokeObjectURL(face.objectUrl); });
  state.faces = selectedFiles.map((file, index) => {
    const objectUrl = URL.createObjectURL(file);
    return { name: `主角 ${index + 1}`, url: objectUrl, objectUrl, sample: false };
  });
  renderPreview();
  if (gameId !== 'swat' || !state.faces.length) return;

  const uploadLabel = document.querySelector('label[for="singlePhotoInput"]');
  const startButton = $('#singleStart');
  uploadLabel.textContent = '正在识别人脸并自动居中…';
  uploadLabel.classList.remove('face-found', 'face-missed');
  uploadLabel.classList.add('detecting');
  startButton.disabled = true;
  try {
    state.faces = await Promise.all(state.faces.map(autoCenterFace));
    renderPreview();
    uploadLabel.textContent = state.faces[0].detected ? '✓ 已识别人脸并自动居中' : '未识别人脸，请换一张清晰正脸照';
    uploadLabel.classList.toggle('face-found', state.faces[0].detected);
    uploadLabel.classList.toggle('face-missed', !state.faces[0].detected);
  } catch (error) {
    console.warn('Photo processing fallback:', error);
    uploadLabel.textContent = '识别失败，请重新选择照片';
    uploadLabel.classList.add('face-missed');
  } finally {
    uploadLabel.classList.remove('detecting');
    startButton.disabled = !state.faces[0]?.detected;
  }
});

const nextVictimButton = $('#singleNextVictim');
if (nextVictimButton) {
  nextVictimButton.addEventListener('click', () => {
    replacingVictimFromResult = true;
    const photoInput = $('#singlePhotoInput');
    photoInput.value = '';
    photoInput.click();
  });
}

$('#singleStart').addEventListener('click', start);
$('#singleAgain').addEventListener('click', start);
$('#singleRestart').addEventListener('click', start);

function start() {
  clean();
  state.finished = false;
  state.score = 0;
  state.onTimeUp = null;
  if (gameId === 'swat') startSwatMusic();
  $('.single-intro').hidden = true;
  $('#singleResult').hidden = true;
  $('.single-play').hidden = false;
  $('#singleScore').textContent = '0 分';
  $('#singleTimer span').style.transform = 'scaleX(1)';
  $('#singleStage').innerHTML = `<div class="command-splash"><small>准备好了吗？</small><strong>${configs[gameId].command}</strong><span>${configs[gameId].sub}</span></div>`;
  state.launchTimeout = setTimeout(() => {
    const builders = { catch: buildCatch, hold: buildHold, find: buildFind, style: buildStyle, swat: buildSwat, wake: buildWake, feed: buildFeed, snap: buildSnap, shake: buildShake, wipe: buildWipe };
    builders[gameId]();
    startTimer(configs[gameId].duration);
  }, 720);
}

function clean() {
  stopSwatMusic();
  if (gameId === 'swat' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  clearInterval(state.timer);
  clearTimeout(state.launchTimeout);
  clearTimeout(state.resultTimeout);
  state.extraTimeouts.forEach(clearTimeout);
  state.extraTimeouts = [];
  cancelAnimationFrame(state.frame);
  state.timer = null;
  state.launchTimeout = null;
  state.resultTimeout = null;
  state.frame = null;
  $('#singleStage').replaceChildren();
  $('#singleFeedback').classList.remove('show');
}

function startTimer(seconds) {
  const fill = $('#singleTimer span');
  state.startedAt = performance.now();
  fill.style.transform = 'scaleX(1)';
  state.timer = setInterval(() => {
    const progress = Math.min(1, (performance.now() - state.startedAt) / (seconds * 1000));
    const swatTime = $('#swatHudTime');
    if (gameId === 'swat' && swatTime) swatTime.textContent = `剩余 ${String(Math.max(0, Math.ceil(seconds * (1 - progress)))).padStart(2, '0')} 秒`;
    fill.style.transform = `scaleX(${1 - progress})`;
    fill.style.background = progress > .72 ? '#ff3c3c' : '#ff5c35';
    if (progress >= 1) {
      clearInterval(state.timer);
      if (state.onTimeUp) state.onTimeUp(); else finish(false);
    }
  }, 30);
}

function finish(success) {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timer);
  cancelAnimationFrame(state.frame);
  state.extraTimeouts.forEach(clearTimeout);
  state.extraTimeouts = [];
  const feedback = $('#singleFeedback');
  const isSwat = gameId === 'swat';
  let resultMessage = success ? configs[gameId].success : configs[gameId].fail;
  if (!isSwat) {
    feedback.textContent = resultMessage;
    feedback.style.background = success ? 'var(--lime)' : 'var(--pink)';
    feedback.classList.add('show');
  } else {
    stopSwatMusic();
    playSwatFinish();
    feedback.classList.remove('show');
    resultMessage = `10 秒拍掉 ${state.swatHits || 0} 只，主角也肿了！`;
    $('#swatHudTime').textContent = '时间到！';
    $('#singleStage').querySelectorAll('.bug-target, .slap-fx').forEach((element) => element.remove());
    const warning = $('#singleStage').querySelector('.swat-warning');
    const tip = $('#singleStage').querySelector('.swat-tip');
    if (warning) warning.textContent = '最终伤情';
    if (tip) tip.textContent = '停两秒，看看主角被拍成什么样了';
  }
  const finalScore = Math.max(state.score, success ? 100 : 35);
  if (isSwat) {
    const resultFace = $('#swatResultFace');
    const damageCanvas = $('#swatFaceCanvas');
    resultFace.hidden = false;
    resultFace.innerHTML = `<img src="${damageCanvas ? damageCanvas.toDataURL('image/jpeg', .92) : faces()[0].url}" alt="${faces()[0].name} 的最终伤情">`;
    $('#swatResultHits').textContent = state.swatHits || 0;
    $('#swatResultMisses').textContent = state.swatMisses || 0;
    $('#swatResultSwelling').textContent = `${Math.min(100, Math.round((state.swatHits || 0) / config.damageCap * 100))}%`;
  }
  $('#singleScore').textContent = `${finalScore} 分`;
  state.resultTimeout = setTimeout(() => {
    $('.single-play').hidden = true;
    $('#singleResult').hidden = false;
    $('#singleResultEmoji').textContent = success ? configs[gameId].emoji : '💥';
    $('#singleResultTitle').textContent = resultMessage;
    $('#singleResultScore').textContent = `${finalScore} 分`;
    state.resultTimeout = null;
  }, isSwat ? 2000 : 850);
}

function setScore(value) {
  state.score = Math.max(0, Math.round(value));
  $('#singleScore').textContent = `${state.score} 分`;
}

function later(callback, delay) {
  const id = setTimeout(callback, delay);
  state.extraTimeouts.push(id);
  return id;
}

function buildCatch() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="counter-chip">得分 <b id="catchCount">0</b> · 连击 <b id="catchCombo">0</b></div><div class="catcher"><img class="face-bubble" src="${face.url}" alt="${face.name}"><div class="catch-basket">好运接收器</div></div>`;
  const catcher = stage.querySelector('.catcher');
  let x = stage.clientWidth / 2 - 50;
  let points = 0, combo = 0;
  let lastDrop = 0;
  const items = [];
  catcher.style.left = `${x}px`;
  const move = (event) => {
    const rect = stage.getBoundingClientRect();
    x = Math.max(0, Math.min(rect.width - 100, event.clientX - rect.left - 50));
    catcher.style.left = `${x}px`;
  };
  stage.addEventListener('pointerdown', move);
  stage.addEventListener('pointermove', (event) => { if (event.buttons) move(event); });

  function loop(time) {
    if (state.finished) return;
    if (time - lastDrop > 520) {
      lastDrop = time;
      const element = document.createElement('div');
      element.className = 'falling-item';
      const roll = Math.random();
      const type = roll < .15 ? 'bomb' : roll < .30 ? 'rare' : 'normal';
      element.textContent = type === 'bomb' ? '💣' : type === 'rare' ? '💎' : ['🍗', '💰', '⭐', '🍰', '🎁'][Math.floor(Math.random() * 5)];
      if (type === 'bomb') element.classList.add('danger-item');
      const item = { element, type, x: Math.random() * (stage.clientWidth - 50), y: -50, speed: 3.6 + Math.random() * 2.2 };
      element.style.left = `${item.x}px`;
      stage.appendChild(element);
      items.push(item);
    }
    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      item.y += item.speed;
      item.element.style.transform = `translateY(${item.y}px) rotate(${item.y * 1.2}deg)`;
      const hitY = stage.clientHeight - 135;
      if (item.y > hitY && item.y < hitY + 45 && item.x + 45 > x && item.x < x + 100) {
        item.element.remove(); items.splice(index, 1);
        if (item.type === 'bomb') { points = Math.max(0, points - 15); combo = 0; catcher.classList.add('hit'); later(() => catcher.classList.remove('hit'), 220); }
        else { combo += 1; points += (item.type === 'rare' ? 12 : 5) + Math.min(10, combo); }
        $('#catchCount').textContent = points; $('#catchCombo').textContent = combo; setScore(points);
      } else if (item.y > stage.clientHeight + 20) { item.element.remove(); items.splice(index, 1); if (item.type !== 'bomb') { combo = 0; $('#catchCombo').textContent = combo; } }
    }
    state.frame = requestAnimationFrame(loop);
  }
  state.onTimeUp = () => finish(points >= 100);
  state.frame = requestAnimationFrame(loop);
}

function buildHold() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="hold-scene"><div class="counter-chip">定力 <b id="holdPercent">0</b>%</div><div class="hold-ring"></div><img class="hold-face" src="${face.url}" alt="${face.name}"><div class="hold-button">按住：保持正经</div><span class="distraction" style="left:9%;top:22%">🪿</span><span class="distraction" style="right:9%;top:30%">🍌</span><span class="distraction" style="left:14%;bottom:18%">🤡</span></div>`;
  const button = stage.querySelector('.hold-button');
  const ring = stage.querySelector('.hold-ring');
  let holding = false, held = 0, previous = 0, releases = 0;
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); holding = true; button.classList.add('pressed'); button.setPointerCapture?.(event.pointerId); });
  const release = () => { holding = false; button.classList.remove('pressed'); if (held > 150 && held < 15000) { releases += 1; held = Math.max(0, held - 1200); button.textContent = `松了 ${releases} 次！继续按`; } };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  function loop(time) {
    if (!previous) previous = time;
    const delta = time - previous; previous = time;
    if (holding) held += delta; else held = Math.max(0, held - delta * .16);
    const progress = Math.min(1, held / 11000);
    ring.style.transform = `rotate(${progress * 360}deg)`;
    $('#holdPercent').textContent = Math.round(progress * 100); setScore(progress * 100 - releases * 3);
    state.frame = requestAnimationFrame(loop);
  }
  state.onTimeUp = () => finish(held >= 9000);
  state.frame = requestAnimationFrame(loop);
}

function buildFind() {
  const stage = $('#singleStage');
  const pool = [...faces()];
  while (pool.length < 4) pool.push(samples[pool.length]);
  let round = 0, correct = 0, mistakes = 0;
  const nextRound = () => {
    if (state.finished) return;
    const shuffled = pool.slice(0, 4).sort(() => Math.random() - .5);
    const target = shuffled[Math.floor(Math.random() * shuffled.length)];
    $('#singlePrompt').textContent = `找对 ${correct}/10 · 目标：${target.name}`;
    const grid = document.createElement('div'); grid.className = 'find-grid';
    shuffled.forEach((face) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'find-card';
      card.innerHTML = `<img src="${face.url}" alt="${face.name}"><span>${face.name}</span>`;
      card.addEventListener('click', () => {
        if (face === target) { correct += 1; round += 1; setScore(correct * 15 - mistakes * 5); nextRound(); }
        else { mistakes += 1; setScore(correct * 15 - mistakes * 5); card.classList.remove('wrong'); void card.offsetWidth; card.classList.add('wrong'); }
      });
      grid.appendChild(card);
    });
    stage.replaceChildren(grid);
  };
  state.onTimeUp = () => finish(correct >= 8);
  nextRound();
}

function buildStyle() {
  const stage = $('#singleStage');
  const face = faces()[0];
  const accessories = [{icon:'👑',label:'皇冠'}, {icon:'🕶️',label:'墨镜'}, {icon:'🎀',label:'蝴蝶结'}, {icon:'🎩',label:'礼帽'}];
  let round = 0;
  stage.innerHTML = `<div class="style-scene"><div class="counter-chip">造型 <b id="styleRound">1</b>/4</div><div class="style-target"><div class="drop-zone"></div><img src="${face.url}" alt="${face.name}"></div><div class="hat" aria-label="可拖动的造型配件">👑</div></div>`;
  const hat = stage.querySelector('.hat'), zone = stage.querySelector('.drop-zone');
  let drag = null;
  hat.addEventListener('pointerdown', (event) => {
    event.preventDefault(); const rect = hat.getBoundingClientRect();
    drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    hat.classList.add('dragging'); hat.setPointerCapture?.(event.pointerId);
  });
  hat.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const rect = stage.getBoundingClientRect();
    hat.style.left = `${event.clientX - rect.left - drag.dx}px`;
    hat.style.top = `${event.clientY - rect.top - drag.dy}px`; hat.style.bottom = 'auto';
  });
  const drop = () => {
    if (!drag) return; drag = null; hat.classList.remove('dragging');
    const a = hat.getBoundingClientRect(), b = zone.getBoundingClientRect();
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 25 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 20) {
      round += 1; setScore(round * 25); $('#styleRound').textContent = Math.min(4, round + 1);
      hat.textContent = accessories[round % accessories.length].icon; hat.setAttribute('aria-label', `可拖动的${accessories[round % accessories.length].label}`); hat.style.left = 'calc(50% - 45px)'; hat.style.top = 'auto'; hat.style.bottom = '25px';
    }
  };
  hat.addEventListener('pointerup', drop);
  hat.addEventListener('pointercancel', drop);
  state.onTimeUp = () => finish(round >= 4);
}

function buildSwat() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="swat-scene"><div class="swat-warning">正在生成五档恶搞脸…</div><div id="swatFace" class="swat-face-wrap"><canvas id="swatFaceCanvas" width="420" height="420" role="img" aria-label="${face.name} 正在逐渐鼻青脸肿"></canvas><strong id="faceCondition">目前：毫发无伤</strong></div><div class="swat-tip">盯准蚊子猛拍，别心疼主角</div></div>`;
  let count = 0, misses = 0;
  state.swatHits = 0; state.swatMisses = 0;
  $('#swatHudHits').textContent = '拍中 0 只 · 漏掉 0';
  $('#swatHudTime').textContent = `剩余 ${config.duration} 秒`;
  const canvas = $('#swatFaceCanvas');
  const faceWrap = $('#swatFace');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const sourceImage = new Image();
  const damageVariant = { flip: Math.random() < .5, vertical: (Math.random() - .5) * .035, secondPalm: Math.random() > .28 };
  const faceBounds = face.faceBox || { x: .2, y: .13, width: .6, height: .72 };
  const faceX = (value) => canvas.width * (faceBounds.x + faceBounds.width * (damageVariant.flip ? 1 - value : value));
  const faceY = (value) => canvas.height * (faceBounds.y + faceBounds.height * value);
  const faceWidth = () => canvas.width * faceBounds.width;
  const faceHeight = () => canvas.height * faceBounds.height;
  const nostrilPoints = face.nostrils || {
    left: { x: faceBounds.x + faceBounds.width * .455, y: faceBounds.y + faceBounds.height * .57 },
    right: { x: faceBounds.x + faceBounds.width * .545, y: faceBounds.y + faceBounds.height * .57 }
  };
  const eyePoints = face.eyes || {
    left: { x: faceBounds.x + faceBounds.width * .32, y: faceBounds.y + faceBounds.height * .4 },
    right: { x: faceBounds.x + faceBounds.width * .68, y: faceBounds.y + faceBounds.height * .41 }
  };
  const canvasPoint = (point) => ({ x: canvas.width * point.x, y: canvas.height * point.y });

  const drawCover = (targetContext, image, size) => {
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const sourceWidth = size / scale, sourceHeight = size / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2, sourceY = (image.naturalHeight - sourceHeight) / 2;
    targetContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
  };

  const bulgePixels = (imageData, centerX, centerY, radius, strength) => {
    const { width, height, data } = imageData;
    const source = new Uint8ClampedArray(data);
    const minX = Math.max(0, Math.floor(centerX - radius)), maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius)), maxY = Math.min(height - 1, Math.ceil(centerY + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - centerX, dy = y - centerY, distance = Math.hypot(dx, dy);
        if (distance >= radius) continue;
        const falloff = 1 - distance / radius;
        const sampleScale = 1 - strength * falloff * falloff;
        const sampleX = Math.max(0, Math.min(width - 1, Math.round(centerX + dx * sampleScale)));
        const sampleY = Math.max(0, Math.min(height - 1, Math.round(centerY + dy * sampleScale)));
        const from = (sampleY * width + sampleX) * 4, to = (y * width + x) * 4;
        data[to] = source[from]; data[to + 1] = source[from + 1]; data[to + 2] = source[from + 2]; data[to + 3] = source[from + 3];
      }
    }
  };

  const paintBruise = (x, y, radiusX, radiusY, alpha) => {
    context.save();
    context.translate(x, y);
    context.rotate(damageVariant.flip ? -.08 : .08);
    context.scale(1, radiusY / radiusX);
    context.filter = 'blur(3.5px)';
    context.globalCompositeOperation = 'multiply';
    const bruise = context.createRadialGradient(-radiusX * .12, -radiusX * .04, radiusX * .05, 0, 0, radiusX);
    bruise.addColorStop(0, `rgba(49,18,67,${alpha * .82})`);
    bruise.addColorStop(.3, `rgba(91,38,91,${alpha})`);
    bruise.addColorStop(.58, `rgba(132,61,88,${alpha * .58})`);
    bruise.addColorStop(.79, `rgba(151,126,45,${alpha * .24})`);
    bruise.addColorStop(1, 'rgba(80,35,92,0)');
    context.fillStyle = bruise;
    context.beginPath();
    context.arc(0, 0, radiusX, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const paintSwelling = (x, y, radiusX, radiusY, severity) => {
    context.save();
    context.translate(x, y);
    context.rotate(damageVariant.flip ? .08 : -.08);
    context.scale(1, radiusY / radiusX);
    context.globalCompositeOperation = 'soft-light';
    context.filter = 'blur(5px)';
    const highlight = context.createRadialGradient(-radiusX * .26, -radiusX * .24, 2, 0, 0, radiusX);
    highlight.addColorStop(0, `rgba(255,220,198,${.14 + severity * .16})`);
    highlight.addColorStop(.46, `rgba(234,91,93,${.08 + severity * .14})`);
    highlight.addColorStop(1, 'rgba(118,30,54,0)');
    context.fillStyle = highlight;
    context.beginPath();
    context.arc(0, 0, radiusX, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const paintPalmPrint = (x, y, scale, rotation, alpha) => {
    context.save(); context.translate(x, y); context.rotate(rotation); context.scale(scale, scale); context.filter = 'blur(1.2px)'; context.globalCompositeOperation = 'multiply';
    context.fillStyle = `rgba(124,18,42,${alpha})`; context.beginPath(); context.ellipse(0, 12, 29, 35, 0, 0, Math.PI * 2); context.fill();
    context.lineWidth = 13; context.lineCap = 'round';
    [[-23,-8,-35,-48],[-10,-17,-15,-61],[3,-19,4,-66],[16,-14,23,-58],[26,-4,39,-42]].forEach(([x1,y1,x2,y2]) => { context.beginPath(); context.moveTo(x1,y1); context.lineTo(x2,y2); context.strokeStyle = `rgba(124,18,42,${alpha * .9})`; context.stroke(); });
    context.restore();
  };

  const paintHeadSmoke = (intensity) => {
    const centerX = canvas.width * (faceBounds.x + faceBounds.width / 2);
    const baseY = Math.max(faceHeight() * .12, faceY(face.detected ? -.12 : .07));
    const puffRadius = clamp(faceWidth() * .09, 18, 36);
    const plumeCount = intensity > .85 ? 3 : 2;
    context.save();
    context.lineCap = 'round';
    for (let i = 0; i < plumeCount; i += 1) {
      const offset = plumeCount === 2 ? (i ? .2 : -.2) : (i - 1) * .22;
      const startX = centerX + faceWidth() * offset;
      const endX = startX + (i % 2 ? 1 : -1) * faceWidth() * (.055 + intensity * .025);
      const endY = Math.max(puffRadius * 1.25, baseY - faceHeight() * (.18 + intensity * .1 + i * .09));
      context.strokeStyle = 'rgba(82,80,88,.88)';
      context.lineWidth = clamp(faceWidth() * .022, 4, 8);
      context.beginPath();
      context.moveTo(startX, baseY);
      context.bezierCurveTo(startX - faceWidth() * .08, baseY - faceHeight() * .07, endX + faceWidth() * .08, endY + faceHeight() * .07, endX, endY);
      context.stroke();

      for (let trailIndex = 1; trailIndex <= 3; trailIndex += 1) {
        const trailProgress = trailIndex / 4;
        const trailX = startX + (endX - startX) * trailProgress + Math.sin(trailIndex * 2.7 + i) * puffRadius * .28;
        const trailY = baseY + (endY - baseY) * trailProgress;
        context.fillStyle = `rgba(208,210,215,${.48 + trailIndex * .1})`;
        context.strokeStyle = 'rgba(82,80,88,.72)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(trailX, trailY, puffRadius * (.15 + trailIndex * .07), 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }

      const puffOffsets = [[0,0],[-.7,.12],[.66,.08],[-.34,-.5],[.34,-.56],[0,.45]];
      context.fillStyle = 'rgba(231,233,236,.96)';
      context.strokeStyle = 'rgba(54,51,61,.9)';
      context.lineWidth = clamp(puffRadius * .08, 2, 3.5);
      puffOffsets.forEach(([px, py], puffIndex) => {
        const radius = puffRadius * (puffIndex ? .62 : .88);
        context.beginPath();
        context.arc(endX + px * puffRadius, endY + py * puffRadius, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
      context.fillStyle = 'rgba(255,255,255,.75)';
      context.beginPath();
      context.arc(endX - puffRadius * .2, endY - puffRadius * .28, puffRadius * .22, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  };

  const paintComicStar = (x, y, radius, rotation, color) => {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.fillStyle = color;
    context.strokeStyle = '#18131f';
    context.lineWidth = Math.max(3, radius * .12);
    context.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 8;
      const pointRadius = i % 2 ? radius * .43 : radius;
      const px = Math.cos(angle) * pointRadius;
      const py = Math.sin(angle) * pointRadius;
      if (!i) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  };

  const paintSwollenShutEye = (x, y, rotation, severity) => {
    const radiusX = faceWidth() * (.135 + severity * .012);
    const radiusY = faceHeight() * (.052 + severity * .012);
    const sampleX = Math.round(clamp(x, 0, canvas.width - 1));
    const sampleY = Math.round(clamp(y + faceHeight() * .075, 0, canvas.height - 1));
    const skin = context.getImageData(sampleX, sampleY, 1, 1).data;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.filter = 'blur(1.1px)';
    context.fillStyle = `rgba(${skin[0]},${skin[1]},${skin[2]},.86)`;
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
    const swelling = context.createRadialGradient(0, -radiusY * .3, radiusY * .12, 0, 0, radiusX);
    swelling.addColorStop(0, 'rgba(242,151,153,.3)');
    swelling.addColorStop(.55, 'rgba(126,55,80,.34)');
    swelling.addColorStop(1, 'rgba(71,29,60,0)');
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = swelling;
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.filter = 'none';
    context.strokeStyle = 'rgba(48,25,39,.82)';
    context.lineWidth = clamp(faceWidth() * .016, 3, 6);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-radiusX * .72, 0);
    context.quadraticCurveTo(0, radiusY * .34, radiusX * .72, 0);
    context.stroke();
    context.strokeStyle = 'rgba(255,203,196,.46)';
    context.lineWidth = Math.max(1.5, faceWidth() * .006);
    context.beginPath();
    context.moveTo(-radiusX * .58, -radiusY * .32);
    context.quadraticCurveTo(0, -radiusY * .55, radiusX * .55, -radiusY * .3);
    context.stroke();
    context.restore();
  };

  const paintNosebleed = (primaryNostril, secondaryNostril, width, height, severity) => {
    const direction = primaryNostril.x < secondaryNostril.x ? -1 : 1;
    const streamLength = height * (.12 + severity * .1);
    const startX = primaryNostril.x;
    const startY = primaryNostril.y + height * .008;
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.filter = 'blur(.45px)';
    context.strokeStyle = `rgba(92,4,15,${.72 + severity * .2})`;
    context.lineWidth = clamp(width * .022, 3.5, 7);
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(startX + direction * width * .018, startY + streamLength * .28, startX - direction * width * .012, startY + streamLength * .62, startX + direction * width * .025, startY + streamLength);
    context.stroke();
    context.strokeStyle = `rgba(224,32,39,${.55 + severity * .25})`;
    context.lineWidth = clamp(width * .008, 1.5, 3);
    context.beginPath();
    context.moveTo(startX - direction * 1.5, startY + 2);
    context.bezierCurveTo(startX + direction * width * .01, startY + streamLength * .34, startX - direction * width * .018, startY + streamLength * .66, startX + direction * width * .02, startY + streamLength * .94);
    context.stroke();
    context.fillStyle = `rgba(104,3,16,${.72 + severity * .2})`;
    context.beginPath();
    context.ellipse(startX + direction * width * .025, startY + streamLength, width * .026, height * .018, direction * .2, 0, Math.PI * 2);
    context.fill();
    if (severity > .78) {
      const secondX = secondaryNostril.x;
      const secondY = secondaryNostril.y + height * .008;
      context.strokeStyle = `rgba(111,5,18,${severity * .72})`;
      context.lineWidth = clamp(width * .014, 2.5, 5);
      context.beginPath();
      context.moveTo(secondX, secondY);
      context.bezierCurveTo(secondX - direction * width * .01, secondY + streamLength * .3, secondX + direction * width * .015, secondY + streamLength * .52, secondX, secondY + streamLength * .72);
      context.stroke();
    }
    context.restore();
  };

  const renderDamageFrame = (damageCount) => {
    if (!sourceImage.complete || !sourceImage.naturalWidth) return;
    const size = canvas.width;
    context.clearRect(0, 0, size, size); drawCover(context, sourceImage, size);
    if (!damageCount) return;
    const severity = Math.min(1, damageCount / config.damageCap);
    const stage = Math.min(5, Math.max(1, Math.round(damageCount / 5)));
    const pixels = context.getImageData(0, 0, size, size);
    const mainCheekX = faceX(.29), mainCheekY = faceY(.64 + damageVariant.vertical);
    const otherCheekX = faceX(.71), otherCheekY = faceY(.62 - damageVariant.vertical);
    if (damageCount >= 25) {
      bulgePixels(pixels, mainCheekX, mainCheekY, faceWidth() * .35, .31);
      bulgePixels(pixels, otherCheekX, otherCheekY, faceWidth() * .34, .29);
      bulgePixels(pixels, faceX(.5), faceY(.75), faceWidth() * .26, .2);
    }
    bulgePixels(pixels, mainCheekX, mainCheekY, faceWidth() * (.37 + stage * .008), .12 + severity * .2);
    if (damageCount >= 10) bulgePixels(pixels, otherCheekX, otherCheekY, faceWidth() * (.36 + stage * .008), .1 + severity * .18);
    if (damageCount >= 15) bulgePixels(pixels, faceX(.5), faceY(.54), faceWidth() * .21, .08 + severity * .12);
    if (damageCount >= 20) bulgePixels(pixels, faceX(.5), faceY(.74), faceWidth() * .26, .1 + severity * .14);
    context.putImageData(pixels, 0, 0);

    if (damageCount >= 15) paintHeadSmoke(severity);

    context.save(); context.globalCompositeOperation = 'multiply'; context.filter = 'blur(7px)';
    const leftRed = context.createRadialGradient(mainCheekX,mainCheekY,4,mainCheekX,mainCheekY,faceWidth()*.38);
    leftRed.addColorStop(0,`rgba(224,38,55,${.22 + severity * .25})`); leftRed.addColorStop(1,'rgba(218,45,58,0)'); context.fillStyle=leftRed; context.fillRect(0,0,size,size);
    if (damageCount >= 10) { const rightRed=context.createRadialGradient(otherCheekX,otherCheekY,4,otherCheekX,otherCheekY,faceWidth()*.37); rightRed.addColorStop(0,`rgba(220,33,54,${.2 + severity*.22})`); rightRed.addColorStop(1,'rgba(204,37,57,0)'); context.fillStyle=rightRed; context.fillRect(0,0,size,size); }
    context.restore();

    paintSwelling(mainCheekX, mainCheekY, faceWidth() * .42, faceHeight() * .3, Math.min(1, .35 + severity));
    if (damageCount >= 10) paintSwelling(otherCheekX, otherCheekY, faceWidth() * .4, faceHeight() * .29, Math.min(1, .2 + severity));
    paintPalmPrint(faceX(.24), faceY(.65 + damageVariant.vertical), clamp(faceWidth() / 300, .56, .82), damageVariant.flip ? .2 : -.2, Math.min(.44, .22 + severity * .22));
    if (damageCount >= 10) paintPalmPrint(faceX(.73), faceY(.61 - damageVariant.vertical), clamp(faceWidth() / 330, .5, .72), damageVariant.flip ? -.16 : .16, Math.min(.38, .18 + severity * .2));
    const leftEye = canvasPoint(eyePoints.left);
    const rightEye = canvasPoint(eyePoints.right);
    const eyeLineAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    if (damageCount >= 20) {
      paintSwollenShutEye(leftEye.x, leftEye.y, eyeLineAngle, severity);
      paintSwollenShutEye(rightEye.x, rightEye.y, eyeLineAngle, severity);
    }
    paintBruise(leftEye.x, leftEye.y, faceWidth() * .24, faceHeight() * .12, Math.min(.72, .22 + severity * .52));
    if (damageCount >= 10) paintBruise(rightEye.x, rightEye.y, faceWidth() * .22, faceHeight() * .11, Math.min(.65, .16 + severity * .46));
    if (damageCount >= 15) paintBruise(faceX(.5), faceY(.54), faceWidth() * .13, faceHeight() * .1, Math.min(.42, .12 + severity * .32));
    const leftNostril = canvasPoint(nostrilPoints.left);
    const rightNostril = canvasPoint(nostrilPoints.right);
    if (damageCount >= 10) {
      paintNosebleed(damageVariant.flip ? rightNostril : leftNostril, damageVariant.flip ? leftNostril : rightNostril, faceWidth(), faceHeight(), severity);
    }
    if (damageCount >= 20) {
      paintBruise(leftEye.x, leftEye.y, faceWidth() * .25, faceHeight() * .12, .52);
      paintBruise(rightEye.x, rightEye.y, faceWidth() * .24, faceHeight() * .12, .48);
      context.save(); context.globalCompositeOperation='screen'; context.filter='blur(5px)'; context.fillStyle='rgba(255,215,82,.24)'; context.beginPath(); context.ellipse((leftEye.x + rightEye.x) / 2,(leftEye.y + rightEye.y) / 2,faceWidth()*.36,faceHeight()*.18,eyeLineAngle,0,Math.PI*2); context.fill(); context.restore();
    }
    if (damageCount >= 25) {
      paintComicStar(faceX(.08), faceY(.17), faceWidth() * .12, -.2, '#ffe23e');
      paintComicStar(faceX(.91), faceY(.24), faceWidth() * .09, .24, '#ff5e79');
    }
  };

  const preparedDamageStages = new Map();
  const displayPreparedDamage = (hitCount) => {
    const stageCount = Math.min(config.damageCap, Math.floor(hitCount / 5) * 5);
    const prepared = preparedDamageStages.get(stageCount);
    if (prepared) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(prepared, 0, 0);
    }
  };

  const prepareDamageStages = () => {
    [0, 5, 10, 15, 20, 25].forEach((stageCount) => {
      renderDamageFrame(stageCount);
      const snapshot = document.createElement('canvas');
      snapshot.width = canvas.width; snapshot.height = canvas.height;
      snapshot.getContext('2d').drawImage(canvas, 0, 0);
      preparedDamageStages.set(stageCount, snapshot);
    });
    displayPreparedDamage(count);
    $('.swat-warning').textContent = '蚊子围攻中';
    spawn(); spawn(); spawn();
  };
  sourceImage.addEventListener('load', prepareDamageStages, { once: true });
  sourceImage.src = face.url;

  const addDamage = () => {
    displayPreparedDamage(count);
    faceWrap.classList.remove('just-slapped'); void faceWrap.offsetWidth; faceWrap.classList.add('just-slapped');
    faceWrap.dataset.damage = Math.min(5, Math.floor(count / 5));
    $('#faceCondition').textContent = count < 5 ? '目前：毫发无伤' : count < 10 ? '5掌：掌印盖章' : count < 15 ? '10掌：鼻血警告' : count < 20 ? '15掌：头顶冒烟' : count < 25 ? '20掌：脑袋宕机' : '25掌：眼肿成缝';
  };

  const showSlap = (bug) => {
    const stageRect = stage.getBoundingClientRect();
    const bugRect = bug.getBoundingClientRect();
    const slap = document.createElement('span');
    slap.className = 'slap-fx'; slap.textContent = '✋';
    slap.style.left = `${bugRect.left - stageRect.left + bugRect.width / 2}px`;
    slap.style.top = `${bugRect.top - stageRect.top + bugRect.height / 2}px`;
    const word = document.createElement('b'); word.className = 'slap-word'; word.textContent = ['啪！','啪叽！','拍肿！','好响！'][count % 4];
    slap.appendChild(word); stage.appendChild(slap); later(() => slap.remove(), 520);
  };

  const spawn = () => {
    if (state.finished) return;
    const bug = document.createElement('button');
    const depthRoll = Math.random();
    const depthClass = depthRoll < .28 ? ' bug-far' : depthRoll > .76 ? ' bug-near' : ' bug-mid';
    bug.type = 'button'; bug.className = `bug-target flying-mosquito${depthClass}`; bug.innerHTML = '<img src="assets/mosquito-real.png" alt="">'; bug.setAttribute('aria-label','拍掉蚊子');
    const bugX = clamp((faceBounds.x + faceBounds.width * (.08 + Math.random() * .68)) * 100, 5, 78);
    const bugY = clamp((faceBounds.y + faceBounds.height * (.08 + Math.random() * .7)) * 100, 5, 78);
    bug.style.left = `${bugX}%`; bug.style.top = `${bugY}%`;
    bug.style.setProperty('--fly-x', `${Math.round(-12 + Math.random() * 24)}px`);
    bug.style.setProperty('--fly-y', `${Math.round(-10 + Math.random() * 20)}px`);
    bug.style.setProperty('--fly-time', `${(1.05 + Math.random() * .65).toFixed(2)}s`);
    bug.addEventListener('click', () => {
      if (bug.disabled || state.finished) return;
      bug.disabled = true; count += 1; state.swatHits = count; $('#swatHudHits').textContent = `拍中 ${count} 只 · 漏掉 ${misses}`;
      showSlap(bug); addDamage(); playSwatHit(count);
      if (count % 5 === 0) playSwatCry();
      navigator.vibrate?.(count % 5 === 0 ? [24, 12, 38] : 18);
      stage.classList.remove('impact-feedback'); void stage.offsetWidth; stage.classList.add('impact-feedback');
      later(() => stage.classList.remove('impact-feedback'), 180);
      bug.innerHTML = '<span class="bug-splat"></span>'; bug.classList.add('squashed');
      setScore(count * 20 - misses);
      later(() => { bug.remove(); spawn(); if (count >= 7 && Math.random() < .36) spawn(); }, 280);
    });
    faceWrap.appendChild(bug);
    later(() => {
      if (!bug.disabled && bug.isConnected && !state.finished) {
        bug.remove(); misses += 1; state.swatMisses = misses; $('#swatHudHits').textContent = `拍中 ${count} 只 · 漏掉 ${misses}`; setScore(count * 20 - misses); playSwatMiss(); spawn();
      }
    }, Math.max(1800, 3300 - count * 34));
  };
  state.onTimeUp = () => finish(true);
}

function buildWake() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="wake-scene"><div class="sleep-z">Z Z Z</div><div class="counter-chip">叫醒 <b id="wakeRounds">0</b>/2 次</div><div class="wake-meter"><span></span></div><button class="wake-face" type="button"><img src="${face.url}" alt="${face.name}"></button><b>清醒值 <span id="wakeCount">0</span>/100</b></div>`;
  let energy = 0, previous = 0, wakeRounds = 0;
  stage.querySelector('.wake-face').addEventListener('click', (event) => {
    energy = Math.min(100, energy + 4); $('#wakeCount').textContent = Math.round(energy); setScore(wakeRounds * 100 + energy);
    event.currentTarget.style.transform = `rotate(${energy % 8 < 4 ? -7 : 7}deg) scale(${1 + energy / 900})`;
    if (energy >= 100) { wakeRounds += 1; $('#wakeRounds').textContent = wakeRounds; energy = 18; }
  });
  const meter = stage.querySelector('.wake-meter span');
  const loop = (time) => {
    if (!previous) previous = time;
    const delta = time - previous; previous = time;
    energy = Math.max(0, energy - delta * .0028); meter.style.transform = `scaleX(${energy / 100})`; $('#wakeCount').textContent = Math.round(energy);
    state.frame = requestAnimationFrame(loop);
  };
  state.onTimeUp = () => finish(wakeRounds >= 2 || (wakeRounds === 1 && energy >= 75));
  state.frame = requestAnimationFrame(loop);
}

function buildFeed() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="feed-scene"><div class="counter-chip">吃下 <b id="feedCount">0</b>/10 · 黑暗料理 <b id="badFoodCount">0</b></div><div class="feed-face"><img src="${face.url}" alt="${face.name}"><div class="mouth-zone">嘴</div></div><div class="food-tip">坏东西点一下丢掉</div><div class="food-drag" role="button" aria-label="可拖动的食物">🥟</div></div>`;
  const food = stage.querySelector('.food-drag');
  const mouth = stage.querySelector('.mouth-zone');
  const goodFoods = ['🥟','🍓','🍗','🍰','🍙','🍕'];
  const badFoods = ['🧼','🪨','🧦'];
  let drag = null, eaten = 0, bad = 0, currentBad = false, skipClick = false;
  const nextFood = () => {
    currentBad = Math.random() < .23;
    const pool = currentBad ? badFoods : goodFoods;
    food.textContent = pool[Math.floor(Math.random() * pool.length)];
    food.classList.toggle('bad-food', currentBad); food.style.left = 'calc(50% - 42px)'; food.style.top = 'auto'; food.style.bottom = '7%';
  };
  food.addEventListener('pointerdown', (event) => {
    event.preventDefault(); const rect = food.getBoundingClientRect();
    drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    food.setPointerCapture?.(event.pointerId); food.classList.add('dragging');
  });
  food.addEventListener('pointermove', (event) => {
    if (!drag) return; const rect = stage.getBoundingClientRect();
    food.style.left = `${event.clientX - rect.left - drag.dx}px`; food.style.top = `${event.clientY - rect.top - drag.dy}px`; food.style.bottom = 'auto';
  });
  food.addEventListener('pointerup', () => {
    if (!drag) return; drag = null; food.classList.remove('dragging');
    const a = food.getBoundingClientRect(), b = mouth.getBoundingClientRect();
    if (Math.min(a.right,b.right)-Math.max(a.left,b.left) > 20 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 15) {
      skipClick = true; later(() => { skipClick = false; }, 0);
      if (currentBad) { bad += 1; $('#badFoodCount').textContent = bad; }
      else { eaten += 1; $('#feedCount').textContent = eaten; }
      setScore(eaten * 15 - bad * 12);
      nextFood();
    }
  });
  food.addEventListener('click', () => {
    if (currentBad && !drag && !skipClick) { setScore(state.score + 5); nextFood(); }
  });
  state.onTimeUp = () => finish(eaten >= 8 && bad <= 3);
  nextFood();
}

function buildSnap() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="snap-scene"><div class="counter-chip">抓拍 <b id="snapCount">0</b>/5 · 抢跑 <b id="snapFalse">0</b></div><div class="snap-light">等一下…</div><img src="${face.url}" alt="${face.name}"><button class="shutter" type="button">📸 按快门</button></div>`;
  const light = stage.querySelector('.snap-light');
  const shutter = stage.querySelector('.shutter');
  let ready = false, hits = 0, falseStarts = 0, roundLocked = false;
  const nextRound = () => {
    if (state.finished) return;
    ready = false; roundLocked = false; light.textContent = '等一下…'; light.classList.remove('ready');
    later(() => {
      if (state.finished) return; ready = true; light.textContent = '现在！'; light.classList.add('ready');
      later(() => { if (ready && !roundLocked) { ready = false; light.textContent = '错过！'; later(nextRound, 500); } }, 1050);
    }, 1000 + Math.random() * 1700);
  };
  shutter.addEventListener('click', () => {
    if (roundLocked) return;
    if (ready) { roundLocked = true; ready = false; hits += 1; $('#snapCount').textContent = hits; setScore(hits * 22 - falseStarts * 8); light.textContent = '咔嚓！'; later(nextRound, 550); }
    else { falseStarts += 1; $('#snapFalse').textContent = falseStarts; setScore(hits * 22 - falseStarts * 8); light.textContent = '太早！'; }
  });
  state.onTimeUp = () => finish(hits >= 4);
  nextRound();
}

function buildShake() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="shake-scene"><div class="counter-chip">档位 <b id="shakeLevel">1</b>/3</div><img src="${face.url}" alt="${face.name}"><div class="shake-meter"><span></span></div><b id="shakeHint">← 热身：左右猛滑 →</b></div>`;
  const image = stage.querySelector('img');
  const fill = stage.querySelector('.shake-meter span');
  let lastX = null, distance = 0, level = 1;
  const move = (event) => {
    if (lastX !== null) distance += Math.abs(event.clientX - lastX);
    lastX = event.clientX; const progress = Math.min(1, distance / 2500);
    fill.style.transform = `scaleX(${progress})`; image.style.transform = `translateX(${Math.sin(distance / 15) * 18}px) rotate(${Math.sin(distance / 10) * 6}deg)`;
    const nextLevel = Math.min(3, Math.floor(progress * 3) + 1);
    if (nextLevel !== level) { level = nextLevel; $('#shakeLevel').textContent = level; $('#shakeHint').textContent = level === 2 ? '← 加速！再用力 →' : '← 狂暴档！别停 →'; }
    setScore(progress * 100);
  };
  stage.addEventListener('pointerdown', (event) => { lastX = event.clientX; stage.setPointerCapture?.(event.pointerId); });
  stage.addEventListener('pointermove', (event) => { if (event.buttons) move(event); });
  stage.addEventListener('pointerup', () => { lastX = null; });
  state.onTimeUp = () => finish(distance >= 2000);
}

function buildWipe() {
  const stage = $('#singleStage');
  const face = faces()[0];
  stage.innerHTML = `<div class="wipe-scene"><img src="${face.url}" alt="${face.name}"><div class="counter-chip">清理 <b id="wipeCount">0</b>/15 · 连击 <b id="wipeCombo">0</b></div></div>`;
  let cleaned = 0, combo = 0, spawned = 0;
  const spawnSpot = () => {
    if (state.finished) return;
    spawned += 1;
    const spot = document.createElement('button'); spot.type = 'button'; spot.className = 'sauce-spot';
    spot.textContent = ['🍅','🟤','🟡'][spawned % 3]; spot.style.left = `${20 + Math.random() * 58}%`; spot.style.top = `${18 + Math.random() * 57}%`;
    const wipe = (event) => { event.preventDefault(); if (spot.disabled) return; spot.disabled = true; spot.classList.add('wiped'); cleaned += 1; combo += 1; $('#wipeCount').textContent = cleaned; $('#wipeCombo').textContent = combo; setScore(cleaned * 6 + combo); later(() => { spot.remove(); spawnSpot(); }, 220); };
    spot.addEventListener('pointerdown', wipe); stage.appendChild(spot);
    later(() => { if (!spot.disabled && spot.isConnected) { combo = 0; $('#wipeCombo').textContent = combo; } }, 2200);
  };
  for (let i = 0; i < 6; i += 1) spawnSpot();
  state.onTimeUp = () => finish(cleaned >= 12);
}

renderPreview();
