# Filament Transcriber

Convert [Bambu Studio](https://wiki.bambulab.com/en/bambu-studio/export-filament) `.json` filament profiles into [PrusaSlicer](https://help.prusa3d.com/article/how-to-import-and-export-custom-profiles-in-prusaslicer_382766) `.ini` format. No data leaves your browser.

**https://voxpelli.github.io/filament-converter/**

## Features

- Drag-and-drop or browse for `.json` files
- Select multiple files for a bundled `.ini` import
- Export for one or both printer targets simultaneously
- Preview converted settings before downloading
- Add and remove profiles incrementally
- Keyboard shortcut: `Cmd/Ctrl+O` to open file picker

## Target printers

| Target | Suffix | Volumetric speed | Examples |
|--------|--------|-----------------|----------|
| Normal flow | `@NORMAL` | Capped at 15 mm³/s | MK3S, Mini+ |
| High flow | `@HIGH` | Native (uncapped) | MK4, Core One |

When both targets are selected, each profile is exported twice with the appropriate suffix (e.g., `addnorth PLA Economy @NORMAL` and `addnorth PLA Economy @HIGH`). When only one target is selected, profiles use their plain name without a suffix.

## What gets converted

- **Temperatures** -- nozzle, bed (from textured plate, falling back to smooth), chamber
- **Cooling** -- fan speeds, bridge fan, fan-off layers, full-fan layer, layer-time thresholds
- **Retraction** -- length, speed, deretraction speed, z-hop, wipe, minimum travel (only when the Bambu profile sets them)
- **Motion** -- max volumetric speed (with optional hardware cap), min print speed, pressure advance (injected as G-code)
- **Material** -- type, density, cost, flow ratio, colour, solubility

## What gets skipped

These Bambu-specific fields have no PrusaSlicer equivalent:

- AMS / multi-extruder variant arrays, filament cutting distances
- Scarf joint / seam settings
- Plate-specific temps beyond textured/smooth (cool plate, engineering plate, supertack)
- Exhaust fan, air filtration, pre-cooling
- Calibration coefficients (counter/hole coef), adhesiveness category
- Bambu-specific G-code conditionals in `filament_start_gcode`

## Limitations

- Retraction values from Bambu profiles may need tuning -- Bambu printers use different extruder geometry than Prusa direct-drive systems
- Pressure advance is injected as `M900` (Marlin) or `SET_PRESSURE_ADVANCE` (Klipper) in the filament start G-code -- you may want to recalibrate PA for your specific printer
- The `required_nozzle_HRC` field (hardened nozzle for composites) is noted in filament notes but not enforced

## Importing into PrusaSlicer

### Single profile

1. Open PrusaSlicer (2.7 or later)
2. **File > Import > Import Config** (or `Ctrl+L`)
3. Select the downloaded `.ini` file
4. Save as a named preset in the Filament Settings tab

### Multiple profiles (bundled file)

1. **File > Import > Import Config Bundle**
2. Select the bundled `.ini` file
3. PrusaSlicer creates a named preset for each `[filament:Name]` section automatically

## How to export from Bambu Studio

In Bambu Studio: right-click a filament preset and select **Export**. This produces the `.json` file this tool accepts.

See the [Bambu Lab wiki](https://wiki.bambulab.com/en/bambu-studio/export-filament) for detailed instructions.

## Development

```sh
npm install
npm run dev          # starts local server with live reload
npm run check        # lint + type-check
npm run test:unit    # 64 unit tests
```

Zero runtime dependencies. Static site -- no build step required for the frontend.

## Built with

This project was built mostly with [Claude Code](https://claude.ai/claude-code) -- Anthropic's CLI for Claude. The design system, conversion logic, progressive enhancements, and test suite were developed through iterative AI-assisted sessions.

## License

MIT
