import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Image, decodePng, encodePng, encodeJpeg } from "image-js";
import { decode as decodeJpeg, encode as encodeSourceJpeg } from "jpeg-js";

// Execute only the handler's pure codec declarations. Importing the handler itself
// would initialize AWS clients and require deployment environment configuration.
// Keep production source unchanged and fail if any expected declaration disappears.
const handlerUrl = new URL("../amplify/functions/process-public-passport-image/handler.ts", import.meta.url);
const source = ts.createSourceFile("handler.ts", readFileSync(handlerUrl, "utf8"), ts.ScriptTarget.Latest, true);
const names = new Set([
  "sourceMaxPixels", "sourceMaxDimension", "derivativeMaxBytes", "derivativeMaxDimension",
  "pngSignature", "jpegStartOfFrameMarkers", "forbiddenJpegMetadataMarkers", "ProcessingFailure",
  "readExifOrientation", "parseJpegHeader", "parsePngHeader", "validateDimensions",
  "inspectSourceImage", "applyOrientation", "flattenOnWhite", "decodeSourceImage", "createDerivative"
]);
const declarations = source.statements.filter((statement) => {
  const name = ts.isVariableStatement(statement)
    ? statement.declarationList.declarations[0]?.name.getText(source)
    : statement.name?.getText(source);
  return names.has(name);
});
assert.equal(declarations.length, names.size, "Pure codec declaration selection must stay complete");
const code = ts.transpileModule(declarations.map((node) => node.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;
const codec = runInNewContext(`${code}\n({ inspectSourceImage, decodeSourceImage, createDerivative, applyOrientation, parseJpegHeader })`, {
  Buffer, Uint8Array, Image, decodePng, encodeJpeg, decodeJpeg
});

function fixture(width, height, pixel = [30, 90, 180, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(pixel, i);
  return { width, height, data };
}

function convert(bytes, contentType) {
  const header = codec.inspectSourceImage(bytes, contentType);
  const decoded = codec.decodeSourceImage(bytes, header);
  const output = codec.createDerivative(decoded);
  // The production parser rejects EXIF/ICC/IPTC/comment metadata in derivatives.
  const result = codec.parseJpegHeader(output, true);
  assert.ok(output.length <= 2 * 1024 * 1024);
  assert.ok(Math.max(result.width, result.height) <= 1600);
  const roundtrip = decodeJpeg(output, { useTArray: true, tolerantDecoding: false });
  assert.equal(roundtrip.width, result.width);
  assert.equal(roundtrip.height, result.height);
  return { decoded, roundtrip };
}

test("synthetic JPEG passes real handler decode and derivative encoding", () => {
  const input = encodeSourceJpeg(fixture(16, 8), 90).data;
  const { roundtrip } = convert(input, "image/jpeg");
  assert.equal(roundtrip.width, 16);
  assert.equal(roundtrip.height, 8);
  for (const [channel, expected] of [30, 90, 180].entries()) {
    assert.ok(Math.abs(roundtrip.data[channel] - expected) < 15, "JPEG colors remain within lossy tolerance");
  }
});

test("synthetic transparent PNG flattens to white before JPEG encoding", () => {
  const f = fixture(8, 4, [255, 0, 0, 0]);
  const input = Buffer.from(encodePng(new Image(f.width, f.height, { data: f.data, colorModel: "RGBA", bitDepth: 8 })));
  const { decoded, roundtrip } = convert(input, "image/png");
  assert.deepEqual(Array.from(decoded.getRawImage().data.slice(0, 4)), [255, 255, 255, 255]);
  assert.ok(roundtrip.data.slice(0, 3).every((value) => value >= 250));
});

test("large synthetic PNG uses bounded derivative resizing", () => {
  const f = fixture(1800, 18);
  const input = Buffer.from(encodePng(new Image(f.width, f.height, { data: f.data, colorModel: "RGBA", bitDepth: 8 })));
  const { roundtrip } = convert(input, "image/png");
  assert.equal(roundtrip.width, 1600);
  assert.equal(roundtrip.height, 16);
});

test("orientation transforms preserve dimensions and pixel data", () => {
  const f = fixture(3, 2);
  f.data.set([200, 10, 20, 255], 0);
  const image = new Image(f.width, f.height, { data: f.data, colorModel: "RGBA", bitDepth: 8 });
  const rotated = codec.applyOrientation(image, 6);
  assert.equal(rotated.width, 2);
  assert.equal(rotated.height, 3);
  const restored = rotated.rotate(270);
  assert.deepEqual(Array.from(restored.getRawImage().data), Array.from(f.data));
  const flipped = codec.applyOrientation(image, 2).flip({ axis: "horizontal" });
  assert.deepEqual(Array.from(flipped.getRawImage().data), Array.from(f.data));
});
