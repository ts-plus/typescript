//// [tests/cases/compiler/es3defaultAliasIsQuoted.ts] ////

//// [es3defaultAliasQuoted_file0.ts]
export class Foo {
    static CONSTANT = "Foo";
}

export default function assert(value: boolean) {
    if (!value) throw new Error("Assertion failed!");
}

//// [es3defaultAliasQuoted_file1.ts]
import {Foo, default as assert} from "./es3defaultAliasQuoted_file0";
assert(Foo.CONSTANT === "Foo");

//// [es3defaultAliasQuoted_file0.js]
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Foo = void 0;
var Foo = /** @class */ (function () {
    function Foo() {
    }
    Foo.CONSTANT = "Foo";
    return Foo;
}());
exports.Foo = Foo;
function assert(value) {
    if (!value)
        throw new Error("Assertion failed!");
}
exports.default = assert;
//// [es3defaultAliasQuoted_file1.js]
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var es3defaultAliasQuoted_file0_1 = require("./es3defaultAliasQuoted_file0");
(0, es3defaultAliasQuoted_file0_1.default)(es3defaultAliasQuoted_file0_1.Foo.CONSTANT === "Foo");
