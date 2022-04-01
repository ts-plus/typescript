import { Show } from "./show"
import { Derive } from "./types"
import { } from "./guard"

//
// Usage
//

export interface Business {
    readonly _tag: "Business"
}

export interface Personal {
    readonly _tag: "Personal"
}

export type ClientType = Business | Personal

export interface Person {
    readonly tag: "Person"
    readonly gender: "M" | "F" | "NB" | "NA"
    readonly name: string
    readonly surname: string
    readonly age: Maybe<number>
    readonly birthDate?: Date
    readonly bestFriend: Maybe<Person>
    readonly friends: Person[]
    readonly isUkResident: boolean
}

export interface User {
    readonly id: string
    readonly owner: Person
    readonly clientType: ClientType
}

/**
 * @tsplus implicit
 */
export const showPerson = Derive<Show<User>>()

interface Ok {
    t: {
        c: [0, 1]
    } & {
        a: 0
        b: 0
    }
    z: {} & {}
    a: Show<{
        x: [0]
    }>
}

export const ok: Ok = Derive()
