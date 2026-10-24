import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [source, harness, summary] = process.argv.slice(2).map(resolvePath => resolve(resolvePath));
const sourceSha = "1656d7cc243151c9ee42e31598620bef72d6edb7";
const images = {
  20: "public.ecr.aws/lambda/nodejs@sha256:7113432fbe93b701792a659c515a9501822b95b0c3070d27565f22b8422aee3d",
  24: "public.ecr.aws/lambda/nodejs@sha256:b157a991e174a3696e77c991727001756bb4d4ea4bba426d3401e515b9285b0d",
};
const results = [];
const note = value => { console.log(value); appendFileSync(summary, `${value}\n`); };
const hash = file => createHash("sha256").update(readFileSync(join(source, file))).digest("hex");
function run(label, exe, args, timeout = 180_000) {
  console.log(`::group::${label}`);
  const result = spawnSync(exe, args, { cwd: source, env: process.env, stdio: "inherit", timeout });
  const status = result.status ?? result.error?.code ?? result.signal;
  console.log(`Exit ${status}\n::endgroup::`);
  results.push([label, result.status === 0 ? "passed" : "failed", status]);
  return result.status === 0;
}
function revision(path) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: path, encoding: "utf8" });
  assert.equal(result.status, 0); return result.stdout.trim();
}
const before = {};
try {
  assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
  assert.equal(process.version, "v24.14.0");
  assert.equal(revision(source), sourceSha);
  assert.match(process.env.HARNESS_SHA, /^[a-f0-9]{40}$/);
  assert.equal(revision(harness), process.env.HARNESS_SHA);
  note(`# Lambda representative bundle/runtime validation\nSource: ${sourceSha}\nHarness: ${process.env.HARNESS_SHA}\nWorkflow: ${process.env.WORKFLOW_SHA}`);
  note(`Build runner: ${process.env.RUNNER_IMAGE_OS}/${process.env.RUNNER_IMAGE_VERSION}; Node ${process.version}; ${process.platform}/${process.arch}`);
  for (const dir of [source, harness]) {
    assert.equal(spawnSync("git", ["config", "--local", "--get-regexp", "http\\..*extraheader|credential\\..*"], { cwd: dir }).status, 1);
  }
  assert.ok(!existsSync(join(source, "node_modules")) && !existsSync(join(source, ".next")));
  for (const file of ["package.json", "package-lock.json"]) { before[file] = hash(file); note(`Before ${file}: ${before[file]}`); }
  cpSync(join(harness, "scripts/lambda-runtime"), join(source, "scripts/lambda-runtime"), { recursive: true });
  const toolchain = join(process.env.HOME, "npm-toolchain");
  assert.ok(run("Pin npm 11.9.0", "npm", ["install", "--global", "npm@11.9.0", "--prefix", toolchain, "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org"]));
  process.env.PATH = `${join(toolchain, "bin")}:${process.env.PATH}`;
  assert.equal(spawnSync("npm", ["--version"], { encoding: "utf8", env: process.env }).stdout.trim(), "11.9.0");
  note("Build toolchain: Node 24.14.0 / npm 11.9.0; separate from container runtime Node.");
  assert.ok(run("npm ci", "npm", ["ci"], 720_000));
  run("Generator compatibility", "node", ["--test", "scripts/graphql-generator-compatibility.test.mjs"]);
  run("Reconciliation (Node 24)", "npm", ["run", "test:public-image-reconciliation"]);
  run("Pure codec helpers (Node 24)", "node", ["--test", "scripts/public-image-codec-compatibility.test.mjs"]);
  run("Amplify typecheck", "npm", ["run", "amplify:typecheck"], 300_000);
  run("Lint", "npm", ["run", "lint"], 300_000);
  run("Production web build", "npm", ["run", "build"], 600_000);
  const bundles = join(process.env.HOME, "lambda-bundles");
  assert.ok(run("Representative real-handler bundling", "node", ["scripts/lambda-runtime/build.mjs", bundles]));
  const reports = JSON.parse(readFileSync(join(bundles, "bundle-reports.json"), "utf8"));
  for (const report of reports) {
    note(`Node ${report.runtimeTarget} bundle: ${report.bytes} bytes; map ${report.sourceMapBytes} bytes; SHA-256 ${report.sha256}; ${report.packages.length} package/version inputs; native inputs ${report.nativeInputs}`);
    note(`Bundled package/version inputs: ${report.packages.map(p => `${p.name}@${p.version}`).join(", ")}`);
    note(`External requirements: ${report.externalBuiltins.join(", ")}; ${report.bannerExternal}`);
  }
  run("Docker version", "docker", ["version", "--format", "{{.Server.Version}}"]);
  for (const [major, image] of Object.entries(images)) {
    note(`Runtime ${major} official AWS image: ${image}`);
    if (!run(`Pull pinned Node ${major} image`, "docker", ["pull", "--platform", "linux/amd64", image], 300_000)) continue;
    const inspect = spawnSync("docker", ["image", "inspect", image, "--format", "{{.Os}}/{{.Architecture}}"], { encoding: "utf8" });
    assert.equal(inspect.status, 0); assert.equal(inspect.stdout.trim(), "linux/amd64");
    run(`Lambda-image Node ${major} full-handler tests`, "docker", [
      "run", "--rm", "--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
      "--cpus=2", "--memory=1024m", "--pids-limit=128", "--user=1000:1000",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--mount", `type=bind,src=${join(bundles, `node${major}`)},dst=/var/task,readonly`,
      "--env", `EXPECTED_NODE_MAJOR=${major}`, "--env", "HOME=/tmp", "--env", "AWS_EC2_METADATA_DISABLED=true",
      "--entrypoint", "/var/lang/bin/node", image, "/var/task/handler-tests.mjs",
    ], 180_000);
  }
} catch (error) {
  note(`Validation failed: ${error.message}`); results.push(["Setup/bundling invariants", "failed", 1]);
} finally {
  run("git diff --check", "git", ["diff", "--check"]);
  run("Manifest/lockfile diff", "git", ["diff", "--exit-code", "--", "package.json", "package-lock.json"]);
  for (const [file, original] of Object.entries(before)) {
    const unchanged = hash(file) === original;
    note(`After ${file}: ${hash(file)}; unchanged: ${unchanged}`);
    results.push([`${file} SHA-256 invariant`, unchanged ? "passed" : "failed", unchanged ? 0 : 1]);
  }
  note("\n| Check | Result | Exit |\n| --- | --- | --- |");
  for (const row of results) note(`| ${row.join(" | ")} |`);
  note("Representative artifacts only; no Amplify synthesis/deployment, IAM, live APIs, hosted auth or runtime migration. No artifacts uploaded.");
}
process.exitCode = results.some(row => row[1] === "failed") ? 1 : 0;
