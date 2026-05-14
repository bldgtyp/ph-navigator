import { ApiRequestError } from "../api/client";

export function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (error instanceof ApiRequestError && error.requestId) {
    return `${message} (Request ID: ${error.requestId})`;
  }
  return message;
}
