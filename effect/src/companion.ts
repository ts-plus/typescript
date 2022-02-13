/**
 * @tsplus type A
 * @tsplus companion AOps
 */
export class A {}

/**
 * @tsplus static AOps static
 */
export function staticFn(): number {
  return 1;
}

/**
 * @tsplus getter A getter
 */
export function getterFn(): number {
  return 1;
}

/**
 * @tsplus fluent A fn
 */
export function fluentFn(self: A): number {
  return 1;
}

A.static();

new A().fn();

const aInstance = new A();

aInstance.fn();

aInstance.getter;