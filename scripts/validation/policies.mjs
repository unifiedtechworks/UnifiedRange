// Parameterized REVIEW templates, not a complete bootstrap or deployable policy.
// No AWS calls. Provisioning must remain disabled until role selection and the
// generated resource namespace have been demonstrated and reviewed.
export function policies({ account, region, prefix, serviceRoleArn, deploymentRoleArn, executionRoleArn, boundaryArn, runtimeRoleArns, stackArns, resourceArns }) {
  if (!/^\d{12}$/.test(account ?? '') || region !== 'us-west-2' || !/^ur-validation-[a-z0-9-]+$/.test(prefix ?? '')) throw new Error('POLICY_PARAMETERS');
  const rolePrefix = `arn:aws:iam::${account}:role/${prefix}/`;
  for (const arn of [serviceRoleArn, deploymentRoleArn, executionRoleArn, ...runtimeRoleArns]) if (!arn.startsWith(rolePrefix) || arn.includes('*')) throw new Error('ROLE_SCOPE');
  if (boundaryArn !== `arn:aws:iam::${account}:policy/${prefix}/runtime-boundary`) throw new Error('BOUNDARY_SCOPE');
  if (!stackArns.length || !resourceArns.length || !runtimeRoleArns.length) throw new Error('RESOURCE_SCOPE_REQUIRED');
  for (const arn of [...stackArns, ...resourceArns]) if (!arn.includes(`:${region}:${account}:`) || !arn.includes(prefix) || arn.includes('*')) throw new Error('RESOURCE_SCOPE');
  const policy = Statement => ({ Version: '2012-10-17', Statement });
  const allow = (Action, Resource, Condition) => ({ Effect: 'Allow', Action, Resource, ...(Condition ? { Condition } : {}) });
  const deny = (Action, Resource, Condition) => ({ Effect: 'Deny', Action, Resource, ...(Condition ? { Condition } : {}) });
  const boundaryCondition = { StringEquals: { 'iam:PermissionsBoundary': boundaryArn } };
  const runtimeBoundary = policy([
    allow(['logs:CreateLogStream', 'logs:PutLogEvents', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem'], resourceArns),
    deny(['iam:*', 'sts:AssumeRole', 'organizations:*', 'account:*'], '*'),
  ]);
  return {
    status: 'INCOMPLETE_NOT_FOR_PROVISIONING',
    serviceTrust: policy([{ Effect: 'Allow', Principal: { Service: 'amplify.amazonaws.com' }, Action: 'sts:AssumeRole', Condition: { StringEquals: { 'aws:SourceAccount': account }, ArnLike: { 'aws:SourceArn': `arn:aws:amplify:${region}:${account}:apps/REVIEWED_APP_ID` } } }]),
    deploymentTrust: policy([{ Effect: 'Allow', Principal: { AWS: serviceRoleArn }, Action: 'sts:AssumeRole' }]),
    executionTrust: policy([{ Effect: 'Allow', Principal: { Service: 'cloudformation.amazonaws.com' }, Action: 'sts:AssumeRole' }]),
    servicePolicy: policy([allow('sts:AssumeRole', deploymentRoleArn)]),
    deploymentPolicy: policy([
      allow(['cloudformation:CreateStack', 'cloudformation:UpdateStack', 'cloudformation:DeleteStack', 'cloudformation:DescribeStacks', 'cloudformation:DescribeStackEvents', 'cloudformation:ListStackResources', 'cloudformation:ContinueUpdateRollback', 'cloudformation:RollbackStack'], stackArns),
      allow('iam:PassRole', executionRoleArn, { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } }),
    ]),
    executionIamPolicy: policy([
      allow('iam:CreateRole', runtimeRoleArns, boundaryCondition),
      allow(['iam:GetRole', 'iam:GetRolePolicy', 'iam:ListRolePolicies', 'iam:ListAttachedRolePolicies', 'iam:PutRolePolicy', 'iam:DeleteRolePolicy', 'iam:DeleteRole', 'iam:TagRole', 'iam:UntagRole'], runtimeRoleArns),
      allow('iam:PassRole', runtimeRoleArns, { StringEquals: { 'iam:PassedToService': ['lambda.amazonaws.com', 'appsync.amazonaws.com'] } }),
      deny(['iam:DeleteRolePermissionsBoundary', 'iam:PutRolePermissionsBoundary', 'iam:AttachRolePolicy', 'iam:UpdateAssumeRolePolicy'], '*'),
      deny(['iam:CreatePolicy', 'iam:CreatePolicyVersion', 'iam:SetDefaultPolicyVersion', 'iam:DeletePolicyVersion', 'iam:DeletePolicy', 'sts:AssumeRole'], '*'),
    ]),
    runtimeBoundary,
  };
}
