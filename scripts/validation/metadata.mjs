import { requireCheck } from './guard.mjs';

// call(service, operation, arguments) is a read-only transport supplied by the caller.
// Tests use synthetic replies; no credentials or transport are embedded here.
export async function collectMetadata(expected, call) {
  const branch = await call('amplify', 'get-branch', { appId: expected.appId, branchName: expected.branch });
  const root = branch.branch.backend?.stackArn;
  requireCheck(root === expected.rootStackArn, 'ROOT_LINK');
  const ownedResources = [];
  const seen = new Set();
  let rootStack;
  async function visit(id, parent) {
    requireCheck(!seen.has(id) && seen.size < 100, 'STACK_GRAPH_LIMIT');
    seen.add(id);
    const result = await call('cloudformation', 'describe-stacks', { stackName: id });
    const stack = result.Stacks?.[0];
    requireCheck(stack?.StackId === id, 'STACK_ID');
    if (parent) requireCheck(stack.ParentId === parent && stack.RootId === root, 'STACK_ANCESTRY');
    else { requireCheck(!stack.ParentId, 'ROOT_PARENT'); rootStack = stack; }
    let nextToken;
    const tokens = new Set();
    do {
      const page = await call('cloudformation', 'list-stack-resources', { stackName: id, ...(nextToken ? { nextToken } : {}) });
      requireCheck(Array.isArray(page.StackResourceSummaries), 'STACK_RESOURCES');
      for (const item of page.StackResourceSummaries) {
        requireCheck(!['DELETE_COMPLETE', 'DELETE_IN_PROGRESS', 'DELETE_FAILED'].includes(item.ResourceStatus), 'DELETED_RESOURCE');
        if (item.ResourceType === 'AWS::CloudFormation::Stack') await visit(item.PhysicalResourceId, id);
        else ownedResources.push({ type: item.ResourceType, id: item.PhysicalResourceId });
      }
      nextToken = page.NextToken;
      requireCheck(!nextToken || (!tokens.has(nextToken) && tokens.size < 100), 'PAGINATION_LIMIT');
      tokens.add(nextToken);
    } while (nextToken);
  }
  await visit(root);
  const r = expected.resources;
  const pool = await call('cognito-idp', 'describe-user-pool', { userPoolId: r.userPool });
  const client = await call('cognito-idp', 'describe-user-pool-client', { userPoolId: r.userPool, clientId: r.userPoolClient });
  const identity = await call('cognito-identity', 'describe-identity-pool', { identityPoolId: r.identityPool });
  const api = await call('appsync', 'get-graphql-api', { apiId: r.apiId });
  const bucket = await call('s3api', 'get-bucket-location', { bucket: r.bucket, expectedBucketOwner: expected.account });
  return {
    linkedRoot: root, rootArn: rootStack.StackId, rootParent: rootStack.ParentId,
    tags: Object.fromEntries((rootStack.Tags ?? []).map(t => [t.Key, t.Value])), ownedResources,
    userPoolArn: pool.UserPool.Arn, clientPool: client.UserPoolClient.UserPoolId, clientId: client.UserPoolClient.ClientId,
    identityId: identity.IdentityPoolId, identityProviders: identity.CognitoIdentityProviders,
    apiArn: api.graphqlApi.arn, apiUrl: api.graphqlApi.uris.GRAPHQL,
    bucketRegion: bucket.LocationConstraint ?? 'us-east-1', bucketOwnerVerified: true,
  };
}
