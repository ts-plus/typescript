import { LazyArgument } from "./utils/LazyArgument"

/**
 * @tsplus type Chunk
 */
export interface Chunk<A> {
    _: () => A
}

/**
 * @tsplus type ChunkOps
 */
export interface ChunkOps { }
export const Chunk: ChunkOps = {}

/**
 * @tsplus operator Chunk +
 */
export declare function add<A, A1>(self: Chunk<A>, that: LazyArgument<Chunk<A1>>): Chunk<A | A1>

/**
 * @tsplus static ChunkOps __call
 */
export declare function make<As extends any[]>(...as: As): Chunk<As[number]>


let x = Chunk(0)
x = x + Chunk(1, 2)