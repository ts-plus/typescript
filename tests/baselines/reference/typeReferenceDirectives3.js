//// [tests/cases/compiler/typeReferenceDirectives3.ts] ////

//// [ref.d.ts]
interface $ { x }

//// [index.d.ts]
declare let $: { x: number }

//// [app.ts]
/// <reference types="lib"/>
/// <reference path="ref.d.ts" />
interface A {
    x: () => $
}

//// [app.js]
/// <reference types="lib"/>
/// <reference path="ref.d.ts" />


//// [app.d.ts]
/// <reference path="ref.d.ts" />
interface A {
    x: () => $;
}
