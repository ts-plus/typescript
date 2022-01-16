/**
 * @tsplus type ets/Promise
 */
export interface Promise {}

/**
 * Retrieves the value of the promise, suspending the fiber running the action
 * until the result is available.
 *
 * @tsplus fluent ets/Promise await
 */
export function _await(): void {}

export { _await as await }