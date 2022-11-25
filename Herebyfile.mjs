// @ts-check
import path from "path";
import fs from "fs";
import del from "del";
import { task } from "hereby";
import _glob from "glob";
import util from "util";
import chalk from "chalk";
import { Debouncer, Deferred, exec, getDiffTool, getDirSize, memoize, needsUpdate, readJson } from "./scripts/build/utils.mjs";
import { cleanTestDirs, localBaseline, localRwcBaseline, refBaseline, refRwcBaseline, runConsoleTests } from "./scripts/build/tests.mjs";
import { cleanProject, buildProject as realBuildProject, watchProject } from "./scripts/build/projects.mjs";
import { localizationDirectories } from "./scripts/build/localization.mjs";
import cmdLineOptions from "./scripts/build/options.mjs";
import esbuild from "esbuild";
import chokidar from "chokidar";
import { EventEmitter } from "events";
import { CancelToken } from "@esfx/canceltoken";

const glob = util.promisify(_glob);

/** @typedef {ReturnType<typeof task>} Task */
void 0;

const copyrightFilename = "CopyrightNotice.txt";
const copyright = memoize(async () => {
    const contents = await fs.promises.readFile(copyrightFilename, "utf-8");
    return contents.replace(/\r\n/g, "\n");
});


// TODO(jakebailey): This is really gross. If the build is cancelled (i.e. Ctrl+C), the modification will persist.
// Waiting on: https://github.com/microsoft/TypeScript/issues/51164
let currentlyBuilding = 0;
let oldTsconfigBase;

/** @type {typeof realBuildProject} */
const buildProjectWithEmit = async (...args) => {
    const tsconfigBasePath = "./src/tsconfig-base.json";

    // Not using fs.promises here, to ensure we are synchronous until running the real build.

    if (currentlyBuilding === 0) {
        oldTsconfigBase = fs.readFileSync(tsconfigBasePath, "utf-8");
        fs.writeFileSync(tsconfigBasePath, oldTsconfigBase.replace(`"emitDeclarationOnly": true,`, `"emitDeclarationOnly": false, // DO NOT COMMIT`));
    }

    currentlyBuilding++;

    await realBuildProject(...args);

    currentlyBuilding--;

    if (currentlyBuilding === 0) {
        fs.writeFileSync(tsconfigBasePath, oldTsconfigBase);
    }
};


const buildProject = cmdLineOptions.bundle ? realBuildProject : buildProjectWithEmit;


export const buildScripts = task({
    name: "scripts",
    description: "Builds files in the 'scripts' folder.",
    run: () => buildProject("scripts")
});

const libs = memoize(() => {
    /** @type {{ libs: string[]; paths: Record<string, string | undefined>; }} */
    const libraries = readJson("./src/lib/libs.json");
    const libs = libraries.libs.map(lib => {
        const relativeSources = ["header.d.ts", lib + ".d.ts"];
        const relativeTarget = libraries.paths && libraries.paths[lib] || ("lib." + lib + ".d.ts");
        const sources = relativeSources.map(s => path.posix.join("src/lib", s));
        const target = `built/local/${relativeTarget}`;
        return { target, sources };
    });
    return libs;
});


export const generateLibs = task({
    name: "lib",
    description: "Builds the library targets",
    run: async () => {
        await fs.promises.mkdir("./built/local", { recursive: true });
        for (const lib of libs()) {
            let output = await copyright();

            for (const source of lib.sources) {
                const contents = await fs.promises.readFile(source, "utf-8");
                // TODO(jakebailey): "\n\n" is for compatibility with our current tests; our test baselines
                // are sensitive to the positions of things in the lib files. Eventually remove this,
                // or remove lib.d.ts line numbers from our baselines.
                output += "\n\n" + contents.replace(/\r\n/g, "\n");
            }

            await fs.promises.writeFile(lib.target, output);
        }
    },
});


const diagnosticInformationMapTs = "src/compiler/diagnosticInformationMap.generated.ts";
const diagnosticMessagesJson = "src/compiler/diagnosticMessages.json";
const diagnosticMessagesGeneratedJson = "src/compiler/diagnosticMessages.generated.json";

export const generateDiagnostics = task({
    name: "generate-diagnostics",
    description: "Generates a diagnostic file in TypeScript based on an input JSON file",
    run: async () => {
        await exec(process.execPath, ["scripts/processDiagnosticMessages.mjs", diagnosticMessagesJson]);
    }
});

const cleanDiagnostics = task({
    name: "clean-diagnostics",
    description: "Generates a diagnostic file in TypeScript based on an input JSON file",
    hiddenFromTaskList: true,
    run: () => del([diagnosticInformationMapTs, diagnosticMessagesGeneratedJson]),
});


// Localize diagnostics
/**
 * .lcg file is what localization team uses to know what messages to localize.
 * The file is always generated in 'enu/diagnosticMessages.generated.json.lcg'
 */
const generatedLCGFile = "built/local/enu/diagnosticMessages.generated.json.lcg";

/**
 * The localization target produces the two following transformations:
 *    1. 'src\loc\lcl\<locale>\diagnosticMessages.generated.json.lcl' => 'built\local\<locale>\diagnosticMessages.generated.json'
 *       convert localized resources into a .json file the compiler can understand
 *    2. 'src\compiler\diagnosticMessages.generated.json' => 'built\local\ENU\diagnosticMessages.generated.json.lcg'
 *       generate the lcg file (source of messages to localize) from the diagnosticMessages.generated.json
 */
const localizationTargets = localizationDirectories
    .map(f => `built/local/${f}/diagnosticMessages.generated.json`)
    .concat(generatedLCGFile);

const localize = task({
    name: "localize",
    dependencies: [generateDiagnostics],
    run: async () => {
        if (needsUpdate(diagnosticMessagesGeneratedJson, generatedLCGFile)) {
            await exec(process.execPath, ["scripts/generateLocalizedDiagnosticMessages.mjs", "src/loc/lcl", "built/local", diagnosticMessagesGeneratedJson], { ignoreExitCode: true });
        }
    }
});

export const buildSrc = task({
    name: "build-src",
    description: "Builds the src project (all code)",
    dependencies: [generateDiagnostics],
    run: () => buildProject("src"),
});

export const watchSrc = task({
    name: "watch-src",
    description: "Watches the src project (all code)",
    hiddenFromTaskList: true,
    dependencies: [generateDiagnostics],
    run: () => watchProject("src"),
});

export const cleanSrc = task({
    name: "clean-src",
    hiddenFromTaskList: true,
    run: () => cleanProject("src"),
});

/**
 * @param {string} entrypoint
 * @param {string} output
 */
async function runDtsBundler(entrypoint, output) {
    await exec(process.execPath, [
        "./scripts/dtsBundler.mjs",
        "--entrypoint",
        entrypoint,
        "--output",
        output,
    ]);
}


/**
 * @param {string} entrypoint
 * @param {string} outfile
 * @param {BundlerTaskOptions} [taskOptions]
 *
 * @typedef BundlerTaskOptions
 * @property {string[]} [external]
 * @property {boolean} [exportIsTsObject]
 * @property {boolean} [treeShaking]
 * @property {esbuild.WatchMode} [watchMode]
 */
function createBundler(entrypoint, outfile, taskOptions = {}) {
    const getOptions = memoize(async () => {
        /** @type {esbuild.BuildOptions} */
        const options = {
            entryPoints: [entrypoint],
            banner: { js: await copyright() },
            bundle: true,
            outfile,
            platform: "node",
            target: "es2018",
            format: "cjs",
            sourcemap: "linked",
            sourcesContent: false,
            treeShaking: taskOptions.treeShaking,
            external: [
                ...(taskOptions.external ?? []),
                "source-map-support",
                "ts-node",
            ],
            logLevel: "warning",
            // legalComments: "none", // If we add copyright headers to the source files, uncomment.
            plugins: [
                {
                    name: "no-node-modules",
                    setup: (build) => {
                        build.onLoad({ filter: /[\\/]node_modules[\\/]/ }, () => {
                            // Ideally, we'd use "--external:./node_modules/*" here, but that doesn't work; we
                            // will instead end up with paths to node_modules rather than the package names.
                            // Instead, we'll return a load error when we see that we're trying to bundle from
                            // node_modules, then explicitly declare which external dependencies we rely on, which
                            // ensures that the correct module specifier is kept in the output (the non-wildcard
                            // form works properly). It also helps us keep tabs on what external dependencies we
                            // may be importing, which is handy.
                            //
                            // See: https://github.com/evanw/esbuild/issues/1958
                            return {
                                errors: [{ text: 'Attempted to bundle from node_modules; ensure "external" is set correctly.' }]
                            };
                        });
                    }
                },
                {
                    name: "fix-require",
                    setup: (build) => {
                        build.onEnd(async () => {
                            // esbuild converts calls to "require" to "__require"; this function
                            // calls the real require if it exists, or throws if it does not (rather than
                            // throwing an error like "require not defined"). But, since we want typescript
                            // to be consumable by other bundlers, we need to convert these calls back to
                            // require so our imports are visible again.
                            //
                            // The leading spaces are to keep the offsets the same within the files to keep
                            // source maps working (though this only really matters for the line the require is on).
                            //
                            // See: https://github.com/evanw/esbuild/issues/1905
                            let contents = await fs.promises.readFile(outfile, "utf-8");
                            contents = contents.replace(/__require\(/g, "  require(");
                            await fs.promises.writeFile(outfile, contents);
                        });
                    },
                }
            ]
        };

        if (taskOptions.exportIsTsObject) {
            // We use an IIFE so we can inject the footer, and so that "ts" is global if not loaded as a module.
            options.format = "iife";
            // Name the variable ts, matching our old big bundle and so we can use the code below.
            options.globalName = "ts";
            // If we are in a CJS context, export the ts namespace.
            options.footer = { js: `\nif (typeof module !== "undefined" && module.exports) { module.exports = ts; }` };
        }

        return options;
    });

    return {
        build: async () => esbuild.build(await getOptions()),
        watch: async () => esbuild.build({ ...await getOptions(), watch: taskOptions.watchMode ?? true, logLevel: "info" }),
    };
}

let printedWatchWarning = false;

/**
 * @param {object} options
 * @param {string} options.name
 * @param {string} [options.description]
 * @param {Task[]} [options.buildDeps]
 * @param {string} options.project
 * @param {string} options.srcEntrypoint
 * @param {string} options.builtEntrypoint
 * @param {string} options.output
 * @param {Task[]} [options.mainDeps]
 * @param {BundlerTaskOptions} [options.bundlerOptions]
 */
function entrypointBuildTask(options) {
    const build = task({
        name: `build-${options.name}`,
        dependencies: options.buildDeps,
        run: () => buildProject(options.project),
    });

    const bundler = createBundler(options.srcEntrypoint, options.output, options.bundlerOptions);

    // If we ever need to bundle our own output, change this to depend on build
    // and run esbuild on builtEntrypoint.
    const bundle = task({
        name: `bundle-${options.name}`,
        dependencies: options.buildDeps,
        run: () => bundler.build(),
    });

    /**
     * Writes a CJS module that reexports another CJS file. E.g. given
     * `options.builtEntrypoint = "./built/local/tsc/tsc.js"` and
     * `options.output = "./built/local/tsc.js"`, this will create a file
     * named "./built/local/tsc.js" containing:
     *
     * ```
     * module.exports = require("./tsc/tsc.js")
     * ```
     */
    const shim = task({
        name: `shim-${options.name}`,
        run: async () => {
            const outDir = path.dirname(options.output);
            await fs.promises.mkdir(outDir, { recursive: true });
            const moduleSpecifier = path.relative(outDir, options.builtEntrypoint);
            await fs.promises.writeFile(options.output, `module.exports = require("./${moduleSpecifier.replace(/[\\/]/g, "/")}")`);
        },
    });

    const mainDeps = options.mainDeps?.slice(0) ?? [];
    if (cmdLineOptions.bundle) {
        mainDeps.push(bundle);
        if (cmdLineOptions.typecheck) {
            mainDeps.push(build);
        }
    }
    else {
        mainDeps.push(build, shim);
    }

    const main = task({
        name: options.name,
        description: options.description,
        dependencies: mainDeps,
    });

    const watch = task({
        name: `watch-${options.name}`,
        hiddenFromTaskList: true, // This is best effort.
        dependencies: (options.buildDeps ?? []).concat(options.mainDeps ?? []).concat(cmdLineOptions.bundle ? [] : [shim]),
        run: () => {
            // These watch functions return promises that resolve once watch mode has started,
            // allowing them to operate as regular tasks, while creating unresolved promises
            // in the background that keep the process running after all tasks have exited.
            if (!printedWatchWarning) {
                console.error(chalk.yellowBright("Warning: watch mode is incomplete and may not work as expected. Use at your own risk."));
                printedWatchWarning = true;
            }

            if (!cmdLineOptions.bundle) {
                return watchProject(options.project);
            }
            return bundler.watch();
        }
    });

    return { build, bundle, shim, main, watch };
}


const { main: tsc, watch: watchTsc } = entrypointBuildTask({
    name: "tsc",
    description: "Builds the command-line compiler",
    buildDeps: [generateDiagnostics],
    project: "src/tsc",
    srcEntrypoint: "./src/tsc/tsc.ts",
    builtEntrypoint: "./built/local/tsc/tsc.js",
    output: "./built/local/tsc.js",
    mainDeps: [generateLibs],
});
export { tsc, watchTsc };


const { main: services, build: buildServices, watch: watchServices } = entrypointBuildTask({
    name: "services",
    description: "Builds the typescript.js library",
    buildDeps: [generateDiagnostics],
    project: "src/typescript",
    srcEntrypoint: "./src/typescript/typescript.ts",
    builtEntrypoint: "./built/local/typescript/typescript.js",
    output: "./built/local/typescript.js",
    mainDeps: [generateLibs],
    bundlerOptions: { exportIsTsObject: true },
});
export { services, watchServices };

export const dtsServices = task({
    name: "dts-services",
    description: "Bundles typescript.d.ts",
    dependencies: [buildServices],
    run: async () => {
        if (needsUpdate("./built/local/typescript/tsconfig.tsbuildinfo", ["./built/local/typescript.d.ts", "./built/local/typescript.internal.d.ts"])) {
            await runDtsBundler("./built/local/typescript/typescript.d.ts", "./built/local/typescript.d.ts");
        }
    },
});


const { main: tsserver, watch: watchTsserver } = entrypointBuildTask({
    name: "tsserver",
    description: "Builds the language server",
    buildDeps: [generateDiagnostics],
    project: "src/tsserver",
    srcEntrypoint: "./src/tsserver/server.ts",
    builtEntrypoint: "./built/local/tsserver/server.js",
    output: "./built/local/tsserver.js",
    mainDeps: [generateLibs],
    // Even though this seems like an exectuable, so could be the default CJS,
    // this is used in the browser too. Do the same thing that we do for our
    // libraries and generate an IIFE with name `ts`, as to not pollute the global
    // scope.
    bundlerOptions: { exportIsTsObject: true },
});
export { tsserver, watchTsserver };


export const min = task({
    name: "min",
    description: "Builds only tsc and tsserver",
    dependencies: [tsc, tsserver],
});

export const watchMin = task({
    name: "watch-min",
    description: "Watches only tsc and tsserver",
    hiddenFromTaskList: true,
    dependencies: [watchTsc, watchTsserver],
});



const { main: lssl, build: buildLssl, watch: watchLssl } = entrypointBuildTask({
    name: "lssl",
    description: "Builds language service server library",
    buildDeps: [generateDiagnostics],
    project: "src/tsserverlibrary",
    srcEntrypoint: "./src/tsserverlibrary/tsserverlibrary.ts",
    builtEntrypoint: "./built/local/tsserverlibrary/tsserverlibrary.js",
    output: "./built/local/tsserverlibrary.js",
    mainDeps: [generateLibs],
    bundlerOptions: { exportIsTsObject: true },
});
export { lssl, watchLssl };

export const dtsLssl = task({
    name: "dts-lssl",
    description: "Bundles tsserverlibrary.d.ts",
    dependencies: [buildLssl],
    run: async () => {
        if (needsUpdate("./built/local/tsserverlibrary/tsconfig.tsbuildinfo", ["./built/local/tsserverlibrary.d.ts", "./built/local/tsserverlibrary.internal.d.ts"])) {
            await runDtsBundler("./built/local/tsserverlibrary/tsserverlibrary.d.ts", "./built/local/tsserverlibrary.d.ts");
        }
    }
});

export const dts = task({
    name: "dts",
    dependencies: [dtsServices, dtsLssl],
});


const testRunner = "./built/local/run.js";
const watchTestsEmitter = new EventEmitter();
const { main: tests, watch: watchTests } = entrypointBuildTask({
    name: "tests",
    description: "Builds the test infrastructure",
    buildDeps: [generateDiagnostics],
    project: "src/testRunner",
    srcEntrypoint: "./src/testRunner/_namespaces/Harness.ts",
    builtEntrypoint: "./built/local/testRunner/runner.js",
    output: testRunner,
    mainDeps: [generateLibs],
    bundlerOptions: {
        // Ensure we never drop any dead code, which might be helpful while debugging.
        treeShaking: false,
        // These are directly imported via import statements and should not be bundled.
        external: [
            "chai",
            "del",
            "diff",
            "mocha",
            "ms",
        ],
        watchMode: {
            onRebuild() {
                watchTestsEmitter.emit("rebuild");
            }
        }
    },
});
export { tests, watchTests };


export const runEslintRulesTests = task({
    name: "run-eslint-rules-tests",
    description: "Runs the eslint rule tests",
    run: () => runConsoleTests("scripts/eslint/tests", "mocha-fivemat-progress-reporter", /*runInParallel*/ false),
});

export const lint = task({
    name: "lint",
    description: "Runs eslint on the compiler and scripts sources.",
    run: async () => {
        const folder = ".";
        const formatter = cmdLineOptions.ci ? "stylish" : "autolinkable-stylish";
        const args = [
            "node_modules/eslint/bin/eslint",
            "--cache",
            "--cache-location", `${folder}/.eslintcache`,
            "--format", formatter,
        ];

        if (cmdLineOptions.fix) {
            args.push("--fix");
        }

        args.push(folder);

        console.log(`Linting: ${args.join(" ")}`);
        return exec(process.execPath, args);
    }
});

const { main: cancellationToken, watch: watchCancellationToken } = entrypointBuildTask({
    name: "cancellation-token",
    project: "src/cancellationToken",
    srcEntrypoint: "./src/cancellationToken/cancellationToken.ts",
    builtEntrypoint: "./built/local/cancellationToken/cancellationToken.js",
    output: "./built/local/cancellationToken.js",
});

const { main: typingsInstaller, watch: watchTypingsInstaller } = entrypointBuildTask({
    name: "typings-installer",
    buildDeps: [generateDiagnostics],
    project: "src/typingsInstaller",
    srcEntrypoint: "./src/typingsInstaller/nodeTypingsInstaller.ts",
    builtEntrypoint: "./built/local/typingsInstaller/nodeTypingsInstaller.js",
    output: "./built/local/typingsInstaller.js",
});

const { main: watchGuard, watch: watchWatchGuard } = entrypointBuildTask({
    name: "watch-guard",
    project: "src/watchGuard",
    srcEntrypoint: "./src/watchGuard/watchGuard.ts",
    builtEntrypoint: "./built/local/watchGuard/watchGuard.js",
    output: "./built/local/watchGuard.js",
});

export const generateTypesMap = task({
    name: "generate-types-map",
    run: async () => {
        const source = "src/server/typesMap.json";
        const target = "built/local/typesMap.json";
        const contents = await fs.promises.readFile(source, "utf-8");
        JSON.parse(contents); // Validates that the JSON parses.
        await fs.promises.writeFile(target, contents);
    }
});


// Drop a copy of diagnosticMessages.generated.json into the built/local folder. This allows
// it to be synced to the Azure DevOps repo, so that it can get picked up by the build
// pipeline that generates the localization artifacts that are then fed into the translation process.
const builtLocalDiagnosticMessagesGeneratedJson = "built/local/diagnosticMessages.generated.json";
const copyBuiltLocalDiagnosticMessages = task({
    name: "copy-built-local-diagnostic-messages",
    dependencies: [generateDiagnostics],
    run: async () => {
        const contents = await fs.promises.readFile(diagnosticMessagesGeneratedJson, "utf-8");
        JSON.parse(contents); // Validates that the JSON parses.
        await fs.promises.writeFile(builtLocalDiagnosticMessagesGeneratedJson, contents);
    }
});


export const otherOutputs = task({
    name: "other-outputs",
    description: "Builds miscelaneous scripts and documents distributed with the LKG",
    dependencies: [cancellationToken, typingsInstaller, watchGuard, generateTypesMap, copyBuiltLocalDiagnosticMessages],
});

export const watchOtherOutputs = task({
    name: "watch-other-outputs",
    description: "Builds miscelaneous scripts and documents distributed with the LKG",
    hiddenFromTaskList: true,
    dependencies: [watchCancellationToken, watchTypingsInstaller, watchWatchGuard, generateTypesMap, copyBuiltLocalDiagnosticMessages],
});

export const local = task({
    name: "local",
    description: "Builds the full compiler and services",
    dependencies: [localize, tsc, tsserver, services, lssl, otherOutputs, dts],
});
export default local;

export const watchLocal = task({
    name: "watch-local",
    description: "Watches the full compiler and services",
    hiddenFromTaskList: true,
    dependencies: [localize, watchTsc, watchTsserver, watchServices, watchLssl, watchOtherOutputs, dts, watchSrc],
});

const runtestsDeps = [tests, generateLibs].concat(cmdLineOptions.typecheck ? [dts] : []);

export const runTests = task({
    name: "runtests",
    description: "Runs the tests using the built run.js file.",
    dependencies: runtestsDeps,
    run: () => runConsoleTests(testRunner, "mocha-fivemat-progress-reporter", /*runInParallel*/ false),
});
// task("runtests").flags = {
//     "-t --tests=<regex>": "Pattern for tests to run.",
//     "   --failed": "Runs tests listed in '.failed-tests'.",
//     "-r --reporter=<reporter>": "The mocha reporter to use.",
//     "-i --break": "Runs tests in inspector mode (NodeJS 8 and later)",
//     "   --keepFailed": "Keep tests in .failed-tests even if they pass",
//     "   --light": "Run tests in light mode (fewer verifications, but tests run faster)",
//     "   --dirty": "Run tests without first cleaning test output directories",
//     "   --stackTraceLimit=<limit>": "Sets the maximum number of stack frames to display. Use 'full' to show all frames.",
//     "   --no-color": "Disables color",
//     "   --timeout=<ms>": "Overrides the default test timeout.",
//     "   --built": "Compile using the built version of the compiler.",
//     "   --shards": "Total number of shards running tests (default: 1)",
//     "   --shardId": "1-based ID of this shard (default: 1)",
// };

export const runTestsAndWatch = task({
    name: "runtests-watch",
    dependencies: [watchTests],
    run: async () => {
        if (!cmdLineOptions.tests && !cmdLineOptions.failed) {
            console.log(chalk.redBright(`You must specifiy either --tests/-t or --failed to use 'runtests-watch'.`));
            return;
        }

        let watching = true;
        let running = true;
        let lastTestChangeTimeMs = Date.now();
        let testsChangedDeferred = /** @type {Deferred<void>} */(new Deferred());
        let testsChangedCancelSource = CancelToken.source();

        const testsChangedDebouncer = new Debouncer(1_000, endRunTests);
        const testCaseWatcher = chokidar.watch([
            "tests/cases/**/*.*",
            "tests/lib/**/*.*",
            "tests/projects/**/*.*",
        ], {
            ignorePermissionErrors: true,
            alwaysStat: true
        });

        process.on("SIGINT", endWatchMode);
        process.on("SIGKILL", endWatchMode);
        process.on("beforeExit", endWatchMode);
        watchTestsEmitter.on("rebuild", onRebuild);
        testCaseWatcher.on("all", onChange);

        while (watching) {
            const promise = testsChangedDeferred.promise;
            const token = testsChangedCancelSource.token;
            if (!token.signaled) {
                running = true;
                try {
                    await runConsoleTests(testRunner, "mocha-fivemat-progress-reporter", /*runInParallel*/ false, { token, watching: true });
                }
                catch {
                    // ignore
                }
                running = false;
            }
            if (watching) {
                console.log(chalk.yellowBright(`[watch] test run complete, waiting for changes...`));
                await promise;
            }
        }

        function onRebuild() {
            beginRunTests(testRunner);
        }

        /**
         * @param {'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'} eventName
         * @param {string} path
         * @param {fs.Stats | undefined} stats
         */
        function onChange(eventName, path, stats) {
            switch (eventName) {
                case "change":
                case "unlink":
                case "unlinkDir":
                    break;
                case "add":
                case "addDir":
                    // skip files that are detected as 'add' but haven't actually changed since the last time tests were
                    // run.
                    if (stats && stats.mtimeMs <= lastTestChangeTimeMs) {
                        return;
                    }
                    break;
            }
            beginRunTests(path);
        }

        /**
         * @param {string} path
         */
        function beginRunTests(path) {
            if (testsChangedDebouncer.empty) {
                console.log(chalk.yellowBright(`[watch] tests changed due to '${path}', restarting...`));
                if (running) {
                    console.log(chalk.yellowBright("[watch] aborting in-progress test run..."));
                }
                testsChangedCancelSource.cancel();
                testsChangedCancelSource = CancelToken.source();
            }

            testsChangedDebouncer.enqueue();
        }

        function endRunTests() {
            lastTestChangeTimeMs = Date.now();
            testsChangedDeferred.resolve();
            testsChangedDeferred = /** @type {Deferred<void>} */(new Deferred());
        }

        function endWatchMode() {
            if (watching) {
                watching = false;
                console.log(chalk.yellowBright("[watch] exiting watch mode..."));
                testsChangedCancelSource.cancel();
                testCaseWatcher.close();
                watchTestsEmitter.off("rebuild", onRebuild);
            }
        }
    },
});

export const runTestsParallel = task({
    name: "runtests-parallel",
    description: "Runs all the tests in parallel using the built run.js file.",
    dependencies: runtestsDeps,
    run: () => runConsoleTests(testRunner, "min", /*runInParallel*/ cmdLineOptions.workers > 1),
});
// task("runtests-parallel").flags = {
//     "   --light": "Run tests in light mode (fewer verifications, but tests run faster).",
//     "   --keepFailed": "Keep tests in .failed-tests even if they pass.",
//     "   --dirty": "Run tests without first cleaning test output directories.",
//     "   --stackTraceLimit=<limit>": "Sets the maximum number of stack frames to display. Use 'full' to show all frames.",
//     "   --workers=<number>": "The number of parallel workers to use.",
//     "   --timeout=<ms>": "Overrides the default test timeout.",
//     "   --built": "Compile using the built version of the compiler.",
//     "   --shards": "Total number of shards running tests (default: 1)",
//     "   --shardId": "1-based ID of this shard (default: 1)",
// };

export const testBrowserIntegration = task({
    name: "test-browser-integration",
    description: "Runs scripts/browserIntegrationTest.mjs which tests that typescript.js loads in a browser",
    dependencies: [services],
    run: () => exec(process.execPath, ["scripts/browserIntegrationTest.mjs"]),
});

export const diff = task({
    name: "diff",
    description: "Diffs the compiler baselines using the diff tool specified by the 'DIFF' environment variable",
    run: () => exec(getDiffTool(), [refBaseline, localBaseline], { ignoreExitCode: true, waitForExit: false }),
});

export const diffRwc = task({
    name: "diff-rwc",
    description: "Diffs the RWC baselines using the diff tool specified by the 'DIFF' environment variable",
    run: () => exec(getDiffTool(), [refRwcBaseline, localRwcBaseline], { ignoreExitCode: true, waitForExit: false }),
});

/**
 * @param {string} localBaseline Path to the local copy of the baselines
 * @param {string} refBaseline Path to the reference copy of the baselines
 */
function baselineAcceptTask(localBaseline, refBaseline) {
    /**
     * @param {string} p
     */
    function localPathToRefPath(p) {
        const relative = path.relative(localBaseline, p);
        return path.join(refBaseline, relative);
    }

    return async () => {
        const toCopy = await glob(`${localBaseline}/**`, { nodir: true, ignore: `${localBaseline}/**/*.delete` });
        for (const p of toCopy) {
            const out = localPathToRefPath(p);
            await fs.promises.mkdir(path.dirname(out), { recursive: true });
            await fs.promises.copyFile(p, out);
        }
        const toDelete = await glob(`${localBaseline}/**/*.delete`, { nodir: true });
        for (const p of toDelete) {
            const out = localPathToRefPath(p);
            await fs.promises.rm(out);
        }
    };
}

export const baselineAccept = task({
    name: "baseline-accept",
    description: "Makes the most recent test results the new baseline, overwriting the old baseline",
    run: baselineAcceptTask(localBaseline, refBaseline),
});

export const baselineAcceptRwc = task({
    name: "baseline-accept-rwc",
    description: "Makes the most recent rwc test results the new baseline, overwriting the old baseline",
    run: baselineAcceptTask(localRwcBaseline, refRwcBaseline),
});

// TODO(rbuckton): Determine if we still need this task. Depending on a relative
//                 path here seems like a bad idea.
export const updateSublime = task({
    name: "update-sublime",
    description: "Updates the sublime plugin's tsserver",
    dependencies: [tsserver],
    run: async () => {
        for (const file of ["built/local/tsserver.js", "built/local/tsserver.js.map"]) {
            await fs.promises.copyFile(file, path.resolve("../TypeScript-Sublime-Plugin/tsserver/", path.basename(file)));
        }
    }
});

// TODO(rbuckton): Should the path to DefinitelyTyped be configurable via an environment variable?
export const importDefinitelyTypedTests = task({
    name: "importDefinitelyTypedTests",
    description: "Runs the importDefinitelyTypedTests script to copy DT's tests to the TS-internal RWC tests",
    run: () => exec(process.execPath, ["scripts/importDefinitelyTypedTests.mjs", "./", "../DefinitelyTyped"]),
});


export const produceLKG = task({
    name: "LKG",
    description: "Makes a new LKG out of the built js files",
    dependencies: [local],
    run: async () => {
        if (!cmdLineOptions.bundle) {
            throw new Error("LKG cannot be created when --bundle=false");
        }

        const expectedFiles = [
            "built/local/cancellationToken.js",
            "built/local/tsc.js",
            "built/local/tsserver.js",
            "built/local/tsserverlibrary.js",
            "built/local/tsserverlibrary.d.ts",
            "built/local/typescript.js",
            "built/local/typescript.d.ts",
            "built/local/typingsInstaller.js",
            "built/local/watchGuard.js",
        ].concat(libs().map(lib => lib.target));
        const missingFiles = expectedFiles
            .concat(localizationTargets)
            .filter(f => !fs.existsSync(f));
        if (missingFiles.length > 0) {
            throw new Error("Cannot replace the LKG unless all built targets are present in directory 'built/local/'. The following files are missing:\n" + missingFiles.join("\n"));
        }
        const sizeBefore = getDirSize("lib");
        await exec(process.execPath, ["scripts/produceLKG.mjs"]);
        const sizeAfter = getDirSize("lib");
        if (sizeAfter > (sizeBefore * 1.10)) {
            throw new Error("The lib folder increased by 10% or more. This likely indicates a bug.");
        }
    }
});

export const lkg = task({
    name: "lkg",
    hiddenFromTaskList: true,
    dependencies: [produceLKG],
});

export const generateSpec = task({
    name: "generate-spec",
    description: "Generates a Markdown version of the Language Specification",
    hiddenFromTaskList: true,
    run: () => exec("cscript", ["//nologo", "scripts/word2md.mjs", path.resolve("doc/TypeScript Language Specification - ARCHIVED.docx"), path.resolve("doc/spec-ARCHIVED.md")]),
});

export const cleanBuilt = task({
    name: "clean-built",
    hiddenFromTaskList: true,
    run: () => del("built"),
});

export const clean = task({
    name: "clean",
    description: "Cleans build outputs",
    dependencies: [cleanBuilt, cleanDiagnostics],
});

export const configureNightly = task({
    name: "configure-nightly",
    description: "Runs scripts/configurePrerelease.mjs to prepare a build for nightly publishing",
    run: () => exec(process.execPath, ["scripts/configurePrerelease.mjs", "dev", "package.json", "src/compiler/corePublic.ts"]),
});

export const configureInsiders = task({
    name: "configure-insiders",
    description: "Runs scripts/configurePrerelease.mjs to prepare a build for insiders publishing",
    run: () => exec(process.execPath, ["scripts/configurePrerelease.mjs", "insiders", "package.json", "src/compiler/corePublic.ts"]),
});

export const configureExperimental = task({
    name: "configure-experimental",
    description: "Runs scripts/configurePrerelease.mjs to prepare a build for experimental publishing",
    run: () => exec(process.execPath, ["scripts/configurePrerelease.mjs", "experimental", "package.json", "src/compiler/corePublic.ts"]),
});

export const configureTsPlus = task({
    name: "configure-tsplus",
    description: "Runs scripts/configurePrerelease.mjs to prepare a build for tsplus publishing",
    run: () => exec(process.execPath, ["scripts/configurePrerelease.mjs", "tsplus", "package.json", "src/compiler/corePublic.ts"]),
});

export const help = task({
    name: "help",
    description: "Prints the top-level tasks.",
    hiddenFromTaskList: true,
    run: () => exec("hereby", ["--tasks"], { hidePrompt: true }),
});
