import { convertProfile, generateBundle } from './lib/converter.js';

/** @type {HTMLInputElement} */
const fileUpload = /** @type {HTMLInputElement} */ (document.querySelector('#file-upload'));
/** @type {NodeListOf<HTMLInputElement>} */
const printerRadios = /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[name="printer"]'));
/** @type {NodeListOf<HTMLInputElement>} */
const firmwareRadios = /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[name="firmware"]'));
/** @type {HTMLElement} */
const previewSection = /** @type {HTMLElement} */ (document.querySelector('#preview-section'));
/** @type {HTMLElement} */
const previewListEl = /** @type {HTMLElement} */ (document.querySelector('#preview-list'));
/** @type {HTMLElement} */
const dynamicNotice = /** @type {HTMLElement} */ (document.querySelector('#dynamic-notice'));
/** @type {HTMLButtonElement} */
const downloadBtn = /** @type {HTMLButtonElement} */ (document.querySelector('#download-btn'));
/** @type {HTMLElement} */
const fileCountEl = /** @type {HTMLElement} */ (document.querySelector('#file-count'));
/** @type {HTMLElement} */
const paGroup = /** @type {HTMLElement} */ (document.querySelector('#pa-group'));
/** @type {HTMLElement} */
const dropZone = /** @type {HTMLElement} */ (document.querySelector('#drop-zone'));
/** @type {HTMLElement} */
const profileChipsEl = /** @type {HTMLElement} */ (document.querySelector('#profile-chips'));

/**
 * @typedef {object} LoadedProfile
 * @property {string} filename
 * @property {Record<string, unknown>} rawConfig
 * @property {import('./lib/converter.js').ConvertedProfile | undefined} converted
 */

/** @type {LoadedProfile[]} */
let profiles = [];

/** @type {number} */
let activeProfileIndex = 0;

/** @type {number} */
let lastFailCount = 0;

/** @returns {import('./lib/converter.js').PrinterTarget} */
function getSelectedPrinter () {
  const el = /** @type {HTMLInputElement} */ (document.querySelector('input[name="printer"]:checked'));
  return /** @type {import('./lib/converter.js').PrinterTarget} */ (el.value);
}

/** @returns {import('./lib/converter.js').FirmwareType} */
function getSelectedFirmware () {
  const el = /** @type {HTMLInputElement} */ (document.querySelector('input[name="firmware"]:checked'));
  return /** @type {import('./lib/converter.js').FirmwareType} */ (el.value);
}

/**
 * Parse file list and kick off processing.
 *
 * @param {File[]} files
 */
async function handleFiles (files) {
  if (!files.length) return;

  profiles = [];
  activeProfileIndex = 0;

  const results = await Promise.allSettled(files.map(async (file) => {
    const text = await file.text();
    return {
      filename: file.name.replace(/\.json$/i, ''),
      rawConfig: /** @type {Record<string, unknown>} */ (JSON.parse(text)),
      converted: /** @type {import('./lib/converter.js').ConvertedProfile | undefined} */ (undefined),
    };
  }));

  lastFailCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      profiles.push(result.value);
    } else {
      lastFailCount++;
    }
  }

  if (profiles.length) {
    processAll();

    // Brief cloudberry border flash — acknowledges receipt
    dropZone.classList.add('drop-zone--received');
    setTimeout(() => { dropZone.classList.remove('drop-zone--received'); }, 600);
  } else if (lastFailCount > 0) {
    fileCountEl.textContent = lastFailCount === 1
      ? 'Could not read file \u2014 is it a valid Bambu .json profile?'
      : `${lastFailCount} files could not be read \u2014 are they valid Bambu .json profiles?`;
  }
}

// File input change
fileUpload.addEventListener('change', (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const files = [...(input.files ?? [])];
  handleFiles(files).catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
});

// Drag-and-drop with depth counter to avoid child-element flicker
let dragDepth = 0;

dropZone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth++;
  dropZone.classList.add('drop-zone--active');
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
});

dropZone.addEventListener('dragleave', () => {
  dragDepth--;
  if (dragDepth === 0) {
    dropZone.classList.remove('drop-zone--active');
  }
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove('drop-zone--active');
  const files = [...(event.dataTransfer?.files ?? [])];
  handleFiles(files).catch(() => {}); // eslint-disable-line promise/prefer-await-to-then
});

// Keyboard shortcut: Cmd/Ctrl+O opens file picker (native app feel)
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
    event.preventDefault();
    fileUpload.click();
  }
});

// Restore saved radio preferences (progressive — silent no-op if storage is unavailable)
try {
  const savedPrinter = localStorage.getItem('fc:printer');
  const savedFirmware = localStorage.getItem('fc:firmware');
  if (savedPrinter) {
    const match = /** @type {HTMLInputElement | null} */ (document.querySelector(`input[name="printer"][value="${savedPrinter}"]`));
    if (match) match.checked = true;
  }
  if (savedFirmware) {
    const match = /** @type {HTMLInputElement | null} */ (document.querySelector(`input[name="firmware"][value="${savedFirmware}"]`));
    if (match) match.checked = true;
  }
} catch { /* localStorage unavailable — use defaults */ }

// Re-process on printer or firmware change, persist selection
for (const r of printerRadios) {
  r.addEventListener('change', () => {
    try { localStorage.setItem('fc:printer', getSelectedPrinter()); } catch { /* */ }
    if (profiles.length) processAll();
  });
}
for (const r of firmwareRadios) {
  r.addEventListener('change', () => {
    try { localStorage.setItem('fc:firmware', getSelectedFirmware()); } catch { /* */ }
    if (profiles.length) processAll();
  });
}

function processAll () {
  if (!profiles.length) return;

  const printer = getSelectedPrinter();
  let anyPA = false;

  for (const p of profiles) {
    p.converted = convertProfile(p.rawConfig, printer);
    if (p.converted._pressureAdvance) anyPA = true;
  }

  if (anyPA) {
    paGroup.classList.add('show');
  } else {
    paGroup.classList.remove('show');
  }

  const firstEntry = /** @type {LoadedProfile} */ (profiles[0]);
  const firstConverted = firstEntry.converted;
  const firstName = firstConverted ? firstConverted.name : firstEntry.filename;
  let countText = profiles.length === 1
    ? `1 profile loaded: ${firstName}`
    : `${profiles.length} profiles loaded`;

  if (lastFailCount > 0) {
    countText += ` (${lastFailCount} file${lastFailCount > 1 ? 's' : ''} skipped \u2014 invalid JSON)`;
  }
  fileCountEl.textContent = countText;

  renderPreview();
  previewSection.classList.add('show');
  downloadBtn.removeAttribute('disabled');
  downloadBtn.textContent = profiles.length === 1
    ? 'Download PrusaSlicer .ini'
    : `Download ${profiles.length} profiles as bundled .ini`;

  // Update tab title to reflect loaded state
  document.title = profiles.length === 1
    ? `${firstName} \u2014 Filament Transcriber`
    : `${profiles.length} profiles \u2014 Filament Transcriber`;
}

/**
 * @typedef {object} PreviewGroup
 * @property {string} title
 * @property {Record<string, string>} fields
 */

function renderPreview () {
  previewListEl.innerHTML = '';
  profileChipsEl.innerHTML = '';

  // Profile chips for multi-file
  if (profiles.length > 1) {
    for (const [i, p] of profiles.entries()) {
      const chip = document.createElement('button');
      chip.className = `profile-chip${i === activeProfileIndex ? ' profile-chip--active' : ''}`;
      chip.type = 'button';

      const converted = p.converted;
      const colour = converted?.filament_colour;
      if (colour && /^#[\da-f]{6}$/i.test(colour)) {
        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = colour;
        chip.append(swatch);
      }

      const chipName = converted ? converted.name : p.filename;
      chip.append(chipName);

      chip.addEventListener('click', () => {
        activeProfileIndex = i;
        renderPreview();
      });

      profileChipsEl.append(chip);
    }
  }

  const targetPrinter = getSelectedPrinter();
  const activeEntry = /** @type {LoadedProfile} */ (profiles[activeProfileIndex]);
  const active = activeEntry.converted;
  if (!active) return;

  /** @type {PreviewGroup[]} */
  const groups = [
    {
      title: 'Material',
      fields: {
        filament_type: 'Type',
        filament_vendor: 'Vendor',
        filament_density: 'Density (g/cm\u00B3)',
        extrusion_multiplier: 'Flow Ratio',
      },
    },
    {
      title: 'Temperatures',
      fields: {
        first_layer_temperature: '1st Layer Nozzle (\u00B0C)',
        temperature: 'Other Layers (\u00B0C)',
        first_layer_bed_temperature: '1st Layer Bed (\u00B0C)',
        bed_temperature: 'Other Layers Bed (\u00B0C)',
        chamber_temperature: 'Chamber (\u00B0C)',
      },
    },
    {
      title: 'Cooling',
      fields: {
        fan_always_on: 'Fan Always On',
        min_fan_speed: 'Min Fan (%)',
        max_fan_speed: 'Max Fan (%)',
        bridge_fan_speed: 'Bridge Fan (%)',
        disable_fan_first_layers: 'Fan Off Layers',
        full_fan_speed_layer: 'Full Fan Layer',
      },
    },
    {
      title: 'Retraction',
      fields: {
        filament_retract_length: 'Length (mm)',
        filament_retract_speed: 'Speed (mm/s)',
        filament_deretract_speed: 'Deretract (mm/s)',
        filament_retract_lift: 'Z-Hop (mm)',
      },
    },
    {
      title: 'Motion',
      fields: {
        filament_max_volumetric_speed: 'Max Vol. (mm\u00B3/s)',
        min_print_speed: 'Min Speed (mm/s)',
        _pressureAdvance: 'Pressure Advance',
      },
    },
  ];

  /** @type {Record<string, string | number | boolean | undefined>} */
  const indexable = /** @type {Record<string, string | number | boolean | undefined>} */ (/** @type {unknown} */ (active));

  for (const group of groups) {
    const hasValues = Object.keys(group.fields).some((k) => indexable[k] !== undefined && indexable[k] !== '');
    if (!hasValues) continue;

    const heading = document.createElement('h3');
    heading.textContent = group.title;
    previewListEl.append(heading);

    const dl = document.createElement('dl');
    for (const [key, label] of Object.entries(group.fields)) {
      const val = indexable[key];
      if (val === undefined || val === '') continue;

      let displayValue = String(val);
      if (key === 'filament_max_volumetric_speed' && active._wasCapped) {
        displayValue = `${val} (capped from ${active._rawMVS})`;
      }

      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');

      // Colour swatch next to filament type
      if (key === 'filament_type' && active.filament_colour && /^#[\da-f]{6}$/i.test(active.filament_colour)) {
        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = active.filament_colour;
        dd.append(swatch);
      }

      dd.append(displayValue);
      dl.append(dt);
      dl.append(dd);
    }
    previewListEl.append(dl);
  }

  // Dynamic notice — built via DOM API (no innerHTML with interpolated data)
  dynamicNotice.textContent = '';

  if (targetPrinter === 'standard') {
    const strong = document.createElement('strong');
    strong.textContent = 'Constraint Applied:';
    dynamicNotice.append(strong, ' Volumetric speed capped at 15 mm\u00B3/s for MK3S/Mini+ hardware.');
    dynamicNotice.classList.remove('high-flow');
  } else {
    const strong = document.createElement('strong');
    strong.textContent = 'High-Flow Enabled:';
    dynamicNotice.append(strong, ` Using native volumetric speed (${String(active._rawMVS)} mm\u00B3/s) for Prusa Core One.`);
    dynamicNotice.classList.add('high-flow');
  }

  if (active._needsHardenedNozzle) {
    const strong = document.createElement('strong');
    strong.textContent = 'Note:';
    dynamicNotice.append(document.createElement('br'), strong, ' This filament requires a hardened nozzle (HRC \u2265 40).');
  }

  if (profiles.length > 1) {
    const strong = document.createElement('strong');
    strong.textContent = `${profiles.length} profiles`;
    dynamicNotice.append(document.createElement('br'), strong, ' will be bundled into a single .ini file for import.');
  }
}

downloadBtn.addEventListener('click', () => {
  if (!profiles.length) return;

  const firmware = getSelectedFirmware();
  /** @type {import('./lib/converter.js').ConvertedProfile[]} */
  const converted = [];
  for (const p of profiles) {
    if (p.converted) converted.push(p.converted);
  }
  const iniContent = generateBundle(converted, firmware);

  const blob = new Blob([iniContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const firstProfile = profiles[0];
  a.download = profiles.length === 1 && firstProfile
    ? `${firstProfile.filename}_prusaslicer.ini`
    : 'bambu_filaments_prusaslicer.ini';

  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => { URL.revokeObjectURL(url); }, 1000);

  // Brief confirmation feedback
  const originalText = downloadBtn.textContent;
  downloadBtn.textContent = 'Downloaded!';
  downloadBtn.classList.add('btn--confirmed');
  setTimeout(() => {
    downloadBtn.textContent = originalText;
    downloadBtn.classList.remove('btn--confirmed');
  }, 2000);
});

// eslint-disable-next-line no-console
console.log('%cFilament Transcriber', 'font-weight:bold', '\u2014 Bambu \u2192 Prusa, no data leaves your browser. Source: view-source:');
