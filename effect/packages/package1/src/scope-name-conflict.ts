/**
 * @tsplus type scope-name-conflict/A
 * @tsplus companion scope-name-conflict/AOps
 */
export class A {
  constructor(readonly conflict: string) {}
}

/**
 * @tsplus static scope-name-conflict/AOps conflict
 */
export function conflict(s: string): A {
  return new A(s)
}

function test() {
  A.x;
  const conflict = "name conflict"
  A.conflict(conflict)
}

/**
 * @tsplus static scope-name-conflict/AOps x
 */
export const x = new A("thing")

conflict('');

export const y = x;

export { conflict as __x }