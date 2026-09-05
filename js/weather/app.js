/**
 * Weather page wiring: three tabs over one static map.
 * All three forecasts are fetched once at boot (independently — one failing
 * endpoint only breaks its own tab); Refresh refetches everything.
 */
import { fetchForecast } from './wx.js';
import { iconFor } from './icons.js';
import { createWeatherMap } from './map.js';

const REGION_ANCHORS = {
  north: [103.82, 1.418], south: [103.82, 1.27], east: [103.94, 1.35],
  west: [103.7, 1.35], central: [103.82, 1.36],
};

const map = await createWeatherMap(document.getElementById('field'));
const markerLayer = document.getElementById('marker-layer');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');
const updatedEl = document.getElementById('updated');

const state = { tab: '2h', data: { '2h': null, '24h': null, '4d': null }, err: {}, period: 0 };

async function load(kind) {
  try {
    state.data[kind] = await fetchForecast(kind);
    delete state.err[kind];
  } catch (e) {
    state.err[kind] = e.message;
  }
  if (state.tab === kind || (kind === '2h' && state.tab === '4d')) renderTab();
}

function loadAllKinds() {
  updatedEl.textContent = 'loading…';
  ['2h', '24h', '4d'].forEach(load);
}

// ---- Rendering ----------------------------------------------------------

function fmtTime(d) {
  return d ? d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function placeEl(b) {
  const p = map.project(+b.dataset.lon, +b.dataset.lat);
  b.style.left = `${p.x}px`;
  b.style.top = `${p.y}px`;
}

function marker(lon, lat, icon, name, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `wx ${cls}`;
  b.innerHTML = `<span class="wx__icon">${icon}</span><span class="wx__name">${name}</span>`;
  b.dataset.lon = lon;
  b.dataset.lat = lat;
  placeEl(b);
  markerLayer.appendChild(b);
  return b;
}
map.onResize(() => document.querySelectorAll('#marker-layer .wx').forEach(placeEl));

function errBlock(kind, label) {
  const div = document.createElement('div');
  div.className = 'wx-error';
  div.innerHTML = `${label} unavailable (${state.err[kind]}). <button type="button" class="reset">Retry</button>`;
  div.querySelector('button').addEventListener('click', () => load(kind));
  return div;
}

function renderTab() {
  markerLayer.textContent = '';
  panelBody.textContent = '';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.tab === state.tab));

  const d2 = state.data['2h'];
  updatedEl.textContent = `updated ${fmtTime(state.data[state.tab]?.updated)}`;

  if (state.tab === '2h') {
    panelTitle.textContent = '2-hour forecast';
    if (state.err['2h']) return panelBody.appendChild(errBlock('2h', '2-hour forecast'));
    if (!d2) return;
    panelBody.innerHTML = `<p>${d2.validity || 'Next 2 hours'} · tap an area for details.</p>`;
    d2.areas.forEach((a) => {
      const b = marker(a.lon, a.lat, iconFor(a.forecast), a.name);
      b.addEventListener('click', () => {
        document.querySelectorAll('.wx.is-pinned').forEach((x) => x.classList.remove('is-pinned'));
        b.classList.add('is-pinned');
        panelBody.innerHTML = `<div class="wx-card"><h3>${a.name}</h3><p>${iconFor(a.forecast)} ${a.forecast}</p><p>${d2.validity}</p></div>`;
      });
    });
  } else if (state.tab === '24h') {
    panelTitle.textContent = '24-hour forecast';
    if (state.err['24h']) return panelBody.appendChild(errBlock('24h', '24-hour forecast'));
    const d = state.data['24h'];
    if (!d) return;
    const p = d.periods[Math.min(state.period, d.periods.length - 1)];
    Object.entries(REGION_ANCHORS).forEach(([region, [lon, lat]]) => {
      marker(lon, lat, iconFor(p.regions[region]), region.toUpperCase(), 'wx--region');
    });
    const g = d.general;
    panelBody.innerHTML = `
      <div class="wx-card"><h3>General</h3>
        <p>${iconFor(g.forecast)} ${g.forecast}</p>
        <p>${g.tempLow}–${g.tempHigh} °C · ${g.humidityLow}–${g.humidityHigh} % RH · wind ${g.windDir} ${g.windLow}–${g.windHigh} km/h</p></div>
      <div class="wx-card"><h3>Period</h3><div id="chips"></div></div>`;
    const chips = panelBody.querySelector('#chips');
    d.periods.forEach((q, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = `chip${i === state.period ? ' is-on' : ''}`;
      c.textContent = q.label;
      c.addEventListener('click', () => { state.period = i; renderTab(); });
      chips.appendChild(c);
    });
  } else {
    panelTitle.textContent = '4-day outlook';
    if (state.err['4d']) return panelBody.appendChild(errBlock('4d', '4-day outlook'));
    const d = state.data['4d'];
    if (!d) return;
    if (d2) d2.areas.forEach((a) => marker(a.lon, a.lat, iconFor(a.forecast), a.name, 'wx--dim'));
    panelBody.innerHTML = d.days.map((x) => `
      <div class="wx-card"><h3>${x.day} <small>${x.date}</small></h3>
        <p>${iconFor(x.forecast)} ${x.forecast}</p>
        <p>${x.tempLow}–${x.tempHigh} °C · ${x.humidityLow}–${x.humidityHigh} % RH · wind ${x.windDir} ${x.windLow}–${x.windHigh} km/h</p></div>`).join('');
  }
}

document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => { state.tab = t.dataset.tab; state.period = 0; renderTab(); })
);
document.getElementById('btn-refresh').addEventListener('click', loadAllKinds);
loadAllKinds();
