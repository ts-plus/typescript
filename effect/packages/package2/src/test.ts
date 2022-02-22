import { Effect, T, chain } from "@tsplus-test/package1/prelude.js"

pipe(
  Effect(1),
  T.chain((n) => Effect(n + 1)),
  chain((n) => Effect(n + 1))
)

T.chain((n: number) => Effect(n + 1))(Effect(1));

chain((n: number) => Effect(n + 1))(Effect(1));