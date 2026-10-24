import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const functions = {
  "create-public-image-report": 10,
  "inspect-public-image-cleanup": 10,
  "moderate-public-passport-image": 15,
  "process-public-passport-image": 45,
  "remove-public-passport-image": 15,
  "resolve-public-passport-image": 10,
  "retry-removed-public-image-cleanup": 15,
  "verify-private-image": 15,
};
function parse(file) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true); }
function walk(node, visit) { visit(node); ts.forEachChild(node, child => walk(child, visit)); }
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(dir, item.name)) : [join(dir, item.name)]); }
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  assert.ok(ts.isObjectLiteralExpression(node), "Configuration must remain explicit literals");
  const object = {};
  for (const property of node.properties) {
    assert.ok(ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name));
    const key = property.name.text;
    assert.ok(!Object.hasOwn(object, key), `Duplicate ${key}`);
    object[key] = literal(property.initializer);
  }
  return object;
}
test("all eight custom functions have explicit Node 24 and unchanged resource settings", () => {
  const found = [];
  for (const file of files(join(root, "amplify")).filter(file => file.endsWith(".ts"))) {
    const source = parse(file);
    const aliases = new Set(["defineFunction"]);
    walk(source, node => {
      if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === "defineFunction") aliases.add(node.name.text);
    });
    walk(source, node => {
      if (!ts.isCallExpression(node) || !aliases.has(ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : node.expression.getText(source))) return;
      assert.equal(node.arguments.length, 1);
      const config = literal(node.arguments[0]);
      assert.ok(Object.hasOwn(functions, config.name), `Unexpected custom function ${config.name}`);
      assert.equal(relative(root, file).replaceAll("\\", "/"), `amplify/functions/${config.name}/resource.ts`);
      const processor = config.name === "process-public-passport-image";
      assert.deepEqual(config, {
        name: config.name, entry: "./handler.ts", resourceGroupName: "data",
        timeoutSeconds: functions[config.name], memoryMB: processor ? 1024 : 256,
        ...(processor ? { ephemeralStorageSizeMB: 512 } : {}), runtime: 24,
        logging: { format: "json", level: "info", retention: "1 month" },
      });
      found.push(config.name);
    });
  }
  assert.deepEqual(found.sort(), Object.keys(functions).sort());
  const resourceFiles = files(join(root, "amplify/functions")).filter(file => file.endsWith("resource.ts"));
  assert.equal(resourceFiles.length, 8);
  const require = createRequire(import.meta.url);
  const factory = readFileSync(join(dirname(require.resolve("@aws-amplify/backend-function")), "factory.js"), "utf8");
  assert.ok(factory.includes("const architectureDefault = 'x86_64'"));
  assert.ok(factory.includes("24: Runtime.NODEJS_24_X"));
});
test("cleanup execution is explicitly disabled in backend configuration", () => {
  const source = parse(join(root, "amplify/backend.ts"));
  const gates = [];
  walk(source, node => {
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "REMOVED_PUBLIC_IMAGE_CLEANUP_ENABLED") {
      assert.equal(node.expression.getText(source), "backend.retryRemovedPublicImageCleanup.addEnvironment");
      assert.equal(node.arguments.length, 2);
      gates.push(literal(node.arguments[1]));
    }
  });
  assert.deepEqual(gates, ["false"]);
});
test("custom handler exports remain async with a single event parameter", () => {
  for (const name of Object.keys(functions)) {
    const source = parse(join(root, `amplify/functions/${name}/handler.ts`));
    const handlers = [];
    walk(source, node => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handler") handlers.push(node.initializer);
    });
    assert.equal(handlers.length, 1, name);
    const handler = handlers[0];
    assert.ok(ts.isArrowFunction(handler), name);
    assert.ok(handler.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword), name);
    assert.equal(handler.parameters.length, 1, name);
  }
});
