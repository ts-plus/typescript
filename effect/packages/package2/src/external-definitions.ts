import { Async } from '@fp-ts/core/Async'

Async.fromSync(() => console.log("Fluent in fp-ts!")).delay(1)

