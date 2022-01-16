/**
 * @tsplus static HashOps hashSym
 */
export const hashSym: unique symbol = Symbol.for("hash");

/**
 * @tsplus type Hash
 */
export interface Hash {
  [hashSym]: number;
}

/**
 * @tsplus type HashOps
 */
export interface HashOps {}

export const Hash: HashOps = {};
