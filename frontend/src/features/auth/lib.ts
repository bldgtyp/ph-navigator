import { ApiRequestError } from "../../shared/api/client";

export function isAuthFailure(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}
