/* eslint-disable */

export const a = Either.right({ xxx: 0 }) / Either.$.map((n) => n.xxx) / Either.$.map((n) => n + 1) / Either.$.map((n) => `hello: ${n}`) / Either.$.map((s) => s.length)