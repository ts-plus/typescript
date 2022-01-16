import { Brand } from "./brand";
import {} from "@tsplus-test/package1/hello"

export type Int = number & Brand<"Int">

/**
 * @tsplus implicit
 */
export const validateInt = Brand.validator<number, "Int">(
    (n) => Number.isInteger(n)
)

export const x = Derive<"Hello">()