import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// CI copies this harness and its fixtures into each source checkout. Resolve
// through that checkout's real parent importer, never the harness checkout.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const parentRequire = createRequire(require.resolve("@aws-amplify/graphql-generator/package.json"));
const generatorEntry = parentRequire.resolve("@aws-amplify/graphql-docs-generator");
const generatorRequire = createRequire(generatorEntry);
const { generateGraphQLDocuments, buildSchema } = parentRequire("@aws-amplify/graphql-docs-generator");
const { parse, validate, introspectionFromSchema } = generatorRequire("graphql");
const schemaText = readFileSync(new URL("fixtures/graphql-generator/schema.graphql", import.meta.url), "utf8");
const schema = buildSchema(schemaText);
const expected = JSON.parse(readFileSync(new URL("fixtures/graphql-generator/expected.json", import.meta.url), "utf8"));
const cases = [
  { name: "default", options: {} },
  { name: "metadata", options: { maxDepth: 4, includeMetaData: true, useExternalFragmentForS3Object: false } },
  { name: "without-typename", options: { maxDepth: 3, typenameIntrospection: false } },
  { name: "local-introspection", options: { maxDepth: 4 }, introspection: true },
];

test("the actual generator resolves the expected Handlebars copy in this source checkout", () => {
  const manifest = require("./package.json");
  // Control has no override. CI also asserts an independent expected version.
  const wanted = process.env.EXPECTED_HANDLEBARS_VERSION ||
    manifest.overrides?.["@aws-amplify/graphql-docs-generator@4.2.1"]?.handlebars || "4.7.7";
  assert.equal(parentRequire("@aws-amplify/graphql-docs-generator/package.json").version, "4.2.1");
  const handlebarsPath = generatorRequire.resolve("handlebars/dist/handlebars");
  const fromRoot = relative(root, handlebarsPath);
  assert.ok(!fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot));
  assert.equal(generatorRequire("handlebars/package.json").version, wanted);
  assert.equal(generatorRequire("handlebars/dist/handlebars").VERSION, wanted);
  const formRequire = createRequire(require.resolve("@aws-amplify/form-generator"));
  assert.equal(formRequire.resolve("@aws-amplify/graphql-docs-generator"), generatorEntry);
  const lock = require("./package-lock.json");
  const copies = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/handlebars$/.test(path));
  assert.equal(copies.length, 1, "Review any newly introduced Handlebars copies");
  for (const [path, entry] of copies) {
    assert.equal(entry.version, wanted, path);
    assert.ok(!entry.inBundle, "The reviewed copy is normally resolved, not bundled");
    assert.equal(require(`./${path}/package.json`).version, wanted, path);
  }
  console.log(`Generator 4.2.1 resolves ${fromRoot.replaceAll(sep, "/")} at ${wanted}`);
});

for (const scenario of cases) {
  test(`real GraphQL documents generator preserves reviewed ${scenario.name} output`, () => {
    // introspectionFromSchema is entirely local; no endpoint or client exists.
    const input = scenario.introspection ? JSON.stringify(introspectionFromSchema(schema)) : schemaText;
    const generated = generateGraphQLDocuments(input, scenario.options);
    const actual = Object.fromEntries(Object.entries(generated).map(([kind, operations]) => [kind, Object.fromEntries(operations)]));
    assert.deepEqual(actual, expected.outputs[scenario.name]);
    assert.deepEqual(Object.keys(actual.queries), ["getEntry", "listEntries", "lookupEntries"]);
    assert.deepEqual(Object.keys(actual.mutations), ["createEntry", "deleteEntry", "reviewEntry"]);
    assert.deepEqual(Object.keys(actual.subscriptions), ["onCreateEntry", "onDeleteEntry"]);
    for (const kind of ["queries", "mutations", "subscriptions"]) {
      for (const [field, value] of Object.entries(actual[kind])) {
        const document = typeof value === "string" ? value : value.graphql;
        assert.deepEqual(validate(schema, parse(document)), [], `${kind}.${field} must validate`);
        if (typeof value !== "string") assert.equal(value.fieldName, field);
      }
    }
    const get = actual.queries.getEntry;
    const getText = typeof get === "string" ? get : get.graphql;
    assert.match(getText, /visibility/);
    assert.match(getText, /notes/);
    if (scenario.options.maxDepth >= 3) assert.match(getText, /author\s*\{\s*id\s+displayName\s+tags/);
    if (scenario.options.typenameIntrospection === false) assert.ok(!getText.includes("__typename"));
  });
}
