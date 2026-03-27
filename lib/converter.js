/**
 * Pure conversion logic for Bambu Studio → PrusaSlicer filament profiles.
 * No DOM dependencies — importable by both browser and Node.js tests.
 */

/** Materials where fan should NOT always be on. */
export const LOW_FAN_TYPES = ['ABS', 'ASA', 'PA', 'PA6', 'PA-CF', 'PC', 'PVDF', 'HIPS'];

/**
 * Extract first array element from a Bambu config object, treating `"nil"` as unset.
 *
 * @param {Record<string, unknown> | undefined} obj
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
export function extractValue (obj, key, fallback = '') {
  if (!obj || !(key in obj) || obj[key] === undefined || obj[key] === null) return fallback;
  const raw = /** @type {unknown[] | unknown} */ (obj[key]);
  const val = /** @type {unknown} */ (Array.isArray(raw) ? raw[0] : raw);
  return val === 'nil' || val === '' ? fallback : String(val);
}

/**
 * Like {@link extractValue} but returns `undefined` instead of a fallback for nullable fields.
 *
 * @param {Record<string, unknown> | undefined} obj
 * @param {string} key
 * @returns {string | undefined}
 */
export function extractNullable (obj, key) {
  if (!obj || !(key in obj) || obj[key] === undefined || obj[key] === null) return;
  const raw = /** @type {unknown[] | unknown} */ (obj[key]);
  const val = /** @type {unknown} */ (Array.isArray(raw) ? raw[0] : raw);
  if (val === 'nil' || val === '') return;
  return String(val);
}

/**
 * @typedef {'standard' | 'coreone'} PrinterTarget
 */

/**
 * @typedef {'marlin' | 'klipper'} FirmwareType
 */

/**
 * @typedef {object} ConvertedProfile
 * @property {string} name
 * @property {string} filament_type
 * @property {string} filament_vendor
 * @property {string} filament_density
 * @property {string} filament_cost
 * @property {string} filament_colour
 * @property {string} filament_soluble
 * @property {string} extrusion_multiplier
 * @property {string} temperature
 * @property {string} first_layer_temperature
 * @property {string} bed_temperature
 * @property {string} first_layer_bed_temperature
 * @property {string | undefined} chamber_temperature
 * @property {string} cooling
 * @property {string} fan_always_on
 * @property {string} min_fan_speed
 * @property {string} max_fan_speed
 * @property {string} bridge_fan_speed
 * @property {string} disable_fan_first_layers
 * @property {string} full_fan_speed_layer
 * @property {string} fan_below_layer_time
 * @property {string} slowdown_below_layer_time
 * @property {string} min_print_speed
 * @property {string | undefined} filament_retract_length
 * @property {string | undefined} filament_retract_speed
 * @property {string | undefined} filament_deretract_speed
 * @property {string | undefined} filament_retract_lift
 * @property {string | undefined} filament_retract_before_travel
 * @property {string | undefined} filament_retract_layer_change
 * @property {string | undefined} filament_wipe
 * @property {string} filament_max_volumetric_speed
 * @property {string} filament_notes
 * @property {number} _rawMVS
 * @property {boolean} _wasCapped
 * @property {string | undefined} _pressureAdvance
 * @property {boolean} _needsHardenedNozzle
 */

/**
 * Convert a raw Bambu JSON config into a PrusaSlicer-compatible data object.
 *
 * @param {Record<string, unknown>} raw - Parsed Bambu JSON profile
 * @param {PrinterTarget} targetPrinter - Hardware target
 * @returns {ConvertedProfile}
 */
export function convertProfile (raw, targetPrinter) {
  const rawMVS = Number.parseFloat(extractValue(raw, 'filament_max_volumetric_speed', '15'));
  const filamentType = extractValue(raw, 'filament_type', 'PLA');

  let finalMVS = rawMVS;
  let wasCapped = false;

  if (targetPrinter === 'standard') {
    finalMVS = Math.min(rawMVS, 15);
    if (rawMVS > 15) wasCapped = true;
  }

  // Bed temps: prioritize textured plate (Prusa standard PEI), fall back to hot plate
  const bedTemp = extractValue(raw, 'textured_plate_temp',
    extractValue(raw, 'hot_plate_temp', '60'));
  const bedTempInitial = extractValue(raw, 'textured_plate_temp_initial_layer',
    extractValue(raw, 'hot_plate_temp_initial_layer', '60'));

  // Chamber temperature
  const chamberTemp = extractNullable(raw, 'chamber_temperatures');

  // Bridge fan: use overhang_fan_speed if bridge fan is enabled
  const bridgeFanEnabled = extractValue(raw, 'enable_overhang_bridge_fan', '0');
  const bridgeFanSpeed = bridgeFanEnabled === '1'
    ? extractValue(raw, 'overhang_fan_speed', '100')
    : extractValue(raw, 'fan_max_speed', '100');

  // Cooling logic
  const coolingEnabled = extractValue(raw, 'slow_down_for_layer_cooling', '1');

  // fan_always_on: material-dependent
  const fanAlwaysOn = LOW_FAN_TYPES.includes(filamentType.toUpperCase()) ? '0' : '1';

  // Pressure advance -- include when value is non-zero, regardless of enable flag.
  // AddNorth profiles set enable_pressure_advance=0 (Bambu handles PA internally)
  // but the value is still useful for PrusaSlicer/Marlin/Klipper firmware.
  const paVal = extractNullable(raw, 'pressure_advance');
  const pressureAdvance = paVal && Number.parseFloat(paVal) > 0 ? paVal : undefined;

  // Nozzle HRC advisory
  const nozzleHRC = extractValue(raw, 'required_nozzle_HRC', '3');
  const needsHardenedNozzle = Number.parseInt(nozzleHRC, 10) >= 40;

  // Build filament notes
  const bambuNotes = extractValue(raw, 'filament_notes', '').replaceAll('\n', '\\n').replaceAll('\r', '');
  /** @type {string[]} */
  const noteParts = [];
  if (bambuNotes) noteParts.push(bambuNotes);
  if (needsHardenedNozzle) noteParts.push('Requires hardened nozzle (HRC >= 40)');
  noteParts.push('Converted from Bambu Studio profile');
  const filamentNotes = noteParts.join('\\n');

  return {
    name: extractValue(raw, 'name', 'Converted_Bambu_Filament'),
    filament_type: filamentType,
    filament_vendor: extractValue(raw, 'filament_vendor', 'Unknown'),
    filament_density: extractValue(raw, 'filament_density', '1.24'),
    filament_cost: extractValue(raw, 'filament_cost', '0'),
    filament_colour: extractValue(raw, 'default_filament_colour', ''),
    filament_soluble: extractValue(raw, 'filament_soluble', '0'),
    extrusion_multiplier: extractValue(raw, 'filament_flow_ratio', '1'),

    // Temperatures
    temperature: extractValue(raw, 'nozzle_temperature', '210'),
    first_layer_temperature: extractValue(raw, 'nozzle_temperature_initial_layer', '215'),
    bed_temperature: bedTemp,
    first_layer_bed_temperature: bedTempInitial,
    chamber_temperature: chamberTemp,

    // Cooling
    cooling: coolingEnabled === '1' ? '1' : '0',
    fan_always_on: fanAlwaysOn,
    min_fan_speed: extractValue(raw, 'fan_min_speed', '100'),
    max_fan_speed: extractValue(raw, 'fan_max_speed', '100'),
    bridge_fan_speed: bridgeFanSpeed,
    disable_fan_first_layers: extractValue(raw, 'close_fan_the_first_x_layers', '1'),
    full_fan_speed_layer: extractValue(raw, 'full_fan_speed_layer', '0'),
    fan_below_layer_time: extractValue(raw, 'fan_cooling_layer_time', '100'),
    slowdown_below_layer_time: extractValue(raw, 'slow_down_layer_time', '8'),
    min_print_speed: extractValue(raw, 'slow_down_min_speed', '15'),

    // Retraction (nullable -- omit from INI when null)
    filament_retract_length: extractNullable(raw, 'filament_retraction_length'),
    filament_retract_speed: extractNullable(raw, 'filament_retraction_speed'),
    filament_deretract_speed: extractNullable(raw, 'filament_deretraction_speed'),
    filament_retract_lift: extractNullable(raw, 'filament_z_hop'),
    filament_retract_before_travel: extractNullable(raw, 'filament_retraction_minimum_travel'),
    filament_retract_layer_change: extractNullable(raw, 'filament_retract_when_changing_layer'),
    filament_wipe: extractNullable(raw, 'filament_wipe'),

    // Motion
    filament_max_volumetric_speed: finalMVS.toString(),

    // Notes
    filament_notes: filamentNotes,

    // Internal tracking (not emitted directly in INI)
    _rawMVS: rawMVS,
    _wasCapped: wasCapped,
    _pressureAdvance: pressureAdvance,
    _needsHardenedNozzle: needsHardenedNozzle,
  };
}

/**
 * Generate PrusaSlicer INI content for a single converted profile.
 *
 * @param {ConvertedProfile} data
 * @param {FirmwareType} firmware
 * @returns {string}
 */
export function generateIni (data, firmware) {
  /** @type {string[]} */
  const lines = [];

  lines.push(`[filament:${data.name}]`, `filament_type = ${data.filament_type}`);
  if (data.filament_vendor !== 'Unknown') {
    lines.push(`filament_vendor = ${data.filament_vendor}`);
  }
  lines.push(`filament_density = ${data.filament_density}`, `filament_cost = ${data.filament_cost}`);
  if (data.filament_colour) {
    lines.push(`filament_colour = ${data.filament_colour}`);
  }
  if (data.filament_soluble === '1') {
    lines.push('filament_soluble = 1');
  }
  lines.push(`extrusion_multiplier = ${data.extrusion_multiplier}`, `temperature = ${data.temperature}`, `first_layer_temperature = ${data.first_layer_temperature}`, `bed_temperature = ${data.bed_temperature}`, `first_layer_bed_temperature = ${data.first_layer_bed_temperature}`);
  if (data.chamber_temperature) {
    lines.push(`chamber_temperature = ${data.chamber_temperature}`);
  }

  // Cooling
  lines.push(`cooling = ${data.cooling}`, `fan_always_on = ${data.fan_always_on}`, `min_fan_speed = ${data.min_fan_speed}`, `max_fan_speed = ${data.max_fan_speed}`, `bridge_fan_speed = ${data.bridge_fan_speed}`, `disable_fan_first_layers = ${data.disable_fan_first_layers}`, `full_fan_speed_layer = ${data.full_fan_speed_layer}`, `fan_below_layer_time = ${data.fan_below_layer_time}`, `slowdown_below_layer_time = ${data.slowdown_below_layer_time}`, `min_print_speed = ${data.min_print_speed}`);

  // Retraction (only emit when set)
  if (data.filament_retract_length !== undefined) {
    lines.push(`filament_retract_length = ${data.filament_retract_length}`);
  }
  if (data.filament_retract_speed !== undefined) {
    lines.push(`filament_retract_speed = ${data.filament_retract_speed}`);
  }
  if (data.filament_deretract_speed !== undefined) {
    lines.push(`filament_deretract_speed = ${data.filament_deretract_speed}`);
  }
  if (data.filament_retract_lift !== undefined) {
    lines.push(`filament_retract_lift = ${data.filament_retract_lift}`);
  }
  if (data.filament_retract_before_travel !== undefined) {
    lines.push(`filament_retract_before_travel = ${data.filament_retract_before_travel}`);
  }
  if (data.filament_retract_layer_change !== undefined) {
    lines.push(`filament_retract_layer_change = ${data.filament_retract_layer_change}`);
  }
  if (data.filament_wipe !== undefined) {
    lines.push(`filament_wipe = ${data.filament_wipe}`);
  }

  // Motion
  lines.push(`filament_max_volumetric_speed = ${data.filament_max_volumetric_speed}`);

  // Pressure advance via start G-code
  if (data._pressureAdvance) {
    const paGcode = firmware === 'klipper'
      ? `SET_PRESSURE_ADVANCE ADVANCE=${data._pressureAdvance}`
      : `M900 K${data._pressureAdvance}`;
    lines.push(`start_filament_gcode = ${paGcode}`);
  }

  // Notes
  if (data.filament_notes) {
    lines.push(`filament_notes = ${data.filament_notes}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate a bundled INI file from multiple converted profiles.
 *
 * @param {ConvertedProfile[]} convertedProfiles
 * @param {FirmwareType} firmware
 * @returns {string}
 */
export function generateBundle (convertedProfiles, firmware) {
  let content = '';

  if (convertedProfiles.length > 1) {
    content = `; Bambu to PrusaSlicer filament bundle\n; ${convertedProfiles.length} profiles converted\n\n`;
  }

  for (const profile of convertedProfiles) {
    content += generateIni(profile, firmware);
    content += '\n';
  }

  return content;
}
