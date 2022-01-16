export type Cont<in out K, in out V, out A> =
  | [
      len: number,
      children: [K, V][],
      i: number,
      f: (node: readonly [K, V]) => A,
      cont: Cont<K, V, A>,
    ]
  | undefined;