/// <reference path='fourslash.ts' />

// @allowJs: true
// @target: esnext

// @Filename: /a.js
////const a = require('a'); a;

verify.codeFix({
    description: "Convert to ES module",
    newFileContent: "import a from 'a'; a;",
});
