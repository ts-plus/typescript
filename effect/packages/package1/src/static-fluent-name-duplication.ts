/**
 * @tsplus type static-fluent-name-duplication/A
 * @tsplus companion static-fluent-name-duplication/AOps
 */
export class A {}

/**
 * @tsplus fluent static-fluent-name-duplication/A f
 */
export function fluentMethod(self: A, _x: number): A {
  return self;
}

/**
 * @tsplus static static-fluent-name-duplication/AOps f
 */
export function staticMethod(_y: string): A {
  return new A();
}

A.f("hello");

new A().f(1);