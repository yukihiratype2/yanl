export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; status: number; error: string; details?: Record<string, any> };
export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(status: number, error: string, details?: Record<string, any>): Err {
  return { ok: false, status, error, details };
}
