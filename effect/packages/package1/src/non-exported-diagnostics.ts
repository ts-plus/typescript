/**
 * @tsplus fluent TypeName fluent
 */
// @ts-expect-error
function fluent() {}

/**
 * @tsplus static TypeName static
 */
// @ts-expect-error
function staticFn() {}

/**
 * @tsplus operator TypeName operator
 */
// @ts-expect-error
function operator() {}

/**
 * @tsplus index TypeName index
 */
// @ts-expect-error
function index() {}

/**
 * @tsplus unify TypeName unify
 */
// @ts-expect-error
function unify() {}

/**
 * @tsplus pipeable TypeName unify
 */
// @ts-expect-error
function pipeable() {}

/**
 * @tsplus fluent TypeName fluent
 */
// @ts-expect-error
const fluentConst = () => {}

/**
 * @tsplus static TypeName static
 */
// @ts-expect-error
const staticConst = () => {}

/**
 * @tsplus operator TypeName operator
 */
// @ts-expect-error
const operatorConst = () => {}

/**
 * @tsplus index TypeName index
 */
// @ts-expect-error
const indexConst = () => {}

/**
 * @tsplus unify TypeName unify
 */
// @ts-expect-error
const unifyConst = () => {}

/**
 * @tsplus pipeable TypeName unify
 */
// @ts-expect-error
const pipeableConst = () => {}

/**
 * @tsplus type Type
 */
// @ts-expect-error
interface Type {}

/**
 * @tsplus type Alias
 */
// @ts-expect-error
type Alias = {};

/**
 * @tsplus companion Type
 */
// @ts-expect-error
class Companion {}

/**
 * @tsplus type Type
 */
// @ts-expect-error
class ClassType {}
