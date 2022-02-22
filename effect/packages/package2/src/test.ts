import { Effect, chain } from "@tsplus-test/package1/prelude.js"

pipe(
  Effect(1),
  chain((n) => Effect(n + 1))
)