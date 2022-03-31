import { Show } from "./show"
import { Derive } from "./types"
import { } from "./guard"

//
// Usage
//

export interface Person {
    tag: "Person"
    gender: "M" | "F" | "NB" | "NA"
    name: string
    surname: string
    age: Maybe<number>
    birthDate?: Date
    bestFriend: Maybe<Person>
    friends: Person[]
    isUkResident: boolean
}

export interface User {
    id: string
    owner: Person
}

/**
 * @tsplus implicit
 */
export const showPerson = Derive<Show<User>>()
