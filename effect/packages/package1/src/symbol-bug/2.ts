import { Hash } from "./1";

/**
 * @tsplus type symbolBug/X
 * @tsplus companion symbolBug/XOps
 */
export class X implements Hash {
  get [Hash.hashSym]() {
    return 0;
  }
}
