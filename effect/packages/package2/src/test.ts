import { Effect, T, chain, chainPipeable } from "@tsplus-test/package1/prelude";
import * as EffectModule from "@tsplus-test/package1/prelude";

const a = pipe(
  Effect(1),
  T.chain((n) => Effect(n + 1)),
  chain((n) => Effect(n + 1)),
  EffectModule.chain((n) => Effect(n + 1))
)

const b = T.chain((n: number) => Effect(n + 1))(Effect(1));

const c = chain((n: number) => Effect(n + 1))(Effect(1));

const d = chainPipeable((n: number) => Effect(n + 1))(Effect(1));

Effect(0).chainPipeable(n => Effect(n + 1))

a.unsafeRunPromise().then((x) => console.log(x))
b.unsafeRunPromise().then((x) => console.log(x))
c.unsafeRunPromise().then((x) => console.log(x))
d.unsafeRunPromise().then((x) => console.log(x))

