/**
 * Entry point for the TPZ-77 general arrangement sheet.
 */
import { bootSheet } from './sheet.js';
import { buildVehicle } from './parts.js';
import { TANK_THEME } from './themes.js';
import * as bom from '../data/bom.js';

bootSheet({ data: bom, build: buildVehicle, theme: TANK_THEME });
