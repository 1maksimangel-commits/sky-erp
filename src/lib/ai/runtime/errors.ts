/**
 * SKY Runtime errors — typed failures for the AI organization control plane.
 */

export class RuntimeError extends Error {
  readonly name = "RuntimeError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a Runtime API method requires a module or capability
 * that is not yet available in this repository layer.
 */
export class NotImplementedError extends Error {
  readonly name = "NotImplementedError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
