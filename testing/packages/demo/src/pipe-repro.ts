//
export const a = Either.right({ xxx: 0 }) / Either.$.map((n) => n.xxx) / Either.$.map((n) => n)
export const c = 0 + 7