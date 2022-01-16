export type Cont<K, V, A> =
  | [
      len: number,
      children: [K, V][],
      i: number,
      f: (node: readonly [K, V]) => A,
      cont: Cont<K, V, A>,
    ]
  | undefined;