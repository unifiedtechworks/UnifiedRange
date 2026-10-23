import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [source, harness, summary] = process.argv.slice(2).map((path) => resolve(path));
const harnessSha = "dbc5f575eb636a7da279a390bd2b6f3629e8fce7";
const baselineSha = "6d268c77b8d694385bd21128bae044ff1feffbb0";
const results = [];
let failed = false;
const note = (text) => { console.log(text); appendFileSync(summary, `${text}\n`); };
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function command(label, executable, args, timeout = 180_000) {
  console.log(`\n::group::${label}`);
  const result = spawnSync(executable, args, { cwd: source, env: process.env, stdio: "inherit", timeout });
  const status = result.status === null ? `no exit: ${result.error?.code || result.signal}` : result.status;
  console.log(`Exit status: ${status}\n::endgroup::`);
  const ok = result.status === 0;
  results.push([label, ok ? "passed" : "failed", status]);
  if (!ok) failed = true;
  return ok;
}

function revision(path) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: path, encoding: "utf8" });
  assert.equal(result.status, 0);
  return result.stdout.trim();
}

function installedVersions() {
  const lock = JSON.parse(readFileSync(join(source, "package-lock.json"), "utf8"));
  let checked = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    const manifest = join(source, path, "package.json");
    if (!existsSync(manifest)) continue; // Other platforms / unmaterialized bundled entries.
    assert.equal(JSON.parse(readFileSync(manifest, "utf8")).version, entry.version, `Version mismatch: ${path}`);
    checked += 1;
  }
  const root = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  for (const name of Object.keys({ ...root.dependencies, ...root.devDependencies })) {
    assert.ok(existsSync(join(source, "node_modules", name, "package.json")), `Missing direct dependency: ${name}`);
  }
  const native = ["@next/swc-linux-x64-gnu", "@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"];
  for (const name of ["next", "image-js", "postcss", ...native]) {
    const path = `node_modules/${name}`;
    const version = JSON.parse(readFileSync(join(source, path, "package.json"), "utf8")).version;
    assert.equal(version, lock.packages[path].version);
    note(`- Installed ${name}: ${version} (matches lockfile)`);
  }
  const requireFromSource = createRequire(join(source, "package.json"));
  requireFromSource("@next/swc-linux-x64-gnu");
  const sharp = requireFromSource("sharp");
  note(`- Native module load: SWC and Sharp passed; Sharp ${sharp.versions.sharp}, libvips ${sharp.versions.vips}`);
  note(`- Compared ${checked} installed package versions with lockfile entries; no mismatches.`);
}

async function smoke() {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
    cwd: source, env: process.env, stdio: "ignore"
  });
  let startupError;
  child.on("error", (error) => { startupError = error; });
  try {
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      assert.equal(child.exitCode, null, "Production server exited before readiness");
      try {
        const response = await fetch("http://127.0.0.1:3100/", { signal: AbortSignal.timeout(3000), redirect: "error" });
        await response.arrayBuffer();
        if (response.status === 200) { ready = true; break; }
      } catch { /* Bounded startup polling only; no repeated build/test jobs. */ }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(ready, "Loopback server did not become ready in 60 seconds");
    for (const [path, expected] of [["/", "UnifiedRange"], ["/auth/sign-in", "Sign in to UnifiedRange"]]) {
      const response = await fetch(`http://127.0.0.1:3100${path}`, { signal: AbortSignal.timeout(10_000), redirect: "error" });
      assert.equal(response.status, 200, `HTTP status for ${path}`);
      assert.match(response.headers.get("content-type"), /text\/html/);
      const html = await response.text();
      assert.ok(html.includes(expected), `Expected page content for ${path}`);
      note(`- Loopback GET ${path}: HTTP 200, HTML and expected content passed (no browser JS or sign-in).`);
    }
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

note(`# Linux ${process.env.COMPARISON_LABEL} validation`);
const before = {};
try {
  assert.equal(platform(), "linux");
  assert.equal(arch(), "x64");
  assert.equal(process.version, "v24.14.0");
  assert.ok([baselineSha, harnessSha].includes(process.env.SOURCE_SHA));
  assert.equal(revision(source), process.env.SOURCE_SHA);
  assert.equal(revision(harness), harnessSha);
  assert.equal(revision(resolve(dirname(fileURLToPath(import.meta.url)), "../..")), process.env.WORKFLOW_SHA);
  for (const path of [source, harness]) {
    const config = spawnSync("git", ["config", "--local", "--get-regexp", "http\\..*extraheader|credential\\..*"], { cwd: path });
    assert.equal(config.status, 1, "Checkout must not retain authentication configuration");
  }
  note(`- Source SHA: ${revision(source)}`);
  note(`- Codec harness SHA: ${harnessSha}${process.env.SOURCE_SHA === baselineSha ? " (supplemental; not part of baseline)" : ""}`);
  note(`- Workflow/support SHA: ${process.env.WORKFLOW_SHA}`);
  note(`- Runner image: ${process.env.RUNNER_IMAGE_OS} / ${process.env.RUNNER_IMAGE_VERSION}; ${platform()} ${arch()}`);
  note(`- OS: ${readFileSync("/etc/os-release", "utf8").split("\n").find((line) => line.startsWith("PRETTY_NAME="))}`);
  command("uname -a", "uname", ["-a"]);
  command("node --version", "node", ["--version"]);
  const toolchain = join(process.env.HOME, "npm-toolchain");
  assert.ok(command("Pin npm 11.9.0", "npm", ["install", "--global", "npm@11.9.0", "--prefix", toolchain, "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org"], 180_000));
  process.env.PATH = `${join(toolchain, "bin")}:${process.env.PATH}`;
  command("npm --version", "npm", ["--version"]);
  const version = spawnSync("npm", ["--version"], { cwd: source, env: process.env, encoding: "utf8" });
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), "11.9.0");
  note("- Application toolchain: Node 24.14.0 / npm 11.9.0. Ubuntu is not claimed to match Amplify's unknown image.");
  for (const file of ["package.json", "package-lock.json"]) {
    before[file] = hash(join(source, file));
    note(`- Before ${file}: ${before[file]}`);
  }
  assert.ok(!existsSync(join(source, "node_modules")) && !existsSync(join(source, ".next")), "Clean checkout required");
  const codecFile = "scripts/public-image-codec-compatibility.test.mjs";
  copyFileSync(join(harness, codecFile), join(source, codecFile));
  assert.equal(hash(join(source, codecFile)), hash(join(harness, codecFile)));
  if (command("npm ci", "npm", ["ci"], 720_000)) {
    try {
      installedVersions();
      results.push(["Installed/native package verification", "passed", 0]);
    } catch (error) {
      note(`Installed/native package verification failed: ${error.message}`);
      results.push(["Installed/native package verification", "failed", 1]);
      failed = true;
    }
    command("npm run test:public-image-reconciliation", "npm", ["run", "test:public-image-reconciliation"]);
    command("Synthetic codec tests", "node", ["--test", codecFile]);
    command("npm run amplify:typecheck", "npm", ["run", "amplify:typecheck"], 300_000);
    command("npm run lint", "npm", ["run", "lint"], 300_000);
    if (command("npm run build", "npm", ["run", "build"], 600_000)) {
      try { await smoke(); results.push(["Loopback HTTP smoke", "passed", 0]); }
      catch (error) { note(`Loopback smoke failed: ${error.message}`); results.push(["Loopback HTTP smoke", "failed", 1]); failed = true; }
    } else results.push(["Loopback HTTP smoke", "not run (build failed)", "—"]);
  } else results.push(["Tests/typecheck/lint/build/HTTP", "not run (install failed)", "—"]);
} catch (error) {
  note(`Validation setup/check failed: ${error.message}`);
  results.push(["Validation setup/check", "failed", 1]);
  failed = true;
} finally {
  command("git diff --check", "git", ["diff", "--check"]);
  command("git diff --exit-code -- package.json package-lock.json", "git", ["diff", "--exit-code", "--", "package.json", "package-lock.json"]);
  for (const file of Object.keys(before)) {
    const after = hash(join(source, file));
    note(`- After ${file}: ${after}; unchanged: ${after === before[file]}`);
    if (after !== before[file]) { failed = true; results.push([`${file} hash invariant`, "failed", 1]); }
  }
  note("\n| Check | Result | Exit status |\n| --- | --- | --- |");
  for (const row of results) note(`| ${row.join(" | ")} |`);
  note("\nNo deployment, authenticated QA, Lambda bundling, or Amplify SSR adaptation was performed. No build/data artifacts uploaded.");
}
process.exitCode = failed ? 1 : 0;
