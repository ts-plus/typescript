namespace ts {
    export function findConfigFile(searchPath: string, fileExists: (fileName: string) => boolean, configName = "tsconfig.json"): string | undefined {
        return forEachAncestorDirectory(searchPath, ancestor => {
            const fileName = combinePaths(ancestor, configName);
            return fileExists(fileName) ? fileName : undefined;
        });
    }

    export function resolveTripleslashReference(moduleName: string, containingFile: string): string {
        const basePath = getDirectoryPath(containingFile);
        const referencedFileName = isRootedDiskPath(moduleName) ? moduleName : combinePaths(basePath, moduleName);
        return normalizePath(referencedFileName);
    }

    /* @internal */
    export function computeCommonSourceDirectoryOfFilenames(fileNames: readonly string[], currentDirectory: string, getCanonicalFileName: GetCanonicalFileName): string {
        let commonPathComponents: string[] | undefined;
        const failed = forEach(fileNames, sourceFile => {
            // Each file contributes into common source file path
            const sourcePathComponents = getNormalizedPathComponents(sourceFile, currentDirectory);
            sourcePathComponents.pop(); // The base file name is not part of the common directory path

            if (!commonPathComponents) {
                // first file
                commonPathComponents = sourcePathComponents;
                return;
            }

            const n = Math.min(commonPathComponents.length, sourcePathComponents.length);
            for (let i = 0; i < n; i++) {
                if (getCanonicalFileName(commonPathComponents[i]) !== getCanonicalFileName(sourcePathComponents[i])) {
                    if (i === 0) {
                        // Failed to find any common path component
                        return true;
                    }

                    // New common path found that is 0 -> i-1
                    commonPathComponents.length = i;
                    break;
                }
            }

            // If the sourcePathComponents was shorter than the commonPathComponents, truncate to the sourcePathComponents
            if (sourcePathComponents.length < commonPathComponents.length) {
                commonPathComponents.length = sourcePathComponents.length;
            }
        });

        // A common path can not be found when paths span multiple drives on windows, for example
        if (failed) {
            return "";
        }

        if (!commonPathComponents) { // Can happen when all input files are .d.ts files
            return currentDirectory;
        }

        return getPathFromPathComponents(commonPathComponents);
    }

    interface OutputFingerprint {
        hash: string;
        byteOrderMark: boolean;
        mtime: Date;
    }

    export function createCompilerHost(options: CompilerOptions, setParentNodes?: boolean): CompilerHost {
        return createCompilerHostWorker(options, setParentNodes);
    }

    /*@internal*/
    // TODO(shkamat): update this after reworking ts build API
    export function createCompilerHostWorker(options: CompilerOptions, setParentNodes?: boolean, system = sys): CompilerHost {
        const existingDirectories = new Map<string, boolean>();
        const getCanonicalFileName = createGetCanonicalFileName(system.useCaseSensitiveFileNames);
        const computeHash = maybeBind(system, system.createHash) || generateDjb2Hash;
        function getSourceFile(fileName: string, languageVersionOrOptions: ScriptTarget | CreateSourceFileOptions, onError?: (message: string) => void): SourceFile | undefined {
            let text: string | undefined;
            try {
                performance.mark("beforeIORead");
                text = compilerHost.readFile(fileName);
                performance.mark("afterIORead");
                performance.measure("I/O Read", "beforeIORead", "afterIORead");
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
                text = "";
            }
            return text !== undefined ? createSourceFile(fileName, text, languageVersionOrOptions, setParentNodes) : undefined;
        }

        function directoryExists(directoryPath: string): boolean {
            if (existingDirectories.has(directoryPath)) {
                return true;
            }
            if ((compilerHost.directoryExists || system.directoryExists)(directoryPath)) {
                existingDirectories.set(directoryPath, true);
                return true;
            }
            return false;
        }

        function writeFile(fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void) {
            try {
                performance.mark("beforeIOWrite");

                // NOTE: If patchWriteFileEnsuringDirectory has been called,
                // the system.writeFile will do its own directory creation and
                // the ensureDirectoriesExist call will always be redundant.
                writeFileEnsuringDirectories(
                    fileName,
                    data,
                    writeByteOrderMark,
                    (path, data, writeByteOrderMark) => writeFileWorker(path, data, writeByteOrderMark),
                    path => (compilerHost.createDirectory || system.createDirectory)(path),
                    path => directoryExists(path));

                performance.mark("afterIOWrite");
                performance.measure("I/O Write", "beforeIOWrite", "afterIOWrite");
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
            }
        }

        let outputFingerprints: ESMap<string, OutputFingerprint>;
        function writeFileWorker(fileName: string, data: string, writeByteOrderMark: boolean) {
            if (!isWatchSet(options) || !system.getModifiedTime) {
                system.writeFile(fileName, data, writeByteOrderMark);
                return;
            }

            if (!outputFingerprints) {
                outputFingerprints = new Map<string, OutputFingerprint>();
            }

            const hash = computeHash(data);
            const mtimeBefore = system.getModifiedTime(fileName);

            if (mtimeBefore) {
                const fingerprint = outputFingerprints.get(fileName);
                // If output has not been changed, and the file has no external modification
                if (fingerprint &&
                    fingerprint.byteOrderMark === writeByteOrderMark &&
                    fingerprint.hash === hash &&
                    fingerprint.mtime.getTime() === mtimeBefore.getTime()) {
                    return;
                }
            }

            system.writeFile(fileName, data, writeByteOrderMark);

            const mtimeAfter = system.getModifiedTime(fileName) || missingFileModifiedTime;

            outputFingerprints.set(fileName, {
                hash,
                byteOrderMark: writeByteOrderMark,
                mtime: mtimeAfter
            });
        }

        function getDefaultLibLocation(): string {
            return getDirectoryPath(normalizePath(system.getExecutingFilePath()));
        }

        const newLine = getNewLineCharacter(options, () => system.newLine);
        const realpath = system.realpath && ((path: string) => system.realpath!(path));
        const compilerHost: CompilerHost = {
            getSourceFile,
            getDefaultLibLocation,
            getDefaultLibFileName: options => combinePaths(getDefaultLibLocation(), getDefaultLibFileName(options)),
            writeFile,
            getCurrentDirectory: memoize(() => system.getCurrentDirectory()),
            useCaseSensitiveFileNames: () => system.useCaseSensitiveFileNames,
            getCanonicalFileName,
            getNewLine: () => newLine,
            fileExists: fileName => system.fileExists(fileName),
            readFile: fileName => system.readFile(fileName),
            trace: (s: string) => system.write(s + newLine),
            directoryExists: directoryName => system.directoryExists(directoryName),
            getEnvironmentVariable: name => system.getEnvironmentVariable ? system.getEnvironmentVariable(name) : "",
            getDirectories: (path: string) => system.getDirectories(path),
            realpath,
            readDirectory: (path, extensions, include, exclude, depth) => system.readDirectory(path, extensions, include, exclude, depth),
            createDirectory: d => system.createDirectory(d),
            createHash: maybeBind(system, system.createHash)
        };
        return compilerHost;
    }

    /*@internal*/
    interface CompilerHostLikeForCache {
        fileExists(fileName: string): boolean;
        readFile(fileName: string, encoding?: string): string | undefined;
        directoryExists?(directory: string): boolean;
        createDirectory?(directory: string): void;
        writeFile?: WriteFileCallback;
    }

    /*@internal*/
    export function changeCompilerHostLikeToUseCache(
        host: CompilerHostLikeForCache,
        toPath: (fileName: string) => Path,
        getSourceFile?: CompilerHost["getSourceFile"]
    ) {
        const originalReadFile = host.readFile;
        const originalFileExists = host.fileExists;
        const originalDirectoryExists = host.directoryExists;
        const originalCreateDirectory = host.createDirectory;
        const originalWriteFile = host.writeFile;
        const readFileCache = new Map<string, string | false>();
        const fileExistsCache = new Map<string, boolean>();
        const directoryExistsCache = new Map<string, boolean>();
        const sourceFileCache = new Map<string, SourceFile>();

        const readFileWithCache = (fileName: string): string | undefined => {
            const key = toPath(fileName);
            const value = readFileCache.get(key);
            if (value !== undefined) return value !== false ? value : undefined;
            return setReadFileCache(key, fileName);
        };
        const setReadFileCache = (key: Path, fileName: string) => {
            const newValue = originalReadFile.call(host, fileName);
            readFileCache.set(key, newValue !== undefined ? newValue : false);
            return newValue;
        };
        host.readFile = fileName => {
            const key = toPath(fileName);
            const value = readFileCache.get(key);
            if (value !== undefined) return value !== false ? value : undefined; // could be .d.ts from output
            // Cache json or buildInfo
            if (!fileExtensionIs(fileName, Extension.Json) && !isBuildInfoFile(fileName)) {
                return originalReadFile.call(host, fileName);
            }

            return setReadFileCache(key, fileName);
        };

        const getSourceFileWithCache: CompilerHost["getSourceFile"] | undefined = getSourceFile ? (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
            const key = toPath(fileName);
            const value = sourceFileCache.get(key);
            if (value) return value;

            const sourceFile = getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
            if (sourceFile && (isDeclarationFileName(fileName) || fileExtensionIs(fileName, Extension.Json))) {
                sourceFileCache.set(key, sourceFile);
            }
            return sourceFile;
        } : undefined;

        // fileExists for any kind of extension
        host.fileExists = fileName => {
            const key = toPath(fileName);
            const value = fileExistsCache.get(key);
            if (value !== undefined) return value;
            const newValue = originalFileExists.call(host, fileName);
            fileExistsCache.set(key, !!newValue);
            return newValue;
        };
        if (originalWriteFile) {
            host.writeFile = (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
                const key = toPath(fileName);
                fileExistsCache.delete(key);

                const value = readFileCache.get(key);
                if (value !== undefined && value !== data) {
                    readFileCache.delete(key);
                    sourceFileCache.delete(key);
                }
                else if (getSourceFileWithCache) {
                    const sourceFile = sourceFileCache.get(key);
                    if (sourceFile && sourceFile.text !== data) {
                        sourceFileCache.delete(key);
                    }
                }
                originalWriteFile.call(host, fileName, data, writeByteOrderMark, onError, sourceFiles);
            };
        }

        // directoryExists
        if (originalDirectoryExists && originalCreateDirectory) {
            host.directoryExists = directory => {
                const key = toPath(directory);
                const value = directoryExistsCache.get(key);
                if (value !== undefined) return value;
                const newValue = originalDirectoryExists.call(host, directory);
                directoryExistsCache.set(key, !!newValue);
                return newValue;
            };
            host.createDirectory = directory => {
                const key = toPath(directory);
                directoryExistsCache.delete(key);
                originalCreateDirectory.call(host, directory);
            };
        }

        return {
            originalReadFile,
            originalFileExists,
            originalDirectoryExists,
            originalCreateDirectory,
            originalWriteFile,
            getSourceFileWithCache,
            readFileWithCache
        };
    }

    export function getPreEmitDiagnostics(program: Program, sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly Diagnostic[];
    /*@internal*/ export function getPreEmitDiagnostics(program: BuilderProgram, sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly Diagnostic[]; // eslint-disable-line @typescript-eslint/unified-signatures
    export function getPreEmitDiagnostics(program: Program | BuilderProgram, sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly Diagnostic[] {
        let diagnostics: Diagnostic[] | undefined;
        diagnostics = addRange(diagnostics, program.getConfigFileParsingDiagnostics());
        diagnostics = addRange(diagnostics, program.getOptionsDiagnostics(cancellationToken));
        diagnostics = addRange(diagnostics, program.getSyntacticDiagnostics(sourceFile, cancellationToken));
        diagnostics = addRange(diagnostics, program.getGlobalDiagnostics(cancellationToken));
        diagnostics = addRange(diagnostics, program.getSemanticDiagnostics(sourceFile, cancellationToken));

        if (getEmitDeclarations(program.getCompilerOptions())) {
            diagnostics = addRange(diagnostics, program.getDeclarationDiagnostics(sourceFile, cancellationToken));
        }

        return sortAndDeduplicateDiagnostics(diagnostics || emptyArray);
    }

    export interface FormatDiagnosticsHost {
        getCurrentDirectory(): string;
        getCanonicalFileName(fileName: string): string;
        getNewLine(): string;
    }

    export function formatDiagnostics(diagnostics: readonly Diagnostic[], host: FormatDiagnosticsHost): string {
        let output = "";

        for (const diagnostic of diagnostics) {
            output += formatDiagnostic(diagnostic, host);
        }
        return output;
    }

    export function formatDiagnostic(diagnostic: Diagnostic, host: FormatDiagnosticsHost): string {
        const errorMessage = `${diagnosticCategoryName(diagnostic)} TS${diagnostic.code}: ${flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine())}${host.getNewLine()}`;

        if (diagnostic.file) {
            const { line, character } = getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!); // TODO: GH#18217
            const fileName = diagnostic.file.fileName;
            const relativeFileName = convertToRelativePath(fileName, host.getCurrentDirectory(), fileName => host.getCanonicalFileName(fileName));
            return `${relativeFileName}(${line + 1},${character + 1}): ` + errorMessage;
        }

        return errorMessage;
    }

    /** @internal */
    export enum ForegroundColorEscapeSequences {
        Grey = "\u001b[90m",
        Red = "\u001b[91m",
        Yellow = "\u001b[93m",
        Blue = "\u001b[94m",
        Cyan = "\u001b[96m"
    }
    const gutterStyleSequence = "\u001b[7m";
    const gutterSeparator = " ";
    const resetEscapeSequence = "\u001b[0m";
    const ellipsis = "...";
    const halfIndent = "  ";
    const indent = "    ";
    function getCategoryFormat(category: DiagnosticCategory): ForegroundColorEscapeSequences {
        switch (category) {
            case DiagnosticCategory.Error: return ForegroundColorEscapeSequences.Red;
            case DiagnosticCategory.Warning: return ForegroundColorEscapeSequences.Yellow;
            case DiagnosticCategory.Suggestion: return Debug.fail("Should never get an Info diagnostic on the command line.");
            case DiagnosticCategory.Message: return ForegroundColorEscapeSequences.Blue;
        }
    }

    /** @internal */
    export function formatColorAndReset(text: string, formatStyle: string) {
        return formatStyle + text + resetEscapeSequence;
    }

    function formatCodeSpan(file: SourceFile, start: number, length: number, indent: string, squiggleColor: ForegroundColorEscapeSequences, host: FormatDiagnosticsHost) {
        const { line: firstLine, character: firstLineChar } = getLineAndCharacterOfPosition(file, start);
        const { line: lastLine, character: lastLineChar } = getLineAndCharacterOfPosition(file, start + length);
        const lastLineInFile = getLineAndCharacterOfPosition(file, file.text.length).line;

        const hasMoreThanFiveLines = (lastLine - firstLine) >= 4;
        let gutterWidth = (lastLine + 1 + "").length;
        if (hasMoreThanFiveLines) {
            gutterWidth = Math.max(ellipsis.length, gutterWidth);
        }

        let context = "";
        for (let i = firstLine; i <= lastLine; i++) {
            context += host.getNewLine();
            // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
            // so we'll skip ahead to the second-to-last line.
            if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
                context += indent + formatColorAndReset(padLeft(ellipsis, gutterWidth), gutterStyleSequence) + gutterSeparator + host.getNewLine();
                i = lastLine - 1;
            }

            const lineStart = getPositionOfLineAndCharacter(file, i, 0);
            const lineEnd = i < lastLineInFile ? getPositionOfLineAndCharacter(file, i + 1, 0) : file.text.length;
            let lineContent = file.text.slice(lineStart, lineEnd);
            lineContent = trimStringEnd(lineContent);  // trim from end
            lineContent = lineContent.replace(/\t/g, " ");   // convert tabs to single spaces

            // Output the gutter and the actual contents of the line.
            context += indent + formatColorAndReset(padLeft(i + 1 + "", gutterWidth), gutterStyleSequence) + gutterSeparator;
            context += lineContent + host.getNewLine();

            // Output the gutter and the error span for the line using tildes.
            context += indent + formatColorAndReset(padLeft("", gutterWidth), gutterStyleSequence) + gutterSeparator;
            context += squiggleColor;
            if (i === firstLine) {
                // If we're on the last line, then limit it to the last character of the last line.
                // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
                const lastCharForLine = i === lastLine ? lastLineChar : undefined;

                context += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
                context += lineContent.slice(firstLineChar, lastCharForLine).replace(/./g, "~");
            }
            else if (i === lastLine) {
                context += lineContent.slice(0, lastLineChar).replace(/./g, "~");
            }
            else {
                // Squiggle the entire line.
                context += lineContent.replace(/./g, "~");
            }
            context += resetEscapeSequence;
        }
        return context;
    }

    /* @internal */
    export function formatLocation(file: SourceFile, start: number, host: FormatDiagnosticsHost, color = formatColorAndReset) {
        const { line: firstLine, character: firstLineChar } = getLineAndCharacterOfPosition(file, start); // TODO: GH#18217
        const relativeFileName = host ? convertToRelativePath(file.fileName, host.getCurrentDirectory(), fileName => host.getCanonicalFileName(fileName)) : file.fileName;

        let output = "";
        output += color(relativeFileName, ForegroundColorEscapeSequences.Cyan);
        output += ":";
        output += color(`${firstLine + 1}`, ForegroundColorEscapeSequences.Yellow);
        output += ":";
        output += color(`${firstLineChar + 1}`, ForegroundColorEscapeSequences.Yellow);
        return output;
    }

    export function formatDiagnosticsWithColorAndContext(diagnostics: readonly Diagnostic[], host: FormatDiagnosticsHost): string {
        let output = "";
        for (const diagnostic of diagnostics) {
            if (diagnostic.file) {
                const { file, start } = diagnostic;
                output += formatLocation(file, start!, host); // TODO: GH#18217
                output += " - ";
            }

            output += formatColorAndReset(diagnosticCategoryName(diagnostic), getCategoryFormat(diagnostic.category));
            output += formatColorAndReset(` TS${diagnostic.code}: `, ForegroundColorEscapeSequences.Grey);
            output += flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine());

            if (diagnostic.file) {
                output += host.getNewLine();
                output += formatCodeSpan(diagnostic.file, diagnostic.start!, diagnostic.length!, "", getCategoryFormat(diagnostic.category), host); // TODO: GH#18217
            }
            if (diagnostic.relatedInformation) {
                output += host.getNewLine();
                for (const { file, start, length, messageText } of diagnostic.relatedInformation) {
                    if (file) {
                        output += host.getNewLine();
                        output += halfIndent + formatLocation(file, start!, host); // TODO: GH#18217
                        output += formatCodeSpan(file, start!, length!, indent, ForegroundColorEscapeSequences.Cyan, host); // TODO: GH#18217
                    }
                    output += host.getNewLine();
                    output += indent + flattenDiagnosticMessageText(messageText, host.getNewLine());
                }
            }
            output += host.getNewLine();
        }
        return output;
    }

    export function flattenDiagnosticMessageText(diag: string | DiagnosticMessageChain | undefined, newLine: string, indent = 0): string {
        if (isString(diag)) {
            return diag;
        }
        else if (diag === undefined) {
            return "";
        }
        let result = "";
        if (indent) {
            result += newLine;

            for (let i = 0; i < indent; i++) {
                result += "  ";
            }
        }
        result += diag.messageText;
        indent++;
        if (diag.next) {
            for (const kid of diag.next) {
                result += flattenDiagnosticMessageText(kid, newLine, indent);
            }
        }
        return result;
    }

    /* @internal */
    export function loadWithTypeDirectiveCache<T>(names: string[] | readonly FileReference[], containingFile: string, redirectedReference: ResolvedProjectReference | undefined, containingFileMode: SourceFile["impliedNodeFormat"], loader: (name: string, containingFile: string, redirectedReference: ResolvedProjectReference | undefined, resolutionMode: SourceFile["impliedNodeFormat"]) => T): T[] {
        if (names.length === 0) {
            return [];
        }
        const resolutions: T[] = [];
        const cache = new Map<string, T>();
        for (const name of names) {
            let result: T;
            const mode = getModeForFileReference(name, containingFileMode);
            // We lower-case all type references because npm automatically lowercases all packages. See GH#9824.
            const strName = isString(name) ? name : name.fileName.toLowerCase();
            const cacheKey = mode !== undefined ? `${mode}|${strName}` : strName;
            if (cache.has(cacheKey)) {
                result = cache.get(cacheKey)!;
            }
            else {
                cache.set(cacheKey, result = loader(strName, containingFile, redirectedReference, mode));
            }
            resolutions.push(result);
        }
        return resolutions;
    }

    /* @internal */
    interface SourceFileImportsList {
        imports: SourceFile["imports"];
        moduleAugmentations: SourceFile["moduleAugmentations"];
        impliedNodeFormat?: SourceFile["impliedNodeFormat"];
    };

    /* @internal */
    export function getModeForFileReference(ref: FileReference | string, containingFileMode: SourceFile["impliedNodeFormat"]) {
        return (isString(ref) ? containingFileMode : ref.resolutionMode) || containingFileMode;
    }

    /* @internal */
    export function getModeForResolutionAtIndex(file: SourceFileImportsList, index: number) {
        if (file.impliedNodeFormat === undefined) return undefined;
        // we ensure all elements of file.imports and file.moduleAugmentations have the relevant parent pointers set during program setup,
        // so it's safe to use them even pre-bind
        return getModeForUsageLocation(file, getModuleNameStringLiteralAt(file, index));
    }

    /* @internal */
    export function isExclusivelyTypeOnlyImportOrExport(decl: ImportDeclaration | ExportDeclaration) {
        if (isExportDeclaration(decl)) {
            return decl.isTypeOnly;
        }
        if (decl.importClause?.isTypeOnly) {
            return true;
        }
        return false;
    }

    /* @internal */
    export function getModeForUsageLocation(file: {impliedNodeFormat?: SourceFile["impliedNodeFormat"]}, usage: StringLiteralLike) {
        if (file.impliedNodeFormat === undefined) return undefined;
        if ((isImportDeclaration(usage.parent) || isExportDeclaration(usage.parent))) {
            const isTypeOnly = isExclusivelyTypeOnlyImportOrExport(usage.parent);
            if (isTypeOnly) {
                const override = getResolutionModeOverrideForClause(usage.parent.assertClause);
                if (override) {
                    return override;
                }
            }
        }
        if (usage.parent.parent && isImportTypeNode(usage.parent.parent)) {
            const override = getResolutionModeOverrideForClause(usage.parent.parent.assertions?.assertClause);
            if (override) {
                return override;
            }
        }
        if (file.impliedNodeFormat !== ModuleKind.ESNext) {
            // in cjs files, import call expressions are esm format, otherwise everything is cjs
            return isImportCall(walkUpParenthesizedExpressions(usage.parent)) ? ModuleKind.ESNext : ModuleKind.CommonJS;
        }
        // in esm files, import=require statements are cjs format, otherwise everything is esm
        // imports are only parent'd up to their containing declaration/expression, so access farther parents with care
        const exprParentParent = walkUpParenthesizedExpressions(usage.parent)?.parent;
        return exprParentParent && isImportEqualsDeclaration(exprParentParent) ? ModuleKind.CommonJS : ModuleKind.ESNext;
    }

    /* @internal */
    export function getResolutionModeOverrideForClause(clause: AssertClause | undefined, grammarErrorOnNode?: (node: Node, diagnostic: DiagnosticMessage) => boolean) {
        if (!clause) return undefined;
        if (length(clause.elements) !== 1) {
            grammarErrorOnNode?.(clause, Diagnostics.Type_import_assertions_should_have_exactly_one_key_resolution_mode_with_value_import_or_require);
            return undefined;
        }
        const elem = clause.elements[0];
        if (!isStringLiteralLike(elem.name)) return undefined;
        if (elem.name.text !== "resolution-mode") {
            grammarErrorOnNode?.(elem.name, Diagnostics.resolution_mode_is_the_only_valid_key_for_type_import_assertions);
            return undefined;
        }
        if (!isStringLiteralLike(elem.value)) return undefined;
        if (elem.value.text !== "import" && elem.value.text !== "require") {
            grammarErrorOnNode?.(elem.value, Diagnostics.resolution_mode_should_be_either_require_or_import);
            return undefined;
        }
        return elem.value.text === "import" ? ModuleKind.ESNext : ModuleKind.CommonJS;
    }

    /* @internal */
    export function loadWithModeAwareCache<T>(names: string[], containingFile: SourceFile, containingFileName: string, redirectedReference: ResolvedProjectReference | undefined, loader: (name: string, resolverMode: ModuleKind.CommonJS | ModuleKind.ESNext | undefined, containingFileName: string, redirectedReference: ResolvedProjectReference | undefined) => T): T[] {
        if (names.length === 0) {
            return [];
        }
        const resolutions: T[] = [];
        const cache = new Map<string, T>();
        let i = 0;
        for (const name of names) {
            let result: T;
            const mode = getModeForResolutionAtIndex(containingFile, i);
            i++;
            const cacheKey = mode !== undefined ? `${mode}|${name}` : name;
            if (cache.has(cacheKey)) {
                result = cache.get(cacheKey)!;
            }
            else {
                cache.set(cacheKey, result = loader(name, mode, containingFileName, redirectedReference));
            }
            resolutions.push(result);
        }
        return resolutions;
    }

    /* @internal */
    export function forEachResolvedProjectReference<T>(
        resolvedProjectReferences: readonly (ResolvedProjectReference | undefined)[] | undefined,
        cb: (resolvedProjectReference: ResolvedProjectReference, parent: ResolvedProjectReference | undefined) => T | undefined
    ): T | undefined {
        return forEachProjectReference(/*projectReferences*/ undefined, resolvedProjectReferences, (resolvedRef, parent) => resolvedRef && cb(resolvedRef, parent));
    }

    function forEachProjectReference<T>(
        projectReferences: readonly ProjectReference[] | undefined,
        resolvedProjectReferences: readonly (ResolvedProjectReference | undefined)[] | undefined,
        cbResolvedRef: (resolvedRef: ResolvedProjectReference | undefined, parent: ResolvedProjectReference | undefined, index: number) => T | undefined,
        cbRef?: (projectReferences: readonly ProjectReference[] | undefined, parent: ResolvedProjectReference | undefined) => T | undefined
    ): T | undefined {
        let seenResolvedRefs: Set<Path> | undefined;

        return worker(projectReferences, resolvedProjectReferences, /*parent*/ undefined);

        function worker(
            projectReferences: readonly ProjectReference[] | undefined,
            resolvedProjectReferences: readonly (ResolvedProjectReference | undefined)[] | undefined,
            parent: ResolvedProjectReference | undefined,
        ): T | undefined {

            // Visit project references first
            if (cbRef) {
                const result = cbRef(projectReferences, parent);
                if (result) return result;
            }

            return forEach(resolvedProjectReferences, (resolvedRef, index) => {
                if (resolvedRef && seenResolvedRefs?.has(resolvedRef.sourceFile.path)) {
                    // ignore recursives
                    return undefined;
                }

                const result = cbResolvedRef(resolvedRef, parent, index);
                if (result || !resolvedRef) return result;

                (seenResolvedRefs ||= new Set()).add(resolvedRef.sourceFile.path);
                return worker(resolvedRef.commandLine.projectReferences, resolvedRef.references, resolvedRef);
            });
        }
    }

    /* @internal */
    export const inferredTypesContainingFile = "__inferred type names__.ts";

    interface DiagnosticCache<T extends Diagnostic> {
        perFile?: ESMap<Path, readonly T[]>;
        allDiagnostics?: readonly T[];
    }

    /*@internal*/
    export function isReferencedFile(reason: FileIncludeReason | undefined): reason is ReferencedFile {
        switch (reason?.kind) {
            case FileIncludeKind.Import:
            case FileIncludeKind.ReferenceFile:
            case FileIncludeKind.TypeReferenceDirective:
            case FileIncludeKind.LibReferenceDirective:
                return true;
            default:
                return false;
        }
    }

    /*@internal*/
    export interface ReferenceFileLocation {
        file: SourceFile;
        pos: number;
        end: number;
        packageId: PackageId | undefined;
    }

    /*@internal*/
    export interface SyntheticReferenceFileLocation {
        file: SourceFile;
        packageId: PackageId | undefined;
        text: string;
    }

    /*@internal*/
    export function isReferenceFileLocation(location: ReferenceFileLocation | SyntheticReferenceFileLocation): location is ReferenceFileLocation {
        return (location as ReferenceFileLocation).pos !== undefined;
    }

    /*@internal*/
    export function getReferencedFileLocation(getSourceFileByPath: (path: Path) => SourceFile | undefined, ref: ReferencedFile): ReferenceFileLocation | SyntheticReferenceFileLocation {
        const file = Debug.checkDefined(getSourceFileByPath(ref.file));
        const { kind, index } = ref;
        let pos: number | undefined, end: number | undefined, packageId: PackageId | undefined, resolutionMode: FileReference["resolutionMode"] | undefined;
        switch (kind) {
            case FileIncludeKind.Import:
                const importLiteral = getModuleNameStringLiteralAt(file, index);
                packageId = file.resolvedModules?.get(importLiteral.text, getModeForResolutionAtIndex(file, index))?.packageId;
                if (importLiteral.pos === -1) return { file, packageId, text: importLiteral.text };
                pos = skipTrivia(file.text, importLiteral.pos);
                end = importLiteral.end;
                break;
            case FileIncludeKind.ReferenceFile:
                ({ pos, end } = file.referencedFiles[index]);
                break;
            case FileIncludeKind.TypeReferenceDirective:
                ({ pos, end, resolutionMode } = file.typeReferenceDirectives[index]);
                packageId = file.resolvedTypeReferenceDirectiveNames?.get(toFileNameLowerCase(file.typeReferenceDirectives[index].fileName), resolutionMode || file.impliedNodeFormat)?.packageId;
                break;
            case FileIncludeKind.LibReferenceDirective:
                ({ pos, end } = file.libReferenceDirectives[index]);
                break;
            default:
                return Debug.assertNever(kind);
        }
        return { file, pos, end, packageId };
    }

    /**
     * Determines if program structure is upto date or needs to be recreated
     */
    /* @internal */
    export function isProgramUptoDate(
        program: Program | undefined,
        rootFileNames: string[],
        newOptions: CompilerOptions,
        getSourceVersion: (path: Path, fileName: string) => string | undefined,
        fileExists: (fileName: string) => boolean,
        hasInvalidatedResolution: HasInvalidatedResolution,
        hasChangedAutomaticTypeDirectiveNames: HasChangedAutomaticTypeDirectiveNames | undefined,
        getParsedCommandLine: (fileName: string) => ParsedCommandLine | undefined,
        projectReferences: readonly ProjectReference[] | undefined
    ): boolean {
        // If we haven't created a program yet or have changed automatic type directives, then it is not up-to-date
        if (!program || hasChangedAutomaticTypeDirectiveNames?.()) return false;

        // If root file names don't match
        if (!arrayIsEqualTo(program.getRootFileNames(), rootFileNames)) return false;

        let seenResolvedRefs: ResolvedProjectReference[] | undefined;

        // If project references don't match
        if (!arrayIsEqualTo(program.getProjectReferences(), projectReferences, projectReferenceUptoDate)) return false;

        // If any file is not up-to-date, then the whole program is not up-to-date
        if (program.getSourceFiles().some(sourceFileNotUptoDate)) return false;

        // If any of the missing file paths are now created
        if (program.getMissingFilePaths().some(fileExists)) return false;

        const currentOptions = program.getCompilerOptions();
        // If the compilation settings do no match, then the program is not up-to-date
        if (!compareDataObjects(currentOptions, newOptions)) return false;

        // If everything matches but the text of config file is changed,
        // error locations can change for program options, so update the program
        if (currentOptions.configFile && newOptions.configFile) return currentOptions.configFile.text === newOptions.configFile.text;

        return true;

        function sourceFileNotUptoDate(sourceFile: SourceFile) {
            return !sourceFileVersionUptoDate(sourceFile) ||
                hasInvalidatedResolution(sourceFile.path);
        }

        function sourceFileVersionUptoDate(sourceFile: SourceFile) {
            return sourceFile.version === getSourceVersion(sourceFile.resolvedPath, sourceFile.fileName);
        }

        function projectReferenceUptoDate(oldRef: ProjectReference, newRef: ProjectReference, index: number) {
            return projectReferenceIsEqualTo(oldRef, newRef) &&
                resolvedProjectReferenceUptoDate(program!.getResolvedProjectReferences()![index], oldRef);
        }

        function resolvedProjectReferenceUptoDate(oldResolvedRef: ResolvedProjectReference | undefined, oldRef: ProjectReference): boolean {
            if (oldResolvedRef) {
                    // Assume true
                if (contains(seenResolvedRefs, oldResolvedRef)) return true;

                const refPath = resolveProjectReferencePath(oldRef);
                const newParsedCommandLine = getParsedCommandLine(refPath);

                // Check if config file exists
                if (!newParsedCommandLine) return false;

                // If change in source file
                if (oldResolvedRef.commandLine.options.configFile !== newParsedCommandLine.options.configFile) return false;

                // check file names
                if (!arrayIsEqualTo(oldResolvedRef.commandLine.fileNames, newParsedCommandLine.fileNames)) return false;

                // Add to seen before checking the referenced paths of this config file
                (seenResolvedRefs || (seenResolvedRefs = [])).push(oldResolvedRef);

                // If child project references are upto date, this project reference is uptodate
                return !forEach(oldResolvedRef.references, (childResolvedRef, index) =>
                    !resolvedProjectReferenceUptoDate(childResolvedRef, oldResolvedRef.commandLine.projectReferences![index]));
            }

            // In old program, not able to resolve project reference path,
            // so if config file doesnt exist, it is uptodate.
            const refPath = resolveProjectReferencePath(oldRef);
            return !getParsedCommandLine(refPath);
        }
    }

    export function getConfigFileParsingDiagnostics(configFileParseResult: ParsedCommandLine): readonly Diagnostic[] {
        return configFileParseResult.options.configFile ?
            [...configFileParseResult.options.configFile.parseDiagnostics, ...configFileParseResult.errors] :
            configFileParseResult.errors;
    }

    /**
     * A function for determining if a given file is esm or cjs format, assuming modern node module resolution rules, as configured by the
     * `options` parameter.
     *
     * @param fileName The normalized absolute path to check the format of (it need not exist on disk)
     * @param [packageJsonInfoCache] A cache for package file lookups - it's best to have a cache when this function is called often
     * @param host The ModuleResolutionHost which can perform the filesystem lookups for package json data
     * @param options The compiler options to perform the analysis under - relevant options are `moduleResolution` and `traceResolution`
     * @returns `undefined` if the path has no relevant implied format, `ModuleKind.ESNext` for esm format, and `ModuleKind.CommonJS` for cjs format
     */
    export function getImpliedNodeFormatForFile(fileName: Path, packageJsonInfoCache: PackageJsonInfoCache | undefined, host: ModuleResolutionHost, options: CompilerOptions): ModuleKind.ESNext | ModuleKind.CommonJS | undefined {
        switch (getEmitModuleResolutionKind(options)) {
            case ModuleResolutionKind.Node12:
            case ModuleResolutionKind.NodeNext:
                return fileExtensionIsOneOf(fileName, [Extension.Dmts, Extension.Mts, Extension.Mjs]) ? ModuleKind.ESNext :
                    fileExtensionIsOneOf(fileName, [Extension.Dcts, Extension.Cts, Extension.Cjs]) ? ModuleKind.CommonJS :
                    fileExtensionIsOneOf(fileName, [Extension.Dts, Extension.Ts, Extension.Tsx, Extension.Js, Extension.Jsx]) ? lookupFromPackageJson() :
                    undefined; // other extensions, like `json` or `tsbuildinfo`, are set as `undefined` here but they should never be fed through the transformer pipeline
            default:
                return undefined;
        }
        function lookupFromPackageJson(): ModuleKind.ESNext | ModuleKind.CommonJS {
            const scope = getPackageScopeForPath(fileName, packageJsonInfoCache, host, options);
            return scope?.packageJsonContent.type === "module" ? ModuleKind.ESNext : ModuleKind.CommonJS;

        }
    }

    /** @internal */
    export const plainJSErrors: Set<number> = new Set([
        // binder errors
        Diagnostics.Cannot_redeclare_block_scoped_variable_0.code,
        Diagnostics.A_module_cannot_have_multiple_default_exports.code,
        Diagnostics.Another_export_default_is_here.code,
        Diagnostics.The_first_export_default_is_here.code,
        Diagnostics.Identifier_expected_0_is_a_reserved_word_at_the_top_level_of_a_module.code,
        Diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode_Modules_are_automatically_in_strict_mode.code,
        Diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here.code,
        Diagnostics.constructor_is_a_reserved_word.code,
        Diagnostics.delete_cannot_be_called_on_an_identifier_in_strict_mode.code,
        Diagnostics.Code_contained_in_a_class_is_evaluated_in_JavaScript_s_strict_mode_which_does_not_allow_this_use_of_0_For_more_information_see_https_Colon_Slash_Slashdeveloper_mozilla_org_Slashen_US_Slashdocs_SlashWeb_SlashJavaScript_SlashReference_SlashStrict_mode.code,
        Diagnostics.Invalid_use_of_0_Modules_are_automatically_in_strict_mode.code,
        Diagnostics.Invalid_use_of_0_in_strict_mode.code,
        Diagnostics.A_label_is_not_allowed_here.code,
        Diagnostics.Octal_literals_are_not_allowed_in_strict_mode.code,
        Diagnostics.with_statements_are_not_allowed_in_strict_mode.code,
        // grammar errors
        Diagnostics.A_break_statement_can_only_be_used_within_an_enclosing_iteration_or_switch_statement.code,
        Diagnostics.A_break_statement_can_only_jump_to_a_label_of_an_enclosing_statement.code,
        Diagnostics.A_class_declaration_without_the_default_modifier_must_have_a_name.code,
        Diagnostics.A_class_member_cannot_have_the_0_keyword.code,
        Diagnostics.A_comma_expression_is_not_allowed_in_a_computed_property_name.code,
        Diagnostics.A_continue_statement_can_only_be_used_within_an_enclosing_iteration_statement.code,
        Diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement.code,
        Diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement.code,
        Diagnostics.A_default_clause_cannot_appear_more_than_once_in_a_switch_statement.code,
        Diagnostics.A_default_export_must_be_at_the_top_level_of_a_file_or_module_declaration.code,
        Diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context.code,
        Diagnostics.A_destructuring_declaration_must_have_an_initializer.code,
        Diagnostics.A_get_accessor_cannot_have_parameters.code,
        Diagnostics.A_rest_element_cannot_contain_a_binding_pattern.code,
        Diagnostics.A_rest_element_cannot_have_a_property_name.code,
        Diagnostics.A_rest_element_cannot_have_an_initializer.code,
        Diagnostics.A_rest_element_must_be_last_in_a_destructuring_pattern.code,
        Diagnostics.A_rest_parameter_cannot_have_an_initializer.code,
        Diagnostics.A_rest_parameter_must_be_last_in_a_parameter_list.code,
        Diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma.code,
        Diagnostics.A_return_statement_can_only_be_used_within_a_function_body.code,
        Diagnostics.A_return_statement_cannot_be_used_inside_a_class_static_block.code,
        Diagnostics.A_set_accessor_cannot_have_rest_parameter.code,
        Diagnostics.A_set_accessor_must_have_exactly_one_parameter.code,
        Diagnostics.An_export_declaration_can_only_be_used_at_the_top_level_of_a_module.code,
        Diagnostics.An_export_declaration_cannot_have_modifiers.code,
        Diagnostics.An_import_declaration_can_only_be_used_at_the_top_level_of_a_module.code,
        Diagnostics.An_import_declaration_cannot_have_modifiers.code,
        Diagnostics.An_object_member_cannot_be_declared_optional.code,
        Diagnostics.Argument_of_dynamic_import_cannot_be_spread_element.code,
        Diagnostics.Cannot_assign_to_private_method_0_Private_methods_are_not_writable.code,
        Diagnostics.Cannot_redeclare_identifier_0_in_catch_clause.code,
        Diagnostics.Catch_clause_variable_cannot_have_an_initializer.code,
        Diagnostics.Class_decorators_can_t_be_used_with_static_private_identifier_Consider_removing_the_experimental_decorator.code,
        Diagnostics.Classes_can_only_extend_a_single_class.code,
        Diagnostics.Classes_may_not_have_a_field_named_constructor.code,
        Diagnostics.Did_you_mean_to_use_a_Colon_An_can_only_follow_a_property_name_when_the_containing_object_literal_is_part_of_a_destructuring_pattern.code,
        Diagnostics.Duplicate_label_0.code,
        Diagnostics.Dynamic_imports_can_only_accept_a_module_specifier_and_an_optional_assertion_as_arguments.code,
        Diagnostics.For_await_loops_cannot_be_used_inside_a_class_static_block.code,
        Diagnostics.JSX_attributes_must_only_be_assigned_a_non_empty_expression.code,
        Diagnostics.JSX_elements_cannot_have_multiple_attributes_with_the_same_name.code,
        Diagnostics.JSX_expressions_may_not_use_the_comma_operator_Did_you_mean_to_write_an_array.code,
        Diagnostics.JSX_property_access_expressions_cannot_include_JSX_namespace_names.code,
        Diagnostics.Jump_target_cannot_cross_function_boundary.code,
        Diagnostics.Line_terminator_not_permitted_before_arrow.code,
        Diagnostics.Modifiers_cannot_appear_here.code,
        Diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_in_statement.code,
        Diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_of_statement.code,
        Diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies.code,
        Diagnostics.Private_identifiers_are_only_allowed_in_class_bodies_and_may_only_be_used_as_part_of_a_class_member_declaration_property_access_or_on_the_left_hand_side_of_an_in_expression.code,
        Diagnostics.Property_0_is_not_accessible_outside_class_1_because_it_has_a_private_identifier.code,
        Diagnostics.Tagged_template_expressions_are_not_permitted_in_an_optional_chain.code,
        Diagnostics.The_left_hand_side_of_a_for_of_statement_may_not_be_async.code,
        Diagnostics.The_variable_declaration_of_a_for_in_statement_cannot_have_an_initializer.code,
        Diagnostics.The_variable_declaration_of_a_for_of_statement_cannot_have_an_initializer.code,
        Diagnostics.Trailing_comma_not_allowed.code,
        Diagnostics.Variable_declaration_list_cannot_be_empty.code,
        Diagnostics._0_and_1_operations_cannot_be_mixed_without_parentheses.code,
        Diagnostics._0_expected.code,
        Diagnostics._0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2.code,
        Diagnostics._0_list_cannot_be_empty.code,
        Diagnostics._0_modifier_already_seen.code,
        Diagnostics._0_modifier_cannot_appear_on_a_constructor_declaration.code,
        Diagnostics._0_modifier_cannot_appear_on_a_module_or_namespace_element.code,
        Diagnostics._0_modifier_cannot_appear_on_a_parameter.code,
        Diagnostics._0_modifier_cannot_appear_on_class_elements_of_this_kind.code,
        Diagnostics._0_modifier_cannot_be_used_here.code,
        Diagnostics._0_modifier_must_precede_1_modifier.code,
        Diagnostics.const_declarations_can_only_be_declared_inside_a_block.code,
        Diagnostics.const_declarations_must_be_initialized.code,
        Diagnostics.extends_clause_already_seen.code,
        Diagnostics.let_declarations_can_only_be_declared_inside_a_block.code,
        Diagnostics.let_is_not_allowed_to_be_used_as_a_name_in_let_or_const_declarations.code,
    ]);

    /**
     * Determine if source file needs to be re-created even if its text hasn't changed
     */
    function shouldProgramCreateNewSourceFiles(program: Program | undefined, newOptions: CompilerOptions): boolean {
        if (!program) return false;
        // If any compiler options change, we can't reuse old source file even if version match
        // The change in options like these could result in change in syntax tree or `sourceFile.bindDiagnostics`.
        return optionsHaveChanges(program.getCompilerOptions(), newOptions, sourceFileAffectingCompilerOptions);
    }

    function createCreateProgramOptions(rootNames: readonly string[], options: CompilerOptions, host?: CompilerHost, oldProgram?: Program, configFileParsingDiagnostics?: readonly Diagnostic[]): CreateProgramOptions {
        return {
            rootNames,
            options,
            host,
            oldProgram,
            configFileParsingDiagnostics
        };
    }

    /**
     * Create a new 'Program' instance. A Program is an immutable collection of 'SourceFile's and a 'CompilerOptions'
     * that represent a compilation unit.
     *
     * Creating a program proceeds from a set of root files, expanding the set of inputs by following imports and
     * triple-slash-reference-path directives transitively. '@types' and triple-slash-reference-types are also pulled in.
     *
     * @param createProgramOptions - The options for creating a program.
     * @returns A 'Program' object.
     */
    export function createProgram(createProgramOptions: CreateProgramOptions): Program;
    /**
     * Create a new 'Program' instance. A Program is an immutable collection of 'SourceFile's and a 'CompilerOptions'
     * that represent a compilation unit.
     *
     * Creating a program proceeds from a set of root files, expanding the set of inputs by following imports and
     * triple-slash-reference-path directives transitively. '@types' and triple-slash-reference-types are also pulled in.
     *
     * @param rootNames - A set of root files.
     * @param options - The compiler options which should be used.
     * @param host - The host interacts with the underlying file system.
     * @param oldProgram - Reuses an old program structure.
     * @param configFileParsingDiagnostics - error during config file parsing
     * @returns A 'Program' object.
     */
    export function createProgram(rootNames: readonly string[], options: CompilerOptions, host?: CompilerHost, oldProgram?: Program, configFileParsingDiagnostics?: readonly Diagnostic[]): Program;
    export function createProgram(rootNamesOrOptions: readonly string[] | CreateProgramOptions, _options?: CompilerOptions, _host?: CompilerHost, _oldProgram?: Program, _configFileParsingDiagnostics?: readonly Diagnostic[]): Program {
        const createProgramOptions = isArray(rootNamesOrOptions) ? createCreateProgramOptions(rootNamesOrOptions, _options!, _host, _oldProgram, _configFileParsingDiagnostics) : rootNamesOrOptions; // TODO: GH#18217
        const { rootNames, options, configFileParsingDiagnostics, projectReferences } = createProgramOptions;
        let { oldProgram } = createProgramOptions;

        let processingDefaultLibFiles: SourceFile[] | undefined;
        let processingOtherFiles: SourceFile[] | undefined;
        let files: SourceFile[];
        let symlinks: SymlinkCache | undefined;
        let commonSourceDirectory: string;
        let typeChecker: TypeChecker;
        let classifiableNames: Set<__String>;
        const ambientModuleNameToUnmodifiedFileName = new Map<string, string>();
        let fileReasons = createMultiMap<Path, FileIncludeReason>();
        const cachedBindAndCheckDiagnosticsForFile: DiagnosticCache<Diagnostic> = {};
        const cachedDeclarationDiagnosticsForFile: DiagnosticCache<DiagnosticWithLocation> = {};

        let resolvedTypeReferenceDirectives = createModeAwareCache<ResolvedTypeReferenceDirective | undefined>();
        let fileProcessingDiagnostics: FilePreprocessingDiagnostics[] | undefined;

        // The below settings are to track if a .js file should be add to the program if loaded via searching under node_modules.
        // This works as imported modules are discovered recursively in a depth first manner, specifically:
        // - For each root file, findSourceFile is called.
        // - This calls processImportedModules for each module imported in the source file.
        // - This calls resolveModuleNames, and then calls findSourceFile for each resolved module.
        // As all these operations happen - and are nested - within the createProgram call, they close over the below variables.
        // The current resolution depth is tracked by incrementing/decrementing as the depth first search progresses.
        const maxNodeModuleJsDepth = typeof options.maxNodeModuleJsDepth === "number" ? options.maxNodeModuleJsDepth : 0;
        let currentNodeModulesDepth = 0;

        // If a module has some of its imports skipped due to being at the depth limit under node_modules, then track
        // this, as it may be imported at a shallower depth later, and then it will need its skipped imports processed.
        const modulesWithElidedImports = new Map<string, boolean>();

        // Track source files that are source files found by searching under node_modules, as these shouldn't be compiled.
        const sourceFilesFoundSearchingNodeModules = new Map<string, boolean>();

        tracing?.push(tracing.Phase.Program, "createProgram", { configFilePath: options.configFilePath, rootDir: options.rootDir }, /*separateBeginAndEnd*/ true);
        performance.mark("beforeProgram");

        const host = createProgramOptions.host || createCompilerHost(options);
        const configParsingHost = parseConfigHostFromCompilerHostLike(host);

        let skipDefaultLib = options.noLib;
        const getDefaultLibraryFileName = memoize(() => host.getDefaultLibFileName(options));
        const defaultLibraryPath = host.getDefaultLibLocation ? host.getDefaultLibLocation() : getDirectoryPath(getDefaultLibraryFileName());
        const programDiagnostics = createDiagnosticCollection();
        const currentDirectory = host.getCurrentDirectory();
        const supportedExtensions = getSupportedExtensions(options);
        const supportedExtensionsWithJsonIfResolveJsonModule = getSupportedExtensionsWithJsonIfResolveJsonModule(options, supportedExtensions);

        // Map storing if there is emit blocking diagnostics for given input
        const hasEmitBlockingDiagnostics = new Map<string, boolean>();
        let _compilerOptionsObjectLiteralSyntax: ObjectLiteralExpression | false | undefined;

        let moduleResolutionCache: ModuleResolutionCache | undefined;
        let typeReferenceDirectiveResolutionCache: TypeReferenceDirectiveResolutionCache | undefined;
        let actualResolveModuleNamesWorker: (moduleNames: string[], containingFile: SourceFile, containingFileName: string, reusedNames?: string[], redirectedReference?: ResolvedProjectReference) => ResolvedModuleFull[];
        const hasInvalidatedResolution = host.hasInvalidatedResolution || returnFalse;
        if (host.resolveModuleNames) {
            actualResolveModuleNamesWorker = (moduleNames, containingFile, containingFileName, reusedNames, redirectedReference) => host.resolveModuleNames!(Debug.checkEachDefined(moduleNames), containingFileName, reusedNames, redirectedReference, options, containingFile).map(resolved => {
                // An older host may have omitted extension, in which case we should infer it from the file extension of resolvedFileName.
                if (!resolved || (resolved as ResolvedModuleFull).extension !== undefined) {
                    return resolved as ResolvedModuleFull;
                }
                const withExtension = clone(resolved) as ResolvedModuleFull;
                withExtension.extension = extensionFromPath(resolved.resolvedFileName);
                return withExtension;
            });
            moduleResolutionCache = host.getModuleResolutionCache?.();
        }
        else {
            moduleResolutionCache = createModuleResolutionCache(currentDirectory, getCanonicalFileName, options);
            const loader = (moduleName: string, resolverMode: ModuleKind.CommonJS | ModuleKind.ESNext | undefined, containingFileName: string, redirectedReference: ResolvedProjectReference | undefined) => resolveModuleName(moduleName, containingFileName, options, host, moduleResolutionCache, redirectedReference, resolverMode).resolvedModule!; // TODO: GH#18217
            actualResolveModuleNamesWorker = (moduleNames, containingFile, containingFileName, _reusedNames, redirectedReference) => loadWithModeAwareCache<ResolvedModuleFull>(Debug.checkEachDefined(moduleNames), containingFile, containingFileName, redirectedReference, loader);
        }

        let actualResolveTypeReferenceDirectiveNamesWorker: (typeDirectiveNames: string[] | readonly FileReference[], containingFile: string, redirectedReference?: ResolvedProjectReference, containingFileMode?: SourceFile["impliedNodeFormat"] | undefined) => (ResolvedTypeReferenceDirective | undefined)[];
        if (host.resolveTypeReferenceDirectives) {
            actualResolveTypeReferenceDirectiveNamesWorker = (typeDirectiveNames, containingFile, redirectedReference, containingFileMode) => host.resolveTypeReferenceDirectives!(Debug.checkEachDefined(typeDirectiveNames), containingFile, redirectedReference, options, containingFileMode);
        }
        else {
            typeReferenceDirectiveResolutionCache = createTypeReferenceDirectiveResolutionCache(currentDirectory, getCanonicalFileName, /*options*/ undefined, moduleResolutionCache?.getPackageJsonInfoCache());
            const loader = (typesRef: string, containingFile: string, redirectedReference: ResolvedProjectReference | undefined, resolutionMode: SourceFile["impliedNodeFormat"] | undefined) => resolveTypeReferenceDirective(
                typesRef,
                containingFile,
                options,
                host,
                redirectedReference,
                typeReferenceDirectiveResolutionCache,
                resolutionMode,
            ).resolvedTypeReferenceDirective!; // TODO: GH#18217
            actualResolveTypeReferenceDirectiveNamesWorker = (typeReferenceDirectiveNames, containingFile, redirectedReference, containingFileMode) => loadWithTypeDirectiveCache<ResolvedTypeReferenceDirective>(Debug.checkEachDefined(typeReferenceDirectiveNames), containingFile, redirectedReference, containingFileMode, loader);
        }

        // Map from a stringified PackageId to the source file with that id.
        // Only one source file may have a given packageId. Others become redirects (see createRedirectSourceFile).
        // `packageIdToSourceFile` is only used while building the program, while `sourceFileToPackageName` and `isSourceFileTargetOfRedirect` are kept around.
        const packageIdToSourceFile = new Map<string, SourceFile>();
        // Maps from a SourceFile's `.path` to the name of the package it was imported with.
        let sourceFileToPackageName = new Map<Path, string>();
        // Key is a file name. Value is the (non-empty, or undefined) list of files that redirect to it.
        let redirectTargetsMap = createMultiMap<Path, string>();
        let usesUriStyleNodeCoreModules = false;

        /**
         * map with
         * - SourceFile if present
         * - false if sourceFile missing for source of project reference redirect
         * - undefined otherwise
         */
        const filesByName = new Map<string, SourceFile | false | undefined>();
        let missingFilePaths: readonly Path[] | undefined;
        // stores 'filename -> file association' ignoring case
        // used to track cases when two file names differ only in casing
        const filesByNameIgnoreCase = host.useCaseSensitiveFileNames() ? new Map<string, SourceFile>() : undefined;

        // A parallel array to projectReferences storing the results of reading in the referenced tsconfig files
        let resolvedProjectReferences: readonly (ResolvedProjectReference | undefined)[] | undefined;
        let projectReferenceRedirects: ESMap<Path, ResolvedProjectReference | false> | undefined;
        let mapFromFileToProjectReferenceRedirects: ESMap<Path, Path> | undefined;
        let mapFromToProjectReferenceRedirectSource: ESMap<Path, SourceOfProjectReferenceRedirect> | undefined;

        const useSourceOfProjectReferenceRedirect = !!host.useSourceOfProjectReferenceRedirect?.() &&
            !options.disableSourceOfProjectReferenceRedirect;
        const { onProgramCreateComplete, fileExists, directoryExists } = updateHostForUseSourceOfProjectReferenceRedirect({
            compilerHost: host,
            getSymlinkCache,
            useSourceOfProjectReferenceRedirect,
            toPath,
            getResolvedProjectReferences,
            getSourceOfProjectReferenceRedirect,
            forEachResolvedProjectReference
        });
        const readFile = host.readFile.bind(host) as typeof host.readFile;

        tracing?.push(tracing.Phase.Program, "shouldProgramCreateNewSourceFiles", { hasOldProgram: !!oldProgram });
        const shouldCreateNewSourceFile = shouldProgramCreateNewSourceFiles(oldProgram, options);
        tracing?.pop();
        // We set `structuralIsReused` to `undefined` because `tryReuseStructureFromOldProgram` calls `tryReuseStructureFromOldProgram` which checks
        // `structuralIsReused`, which would be a TDZ violation if it was not set in advance to `undefined`.
        let structureIsReused: StructureIsReused;
        tracing?.push(tracing.Phase.Program, "tryReuseStructureFromOldProgram", {});
        structureIsReused = tryReuseStructureFromOldProgram(); // eslint-disable-line prefer-const
        tracing?.pop();
        if (structureIsReused !== StructureIsReused.Completely) {
            processingDefaultLibFiles = [];
            processingOtherFiles = [];

            if (projectReferences) {
                if (!resolvedProjectReferences) {
                    resolvedProjectReferences = projectReferences.map(parseProjectReferenceConfigFile);
                }
                if (rootNames.length) {
                    resolvedProjectReferences?.forEach((parsedRef, index) => {
                        if (!parsedRef) return;
                        const out = outFile(parsedRef.commandLine.options);
                        if (useSourceOfProjectReferenceRedirect) {
                            if (out || getEmitModuleKind(parsedRef.commandLine.options) === ModuleKind.None) {
                                for (const fileName of parsedRef.commandLine.fileNames) {
                                    processProjectReferenceFile(fileName, { kind: FileIncludeKind.SourceFromProjectReference, index });
                                }
                            }
                        }
                        else {
                            if (out) {
                                processProjectReferenceFile(changeExtension(out, ".d.ts"), { kind: FileIncludeKind.OutputFromProjectReference, index });
                            }
                            else if (getEmitModuleKind(parsedRef.commandLine.options) === ModuleKind.None) {
                                const getCommonSourceDirectory = memoize(() => getCommonSourceDirectoryOfConfig(parsedRef.commandLine, !host.useCaseSensitiveFileNames()));
                                for (const fileName of parsedRef.commandLine.fileNames) {
                                    if (!fileExtensionIs(fileName, Extension.Dts) && !fileExtensionIs(fileName, Extension.Json)) {
                                        processProjectReferenceFile(getOutputDeclarationFileName(fileName, parsedRef.commandLine, !host.useCaseSensitiveFileNames(), getCommonSourceDirectory), { kind: FileIncludeKind.OutputFromProjectReference, index });
                                    }
                                }
                            }
                        }
                    });
                }
            }

            tracing?.push(tracing.Phase.Program, "processRootFiles", { count: rootNames.length });
            forEach(rootNames, (name, index) => processRootFile(name, /*isDefaultLib*/ false, /*ignoreNoDefaultLib*/ false, { kind: FileIncludeKind.RootFile, index }));
            tracing?.pop();

            // load type declarations specified via 'types' argument or implicitly from types/ and node_modules/@types folders
            const typeReferences: string[] = rootNames.length ? getAutomaticTypeDirectiveNames(options, host) : emptyArray;

            if (typeReferences.length) {
                tracing?.push(tracing.Phase.Program, "processTypeReferences", { count: typeReferences.length });
                // This containingFilename needs to match with the one used in managed-side
                const containingDirectory = options.configFilePath ? getDirectoryPath(options.configFilePath) : host.getCurrentDirectory();
                const containingFilename = combinePaths(containingDirectory, inferredTypesContainingFile);
                const resolutions = resolveTypeReferenceDirectiveNamesWorker(typeReferences, containingFilename);
                for (let i = 0; i < typeReferences.length; i++) {
                    // under node12/nodenext module resolution, load `types`/ata include names as cjs resolution results by passing an `undefined` mode
                    processTypeReferenceDirective(typeReferences[i], /*mode*/ undefined, resolutions[i], { kind: FileIncludeKind.AutomaticTypeDirectiveFile, typeReference: typeReferences[i], packageId: resolutions[i]?.packageId });
                }
                tracing?.pop();
            }

            // Do not process the default library if:
            //  - The '--noLib' flag is used.
            //  - A 'no-default-lib' reference comment is encountered in
            //      processing the root files.
            if (rootNames.length && !skipDefaultLib) {
                // If '--lib' is not specified, include default library file according to '--target'
                // otherwise, using options specified in '--lib' instead of '--target' default library file
                const defaultLibraryFileName = getDefaultLibraryFileName();
                if (!options.lib && defaultLibraryFileName) {
                    processRootFile(defaultLibraryFileName, /*isDefaultLib*/ true, /*ignoreNoDefaultLib*/ false, { kind: FileIncludeKind.LibFile });
                }
                else {
                    forEach(options.lib, (libFileName, index) => {
                        processRootFile(pathForLibFile(libFileName), /*isDefaultLib*/ true, /*ignoreNoDefaultLib*/ false, { kind: FileIncludeKind.LibFile, index });
                    });
                }
            }

            missingFilePaths = arrayFrom(mapDefinedIterator(filesByName.entries(), ([path, file]) => file === undefined ? path as Path : undefined));
            files = stableSort(processingDefaultLibFiles, compareDefaultLibFiles).concat(processingOtherFiles);
            processingDefaultLibFiles = undefined;
            processingOtherFiles = undefined;
        }

        Debug.assert(!!missingFilePaths);

        // Release any files we have acquired in the old program but are
        // not part of the new program.
        if (oldProgram && host.onReleaseOldSourceFile) {
            const oldSourceFiles = oldProgram.getSourceFiles();
            for (const oldSourceFile of oldSourceFiles) {
                const newFile = getSourceFileByPath(oldSourceFile.resolvedPath);
                if (shouldCreateNewSourceFile || !newFile ||
                    // old file wasn't redirect but new file is
                    (oldSourceFile.resolvedPath === oldSourceFile.path && newFile.resolvedPath !== oldSourceFile.path)) {
                    host.onReleaseOldSourceFile(oldSourceFile, oldProgram.getCompilerOptions(), !!getSourceFileByPath(oldSourceFile.path));
                }
            }
            if (!host.getParsedCommandLine) {
                oldProgram.forEachResolvedProjectReference(resolvedProjectReference => {
                    if (!getResolvedProjectReferenceByPath(resolvedProjectReference.sourceFile.path)) {
                        host.onReleaseOldSourceFile!(resolvedProjectReference.sourceFile, oldProgram!.getCompilerOptions(), /*hasSourceFileByPath*/ false);
                    }
                });
            }
        }

        // Release commandlines that new program does not use
        if (oldProgram && host.onReleaseParsedCommandLine) {
            forEachProjectReference(
                oldProgram.getProjectReferences(),
                oldProgram.getResolvedProjectReferences(),
                (oldResolvedRef, parent, index) => {
                    const oldReference = parent?.commandLine.projectReferences![index] || oldProgram!.getProjectReferences()![index];
                    const oldRefPath = resolveProjectReferencePath(oldReference);
                    if (!projectReferenceRedirects?.has(toPath(oldRefPath))) {
                        host.onReleaseParsedCommandLine!(oldRefPath, oldResolvedRef, oldProgram!.getCompilerOptions());
                    }
                }
            );
        }

        typeReferenceDirectiveResolutionCache = undefined;

        // unconditionally set oldProgram to undefined to prevent it from being captured in closure
        oldProgram = undefined;

        const program: Program = {
            getRootFileNames: () => rootNames,
            getSourceFile,
            getSourceFileByPath,
            getSourceFiles: () => files,
            getMissingFilePaths: () => missingFilePaths!, // TODO: GH#18217
            getModuleResolutionCache: () => moduleResolutionCache,
            getFilesByNameMap: () => filesByName,
            getCompilerOptions: () => options,
            getSyntacticDiagnostics,
            getOptionsDiagnostics,
            getGlobalDiagnostics,
            getSemanticDiagnostics,
            getCachedSemanticDiagnostics,
            getSuggestionDiagnostics,
            getDeclarationDiagnostics,
            getBindAndCheckDiagnostics,
            getProgramDiagnostics,
            getTypeChecker,
            getClassifiableNames,
            getCommonSourceDirectory,
            emit,
            getCurrentDirectory: () => currentDirectory,
            getNodeCount: () => getTypeChecker().getNodeCount(),
            getIdentifierCount: () => getTypeChecker().getIdentifierCount(),
            getSymbolCount: () => getTypeChecker().getSymbolCount(),
            getTypeCount: () => getTypeChecker().getTypeCount(),
            getInstantiationCount: () => getTypeChecker().getInstantiationCount(),
            getRelationCacheSizes: () => getTypeChecker().getRelationCacheSizes(),
            getFileProcessingDiagnostics: () => fileProcessingDiagnostics,
            getResolvedTypeReferenceDirectives: () => resolvedTypeReferenceDirectives,
            isSourceFileFromExternalLibrary,
            isSourceFileDefaultLibrary,
            getSourceFileFromReference,
            getLibFileFromReference,
            sourceFileToPackageName,
            redirectTargetsMap,
            usesUriStyleNodeCoreModules,
            isEmittedFile,
            getConfigFileParsingDiagnostics,
            getResolvedModuleWithFailedLookupLocationsFromCache,
            getProjectReferences,
            getResolvedProjectReferences,
            getProjectReferenceRedirect,
            getResolvedProjectReferenceToRedirect,
            getResolvedProjectReferenceByPath,
            forEachResolvedProjectReference,
            isSourceOfProjectReferenceRedirect,
            emitBuildInfo,
            fileExists,
            readFile,
            directoryExists,
            getSymlinkCache,
            realpath: host.realpath?.bind(host),
            useCaseSensitiveFileNames: () => host.useCaseSensitiveFileNames(),
            getFileIncludeReasons: () => fileReasons,
            structureIsReused,
        };

        onProgramCreateComplete();

        // Add file processingDiagnostics
        fileProcessingDiagnostics?.forEach(diagnostic => {
            switch (diagnostic.kind) {
                case FilePreprocessingDiagnosticsKind.FilePreprocessingFileExplainingDiagnostic:
                    return programDiagnostics.add(createDiagnosticExplainingFile(diagnostic.file && getSourceFileByPath(diagnostic.file), diagnostic.fileProcessingReason, diagnostic.diagnostic, diagnostic.args || emptyArray));
                case FilePreprocessingDiagnosticsKind.FilePreprocessingReferencedDiagnostic:
                    const { file, pos, end } = getReferencedFileLocation(getSourceFileByPath, diagnostic.reason) as ReferenceFileLocation;
                    return programDiagnostics.add(createFileDiagnostic(file, Debug.checkDefined(pos), Debug.checkDefined(end) - pos, diagnostic.diagnostic, ...diagnostic.args || emptyArray));
                default:
                    Debug.assertNever(diagnostic);
            }
        });

        verifyCompilerOptions();
        performance.mark("afterProgram");
        performance.measure("Program", "beforeProgram", "afterProgram");
        tracing?.pop();

        return program;

        function resolveModuleNamesWorker(moduleNames: string[], containingFile: SourceFile, reusedNames: string[] | undefined): readonly ResolvedModuleFull[] {
            if (!moduleNames.length) return emptyArray;
            const containingFileName = getNormalizedAbsolutePath(containingFile.originalFileName, currentDirectory);
            const redirectedReference = getRedirectReferenceForResolution(containingFile);
            tracing?.push(tracing.Phase.Program, "resolveModuleNamesWorker", { containingFileName });
            performance.mark("beforeResolveModule");
            const result = actualResolveModuleNamesWorker(moduleNames, containingFile, containingFileName, reusedNames, redirectedReference);
            performance.mark("afterResolveModule");
            performance.measure("ResolveModule", "beforeResolveModule", "afterResolveModule");
            tracing?.pop();
            return result;
        }

        function resolveTypeReferenceDirectiveNamesWorker(typeDirectiveNames: string[] | readonly FileReference[], containingFile: string | SourceFile): readonly (ResolvedTypeReferenceDirective | undefined)[] {
            if (!typeDirectiveNames.length) return [];
            const containingFileName = !isString(containingFile) ? getNormalizedAbsolutePath(containingFile.originalFileName, currentDirectory) : containingFile;
            const redirectedReference = !isString(containingFile) ? getRedirectReferenceForResolution(containingFile) : undefined;
            const containingFileMode = !isString(containingFile) ? containingFile.impliedNodeFormat : undefined;
            tracing?.push(tracing.Phase.Program, "resolveTypeReferenceDirectiveNamesWorker", { containingFileName });
            performance.mark("beforeResolveTypeReference");
            const result = actualResolveTypeReferenceDirectiveNamesWorker(typeDirectiveNames, containingFileName, redirectedReference, containingFileMode);
            performance.mark("afterResolveTypeReference");
            performance.measure("ResolveTypeReference", "beforeResolveTypeReference", "afterResolveTypeReference");
            tracing?.pop();
            return result;
        }

        function getRedirectReferenceForResolution(file: SourceFile) {
            const redirect = getResolvedProjectReferenceToRedirect(file.originalFileName);
            if (redirect || !fileExtensionIsOneOf(file.originalFileName, [Extension.Dts, Extension.Dcts, Extension.Dmts])) return redirect;

            // The originalFileName could not be actual source file name if file found was d.ts from referecned project
            // So in this case try to look up if this is output from referenced project, if it is use the redirected project in that case
            const resultFromDts = getRedirectReferenceForResolutionFromSourceOfProject(file.path);
            if (resultFromDts) return resultFromDts;

            // If preserveSymlinks is true, module resolution wont jump the symlink
            // but the resolved real path may be the .d.ts from project reference
            // Note:: Currently we try the real path only if the
            // file is from node_modules to avoid having to run real path on all file paths
            if (!host.realpath || !options.preserveSymlinks || !stringContains(file.originalFileName, nodeModulesPathPart)) return undefined;
            const realDeclarationPath = toPath(host.realpath(file.originalFileName));
            return realDeclarationPath === file.path ? undefined : getRedirectReferenceForResolutionFromSourceOfProject(realDeclarationPath);
        }

        function getRedirectReferenceForResolutionFromSourceOfProject(filePath: Path) {
            const source = getSourceOfProjectReferenceRedirect(filePath);
            if (isString(source)) return getResolvedProjectReferenceToRedirect(source);
            if (!source) return undefined;
            // Output of .d.ts file so return resolved ref that matches the out file name
            return forEachResolvedProjectReference(resolvedRef => {
                const out = outFile(resolvedRef.commandLine.options);
                if (!out) return undefined;
                return toPath(out) === filePath ? resolvedRef : undefined;
            });
        }

        function compareDefaultLibFiles(a: SourceFile, b: SourceFile) {
            return compareValues(getDefaultLibFilePriority(a), getDefaultLibFilePriority(b));
        }

        function getDefaultLibFilePriority(a: SourceFile) {
            if (containsPath(defaultLibraryPath, a.fileName, /*ignoreCase*/ false)) {
                const basename = getBaseFileName(a.fileName);
                if (basename === "lib.d.ts" || basename === "lib.es6.d.ts") return 0;
                const name = removeSuffix(removePrefix(basename, "lib."), ".d.ts");
                const index = libs.indexOf(name);
                if (index !== -1) return index + 1;
            }
            return libs.length + 2;
        }

        function getResolvedModuleWithFailedLookupLocationsFromCache(moduleName: string, containingFile: string, mode?: ModuleKind.CommonJS | ModuleKind.ESNext): ResolvedModuleWithFailedLookupLocations | undefined {
            return moduleResolutionCache && resolveModuleNameFromCache(moduleName, containingFile, moduleResolutionCache, mode);
        }

        function toPath(fileName: string): Path {
            return ts.toPath(fileName, currentDirectory, getCanonicalFileName);
        }

        function getCommonSourceDirectory() {
            if (commonSourceDirectory === undefined) {
                const emittedFiles = filter(files, file => sourceFileMayBeEmitted(file, program));
                commonSourceDirectory = ts.getCommonSourceDirectory(
                    options,
                    () => mapDefined(emittedFiles, file => file.isDeclarationFile ? undefined : file.fileName),
                    currentDirectory,
                    getCanonicalFileName,
                    commonSourceDirectory => checkSourceFilesBelongToPath(emittedFiles, commonSourceDirectory)
                );
            }
            return commonSourceDirectory;
        }

        function getClassifiableNames() {
            if (!classifiableNames) {
                // Initialize a checker so that all our files are bound.
                getTypeChecker();
                classifiableNames = new Set();

                for (const sourceFile of files) {
                    sourceFile.classifiableNames?.forEach(value => classifiableNames.add(value));
                }
            }

            return classifiableNames;
        }

        function resolveModuleNamesReusingOldState(moduleNames: string[], file: SourceFile): readonly ResolvedModuleFull[] {
            if (structureIsReused === StructureIsReused.Not && !file.ambientModuleNames.length) {
                // If the old program state does not permit reusing resolutions and `file` does not contain locally defined ambient modules,
                // the best we can do is fallback to the default logic.
                return resolveModuleNamesWorker(moduleNames, file, /*reusedNames*/ undefined);
            }

            const oldSourceFile = oldProgram && oldProgram.getSourceFile(file.fileName);
            if (oldSourceFile !== file && file.resolvedModules) {
                // `file` was created for the new program.
                //
                // We only set `file.resolvedModules` via work from the current function,
                // so it is defined iff we already called the current function on `file`.
                // That call happened no later than the creation of the `file` object,
                // which per above occurred during the current program creation.
                // Since we assume the filesystem does not change during program creation,
                // it is safe to reuse resolutions from the earlier call.
                const result: ResolvedModuleFull[] = [];
                let i = 0;
                for (const moduleName of moduleNames) {
                    const resolvedModule = file.resolvedModules.get(moduleName, getModeForResolutionAtIndex(file, i))!;
                    i++;
                    result.push(resolvedModule);
                }
                return result;
            }
            // At this point, we know at least one of the following hold:
            // - file has local declarations for ambient modules
            // - old program state is available
            // With this information, we can infer some module resolutions without performing resolution.

            /** An ordered list of module names for which we cannot recover the resolution. */
            let unknownModuleNames: string[] | undefined;
            /**
             * The indexing of elements in this list matches that of `moduleNames`.
             *
             * Before combining results, result[i] is in one of the following states:
             * * undefined: needs to be recomputed,
             * * predictedToResolveToAmbientModuleMarker: known to be an ambient module.
             * Needs to be reset to undefined before returning,
             * * ResolvedModuleFull instance: can be reused.
             */
            let result: ResolvedModuleFull[] | undefined;
            let reusedNames: string[] | undefined;
            /** A transient placeholder used to mark predicted resolution in the result list. */
            const predictedToResolveToAmbientModuleMarker: ResolvedModuleFull = {} as any;

            for (let i = 0; i < moduleNames.length; i++) {
                const moduleName = moduleNames[i];
                // If the source file is unchanged and doesnt have invalidated resolution, reuse the module resolutions
                if (file === oldSourceFile && !hasInvalidatedResolution(oldSourceFile.path)) {
                    const oldResolvedModule = getResolvedModule(oldSourceFile, moduleName, getModeForResolutionAtIndex(oldSourceFile, i));
                    if (oldResolvedModule) {
                        if (isTraceEnabled(options, host)) {
                            trace(host,
                                oldResolvedModule.packageId ?
                                    Diagnostics.Reusing_resolution_of_module_0_from_1_of_old_program_it_was_successfully_resolved_to_2_with_Package_ID_3 :
                                    Diagnostics.Reusing_resolution_of_module_0_from_1_of_old_program_it_was_successfully_resolved_to_2,
                                moduleName,
                                getNormalizedAbsolutePath(file.originalFileName, currentDirectory),
                                oldResolvedModule.resolvedFileName,
                                oldResolvedModule.packageId && packageIdToString(oldResolvedModule.packageId)
                            );
                        }
                        (result || (result = new Array(moduleNames.length)))[i] = oldResolvedModule;
                        (reusedNames || (reusedNames = [])).push(moduleName);
                        continue;
                    }
                }
                // We know moduleName resolves to an ambient module provided that moduleName:
                // - is in the list of ambient modules locally declared in the current source file.
                // - resolved to an ambient module in the old program whose declaration is in an unmodified file
                //   (so the same module declaration will land in the new program)
                let resolvesToAmbientModuleInNonModifiedFile = false;
                if (contains(file.ambientModuleNames, moduleName)) {
                    resolvesToAmbientModuleInNonModifiedFile = true;
                    if (isTraceEnabled(options, host)) {
                        trace(host, Diagnostics.Module_0_was_resolved_as_locally_declared_ambient_module_in_file_1, moduleName, getNormalizedAbsolutePath(file.originalFileName, currentDirectory));
                    }
                }
                else {
                    resolvesToAmbientModuleInNonModifiedFile = moduleNameResolvesToAmbientModuleInNonModifiedFile(moduleName, i);
                }

                if (resolvesToAmbientModuleInNonModifiedFile) {
                    (result || (result = new Array(moduleNames.length)))[i] = predictedToResolveToAmbientModuleMarker;
                }
                else {
                    // Resolution failed in the old program, or resolved to an ambient module for which we can't reuse the result.
                    (unknownModuleNames || (unknownModuleNames = [])).push(moduleName);
                }
            }

            const resolutions = unknownModuleNames && unknownModuleNames.length
                ? resolveModuleNamesWorker(unknownModuleNames, file, reusedNames)
                : emptyArray;

            // Combine results of resolutions and predicted results
            if (!result) {
                // There were no unresolved/ambient resolutions.
                Debug.assert(resolutions.length === moduleNames.length);
                return resolutions;
            }

            let j = 0;
            for (let i = 0; i < result.length; i++) {
                if (result[i]) {
                    // `result[i]` is either a `ResolvedModuleFull` or a marker.
                    // If it is the former, we can leave it as is.
                    if (result[i] === predictedToResolveToAmbientModuleMarker) {
                        result[i] = undefined!; // TODO: GH#18217
                    }
                }
                else {
                    result[i] = resolutions[j];
                    j++;
                }
            }
            Debug.assert(j === resolutions.length);

            return result;

            // If we change our policy of rechecking failed lookups on each program create,
            // we should adjust the value returned here.
            function moduleNameResolvesToAmbientModuleInNonModifiedFile(moduleName: string, index: number): boolean {
                if (index >= length(oldSourceFile?.imports) + length(oldSourceFile?.moduleAugmentations)) return false; // mode index out of bounds, don't reuse resolution
                const resolutionToFile = getResolvedModule(oldSourceFile, moduleName, oldSourceFile && getModeForResolutionAtIndex(oldSourceFile, index));
                const resolvedFile = resolutionToFile && oldProgram!.getSourceFile(resolutionToFile.resolvedFileName);
                if (resolutionToFile && resolvedFile) {
                    // In the old program, we resolved to an ambient module that was in the same
                    //   place as we expected to find an actual module file.
                    // We actually need to return 'false' here even though this seems like a 'true' case
                    //   because the normal module resolution algorithm will find this anyway.
                    return false;
                }

                // at least one of declarations should come from non-modified source file
                const unmodifiedFile = ambientModuleNameToUnmodifiedFileName.get(moduleName);

                if (!unmodifiedFile) {
                    return false;
                }

                if (isTraceEnabled(options, host)) {
                    trace(host, Diagnostics.Module_0_was_resolved_as_ambient_module_declared_in_1_since_this_file_was_not_modified, moduleName, unmodifiedFile);
                }
                return true;
            }
        }

        function canReuseProjectReferences(): boolean {
            return !forEachProjectReference(
                oldProgram!.getProjectReferences(),
                oldProgram!.getResolvedProjectReferences(),
                (oldResolvedRef, parent, index) => {
                    const newRef = (parent ? parent.commandLine.projectReferences : projectReferences)![index];
                    const newResolvedRef = parseProjectReferenceConfigFile(newRef);
                    if (oldResolvedRef) {
                        // Resolved project reference has gone missing or changed
                        return !newResolvedRef ||
                            newResolvedRef.sourceFile !== oldResolvedRef.sourceFile ||
                            !arrayIsEqualTo(oldResolvedRef.commandLine.fileNames, newResolvedRef.commandLine.fileNames);
                    }
                    else {
                        // A previously-unresolved reference may be resolved now
                        return newResolvedRef !== undefined;
                    }
                },
                (oldProjectReferences, parent) => {
                    // If array of references is changed, we cant resue old program
                    const newReferences = parent ? getResolvedProjectReferenceByPath(parent.sourceFile.path)!.commandLine.projectReferences : projectReferences;
                    return !arrayIsEqualTo(oldProjectReferences, newReferences, projectReferenceIsEqualTo);
                }
            );
        }

        function tryReuseStructureFromOldProgram(): StructureIsReused {
            if (!oldProgram) {
                return StructureIsReused.Not;
            }

            // check properties that can affect structure of the program or module resolution strategy
            // if any of these properties has changed - structure cannot be reused
            const oldOptions = oldProgram.getCompilerOptions();
            if (changesAffectModuleResolution(oldOptions, options)) {
                return StructureIsReused.Not;
            }

            // there is an old program, check if we can reuse its structure
            const oldRootNames = oldProgram.getRootFileNames();
            if (!arrayIsEqualTo(oldRootNames, rootNames)) {
                return StructureIsReused.Not;
            }

            // Check if any referenced project tsconfig files are different
            if (!canReuseProjectReferences()) {
                return StructureIsReused.Not;
            }
            if (projectReferences) {
                resolvedProjectReferences = projectReferences.map(parseProjectReferenceConfigFile);
            }

            // check if program source files has changed in the way that can affect structure of the program
            const newSourceFiles: SourceFile[] = [];
            const modifiedSourceFiles: { oldFile: SourceFile, newFile: SourceFile }[] = [];
            structureIsReused = StructureIsReused.Completely;

            // If the missing file paths are now present, it can change the progam structure,
            // and hence cant reuse the structure.
            // This is same as how we dont reuse the structure if one of the file from old program is now missing
            if (oldProgram.getMissingFilePaths().some(missingFilePath => host.fileExists(missingFilePath))) {
                return StructureIsReused.Not;
            }

            const oldSourceFiles = oldProgram.getSourceFiles();
            const enum SeenPackageName { Exists, Modified }
            const seenPackageNames = new Map<string, SeenPackageName>();

            for (const oldSourceFile of oldSourceFiles) {
                let newSourceFile = host.getSourceFileByPath
                    ? host.getSourceFileByPath(oldSourceFile.fileName, oldSourceFile.resolvedPath, getCreateSourceFileOptions(oldSourceFile.fileName, moduleResolutionCache, host, options), /*onError*/ undefined, shouldCreateNewSourceFile)
                    : host.getSourceFile(oldSourceFile.fileName, getCreateSourceFileOptions(oldSourceFile.fileName, moduleResolutionCache, host, options), /*onError*/ undefined, shouldCreateNewSourceFile); // TODO: GH#18217

                if (!newSourceFile) {
                    return StructureIsReused.Not;
                }

                Debug.assert(!newSourceFile.redirectInfo, "Host should not return a redirect source file from `getSourceFile`");

                let fileChanged: boolean;
                if (oldSourceFile.redirectInfo) {
                    // We got `newSourceFile` by path, so it is actually for the unredirected file.
                    // This lets us know if the unredirected file has changed. If it has we should break the redirect.
                    if (newSourceFile !== oldSourceFile.redirectInfo.unredirected) {
                        // Underlying file has changed. Might not redirect anymore. Must rebuild program.
                        return StructureIsReused.Not;
                    }
                    fileChanged = false;
                    newSourceFile = oldSourceFile; // Use the redirect.
                }
                else if (oldProgram.redirectTargetsMap.has(oldSourceFile.path)) {
                    // If a redirected-to source file changes, the redirect may be broken.
                    if (newSourceFile !== oldSourceFile) {
                        return StructureIsReused.Not;
                    }
                    fileChanged = false;
                }
                else {
                    fileChanged = newSourceFile !== oldSourceFile;
                }

                // Since the project references havent changed, its right to set originalFileName and resolvedPath here
                newSourceFile.path = oldSourceFile.path;
                newSourceFile.originalFileName = oldSourceFile.originalFileName;
                newSourceFile.resolvedPath = oldSourceFile.resolvedPath;
                newSourceFile.fileName = oldSourceFile.fileName;

                const packageName = oldProgram.sourceFileToPackageName.get(oldSourceFile.path);
                if (packageName !== undefined) {
                    // If there are 2 different source files for the same package name and at least one of them changes,
                    // they might become redirects. So we must rebuild the program.
                    const prevKind = seenPackageNames.get(packageName);
                    const newKind = fileChanged ? SeenPackageName.Modified : SeenPackageName.Exists;
                    if ((prevKind !== undefined && newKind === SeenPackageName.Modified) || prevKind === SeenPackageName.Modified) {
                        return StructureIsReused.Not;
                    }
                    seenPackageNames.set(packageName, newKind);
                }

                if (fileChanged) {
                    // The `newSourceFile` object was created for the new program.

                    if (!arrayIsEqualTo(oldSourceFile.libReferenceDirectives, newSourceFile.libReferenceDirectives, fileReferenceIsEqualTo)) {
                        // 'lib' references has changed. Matches behavior in changesAffectModuleResolution
                        structureIsReused = StructureIsReused.SafeModules;
                    }

                    if (oldSourceFile.hasNoDefaultLib !== newSourceFile.hasNoDefaultLib) {
                        // value of no-default-lib has changed
                        // this will affect if default library is injected into the list of files
                        structureIsReused = StructureIsReused.SafeModules;
                    }

                    // check tripleslash references
                    if (!arrayIsEqualTo(oldSourceFile.referencedFiles, newSourceFile.referencedFiles, fileReferenceIsEqualTo)) {
                        // tripleslash references has changed
                        structureIsReused = StructureIsReused.SafeModules;
                    }

                    // check imports and module augmentations
                    collectExternalModuleReferences(newSourceFile);
                    if (!arrayIsEqualTo(oldSourceFile.imports, newSourceFile.imports, moduleNameIsEqualTo)) {
                        // imports has changed
                        structureIsReused = StructureIsReused.SafeModules;
                    }
                    if (!arrayIsEqualTo(oldSourceFile.moduleAugmentations, newSourceFile.moduleAugmentations, moduleNameIsEqualTo)) {
                        // moduleAugmentations has changed
                        structureIsReused = StructureIsReused.SafeModules;
                    }
                    if ((oldSourceFile.flags & NodeFlags.PermanentlySetIncrementalFlags) !== (newSourceFile.flags & NodeFlags.PermanentlySetIncrementalFlags)) {
                        // dynamicImport has changed
                        structureIsReused = StructureIsReused.SafeModules;
                    }

                    if (!arrayIsEqualTo(oldSourceFile.typeReferenceDirectives, newSourceFile.typeReferenceDirectives, fileReferenceIsEqualTo)) {
                        // 'types' references has changed
                        structureIsReused = StructureIsReused.SafeModules;
                    }

                    // tentatively approve the file
                    modifiedSourceFiles.push({ oldFile: oldSourceFile, newFile: newSourceFile });
                }
                else if (hasInvalidatedResolution(oldSourceFile.path)) {
                    // 'module/types' references could have changed
                    structureIsReused = StructureIsReused.SafeModules;

                    // add file to the modified list so that we will resolve it later
                    modifiedSourceFiles.push({ oldFile: oldSourceFile, newFile: newSourceFile });
                }

                // if file has passed all checks it should be safe to reuse it
                newSourceFiles.push(newSourceFile);
            }

            if (structureIsReused !== StructureIsReused.Completely) {
                return structureIsReused;
            }

            const modifiedFiles = modifiedSourceFiles.map(f => f.oldFile);
            for (const oldFile of oldSourceFiles) {
                if (!contains(modifiedFiles, oldFile)) {
                    for (const moduleName of oldFile.ambientModuleNames) {
                        ambientModuleNameToUnmodifiedFileName.set(moduleName, oldFile.fileName);
                    }
                }
            }
            // try to verify results of module resolution
            for (const { oldFile: oldSourceFile, newFile: newSourceFile } of modifiedSourceFiles) {
                const moduleNames = getModuleNames(newSourceFile);
                const resolutions = resolveModuleNamesReusingOldState(moduleNames, newSourceFile);
                // ensure that module resolution results are still correct
                const resolutionsChanged = hasChangesInResolutions(moduleNames, resolutions, oldSourceFile.resolvedModules, oldSourceFile, moduleResolutionIsEqualTo);
                if (resolutionsChanged) {
                    structureIsReused = StructureIsReused.SafeModules;
                    newSourceFile.resolvedModules = zipToModeAwareCache(newSourceFile, moduleNames, resolutions);
                }
                else {
                    newSourceFile.resolvedModules = oldSourceFile.resolvedModules;
                }
                const typesReferenceDirectives = newSourceFile.typeReferenceDirectives;
                const typeReferenceResolutions = resolveTypeReferenceDirectiveNamesWorker(typesReferenceDirectives, newSourceFile);
                // ensure that types resolutions are still correct
                const typeReferenceResolutionsChanged = hasChangesInResolutions(typesReferenceDirectives, typeReferenceResolutions, oldSourceFile.resolvedTypeReferenceDirectiveNames, oldSourceFile, typeDirectiveIsEqualTo);
                if (typeReferenceResolutionsChanged) {
                    structureIsReused = StructureIsReused.SafeModules;
                    newSourceFile.resolvedTypeReferenceDirectiveNames = zipToModeAwareCache(newSourceFile, typesReferenceDirectives, typeReferenceResolutions);
                }
                else {
                    newSourceFile.resolvedTypeReferenceDirectiveNames = oldSourceFile.resolvedTypeReferenceDirectiveNames;
                }
            }

            if (structureIsReused !== StructureIsReused.Completely) {
                return structureIsReused;
            }

            if (changesAffectingProgramStructure(oldOptions, options) || host.hasChangedAutomaticTypeDirectiveNames?.()) {
                return StructureIsReused.SafeModules;
            }

            missingFilePaths = oldProgram.getMissingFilePaths();

            // update fileName -> file mapping
            Debug.assert(newSourceFiles.length === oldProgram.getSourceFiles().length);
            for (const newSourceFile of newSourceFiles) {
                filesByName.set(newSourceFile.path, newSourceFile);
            }
            const oldFilesByNameMap = oldProgram.getFilesByNameMap();
            oldFilesByNameMap.forEach((oldFile, path) => {
                if (!oldFile) {
                    filesByName.set(path, oldFile);
                    return;
                }
                if (oldFile.path === path) {
                    // Set the file as found during node modules search if it was found that way in old progra,
                    if (oldProgram!.isSourceFileFromExternalLibrary(oldFile)) {
                        sourceFilesFoundSearchingNodeModules.set(oldFile.path, true);
                    }
                    return;
                }
                filesByName.set(path, filesByName.get(oldFile.path));
            });

            files = newSourceFiles;
            fileReasons = oldProgram.getFileIncludeReasons();
            fileProcessingDiagnostics = oldProgram.getFileProcessingDiagnostics();
            resolvedTypeReferenceDirectives = oldProgram.getResolvedTypeReferenceDirectives();

            sourceFileToPackageName = oldProgram.sourceFileToPackageName;
            redirectTargetsMap = oldProgram.redirectTargetsMap;
            usesUriStyleNodeCoreModules = oldProgram.usesUriStyleNodeCoreModules;

            return StructureIsReused.Completely;
        }

        function getEmitHost(writeFileCallback?: WriteFileCallback): EmitHost {
            return {
                getPrependNodes,
                getCanonicalFileName,
                getCommonSourceDirectory: program.getCommonSourceDirectory,
                getCompilerOptions: program.getCompilerOptions,
                getCurrentDirectory: () => currentDirectory,
                getNewLine: () => host.getNewLine(),
                getSourceFile: program.getSourceFile,
                getSourceFileByPath: program.getSourceFileByPath,
                getSourceFiles: program.getSourceFiles,
                getLibFileFromReference: program.getLibFileFromReference,
                isSourceFileFromExternalLibrary,
                getResolvedProjectReferenceToRedirect,
                getProjectReferenceRedirect,
                isSourceOfProjectReferenceRedirect,
                getSymlinkCache,
                writeFile: writeFileCallback || (
                    (fileName, data, writeByteOrderMark, onError, sourceFiles) => host.writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles)),
                isEmitBlocked,
                readFile: f => host.readFile(f),
                fileExists: f => {
                    // Use local caches
                    const path = toPath(f);
                    if (getSourceFileByPath(path)) return true;
                    if (contains(missingFilePaths, path)) return false;
                    // Before falling back to the host
                    return host.fileExists(f);
                },
                useCaseSensitiveFileNames: () => host.useCaseSensitiveFileNames(),
                getProgramBuildInfo: () => program.getProgramBuildInfo && program.getProgramBuildInfo(),
                getSourceFileFromReference: (file, ref) => program.getSourceFileFromReference(file, ref),
                redirectTargetsMap,
                getFileIncludeReasons: program.getFileIncludeReasons,
            };
        }

        function emitBuildInfo(writeFileCallback?: WriteFileCallback): EmitResult {
            Debug.assert(!outFile(options));
            tracing?.push(tracing.Phase.Emit, "emitBuildInfo", {}, /*separateBeginAndEnd*/ true);
            performance.mark("beforeEmit");
            const emitResult = emitFiles(
                notImplementedResolver,
                getEmitHost(writeFileCallback),
                /*targetSourceFile*/ undefined,
                /*transformers*/ noTransformers,
                /*emitOnlyDtsFiles*/ false,
                /*onlyBuildInfo*/ true
            );

            performance.mark("afterEmit");
            performance.measure("Emit", "beforeEmit", "afterEmit");
            tracing?.pop();
            return emitResult;
        }

        function getResolvedProjectReferences() {
            return resolvedProjectReferences;
        }

        function getProjectReferences() {
            return projectReferences;
        }

        function getPrependNodes() {
            return createPrependNodes(
                projectReferences,
                (_ref, index) => resolvedProjectReferences![index]?.commandLine,
                fileName => {
                    const path = toPath(fileName);
                    const sourceFile = getSourceFileByPath(path);
                    return sourceFile ? sourceFile.text : filesByName.has(path) ? undefined : host.readFile(path);
                }
            );
        }

        function isSourceFileFromExternalLibrary(file: SourceFile): boolean {
            return !!sourceFilesFoundSearchingNodeModules.get(file.path);
        }

        function isSourceFileDefaultLibrary(file: SourceFile): boolean {
            if (!file.isDeclarationFile) {
                return false;
            }

            if (file.hasNoDefaultLib) {
                return true;
            }

            if (!options.noLib) {
                return false;
            }

            // If '--lib' is not specified, include default library file according to '--target'
            // otherwise, using options specified in '--lib' instead of '--target' default library file
            const equalityComparer = host.useCaseSensitiveFileNames() ? equateStringsCaseSensitive : equateStringsCaseInsensitive;
            if (!options.lib) {
                return equalityComparer(file.fileName, getDefaultLibraryFileName());
            }
            else {
                return some(options.lib, libFileName => equalityComparer(file.fileName, pathForLibFile(libFileName)));
            }
        }

        function getTypeChecker() {
            return typeChecker || (typeChecker = createTypeChecker(program));
        }

        function emit(sourceFile?: SourceFile, writeFileCallback?: WriteFileCallback, cancellationToken?: CancellationToken, emitOnlyDtsFiles?: boolean, transformers?: CustomTransformers, forceDtsEmit?: boolean): EmitResult {
            tracing?.push(tracing.Phase.Emit, "emit", { path: sourceFile?.path }, /*separateBeginAndEnd*/ true);
            const result = runWithCancellationToken(() => emitWorker(program, sourceFile, writeFileCallback, cancellationToken, emitOnlyDtsFiles, transformers, forceDtsEmit));
            tracing?.pop();
            return result;
        }

        function isEmitBlocked(emitFileName: string): boolean {
            return hasEmitBlockingDiagnostics.has(toPath(emitFileName));
        }

        function emitWorker(program: Program, sourceFile: SourceFile | undefined, writeFileCallback: WriteFileCallback | undefined, cancellationToken: CancellationToken | undefined, emitOnlyDtsFiles?: boolean, customTransformers?: CustomTransformers, forceDtsEmit?: boolean): EmitResult {
            if (!forceDtsEmit) {
                const result = handleNoEmitOptions(program, sourceFile, writeFileCallback, cancellationToken);
                if (result) return result;
            }

            const checker = getTypeChecker();
            // Create the emit resolver outside of the "emitTime" tracking code below.  That way
            // any cost associated with it (like type checking) are appropriate associated with
            // the type-checking counter.
            //
            // If the -out option is specified, we should not pass the source file to getEmitResolver.
            // This is because in the -out scenario all files need to be emitted, and therefore all
            // files need to be type checked. And the way to specify that all files need to be type
            // checked is to not pass the file to getEmitResolver.
            const emitResolver = checker.getEmitResolver(outFile(options) ? undefined : sourceFile, cancellationToken);

            performance.mark("beforeEmit");

            const emitTransformers = getTransformers(options, customTransformers, emitOnlyDtsFiles);
            const patchedTransformers: EmitTransformers = {
                scriptTransformers: [transformTsPlus(checker, options, host), transformTailRec(checker, options, host), ...emitTransformers.scriptTransformers],
                declarationTransformers: [transformTsPlusDeclaration(checker, options, host), ...emitTransformers.declarationTransformers]
            }
            const emitResult = emitFiles(
                emitResolver,
                getEmitHost(writeFileCallback),
                sourceFile,
                patchedTransformers,
                emitOnlyDtsFiles,
                /*onlyBuildInfo*/ false,
                forceDtsEmit
            );

            performance.mark("afterEmit");
            performance.measure("Emit", "beforeEmit", "afterEmit");
            return emitResult;
        }

        function getSourceFile(fileName: string): SourceFile | undefined {
            return getSourceFileByPath(toPath(fileName));
        }

        function getSourceFileByPath(path: Path): SourceFile | undefined {
            return filesByName.get(path) || undefined;
        }

        function getDiagnosticsHelper<T extends Diagnostic>(
            sourceFile: SourceFile | undefined,
            getDiagnostics: (sourceFile: SourceFile, cancellationToken: CancellationToken | undefined) => readonly T[],
            cancellationToken: CancellationToken | undefined): readonly T[] {
            if (sourceFile) {
                return getDiagnostics(sourceFile, cancellationToken);
            }
            return sortAndDeduplicateDiagnostics(flatMap(program.getSourceFiles(), sourceFile => {
                if (cancellationToken) {
                    cancellationToken.throwIfCancellationRequested();
                }
                return getDiagnostics(sourceFile, cancellationToken);
            }));
        }

        function getSyntacticDiagnostics(sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly DiagnosticWithLocation[] {
            return getDiagnosticsHelper(sourceFile, getSyntacticDiagnosticsForFile, cancellationToken);
        }

        function getSemanticDiagnostics(sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly Diagnostic[] {
            return getDiagnosticsHelper(sourceFile, getSemanticDiagnosticsForFile, cancellationToken);
        }

        function getCachedSemanticDiagnostics(sourceFile?: SourceFile): readonly Diagnostic[] | undefined {
           return sourceFile
                ? cachedBindAndCheckDiagnosticsForFile.perFile?.get(sourceFile.path)
                : cachedBindAndCheckDiagnosticsForFile.allDiagnostics;
        }

        function getBindAndCheckDiagnostics(sourceFile: SourceFile, cancellationToken?: CancellationToken): readonly Diagnostic[] {
            return getBindAndCheckDiagnosticsForFile(sourceFile, cancellationToken);
        }

        function getProgramDiagnostics(sourceFile: SourceFile): readonly Diagnostic[] {
            if (skipTypeChecking(sourceFile, options, program)) {
                return emptyArray;
            }

            const programDiagnosticsInFile = programDiagnostics.getDiagnostics(sourceFile.fileName);
            if (!sourceFile.commentDirectives?.length) {
                return programDiagnosticsInFile;
            }

            return getDiagnosticsWithPrecedingDirectives(sourceFile, sourceFile.commentDirectives, programDiagnosticsInFile).diagnostics;
        }

        function getDeclarationDiagnostics(sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly DiagnosticWithLocation[] {
            const options = program.getCompilerOptions();
            // collect diagnostics from the program only once if either no source file was specified or out/outFile is set (bundled emit)
            if (!sourceFile || outFile(options)) {
                return getDeclarationDiagnosticsWorker(sourceFile, cancellationToken);
            }
            else {
                return getDiagnosticsHelper(sourceFile, getDeclarationDiagnosticsForFile, cancellationToken);
            }
        }

        function getSyntacticDiagnosticsForFile(sourceFile: SourceFile): readonly DiagnosticWithLocation[] {
            // For JavaScript files, we report semantic errors for using TypeScript-only
            // constructs from within a JavaScript file as syntactic errors.
            if (isSourceFileJS(sourceFile)) {
                if (!sourceFile.additionalSyntacticDiagnostics) {
                    sourceFile.additionalSyntacticDiagnostics = getJSSyntacticDiagnosticsForFile(sourceFile);
                }
                return concatenate(sourceFile.additionalSyntacticDiagnostics, sourceFile.parseDiagnostics);
            }
            return sourceFile.parseDiagnostics;
        }

        function runWithCancellationToken<T>(func: () => T): T {
            try {
                return func();
            }
            catch (e) {
                if (e instanceof OperationCanceledException) {
                    // We were canceled while performing the operation.  Because our type checker
                    // might be a bad state, we need to throw it away.
                    typeChecker = undefined!;
                }

                throw e;
            }
        }

        function getSemanticDiagnosticsForFile(sourceFile: SourceFile, cancellationToken: CancellationToken | undefined): readonly Diagnostic[] {
            return concatenate(
                filterSemanticDiagnostics(getBindAndCheckDiagnosticsForFile(sourceFile, cancellationToken), options),
                getProgramDiagnostics(sourceFile)
            );
        }

        function getBindAndCheckDiagnosticsForFile(sourceFile: SourceFile, cancellationToken: CancellationToken | undefined): readonly Diagnostic[] {
            return getAndCacheDiagnostics(sourceFile, cancellationToken, cachedBindAndCheckDiagnosticsForFile, getBindAndCheckDiagnosticsForFileNoCache);
        }

        function getBindAndCheckDiagnosticsForFileNoCache(sourceFile: SourceFile, cancellationToken: CancellationToken | undefined): readonly Diagnostic[] {
            return runWithCancellationToken(() => {
                if (skipTypeChecking(sourceFile, options, program)) {
                    return emptyArray;
                }

                const typeChecker = getTypeChecker();

                Debug.assert(!!sourceFile.bindDiagnostics);

                const isJs = sourceFile.scriptKind === ScriptKind.JS || sourceFile.scriptKind === ScriptKind.JSX;
                const isCheckJs = isJs && isCheckJsEnabledForFile(sourceFile, options);
                const isPlainJs = isPlainJsFile(sourceFile, options.checkJs);
                const isTsNoCheck = !!sourceFile.checkJsDirective && sourceFile.checkJsDirective.enabled === false;

                // By default, only type-check .ts, .tsx, Deferred, plain JS, checked JS and External
                // - plain JS: .js files with no // ts-check and checkJs: undefined
                // - check JS: .js files with either // ts-check or checkJs: true
                // - external: files that are added by plugins
                const includeBindAndCheckDiagnostics = !isTsNoCheck && (sourceFile.scriptKind === ScriptKind.TS || sourceFile.scriptKind === ScriptKind.TSX
                        || sourceFile.scriptKind === ScriptKind.External || isPlainJs || isCheckJs || sourceFile.scriptKind === ScriptKind.Deferred);
                let bindDiagnostics: readonly Diagnostic[] = includeBindAndCheckDiagnostics ? sourceFile.bindDiagnostics : emptyArray;
                let checkDiagnostics = includeBindAndCheckDiagnostics ? typeChecker.getDiagnostics(sourceFile, cancellationToken) : emptyArray;
                if (isPlainJs) {
                    bindDiagnostics = filter(bindDiagnostics, d => plainJSErrors.has(d.code));
                    checkDiagnostics = filter(checkDiagnostics, d => plainJSErrors.has(d.code));
                }
                // skip ts-expect-error errors in plain JS files, and skip JSDoc errors except in checked JS
                return getMergedBindAndCheckDiagnostics(sourceFile, includeBindAndCheckDiagnostics && !isPlainJs, bindDiagnostics, checkDiagnostics, isCheckJs ? sourceFile.jsDocDiagnostics : undefined);
            });
        }

        function getMergedBindAndCheckDiagnostics(sourceFile: SourceFile, includeBindAndCheckDiagnostics: boolean, ...allDiagnostics: (readonly Diagnostic[] | undefined)[]) {
            const flatDiagnostics = flatten(allDiagnostics);
            if (!includeBindAndCheckDiagnostics || !sourceFile.commentDirectives?.length) {
                return flatDiagnostics;
            }

            const { diagnostics, directives } = getDiagnosticsWithPrecedingDirectives(sourceFile, sourceFile.commentDirectives, flatDiagnostics);

            for (const errorExpectation of directives.getUnusedExpectations()) {
                diagnostics.push(createDiagnosticForRange(sourceFile, errorExpectation.range, Diagnostics.Unused_ts_expect_error_directive));
            }

            return diagnostics;
        }

        /**
         * Creates a map of comment directives along with the diagnostics immediately preceded by one of them.
         * Comments that match to any of those diagnostics are marked as used.
         */
        function getDiagnosticsWithPrecedingDirectives(sourceFile: SourceFile, commentDirectives: CommentDirective[], flatDiagnostics: Diagnostic[]) {
            // Diagnostics are only reported if there is no comment directive preceding them
            // This will modify the directives map by marking "used" ones with a corresponding diagnostic
            const directives = createCommentDirectivesMap(sourceFile, commentDirectives);
            const diagnostics = flatDiagnostics.filter(diagnostic => markPrecedingCommentDirectiveLine(diagnostic, directives) === -1);

            return { diagnostics, directives };
        }

        function getSuggestionDiagnostics(sourceFile: SourceFile, cancellationToken: CancellationToken): readonly DiagnosticWithLocation[] {
            return runWithCancellationToken(() => {
                return getTypeChecker().getSuggestionDiagnostics(sourceFile, cancellationToken);
            });
        }

        /**
         * @returns The line index marked as preceding the diagnostic, or -1 if none was.
         */
        function markPrecedingCommentDirectiveLine(diagnostic: Diagnostic, directives: CommentDirectivesMap) {
            const { file, start } = diagnostic;
            if (!file) {
                return -1;
            }

            // Start out with the line just before the text
            const lineStarts = getLineStarts(file);
            let line = computeLineAndCharacterOfPosition(lineStarts, start!).line - 1; // TODO: GH#18217
            while (line >= 0) {
                // As soon as that line is known to have a comment directive, use that
                if (directives.markUsed(line)) {
                    return line;
                }

                // Stop searching if the line is not empty and not a comment
                const lineText = file.text.slice(lineStarts[line], lineStarts[line + 1]).trim();
                if (lineText !== "" && !/^(\s*)\/\/(.*)$/.test(lineText)) {
                    return -1;
                }

                line--;
            }

            return -1;
        }

        function getJSSyntacticDiagnosticsForFile(sourceFile: SourceFile): DiagnosticWithLocation[] {
            return runWithCancellationToken(() => {
                const diagnostics: DiagnosticWithLocation[] = [];
                walk(sourceFile, sourceFile);
                forEachChildRecursively(sourceFile, walk, walkArray);

                return diagnostics;

                function walk(node: Node, parent: Node) {
                    // Return directly from the case if the given node doesnt want to visit each child
                    // Otherwise break to visit each child

                    switch (parent.kind) {
                        case SyntaxKind.Parameter:
                        case SyntaxKind.PropertyDeclaration:
                        case SyntaxKind.MethodDeclaration:
                            if ((parent as ParameterDeclaration | PropertyDeclaration | MethodDeclaration).questionToken === node) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.The_0_modifier_can_only_be_used_in_TypeScript_files, "?"));
                                return "skip";
                            }
                        // falls through
                        case SyntaxKind.MethodSignature:
                        case SyntaxKind.Constructor:
                        case SyntaxKind.GetAccessor:
                        case SyntaxKind.SetAccessor:
                        case SyntaxKind.FunctionExpression:
                        case SyntaxKind.FunctionDeclaration:
                        case SyntaxKind.ArrowFunction:
                        case SyntaxKind.VariableDeclaration:
                            // type annotation
                            if ((parent as FunctionLikeDeclaration | VariableDeclaration | ParameterDeclaration | PropertyDeclaration).type === node) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.Type_annotations_can_only_be_used_in_TypeScript_files));
                                return "skip";
                            }
                    }

                    switch (node.kind) {
                        case SyntaxKind.ImportClause:
                            if ((node as ImportClause).isTypeOnly) {
                                diagnostics.push(createDiagnosticForNode(parent, Diagnostics._0_declarations_can_only_be_used_in_TypeScript_files, "import type"));
                                return "skip";
                            }
                            break;
                        case SyntaxKind.ExportDeclaration:
                            if ((node as ExportDeclaration).isTypeOnly) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics._0_declarations_can_only_be_used_in_TypeScript_files, "export type"));
                                return "skip";
                            }
                            break;
                        case SyntaxKind.ImportSpecifier:
                        case SyntaxKind.ExportSpecifier:
                            if ((node as ImportOrExportSpecifier).isTypeOnly) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics._0_declarations_can_only_be_used_in_TypeScript_files, isImportSpecifier(node) ? "import...type" : "export...type"));
                                return "skip";
                            }
                            break;
                        case SyntaxKind.ImportEqualsDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.import_can_only_be_used_in_TypeScript_files));
                            return "skip";
                        case SyntaxKind.ExportAssignment:
                            if ((node as ExportAssignment).isExportEquals) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.export_can_only_be_used_in_TypeScript_files));
                                return "skip";
                            }
                            break;
                        case SyntaxKind.HeritageClause:
                            const heritageClause = node as HeritageClause;
                            if (heritageClause.token === SyntaxKind.ImplementsKeyword) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.implements_clauses_can_only_be_used_in_TypeScript_files));
                                return "skip";
                            }
                            break;
                        case SyntaxKind.InterfaceDeclaration:
                            const interfaceKeyword = tokenToString(SyntaxKind.InterfaceKeyword);
                            Debug.assertIsDefined(interfaceKeyword);
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics._0_declarations_can_only_be_used_in_TypeScript_files, interfaceKeyword));
                            return "skip";
                        case SyntaxKind.ModuleDeclaration:
                            const moduleKeyword = node.flags & NodeFlags.Namespace ? tokenToString(SyntaxKind.NamespaceKeyword) : tokenToString(SyntaxKind.ModuleKeyword);
                            Debug.assertIsDefined(moduleKeyword);
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics._0_declarations_can_only_be_used_in_TypeScript_files, moduleKeyword));
                            return "skip";
                        case SyntaxKind.TypeAliasDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.Type_aliases_can_only_be_used_in_TypeScript_files));
                            return "skip";
                        case SyntaxKind.EnumDeclaration:
                            const enumKeyword = Debug.checkDefined(tokenToString(SyntaxKind.EnumKeyword));
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics._0_declarations_can_only_be_used_in_TypeScript_files, enumKeyword));
                            return "skip";
                        case SyntaxKind.NonNullExpression:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.Non_null_assertions_can_only_be_used_in_TypeScript_files));
                            return "skip";
                        case SyntaxKind.AsExpression:
                            diagnostics.push(createDiagnosticForNode((node as AsExpression).type, Diagnostics.Type_assertion_expressions_can_only_be_used_in_TypeScript_files));
                            return "skip";
                        case SyntaxKind.TypeAssertionExpression:
                            Debug.fail(); // Won't parse these in a JS file anyway, as they are interpreted as JSX.
                    }
                }

                function walkArray(nodes: NodeArray<Node>, parent: Node) {
                    if (parent.decorators === nodes && !options.experimentalDecorators) {
                        diagnostics.push(createDiagnosticForNode(parent, Diagnostics.Experimental_support_for_decorators_is_a_feature_that_is_subject_to_change_in_a_future_release_Set_the_experimentalDecorators_option_in_your_tsconfig_or_jsconfig_to_remove_this_warning));
                    }

                    switch (parent.kind) {
                        case SyntaxKind.ClassDeclaration:
                        case SyntaxKind.ClassExpression:
                        case SyntaxKind.MethodDeclaration:
                        case SyntaxKind.Constructor:
                        case SyntaxKind.GetAccessor:
                        case SyntaxKind.SetAccessor:
                        case SyntaxKind.FunctionExpression:
                        case SyntaxKind.FunctionDeclaration:
                        case SyntaxKind.ArrowFunction:
                            // Check type parameters
                            if (nodes === (parent as DeclarationWithTypeParameterChildren).typeParameters) {
                                diagnostics.push(createDiagnosticForNodeArray(nodes, Diagnostics.Type_parameter_declarations_can_only_be_used_in_TypeScript_files));
                                return "skip";
                            }
                        // falls through

                        case SyntaxKind.VariableStatement:
                            // Check modifiers
                            if (nodes === parent.modifiers) {
                                checkModifiers(parent.modifiers, parent.kind === SyntaxKind.VariableStatement);
                                return "skip";
                            }
                            break;
                        case SyntaxKind.PropertyDeclaration:
                            // Check modifiers of property declaration
                            if (nodes === (parent as PropertyDeclaration).modifiers) {
                                for (const modifier of nodes as NodeArray<Modifier>) {
                                    if (modifier.kind !== SyntaxKind.StaticKeyword) {
                                        diagnostics.push(createDiagnosticForNode(modifier, Diagnostics.The_0_modifier_can_only_be_used_in_TypeScript_files, tokenToString(modifier.kind)));
                                    }
                                }
                                return "skip";
                            }
                            break;
                        case SyntaxKind.Parameter:
                            // Check modifiers of parameter declaration
                            if (nodes === (parent as ParameterDeclaration).modifiers) {
                                diagnostics.push(createDiagnosticForNodeArray(nodes, Diagnostics.Parameter_modifiers_can_only_be_used_in_TypeScript_files));
                                return "skip";
                            }
                            break;
                        case SyntaxKind.CallExpression:
                        case SyntaxKind.NewExpression:
                        case SyntaxKind.ExpressionWithTypeArguments:
                        case SyntaxKind.JsxSelfClosingElement:
                        case SyntaxKind.JsxOpeningElement:
                        case SyntaxKind.TaggedTemplateExpression:
                            // Check type arguments
                            if (nodes === (parent as NodeWithTypeArguments).typeArguments) {
                                diagnostics.push(createDiagnosticForNodeArray(nodes, Diagnostics.Type_arguments_can_only_be_used_in_TypeScript_files));
                                return "skip";
                            }
                            break;
                    }
                }

                function checkModifiers(modifiers: NodeArray<Modifier>, isConstValid: boolean) {
                    for (const modifier of modifiers) {
                        switch (modifier.kind) {
                            case SyntaxKind.ConstKeyword:
                                if (isConstValid) {
                                    continue;
                                }
                            // to report error,
                            // falls through
                            case SyntaxKind.PublicKeyword:
                            case SyntaxKind.PrivateKeyword:
                            case SyntaxKind.ProtectedKeyword:
                            case SyntaxKind.ReadonlyKeyword:
                            case SyntaxKind.DeclareKeyword:
                            case SyntaxKind.AbstractKeyword:
                            case SyntaxKind.OverrideKeyword:
                            case SyntaxKind.InKeyword:
                            case SyntaxKind.OutKeyword:
                                diagnostics.push(createDiagnosticForNode(modifier, Diagnostics.The_0_modifier_can_only_be_used_in_TypeScript_files, tokenToString(modifier.kind)));
                                break;

                            // These are all legal modifiers.
                            case SyntaxKind.StaticKeyword:
                            case SyntaxKind.ExportKeyword:
                            case SyntaxKind.DefaultKeyword:
                        }
                    }
                }

                function createDiagnosticForNodeArray(nodes: NodeArray<Node>, message: DiagnosticMessage, arg0?: string | number, arg1?: string | number, arg2?: string | number): DiagnosticWithLocation {
                    const start = nodes.pos;
                    return createFileDiagnostic(sourceFile, start, nodes.end - start, message, arg0, arg1, arg2);
                }

                // Since these are syntactic diagnostics, parent might not have been set
                // this means the sourceFile cannot be infered from the node
                function createDiagnosticForNode(node: Node, message: DiagnosticMessage, arg0?: string | number, arg1?: string | number, arg2?: string | number): DiagnosticWithLocation {
                    return createDiagnosticForNodeInSourceFile(sourceFile, node, message, arg0, arg1, arg2);
                }
            });
        }

        function getDeclarationDiagnosticsWorker(sourceFile: SourceFile | undefined, cancellationToken: CancellationToken | undefined): readonly DiagnosticWithLocation[] {
            return getAndCacheDiagnostics(sourceFile, cancellationToken, cachedDeclarationDiagnosticsForFile, getDeclarationDiagnosticsForFileNoCache);
        }

        function getDeclarationDiagnosticsForFileNoCache(sourceFile: SourceFile | undefined, cancellationToken: CancellationToken | undefined): readonly DiagnosticWithLocation[] {
            return runWithCancellationToken(() => {
                const resolver = getTypeChecker().getEmitResolver(sourceFile, cancellationToken);
                // Don't actually write any files since we're just getting diagnostics.
                return ts.getDeclarationDiagnostics(getEmitHost(noop), resolver, sourceFile) || emptyArray;
            });
        }

        function getAndCacheDiagnostics<T extends SourceFile | undefined, U extends Diagnostic>(
            sourceFile: T,
            cancellationToken: CancellationToken | undefined,
            cache: DiagnosticCache<U>,
            getDiagnostics: (sourceFile: T, cancellationToken: CancellationToken | undefined) => readonly U[],
        ): readonly U[] {

            const cachedResult = sourceFile
                ? cache.perFile?.get(sourceFile.path)
                : cache.allDiagnostics;

            if (cachedResult) {
                return cachedResult;
            }
            const result = getDiagnostics(sourceFile, cancellationToken);
            if (sourceFile) {
                (cache.perFile || (cache.perFile = new Map())).set(sourceFile.path, result);
            }
            else {
                cache.allDiagnostics = result;
            }
            return result;
        }

        function getDeclarationDiagnosticsForFile(sourceFile: SourceFile, cancellationToken: CancellationToken): readonly DiagnosticWithLocation[] {
            return sourceFile.isDeclarationFile ? [] : getDeclarationDiagnosticsWorker(sourceFile, cancellationToken);
        }

        function getOptionsDiagnostics(): SortedReadonlyArray<Diagnostic> {
            return sortAndDeduplicateDiagnostics(concatenate(
                programDiagnostics.getGlobalDiagnostics(),
                getOptionsDiagnosticsOfConfigFile()
            ));
        }

        function getOptionsDiagnosticsOfConfigFile() {
            if (!options.configFile) return emptyArray;
            let diagnostics = programDiagnostics.getDiagnostics(options.configFile.fileName);
            forEachResolvedProjectReference(resolvedRef => {
                diagnostics = concatenate(diagnostics, programDiagnostics.getDiagnostics(resolvedRef.sourceFile.fileName));
            });
            return diagnostics;
        }

        function getGlobalDiagnostics(): SortedReadonlyArray<Diagnostic> {
            return rootNames.length ? sortAndDeduplicateDiagnostics(getTypeChecker().getGlobalDiagnostics().slice()) : emptyArray as any as SortedReadonlyArray<Diagnostic>;
        }

        function getConfigFileParsingDiagnostics(): readonly Diagnostic[] {
            return configFileParsingDiagnostics || emptyArray;
        }

        function processRootFile(fileName: string, isDefaultLib: boolean, ignoreNoDefaultLib: boolean, reason: FileIncludeReason) {
            processSourceFile(normalizePath(fileName), isDefaultLib, ignoreNoDefaultLib, /*packageId*/ undefined, reason);
        }

        function fileReferenceIsEqualTo(a: FileReference, b: FileReference): boolean {
            return a.fileName === b.fileName;
        }

        function moduleNameIsEqualTo(a: StringLiteralLike | Identifier, b: StringLiteralLike | Identifier): boolean {
            return a.kind === SyntaxKind.Identifier
                ? b.kind === SyntaxKind.Identifier && a.escapedText === b.escapedText
                : b.kind === SyntaxKind.StringLiteral && a.text === b.text;
        }

        function createSyntheticImport(text: string, file: SourceFile) {
            const externalHelpersModuleReference = factory.createStringLiteral(text);
            const importDecl = factory.createImportDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, /*importClause*/ undefined, externalHelpersModuleReference, /*assertClause*/ undefined);
            addEmitFlags(importDecl, EmitFlags.NeverApplyImportHelper);
            setParent(externalHelpersModuleReference, importDecl);
            setParent(importDecl, file);
            // explicitly unset the synthesized flag on these declarations so the checker API will answer questions about them
            // (which is required to build the dependency graph for incremental emit)
            (externalHelpersModuleReference as Mutable<Node>).flags &= ~NodeFlags.Synthesized;
            (importDecl as Mutable<Node>).flags &= ~NodeFlags.Synthesized;
            return externalHelpersModuleReference;
        }

        function collectExternalModuleReferences(file: SourceFile): void {
            if (file.imports) {
                return;
            }

            const isJavaScriptFile = isSourceFileJS(file);
            const isExternalModuleFile = isExternalModule(file);

            // file.imports may not be undefined if there exists dynamic import
            let imports: StringLiteralLike[] | undefined;
            let moduleAugmentations: (StringLiteral | Identifier)[] | undefined;
            let ambientModules: string[] | undefined;

            // If we are importing helpers, we need to add a synthetic reference to resolve the
            // helpers library.
            if ((options.isolatedModules || isExternalModuleFile)
                && !file.isDeclarationFile) {
                if (options.importHelpers) {
                    // synthesize 'import "tslib"' declaration
                    imports = [createSyntheticImport(externalHelpersModuleNameText, file)];
                }
                const jsxImport = getJSXRuntimeImport(getJSXImplicitImportBase(options, file), options);
                if (jsxImport) {
                    // synthesize `import "base/jsx-runtime"` declaration
                    (imports ||= []).push(createSyntheticImport(jsxImport, file));
                }
            }

            for (const node of file.statements) {
                collectModuleReferences(node, /*inAmbientModule*/ false);
            }
            if ((file.flags & NodeFlags.PossiblyContainsDynamicImport) || isJavaScriptFile) {
                collectDynamicImportOrRequireCalls(file);
            }

            file.imports = imports || emptyArray;
            file.moduleAugmentations = moduleAugmentations || emptyArray;
            file.ambientModuleNames = ambientModules || emptyArray;

            return;

            function collectModuleReferences(node: Statement, inAmbientModule: boolean): void {
                if (isAnyImportOrReExport(node)) {
                    const moduleNameExpr = getExternalModuleName(node);
                    // TypeScript 1.0 spec (April 2014): 12.1.6
                    // An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference other external modules
                    // only through top - level external module names. Relative external module names are not permitted.
                    if (moduleNameExpr && isStringLiteral(moduleNameExpr) && moduleNameExpr.text && (!inAmbientModule || !isExternalModuleNameRelative(moduleNameExpr.text))) {
                        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
                        imports = append(imports, moduleNameExpr);
                        if (!usesUriStyleNodeCoreModules && currentNodeModulesDepth === 0 && !file.isDeclarationFile) {
                            usesUriStyleNodeCoreModules = startsWith(moduleNameExpr.text, "node:");
                        }
                    }
                }
                else if (isModuleDeclaration(node)) {
                    if (isAmbientModule(node) && (inAmbientModule || hasSyntacticModifier(node, ModifierFlags.Ambient) || file.isDeclarationFile)) {
                        (node.name as Mutable<Node>).parent = node;
                        const nameText = getTextOfIdentifierOrLiteral(node.name);
                        // Ambient module declarations can be interpreted as augmentations for some existing external modules.
                        // This will happen in two cases:
                        // - if current file is external module then module augmentation is a ambient module declaration defined in the top level scope
                        // - if current file is not external module then module augmentation is an ambient module declaration with non-relative module name
                        //   immediately nested in top level ambient module declaration .
                        if (isExternalModuleFile || (inAmbientModule && !isExternalModuleNameRelative(nameText))) {
                            (moduleAugmentations || (moduleAugmentations = [])).push(node.name);
                        }
                        else if (!inAmbientModule) {
                            if (file.isDeclarationFile) {
                                // for global .d.ts files record name of ambient module
                                (ambientModules || (ambientModules = [])).push(nameText);
                            }
                            // An AmbientExternalModuleDeclaration declares an external module.
                            // This type of declaration is permitted only in the global module.
                            // The StringLiteral must specify a top - level external module name.
                            // Relative external module names are not permitted

                            // NOTE: body of ambient module is always a module block, if it exists
                            const body = (node as ModuleDeclaration).body as ModuleBlock;
                            if (body) {
                                for (const statement of body.statements) {
                                    collectModuleReferences(statement, /*inAmbientModule*/ true);
                                }
                            }
                        }
                    }
                }
            }

            function collectDynamicImportOrRequireCalls(file: SourceFile) {
                const r = /import|require/g;
                while (r.exec(file.text) !== null) { // eslint-disable-line no-null/no-null
                    const node = getNodeAtPosition(file, r.lastIndex);
                    if (isJavaScriptFile && isRequireCall(node, /*checkArgumentIsStringLiteralLike*/ true)) {
                        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
                        imports = append(imports, node.arguments[0]);
                    }
                    // we have to check the argument list has length of at least 1. We will still have to process these even though we have parsing error.
                    else if (isImportCall(node) && node.arguments.length >= 1 && isStringLiteralLike(node.arguments[0])) {
                        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
                        imports = append(imports, node.arguments[0]);
                    }
                    else if (isLiteralImportTypeNode(node)) {
                        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
                        imports = append(imports, node.argument.literal);
                    }
                }
            }

            /** Returns a token if position is in [start-of-leading-trivia, end), includes JSDoc only in JS files */
            function getNodeAtPosition(sourceFile: SourceFile, position: number): Node {
                let current: Node = sourceFile;
                const getContainingChild = (child: Node) => {
                    if (child.pos <= position && (position < child.end || (position === child.end && (child.kind === SyntaxKind.EndOfFileToken)))) {
                        return child;
                    }
                };
                while (true) {
                    const child = isJavaScriptFile && hasJSDocNodes(current) && forEach(current.jsDoc, getContainingChild) || forEachChild(current, getContainingChild);
                    if (!child) {
                        return current;
                    }
                    current = child;
                }
            }
        }

        function getLibFileFromReference(ref: FileReference) {
            const libName = toFileNameLowerCase(ref.fileName);
            const libFileName = libMap.get(libName);
            if (libFileName) {
                return getSourceFile(pathForLibFile(libFileName));
            }
        }

        /** This should have similar behavior to 'processSourceFile' without diagnostics or mutation. */
        function getSourceFileFromReference(referencingFile: SourceFile | UnparsedSource, ref: FileReference): SourceFile | undefined {
            return getSourceFileFromReferenceWorker(resolveTripleslashReference(ref.fileName, referencingFile.fileName), getSourceFile);
        }

        function getSourceFileFromReferenceWorker(
            fileName: string,
            getSourceFile: (fileName: string) => SourceFile | undefined,
            fail?: (diagnostic: DiagnosticMessage, ...argument: string[]) => void,
            reason?: FileIncludeReason): SourceFile | undefined {

            if (hasExtension(fileName)) {
                const canonicalFileName = host.getCanonicalFileName(fileName);
                if (!options.allowNonTsExtensions && !forEach(flatten(supportedExtensionsWithJsonIfResolveJsonModule), extension => fileExtensionIs(canonicalFileName, extension))) {
                    if (fail) {
                        if (hasJSFileExtension(canonicalFileName)) {
                            fail(Diagnostics.File_0_is_a_JavaScript_file_Did_you_mean_to_enable_the_allowJs_option, fileName);
                        }
                        else {
                            fail(Diagnostics.File_0_has_an_unsupported_extension_The_only_supported_extensions_are_1, fileName, "'" + flatten(supportedExtensions).join("', '") + "'");
                        }
                    }
                    return undefined;
                }

                const sourceFile = getSourceFile(fileName);
                if (fail) {
                    if (!sourceFile) {
                        const redirect = getProjectReferenceRedirect(fileName);
                        if (redirect) {
                            fail(Diagnostics.Output_file_0_has_not_been_built_from_source_file_1, redirect, fileName);
                        }
                        else {
                            fail(Diagnostics.File_0_not_found, fileName);
                        }
                    }
                    else if (isReferencedFile(reason) && canonicalFileName === host.getCanonicalFileName(getSourceFileByPath(reason.file)!.fileName)) {
                        fail(Diagnostics.A_file_cannot_have_a_reference_to_itself);
                    }
                }
                return sourceFile;
            }
            else {
                const sourceFileNoExtension = options.allowNonTsExtensions && getSourceFile(fileName);
                if (sourceFileNoExtension) return sourceFileNoExtension;

                if (fail && options.allowNonTsExtensions) {
                    fail(Diagnostics.File_0_not_found, fileName);
                    return undefined;
                }

                // Only try adding extensions from the first supported group (which should be .ts/.tsx/.d.ts)
                const sourceFileWithAddedExtension = forEach(supportedExtensions[0], extension => getSourceFile(fileName + extension));
                if (fail && !sourceFileWithAddedExtension) fail(Diagnostics.Could_not_resolve_the_path_0_with_the_extensions_Colon_1, fileName, "'" + flatten(supportedExtensions).join("', '") + "'");
                return sourceFileWithAddedExtension;
            }
        }

        /** This has side effects through `findSourceFile`. */
        function processSourceFile(fileName: string, isDefaultLib: boolean, ignoreNoDefaultLib: boolean, packageId: PackageId | undefined, reason: FileIncludeReason): void {
            getSourceFileFromReferenceWorker(
                fileName,
                fileName => findSourceFile(fileName, isDefaultLib, ignoreNoDefaultLib, reason, packageId), // TODO: GH#18217
                (diagnostic, ...args) => addFilePreprocessingFileExplainingDiagnostic(/*file*/ undefined, reason, diagnostic, args),
                reason
            );
        }

        function processProjectReferenceFile(fileName: string, reason: ProjectReferenceFile) {
            return processSourceFile(fileName, /*isDefaultLib*/ false, /*ignoreNoDefaultLib*/ false, /*packageId*/ undefined, reason);
        }

        function reportFileNamesDifferOnlyInCasingError(fileName: string, existingFile: SourceFile, reason: FileIncludeReason): void {
            const hasExistingReasonToReportErrorOn = !isReferencedFile(reason) && some(fileReasons.get(existingFile.path), isReferencedFile);
            if (hasExistingReasonToReportErrorOn) {
                addFilePreprocessingFileExplainingDiagnostic(existingFile, reason, Diagnostics.Already_included_file_name_0_differs_from_file_name_1_only_in_casing, [existingFile.fileName, fileName]);
            }
            else {
                addFilePreprocessingFileExplainingDiagnostic(existingFile, reason, Diagnostics.File_name_0_differs_from_already_included_file_name_1_only_in_casing, [fileName, existingFile.fileName]);
            }
        }

        function createRedirectSourceFile(redirectTarget: SourceFile, unredirected: SourceFile, fileName: string, path: Path, resolvedPath: Path, originalFileName: string): SourceFile {
            const redirect: SourceFile = Object.create(redirectTarget);
            redirect.fileName = fileName;
            redirect.path = path;
            redirect.resolvedPath = resolvedPath;
            redirect.originalFileName = originalFileName;
            redirect.redirectInfo = { redirectTarget, unredirected };
            sourceFilesFoundSearchingNodeModules.set(path, currentNodeModulesDepth > 0);
            Object.defineProperties(redirect, {
                id: {
                    get(this: SourceFile) { return this.redirectInfo!.redirectTarget.id; },
                    set(this: SourceFile, value: SourceFile["id"]) { this.redirectInfo!.redirectTarget.id = value; },
                },
                symbol: {
                    get(this: SourceFile) { return this.redirectInfo!.redirectTarget.symbol; },
                    set(this: SourceFile, value: SourceFile["symbol"]) { this.redirectInfo!.redirectTarget.symbol = value; },
                },
            });
            return redirect;
        }

        // Get source file from normalized fileName
        function findSourceFile(fileName: string, isDefaultLib: boolean, ignoreNoDefaultLib: boolean, reason: FileIncludeReason, packageId: PackageId | undefined): SourceFile | undefined {
            tracing?.push(tracing.Phase.Program, "findSourceFile", {
                fileName,
                isDefaultLib: isDefaultLib || undefined,
                fileIncludeKind: (FileIncludeKind as any)[reason.kind],
            });
            const result = findSourceFileWorker(fileName, isDefaultLib, ignoreNoDefaultLib, reason, packageId);
            tracing?.pop();
            return result;
        }

        function getCreateSourceFileOptions(fileName: string, moduleResolutionCache: ModuleResolutionCache | undefined, host: CompilerHost, options: CompilerOptions) {
            // It's a _little odd_ that we can't set `impliedNodeFormat` until the program step - but it's the first and only time we have a resolution cache
            // and a freshly made source file node on hand at the same time, and we need both to set the field. Persisting the resolution cache all the way
            // to the check and emit steps would be bad - so we much prefer detecting and storing the format information on the source file node upfront.
            const impliedNodeFormat = getImpliedNodeFormatForFile(toPath(fileName), moduleResolutionCache?.getPackageJsonInfoCache(), host, options);
            return {
                languageVersion: getEmitScriptTarget(options),
                impliedNodeFormat,
                setExternalModuleIndicator: getSetExternalModuleIndicator(options)
            };
        }

        function findSourceFileWorker(fileName: string, isDefaultLib: boolean, ignoreNoDefaultLib: boolean, reason: FileIncludeReason, packageId: PackageId | undefined): SourceFile | undefined {
            const path = toPath(fileName);
            if (useSourceOfProjectReferenceRedirect) {
                let source = getSourceOfProjectReferenceRedirect(path);
                // If preserveSymlinks is true, module resolution wont jump the symlink
                // but the resolved real path may be the .d.ts from project reference
                // Note:: Currently we try the real path only if the
                // file is from node_modules to avoid having to run real path on all file paths
                if (!source &&
                    host.realpath &&
                    options.preserveSymlinks &&
                    isDeclarationFileName(fileName) &&
                    stringContains(fileName, nodeModulesPathPart)) {
                    const realPath = toPath(host.realpath(fileName));
                    if (realPath !== path) source = getSourceOfProjectReferenceRedirect(realPath);
                }
                if (source) {
                    const file = isString(source) ?
                        findSourceFile(source, isDefaultLib, ignoreNoDefaultLib, reason, packageId) :
                        undefined;
                    if (file) addFileToFilesByName(file, path, /*redirectedPath*/ undefined);
                    return file;
                }
            }
            const originalFileName = fileName;
            if (filesByName.has(path)) {
                const file = filesByName.get(path);
                addFileIncludeReason(file || undefined, reason);
                // try to check if we've already seen this file but with a different casing in path
                // NOTE: this only makes sense for case-insensitive file systems, and only on files which are not redirected
                if (file && options.forceConsistentCasingInFileNames) {
                    const checkedName = file.fileName;
                    const isRedirect = toPath(checkedName) !== toPath(fileName);
                    if (isRedirect) {
                        fileName = getProjectReferenceRedirect(fileName) || fileName;
                    }
                    // Check if it differs only in drive letters its ok to ignore that error:
                    const checkedAbsolutePath = getNormalizedAbsolutePathWithoutRoot(checkedName, currentDirectory);
                    const inputAbsolutePath = getNormalizedAbsolutePathWithoutRoot(fileName, currentDirectory);
                    if (checkedAbsolutePath !== inputAbsolutePath) {
                        reportFileNamesDifferOnlyInCasingError(fileName, file, reason);
                    }
                }

                // If the file was previously found via a node_modules search, but is now being processed as a root file,
                // then everything it sucks in may also be marked incorrectly, and needs to be checked again.
                if (file && sourceFilesFoundSearchingNodeModules.get(file.path) && currentNodeModulesDepth === 0) {
                    sourceFilesFoundSearchingNodeModules.set(file.path, false);
                    if (!options.noResolve) {
                        processReferencedFiles(file, isDefaultLib);
                        processTypeReferenceDirectives(file);
                    }
                    if (!options.noLib) {
                        processLibReferenceDirectives(file);
                    }

                    modulesWithElidedImports.set(file.path, false);
                    processImportedModules(file);
                }
                // See if we need to reprocess the imports due to prior skipped imports
                else if (file && modulesWithElidedImports.get(file.path)) {
                    if (currentNodeModulesDepth < maxNodeModuleJsDepth) {
                        modulesWithElidedImports.set(file.path, false);
                        processImportedModules(file);
                    }
                }

                return file || undefined;
            }

            let redirectedPath: Path | undefined;
            if (isReferencedFile(reason) && !useSourceOfProjectReferenceRedirect) {
                const redirectProject = getProjectReferenceRedirectProject(fileName);
                if (redirectProject) {
                    if (outFile(redirectProject.commandLine.options)) {
                        // Shouldnt create many to 1 mapping file in --out scenario
                        return undefined;
                    }
                    const redirect = getProjectReferenceOutputName(redirectProject, fileName);
                    fileName = redirect;
                    // Once we start redirecting to a file, we can potentially come back to it
                    // via a back-reference from another file in the .d.ts folder. If that happens we'll
                    // end up trying to add it to the program *again* because we were tracking it via its
                    // original (un-redirected) name. So we have to map both the original path and the redirected path
                    // to the source file we're about to find/create
                    redirectedPath = toPath(redirect);
                }
            }

            // We haven't looked for this file, do so now and cache result
            const file = host.getSourceFile(
                fileName,
                getCreateSourceFileOptions(fileName, moduleResolutionCache, host, options),
                hostErrorMessage => addFilePreprocessingFileExplainingDiagnostic(/*file*/ undefined, reason, Diagnostics.Cannot_read_file_0_Colon_1, [fileName, hostErrorMessage]),
                shouldCreateNewSourceFile
            );

            if (packageId) {
                const packageIdKey = packageIdToString(packageId);
                const fileFromPackageId = packageIdToSourceFile.get(packageIdKey);
                if (fileFromPackageId) {
                    // Some other SourceFile already exists with this package name and version.
                    // Instead of creating a duplicate, just redirect to the existing one.
                    const dupFile = createRedirectSourceFile(fileFromPackageId, file!, fileName, path, toPath(fileName), originalFileName); // TODO: GH#18217
                    redirectTargetsMap.add(fileFromPackageId.path, fileName);
                    addFileToFilesByName(dupFile, path, redirectedPath);
                    addFileIncludeReason(dupFile, reason);
                    sourceFileToPackageName.set(path, packageIdToPackageName(packageId));
                    processingOtherFiles!.push(dupFile);
                    return dupFile;
                }
                else if (file) {
                    // This is the first source file to have this packageId.
                    packageIdToSourceFile.set(packageIdKey, file);
                    sourceFileToPackageName.set(path, packageIdToPackageName(packageId));
                }
            }
            addFileToFilesByName(file, path, redirectedPath);

            if (file) {
                sourceFilesFoundSearchingNodeModules.set(path, currentNodeModulesDepth > 0);
                file.fileName = fileName; // Ensure that source file has same name as what we were looking for
                file.path = path;
                file.resolvedPath = toPath(fileName);
                file.originalFileName = originalFileName;
                addFileIncludeReason(file, reason);

                if (host.useCaseSensitiveFileNames()) {
                    const pathLowerCase = toFileNameLowerCase(path);
                    // for case-sensitive file systems check if we've already seen some file with similar filename ignoring case
                    const existingFile = filesByNameIgnoreCase!.get(pathLowerCase);
                    if (existingFile) {
                        reportFileNamesDifferOnlyInCasingError(fileName, existingFile, reason);
                    }
                    else {
                        filesByNameIgnoreCase!.set(pathLowerCase, file);
                    }
                }

                skipDefaultLib = skipDefaultLib || (file.hasNoDefaultLib && !ignoreNoDefaultLib);

                if (!options.noResolve) {
                    processReferencedFiles(file, isDefaultLib);
                    processTypeReferenceDirectives(file);
                }
                if (!options.noLib) {
                    processLibReferenceDirectives(file);
                }


                // always process imported modules to record module name resolutions
                processImportedModules(file);

                if (isDefaultLib) {
                    processingDefaultLibFiles!.push(file);
                }
                else {
                    processingOtherFiles!.push(file);
                }
            }
            return file;
        }

        function addFileIncludeReason(file: SourceFile | undefined, reason: FileIncludeReason) {
            if (file) fileReasons.add(file.path, reason);
        }

        function addFileToFilesByName(file: SourceFile | undefined, path: Path, redirectedPath: Path | undefined) {
            if (redirectedPath) {
                filesByName.set(redirectedPath, file);
                filesByName.set(path, file || false);
            }
            else {
                filesByName.set(path, file);
            }
        }

        function getProjectReferenceRedirect(fileName: string): string | undefined {
            const referencedProject = getProjectReferenceRedirectProject(fileName);
            return referencedProject && getProjectReferenceOutputName(referencedProject, fileName);
        }

        function getProjectReferenceRedirectProject(fileName: string) {
            // Ignore dts or any json files
            if (!resolvedProjectReferences || !resolvedProjectReferences.length || fileExtensionIs(fileName, Extension.Dts) || fileExtensionIs(fileName, Extension.Json)) {
                return undefined;
            }

            // If this file is produced by a referenced project, we need to rewrite it to
            // look in the output folder of the referenced project rather than the input
            return getResolvedProjectReferenceToRedirect(fileName);
        }


        function getProjectReferenceOutputName(referencedProject: ResolvedProjectReference, fileName: string) {
            const out = outFile(referencedProject.commandLine.options);
            return out ?
                changeExtension(out, Extension.Dts) :
                getOutputDeclarationFileName(fileName, referencedProject.commandLine, !host.useCaseSensitiveFileNames());
        }

        /**
         * Get the referenced project if the file is input file from that reference project
         */
        function getResolvedProjectReferenceToRedirect(fileName: string) {
            if (mapFromFileToProjectReferenceRedirects === undefined) {
                mapFromFileToProjectReferenceRedirects = new Map();
                forEachResolvedProjectReference(referencedProject => {
                    // not input file from the referenced project, ignore
                    if (toPath(options.configFilePath!) !== referencedProject.sourceFile.path) {
                        referencedProject.commandLine.fileNames.forEach(f =>
                            mapFromFileToProjectReferenceRedirects!.set(toPath(f), referencedProject.sourceFile.path));
                    }
                });
            }

            const referencedProjectPath = mapFromFileToProjectReferenceRedirects.get(toPath(fileName));
            return referencedProjectPath && getResolvedProjectReferenceByPath(referencedProjectPath);
        }

        function forEachResolvedProjectReference<T>(
            cb: (resolvedProjectReference: ResolvedProjectReference) => T | undefined
        ): T | undefined {
            return ts.forEachResolvedProjectReference(resolvedProjectReferences, cb);
        }

        function getSourceOfProjectReferenceRedirect(path: Path) {
            if (!isDeclarationFileName(path)) return undefined;
            if (mapFromToProjectReferenceRedirectSource === undefined) {
                mapFromToProjectReferenceRedirectSource = new Map();
                forEachResolvedProjectReference(resolvedRef => {
                    const out = outFile(resolvedRef.commandLine.options);
                    if (out) {
                        // Dont know which source file it means so return true?
                        const outputDts = changeExtension(out, Extension.Dts);
                        mapFromToProjectReferenceRedirectSource!.set(toPath(outputDts), true);
                    }
                    else {
                        const getCommonSourceDirectory = memoize(() => getCommonSourceDirectoryOfConfig(resolvedRef.commandLine, !host.useCaseSensitiveFileNames()));
                        forEach(resolvedRef.commandLine.fileNames, fileName => {
                            if (!fileExtensionIs(fileName, Extension.Dts) && !fileExtensionIs(fileName, Extension.Json)) {
                                const outputDts = getOutputDeclarationFileName(fileName, resolvedRef.commandLine, !host.useCaseSensitiveFileNames(), getCommonSourceDirectory);
                                mapFromToProjectReferenceRedirectSource!.set(toPath(outputDts), fileName);
                            }
                        });
                    }
                });
            }
            return mapFromToProjectReferenceRedirectSource.get(path);
        }

        function isSourceOfProjectReferenceRedirect(fileName: string) {
            return useSourceOfProjectReferenceRedirect && !!getResolvedProjectReferenceToRedirect(fileName);
        }

        function getResolvedProjectReferenceByPath(projectReferencePath: Path): ResolvedProjectReference | undefined {
            if (!projectReferenceRedirects) {
                return undefined;
            }

            return projectReferenceRedirects.get(projectReferencePath) || undefined;
        }

        function processReferencedFiles(file: SourceFile, isDefaultLib: boolean) {
            forEach(file.referencedFiles, (ref, index) => {
                processSourceFile(
                    resolveTripleslashReference(ref.fileName, file.fileName),
                    isDefaultLib,
                    /*ignoreNoDefaultLib*/ false,
                    /*packageId*/ undefined,
                    { kind: FileIncludeKind.ReferenceFile, file: file.path, index, }
                );
            });
        }

        function processTypeReferenceDirectives(file: SourceFile) {
            const typeDirectives = file.typeReferenceDirectives;
            if (!typeDirectives) {
                return;
            }

            const resolutions = resolveTypeReferenceDirectiveNamesWorker(typeDirectives, file);
            for (let index = 0; index < typeDirectives.length; index++) {
                const ref = file.typeReferenceDirectives[index];
                const resolvedTypeReferenceDirective = resolutions[index];
                // store resolved type directive on the file
                const fileName = toFileNameLowerCase(ref.fileName);
                setResolvedTypeReferenceDirective(file, fileName, resolvedTypeReferenceDirective);
                const mode = ref.resolutionMode || file.impliedNodeFormat;
                if (mode && getEmitModuleResolutionKind(options) !== ModuleResolutionKind.Node12 && getEmitModuleResolutionKind(options) !== ModuleResolutionKind.NodeNext) {
                    programDiagnostics.add(createDiagnosticForRange(file, ref, Diagnostics.Resolution_modes_are_only_supported_when_moduleResolution_is_node12_or_nodenext));
                }
                processTypeReferenceDirective(fileName, mode, resolvedTypeReferenceDirective, { kind: FileIncludeKind.TypeReferenceDirective, file: file.path, index, });
            }
        }

        function processTypeReferenceDirective(
            typeReferenceDirective: string,
            mode: SourceFile["impliedNodeFormat"] | undefined,
            resolvedTypeReferenceDirective: ResolvedTypeReferenceDirective | undefined,
            reason: FileIncludeReason
        ): void {
            tracing?.push(tracing.Phase.Program, "processTypeReferenceDirective", { directive: typeReferenceDirective, hasResolved: !!resolveModuleNamesReusingOldState, refKind: reason.kind, refPath: isReferencedFile(reason) ? reason.file : undefined });
            processTypeReferenceDirectiveWorker(typeReferenceDirective, mode, resolvedTypeReferenceDirective, reason);
            tracing?.pop();
        }

        function processTypeReferenceDirectiveWorker(
            typeReferenceDirective: string,
            mode: SourceFile["impliedNodeFormat"] | undefined,
            resolvedTypeReferenceDirective: ResolvedTypeReferenceDirective | undefined,
            reason: FileIncludeReason
        ): void {

            // If we already found this library as a primary reference - nothing to do
            const previousResolution = resolvedTypeReferenceDirectives.get(typeReferenceDirective, mode);
            if (previousResolution && previousResolution.primary) {
                return;
            }
            let saveResolution = true;
            if (resolvedTypeReferenceDirective) {
                if (resolvedTypeReferenceDirective.isExternalLibraryImport) currentNodeModulesDepth++;

                if (resolvedTypeReferenceDirective.primary) {
                    // resolved from the primary path
                    processSourceFile(resolvedTypeReferenceDirective.resolvedFileName!, /*isDefaultLib*/ false, /*ignoreNoDefaultLib*/ false, resolvedTypeReferenceDirective.packageId, reason); // TODO: GH#18217
                }
                else {
                    // If we already resolved to this file, it must have been a secondary reference. Check file contents
                    // for sameness and possibly issue an error
                    if (previousResolution) {
                        // Don't bother reading the file again if it's the same file.
                        if (resolvedTypeReferenceDirective.resolvedFileName !== previousResolution.resolvedFileName) {
                            const otherFileText = host.readFile(resolvedTypeReferenceDirective.resolvedFileName!);
                            const existingFile = getSourceFile(previousResolution.resolvedFileName!)!;
                            if (otherFileText !== existingFile.text) {
                                addFilePreprocessingFileExplainingDiagnostic(
                                    existingFile,
                                    reason,
                                    Diagnostics.Conflicting_definitions_for_0_found_at_1_and_2_Consider_installing_a_specific_version_of_this_library_to_resolve_the_conflict,
                                    [typeReferenceDirective, resolvedTypeReferenceDirective.resolvedFileName, previousResolution.resolvedFileName]
                                );
                            }
                        }
                        // don't overwrite previous resolution result
                        saveResolution = false;
                    }
                    else {
                        // First resolution of this library
                        processSourceFile(resolvedTypeReferenceDirective.resolvedFileName!, /*isDefaultLib*/ false, /*ignoreNoDefaultLib*/ false, resolvedTypeReferenceDirective.packageId, reason);
                    }
                }

                if (resolvedTypeReferenceDirective.isExternalLibraryImport) currentNodeModulesDepth--;
            }
            else {
                addFilePreprocessingFileExplainingDiagnostic(/*file*/ undefined, reason, Diagnostics.Cannot_find_type_definition_file_for_0, [typeReferenceDirective]);
            }

            if (saveResolution) {
                resolvedTypeReferenceDirectives.set(typeReferenceDirective, mode, resolvedTypeReferenceDirective);
            }
        }

        function pathForLibFile(libFileName: string): string {
            // Support resolving to lib.dom.d.ts -> @typescript/lib-dom, and
            //                      lib.dom.iterable.d.ts -> @typescript/lib-dom/iterable
            //                      lib.es2015.symbol.wellknown.d.ts -> @typescript/lib-es2015/symbol-wellknown
            const components = libFileName.split(".");
            let path = components[1];
            let i = 2;
            while (components[i] && components[i] !== "d") {
                path += (i === 2 ? "/" : "-") + components[i];
                i++;
            }
            const resolveFrom = combinePaths(currentDirectory, `__lib_node_modules_lookup_${libFileName}__.ts`);
            const localOverrideModuleResult = resolveModuleName("@typescript/lib-" + path, resolveFrom, { moduleResolution: ModuleResolutionKind.NodeJs }, host, moduleResolutionCache);
            if (localOverrideModuleResult?.resolvedModule) {
                return localOverrideModuleResult.resolvedModule.resolvedFileName;
            }
            return combinePaths(defaultLibraryPath, libFileName);
        }

        function processLibReferenceDirectives(file: SourceFile) {
            forEach(file.libReferenceDirectives, (libReference, index) => {
                const libName = toFileNameLowerCase(libReference.fileName);
                const libFileName = libMap.get(libName);
                if (libFileName) {
                    // we ignore any 'no-default-lib' reference set on this file.
                    processRootFile(pathForLibFile(libFileName), /*isDefaultLib*/ true, /*ignoreNoDefaultLib*/ true, { kind: FileIncludeKind.LibReferenceDirective, file: file.path, index, });
                }
                else {
                    const unqualifiedLibName = removeSuffix(removePrefix(libName, "lib."), ".d.ts");
                    const suggestion = getSpellingSuggestion(unqualifiedLibName, libs, identity);
                    const diagnostic = suggestion ? Diagnostics.Cannot_find_lib_definition_for_0_Did_you_mean_1 : Diagnostics.Cannot_find_lib_definition_for_0;
                    (fileProcessingDiagnostics ||= []).push({
                        kind: FilePreprocessingDiagnosticsKind.FilePreprocessingReferencedDiagnostic,
                        reason: { kind: FileIncludeKind.LibReferenceDirective, file: file.path, index, },
                        diagnostic,
                        args: [libName, suggestion]
                    });
                }
            });
        }

        function getCanonicalFileName(fileName: string): string {
            return host.getCanonicalFileName(fileName);
        }

        function processImportedModules(file: SourceFile) {
            collectExternalModuleReferences(file);
            if (file.imports.length || file.moduleAugmentations.length) {
                // Because global augmentation doesn't have string literal name, we can check for global augmentation as such.
                const moduleNames = getModuleNames(file);
                const resolutions = resolveModuleNamesReusingOldState(moduleNames, file);
                Debug.assert(resolutions.length === moduleNames.length);
                const optionsForFile = (useSourceOfProjectReferenceRedirect ? getRedirectReferenceForResolution(file)?.commandLine.options : undefined) || options;
                for (let index = 0; index < moduleNames.length; index++) {
                    const resolution = resolutions[index];
                    setResolvedModule(file, moduleNames[index], resolution, getModeForResolutionAtIndex(file, index));

                    if (!resolution) {
                        continue;
                    }

                    const isFromNodeModulesSearch = resolution.isExternalLibraryImport;
                    const isJsFile = !resolutionExtensionIsTSOrJson(resolution.extension);
                    const isJsFileFromNodeModules = isFromNodeModulesSearch && isJsFile;
                    const resolvedFileName = resolution.resolvedFileName;

                    if (isFromNodeModulesSearch) {
                        currentNodeModulesDepth++;
                    }

                    // add file to program only if:
                    // - resolution was successful
                    // - noResolve is falsy
                    // - module name comes from the list of imports
                    // - it's not a top level JavaScript module that exceeded the search max
                    const elideImport = isJsFileFromNodeModules && currentNodeModulesDepth > maxNodeModuleJsDepth;
                    // Don't add the file if it has a bad extension (e.g. 'tsx' if we don't have '--allowJs')
                    // This may still end up being an untyped module -- the file won't be included but imports will be allowed.
                    const shouldAddFile = resolvedFileName
                        && !getResolutionDiagnostic(optionsForFile, resolution)
                        && !optionsForFile.noResolve
                        && index < file.imports.length
                        && !elideImport
                        && !(isJsFile && !getAllowJSCompilerOption(optionsForFile))
                        && (isInJSFile(file.imports[index]) || !(file.imports[index].flags & NodeFlags.JSDoc));

                    if (elideImport) {
                        modulesWithElidedImports.set(file.path, true);
                    }
                    else if (shouldAddFile) {
                        findSourceFile(
                            resolvedFileName,
                            /*isDefaultLib*/ false,
                            /*ignoreNoDefaultLib*/ false,
                            { kind: FileIncludeKind.Import, file: file.path, index, },
                            resolution.packageId,
                        );
                    }

                    if (isFromNodeModulesSearch) {
                        currentNodeModulesDepth--;
                    }
                }
            }
            else {
                // no imports - drop cached module resolutions
                file.resolvedModules = undefined;
            }
        }

        function checkSourceFilesBelongToPath(sourceFiles: readonly SourceFile[], rootDirectory: string): boolean {
            let allFilesBelongToPath = true;
            const absoluteRootDirectoryPath = host.getCanonicalFileName(getNormalizedAbsolutePath(rootDirectory, currentDirectory));
            for (const sourceFile of sourceFiles) {
                if (!sourceFile.isDeclarationFile) {
                    const absoluteSourceFilePath = host.getCanonicalFileName(getNormalizedAbsolutePath(sourceFile.fileName, currentDirectory));
                    if (absoluteSourceFilePath.indexOf(absoluteRootDirectoryPath) !== 0) {
                        addProgramDiagnosticExplainingFile(
                            sourceFile,
                            Diagnostics.File_0_is_not_under_rootDir_1_rootDir_is_expected_to_contain_all_source_files,
                            [sourceFile.fileName, rootDirectory]
                        );
                        allFilesBelongToPath = false;
                    }
                }
            }

            return allFilesBelongToPath;
        }

        function parseProjectReferenceConfigFile(ref: ProjectReference): ResolvedProjectReference | undefined {
            if (!projectReferenceRedirects) {
                projectReferenceRedirects = new Map();
            }

            // The actual filename (i.e. add "/tsconfig.json" if necessary)
            const refPath = resolveProjectReferencePath(ref);
            const sourceFilePath = toPath(refPath);
            const fromCache = projectReferenceRedirects.get(sourceFilePath);
            if (fromCache !== undefined) {
                return fromCache || undefined;
            }

            let commandLine: ParsedCommandLine | undefined;
            let sourceFile: JsonSourceFile | undefined;
            if (host.getParsedCommandLine) {
                commandLine = host.getParsedCommandLine(refPath);
                if (!commandLine) {
                    addFileToFilesByName(/*sourceFile*/ undefined, sourceFilePath, /*redirectedPath*/ undefined);
                    projectReferenceRedirects.set(sourceFilePath, false);
                    return undefined;
                }
                sourceFile = Debug.checkDefined(commandLine.options.configFile);
                Debug.assert(!sourceFile.path || sourceFile.path === sourceFilePath);
                addFileToFilesByName(sourceFile, sourceFilePath, /*redirectedPath*/ undefined);
            }
            else {
                // An absolute path pointing to the containing directory of the config file
                const basePath = getNormalizedAbsolutePath(getDirectoryPath(refPath), host.getCurrentDirectory());
                sourceFile = host.getSourceFile(refPath, ScriptTarget.JSON) as JsonSourceFile | undefined;
                addFileToFilesByName(sourceFile, sourceFilePath, /*redirectedPath*/ undefined);
                if (sourceFile === undefined) {
                    projectReferenceRedirects.set(sourceFilePath, false);
                    return undefined;
                }
                commandLine = parseJsonSourceFileConfigFileContent(sourceFile, configParsingHost, basePath, /*existingOptions*/ undefined, refPath);
            }
            sourceFile.fileName = refPath;
            sourceFile.path = sourceFilePath;
            sourceFile.resolvedPath = sourceFilePath;
            sourceFile.originalFileName = refPath;

            const resolvedRef: ResolvedProjectReference = { commandLine, sourceFile };
            projectReferenceRedirects.set(sourceFilePath, resolvedRef);
            if (commandLine.projectReferences) {
                resolvedRef.references = commandLine.projectReferences.map(parseProjectReferenceConfigFile);
            }
            return resolvedRef;
        }

        function verifyCompilerOptions() {
            if (options.strictPropertyInitialization && !getStrictOptionValue(options, "strictNullChecks")) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "strictPropertyInitialization", "strictNullChecks");
            }
            if (options.exactOptionalPropertyTypes && !getStrictOptionValue(options, "strictNullChecks")) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "exactOptionalPropertyTypes", "strictNullChecks");
            }

            if (options.isolatedModules) {
                if (options.out) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "out", "isolatedModules");
                }

                if (options.outFile) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "outFile", "isolatedModules");
                }
            }

            if (options.inlineSourceMap) {
                if (options.sourceMap) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "sourceMap", "inlineSourceMap");
                }
                if (options.mapRoot) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "mapRoot", "inlineSourceMap");
                }
            }

            if (options.composite) {
                if (options.declaration === false) {
                    createDiagnosticForOptionName(Diagnostics.Composite_projects_may_not_disable_declaration_emit, "declaration");
                }
                if (options.incremental === false) {
                    createDiagnosticForOptionName(Diagnostics.Composite_projects_may_not_disable_incremental_compilation, "declaration");
                }
            }

            const outputFile = outFile(options);
            if (options.tsBuildInfoFile) {
                if (!isIncrementalCompilation(options)) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "tsBuildInfoFile", "incremental", "composite");
                }
            }
            else if (options.incremental && !outputFile && !options.configFilePath) {
                programDiagnostics.add(createCompilerDiagnostic(Diagnostics.Option_incremental_can_only_be_specified_using_tsconfig_emitting_to_single_file_or_when_option_tsBuildInfoFile_is_specified));
            }

            verifyProjectReferences();

            // List of collected files is complete; validate exhautiveness if this is a project with a file list
            if (options.composite) {
                const rootPaths = new Set(rootNames.map(toPath));
                for (const file of files) {
                    // Ignore file that is not emitted
                    if (sourceFileMayBeEmitted(file, program) && !rootPaths.has(file.path)) {
                        addProgramDiagnosticExplainingFile(
                            file,
                            Diagnostics.File_0_is_not_listed_within_the_file_list_of_project_1_Projects_must_list_all_files_or_use_an_include_pattern,
                            [file.fileName, options.configFilePath || ""]
                        );
                    }
                }
            }

            if (options.paths) {
                for (const key in options.paths) {
                    if (!hasProperty(options.paths, key)) {
                        continue;
                    }
                    if (!hasZeroOrOneAsteriskCharacter(key)) {
                        createDiagnosticForOptionPaths(/*onKey*/ true, key, Diagnostics.Pattern_0_can_have_at_most_one_Asterisk_character, key);
                    }
                    if (isArray(options.paths[key])) {
                        const len = options.paths[key].length;
                        if (len === 0) {
                            createDiagnosticForOptionPaths(/*onKey*/ false, key, Diagnostics.Substitutions_for_pattern_0_shouldn_t_be_an_empty_array, key);
                        }
                        for (let i = 0; i < len; i++) {
                            const subst = options.paths[key][i];
                            const typeOfSubst = typeof subst;
                            if (typeOfSubst === "string") {
                                if (!hasZeroOrOneAsteriskCharacter(subst)) {
                                    createDiagnosticForOptionPathKeyValue(key, i, Diagnostics.Substitution_0_in_pattern_1_can_have_at_most_one_Asterisk_character, subst, key);
                                }
                                if (!options.baseUrl && !pathIsRelative(subst) && !pathIsAbsolute(subst)) {
                                    createDiagnosticForOptionPathKeyValue(key, i, Diagnostics.Non_relative_paths_are_not_allowed_when_baseUrl_is_not_set_Did_you_forget_a_leading_Slash);
                                }
                            }
                            else {
                                createDiagnosticForOptionPathKeyValue(key, i, Diagnostics.Substitution_0_for_pattern_1_has_incorrect_type_expected_string_got_2, subst, key, typeOfSubst);
                            }
                        }
                    }
                    else {
                        createDiagnosticForOptionPaths(/*onKey*/ false, key, Diagnostics.Substitutions_for_pattern_0_should_be_an_array, key);
                    }
                }
            }

            if (!options.sourceMap && !options.inlineSourceMap) {
                if (options.inlineSources) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_can_only_be_used_when_either_option_inlineSourceMap_or_option_sourceMap_is_provided, "inlineSources");
                }
                if (options.sourceRoot) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_can_only_be_used_when_either_option_inlineSourceMap_or_option_sourceMap_is_provided, "sourceRoot");
                }
            }

            if (options.out && options.outFile) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "out", "outFile");
            }

            if (options.mapRoot && !(options.sourceMap || options.declarationMap)) {
                // Error to specify --mapRoot without --sourcemap
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "mapRoot", "sourceMap", "declarationMap");
            }

            if (options.declarationDir) {
                if (!getEmitDeclarations(options)) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "declarationDir", "declaration", "composite");
                }
                if (outputFile) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "declarationDir", options.out ? "out" : "outFile");
                }
            }

            if (options.declarationMap && !getEmitDeclarations(options)) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "declarationMap", "declaration", "composite");
            }

            if (options.lib && options.noLib) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "lib", "noLib");
            }

            if (options.noImplicitUseStrict && getStrictOptionValue(options, "alwaysStrict")) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "noImplicitUseStrict", "alwaysStrict");
            }

            const languageVersion = getEmitScriptTarget(options);

            const firstNonAmbientExternalModuleSourceFile = find(files, f => isExternalModule(f) && !f.isDeclarationFile);
            if (options.isolatedModules) {
                if (options.module === ModuleKind.None && languageVersion < ScriptTarget.ES2015) {
                    createDiagnosticForOptionName(Diagnostics.Option_isolatedModules_can_only_be_used_when_either_option_module_is_provided_or_option_target_is_ES2015_or_higher, "isolatedModules", "target");
                }

                if (options.preserveConstEnums === false) {
                    createDiagnosticForOptionName(Diagnostics.Option_preserveConstEnums_cannot_be_disabled_when_isolatedModules_is_enabled, "preserveConstEnums", "isolatedModules");
                }

                const firstNonExternalModuleSourceFile = find(files, f => !isExternalModule(f) && !isSourceFileJS(f) && !f.isDeclarationFile && f.scriptKind !== ScriptKind.JSON);
                if (firstNonExternalModuleSourceFile) {
                    const span = getErrorSpanForNode(firstNonExternalModuleSourceFile, firstNonExternalModuleSourceFile);
                    programDiagnostics.add(createFileDiagnostic(firstNonExternalModuleSourceFile, span.start, span.length,
                        Diagnostics._0_cannot_be_compiled_under_isolatedModules_because_it_is_considered_a_global_script_file_Add_an_import_export_or_an_empty_export_statement_to_make_it_a_module, getBaseFileName(firstNonExternalModuleSourceFile.fileName)));
                }
            }
            else if (firstNonAmbientExternalModuleSourceFile && languageVersion < ScriptTarget.ES2015 && options.module === ModuleKind.None) {
                // We cannot use createDiagnosticFromNode because nodes do not have parents yet
                const span = getErrorSpanForNode(firstNonAmbientExternalModuleSourceFile, typeof firstNonAmbientExternalModuleSourceFile.externalModuleIndicator === "boolean" ? firstNonAmbientExternalModuleSourceFile : firstNonAmbientExternalModuleSourceFile.externalModuleIndicator!);
                programDiagnostics.add(createFileDiagnostic(firstNonAmbientExternalModuleSourceFile, span.start, span.length, Diagnostics.Cannot_use_imports_exports_or_module_augmentations_when_module_is_none));
            }

            // Cannot specify module gen that isn't amd or system with --out
            if (outputFile && !options.emitDeclarationOnly) {
                if (options.module && !(options.module === ModuleKind.AMD || options.module === ModuleKind.System)) {
                    createDiagnosticForOptionName(Diagnostics.Only_amd_and_system_modules_are_supported_alongside_0, options.out ? "out" : "outFile", "module");
                }
                else if (options.module === undefined && firstNonAmbientExternalModuleSourceFile) {
                    const span = getErrorSpanForNode(firstNonAmbientExternalModuleSourceFile, typeof firstNonAmbientExternalModuleSourceFile.externalModuleIndicator === "boolean" ? firstNonAmbientExternalModuleSourceFile : firstNonAmbientExternalModuleSourceFile.externalModuleIndicator!);
                    programDiagnostics.add(createFileDiagnostic(firstNonAmbientExternalModuleSourceFile, span.start, span.length, Diagnostics.Cannot_compile_modules_using_option_0_unless_the_module_flag_is_amd_or_system, options.out ? "out" : "outFile"));
                }
            }

            if (options.resolveJsonModule) {
                if (getEmitModuleResolutionKind(options) !== ModuleResolutionKind.NodeJs &&
                    getEmitModuleResolutionKind(options) !== ModuleResolutionKind.Node12 &&
                    getEmitModuleResolutionKind(options) !== ModuleResolutionKind.NodeNext) {
                    createDiagnosticForOptionName(Diagnostics.Option_resolveJsonModule_cannot_be_specified_without_node_module_resolution_strategy, "resolveJsonModule");
                }
                // Any emit other than common js, amd, es2015 or esnext is error
                else if (!hasJsonModuleEmitEnabled(options)) {
                    createDiagnosticForOptionName(Diagnostics.Option_resolveJsonModule_can_only_be_specified_when_module_code_generation_is_commonjs_amd_es2015_or_esNext, "resolveJsonModule", "module");
                }
            }

            // there has to be common source directory if user specified --outdir || --rootDir || --sourceRoot
            // if user specified --mapRoot, there needs to be common source directory if there would be multiple files being emitted
            if (options.outDir || // there is --outDir specified
                options.rootDir || // there is --rootDir specified
                options.sourceRoot || // there is --sourceRoot specified
                options.mapRoot) { // there is --mapRoot specified

                // Precalculate and cache the common source directory
                const dir = getCommonSourceDirectory();

                // If we failed to find a good common directory, but outDir is specified and at least one of our files is on a windows drive/URL/other resource, add a failure
                if (options.outDir && dir === "" && files.some(file => getRootLength(file.fileName) > 1)) {
                    createDiagnosticForOptionName(Diagnostics.Cannot_find_the_common_subdirectory_path_for_the_input_files, "outDir");
                }
            }

            if (options.useDefineForClassFields && languageVersion === ScriptTarget.ES3) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_when_option_target_is_ES3, "useDefineForClassFields");
            }

            if (options.checkJs && !getAllowJSCompilerOption(options)) {
                programDiagnostics.add(createCompilerDiagnostic(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "checkJs", "allowJs"));
            }

            if (options.emitDeclarationOnly) {
                if (!getEmitDeclarations(options)) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "emitDeclarationOnly", "declaration", "composite");
                }

                if (options.noEmit) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "emitDeclarationOnly", "noEmit");
                }
            }

            if (options.emitDecoratorMetadata &&
                !options.experimentalDecorators) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "emitDecoratorMetadata", "experimentalDecorators");
            }

            if (options.jsxFactory) {
                if (options.reactNamespace) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "reactNamespace", "jsxFactory");
                }
                if (options.jsx === JsxEmit.ReactJSX || options.jsx === JsxEmit.ReactJSXDev) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "jsxFactory", inverseJsxOptionMap.get("" + options.jsx));
                }
                if (!parseIsolatedEntityName(options.jsxFactory, languageVersion)) {
                    createOptionValueDiagnostic("jsxFactory", Diagnostics.Invalid_value_for_jsxFactory_0_is_not_a_valid_identifier_or_qualified_name, options.jsxFactory);
                }
            }
            else if (options.reactNamespace && !isIdentifierText(options.reactNamespace, languageVersion)) {
                createOptionValueDiagnostic("reactNamespace", Diagnostics.Invalid_value_for_reactNamespace_0_is_not_a_valid_identifier, options.reactNamespace);
            }

            if (options.jsxFragmentFactory) {
                if (!options.jsxFactory) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "jsxFragmentFactory", "jsxFactory");
                }
                if (options.jsx === JsxEmit.ReactJSX || options.jsx === JsxEmit.ReactJSXDev) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "jsxFragmentFactory", inverseJsxOptionMap.get("" + options.jsx));
                }
                if (!parseIsolatedEntityName(options.jsxFragmentFactory, languageVersion)) {
                    createOptionValueDiagnostic("jsxFragmentFactory", Diagnostics.Invalid_value_for_jsxFragmentFactory_0_is_not_a_valid_identifier_or_qualified_name, options.jsxFragmentFactory);
                }
            }

            if (options.reactNamespace) {
                if (options.jsx === JsxEmit.ReactJSX || options.jsx === JsxEmit.ReactJSXDev) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "reactNamespace", inverseJsxOptionMap.get("" + options.jsx));
                }
            }

            if (options.jsxImportSource) {
                if (options.jsx === JsxEmit.React) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "jsxImportSource", inverseJsxOptionMap.get("" + options.jsx));
                }
            }

            if (options.preserveValueImports && getEmitModuleKind(options) < ModuleKind.ES2015) {
                createOptionValueDiagnostic("importsNotUsedAsValues", Diagnostics.Option_preserveValueImports_can_only_be_used_when_module_is_set_to_es2015_or_later);
            }

            // If the emit is enabled make sure that every output file is unique and not overwriting any of the input files
            if (!options.noEmit && !options.suppressOutputPathCheck) {
                const emitHost = getEmitHost();
                const emitFilesSeen = new Set<string>();
                forEachEmittedFile(emitHost, (emitFileNames) => {
                    if (!options.emitDeclarationOnly) {
                        verifyEmitFilePath(emitFileNames.jsFilePath, emitFilesSeen);
                    }
                    verifyEmitFilePath(emitFileNames.declarationFilePath, emitFilesSeen);
                });
            }

            // Verify that all the emit files are unique and don't overwrite input files
            function verifyEmitFilePath(emitFileName: string | undefined, emitFilesSeen: Set<string>) {
                if (emitFileName) {
                    const emitFilePath = toPath(emitFileName);
                    // Report error if the output overwrites input file
                    if (filesByName.has(emitFilePath)) {
                        let chain: DiagnosticMessageChain | undefined;
                        if (!options.configFilePath) {
                            // The program is from either an inferred project or an external project
                            chain = chainDiagnosticMessages(/*details*/ undefined, Diagnostics.Adding_a_tsconfig_json_file_will_help_organize_projects_that_contain_both_TypeScript_and_JavaScript_files_Learn_more_at_https_Colon_Slash_Slashaka_ms_Slashtsconfig);
                        }
                        chain = chainDiagnosticMessages(chain, Diagnostics.Cannot_write_file_0_because_it_would_overwrite_input_file, emitFileName);
                        blockEmittingOfFile(emitFileName, createCompilerDiagnosticFromMessageChain(chain));
                    }

                    const emitFileKey = !host.useCaseSensitiveFileNames() ? toFileNameLowerCase(emitFilePath) : emitFilePath;
                    // Report error if multiple files write into same file
                    if (emitFilesSeen.has(emitFileKey)) {
                        // Already seen the same emit file - report error
                        blockEmittingOfFile(emitFileName, createCompilerDiagnostic(Diagnostics.Cannot_write_file_0_because_it_would_be_overwritten_by_multiple_input_files, emitFileName));
                    }
                    else {
                        emitFilesSeen.add(emitFileKey);
                    }
                }
            }
        }

        function createDiagnosticExplainingFile(file: SourceFile | undefined, fileProcessingReason: FileIncludeReason | undefined, diagnostic: DiagnosticMessage, args: (string | number | undefined)[] | undefined): Diagnostic {
            let fileIncludeReasons: DiagnosticMessageChain[] | undefined;
            let relatedInfo: Diagnostic[] | undefined;
            let locationReason = isReferencedFile(fileProcessingReason) ? fileProcessingReason : undefined;
            if (file) fileReasons.get(file.path)?.forEach(processReason);
            if (fileProcessingReason) processReason(fileProcessingReason);
            // If we have location and there is only one reason file is in which is the location, dont add details for file include
            if (locationReason && fileIncludeReasons?.length === 1) fileIncludeReasons = undefined;
            const location = locationReason && getReferencedFileLocation(getSourceFileByPath, locationReason);
            const fileIncludeReasonDetails = fileIncludeReasons && chainDiagnosticMessages(fileIncludeReasons, Diagnostics.The_file_is_in_the_program_because_Colon);
            const redirectInfo = file && explainIfFileIsRedirect(file);
            const chain = chainDiagnosticMessages(redirectInfo ? fileIncludeReasonDetails ? [fileIncludeReasonDetails, ...redirectInfo] : redirectInfo : fileIncludeReasonDetails, diagnostic, ...args || emptyArray);
            return location && isReferenceFileLocation(location) ?
                createFileDiagnosticFromMessageChain(location.file, location.pos, location.end - location.pos, chain, relatedInfo) :
                createCompilerDiagnosticFromMessageChain(chain, relatedInfo);

            function processReason(reason: FileIncludeReason) {
                (fileIncludeReasons ||= []).push(fileIncludeReasonToDiagnostics(program, reason));
                if (!locationReason && isReferencedFile(reason)) {
                    // Report error at first reference file or file currently in processing and dont report in related information
                    locationReason = reason;
                }
                else if (locationReason !== reason) {
                    relatedInfo = append(relatedInfo, fileIncludeReasonToRelatedInformation(reason));
                }
                // Remove fileProcessingReason if its already included in fileReasons of the program
                if (reason === fileProcessingReason) fileProcessingReason = undefined;
            }
        }

        function addFilePreprocessingFileExplainingDiagnostic(file: SourceFile | undefined, fileProcessingReason: FileIncludeReason, diagnostic: DiagnosticMessage, args?: (string | number | undefined)[]) {
            (fileProcessingDiagnostics ||= []).push({
                kind: FilePreprocessingDiagnosticsKind.FilePreprocessingFileExplainingDiagnostic,
                file: file && file.path,
                fileProcessingReason,
                diagnostic,
                args
            });
        }

        function addProgramDiagnosticExplainingFile(file: SourceFile, diagnostic: DiagnosticMessage, args?: (string | number | undefined)[]) {
            programDiagnostics.add(createDiagnosticExplainingFile(file, /*fileProcessingReason*/ undefined, diagnostic, args));
        }

        function fileIncludeReasonToRelatedInformation(reason: FileIncludeReason): DiagnosticWithLocation | undefined {
            if (isReferencedFile(reason)) {
                const referenceLocation = getReferencedFileLocation(getSourceFileByPath, reason);
                let message: DiagnosticMessage;
                switch (reason.kind) {
                    case FileIncludeKind.Import:
                        message = Diagnostics.File_is_included_via_import_here;
                        break;
                    case FileIncludeKind.ReferenceFile:
                        message = Diagnostics.File_is_included_via_reference_here;
                        break;
                    case FileIncludeKind.TypeReferenceDirective:
                        message = Diagnostics.File_is_included_via_type_library_reference_here;
                        break;
                    case FileIncludeKind.LibReferenceDirective:
                        message = Diagnostics.File_is_included_via_library_reference_here;
                        break;
                    default:
                        Debug.assertNever(reason);
                }
                return isReferenceFileLocation(referenceLocation) ? createFileDiagnostic(
                    referenceLocation.file,
                    referenceLocation.pos,
                    referenceLocation.end - referenceLocation.pos,
                    message,
                ) : undefined;
            }

            if (!options.configFile) return undefined;
            let configFileNode: Node | undefined;
            let message: DiagnosticMessage;
            switch (reason.kind) {
                case FileIncludeKind.RootFile:
                    if (!options.configFile.configFileSpecs) return undefined;
                    const fileName = getNormalizedAbsolutePath(rootNames[reason.index], currentDirectory);
                    const matchedByFiles = getMatchedFileSpec(program, fileName);
                    if (matchedByFiles) {
                        configFileNode = getTsConfigPropArrayElementValue(options.configFile, "files", matchedByFiles);
                        message = Diagnostics.File_is_matched_by_files_list_specified_here;
                        break;
                    }
                    const matchedByInclude = getMatchedIncludeSpec(program, fileName);
                    // Could be additional files specified as roots
                    if (!matchedByInclude) return undefined;
                    configFileNode = getTsConfigPropArrayElementValue(options.configFile, "include", matchedByInclude);
                    message = Diagnostics.File_is_matched_by_include_pattern_specified_here;
                    break;
                case FileIncludeKind.SourceFromProjectReference:
                case FileIncludeKind.OutputFromProjectReference:
                    const referencedResolvedRef = Debug.checkDefined(resolvedProjectReferences?.[reason.index]);
                    const referenceInfo = forEachProjectReference(projectReferences, resolvedProjectReferences, (resolvedRef, parent, index) =>
                        resolvedRef === referencedResolvedRef ? { sourceFile: parent?.sourceFile || options.configFile!, index } : undefined
                    );
                    if (!referenceInfo) return undefined;
                    const { sourceFile, index } = referenceInfo;
                    const referencesSyntax = firstDefined(getTsConfigPropArray(sourceFile as TsConfigSourceFile, "references"),
                        property => isArrayLiteralExpression(property.initializer) ? property.initializer : undefined);
                    return referencesSyntax && referencesSyntax.elements.length > index ?
                        createDiagnosticForNodeInSourceFile(
                            sourceFile,
                            referencesSyntax.elements[index],
                            reason.kind === FileIncludeKind.OutputFromProjectReference ?
                                Diagnostics.File_is_output_from_referenced_project_specified_here :
                                Diagnostics.File_is_source_from_referenced_project_specified_here,
                        ) :
                        undefined;
                case FileIncludeKind.AutomaticTypeDirectiveFile:
                    if (!options.types) return undefined;
                    configFileNode = getOptionsSyntaxByArrayElementValue("types", reason.typeReference);
                    message = Diagnostics.File_is_entry_point_of_type_library_specified_here;
                    break;
                case FileIncludeKind.LibFile:
                    if (reason.index !== undefined) {
                        configFileNode = getOptionsSyntaxByArrayElementValue("lib", options.lib![reason.index]);
                        message = Diagnostics.File_is_library_specified_here;
                        break;
                    }
                    const target = forEachEntry(targetOptionDeclaration.type, (value, key) => value === getEmitScriptTarget(options) ? key : undefined);
                    configFileNode = target ? getOptionsSyntaxByValue("target", target) : undefined;
                    message = Diagnostics.File_is_default_library_for_target_specified_here;
                    break;
                default:
                    Debug.assertNever(reason);
            }
            return configFileNode && createDiagnosticForNodeInSourceFile(
                options.configFile,
                configFileNode,
                message,
            );
        }

        function verifyProjectReferences() {
            const buildInfoPath = !options.suppressOutputPathCheck ? getTsBuildInfoEmitOutputFilePath(options) : undefined;
            forEachProjectReference(projectReferences, resolvedProjectReferences, (resolvedRef, parent, index) => {
                const ref = (parent ? parent.commandLine.projectReferences : projectReferences)![index];
                const parentFile = parent && parent.sourceFile as JsonSourceFile;
                if (!resolvedRef) {
                    createDiagnosticForReference(parentFile, index, Diagnostics.File_0_not_found, ref.path);
                    return;
                }
                const options = resolvedRef.commandLine.options;
                if (!options.composite || options.noEmit) {
                    // ok to not have composite if the current program is container only
                    const inputs = parent ? parent.commandLine.fileNames : rootNames;
                    if (inputs.length) {
                        if (!options.composite) createDiagnosticForReference(parentFile, index, Diagnostics.Referenced_project_0_must_have_setting_composite_Colon_true, ref.path);
                        if (options.noEmit) createDiagnosticForReference(parentFile, index, Diagnostics.Referenced_project_0_may_not_disable_emit, ref.path);
                    }
                }
                if (ref.prepend) {
                    const out = outFile(options);
                    if (out) {
                        if (!host.fileExists(out)) {
                            createDiagnosticForReference(parentFile, index, Diagnostics.Output_file_0_from_project_1_does_not_exist, out, ref.path);
                        }
                    }
                    else {
                        createDiagnosticForReference(parentFile, index, Diagnostics.Cannot_prepend_project_0_because_it_does_not_have_outFile_set, ref.path);
                    }
                }
                if (!parent && buildInfoPath && buildInfoPath === getTsBuildInfoEmitOutputFilePath(options)) {
                    createDiagnosticForReference(parentFile, index, Diagnostics.Cannot_write_file_0_because_it_will_overwrite_tsbuildinfo_file_generated_by_referenced_project_1, buildInfoPath, ref.path);
                    hasEmitBlockingDiagnostics.set(toPath(buildInfoPath), true);
                }
            });
        }

        function createDiagnosticForOptionPathKeyValue(key: string, valueIndex: number, message: DiagnosticMessage, arg0?: string | number, arg1?: string | number, arg2?: string | number) {
            let needCompilerDiagnostic = true;
            const pathsSyntax = getOptionPathsSyntax();
            for (const pathProp of pathsSyntax) {
                if (isObjectLiteralExpression(pathProp.initializer)) {
                    for (const keyProps of getPropertyAssignment(pathProp.initializer, key)) {
                        const initializer = keyProps.initializer;
                        if (isArrayLiteralExpression(initializer) && initializer.elements.length > valueIndex) {
                            programDiagnostics.add(createDiagnosticForNodeInSourceFile(options.configFile!, initializer.elements[valueIndex], message, arg0, arg1, arg2));
                            needCompilerDiagnostic = false;
                        }
                    }
                }
            }

            if (needCompilerDiagnostic) {
                programDiagnostics.add(createCompilerDiagnostic(message, arg0, arg1, arg2));
            }
        }

        function createDiagnosticForOptionPaths(onKey: boolean, key: string, message: DiagnosticMessage, arg0: string | number) {
            let needCompilerDiagnostic = true;
            const pathsSyntax = getOptionPathsSyntax();
            for (const pathProp of pathsSyntax) {
                if (isObjectLiteralExpression(pathProp.initializer) &&
                    createOptionDiagnosticInObjectLiteralSyntax(
                        pathProp.initializer, onKey, key, /*key2*/ undefined,
                        message, arg0)) {
                    needCompilerDiagnostic = false;
                }
            }
            if (needCompilerDiagnostic) {
                programDiagnostics.add(createCompilerDiagnostic(message, arg0));
            }
        }

        function getOptionsSyntaxByName(name: string) {
            const compilerOptionsObjectLiteralSyntax = getCompilerOptionsObjectLiteralSyntax();
            return compilerOptionsObjectLiteralSyntax && getPropertyAssignment(compilerOptionsObjectLiteralSyntax, name);
        }

        function getOptionPathsSyntax() {
            return getOptionsSyntaxByName("paths") || emptyArray;
        }

        function getOptionsSyntaxByValue(name: string, value: string) {
            const syntaxByName = getOptionsSyntaxByName(name);
            return syntaxByName && firstDefined(syntaxByName, property => isStringLiteral(property.initializer) && property.initializer.text === value ? property.initializer : undefined);
        }

        function getOptionsSyntaxByArrayElementValue(name: string, value: string) {
            const compilerOptionsObjectLiteralSyntax = getCompilerOptionsObjectLiteralSyntax();
            return compilerOptionsObjectLiteralSyntax && getPropertyArrayElementValue(compilerOptionsObjectLiteralSyntax, name, value);
        }

        function createDiagnosticForOptionName(message: DiagnosticMessage, option1: string, option2?: string, option3?: string) {
            createDiagnosticForOption(/*onKey*/ true, option1, option2, message, option1, option2, option3);
        }

        function createOptionValueDiagnostic(option1: string, message: DiagnosticMessage, arg0?: string, arg1?: string) {
            createDiagnosticForOption(/*onKey*/ false, option1, /*option2*/ undefined, message, arg0, arg1);
        }

        function createDiagnosticForReference(sourceFile: JsonSourceFile | undefined, index: number, message: DiagnosticMessage, arg0?: string | number, arg1?: string | number) {
            const referencesSyntax = firstDefined(getTsConfigPropArray(sourceFile || options.configFile, "references"),
                property => isArrayLiteralExpression(property.initializer) ? property.initializer : undefined);
            if (referencesSyntax && referencesSyntax.elements.length > index) {
                programDiagnostics.add(createDiagnosticForNodeInSourceFile(sourceFile || options.configFile!, referencesSyntax.elements[index], message, arg0, arg1));
            }
            else {
                programDiagnostics.add(createCompilerDiagnostic(message, arg0, arg1));
            }
        }

        function createDiagnosticForOption(onKey: boolean, option1: string, option2: string | undefined, message: DiagnosticMessage, arg0?: string | number, arg1?: string | number, arg2?: string | number) {
            const compilerOptionsObjectLiteralSyntax = getCompilerOptionsObjectLiteralSyntax();
            const needCompilerDiagnostic = !compilerOptionsObjectLiteralSyntax ||
                !createOptionDiagnosticInObjectLiteralSyntax(compilerOptionsObjectLiteralSyntax, onKey, option1, option2, message, arg0, arg1, arg2);

            if (needCompilerDiagnostic) {
                programDiagnostics.add(createCompilerDiagnostic(message, arg0, arg1, arg2));
            }
        }

        function getCompilerOptionsObjectLiteralSyntax() {
            if (_compilerOptionsObjectLiteralSyntax === undefined) {
                _compilerOptionsObjectLiteralSyntax = false;
                const jsonObjectLiteral = getTsConfigObjectLiteralExpression(options.configFile);
                if (jsonObjectLiteral) {
                    for (const prop of getPropertyAssignment(jsonObjectLiteral, "compilerOptions")) {
                        if (isObjectLiteralExpression(prop.initializer)) {
                            _compilerOptionsObjectLiteralSyntax = prop.initializer;
                            break;
                        }
                    }
                }
            }
            return _compilerOptionsObjectLiteralSyntax || undefined;
        }

        function createOptionDiagnosticInObjectLiteralSyntax(objectLiteral: ObjectLiteralExpression, onKey: boolean, key1: string, key2: string | undefined, message: DiagnosticMessage, arg0?: string | number, arg1?: string | number, arg2?: string | number): boolean {
            const props = getPropertyAssignment(objectLiteral, key1, key2);
            for (const prop of props) {
                programDiagnostics.add(createDiagnosticForNodeInSourceFile(options.configFile!, onKey ? prop.name : prop.initializer, message, arg0, arg1, arg2));
            }
            return !!props.length;
        }

        function blockEmittingOfFile(emitFileName: string, diag: Diagnostic) {
            hasEmitBlockingDiagnostics.set(toPath(emitFileName), true);
            programDiagnostics.add(diag);
        }

        function isEmittedFile(file: string): boolean {
            if (options.noEmit) {
                return false;
            }

            // If this is source file, its not emitted file
            const filePath = toPath(file);
            if (getSourceFileByPath(filePath)) {
                return false;
            }

            // If options have --outFile or --out just check that
            const out = outFile(options);
            if (out) {
                return isSameFile(filePath, out) || isSameFile(filePath, removeFileExtension(out) + Extension.Dts);
            }

            // If declarationDir is specified, return if its a file in that directory
            if (options.declarationDir && containsPath(options.declarationDir, filePath, currentDirectory, !host.useCaseSensitiveFileNames())) {
                return true;
            }

            // If --outDir, check if file is in that directory
            if (options.outDir) {
                return containsPath(options.outDir, filePath, currentDirectory, !host.useCaseSensitiveFileNames());
            }

            if (fileExtensionIsOneOf(filePath, supportedJSExtensionsFlat) || fileExtensionIs(filePath, Extension.Dts)) {
                // Otherwise just check if sourceFile with the name exists
                const filePathWithoutExtension = removeFileExtension(filePath);
                return !!getSourceFileByPath((filePathWithoutExtension + Extension.Ts) as Path) ||
                    !!getSourceFileByPath((filePathWithoutExtension + Extension.Tsx) as Path);
            }
            return false;
        }

        function isSameFile(file1: string, file2: string) {
            return comparePaths(file1, file2, currentDirectory, !host.useCaseSensitiveFileNames()) === Comparison.EqualTo;
        }

        function getSymlinkCache(): SymlinkCache {
            if (host.getSymlinkCache) {
                return host.getSymlinkCache();
            }
            if (!symlinks) {
                symlinks = createSymlinkCache(currentDirectory, getCanonicalFileName);
            }
            if (files && resolvedTypeReferenceDirectives && !symlinks.hasProcessedResolutions()) {
                symlinks.setSymlinksFromResolutions(files, resolvedTypeReferenceDirectives);
            }
            return symlinks;
        }
    }

    interface HostForUseSourceOfProjectReferenceRedirect {
        compilerHost: CompilerHost;
        getSymlinkCache: () => SymlinkCache;
        useSourceOfProjectReferenceRedirect: boolean;
        toPath(fileName: string): Path;
        getResolvedProjectReferences(): readonly (ResolvedProjectReference | undefined)[] | undefined;
        getSourceOfProjectReferenceRedirect(path: Path): SourceOfProjectReferenceRedirect | undefined;
        forEachResolvedProjectReference<T>(cb: (resolvedProjectReference: ResolvedProjectReference) => T | undefined): T | undefined;
    }

    function updateHostForUseSourceOfProjectReferenceRedirect(host: HostForUseSourceOfProjectReferenceRedirect) {
        let setOfDeclarationDirectories: Set<Path> | undefined;
        const originalFileExists = host.compilerHost.fileExists;
        const originalDirectoryExists = host.compilerHost.directoryExists;
        const originalGetDirectories = host.compilerHost.getDirectories;
        const originalRealpath = host.compilerHost.realpath;

        if (!host.useSourceOfProjectReferenceRedirect) return { onProgramCreateComplete: noop, fileExists };

        host.compilerHost.fileExists = fileExists;

        let directoryExists;
        if (originalDirectoryExists) {
            // This implementation of directoryExists checks if the directory being requested is
            // directory of .d.ts file for the referenced Project.
            // If it is it returns true irrespective of whether that directory exists on host
            directoryExists = host.compilerHost.directoryExists = path => {
                if (originalDirectoryExists.call(host.compilerHost, path)) {
                    handleDirectoryCouldBeSymlink(path);
                    return true;
                }

                if (!host.getResolvedProjectReferences()) return false;

                if (!setOfDeclarationDirectories) {
                    setOfDeclarationDirectories = new Set();
                    host.forEachResolvedProjectReference(ref => {
                        const out = outFile(ref.commandLine.options);
                        if (out) {
                            setOfDeclarationDirectories!.add(getDirectoryPath(host.toPath(out)));
                        }
                        else {
                            // Set declaration's in different locations only, if they are next to source the directory present doesnt change
                            const declarationDir = ref.commandLine.options.declarationDir || ref.commandLine.options.outDir;
                            if (declarationDir) {
                                setOfDeclarationDirectories!.add(host.toPath(declarationDir));
                            }
                        }
                    });
                }

                return fileOrDirectoryExistsUsingSource(path, /*isFile*/ false);
            };
        }

        if (originalGetDirectories) {
            // Call getDirectories only if directory actually present on the host
            // This is needed to ensure that we arent getting directories that we fake about presence for
            host.compilerHost.getDirectories = path =>
                !host.getResolvedProjectReferences() || (originalDirectoryExists && originalDirectoryExists.call(host.compilerHost, path)) ?
                    originalGetDirectories.call(host.compilerHost, path) :
                    [];
        }

        // This is something we keep for life time of the host
        if (originalRealpath) {
            host.compilerHost.realpath = s =>
                host.getSymlinkCache().getSymlinkedFiles()?.get(host.toPath(s)) ||
                originalRealpath.call(host.compilerHost, s);
        }

        return { onProgramCreateComplete, fileExists, directoryExists };

        function onProgramCreateComplete() {
            host.compilerHost.fileExists = originalFileExists;
            host.compilerHost.directoryExists = originalDirectoryExists;
            host.compilerHost.getDirectories = originalGetDirectories;
            // DO not revert realpath as it could be used later
        }

        // This implementation of fileExists checks if the file being requested is
        // .d.ts file for the referenced Project.
        // If it is it returns true irrespective of whether that file exists on host
        function fileExists(file: string) {
            if (originalFileExists.call(host.compilerHost, file)) return true;
            if (!host.getResolvedProjectReferences()) return false;
            if (!isDeclarationFileName(file)) return false;

            // Project references go to source file instead of .d.ts file
            return fileOrDirectoryExistsUsingSource(file, /*isFile*/ true);
        }

        function fileExistsIfProjectReferenceDts(file: string) {
            const source = host.getSourceOfProjectReferenceRedirect(host.toPath(file));
            return source !== undefined ?
                isString(source) ? originalFileExists.call(host.compilerHost, source) as boolean : true :
                undefined;
        }

        function directoryExistsIfProjectReferenceDeclDir(dir: string) {
            const dirPath = host.toPath(dir);
            const dirPathWithTrailingDirectorySeparator = `${dirPath}${directorySeparator}`;
            return forEachKey(
                setOfDeclarationDirectories!,
                declDirPath => dirPath === declDirPath ||
                    // Any parent directory of declaration dir
                    startsWith(declDirPath, dirPathWithTrailingDirectorySeparator) ||
                    // Any directory inside declaration dir
                    startsWith(dirPath, `${declDirPath}/`)
            );
        }

        function handleDirectoryCouldBeSymlink(directory: string) {
            if (!host.getResolvedProjectReferences() || containsIgnoredPath(directory)) return;

            // Because we already watch node_modules, handle symlinks in there
            if (!originalRealpath || !stringContains(directory, nodeModulesPathPart)) return;
            const symlinkCache = host.getSymlinkCache();
            const directoryPath = ensureTrailingDirectorySeparator(host.toPath(directory));
            if (symlinkCache.getSymlinkedDirectories()?.has(directoryPath)) return;

            const real = normalizePath(originalRealpath.call(host.compilerHost, directory));
            let realPath: Path;
            if (real === directory ||
                (realPath = ensureTrailingDirectorySeparator(host.toPath(real))) === directoryPath) {
                // not symlinked
                symlinkCache.setSymlinkedDirectory(directoryPath, false);
                return;
            }

            symlinkCache.setSymlinkedDirectory(directory, {
                real: ensureTrailingDirectorySeparator(real),
                realPath
            });
        }

        function fileOrDirectoryExistsUsingSource(fileOrDirectory: string, isFile: boolean): boolean {
            const fileOrDirectoryExistsUsingSource = isFile ?
                (file: string) => fileExistsIfProjectReferenceDts(file) :
                (dir: string) => directoryExistsIfProjectReferenceDeclDir(dir);
            // Check current directory or file
            const result = fileOrDirectoryExistsUsingSource(fileOrDirectory);
            if (result !== undefined) return result;

            const symlinkCache = host.getSymlinkCache();
            const symlinkedDirectories = symlinkCache.getSymlinkedDirectories();
            if (!symlinkedDirectories) return false;
            const fileOrDirectoryPath = host.toPath(fileOrDirectory);
            if (!stringContains(fileOrDirectoryPath, nodeModulesPathPart)) return false;
            if (isFile && symlinkCache.getSymlinkedFiles()?.has(fileOrDirectoryPath)) return true;

            // If it contains node_modules check if its one of the symlinked path we know of
            return firstDefinedIterator(
                symlinkedDirectories.entries(),
                ([directoryPath, symlinkedDirectory]) => {
                    if (!symlinkedDirectory || !startsWith(fileOrDirectoryPath, directoryPath)) return undefined;
                    const result = fileOrDirectoryExistsUsingSource(fileOrDirectoryPath.replace(directoryPath, symlinkedDirectory.realPath));
                    if (isFile && result) {
                        // Store the real path for the file'
                        const absolutePath = getNormalizedAbsolutePath(fileOrDirectory, host.compilerHost.getCurrentDirectory());
                        symlinkCache.setSymlinkedFile(
                            fileOrDirectoryPath,
                            `${symlinkedDirectory.real}${absolutePath.replace(new RegExp(directoryPath, "i"), "")}`
                        );
                    }
                    return result;
                }
            ) || false;
        }
    }

    /*@internal*/
    export const emitSkippedWithNoDiagnostics: EmitResult = { diagnostics: emptyArray, sourceMaps: undefined, emittedFiles: undefined, emitSkipped: true };

    /*@internal*/
    export function handleNoEmitOptions<T extends BuilderProgram>(
        program: Program | T,
        sourceFile: SourceFile | undefined,
        writeFile: WriteFileCallback | undefined,
        cancellationToken: CancellationToken | undefined
    ): EmitResult | undefined {
        const options = program.getCompilerOptions();
        if (options.noEmit) {
            // Cache the semantic diagnostics
            program.getSemanticDiagnostics(sourceFile, cancellationToken);
            return sourceFile || outFile(options) ?
                emitSkippedWithNoDiagnostics :
                program.emitBuildInfo(writeFile, cancellationToken);
        }

        // If the noEmitOnError flag is set, then check if we have any errors so far.  If so,
        // immediately bail out.  Note that we pass 'undefined' for 'sourceFile' so that we
        // get any preEmit diagnostics, not just the ones
        if (!options.noEmitOnError) return undefined;
        let diagnostics: readonly Diagnostic[] = [
            ...program.getOptionsDiagnostics(cancellationToken),
            ...program.getSyntacticDiagnostics(sourceFile, cancellationToken),
            ...program.getGlobalDiagnostics(cancellationToken),
            ...program.getSemanticDiagnostics(sourceFile, cancellationToken)
        ];

        if (diagnostics.length === 0 && getEmitDeclarations(program.getCompilerOptions())) {
            diagnostics = program.getDeclarationDiagnostics(/*sourceFile*/ undefined, cancellationToken);
        }

        if (!diagnostics.length) return undefined;
        let emittedFiles: string[] | undefined;
        if (!sourceFile && !outFile(options)) {
            const emitResult = program.emitBuildInfo(writeFile, cancellationToken);
            if (emitResult.diagnostics) diagnostics = [...diagnostics, ...emitResult.diagnostics];
            emittedFiles = emitResult.emittedFiles;
        }
        return { diagnostics, sourceMaps: undefined, emittedFiles, emitSkipped: true };
    }

    /*@internal*/
    export function filterSemanticDiagnostics(diagnostic: readonly Diagnostic[], option: CompilerOptions): readonly Diagnostic[] {
        return filter(diagnostic, d => !d.skippedOn || !option[d.skippedOn]);
    }

    /*@internal*/
    interface CompilerHostLike {
        useCaseSensitiveFileNames(): boolean;
        getCurrentDirectory(): string;
        fileExists(fileName: string): boolean;
        readFile(fileName: string): string | undefined;
        readDirectory?(rootDir: string, extensions: readonly string[], excludes: readonly string[] | undefined, includes: readonly string[], depth?: number): string[];
        trace?(s: string): void;
        onUnRecoverableConfigFileDiagnostic?: DiagnosticReporter;
    }

    /* @internal */
    export function parseConfigHostFromCompilerHostLike(host: CompilerHostLike, directoryStructureHost: DirectoryStructureHost = host): ParseConfigFileHost {
        return {
            fileExists: f => directoryStructureHost.fileExists(f),
            readDirectory(root, extensions, excludes, includes, depth) {
                Debug.assertIsDefined(directoryStructureHost.readDirectory, "'CompilerHost.readDirectory' must be implemented to correctly process 'projectReferences'");
                return directoryStructureHost.readDirectory(root, extensions, excludes, includes, depth);
            },
            readFile: f => directoryStructureHost.readFile(f),
            useCaseSensitiveFileNames: host.useCaseSensitiveFileNames(),
            getCurrentDirectory: () => host.getCurrentDirectory(),
            onUnRecoverableConfigFileDiagnostic: host.onUnRecoverableConfigFileDiagnostic || returnUndefined,
            trace: host.trace ? (s) => host.trace!(s) : undefined
        };
    }

    // For backward compatibility
    /** @deprecated */ export interface ResolveProjectReferencePathHost {
        fileExists(fileName: string): boolean;
    }

    /* @internal */
    export function createPrependNodes(projectReferences: readonly ProjectReference[] | undefined, getCommandLine: (ref: ProjectReference, index: number) => ParsedCommandLine | undefined, readFile: (path: string) => string | undefined) {
        if (!projectReferences) return emptyArray;
        let nodes: InputFiles[] | undefined;
        for (let i = 0; i < projectReferences.length; i++) {
            const ref = projectReferences[i];
            const resolvedRefOpts = getCommandLine(ref, i);
            if (ref.prepend && resolvedRefOpts && resolvedRefOpts.options) {
                const out = outFile(resolvedRefOpts.options);
                // Upstream project didn't have outFile set -- skip (error will have been issued earlier)
                if (!out) continue;

                const { jsFilePath, sourceMapFilePath, declarationFilePath, declarationMapPath, buildInfoPath } = getOutputPathsForBundle(resolvedRefOpts.options, /*forceDtsPaths*/ true);
                const node = createInputFiles(readFile, jsFilePath!, sourceMapFilePath, declarationFilePath!, declarationMapPath, buildInfoPath);
                (nodes || (nodes = [])).push(node);
            }
        }
        return nodes || emptyArray;
    }
    /**
     * Returns the target config filename of a project reference.
     * Note: The file might not exist.
     */
    export function resolveProjectReferencePath(ref: ProjectReference): ResolvedConfigFileName;
    /** @deprecated */ export function resolveProjectReferencePath(host: ResolveProjectReferencePathHost, ref: ProjectReference): ResolvedConfigFileName;
    export function resolveProjectReferencePath(hostOrRef: ResolveProjectReferencePathHost | ProjectReference, ref?: ProjectReference): ResolvedConfigFileName {
        const passedInRef = ref ? ref : hostOrRef as ProjectReference;
        return resolveConfigFileProjectName(passedInRef.path);
    }

    /* @internal */
    /**
     * Returns a DiagnosticMessage if we won't include a resolved module due to its extension.
     * The DiagnosticMessage's parameters are the imported module name, and the filename it resolved to.
     * This returns a diagnostic even if the module will be an untyped module.
     */
    export function getResolutionDiagnostic(options: CompilerOptions, { extension }: ResolvedModuleFull): DiagnosticMessage | undefined {
        switch (extension) {
            case Extension.Ts:
            case Extension.Dts:
                // These are always allowed.
                return undefined;
            case Extension.Tsx:
                return needJsx();
            case Extension.Jsx:
                return needJsx() || needAllowJs();
            case Extension.Js:
                return needAllowJs();
            case Extension.Json:
                return needResolveJsonModule();
        }

        function needJsx() {
            return options.jsx ? undefined : Diagnostics.Module_0_was_resolved_to_1_but_jsx_is_not_set;
        }
        function needAllowJs() {
            return getAllowJSCompilerOption(options) || !getStrictOptionValue(options, "noImplicitAny") ? undefined : Diagnostics.Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type;
        }
        function needResolveJsonModule() {
            return options.resolveJsonModule ? undefined : Diagnostics.Module_0_was_resolved_to_1_but_resolveJsonModule_is_not_used;
        }
    }

    function getModuleNames({ imports, moduleAugmentations }: SourceFile): string[] {
        const res = imports.map(i => i.text);
        for (const aug of moduleAugmentations) {
            if (aug.kind === SyntaxKind.StringLiteral) {
                res.push(aug.text);
            }
            // Do nothing if it's an Identifier; we don't need to do module resolution for `declare global`.
        }
        return res;
    }

    /* @internal */
    export function getModuleNameStringLiteralAt({ imports, moduleAugmentations }: SourceFileImportsList, index: number): StringLiteralLike {
        if (index < imports.length) return imports[index];
        let augIndex = imports.length;
        for (const aug of moduleAugmentations) {
            if (aug.kind === SyntaxKind.StringLiteral) {
                if (index === augIndex) return aug;
                augIndex++;
            }
            // Do nothing if it's an Identifier; we don't need to do module resolution for `declare global`.
        }
        Debug.fail("should never ask for module name at index higher than possible module name");
    }
}
