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
export const showPerson: Show<Person> = Derive()

/**
 * @tsplus implicit
 */
export const showUser: Show<User> = Derive()
