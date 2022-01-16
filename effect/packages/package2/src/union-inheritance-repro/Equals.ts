export const equalsSym = Symbol()

/**
 * @tsplus type union-inheritance-repro/Equals
 */
export interface Equals {
  [equalsSym](that: unknown): boolean  
}

/**
 * @tsplus fluent union-inheritance-repro/Equals equals
 * @tsplus operator union-inheritance-repro/Equals ==
 */
export function equals<A>(self: A, that: unknown): boolean {
  return self === that
}