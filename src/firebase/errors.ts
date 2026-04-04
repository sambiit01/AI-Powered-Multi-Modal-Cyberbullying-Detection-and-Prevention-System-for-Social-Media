/**
 * @fileOverview Custom error types for Firestore permission issues.
 */

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestorePermissionError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
{
  "operation": "${context.operation}",
  "path": "${context.path}"
  ${context.requestResourceData ? `, "data": ${JSON.stringify(context.requestResourceData, null, 2)}` : ''}
}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
