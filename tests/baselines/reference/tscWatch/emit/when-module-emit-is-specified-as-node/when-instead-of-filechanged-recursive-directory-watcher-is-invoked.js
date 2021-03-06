Input::
//// [/a/rootFolder/project/tsconfig.json]
{"compilerOptions":{"module":"none","allowJs":true,"outDir":"Static/scripts/"},"include":["Scripts/**/*"]}

//// [/a/rootFolder/project/Scripts/TypeScript.ts]
var z = 10;

//// [/a/rootFolder/project/Scripts/Javascript.js]
var zz = 10;

//// [/a/lib/lib.d.ts]
/// <reference no-default-lib="true"/>
interface Boolean {}
interface Function {}
interface CallableFunction {}
interface NewableFunction {}
interface IArguments {}
interface Number { toExponential: any; }
interface Object {}
interface RegExp {}
interface String { charAt: any; }
interface Array<T> { length: number; [n: number]: T; }


/a/lib/tsc.js --w --p /a/rootFolder/project/tsconfig.json
Output::
>> Screen clear
[[90m12:00:21 AM[0m] Starting compilation in watch mode...

[[90m12:00:31 AM[0m] Found 0 errors. Watching for file changes.



Program root files: ["/a/rootFolder/project/Scripts/Javascript.js","/a/rootFolder/project/Scripts/TypeScript.ts"]
Program options: {"module":0,"allowJs":true,"outDir":"/a/rootFolder/project/Static/scripts","watch":true,"project":"/a/rootFolder/project/tsconfig.json","configFilePath":"/a/rootFolder/project/tsconfig.json"}
Program structureReused: Not
Program files::
/a/lib/lib.d.ts
/a/rootFolder/project/Scripts/Javascript.js
/a/rootFolder/project/Scripts/TypeScript.ts

Semantic diagnostics in builder refreshed for::
/a/lib/lib.d.ts
/a/rootFolder/project/Scripts/Javascript.js
/a/rootFolder/project/Scripts/TypeScript.ts

Shape signatures in builder refreshed for::
/a/lib/lib.d.ts (used version)
/a/rootfolder/project/scripts/javascript.js (used version)
/a/rootfolder/project/scripts/typescript.ts (used version)

WatchedFiles::
/a/rootfolder/project/tsconfig.json:
  {"fileName":"/a/rootFolder/project/tsconfig.json","pollingInterval":250}
/a/rootfolder/project/scripts/javascript.js:
  {"fileName":"/a/rootFolder/project/Scripts/Javascript.js","pollingInterval":250}
/a/rootfolder/project/scripts/typescript.ts:
  {"fileName":"/a/rootFolder/project/Scripts/TypeScript.ts","pollingInterval":250}
/a/lib/lib.d.ts:
  {"fileName":"/a/lib/lib.d.ts","pollingInterval":250}
/a/rootfolder/project/node_modules/@types:
  {"fileName":"/a/rootFolder/project/node_modules/@types","pollingInterval":500}

FsWatches::

FsWatchesRecursive::
/a/rootfolder/project/scripts:
  {"directoryName":"/a/rootfolder/project/scripts"}

exitCode:: ExitStatus.undefined

//// [/a/rootFolder/project/Static/scripts/Javascript.js]
var zz = 10;


//// [/a/rootFolder/project/Static/scripts/TypeScript.js]
var z = 10;



Change:: Modify typescript file

Input::
//// [/a/rootFolder/project/Scripts/TypeScript.ts]
var zz30 = 100;


Output::
>> Screen clear
[[90m12:00:34 AM[0m] File change detected. Starting incremental compilation...

[[90m12:00:41 AM[0m] Found 0 errors. Watching for file changes.



Program root files: ["/a/rootFolder/project/Scripts/Javascript.js","/a/rootFolder/project/Scripts/TypeScript.ts"]
Program options: {"module":0,"allowJs":true,"outDir":"/a/rootFolder/project/Static/scripts","watch":true,"project":"/a/rootFolder/project/tsconfig.json","configFilePath":"/a/rootFolder/project/tsconfig.json"}
Program structureReused: Completely
Program files::
/a/lib/lib.d.ts
/a/rootFolder/project/Scripts/Javascript.js
/a/rootFolder/project/Scripts/TypeScript.ts

Semantic diagnostics in builder refreshed for::
/a/lib/lib.d.ts
/a/rootFolder/project/Scripts/Javascript.js
/a/rootFolder/project/Scripts/TypeScript.ts

Shape signatures in builder refreshed for::
/a/rootfolder/project/scripts/typescript.ts (computed .d.ts)
/a/rootfolder/project/scripts/javascript.js (computed .d.ts)

WatchedFiles::
/a/rootfolder/project/tsconfig.json:
  {"fileName":"/a/rootFolder/project/tsconfig.json","pollingInterval":250}
/a/rootfolder/project/scripts/javascript.js:
  {"fileName":"/a/rootFolder/project/Scripts/Javascript.js","pollingInterval":250}
/a/rootfolder/project/scripts/typescript.ts:
  {"fileName":"/a/rootFolder/project/Scripts/TypeScript.ts","pollingInterval":250}
/a/lib/lib.d.ts:
  {"fileName":"/a/lib/lib.d.ts","pollingInterval":250}
/a/rootfolder/project/node_modules/@types:
  {"fileName":"/a/rootFolder/project/node_modules/@types","pollingInterval":500}

FsWatches::

FsWatchesRecursive::
/a/rootfolder/project/scripts:
  {"directoryName":"/a/rootfolder/project/scripts"}

exitCode:: ExitStatus.undefined

//// [/a/rootFolder/project/Static/scripts/Javascript.js] file written with same contents
//// [/a/rootFolder/project/Static/scripts/TypeScript.js]
var zz30 = 100;


