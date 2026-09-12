const defaultApps = [
  ['safari', 'Safari', 'icons/safari.svg', 'app.html?app=safari', true],
  ['mail', 'Mail', 'icons/mail.svg', 'app.html?app=mail', true],
  ['photos', 'Photos', 'icons/photos.svg', 'app.html?app=photos', true],
  ['music', 'Musique', 'icons/music.svg', 'app.html?app=music', true],
  ['calendar', 'Calendrier', 'icons/calendar.svg', 'app.html?app=calendar', false],
  ['camera', 'Appareil photo', 'icons/camera.svg', 'app.html?app=camera', false],
  ['notes', 'Notes', 'icons/notes.svg', 'app.html?app=notes', false],
  ['maps', 'Plans', 'icons/maps.svg', 'app.html?app=maps', false],
  ['weather', 'Meteo', 'icons/weather.svg', 'app.html?app=weather', false],
  ['files', 'Fichiers', 'icons/files.svg', 'app.html?app=files', false],
  ['facetime', 'FaceTime', 'icons/facetime.svg', 'app.html?app=facetime', false],
  ['reminders', 'Rappels', 'icons/reminders.svg', 'app.html?app=reminders', false],
  ['google', 'Google', 'icons/google.svg', 'https://google.com/?igu=1', false],
  ['youtube', 'YouTube', 'icons/youtube.svg', 'app.html?app=youtube', false],
  ['appstore', 'App Store', 'icons/appstore.svg', 'app.html?app=appstore', false],
  ['settings', 'Reglages', 'icons/settings.svg', '', true]
];

const layoutConfig = {
  columns: 8,
  rows: 5,
  horizontalGap: 12,
  verticalGap: 26,
  iconSize: 68,
  ...(window.HOME_LAYOUT_CONFIG || {})
};

const state = {
  apps: [],
  appVisibility: null,
  recent: JSON.parse(localStorage.getItem('home-recent') || '[]'),
  settings: { spacing: layoutConfig.verticalGap, size: layoutConfig.iconSize, blur: 0, labels: true },
  touchStart: null,
  wallpapers: ['wallpaper.png'],
  wallpaperIndex: 0,
  navigationId: 0,
  dockHideTimer: null,
  suppressDockClick: false
};

const $ = (selector) => document.querySelector(selector);
const screen = $('#screen');
const appGrid = $('#app-grid');
const dockPinned = $('#dock-pinned');
const dockRecent = $('#dock-recent');
const dockDivider = $('#dock-divider');
const dockWrap = $('#dock-wrap');
const appView = $('#app-view');
const appFrame = $('#app-frame');
const appSwitcher = $('#app-switcher');
const settingsPanel = $('#settings-panel');
const appSwipeLayer = $('#app-swipe-layer');

async function loadApps() {
  try {
    const [manifest, appVisibility] = await Promise.all([
      fetch('config/apps/manifest.json').then((response) => response.json()),
      fetch('apps.json').then((response) => response.json())
    ]);
    state.appVisibility = appVisibility;
    const loadedApps = await Promise.all(manifest.map(async (file) => {
      try {
        const response = await fetch(`config/apps/${encodeURIComponent(file)}`);
        if (!response.ok) return null;
        const app = await response.json();
        return { ...app, id: file.replace(/\.json$/i, '') };
      } catch (_) {
        return null;
      }
    }));
    const loaded = loadedApps.filter(Boolean);
    const displayed = Array.isArray(appVisibility.displayed) ? new Set(appVisibility.displayed) : null;
    const hidden = new Set(Array.isArray(appVisibility.hidden) ? appVisibility.hidden : []);
    state.apps = loaded.filter((app) => (!displayed || displayed.has(app.id)) && !hidden.has(app.id));
    if (!state.apps.length) throw new Error('Aucune application chargee');
  } catch (error) {
    state.apps = defaultApps.map(([id, name, image, url, dock]) => ({ id, name, image, url, dock }));
    $('#config-mode').classList.add('visible');
  }
  render();
}

function appButton(app, compact = false) {
  const button = document.createElement('button');
  button.className = compact ? 'dock-app' : 'app-icon';
  button.type = 'button';
  button.dataset.appId = app.id;
  button.title = app.name;
  button.setAttribute('aria-label', `Ouvrir ${app.name}`);
  const image = document.createElement('img');
  const cacheBust = app.id === 'google' ? '?v=2' : '';
  image.src = `config/apps/${app.image}${cacheBust}`;
  image.alt = '';
  const label = document.createElement('span');
  label.textContent = app.name;
  button.append(image, label);
  button.addEventListener('click', () => openApp(app));
  return button;
}

function render() {
  appGrid.replaceChildren();
  dockPinned.replaceChildren();
  dockRecent.replaceChildren();
  state.apps.forEach((app) => appGrid.appendChild(appButton(app)));
  state.apps.filter((app) => app.dock).forEach((app) => dockPinned.appendChild(appButton(app, true)));
  state.recent.map((id) => state.apps.find((app) => app.id === id)).filter(Boolean)
    .forEach((app) => dockRecent.appendChild(appButton(app, true)));
  dockDivider.classList.toggle('hidden', !dockRecent.children.length);
  applySettings();
  renderSwitcher();
}

function openApp(app) {
  if (app.id === 'settings') {
    openSettings();
    return;
  }
  state.recent = [app.id, ...state.recent.filter((id) => id !== app.id)].slice(0, 5);
  localStorage.setItem('home-recent', JSON.stringify(state.recent));
  render();
  $('#app-view-title').textContent = app.name;
  appView.classList.add('open');
  document.body.classList.add('app-open');
  appView.setAttribute('aria-hidden', 'false');
  const navigationId = ++state.navigationId;
  appFrame.removeAttribute('src');
  requestAnimationFrame(() => {
    if (navigationId === state.navigationId) appFrame.src = app.url || 'about:blank';
  });
}

function goHome() {
  state.navigationId += 1;
  clearTimeout(state.dockHideTimer);
  screen.insertBefore(dockWrap, $('#home-indicator-wrap'));
  dockWrap.classList.remove('from-app');
  dockWrap.classList.remove('dock-idle');
  appView.classList.remove('open');
  document.body.classList.remove('app-open');
  appView.setAttribute('aria-hidden', 'true');
  appSwitcher.classList.remove('open');
  appFrame.src = 'about:blank';
}

function showAppDock() {
  if (dockWrap.parentElement !== document.body) document.body.appendChild(dockWrap);
  render();
  dockWrap.classList.add('from-app');
  dockWrap.classList.remove('dock-idle');
  scheduleDockHide();
}

function scheduleDockHide() {
  clearTimeout(state.dockHideTimer);
  state.dockHideTimer = setTimeout(() => {
    if (appView.classList.contains('open')) dockWrap.classList.add('dock-idle');
  }, 2000);
}

function keepDockVisible() {
  if (!appView.classList.contains('open')) return;
  dockWrap.classList.remove('dock-idle');
  scheduleDockHide();
}

function updateNetworkStatus() {
  const networkStatus = $('#network-status');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const online = navigator.onLine;
  const type = connection?.effectiveType || '';
  const level = !online ? 'none' : type === 'slow-2g' || type === '2g' ? 'weak' : type === '3g' ? 'medium' : 'strong';
  networkStatus.dataset.level = level;
  networkStatus.style.opacity = level === 'none' ? '0.35' : level === 'weak' ? '0.5' : level === 'medium' ? '0.75' : '1';
  networkStatus.setAttribute('aria-label', online ? `Réseau ${level}` : 'Hors connexion');
  networkStatus.title = online ? `Réseau ${level}` : 'Hors connexion';
}

function updateBatteryStatus(battery) {
  const batteryStatus = $('#battery-status');
  const batteryLevel = $('#battery-level');
  const percentage = Math.round(battery.level * 100);
  batteryLevel.setAttribute('width', `${17 * battery.level}`);
  batteryStatus.setAttribute('aria-label', `Batterie ${percentage}%`);
  batteryStatus.title = `Batterie ${percentage}%${battery.charging ? ' - en charge' : ''}`;
  batteryStatus.style.opacity = percentage <= 10 ? '0.55' : '1';
}

function initializeSystemStatus() {
  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  connection?.addEventListener('change', updateNetworkStatus);
  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      updateBatteryStatus(battery);
      battery.addEventListener('levelchange', () => updateBatteryStatus(battery));
      battery.addEventListener('chargingchange', () => updateBatteryStatus(battery));
    }).catch(() => {});
  }
}

function showSwitcher() {
  renderSwitcher();
  appSwitcher.classList.add('open');
}

function renderSwitcher() {
  const track = $('#switcher-track');
  track.replaceChildren();
  const recentApps = state.recent.map((id) => state.apps.find((app) => app.id === id)).filter(Boolean);
  $('#switcher-empty').style.display = recentApps.length ? 'none' : 'block';
  recentApps.forEach((app) => {
    const card = document.createElement('div');
    card.className = 'switcher-card';
    card.appendChild(appButton(app));
    card.addEventListener('click', (event) => {
      if (event.target.closest('.app-icon')) return;
      appSwitcher.classList.remove('open');
      openApp(app);
    });
    track.appendChild(card);
  });
}

function readSettings() {
  try { state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem('home-settings') || '{}') }; } catch (_) {}
  $('#icon-spacing').value = state.settings.spacing;
  $('#icon-size-setting').value = state.settings.size;
  $('#background-blur-setting').value = state.settings.blur;
  $('#show-labels').checked = state.settings.labels;
}

function applySettings() {
  document.documentElement.style.setProperty('--grid-columns', layoutConfig.columns);
  document.documentElement.style.setProperty('--grid-rows', layoutConfig.rows);
  document.documentElement.style.setProperty('--grid-column-gap', `${layoutConfig.horizontalGap}px`);
  document.documentElement.style.setProperty('--grid-row-gap', `${state.settings.spacing}px`);
  document.documentElement.style.setProperty('--icon-size', `${state.settings.size}px`);
  document.documentElement.style.setProperty('--background-blur', `${state.settings.blur}px`);
  appGrid.classList.toggle('labels-hidden', !state.settings.labels);
}

function saveSettings() {
  state.settings = {
    spacing: Number($('#icon-spacing').value),
    size: Number($('#icon-size-setting').value),
    blur: Number($('#background-blur-setting').value),
    labels: $('#show-labels').checked
  };
  localStorage.setItem('home-settings', JSON.stringify(state.settings));
  applySettings();
}

function openSettings() {
  readSettings();
  settingsPanel.classList.add('open');
  settingsPanel.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsPanel.setAttribute('aria-hidden', 'true');
}

function handleGesture(start, end) {
  const distance = start.y - end.y;
  const isBottomStart = start.y > window.innerHeight * 0.72;
  if (distance > 55 && isBottomStart) {
    if (appView.classList.contains('open') && !dockWrap.classList.contains('from-app')) showAppDock();
    else if (appView.classList.contains('open')) goHome();
    else if (appSwitcher.classList.contains('open')) goHome();
  }
  if (distance < -55 && appSwitcher.classList.contains('open')) goHome();
}

$('#search-input').addEventListener('input', (event) => {
  const query = event.target.value.toLocaleLowerCase();
  appGrid.querySelectorAll('.app-icon').forEach((button) => {
    button.classList.toggle('hidden', !button.textContent.toLocaleLowerCase().includes(query));
  });
});
function applyWallpaper(filename) {
  const encodedFilename = encodeURIComponent(filename);
  document.documentElement.style.setProperty('--wallpaper-image', `url("config/background/${encodedFilename}")`);
  state.wallpaper = filename;
  state.wallpaperIndex = Math.max(0, state.wallpapers.indexOf(filename));
  localStorage.setItem('home-wallpaper', filename);
}

async function loadWallpapers() {
  try {
    const manifest = await fetch('config/background/manifest.json').then((response) => response.json());
    if (Array.isArray(manifest) && manifest.length) state.wallpapers = manifest;
  } catch (_) {}
  const savedWallpaper = localStorage.getItem('home-wallpaper');
  const initialWallpaper = state.wallpapers.includes(savedWallpaper) ? savedWallpaper : state.wallpapers[0];
  applyWallpaper(initialWallpaper);
}

$('#wallpaper-toggle').addEventListener('click', () => {
  const nextIndex = (state.wallpaperIndex + 1) % state.wallpapers.length;
  applyWallpaper(state.wallpapers[nextIndex]);
});
$('#config-mode').addEventListener('click', (event) => event.currentTarget.classList.remove('visible'));
$('#home-indicator').addEventListener('click', showSwitcher);
$('#close-switcher').addEventListener('click', goHome);
$('#dock-home').addEventListener('click', goHome);
$('#app-view-home').addEventListener('click', goHome);
$('#app-view-close').addEventListener('click', goHome);
$('#app-dock-trigger').addEventListener('click', showAppDock);
['pointermove', 'pointerdown', 'click'].forEach((eventName) => dockWrap.addEventListener(eventName, keepDockVisible));
dockWrap.addEventListener('pointerdown', (event) => {
  if (!appView.classList.contains('open') || !['touch', 'pen'].includes(event.pointerType)) return;
  event.preventDefault();
  state.touchStart = { x: event.clientX, y: event.clientY };
  dockWrap.setPointerCapture(event.pointerId);
}, { passive: false, capture: true });
dockWrap.addEventListener('pointerup', (event) => {
  if (!state.touchStart || !appView.classList.contains('open') || !['touch', 'pen'].includes(event.pointerType)) return;
  event.preventDefault();
  const start = state.touchStart;
  const end = { x: event.clientX, y: event.clientY };
  state.touchStart = null;
  if (start.y - end.y > 55) {
    state.suppressDockClick = true;
    goHome();
  }
  if (dockWrap.hasPointerCapture(event.pointerId)) dockWrap.releasePointerCapture(event.pointerId);
}, { passive: false, capture: true });
dockWrap.addEventListener('pointercancel', () => { state.touchStart = null; }, { passive: true, capture: true });
dockWrap.addEventListener('touchstart', (event) => {
  if (!appView.classList.contains('open')) return;
  event.preventDefault();
  const touch = event.changedTouches[0];
  state.touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: false, capture: true });
dockWrap.addEventListener('touchend', (event) => {
  if (!state.touchStart || !appView.classList.contains('open')) return;
  event.preventDefault();
  const touch = event.changedTouches[0];
  const start = state.touchStart;
  state.touchStart = null;
  if (start.y - touch.clientY > 55) {
    state.suppressDockClick = true;
    goHome();
  }
}, { passive: false, capture: true });
dockWrap.addEventListener('click', (event) => {
  if (!state.suppressDockClick) return;
  state.suppressDockClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);
$('#settings-close').addEventListener('click', closeSettings);
settingsPanel.addEventListener('click', (event) => { if (event.target === settingsPanel) closeSettings(); });
['#icon-spacing', '#icon-size-setting', '#background-blur-setting', '#show-labels'].forEach((selector) => $(selector).addEventListener('input', saveSettings));
$('#reset-settings').addEventListener('click', () => {
  state.settings = { spacing: layoutConfig.verticalGap, size: layoutConfig.iconSize, blur: 0, labels: true };
  localStorage.removeItem('home-settings');
  readSettings();
  applySettings();
});

for (const target of [document, appView, appSwitcher]) {
  target.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') state.touchStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  target.addEventListener('pointerup', (event) => {
    if (state.touchStart && (event.pointerType === 'touch' || event.pointerType === 'pen')) {
      handleGesture(state.touchStart, { x: event.clientX, y: event.clientY });
      state.touchStart = null;
    }
  }, { passive: true });
}

$('#app-gesture-zone').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  state.touchStart = { x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
}, { passive: false, capture: true });
$('#app-gesture-zone').addEventListener('pointerup', (event) => {
  event.preventDefault();
  if (state.touchStart) handleGesture(state.touchStart, { x: event.clientX, y: event.clientY });
  state.touchStart = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
}, { passive: false, capture: true });
$('#app-gesture-zone').addEventListener('pointercancel', () => {
  state.touchStart = null;
}, { passive: true });
$('#app-gesture-zone').addEventListener('touchstart', (event) => {
  event.preventDefault();
  const touch = event.changedTouches[0];
  state.touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: false, capture: true });
$('#app-gesture-zone').addEventListener('touchend', (event) => {
  event.preventDefault();
  const touch = event.changedTouches[0];
  if (state.touchStart) handleGesture(state.touchStart, { x: touch.clientX, y: touch.clientY });
  state.touchStart = null;
}, { passive: false, capture: true });

appSwipeLayer.addEventListener('pointerdown', (event) => {
  if (!appView.classList.contains('open')) return;
  event.preventDefault();
  state.touchStart = { x: event.clientX, y: event.clientY };
  appSwipeLayer.setPointerCapture(event.pointerId);
}, { passive: false });
appSwipeLayer.addEventListener('pointerup', (event) => {
  if (!appView.classList.contains('open')) return;
  event.preventDefault();
  if (state.touchStart) handleGesture(state.touchStart, { x: event.clientX, y: event.clientY });
  state.touchStart = null;
  if (appSwipeLayer.hasPointerCapture(event.pointerId)) appSwipeLayer.releasePointerCapture(event.pointerId);
}, { passive: false });
appSwipeLayer.addEventListener('pointercancel', () => { state.touchStart = null; }, { passive: true });
appSwipeLayer.addEventListener('touchstart', (event) => {
  if (!appView.classList.contains('open')) return;
  event.preventDefault();
  const touch = event.changedTouches[0];
  state.touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: false });
appSwipeLayer.addEventListener('touchend', (event) => {
  if (!appView.classList.contains('open') || !state.touchStart) return;
  event.preventDefault();
  const touch = event.changedTouches[0];
  handleGesture(state.touchStart, { x: touch.clientX, y: touch.clientY });
  state.touchStart = null;
}, { passive: false });

readSettings();
loadWallpapers();
initializeSystemStatus();
loadApps();
