import { Async } from '@fp-ts/core/Async'
import { Sync } from '@fp-ts/core/Sync'

Async.fromSync(() => console.log("Fluent in fp-ts!")).delay(1)

Sync.of(1).map((n) => n + 1)
