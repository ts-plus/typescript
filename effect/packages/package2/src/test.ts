import { Effect, T } from "@tsplus-test/package1/prelude.js"

pipe(
  Effect(1),
  T.chain((n) => Effect(n + 1))
)