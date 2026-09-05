/**
 * Entry point for the Singapore urban analysis board. Loads the baked
 * geometry first, then boots the shared sheet with a builder that closes
 * over it.
 */
import { bootSheet } from '../sheet.js';
import { URBAN_THEME } from '../themes.js';
import { loadAll } from './geo.js';
import { buildLayers, LAYER_FILES } from './layers.js';
import * as data from '../../data/urban/layers.js';

const docs = await loadAll(LAYER_FILES);
data.PARTS.forEach((p) => {
  if (p.files.some((f) => docs[f].failed)) p.name += ' (data unavailable)';
});
const poster = new URLSearchParams(location.search).get('view') === 'poster';
document.body.classList.toggle('is-poster', poster);
const link = document.getElementById('view-link');
if (poster) {
  link.href = 'index.html';
  link.textContent = 'Sheet';
  document.getElementById('btn-png').hidden = false;
  // @page can't be scoped by selector; only add it on the poster view.
  document.head.insertAdjacentHTML(
    'beforeend',
    '<style media="print">@page { size: A2 portrait; margin: 12mm }</style>'
  );
}
const theme = poster ? URBAN_THEME : { ...URBAN_THEME, poster: null };
bootSheet({ data, build: () => buildLayers(docs), theme });
