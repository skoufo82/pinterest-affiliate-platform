// Shared response utilities for Lambda functions

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

export function successResponse(statusCode: number, body: unknown, cacheControl?: string) {
  const headers: Record<string, string | boolean> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  };

  // Add Cache-Control header if provided
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown
) {
  const errorObj: ErrorResponse['error'] = {
    code,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  };
  
  if (details !== undefined) {
    errorObj.details = details;
  }
  
  const response: ErrorResponse = {
    error: errorObj,
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
}
