/**
 * @tsplus type Chunk
 * @tsplus companion ChunkOps
 */
export abstract class Chunk<A> {
  readonly _A!: () => A;
}

export class Arr<A> extends Chunk<A> {}
