declare const x: unknown

Effect.die(x)

Ref.make<HashMap<string, number>>(HashMap.empty())

Ref.make<(_: number) => Effect<unknown, never, void>>((_) => Effect.unit)