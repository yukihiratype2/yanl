export function getErrorMessage(
  error: unknown,
  fallback = "Unexpected error"
): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  if (typeof error === "object" && error !== null && "name" in error) {
    return error.name === "AbortError";
  }

  return false;
}
