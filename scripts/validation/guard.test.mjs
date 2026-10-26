import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { APPLICATION_SHA, APP_NAME, BRANCH, checkTarget, checkOutputs, clearBuildArtifacts, loadOutputs, validationSequence } from './guard.mjs';
import { policies } from './policies.mjs';
import { collectMetadata } from './metadata.mjs';

function fixture() {
  const account = '000000000000', region = 'us-west-2';
  const root = `arn:aws:cloudformation:${region}:${account}:stack/validation/root`;
  const resources = { userPool: 'pool', userPoolClient: 'client', identityPool: 'identity', apiId: 'api', bucket: 'bucket' };
  const expected = { account, region, appId: 'newapp', appName: APP_NAME, branch: BRANCH, applicationSha: APPLICATION_SHA, toolingSha: 'a'.repeat(40), forbiddenAppIds: ['liveapp'], rootStackArn: root, resources };
  const target = { account, region, appId: expected.appId, appName: APP_NAME, appArn: `arn:aws:amplify:${region}:${account}:apps/newapp`, branch: BRANCH, commit: expected.toolingSha, buildAppId: expected.appId, buildBranch: BRANCH, autoBuild: false, autoBranches: false, previews: false, basicAuth: true };
  const outputs = { auth: { aws_region: region, user_pool_id: 'pool', user_pool_client_id: 'client', identity_pool_id: 'identity' }, data: { aws_region: region, url: 'https://example.invalid/graphql' }, storage: { aws_region: region, bucket_name: 'bucket' } };
  const types = ['AWS::Cognito::UserPool', 'AWS::Cognito::UserPoolClient', 'AWS::Cognito::IdentityPool', 'AWS::AppSync::GraphQLApi', 'AWS::S3::Bucket'];
  const metadata = { linkedRoot: root, rootArn: root, tags: { 'amplify:app-id': 'newapp', 'amplify:branch-name': BRANCH, 'amplify:deployment-type': 'branch' }, ownedResources: Object.values(resources).map((id, i) => ({ id, type: types[i] })), userPoolArn: `arn:aws:cognito-idp:${region}:${account}:userpool/pool`, clientPool: 'pool', clientId: 'client', identityId: 'identity', identityProviders: [{ ClientId: 'client', ProviderName: `cognito-idp.${region}.amazonaws.com/pool` }], apiArn: `arn:aws:appsync:${region}:${account}:apis/api`, apiUrl: outputs.data.url, bucketRegion: region, bucketOwnerVerified: true };
  return { expected, target, outputs, metadata };
}
test('isolated outputs and target pass', () => { const f = fixture(); checkTarget(f.expected, f.target); checkOutputs(f.expected, f.outputs, f.metadata); });
for (const key of ['account', 'region', 'appId', 'branch', 'commit', 'buildAppId', 'buildBranch']) test(`wrong ${key} rejected`, () => { const f = fixture(); f.target[key] = 'wrong'; assert.throws(() => checkTarget(f.expected, f.target)); });
for (const key of ['account', 'appId', 'toolingSha', 'forbiddenAppIds']) test(`missing expected ${key}`, () => { const f = fixture(); delete f.expected[key]; assert.throws(() => checkTarget(f.expected, f.target)); });
for (const source of ['live', 'sandbox', 'unrelated-same-region']) for (const [section, key] of [['auth', 'user_pool_id'], ['auth', 'user_pool_client_id'], ['auth', 'identity_pool_id'], ['data', 'url'], ['storage', 'bucket_name']]) test(`${source} mixed ${key} rejected`, () => { const f = fixture(); f.outputs[section][key] = source; assert.throws(() => checkOutputs(f.expected, f.outputs, f.metadata)); });
for (const key of ['linkedRoot', 'rootArn', 'ownedResources', 'identityProviders', 'bucketOwnerVerified', 'clientPool', 'apiArn']) test(`bad metadata ${key}`, () => { const f = fixture(); f.metadata[key] = null; assert.throws(() => checkOutputs(f.expected, f.outputs, f.metadata)); });
test('missing expected resource identity fails', () => { const f = fixture(); delete f.expected.resources; assert.throws(() => checkOutputs(f.expected, f.outputs, f.metadata)); });
test('missing, malformed, and stale files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ur-guard-'));
  try {
    await assert.rejects(loadOutputs(dir));
    await writeFile(join(dir, 'amplify_outputs.json'), 'malformed secret'); await assert.rejects(loadOutputs(dir));
    await mkdir(join(dir, '.next')); await writeFile(join(dir, '.next', 'stale'), 'secret');
    await clearBuildArtifacts(dir); await assert.rejects(loadOutputs(dir));
    await assert.rejects(import('node:fs/promises').then(fs => fs.stat(join(dir, '.next'))));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
for (const failure of [null, 'target', 'install', 'deploy', 'generate', 'metadata', 'frontend']) test(`sequence ${failure ?? 'success'} blocks and redacts`, async () => {
  const f = fixture(), calls = [], logs = [];
  const values = { target: f.target, outputs: f.outputs, metadata: f.metadata };
  const io = Object.fromEntries(['target', 'clear', 'install', 'deploy', 'generate', 'outputs', 'metadata', 'frontend', 'publish'].map(name => [name, async () => { calls.push(name); if (name === failure) throw new Error('TOKEN_PRIVATE_OBJECT_API_KEY'); return values[name]; }]));
  io.log = value => logs.push(value);
  assert.equal(await validationSequence(f.expected, io), failure ? 1 : 0);
  assert.equal(calls.includes('publish'), !failure);
  if (['target', 'install', 'deploy', 'generate', 'metadata'].includes(failure)) assert.equal(calls.includes('frontend'), false);
  assert.deepEqual(logs, [failure ? 'VALIDATION_BLOCKED' : 'VALIDATION_OK']);
  if (!failure) assert.ok(calls.indexOf('generate') > calls.indexOf('deploy'));
});
test('real entry point unconditionally blocks', () => { const result = spawnSync(process.execPath, ['scripts/validation/run.mjs'], { encoding: 'utf8' }); assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.match(result.stderr, /^VALIDATION_BLOCKED: PERMISSION_CHAIN_UNRESOLVED\s*$/); });
test('metadata reader rejects unlinked backend before other calls', async () => { const f = fixture(); let calls = 0; await assert.rejects(collectMetadata(f.expected, async () => { calls++; return { branch: { backend: { stackArn: 'wrong' } } }; })); assert.equal(calls, 1); });
for (const badAncestry of [false, true]) test(`metadata traverses authoritative nested stacks: bad ancestry=${badAncestry}`, async () => {
  const f = fixture(), root = f.expected.rootStackArn, child = root + '-child';
  const call = async (service, operation, args) => {
    if (operation === 'get-branch') return { branch: { backend: { stackArn: root } } };
    if (operation === 'describe-stacks') return { Stacks: [{ StackId: args.stackName, ...(args.stackName === child ? { ParentId: badAncestry ? 'unrelated' : root, RootId: root } : {}), Tags: Object.entries(f.metadata.tags).map(([Key, Value]) => ({ Key, Value })) }] };
    if (operation === 'list-stack-resources') return { StackResourceSummaries: args.stackName === root ? [{ ResourceType: 'AWS::CloudFormation::Stack', PhysicalResourceId: child }] : f.metadata.ownedResources.map(r => ({ ResourceType: r.type, PhysicalResourceId: r.id, ResourceStatus: 'CREATE_COMPLETE' })) };
    if (operation === 'describe-user-pool') return { UserPool: { Arn: f.metadata.userPoolArn } };
    if (operation === 'describe-user-pool-client') return { UserPoolClient: { UserPoolId: 'pool', ClientId: 'client' } };
    if (operation === 'describe-identity-pool') return { IdentityPoolId: 'identity', CognitoIdentityProviders: f.metadata.identityProviders };
    if (operation === 'get-graphql-api') return { graphqlApi: { arn: f.metadata.apiArn, uris: { GRAPHQL: f.metadata.apiUrl } } };
    if (operation === 'get-bucket-location') { assert.equal(args.expectedBucketOwner, f.expected.account); return { LocationConstraint: 'us-west-2' }; }
    throw new Error('Unexpected call');
  };
  if (badAncestry) await assert.rejects(collectMetadata(f.expected, call));
  else checkOutputs(f.expected, f.outputs, await collectMetadata(f.expected, call));
});
test('policy syntax, role scopes, boundary enforcement and no allow wildcard', () => {
  const account = '000000000000', prefix = 'ur-validation-test';
  const role = name => `arn:aws:iam::${account}:role/${prefix}/${name}`;
  const params = { account, prefix, region: 'us-west-2', serviceRoleArn: role('service'), deploymentRoleArn: role('deploy'), executionRoleArn: role('execute'), boundaryArn: `arn:aws:iam::${account}:policy/${prefix}/runtime-boundary`, runtimeRoleArns: [role('runtime')], stackArns: [`arn:aws:cloudformation:us-west-2:${account}:stack/${prefix}/id`], resourceArns: [`arn:aws:dynamodb:us-west-2:${account}:table/${prefix}`] };
  const result = JSON.parse(JSON.stringify(policies(params)));
  assert.equal(result.status, 'INCOMPLETE_NOT_FOR_PROVISIONING');
  for (const policy of Object.values(result).filter(p => p.Statement)) for (const statement of policy.Statement) if (statement.Effect === 'Allow' && statement.Resource) assert.ok(!JSON.stringify(statement.Resource).includes('*'));
  assert.equal(result.executionIamPolicy.Statement[0].Condition.StringEquals['iam:PermissionsBoundary'], params.boundaryArn);
  assert.throws(() => policies({ ...params, executionRoleArn: 'arn:aws:iam::000000000000:role/live' }));
  assert.throws(() => policies({ ...params, resourceArns: ['*'] }));
});
