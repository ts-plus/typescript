export function dependentArg_<A, B extends A>(self: A, b: B) {
    return b
}

export const dependentArg = Pipeable(dependentArg_)