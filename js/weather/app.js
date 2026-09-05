import { createWeatherMap } from './map.js';
const map = await createWeatherMap(document.getElementById('field'));
window.__map = map; // placeholder until Task 3 replaces this file
