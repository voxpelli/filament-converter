import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractValue,
  extractNullable,
  convertProfile,
  generateIni,
  generateBundle,
  LOW_FAN_TYPES,
} from '../../lib/converter.js';

// -- Fixtures --

/** @type {Record<string, unknown>} */
const plaEconomy = {
  name: 'addnorth PLA Economy',
  filament_type: ['PLA'],
  filament_vendor: ['addnorth'],
  filament_density: ['1.24'],
  filament_cost: ['23'],
  default_filament_colour: [''],
  filament_soluble: ['0'],
  filament_flow_ratio: ['0.98', '0.98'],
  nozzle_temperature: ['240', '240'],
  nozzle_temperature_initial_layer: ['235', '235'],
  textured_plate_temp: ['65'],
  textured_plate_temp_initial_layer: ['65'],
  hot_plate_temp: ['60'],
  hot_plate_temp_initial_layer: ['60'],
  chamber_temperatures: ['0'],
  enable_overhang_bridge_fan: ['1'],
  overhang_fan_speed: ['100'],
  slow_down_for_layer_cooling: ['1'],
  fan_min_speed: ['100'],
  fan_max_speed: ['100'],
  close_fan_the_first_x_layers: ['1'],
  full_fan_speed_layer: ['0'],
  fan_cooling_layer_time: ['100'],
  slow_down_layer_time: ['8'],
  slow_down_min_speed: ['20'],
  filament_retraction_length: ['nil', 'nil'],
  filament_retraction_speed: ['nil', 'nil'],
  filament_deretraction_speed: ['nil', 'nil'],
  filament_z_hop: ['nil', 'nil'],
  filament_retraction_minimum_travel: ['nil', 'nil'],
  filament_retract_when_changing_layer: ['nil', 'nil'],
  filament_wipe: ['nil', 'nil'],
  filament_max_volumetric_speed: ['12', '12'],
  pressure_advance: ['0.02'],
  enable_pressure_advance: ['0'],
  required_nozzle_HRC: ['3'],
  filament_notes: 'File Version:2.5 - V.Pack:10_03_2026',
};

/** @type {Record<string, unknown>} */
const paAdura = {
  name: 'addnorth PA Adura ',
  filament_type: ['PA'],
  filament_vendor: ['addnorth'],
  filament_density: ['1.1'],
  filament_cost: ['50'],
  default_filament_colour: [''],
  filament_soluble: ['0'],
  filament_flow_ratio: ['0.99', '0.99'],
  nozzle_temperature: ['265', '265'],
  nozzle_temperature_initial_layer: ['265', '265'],
  textured_plate_temp: ['100'],
  textured_plate_temp_initial_layer: ['100'],
  hot_plate_temp: ['100'],
  hot_plate_temp_initial_layer: ['100'],
  chamber_temperatures: ['50'],
  enable_overhang_bridge_fan: ['1'],
  overhang_fan_speed: ['70'],
  slow_down_for_layer_cooling: ['1'],
  fan_min_speed: ['10'],
  fan_max_speed: ['30'],
  close_fan_the_first_x_layers: ['3'],
  full_fan_speed_layer: ['2'],
  fan_cooling_layer_time: ['5'],
  slow_down_layer_time: ['10'],
  slow_down_min_speed: ['20'],
  filament_retraction_length: ['1', '1'],
  filament_retraction_speed: ['nil', 'nil'],
  filament_deretraction_speed: ['nil', 'nil'],
  filament_z_hop: ['0.4', '0.4'],
  filament_retraction_minimum_travel: ['nil', 'nil'],
  filament_retract_when_changing_layer: ['nil', 'nil'],
  filament_wipe: ['nil', 'nil'],
  filament_max_volumetric_speed: ['8', '11'],
  pressure_advance: ['0.02'],
  enable_pressure_advance: ['0'],
  required_nozzle_HRC: ['40'],
  filament_notes: 'File Version:2.5 - V.Pack:10_03_2026',
};

// -- Tests --

describe('extractValue', () => {
  it('extracts first element of array', () => {
    assert.equal(extractValue({ temp: ['220', '230'] }, 'temp'), '220');
  });

  it('returns scalar value directly', () => {
    assert.equal(extractValue({ name: 'Test' }, 'name'), 'Test');
  });

  it('returns fallback for missing key', () => {
    assert.equal(extractValue({}, 'missing', 'default'), 'default');
  });

  it('returns fallback for undefined object', () => {
    assert.equal(extractValue(undefined, 'key', 'fb'), 'fb');
  });

  it('treats "nil" as unset and returns fallback', () => {
    assert.equal(extractValue({ val: ['nil'] }, 'val', '42'), '42');
  });

  it('treats empty string as unset and returns fallback', () => {
    assert.equal(extractValue({ val: [''] }, 'val', '42'), '42');
  });

  it('returns empty string as default fallback', () => {
    assert.equal(extractValue({}, 'missing'), '');
  });

  it('handles numeric zero as a valid value, not missing', () => {
    assert.equal(extractValue({ val: 0 }, 'val'), '0');
  });

  it('handles boolean false as a valid value, not missing', () => {
    assert.equal(extractValue({ val: false }, 'val'), 'false');
  });
});

describe('extractNullable', () => {
  it('returns first array element as string', () => {
    assert.equal(extractNullable({ val: ['5'] }, 'val'), '5');
  });

  it('returns undefined for missing key', () => {
    assert.equal(extractNullable({}, 'missing'), undefined);
  });

  it('returns undefined for "nil" value', () => {
    assert.equal(extractNullable({ val: ['nil'] }, 'val'), undefined);
  });

  it('returns undefined for empty string', () => {
    assert.equal(extractNullable({ val: [''] }, 'val'), undefined);
  });

  it('returns undefined for undefined object', () => {
    assert.equal(extractNullable(undefined, 'key'), undefined);
  });

  it('handles numeric zero as a valid value', () => {
    assert.equal(extractNullable({ val: 0 }, 'val'), '0');
  });
});

describe('convertProfile', () => {
  describe('PLA Economy (standard printer)', () => {
    const result = convertProfile(plaEconomy, 'standard');

    it('extracts name', () => {
      assert.equal(result.name, 'addnorth PLA Economy');
    });

    it('extracts filament type', () => {
      assert.equal(result.filament_type, 'PLA');
    });

    it('maps nozzle temperature', () => {
      assert.equal(result.temperature, '240');
      assert.equal(result.first_layer_temperature, '235');
    });

    it('uses textured plate for bed temperature', () => {
      assert.equal(result.bed_temperature, '65');
      assert.equal(result.first_layer_bed_temperature, '65');
    });

    it('treats chamber_temperatures "0" as a real value', () => {
      assert.equal(result.chamber_temperature, '0');
    });

    it('maps flow ratio to extrusion multiplier', () => {
      assert.equal(result.extrusion_multiplier, '0.98');
    });

    it('caps volumetric speed at 15 for standard printer', () => {
      assert.equal(result.filament_max_volumetric_speed, '12');
      assert.equal(result._wasCapped, false);
    });

    it('sets fan_always_on to 1 for PLA', () => {
      assert.equal(result.fan_always_on, '1');
    });

    it('uses overhang_fan_speed as bridge_fan_speed when enabled', () => {
      assert.equal(result.bridge_fan_speed, '100');
    });

    it('sets all retraction fields to undefined for nil values', () => {
      assert.equal(result.filament_retract_length, undefined);
      assert.equal(result.filament_retract_speed, undefined);
      assert.equal(result.filament_deretract_speed, undefined);
      assert.equal(result.filament_retract_lift, undefined);
      assert.equal(result.filament_retract_before_travel, undefined);
      assert.equal(result.filament_retract_layer_change, undefined);
      assert.equal(result.filament_wipe, undefined);
    });

    it('includes pressure advance even when enable flag is 0', () => {
      assert.equal(result._pressureAdvance, '0.02');
    });

    it('does not flag hardened nozzle for standard PLA', () => {
      assert.equal(result._needsHardenedNozzle, false);
    });
  });

  describe('PA Adura (coreone printer)', () => {
    const result = convertProfile(paAdura, 'coreone');

    it('does not cap volumetric speed for coreone', () => {
      assert.equal(result.filament_max_volumetric_speed, '8');
      assert.equal(result._wasCapped, false);
    });

    it('sets fan_always_on to 0 for PA', () => {
      assert.equal(result.fan_always_on, '0');
    });

    it('maps chamber temperature', () => {
      assert.equal(result.chamber_temperature, '50');
    });

    it('maps retraction length from non-nil value', () => {
      assert.equal(result.filament_retract_length, '1');
    });

    it('maps z-hop to filament_retract_lift', () => {
      assert.equal(result.filament_retract_lift, '0.4');
    });

    it('leaves nil retraction speed as undefined', () => {
      assert.equal(result.filament_retract_speed, undefined);
    });

    it('flags hardened nozzle for HRC >= 40', () => {
      assert.equal(result._needsHardenedNozzle, true);
    });

    it('includes hardened nozzle advisory in notes', () => {
      assert.ok(result.filament_notes.includes('Requires hardened nozzle'));
    });

    it('uses overhang_fan_speed for bridge_fan_speed', () => {
      assert.equal(result.bridge_fan_speed, '70');
    });

    it('maps fan cooling settings', () => {
      assert.equal(result.min_fan_speed, '10');
      assert.equal(result.max_fan_speed, '30');
      assert.equal(result.disable_fan_first_layers, '3');
      assert.equal(result.fan_below_layer_time, '5');
    });
  });

  describe('volumetric speed capping', () => {
    it('caps at 15 for standard printer when raw exceeds 15', () => {
      const raw = { filament_max_volumetric_speed: ['22'], filament_type: ['PLA'] };
      const result = convertProfile(raw, 'standard');
      assert.equal(result.filament_max_volumetric_speed, '15');
      assert.equal(result._wasCapped, true);
      assert.equal(result._rawMVS, 22);
    });

    it('does not cap for coreone printer', () => {
      const raw = { filament_max_volumetric_speed: ['22'], filament_type: ['PLA'] };
      const result = convertProfile(raw, 'coreone');
      assert.equal(result.filament_max_volumetric_speed, '22');
      assert.equal(result._wasCapped, false);
    });
  });

  describe('bed temperature fallback', () => {
    it('falls back to hot_plate_temp when textured is missing', () => {
      const raw = { hot_plate_temp: ['70'], hot_plate_temp_initial_layer: ['75'] };
      const result = convertProfile(raw, 'standard');
      assert.equal(result.bed_temperature, '70');
      assert.equal(result.first_layer_bed_temperature, '75');
    });

    it('uses default 60 when no plate temps are present', () => {
      const result = convertProfile({}, 'standard');
      assert.equal(result.bed_temperature, '60');
      assert.equal(result.first_layer_bed_temperature, '60');
    });
  });
});

describe('LOW_FAN_TYPES', () => {
  it('includes PA and ABS', () => {
    assert.ok(LOW_FAN_TYPES.includes('PA'));
    assert.ok(LOW_FAN_TYPES.includes('ABS'));
  });

  it('does not include PLA or PETG', () => {
    assert.ok(!LOW_FAN_TYPES.includes('PLA'));
    assert.ok(!LOW_FAN_TYPES.includes('PETG'));
  });
});

describe('generateIni', () => {
  const plaResult = convertProfile(plaEconomy, 'standard');
  const paResult = convertProfile(paAdura, 'coreone');

  it('starts with section header containing profile name', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(ini.startsWith('[filament:addnorth PLA Economy]\n'));
  });

  it('includes mapped temperature keys', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(ini.includes('temperature = 240'));
    assert.ok(ini.includes('first_layer_temperature = 235'));
    assert.ok(ini.includes('bed_temperature = 65'));
  });

  it('includes cooling settings', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(ini.includes('cooling = 1'));
    assert.ok(ini.includes('fan_always_on = 1'));
    assert.ok(ini.includes('min_fan_speed = 100'));
    assert.ok(ini.includes('bridge_fan_speed = 100'));
  });

  it('omits retraction keys when undefined (PLA with nil retraction)', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(!ini.includes('filament_retract_length'));
    assert.ok(!ini.includes('filament_retract_speed'));
    assert.ok(!ini.includes('filament_retract_lift'));
  });

  it('includes retraction keys when set (PA with retraction)', () => {
    const ini = generateIni(paResult, 'marlin');
    assert.ok(ini.includes('filament_retract_length = 1'));
    assert.ok(ini.includes('filament_retract_lift = 0.4'));
  });

  it('does not include retraction speed when nil (PA)', () => {
    const ini = generateIni(paResult, 'marlin');
    assert.ok(!ini.includes('filament_retract_speed'));
  });

  it('includes chamber temperature for PA', () => {
    const ini = generateIni(paResult, 'marlin');
    assert.ok(ini.includes('chamber_temperature = 50'));
  });

  it('injects M900 pressure advance for marlin firmware', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(ini.includes('start_filament_gcode = M900 K0.02'));
  });

  it('injects SET_PRESSURE_ADVANCE for klipper firmware', () => {
    const ini = generateIni(plaResult, 'klipper');
    assert.ok(ini.includes('start_filament_gcode = SET_PRESSURE_ADVANCE ADVANCE=0.02'));
  });

  it('does not include start_filament_gcode when no PA', () => {
    const noPa = { ...plaEconomy, pressure_advance: ['0'] };
    const result = convertProfile(noPa, 'standard');
    const ini = generateIni(result, 'marlin');
    assert.ok(!ini.includes('start_filament_gcode'));
  });

  it('sets fan_always_on = 0 for PA material', () => {
    const ini = generateIni(paResult, 'marlin');
    assert.ok(ini.includes('fan_always_on = 0'));
  });

  it('includes filament_vendor when not Unknown', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(ini.includes('filament_vendor = addnorth'));
  });

  it('omits filament_vendor when Unknown', () => {
    const raw = { ...plaEconomy, filament_vendor: undefined };
    const result = convertProfile(raw, 'standard');
    const ini = generateIni(result, 'marlin');
    assert.ok(!ini.includes('filament_vendor'));
  });

  it('includes filament notes with conversion metadata', () => {
    const ini = generateIni(plaResult, 'marlin');
    assert.ok(ini.includes('Converted from Bambu Studio profile'));
  });
});

describe('generateIni — TPU with all retraction fields', () => {
  /** @type {Record<string, unknown>} */
  const tpuFixture = {
    name: 'addnorth TPU EasyFlex',
    filament_type: ['TPU'],
    filament_vendor: ['addnorth'],
    filament_density: ['1.21'],
    filament_cost: ['40'],
    filament_flow_ratio: ['1'],
    nozzle_temperature: ['240'],
    nozzle_temperature_initial_layer: ['240'],
    textured_plate_temp: ['35'],
    textured_plate_temp_initial_layer: ['35'],
    fan_min_speed: ['100'],
    fan_max_speed: ['100'],
    close_fan_the_first_x_layers: ['1'],
    slow_down_layer_time: ['8'],
    slow_down_min_speed: ['10'],
    filament_max_volumetric_speed: ['5'],
    filament_retraction_length: ['1'],
    filament_retraction_speed: ['30'],
    filament_deretraction_speed: ['40'],
    filament_z_hop: ['0.2'],
    filament_retraction_minimum_travel: ['2'],
    filament_retract_when_changing_layer: ['0'],
    filament_wipe: ['1'],
    pressure_advance: ['0.02'],
    required_nozzle_HRC: ['3'],
    filament_notes: 'File Version:2.6',
  };

  const tpuResult = convertProfile(tpuFixture, 'standard');

  it('extracts all retraction fields from TPU profile', () => {
    assert.equal(tpuResult.filament_retract_length, '1');
    assert.equal(tpuResult.filament_retract_speed, '30');
    assert.equal(tpuResult.filament_deretract_speed, '40');
    assert.equal(tpuResult.filament_retract_lift, '0.2');
    assert.equal(tpuResult.filament_retract_before_travel, '2');
    assert.equal(tpuResult.filament_retract_layer_change, '0');
    assert.equal(tpuResult.filament_wipe, '1');
  });

  it('emits all retraction keys in INI output', () => {
    const ini = generateIni(tpuResult, 'marlin');
    assert.ok(ini.includes('filament_retract_length = 1'));
    assert.ok(ini.includes('filament_retract_speed = 30'));
    assert.ok(ini.includes('filament_deretract_speed = 40'));
    assert.ok(ini.includes('filament_retract_lift = 0.2'));
    assert.ok(ini.includes('filament_retract_before_travel = 2'));
    assert.ok(ini.includes('filament_retract_layer_change = 0'));
    assert.ok(ini.includes('filament_wipe = 1'));
  });

  it('sets fan_always_on to 1 for TPU', () => {
    assert.equal(tpuResult.fan_always_on, '1');
  });
});

describe('filament_notes newline sanitization', () => {
  it('escapes real newlines in Bambu notes', () => {
    const raw = { filament_notes: 'Line one\nLine two\r\nLine three' };
    const result = convertProfile(raw, 'standard');
    assert.ok(!result.filament_notes.includes('\n'));
    assert.ok(result.filament_notes.includes('Line one\\nLine two\\nLine three'));
  });
});

describe('generateBundle', () => {
  it('generates single profile without bundle header', () => {
    const result = convertProfile(plaEconomy, 'standard');
    const bundle = generateBundle([result], 'marlin');
    assert.ok(!bundle.includes('; Bambu to PrusaSlicer filament bundle'));
    assert.ok(bundle.includes('[filament:addnorth PLA Economy]'));
  });

  it('generates multi-profile bundle with header', () => {
    const pla = convertProfile(plaEconomy, 'standard');
    const pa = convertProfile(paAdura, 'standard');
    const bundle = generateBundle([pla, pa], 'marlin');

    assert.ok(bundle.includes('; 2 profiles converted'));
    assert.ok(bundle.includes('[filament:addnorth PLA Economy]'));
    assert.ok(bundle.includes('[filament:addnorth PA Adura ]'));
  });

  it('uses correct firmware for all profiles in bundle', () => {
    const pla = convertProfile(plaEconomy, 'standard');
    const pa = convertProfile(paAdura, 'standard');
    const bundle = generateBundle([pla, pa], 'klipper');

    const matches = bundle.match(/SET_PRESSURE_ADVANCE/g);
    assert.equal(matches?.length, 2);
  });
});
