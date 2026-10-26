// Intentionally no deployment command or enable flag. Installed Amplify cannot
// yet select the reviewed restricted role chain. This entry point fails closed.
console.error('VALIDATION_BLOCKED: PERMISSION_CHAIN_UNRESOLVED');
process.exitCode = 2;
