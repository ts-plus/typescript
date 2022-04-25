/* eslint-disable */

export const a = Either.right({ xxx: 0 }) |> Either.$.map((x) => x.xxx)