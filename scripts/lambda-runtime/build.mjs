import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, version as esbuildVersion } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(process.argv[2]);
const require = createRequire(join(root, "package.json"));
const functionDir = dirname(require.resolve("@aws-amplify/backend-function"));
const read = path => readFileSync(path, "utf8");
const factory = read(join(functionDir, "factory.js"));
// Fail if the inspected defaults drift rather than silently claim equivalence.
for (const expected of ["format: OutputFormat.ESM", "bundleAwsSDK: true", "sourceMap: true", "minify: true", "externalModules: Object.keys(props.layers)", "24: Runtime.NODEJS_24_X"]) assert.ok(factory.includes(expected), expected);
const banner = ["resolve_ssm_params.js", "invoke_ssm_shim.js"].map(file => read(join(functionDir, "lambda-shims", file))).join("").split(/\r\n|\n|\r/).map(line => line.replace(/\/\/.*$/, "")).join("");
const lock = JSON.parse(read(join(root, "package-lock.json")));
const reports = [];
for (const major of [20, 24]) {
  const dir = join(output, `node${major}`);
  mkdirSync(dir, { recursive: true });
  const settings = {
    absWorkingDir: root, bundle: true, platform: "node", format: "esm",
    target: `node${major}`, minify: true, sourcemap: true, metafile: true,
    loader: { ".node": "file" }, external: [],
    inject: [join(functionDir, "lambda-shims/cjs_shim.js")],
    banner: { js: banner }, logLevel: "warning",
  };
  const production = await build({ ...settings, entryPoints: ["amplify/functions/process-public-passport-image/handler.ts"], outfile: join(dir, "index.mjs") });
  const imports = [...new Set(Object.values(production.metafile.outputs).flatMap(info => info.imports.filter(item => item.external).map(item => item.path)))].sort();
  assert.ok(imports.every(name => builtinModules.includes(name.replace(/^node:/, ""))), `Unexpected unresolved external: ${imports}`);
  assert.ok(!Object.keys(production.metafile.inputs).some(path => path.endsWith(".node")), "Review newly introduced native dependency");
  const packages = new Map();
  for (const input of Object.keys(production.metafile.inputs)) {
    const parts = input.split("/node_modules/");
    const tail = parts.at(-1).replace(/^node_modules\//, "");
    if (!input.includes("node_modules/")) continue;
    const name = tail.startsWith("@") ? tail.split("/").slice(0, 2).join("/") : tail.split("/")[0];
    const prefix = input.slice(0, input.lastIndexOf("node_modules/") + "node_modules/".length + name.length);
    const manifest = JSON.parse(read(join(root, prefix, "package.json")));
    packages.set(`${name}@${manifest.version}`, { name, version: manifest.version, engines: manifest.engines ?? {} });
  }
  const bytes = readFileSync(join(dir, "index.mjs"));
  const report = {
    kind: "representative offline bundle; not an Amplify synthesized deployment artifact",
    runtimeTarget: major, architecture: "x86_64", esbuildVersion,
    backendFunction: lock.packages["node_modules/@aws-amplify/backend-function"].version,
    cdk: lock.packages["node_modules/aws-cdk-lib"].version,
    bytes: bytes.length, sourceMapBytes: readFileSync(join(dir, "index.mjs.map")).length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    nativeInputs: 0, externalBuiltins: imports,
    bannerExternal: "@aws-sdk/client-ssm is dynamically imported only for nonempty AMPLIFY_SSM_ENV_CONFIG; synthetic tests use {}",
    packages: [...packages.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
  writeFileSync(join(dir, "bundle-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(dir, "metafile.json"), JSON.stringify(production.metafile, null, 2));
  // This second bundle contains the unchanged full handler, SDKs, test fixtures,
  // and boundary mocks. Measure production size from index.mjs above, not here.
  await build({ ...settings, banner: {}, entryPoints: ["scripts/lambda-runtime/handler-tests.mjs"], external: ["./index.mjs"], outfile: join(dir, "handler-tests.mjs") });
  reports.push(report);
  console.log(JSON.stringify(report));
}
writeFileSync(join(output, "bundle-reports.json"), JSON.stringify(reports, null, 2));
