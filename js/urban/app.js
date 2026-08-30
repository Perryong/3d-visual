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
bootSheet({ data, build: () => buildLayers(docs), theme: URBAN_THEME });
