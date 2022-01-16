import { Show } from "./show"

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

/**
 * @tsplus implicit
 */
export const showClientType: Show<ClientType> = Derive()

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

/**
 * @tsplus implicit
 */
export const showPerson: Show<Person> = Derive()

export interface User {
    readonly id: string
    readonly owner: Person
    readonly clientType: ClientType
}

/**
 * @tsplus implicit
 */
export const showUser: Show<User> = Derive()

export interface WeirdPropertyNames {
    readonly ["."]: number
    readonly ["2"]: string
}

export const showWeirdPropertyNames: Show<WeirdPropertyNames> = Derive()