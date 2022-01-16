/**
 * @tsplus type demo/printer/Doc
 */
export type Doc<A> =
    | Char<A>
    | Line<A>
    | FlatAlt<A>

/**
* @tsplus type demo/printer/Doc/Aspects
*/
export interface DocAspects { }

/**
* @tsplus unify demo/printer/Doc
* @tsplus unify demo/printer/Doc/Char
* @tsplus unify demo/printer/Doc/Line
* @tsplus unify demo/printer/Doc/FlatAlt
*/
export function unifyDoc<X extends Doc<any>>(
    self: X
): Doc<[X] extends [{ _A: () => infer A; }] ? A : never> {
    return self;
}

/**
* @tsplus type demo/printer/Doc/Char
*/
export class Char<A> {
    readonly _tag = "Char";
    readonly _A!: () => A;
    constructor(readonly char: string, readonly id: (_: never) => A) { }
}

/**
* @tsplus type demo/printer/Doc/Line
*/
export class Line<A> {
    readonly _tag = "Line";
    readonly _A!: () => A;
    constructor(readonly id: (_: never) => A) { }
}

/**
* @tsplus type demo/printer/Doc/FlatAlt
*/
export class FlatAlt<A> {
    readonly _tag = "FlatAlt";
    readonly _A!: () => A;
    constructor(readonly left: Doc<A>, readonly right: Doc<A>) { }
}

const identity = <A>(a: A) => a

const line_: Doc<never> = new Line(identity);

export function char(char: string): Doc<never> {
    return new Char(char, identity);
}

export function flatAlt<A, B>(left: Doc<A>, right: Doc<B>): Doc<A | B> {
    return new FlatAlt<A | B>(left, right);
}

export const line: Doc<never> = flatAlt(line_, char(" "));
