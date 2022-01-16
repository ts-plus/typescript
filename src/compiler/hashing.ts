namespace hashing {
    // forked from https://github.com/frptools

    // Copyright 2014 Thom Chiovoloni, released under the MIT license.

    /// A random number generator based on the basic implementation of the PCG algorithm,
    /// as described here: http://www.pcg-random.org/

    // Adapted for TypeScript from Thom's original code at https://github.com/thomcc/pcg-random

    export function isDefined<T>(value: T | undefined): value is T {
        return value !== void 0;
    }

    export function isIterable(value: object): value is Iterable<unknown> {
        return Symbol.iterator in <any>value;
    }

    export function isPlainObject(value: any) {
        return value.constructor === Object || value.constructor == null;
    }

    export function isPromiseLike(value: any) {
        return !!value && typeof value.then === "function";
    }

    export function isReactElement(value: any) {
        return !!(value && value.$$typeof);
    }

    export function isNothing<T>(value: T | null | undefined) {
        return value === void 0 || value === null;
    }

    const defaultIncHi = 0x14057b7e;
    const defaultIncLo = 0xf767814f;
    const MUL_HI = 0x5851f42d >>> 0;
    const MUL_LO = 0x4c957f2d >>> 0;
    const BIT_53 = 9007199254740992.0;
    const BIT_27 = 134217728.0;

    export type PCGRandomState = [number, number, number, number];
    export type OptionalNumber = number | null | undefined;

    export class RandomPCG {
        private _state: Int32Array;
        constructor(seed?: OptionalNumber);
        constructor(seedHi: OptionalNumber, seedLo: OptionalNumber, inc?: OptionalNumber);
        constructor(
            seedHi: OptionalNumber,
            seedLo: OptionalNumber,
            incHi: OptionalNumber,
            incLo: OptionalNumber
        );
        constructor(
            seedHi?: OptionalNumber,
            seedLo?: OptionalNumber,
            incHi?: OptionalNumber,
            incLo?: OptionalNumber
        ) {
            if (isNothing(seedLo) && isNothing(seedHi)) {
                seedLo = (Math.random() * 0xffffffff) >>> 0;
                seedHi = 0;
            } else if (isNothing(seedLo)) {
                seedLo = seedHi;
                seedHi = 0;
            }
            if (isNothing(incLo) && isNothing(incHi)) {
                // @ts-expect-error
                incLo = this._state ? this._state[3] : defaultIncLo;
                // @ts-expect-error
                incHi = this._state ? this._state[2] : defaultIncHi;
            } else if (isNothing(incLo)) {
                incLo = <number>incHi;
                incHi = 0;
            }

            this._state = new Int32Array([
                0,
                0,
                (<number>incHi) >>> 0,
                ((incLo || 0) | 1) >>> 0
            ]);
            this._next();
            add64(
                this._state,
                this._state[0]!,
                this._state[1]!,
                (<number>seedHi) >>> 0,
                (<number>seedLo) >>> 0
            );
            this._next();
            return this;
        }

        getState(): PCGRandomState {
            return [this._state[0]!, this._state[1]!, this._state[2]!, this._state[3]!];
        }

        setState(state: PCGRandomState) {
            this._state[0] = state[0];
            this._state[1] = state[1];
            this._state[2] = state[2];
            this._state[3] = state[3] | 1;
        }

        private _next() {
            const oldHi = this._state[0]! >>> 0;
            const oldLo = this._state[1]! >>> 0;

            mul64(this._state, oldHi, oldLo, MUL_HI, MUL_LO);
            add64(
                this._state,
                this._state[0]!,
                this._state[1]!,
                this._state[2]!,
                this._state[3]!
            );

            let xsHi = oldHi >>> 18;
            let xsLo = ((oldLo >>> 18) | (oldHi << 14)) >>> 0;
            xsHi = (xsHi ^ oldHi) >>> 0;
            xsLo = (xsLo ^ oldLo) >>> 0;
            const xorshifted = ((xsLo >>> 27) | (xsHi << 5)) >>> 0;
            const rot = oldHi >>> 27;
            const rot2 = ((-rot >>> 0) & 31) >>> 0;
            return ((xorshifted >>> rot) | (xorshifted << rot2)) >>> 0;
        }

        integer(max: number) {
            if (!max) {
                return this._next();
            }
            max = max >>> 0;
            if ((max & (max - 1)) === 0) {
                return this._next() & (max - 1);
            }

            let num = 0;
            const skew = (-max >>> 0) % max >>> 0;
            for (num = this._next(); num < skew; num = this._next()) {
                //
            }
            return num % max;
        }

        number() {
            const hi = (this._next() & 0x03ffffff) * 1.0;
            const lo = (this._next() & 0x07ffffff) * 1.0;
            return (hi * BIT_27 + lo) / BIT_53;
        }
    }

    function mul64(
        out: Int32Array,
        aHi: number,
        aLo: number,
        bHi: number,
        bLo: number
    ): void {
        let c1 = ((aLo >>> 16) * (bLo & 0xffff)) >>> 0;
        let c0 = ((aLo & 0xffff) * (bLo >>> 16)) >>> 0;

        let lo = ((aLo & 0xffff) * (bLo & 0xffff)) >>> 0;
        let hi = ((aLo >>> 16) * (bLo >>> 16) + ((c0 >>> 16) + (c1 >>> 16))) >>> 0;

        c0 = (c0 << 16) >>> 0;
        lo = (lo + c0) >>> 0;
        if (lo >>> 0 < c0 >>> 0) {
            hi = (hi + 1) >>> 0;
        }

        c1 = (c1 << 16) >>> 0;
        lo = (lo + c1) >>> 0;
        if (lo >>> 0 < c1 >>> 0) {
            hi = (hi + 1) >>> 0;
        }

        hi = (hi + Math.imul(aLo, bHi)) >>> 0;
        hi = (hi + Math.imul(aHi, bLo)) >>> 0;

        out[0] = hi;
        out[1] = lo;
    }

    function add64(
        out: Int32Array,
        aHi: number,
        aLo: number,
        bHi: number,
        bLo: number
    ): void {
        let hi = (aHi + bHi) >>> 0;
        const lo = (aLo + bLo) >>> 0;
        if (lo >>> 0 < aLo >>> 0) {
            hi = (hi + 1) | 0;
        }
        out[0] = hi;
        out[1] = lo;
    }

    export interface HashOps {
        readonly sym: unique symbol;
    }

    export const Hash: HashOps = {
        sym: Symbol.for("tsplus-compiler/Hash") as HashOps["sym"]
    };

    export interface Hash {
        [Hash.sym](this: this): number;
    }

    export function isHash(u: unknown): u is Hash {
        return typeof u === "object" && u !== null && Hash.sym in u;
    }

    export function optimize(n: number) {
        return (n & 0xbfffffff) | ((n >>> 1) & 0x40000000);
    }

    export function hashUnknown(arg: unknown): number {
        return optimize(_hash(arg));
    }

    export function hashArray(arr: readonly unknown[]): number {
        return optimize(_hashArray(arr));
    }

    export function hashArgs(...args: unknown[]): number;
    export function hashArgs(): number {
        let h = 5381;
        for (let i = 0; i < arguments.length; i++) {
            // eslint-disable-next-line prefer-rest-params
            h = _combineHash(h, hashUnknown(arguments[i]));
        }
        return optimize(h);
    }

    export function combine(a: number, b: number): number {
        return optimize(_combineHash(a, b));
    }

    export function hashObject(value: object): number {
        return optimize(_hashObject(value));
    }

    export function hashMiscRef(o: Object): number {
        return optimize(_hashMiscRef(o));
    }

    export function hashIterator(it: Iterator<any>): number {
        return optimize(_hashIterator(it));
    }

    export function hashPlainObject(o: object): number {
        return optimize(_hashPlainObject(o));
    }

    export function hashNumber(n: number): number {
        return optimize(_hashNumber(n));
    }

    export function hashString(str: string): number {
        return optimize(_hashString(str));
    }

    export function hashRandom(): number {
        return optimize(randomInt());
    }

    function isZero(value: any): boolean {
        return value === null || value === void 0 || value === false;
    }

    const RANDOM = new RandomPCG((Math.random() * 4294967296) >>> 0);
    const CACHE = new WeakMap<Object, number>();

    function randomInt() {
        return RANDOM.integer(0x7fffffff);
    }

    function _hash(arg: any): number {
        if (isZero(arg)) return 0;
        if (typeof arg.valueOf === "function" && arg.valueOf !== Object.prototype.valueOf) {
            arg = arg.valueOf();
            if (isZero(arg)) return 0;
        }
        switch (typeof arg) {
            case "number":
                return _hashNumber(arg);
            case "string":
                return _hashString(arg);
            case "function":
                return _hashMiscRef(arg);
            case "object":
                return _hashObject(arg);
            case "boolean":
                return arg === true ? 1 : 0;
            case "symbol":
                return _hashString(String(arg));
            case "bigint":
                return _hashString(arg.toString(10));
            case "undefined": {
                return 0;
            }
        }
    }

    function _hashArray(arr: readonly any[]): number {
        let h = 6151;
        for (let i = 0; i < arr.length; i++) {
            h = _combineHash(h, _hash(arr[i]));
        }
        return h;
    }

    function _combineHash(a: number, b: number): number {
        return (a * 53) ^ b;
    }

    function _hashObject(value: object): number {
        let h = CACHE.get(value);
        if (isDefined(h)) return h;
        if (isHash(value)) {
            h = value[Hash.sym]();
        } else {
            h = hashRandom();
        }
        CACHE.set(value, h);
        return h;
    }

    function _hashMiscRef(o: Object): number {
        let h = CACHE.get(o);
        if (isDefined(h)) return h;
        h = randomInt();
        CACHE.set(o, h);
        return h;
    }

    function _hashIterator(it: Iterator<any>): number {
        let h = 6151;
        let current: IteratorResult<any>;
        while (!(current = it.next()).done) {
            h = _combineHash(h, hashUnknown(current.value));
        }
        return h;
    }

    function _hashPlainObject(o: object): number {
        CACHE.set(o, randomInt());
        const keys = Object.keys(o).sort();
        let h = 12289;
        for (let i = 0; i < keys.length; i++) {
            h = _combineHash(h, _hashString(keys[i]!));
            h = _combineHash(h, hashUnknown((o as any)[keys[i]!]));
        }
        return h;
    }

    function _hashNumber(n: number): number {
        if (n !== n || n === Infinity) return 0;
        let h = n | 0;
        if (h !== n) h ^= n * 0xffffffff;
        while (n > 0xffffffff) h ^= n /= 0xffffffff;
        return n;
    }

    function _hashString(str: string): number {
        let h = 5381,
            i = str.length;
        while (i) h = (h * 33) ^ str.charCodeAt(--i);
        return h;
    }
}