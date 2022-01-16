import { Either } from "@tsplus/stdlib/data/Either"

declare const either: Either<string, number>

if (either.isLeft()) {
    const x: string = either.left
    console.log(x)
}

if (either.isRight()) {
    const x: number = either.right
    console.log(x)
}