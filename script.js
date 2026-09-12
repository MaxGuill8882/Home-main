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
  recent: JSON.parse(localStorage.getItem('home-recent') || '[]'),
  settings: { spacing: layoutConfig.verticalGap, size: layoutConfig.iconSize, labels: true },
  touchStart: null,
  navigationId: 0
};

const $ = (selector) => document.querySelector(selector);
const appGrid = $('#app-grid');
const dockPinned = $('#dock-pinned');
const dockRecent = $('#dock-recent');
const dockDivider = $('#dock-divider');
const dockWrap = $('#dock-wrap');
const appView = $('#app-view');
const appFrame = $('#app-frame');
const appSwitcher = $('#app-switcher');
const settingsPanel = $('#settings-panel');

async function loadApps() {
  try {
    const manifest = await fetch('config/apps/manifest.json').then((response) => response.json());
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
    state.apps = loadedApps.filter(Boolean);
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
  image.src = `config/apps/${app.image}`;
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
  appView.setAttribute('aria-hidden', 'false');
  const navigationId = ++state.navigationId;
  appFrame.removeAttribute('src');
  requestAnimationFrame(() => {
    if (navigationId === state.navigationId) appFrame.src = app.url || 'about:blank';
  });
}

function goHome() {
  state.navigationId += 1;
  dockWrap.classList.remove('from-app');
  appView.classList.remove('open');
  appView.setAttribute('aria-hidden', 'true');
  appSwitcher.classList.remove('open');
  appFrame.src = 'about:blank';
}

function showAppDock() {
  render();
  dockWrap.classList.add('from-app');
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
  $('#show-labels').checked = state.settings.labels;
}

function applySettings() {
  document.documentElement.style.setProperty('--grid-columns', layoutConfig.columns);
  document.documentElement.style.setProperty('--grid-rows', layoutConfig.rows);
  document.documentElement.style.setProperty('--grid-column-gap', `${layoutConfig.horizontalGap}px`);
  document.documentElement.style.setProperty('--grid-row-gap', `${state.settings.spacing}px`);
  document.documentElement.style.setProperty('--icon-size', `${state.settings.size}px`);
  appGrid.classList.toggle('labels-hidden', !state.settings.labels);
}

function saveSettings() {
  state.settings = {
    spacing: Number($('#icon-spacing').value),
    size: Number($('#icon-size-setting').value),
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
$('#wallpaper-toggle').addEventListener('click', () => {
  state.wallpaper = state.wallpaper === 'wallpaper-aurore.jpg' ? 'wallpaper-mousse.jpg' : 'wallpaper-aurore.jpg';
  document.querySelector('#screen').style.backgroundImage = `url("config/background/${state.wallpaper}")`;
  localStorage.setItem('home-wallpaper', state.wallpaper);
});
$('#config-mode').addEventListener('click', (event) => event.currentTarget.classList.remove('visible'));
$('#home-indicator').addEventListener('click', showSwitcher);
$('#close-switcher').addEventListener('click', goHome);
$('#dock-home').addEventListener('click', goHome);
$('#app-view-home').addEventListener('click', goHome);
$('#app-view-close').addEventListener('click', goHome);
$('#app-dock-trigger').addEventListener('click', showAppDock);
$('#settings-close').addEventListener('click', closeSettings);
settingsPanel.addEventListener('click', (event) => { if (event.target === settingsPanel) closeSettings(); });
['#icon-spacing', '#icon-size-setting', '#show-labels'].forEach((selector) => $(selector).addEventListener('input', saveSettings));
$('#reset-settings').addEventListener('click', () => {
  state.settings = { spacing: layoutConfig.verticalGap, size: layoutConfig.iconSize, labels: true };
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
  state.touchStart = { x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
}, { passive: true });
$('#app-gesture-zone').addEventListener('pointerup', (event) => {
  if (state.touchStart) handleGesture(state.touchStart, { x: event.clientX, y: event.clientY });
  state.touchStart = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
}, { passive: true });

state.wallpaper = localStorage.getItem('home-wallpaper') || 'wallpaper-aurore.jpg';
document.querySelector('#screen').style.backgroundImage = `url("config/background/${state.wallpaper}")`;
readSettings();
loadApps();
