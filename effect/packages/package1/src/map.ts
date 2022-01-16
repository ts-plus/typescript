import { Maybe } from "./prelude"

/**
 * @tsplus type HashMap
 */
export interface HashMap<K, V> {
    readonly _K: () => K
    readonly _V: () => V
}

/**
 * @tsplus index HashMap 
 */
export declare function get<K, V>(self: HashMap<K, V>, index: Key): Maybe<V>

export interface Key {
    k: string
}

export declare function key(s: string): Key

export declare const myMap: HashMap<Key, string>


const ok = myMap[key("ok")].value