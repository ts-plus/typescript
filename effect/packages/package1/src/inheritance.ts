declare global {
  /**
   * @tsplus type Iterable
   */
  export interface Iterable<T> {}
}

/**
 * @tsplus type List
 * @tsplus companion ListOps
 */
export class List<A> implements Iterable<A> {
  constructor(readonly arr: A[]) {}
  [Symbol.iterator] = this.arr[Symbol.iterator]
}

export declare namespace List {}

/**
 * @tsplus type List2
 */
export interface List2<A> extends List<A> {}

function mkList2<A>(arr: A[]): List2<A> {
  return {
    arr,
    [Symbol.iterator]: arr[Symbol.iterator]
  };
}

/**
 * @tsplus fluent Iterable map
 */
export function iterableMap<A, B>(xs: Iterable<A>, f: (a: A) => B): Iterable<B> {
  return {
    *[Symbol.iterator]() {
      for (const a of xs) {
        yield f(a);
      }
    }
  }
}

const l2 = mkList2([1, 2, 3]).map((n) => n.toString())

//

/**
 * @tsplus fluent List mapList
 */
export function mapList_<A, B>(fa: List<A>): List<B> {
  return fa as unknown as List<B>
}

/**
 * @tsplus static ListOps mapList
 */
export function mapList<A>(fa: List2<A>, f: (a: A) => A): List2<A> {
  return fa.mapList()
}

List.mapList(mkList2([1, 2, 3]), (n) => n);