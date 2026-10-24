// Local repair overlay for the already-approved pinned test. No installer/config/UI changes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {repairPanel,repairTransport}=require('./premiere_session_repair.cjs');

const hashes = {
  'src/tools/expanded.ts': '54ecb64b345f3c1bc8237c711f4503ae385bacfc0ab7d5e1d3d82d887f174ffb',
  'src/tools/index.ts': 'c3e3c571a5bc6eb98f045b8743f1541b1caed0457afb245899d0ee623ceee97f',
  'src/bridge/index.ts': '29383efd059486972e2fe2e6a8a46f94a2a10aa8aad7cd1cee73ac1f11b5fd95',
  'cep-plugin/bridge-cep.js': '8f6f1ef8b26d35ae39bfe3226874f9279da510b0edc03be96a815e2ba5c2c926',
};
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Pinned patch anchor changed or ambiguous');
  return source.replace(before, after);
}
function repairExpanded(source) {
  source = replaceOnce(source, 'case "set_color_value":\n        case "set_effect_property":', `case "set_color_value":
          if (!args.clipId) return fail("set_color_value requires clipId");
          var colorClip = findClip(args.clipId);
          if (!colorClip) return fail(pendingSequenceError || "Clip not found");
          var colorComponent = findComponent(colorClip.clip, args.componentName || args.effectName);
          if (!colorComponent) return fail("Color component not found");
          var colorProp = findProperty(colorComponent.component, args.propertyName);
          if (!colorProp || !colorProp.getColorValue || !colorProp.setColorValue) return fail("Native color APIs unavailable");
          var rgba = args.argb;
          if (!rgba || rgba.length !== 4) return fail("argb requires native alpha 0/1, then integer RGB channels 0..255");
          if (rgba[0] !== 0 && rgba[0] !== 1) return fail("Native opaque alpha is 1, not 255; fractional alpha unaccepted");
          for (var channel = 0; channel < 4; channel++) {
            if (typeof rgba[channel] !== "number" || !isFinite(rgba[channel]) || rgba[channel] < 0 || rgba[channel] > 255 || Math.floor(rgba[channel]) !== rgba[channel]) return fail("Invalid ARGB channel");
          }
          var beforeColor = colorProp.getColorValue();
          var colorWrite = colorProp.setColorValue(rgba[0], rgba[1], rgba[2], rgba[3], 1);
          var afterColor = colorProp.getColorValue();
          if (!afterColor || afterColor.length !== 4) return fail("Native colour write has no verifiable readback", { mutated: true });
          for (var checkChannel = 0; checkChannel < 4; checkChannel++) {
            if (afterColor[checkChannel] !== rgba[checkChannel]) return fail("Native colour readback differs; do not retry blindly", { mutated: true, before: beforeColor, after: afterColor, requestedARGB: rgba });
          }
          return ok({ component: String(colorComponent.component.displayName), property: String(colorProp.displayName), before: beforeColor, after: afterColor, requestedARGB: rgba, hostReturn: colorWrite });
        case "set_effect_property":`);
  source = replaceOnce(source,
    'var valueResult = getComponentProperty(valueComponent.component, valuePropName);\n          if (valueResult.ok) return ok({ component: String(valueComponent.component.displayName), property: valueResult.property, value: valueResult.value });\n          return fail(valueResult.error || "Property not found");',
    `var timedProperty = findProperty(valueComponent.component, valuePropName);
          if (!timedProperty || !timedProperty.getValueAtTime) return fail("Time-aware property unavailable");
          if (typeof args.time !== "number" || !isFinite(args.time) || args.time < 0) return fail("time must be finite nonnegative source seconds");
          var timedValue = timedProperty.getValueAtTime(secondsToTime(args.time));
          return ok({ component: String(valueComponent.component.displayName), property: String(timedProperty.displayName), value: timedValue, time: args.time, timeDomain: "source-seconds" });`);
  // A CEP panel can be unloaded before closeDocument's evalScript callback returns.
  // Fail BEFORE closing; never leave an ambiguous late mutation in the queue.
  source = replaceOnce(source,
    'var closeResult = tryCall(app.project, ["closeDocument", "close"], [Boolean(args.saveFirst || args.save)]);\n          if (!closeResult.called) return fail(closeResult.error, { available: false });\n          return ok({ closed: true, method: closeResult.method });',
    'return fail("close_project quarantined: closing unloads the CEP response channel. Save, then use native project lifecycle until a persistent host bridge is verified.", { quarantined: true, mutated: false });');
  return source;
}
function repairFrame(source) {
  source = replaceOnce(source, 'var timeString = String(timeNumber);', `if (!isFinite(timeNumber) || timeNumber < 0) return JSON.stringify({ success: false, error: "Invalid frame time" });
        if (Number(sequence.zeroPoint || 0) !== 0) return JSON.stringify({ success: false, error: "Nonzero sequence start requires separate frame-time acceptance" });
        var frameDuration = new Time();
        frameDuration.ticks = String(sequence.timebase);
        var requestedFrameTime = new Time();
        requestedFrameTime.seconds = timeNumber;
        var frameDisplay = sequence.getSettings().videoDisplayFormat;
        if (frameDisplay < 100 || frameDisplay > 109) return JSON.stringify({ success: false, error: "Unsupported frame timecode display" });
        var timeString = requestedFrameTime.getFormatted(frameDuration, frameDisplay);`);
  source = replaceOnce(source,
    'tryExport(timeNumber, exportStem) ||\n          tryExport(exportStem, timeNumber) ||\n          tryExport(timeString, exportStem) ||\n          tryExport(exportStem, timeString) ||\n          tryExport(timeTicks, exportStem) ||\n          tryExport(exportStem, timeTicks);',
    'tryExport(timeString, exportStem);');
  source = replaceOnce(source, 'var actualPath = writtenPath(true);', 'var actualPath = writtenPath(false);');
  return source;
}
function prepare(sourceRoot, outputRoot) {
  const src = fs.realpathSync(sourceRoot);
  const out = path.resolve(outputRoot);
  if (fs.existsSync(out)) throw new Error('Output must be new');
  if (out.toLowerCase().startsWith(src.toLowerCase() + path.sep)) throw new Error('Output must be outside pinned source');
  const pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
  if (pkg.name !== 'adobe-premiere-pro-mcp' || pkg.version !== '1.2.0') throw new Error('Unexpected vendor package');
  const lockHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(src, 'package-lock.json'))).digest('hex');
  if (lockHash !== '78ef9a239b60a8e1079184d00c808fe5fca47aec974bb4c3820c236689f3a817') throw new Error('Pinned dependency lock changed');
  for (const [file, expected] of Object.entries(hashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(src, file))).digest('hex');
    if (actual !== expected) throw new Error('Pinned hash mismatch: ' + file);
  }
  // Validate all patches before creating output. Preserve original source and lockfile.
  const changes = {
    'src/tools/expanded.ts': repairExpanded(fs.readFileSync(path.join(src, 'src/tools/expanded.ts'), 'utf8').replaceAll('\r\n', '\n')),
    'src/tools/index.ts': repairFrame(fs.readFileSync(path.join(src, 'src/tools/index.ts'), 'utf8').replaceAll('\r\n', '\n')),
    'src/bridge/index.ts': repairTransport(fs.readFileSync(path.join(src,'src/bridge/index.ts'),'utf8').replaceAll('\r\n','\n')),
    'cep-plugin/bridge-cep.js': repairPanel(fs.readFileSync(path.join(src,'cep-plugin/bridge-cep.js'),'utf8').replaceAll('\r\n','\n')),
  };
  fs.cpSync(src, out, { recursive: true, filter: p => !['node_modules', '.git'].includes(path.basename(p)) });
  for (const [file, contents] of Object.entries(changes)) fs.writeFileSync(path.join(out, file), contents);
  fs.symlinkSync(path.join(src, 'node_modules'), path.join(out, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(out, 'NOLAN-LOCAL-REPAIRS.json'), JSON.stringify({
    upstreamCommit: '50f534b17639aafc615a10b38325957bf73e6515', preparedAt: new Date().toISOString(),
    sourceHashes: hashes, repairs: ['source-time-value', 'formatted-frame-time-candidate', 'quarantine-close-before-mutation', 'explicit-native-argb-color', 'opt-in-expiring-duplicate-reconnect', 'host-project-and-sequence-scope', 'protected-denial-propagation'],
    hostAcceptance: false, dependencyInstall: false,
  }, null, 2));
  return out;
}
module.exports = { prepare, repairExpanded, repairFrame };
if (require.main === module) {
  if (process.argv.length !== 4) throw new Error('Usage: node prepare_premiere_mcp_repairs.cjs PINNED_SOURCE NEW_PRIVATE_OUTPUT');
  console.log(prepare(process.argv[2], process.argv[3]));
}
