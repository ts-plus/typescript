import { Arr, Chunk } from "./companion.js";

/**
 * @tsplus static ChunkOps empty
 */
export function empty<A>(): Chunk<A> {
  return new Arr();
}

/**
 * @tsplus fluent Chunk append
 */
export function append_<A, B>(self: Chunk<A>, a: B): Chunk<A | B> {
  return new Arr();
}

export function f<A>() {
  const a = Chunk.empty<A>();
  return a.append(1);
}

const x = f<number>().append("1");
