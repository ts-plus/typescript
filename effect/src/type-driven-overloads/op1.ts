import { T } from './T.js'

/**
 * @tsplus fluent T op
 */
export function op1 <A>(_self: T<A>, x: string): T<string> {
  return { value: x }
}