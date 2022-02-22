import { Effect, T, chain, chainPipeable } from "@tsplus-test/package1/prelude.js"

pipe(
  Effect(1),
  T.chain((n) => Effect(n + 1)),
  chain((n) => Effect(n + 1))
)

T.chain((n: number) => Effect(n + 1))(Effect(1));

chain((n: number) => Effect(n + 1))(Effect(1));

chainPipeable((n: number) => Effect(n + 1))(Effect(1));