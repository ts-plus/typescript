import {
    AccessorDeclaration,
    addRelatedInfo,
    AllAccessorDeclarations,
    AnyImportSyntax,
    append,
    ArrayBindingElement,
    arrayFrom,
    AssertClause,
    BindingElement,
    BindingName,
    BindingPattern,
    Bundle,
    CallSignatureDeclaration,
    canHaveModifiers,
    canProduceDiagnostics,
    ClassDeclaration,
    CommentRange,
    compact,
    concatenate,
    ConditionalTypeNode,
    ConstructorDeclaration,
    ConstructorTypeNode,
    ConstructSignatureDeclaration,
    contains,
    createDiagnosticForNode,
    createEmptyExports,
    createGetSymbolAccessibilityDiagnosticForNode,
    createGetSymbolAccessibilityDiagnosticForNodeName,
    createSymbolTable,
    createUnparsedSourceFile,
    Debug,
    Declaration,
    DeclarationDiagnosticProducing,
    DeclarationName,
    declarationNameToString,
    Diagnostics,
    DiagnosticWithLocation,
    EmitFlags,
    EmitHost,
    EmitResolver,
    emptyArray,
    EntityNameOrEntityNameExpression,
    EnumDeclaration,
    ExportAssignment,
    ExportDeclaration,
    ExpressionWithTypeArguments,
    factory,
    FileReference,
    filter,
    flatMap,
    flatten,
    forEach,
    FunctionDeclaration,
    FunctionTypeNode,
    GeneratedIdentifierFlags,
    GetAccessorDeclaration,
    getCommentRange,
    getDirectoryPath,
    getEffectiveBaseTypeNode,
    getEffectiveModifierFlags,
    getExternalModuleImportEqualsDeclarationExpression,
    getExternalModuleNameFromDeclaration,
    getFirstConstructorWithBody,
    getLeadingCommentRanges,
    getLeadingCommentRangesOfNode,
    getLineAndCharacterOfPosition,
    getNameOfDeclaration,
    getOriginalNodeId,
    getOutputPathsFor,
    getParseTreeNode,
    getRelativePathToDirectoryOrUrl,
    getResolutionModeOverrideForClause,
    getResolvedExternalModuleName,
    getSetAccessorValueParameter,
    getSourceFileOfNode,
    GetSymbolAccessibilityDiagnostic,
    getTextOfNode,
    getThisParameter,
    getTrailingCommentRanges,
    hasDynamicName,
    hasEffectiveModifier,
    hasExtension,
    hasJSDocNodes,
    HasModifiers,
    hasSyntacticModifier,
    HeritageClause,
    Identifier,
    ImportDeclaration,
    ImportEqualsDeclaration,
    ImportTypeNode,
    IndexSignatureDeclaration,
    InterfaceDeclaration,
    isAnyImportSyntax,
    isArray,
    isArrayBindingElement,
    isBinaryExpression,
    isBindingElement,
    isBindingPattern,
    isClassDeclaration,
    isClassElement,
    isDeclaration,
    isElementAccessExpression,
    isEntityName,
    isEntityNameExpression,
    isExportAssignment,
    isExportDeclaration,
    isExpressionWithTypeArguments,
    isExternalModule,
    isExternalModuleAugmentation,
    isExternalModuleIndicator,
    isExternalModuleReference,
    isExternalOrCommonJsModule,
    isFunctionDeclaration,
    isFunctionLike,
    isGlobalScopeAugmentation,
    isIdentifier,
    isIdentifierANonContextualKeyword,
    isIdentifierText,
    isImportDeclaration,
    isImportEqualsDeclaration,
    isIndexSignatureDeclaration,
    isInterfaceDeclaration,
    isJsonSourceFile,
    isLateVisibilityPaintedStatement,
    isLiteralImportTypeNode,
    isMappedTypeNode,
    isMethodDeclaration,
    isMethodSignature,
    isModifier,
    isModuleDeclaration,
    isNightly,
    isOmittedExpression,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isPropertySignature,
    isSemicolonClassElement,
    isSetAccessorDeclaration,
    isSourceFile,
    isSourceFileJS,
    isSourceFileNotJson,
    isStatement,
    isStringANonContextualKeyword,
    isStringLiteral,
    isStringLiteralLike,
    isTupleTypeNode,
    isTypeAliasDeclaration,
    isTypeElement,
    isTypeNode,
    isTypeParameterDeclaration,
    isTypeQueryNode,
    isUnparsedSource,
    isVariableDeclaration,
    last,
    LateBoundDeclaration,
    LateVisibilityPaintedStatement,
    length,
    map,
    mapDefined,
    MethodDeclaration,
    MethodSignature,
    Modifier,
    ModifierFlags,
    ModuleBody,
    ModuleDeclaration,
    NamedDeclaration,
    NamespaceDeclaration,
    needsScopeMarker,
    Node,
    NodeArray,
    NodeBuilderFlags,
    NodeFactory,
    NodeFlags,
    NodeId,
    normalizeSlashes,
    OmittedExpression,
    orderedRemoveItem,
    ParameterDeclaration,
    parseNodeFactory,
    pathContainsNodeModules,
    pathIsRelative,
    PropertyDeclaration,
    PropertySignature,
    pushIfUnique,
    removeAllComments,
    ResolutionMode,
    ScriptTarget,
    SetAccessorDeclaration,
    setCommentRange,
    setEmitFlags,
    setOriginalNode,
    setParent,
    setTextRange,
    SignatureDeclaration,
    skipTrivia,
    some,
    SourceFile,
    startsWith,
    Statement,
    stringContains,
    StringLiteral,
    Symbol,
    SymbolAccessibility,
    SymbolAccessibilityResult,
    SymbolFlags,
    SymbolTracker,
    SyntaxKind,
    toFileNameLowerCase,
    toPath,
    TransformationContext,
    transformNodes,
    tryCast,
    TypeAliasDeclaration,
    TypeNode,
    TypeParameterDeclaration,
    TypeReferenceNode,
    unescapeLeadingUnderscores,
    UnparsedSource,
    VariableDeclaration,
    VariableStatement,
    visitArray,
    visitEachChild,
    visitNode,
    visitNodes,
    VisitResult,
} from "../_namespaces/ts";
import * as moduleSpecifiers from "../_namespaces/ts.moduleSpecifiers";

/** @internal */
export function getDeclarationDiagnostics(host: EmitHost, resolver: EmitResolver, file: SourceFile | undefined): DiagnosticWithLocation[] | undefined {
    const compilerOptions = host.getCompilerOptions();
    const result = transformNodes(resolver, host, factory, compilerOptions, file ? [file] : filter(host.getSourceFiles(), isSourceFileNotJson), [transformDeclarations], /*allowDtsFiles*/ false);
    return result.diagnostics;
}

function hasInternalAnnotation(range: CommentRange, currentSourceFile: SourceFile) {
    const comment = currentSourceFile.text.substring(range.pos, range.end);
    return stringContains(comment, "@internal");
}

/** @internal */
export function isInternalDeclaration(node: Node, currentSourceFile: SourceFile) {
    const parseTreeNode = getParseTreeNode(node);
    if (parseTreeNode && parseTreeNode.kind === SyntaxKind.Parameter) {
        const paramIdx = (parseTreeNode.parent as SignatureDeclaration).parameters.indexOf(parseTreeNode as ParameterDeclaration);
        const previousSibling = paramIdx > 0 ? (parseTreeNode.parent as SignatureDeclaration).parameters[paramIdx - 1] : undefined;
        const text = currentSourceFile.text;
        const commentRanges = previousSibling
            ? concatenate(
                // to handle
                // ... parameters, /** @internal */
                // public param: string
                getTrailingCommentRanges(text, skipTrivia(text, previousSibling.end + 1, /*stopAfterLineBreak*/ false, /*stopAtComments*/ true)),
                getLeadingCommentRanges(text, node.pos)
            )
            : getTrailingCommentRanges(text, skipTrivia(text, node.pos, /*stopAfterLineBreak*/ false, /*stopAtComments*/ true));
        return commentRanges && commentRanges.length && hasInternalAnnotation(last(commentRanges), currentSourceFile);
    }
    const leadingCommentRanges = parseTreeNode && getLeadingCommentRangesOfNode(parseTreeNode, currentSourceFile);
    return !!forEach(leadingCommentRanges, range => {
        return hasInternalAnnotation(range, currentSourceFile);
    });
}

const declarationEmitNodeBuilderFlags =
    NodeBuilderFlags.MultilineObjectLiterals |
    NodeBuilderFlags.WriteClassExpressionAsTypeLiteral |
    NodeBuilderFlags.UseTypeOfFunction |
    NodeBuilderFlags.UseStructuralFallback |
    NodeBuilderFlags.AllowEmptyTuple |
    NodeBuilderFlags.GenerateNamesForShadowedTypeParams |
    NodeBuilderFlags.NoTruncation;

/**
 * Transforms a ts file into a .d.ts file
 * This process requires type information, which is retrieved through the emit resolver. Because of this,
 * in many places this transformer assumes it will be operating on parse tree nodes directly.
 * This means that _no transforms should be allowed to occur before this one_.
 *
 * @internal
 */
export function transformDeclarations(context: TransformationContext) {
    const throwDiagnostic = () => Debug.fail("Diagnostic emitted without context");
    let getSymbolAccessibilityDiagnostic: GetSymbolAccessibilityDiagnostic = throwDiagnostic;
    let needsDeclare = true;
    let isBundledEmit = false;
    let resultHasExternalModuleIndicator = false;
    let needsScopeFixMarker = false;
    let resultHasScopeMarker = false;
    let enclosingDeclaration: Node;
    let necessaryTypeReferences: Set<[specifier: string, mode: ResolutionMode]> | undefined;
    let lateMarkedStatements: LateVisibilityPaintedStatement[] | undefined;
    let lateStatementReplacementMap: Map<NodeId, VisitResult<LateVisibilityPaintedStatement | ExportAssignment | undefined>>;
    let suppressNewDiagnosticContexts: boolean;
    let exportedModulesFromDeclarationEmit: Symbol[] | undefined;

    const { factory } = context;
    const host = context.getEmitHost();
    const symbolTracker: SymbolTracker = {
        trackSymbol,
        reportInaccessibleThisError,
        reportInaccessibleUniqueSymbolError,
        reportCyclicStructureError,
        reportPrivateInBaseOfClassExpression,
        reportLikelyUnsafeImportRequiredError,
        reportTruncationError,
        moduleResolverHost: host,
        trackReferencedAmbientModule,
        trackExternalModuleSymbolOfImportTypeNode,
        reportNonlocalAugmentation,
        reportNonSerializableProperty,
        reportImportTypeNodeResolutionModeOverride,
    };
    let errorNameNode: DeclarationName | undefined;
    let errorFallbackNode: Declaration | undefined;

    let currentSourceFile: SourceFile;
    let refs: Map<NodeId, SourceFile>;
    let libs: Map<string, boolean>;
    let emittedImports: readonly AnyImportSyntax[] | undefined; // must be declared in container so it can be `undefined` while transformer's first pass
    const resolver = context.getEmitResolver();
    const options = context.getCompilerOptions();
    const { noResolve, stripInternal } = options;
    return transformRoot;

    function recordTypeReferenceDirectivesIfNecessary(typeReferenceDirectives: readonly [specifier: string, mode: ResolutionMode][] | undefined): void {
        if (!typeReferenceDirectives) {
            return;
        }
        necessaryTypeReferences = necessaryTypeReferences || new Set();
        for (const ref of typeReferenceDirectives) {
            necessaryTypeReferences.add(ref);
        }
    }

    function trackReferencedAmbientModule(node: ModuleDeclaration, symbol: Symbol) {
        // If it is visible via `// <reference types="..."/>`, then we should just use that
        const directives = resolver.getTypeReferenceDirectivesForSymbol(symbol, SymbolFlags.All);
        if (length(directives)) {
            return recordTypeReferenceDirectivesIfNecessary(directives);
        }
        // Otherwise we should emit a path-based reference
        const container = getSourceFileOfNode(node);
        refs.set(getOriginalNodeId(container), container);
    }

    function handleSymbolAccessibilityError(symbolAccessibilityResult: SymbolAccessibilityResult) {
        if (symbolAccessibilityResult.accessibility === SymbolAccessibility.Accessible) {
            // Add aliases back onto the possible imports list if they're not there so we can try them again with updated visibility info
            if (symbolAccessibilityResult && symbolAccessibilityResult.aliasesToMakeVisible) {
                if (!lateMarkedStatements) {
                    lateMarkedStatements = symbolAccessibilityResult.aliasesToMakeVisible;
                }
                else {
                    for (const ref of symbolAccessibilityResult.aliasesToMakeVisible) {
                        pushIfUnique(lateMarkedStatements, ref);
                    }
                }
            }

            // TODO: Do all these accessibility checks inside/after the first pass in the checker when declarations are enabled, if possible
        }
        else {
            // Report error
            const errorInfo = getSymbolAccessibilityDiagnostic(symbolAccessibilityResult);
            if (errorInfo) {
                if (errorInfo.typeName) {
                    context.addDiagnostic(createDiagnosticForNode(symbolAccessibilityResult.errorNode || errorInfo.errorNode,
                        errorInfo.diagnosticMessage,
                        getTextOfNode(errorInfo.typeName),
                        symbolAccessibilityResult.errorSymbolName!,
                        symbolAccessibilityResult.errorModuleName!));
                }
                else {
                    context.addDiagnostic(createDiagnosticForNode(symbolAccessibilityResult.errorNode || errorInfo.errorNode,
                        errorInfo.diagnosticMessage,
                        symbolAccessibilityResult.errorSymbolName!,
                        symbolAccessibilityResult.errorModuleName!));
                }
                return true;
            }
        }
        return false;
    }

    function trackExternalModuleSymbolOfImportTypeNode(symbol: Symbol) {
        if (!isBundledEmit) {
            (exportedModulesFromDeclarationEmit || (exportedModulesFromDeclarationEmit = [])).push(symbol);
        }
    }

    function trackSymbol(symbol: Symbol, enclosingDeclaration?: Node, meaning?: SymbolFlags) {
        if (symbol.flags & SymbolFlags.TypeParameter) return false;
        const issuedDiagnostic = handleSymbolAccessibilityError(resolver.isSymbolAccessible(symbol, enclosingDeclaration, meaning, /*shouldComputeAliasToMarkVisible*/ true));
        recordTypeReferenceDirectivesIfNecessary(resolver.getTypeReferenceDirectivesForSymbol(symbol, meaning));
        return issuedDiagnostic;
    }

    function reportPrivateInBaseOfClassExpression(propertyName: string) {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(
                createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.Property_0_of_exported_class_expression_may_not_be_private_or_protected, propertyName));
        }
    }

    function errorDeclarationNameWithFallback() {
        return errorNameNode ? declarationNameToString(errorNameNode) :
            errorFallbackNode && getNameOfDeclaration(errorFallbackNode) ? declarationNameToString(getNameOfDeclaration(errorFallbackNode)) :
            errorFallbackNode && isExportAssignment(errorFallbackNode) ? errorFallbackNode.isExportEquals ? "export=" : "default" :
            "(Missing)"; // same fallback declarationNameToString uses when node is zero-width (ie, nameless)
    }

    function reportInaccessibleUniqueSymbolError() {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary,
                errorDeclarationNameWithFallback(),
                "unique symbol"));
        }
    }

    function reportCyclicStructureError() {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_inferred_type_of_0_references_a_type_with_a_cyclic_structure_which_cannot_be_trivially_serialized_A_type_annotation_is_necessary,
                errorDeclarationNameWithFallback()));
        }
    }

    function reportInaccessibleThisError() {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary,
                errorDeclarationNameWithFallback(),
                "this"));
        }
    }

    function reportLikelyUnsafeImportRequiredError(specifier: string) {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_inferred_type_of_0_cannot_be_named_without_a_reference_to_1_This_is_likely_not_portable_A_type_annotation_is_necessary,
                errorDeclarationNameWithFallback(),
                specifier));
        }
    }

    function reportTruncationError() {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_inferred_type_of_this_node_exceeds_the_maximum_length_the_compiler_will_serialize_An_explicit_type_annotation_is_needed));
        }
    }

    function reportNonlocalAugmentation(containingFile: SourceFile, parentSymbol: Symbol, symbol: Symbol) {
        const primaryDeclaration = parentSymbol.declarations?.find(d => getSourceFileOfNode(d) === containingFile);
        const augmentingDeclarations = filter(symbol.declarations, d => getSourceFileOfNode(d) !== containingFile);
        if (primaryDeclaration && augmentingDeclarations) {
            for (const augmentations of augmentingDeclarations) {
                context.addDiagnostic(addRelatedInfo(
                    createDiagnosticForNode(augmentations, Diagnostics.Declaration_augments_declaration_in_another_file_This_cannot_be_serialized),
                    createDiagnosticForNode(primaryDeclaration, Diagnostics.This_is_the_declaration_being_augmented_Consider_moving_the_augmenting_declaration_into_the_same_file)
                ));
            }
        }
    }

    function reportNonSerializableProperty(propertyName: string) {
        if (errorNameNode || errorFallbackNode) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_type_of_this_node_cannot_be_serialized_because_its_property_0_cannot_be_serialized, propertyName));
        }
    }

    function reportImportTypeNodeResolutionModeOverride() {
        if (!isNightly() && (errorNameNode || errorFallbackNode)) {
            context.addDiagnostic(createDiagnosticForNode((errorNameNode || errorFallbackNode)!, Diagnostics.The_type_of_this_expression_cannot_be_named_without_a_resolution_mode_assertion_which_is_an_unstable_feature_Use_nightly_TypeScript_to_silence_this_error_Try_updating_with_npm_install_D_typescript_next));
        }
    }

    function transformDeclarationsForJS(sourceFile: SourceFile, bundled?: boolean) {
        const oldDiag = getSymbolAccessibilityDiagnostic;
        getSymbolAccessibilityDiagnostic = (s) => (s.errorNode && canProduceDiagnostics(s.errorNode) ? createGetSymbolAccessibilityDiagnosticForNode(s.errorNode)(s) : ({
            diagnosticMessage: s.errorModuleName
                ? Diagnostics.Declaration_emit_for_this_file_requires_using_private_name_0_from_module_1_An_explicit_type_annotation_may_unblock_declaration_emit
                : Diagnostics.Declaration_emit_for_this_file_requires_using_private_name_0_An_explicit_type_annotation_may_unblock_declaration_emit,
            errorNode: s.errorNode || sourceFile
        }));
        const result = resolver.getDeclarationStatementsForSourceFile(sourceFile, declarationEmitNodeBuilderFlags, symbolTracker, bundled);
        getSymbolAccessibilityDiagnostic = oldDiag;
        return result;
    }

    function transformRoot(node: Bundle): Bundle;
    function transformRoot(node: SourceFile): SourceFile;
    function transformRoot(node: SourceFile | Bundle): SourceFile | Bundle;
    function transformRoot(node: SourceFile | Bundle) {
        if (node.kind === SyntaxKind.SourceFile && node.isDeclarationFile) {
            return node;
        }

        if (node.kind === SyntaxKind.Bundle) {
            isBundledEmit = true;
            refs = new Map();
            libs = new Map();
            let hasNoDefaultLib = false;
            const bundle = factory.createBundle(map(node.sourceFiles,
                sourceFile => {
                    if (sourceFile.isDeclarationFile) return undefined!; // Omit declaration files from bundle results, too // TODO: GH#18217
                    hasNoDefaultLib = hasNoDefaultLib || sourceFile.hasNoDefaultLib;
                    currentSourceFile = sourceFile;
                    enclosingDeclaration = sourceFile;
                    lateMarkedStatements = undefined;
                    suppressNewDiagnosticContexts = false;
                    lateStatementReplacementMap = new Map();
                    getSymbolAccessibilityDiagnostic = throwDiagnostic;
                    needsScopeFixMarker = false;
                    resultHasScopeMarker = false;
                    collectReferences(sourceFile, refs);
                    collectLibs(sourceFile, libs);
                    if (isExternalOrCommonJsModule(sourceFile) || isJsonSourceFile(sourceFile)) {
                        resultHasExternalModuleIndicator = false; // unused in external module bundle emit (all external modules are within module blocks, therefore are known to be modules)
                        needsDeclare = false;
                        const statements = isSourceFileJS(sourceFile) ? factory.createNodeArray(transformDeclarationsForJS(sourceFile, /*bundled*/ true)) : visitNodes(sourceFile.statements, visitDeclarationStatements, isStatement);
                        const newFile = factory.updateSourceFile(sourceFile, [factory.createModuleDeclaration(
                            [factory.createModifier(SyntaxKind.DeclareKeyword)],
                            factory.createStringLiteral(getResolvedExternalModuleName(context.getEmitHost(), sourceFile)),
                            factory.createModuleBlock(setTextRange(factory.createNodeArray(transformAndReplaceLatePaintedStatements(statements)), sourceFile.statements))
                        )], /*isDeclarationFile*/ true, /*referencedFiles*/ [], /*typeReferences*/ [], /*hasNoDefaultLib*/ false, /*libReferences*/ []);
                        return newFile;
                    }
                    needsDeclare = true;
                    const updated = isSourceFileJS(sourceFile) ? factory.createNodeArray(transformDeclarationsForJS(sourceFile)) : visitNodes(sourceFile.statements, visitDeclarationStatements, isStatement);
                    return factory.updateSourceFile(sourceFile, transformAndReplaceLatePaintedStatements(updated), /*isDeclarationFile*/ true, /*referencedFiles*/ [], /*typeReferences*/ [], /*hasNoDefaultLib*/ false, /*libReferences*/ []);
                }
            ), mapDefined(node.prepends, prepend => {
                if (prepend.kind === SyntaxKind.InputFiles) {
                    const sourceFile = createUnparsedSourceFile(prepend, "dts", stripInternal);
                    hasNoDefaultLib = hasNoDefaultLib || !!sourceFile.hasNoDefaultLib;
                    collectReferences(sourceFile, refs);
                    recordTypeReferenceDirectivesIfNecessary(map(sourceFile.typeReferenceDirectives, ref => [ref.fileName, ref.resolutionMode]));
                    collectLibs(sourceFile, libs);
                    return sourceFile;
                }
                return prepend;
            }));
            bundle.syntheticFileReferences = [];
            bundle.syntheticTypeReferences = getFileReferencesForUsedTypeReferences();
            bundle.syntheticLibReferences = getLibReferences();
            bundle.hasNoDefaultLib = hasNoDefaultLib;
            const outputFilePath = getDirectoryPath(normalizeSlashes(getOutputPathsFor(node, host, /*forceDtsPaths*/ true).declarationFilePath!));
            const referenceVisitor = mapReferencesIntoArray(bundle.syntheticFileReferences as FileReference[], outputFilePath);
            refs.forEach(referenceVisitor);
            return bundle;
        }

        // Single source file
        needsDeclare = true;
        needsScopeFixMarker = false;
        resultHasScopeMarker = false;
        enclosingDeclaration = node;
        currentSourceFile = node;
        getSymbolAccessibilityDiagnostic = throwDiagnostic;
        isBundledEmit = false;
        resultHasExternalModuleIndicator = false;
        suppressNewDiagnosticContexts = false;
        lateMarkedStatements = undefined;
        lateStatementReplacementMap = new Map();
        necessaryTypeReferences = undefined;
        refs = collectReferences(currentSourceFile, new Map());
        libs = collectLibs(currentSourceFile, new Map());
        const references: FileReference[] = [];
        const outputFilePath = getDirectoryPath(normalizeSlashes(getOutputPathsFor(node, host, /*forceDtsPaths*/ true).declarationFilePath!));
        const referenceVisitor = mapReferencesIntoArray(references, outputFilePath);
        let combinedStatements: NodeArray<Statement>;
        if (isSourceFileJS(currentSourceFile)) {
            combinedStatements = factory.createNodeArray(transformDeclarationsForJS(node));
            refs.forEach(referenceVisitor);
            emittedImports = filter(combinedStatements, isAnyImportSyntax);
        }
        else {
            const statements = visitNodes(node.statements, visitDeclarationStatements, isStatement);
            combinedStatements = setTextRange(factory.createNodeArray([...node.tsPlusGlobalImports ?? [], ...transformAndReplaceLatePaintedStatements(statements)]), node.statements);
            refs.forEach(referenceVisitor);
            emittedImports = filter(combinedStatements, isAnyImportSyntax);
            if (isExternalModule(node) && (!resultHasExternalModuleIndicator || (needsScopeFixMarker && !resultHasScopeMarker))) {
                combinedStatements = setTextRange(factory.createNodeArray([...combinedStatements, createEmptyExports(factory)]), combinedStatements);
            }
        }
        const updated = factory.updateSourceFile(node, combinedStatements, /*isDeclarationFile*/ true, references, getFileReferencesForUsedTypeReferences(), node.hasNoDefaultLib, getLibReferences());
        updated.exportedModulesFromDeclarationEmit = exportedModulesFromDeclarationEmit;
        return updated;

        function getLibReferences() {
            return arrayFrom(libs.keys(), lib => ({ fileName: lib, pos: -1, end: -1 }));
        }

        function getFileReferencesForUsedTypeReferences() {
            return necessaryTypeReferences ? mapDefined(arrayFrom(necessaryTypeReferences.keys()), getFileReferenceForSpecifierModeTuple) : [];
        }

        function getFileReferenceForSpecifierModeTuple([typeName, mode]: [specifier: string, mode: ResolutionMode]): FileReference | undefined {
            // Elide type references for which we have imports
            if (emittedImports) {
                for (const importStatement of emittedImports) {
                    if (isImportEqualsDeclaration(importStatement) && isExternalModuleReference(importStatement.moduleReference)) {
                        const expr = importStatement.moduleReference.expression;
                        if (isStringLiteralLike(expr) && expr.text === typeName) {
                            return undefined;
                        }
                    }
                    else if (isImportDeclaration(importStatement) && isStringLiteral(importStatement.moduleSpecifier) && importStatement.moduleSpecifier.text === typeName) {
                        return undefined;
                    }
                }
            }
            return { fileName: typeName, pos: -1, end: -1, ...(mode ? { resolutionMode: mode } : undefined) };
        }

        function mapReferencesIntoArray(references: FileReference[], outputFilePath: string): (file: SourceFile) => void {
            return file => {
                let declFileName: string;
                if (file.isDeclarationFile) { // Neither decl files or js should have their refs changed
                    declFileName = file.fileName;
                }
                else {
                    if (isBundledEmit && contains((node as Bundle).sourceFiles, file)) return; // Omit references to files which are being merged
                    const paths = getOutputPathsFor(file, host, /*forceDtsPaths*/ true);
                    declFileName = paths.declarationFilePath || paths.jsFilePath || file.fileName;
                }

                if (declFileName) {
                    const specifier = moduleSpecifiers.getModuleSpecifier(
                        options,
                        currentSourceFile,
                        toPath(outputFilePath, host.getCurrentDirectory(), host.getCanonicalFileName),
                        toPath(declFileName, host.getCurrentDirectory(), host.getCanonicalFileName),
                        host,
                    );
                    if (!pathIsRelative(specifier)) {
                        // If some compiler option/symlink/whatever allows access to the file containing the ambient module declaration
                        // via a non-relative name, emit a type reference directive to that non-relative name, rather than
                        // a relative path to the declaration file
                        recordTypeReferenceDirectivesIfNecessary([[specifier, /*mode*/ undefined]]);
                        return;
                    }

                    let fileName = getRelativePathToDirectoryOrUrl(
                        outputFilePath,
                        declFileName,
                        host.getCurrentDirectory(),
                        host.getCanonicalFileName,
                        /*isAbsolutePathAnUrl*/ false
                    );
                    if (startsWith(fileName, "./") && hasExtension(fileName)) {
                        fileName = fileName.substring(2);
                    }

                    // omit references to files from node_modules (npm may disambiguate module
                    // references when installing this package, making the path is unreliable).
                    if (startsWith(fileName, "node_modules/") || pathContainsNodeModules(fileName)) {
                        return;
                    }

                    references.push({ pos: -1, end: -1, fileName });
                }
            };
        }
    }

    function collectReferences(sourceFile: SourceFile | UnparsedSource, ret: Map<NodeId, SourceFile>) {
        if (noResolve || (!isUnparsedSource(sourceFile) && isSourceFileJS(sourceFile))) return ret;
        forEach(sourceFile.referencedFiles, f => {
            const elem = host.getSourceFileFromReference(sourceFile, f);
            if (elem) {
                ret.set(getOriginalNodeId(elem), elem);
            }
        });
        return ret;
    }

    function collectLibs(sourceFile: SourceFile | UnparsedSource, ret: Map<string, boolean>) {
        forEach(sourceFile.libReferenceDirectives, ref => {
            const lib = host.getLibFileFromReference(ref);
            if (lib) {
                ret.set(toFileNameLowerCase(ref.fileName), true);
            }
        });
        return ret;
    }

    function filterBindingPatternInitializersAndRenamings(name: BindingName) {
        if (name.kind === SyntaxKind.Identifier) {
            return name;
        }
        else {
            if (name.kind === SyntaxKind.ArrayBindingPattern) {
                return factory.updateArrayBindingPattern(name, visitNodes(name.elements, visitBindingElement, isArrayBindingElement));
            }
            else {
                return factory.updateObjectBindingPattern(name, visitNodes(name.elements, visitBindingElement, isBindingElement));
            }
        }

        function visitBindingElement<T extends Node>(elem: T): T;
        function visitBindingElement(elem: ArrayBindingElement): ArrayBindingElement {
            if (elem.kind === SyntaxKind.OmittedExpression) {
                return elem;
            }
            if (elem.propertyName && isIdentifier(elem.propertyName) && isIdentifier(elem.name) && !elem.symbol.isReferenced && !isIdentifierANonContextualKeyword(elem.propertyName)) {
               // Unnecessary property renaming is forbidden in types, so remove renaming
                return factory.updateBindingElement(
                    elem,
                    elem.dotDotDotToken,
                    /*propertyName*/ undefined,
                    elem.propertyName,
                    shouldPrintWithInitializer(elem) ? elem.initializer : undefined
                );
            }
            return factory.updateBindingElement(
                elem,
                elem.dotDotDotToken,
                elem.propertyName,
                filterBindingPatternInitializersAndRenamings(elem.name),
                shouldPrintWithInitializer(elem) ? elem.initializer : undefined
            );
        }
    }

    function ensureParameter(p: ParameterDeclaration, modifierMask?: ModifierFlags, type?: TypeNode): ParameterDeclaration {
        let oldDiag: typeof getSymbolAccessibilityDiagnostic | undefined;
        if (!suppressNewDiagnosticContexts) {
            oldDiag = getSymbolAccessibilityDiagnostic;
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(p);
        }
        const newParam = factory.updateParameterDeclaration(
            p,
            maskModifiers(factory, p, modifierMask),
            p.dotDotDotToken,
            filterBindingPatternInitializersAndRenamings(p.name),
            resolver.isOptionalParameter(p) ? (p.questionToken || factory.createToken(SyntaxKind.QuestionToken)) : undefined,
            ensureType(p, type || p.type, /*ignorePrivate*/ true), // Ignore private param props, since this type is going straight back into a param
            ensureNoInitializer(p)
        );
        if (!suppressNewDiagnosticContexts) {
            getSymbolAccessibilityDiagnostic = oldDiag!;
        }
        return newParam;
    }

    function shouldPrintWithInitializer(node: Node) {
        return canHaveLiteralInitializer(node) && resolver.isLiteralConstDeclaration(getParseTreeNode(node) as CanHaveLiteralInitializer); // TODO: Make safe
    }

    function ensureNoInitializer(node: CanHaveLiteralInitializer) {
        if (shouldPrintWithInitializer(node)) {
            return resolver.createLiteralConstValue(getParseTreeNode(node) as CanHaveLiteralInitializer, symbolTracker); // TODO: Make safe
        }
        return undefined;
    }

    type HasInferredType =
        | FunctionDeclaration
        | MethodDeclaration
        | GetAccessorDeclaration
        | SetAccessorDeclaration
        | BindingElement
        | ConstructSignatureDeclaration
        | VariableDeclaration
        | MethodSignature
        | CallSignatureDeclaration
        | ParameterDeclaration
        | PropertyDeclaration
        | PropertySignature;

    function ensureType(node: HasInferredType, type: TypeNode | undefined, ignorePrivate?: boolean): TypeNode | undefined {
        if (!ignorePrivate && hasEffectiveModifier(node, ModifierFlags.Private)) {
            // Private nodes emit no types (except private parameter properties, whose parameter types are actually visible)
            return;
        }
        if (shouldPrintWithInitializer(node)) {
            // Literal const declarations will have an initializer ensured rather than a type
            return;
        }
        const shouldUseResolverType = node.kind === SyntaxKind.Parameter &&
            (resolver.isRequiredInitializedParameter(node) ||
             resolver.isOptionalUninitializedParameterProperty(node));
        if (type && !shouldUseResolverType) {
            return visitNode(type, visitDeclarationSubtree, isTypeNode);
        }
        if (!getParseTreeNode(node)) {
            return type ? visitNode(type, visitDeclarationSubtree, isTypeNode) : factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        }
        if (node.kind === SyntaxKind.SetAccessor) {
            // Set accessors with no associated type node (from it's param or get accessor return) are `any` since they are never contextually typed right now
            // (The inferred type here will be void, but the old declaration emitter printed `any`, so this replicates that)
            return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        }
        errorNameNode = node.name;
        let oldDiag: typeof getSymbolAccessibilityDiagnostic;
        if (!suppressNewDiagnosticContexts) {
            oldDiag = getSymbolAccessibilityDiagnostic;
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node);
        }
        if (node.kind === SyntaxKind.VariableDeclaration || node.kind === SyntaxKind.BindingElement) {
            return cleanup(resolver.createTypeOfDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker));
        }
        if (node.kind === SyntaxKind.Parameter
            || node.kind === SyntaxKind.PropertyDeclaration
            || node.kind === SyntaxKind.PropertySignature) {
            if (isPropertySignature(node) || !node.initializer) return cleanup(resolver.createTypeOfDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker, shouldUseResolverType));
            return cleanup(resolver.createTypeOfDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker, shouldUseResolverType) || resolver.createTypeOfExpression(node.initializer, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker));
        }
        return cleanup(resolver.createReturnTypeOfSignatureDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker));

        function cleanup(returnValue: TypeNode | undefined) {
            errorNameNode = undefined;
            if (!suppressNewDiagnosticContexts) {
                getSymbolAccessibilityDiagnostic = oldDiag;
            }
            return returnValue || factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
        }
    }

    function isDeclarationAndNotVisible(node: NamedDeclaration) {
        node = getParseTreeNode(node) as NamedDeclaration;
        switch (node.kind) {
            case SyntaxKind.FunctionDeclaration:
            case SyntaxKind.ModuleDeclaration:
            case SyntaxKind.InterfaceDeclaration:
            case SyntaxKind.ClassDeclaration:
            case SyntaxKind.TypeAliasDeclaration:
            case SyntaxKind.EnumDeclaration:
                return !resolver.isDeclarationVisible(node);
            // The following should be doing their own visibility checks based on filtering their members
            case SyntaxKind.VariableDeclaration:
                return !getBindingNameVisible(node as VariableDeclaration);
            case SyntaxKind.ImportEqualsDeclaration:
            case SyntaxKind.ImportDeclaration:
            case SyntaxKind.ExportDeclaration:
            case SyntaxKind.ExportAssignment:
                return false;
            case SyntaxKind.ClassStaticBlockDeclaration:
                return true;
        }
        return false;
    }

    // If the ExpandoFunctionDeclaration have multiple overloads, then we only need to emit properties for the last one.
    function shouldEmitFunctionProperties(input: FunctionDeclaration) {
        if (input.body) {
            return true;
        }

        const overloadSignatures = input.symbol.declarations?.filter(decl => isFunctionDeclaration(decl) && !decl.body);
        return !overloadSignatures || overloadSignatures.indexOf(input) === overloadSignatures.length - 1;
    }

    function getBindingNameVisible(elem: BindingElement | VariableDeclaration | OmittedExpression): boolean {
        if (isOmittedExpression(elem)) {
            return false;
        }
        if (isBindingPattern(elem.name)) {
            // If any child binding pattern element has been marked visible (usually by collect linked aliases), then this is visible
            return some(elem.name.elements, getBindingNameVisible);
        }
        else {
            return resolver.isDeclarationVisible(elem);
        }
    }

    function updateParamsList(node: Node, params: NodeArray<ParameterDeclaration>, modifierMask?: ModifierFlags): NodeArray<ParameterDeclaration> {
        if (hasEffectiveModifier(node, ModifierFlags.Private)) {
            return factory.createNodeArray();
        }
        const newParams = map(params, p => ensureParameter(p, modifierMask));
        if (!newParams) {
            return factory.createNodeArray();
        }
        return factory.createNodeArray(newParams, params.hasTrailingComma);
    }

    function updateAccessorParamsList(input: AccessorDeclaration, isPrivate: boolean) {
        let newParams: ParameterDeclaration[] | undefined;
        if (!isPrivate) {
            const thisParameter = getThisParameter(input);
            if (thisParameter) {
                newParams = [ensureParameter(thisParameter)];
            }
        }
        if (isSetAccessorDeclaration(input)) {
            let newValueParameter: ParameterDeclaration | undefined;
            if (!isPrivate) {
                const valueParameter = getSetAccessorValueParameter(input);
                if (valueParameter) {
                    const accessorType = getTypeAnnotationFromAllAccessorDeclarations(input, resolver.getAllAccessorDeclarations(input));
                    newValueParameter = ensureParameter(valueParameter, /*modifierMask*/ undefined, accessorType);
                }
            }
            if (!newValueParameter) {
                newValueParameter = factory.createParameterDeclaration(
                    /*modifiers*/ undefined,
                    /*dotDotDotToken*/ undefined,
                    "value"
                );
            }
            newParams = append(newParams, newValueParameter);
        }
        return factory.createNodeArray(newParams || emptyArray);
    }

    function ensureTypeParams(node: Node, params: NodeArray<TypeParameterDeclaration> | undefined) {
        return hasEffectiveModifier(node, ModifierFlags.Private) ? undefined : visitNodes(params, visitDeclarationSubtree, isTypeParameterDeclaration);
    }

    function isEnclosingDeclaration(node: Node) {
        return isSourceFile(node)
            || isTypeAliasDeclaration(node)
            || isModuleDeclaration(node)
            || isClassDeclaration(node)
            || isInterfaceDeclaration(node)
            || isFunctionLike(node)
            || isIndexSignatureDeclaration(node)
            || isMappedTypeNode(node);
    }

    function checkEntityNameVisibility(entityName: EntityNameOrEntityNameExpression, enclosingDeclaration: Node) {
        const visibilityResult = resolver.isEntityNameVisible(entityName, enclosingDeclaration);
        handleSymbolAccessibilityError(visibilityResult);
        recordTypeReferenceDirectivesIfNecessary(resolver.getTypeReferenceDirectivesForEntityName(entityName));
    }

    function preserveJsDoc<T extends Node>(updated: T, original: Node): T {
        if (hasJSDocNodes(updated) && hasJSDocNodes(original)) {
            updated.jsDoc = original.jsDoc;
        }
        return setCommentRange(updated, getCommentRange(original));
    }

    function rewriteModuleSpecifier<T extends Node>(parent: ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ModuleDeclaration | ImportTypeNode, input: T | undefined): T | StringLiteral {
        if (!input) return undefined!; // TODO: GH#18217
        resultHasExternalModuleIndicator = resultHasExternalModuleIndicator || (parent.kind !== SyntaxKind.ModuleDeclaration && parent.kind !== SyntaxKind.ImportType);
        if (isStringLiteralLike(input)) {
            if (isBundledEmit) {
                const newName = getExternalModuleNameFromDeclaration(context.getEmitHost(), resolver, parent);
                if (newName) {
                    return factory.createStringLiteral(newName);
                }
            }
            else {
                const symbol = resolver.getSymbolOfExternalModuleSpecifier(input);
                if (symbol) {
                    (exportedModulesFromDeclarationEmit || (exportedModulesFromDeclarationEmit = [])).push(symbol);
                }
            }
        }
        return input;
    }

    function transformImportEqualsDeclaration(decl: ImportEqualsDeclaration) {
        if (!resolver.isDeclarationVisible(decl)) return;
        if (decl.moduleReference.kind === SyntaxKind.ExternalModuleReference) {
            // Rewrite external module names if necessary
            const specifier = getExternalModuleImportEqualsDeclarationExpression(decl);
            return factory.updateImportEqualsDeclaration(
                decl,
                decl.modifiers,
                decl.isTypeOnly,
                decl.name,
                factory.updateExternalModuleReference(decl.moduleReference, rewriteModuleSpecifier(decl, specifier))
            );
        }
        else {
            const oldDiag = getSymbolAccessibilityDiagnostic;
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(decl);
            checkEntityNameVisibility(decl.moduleReference, enclosingDeclaration);
            getSymbolAccessibilityDiagnostic = oldDiag;
            return decl;
        }
    }

    function transformImportDeclaration(decl: ImportDeclaration) {
        if (!decl.importClause) {
            // import "mod" - possibly needed for side effects? (global interface patches, module augmentations, etc)
            return factory.updateImportDeclaration(
                decl,
                decl.modifiers,
                decl.importClause,
                rewriteModuleSpecifier(decl, decl.moduleSpecifier),
                getResolutionModeOverrideForClauseInNightly(decl.assertClause)
            );
        }
        // The `importClause` visibility corresponds to the default's visibility.
        const visibleDefaultBinding = decl.importClause && decl.importClause.name && resolver.isDeclarationVisible(decl.importClause) ? decl.importClause.name : undefined;
        if (!decl.importClause.namedBindings) {
            // No named bindings (either namespace or list), meaning the import is just default or should be elided
            return visibleDefaultBinding && factory.updateImportDeclaration(decl, decl.modifiers, factory.updateImportClause(
                decl.importClause,
                decl.importClause.isTypeOnly,
                visibleDefaultBinding,
                /*namedBindings*/ undefined,
            ), rewriteModuleSpecifier(decl, decl.moduleSpecifier), getResolutionModeOverrideForClauseInNightly(decl.assertClause));
        }
        if (decl.importClause.namedBindings.kind === SyntaxKind.NamespaceImport) {
            // Namespace import (optionally with visible default)
            const namedBindings = resolver.isDeclarationVisible(decl.importClause.namedBindings) ? decl.importClause.namedBindings : /*namedBindings*/ undefined;
            return visibleDefaultBinding || namedBindings ? factory.updateImportDeclaration(decl, decl.modifiers, factory.updateImportClause(
                decl.importClause,
                decl.importClause.isTypeOnly,
                visibleDefaultBinding,
                namedBindings,
            ), rewriteModuleSpecifier(decl, decl.moduleSpecifier), getResolutionModeOverrideForClauseInNightly(decl.assertClause)) : undefined;
        }
        // Named imports (optionally with visible default)
        const bindingList = mapDefined(decl.importClause.namedBindings.elements, b => resolver.isDeclarationVisible(b) ? b : undefined);
        if ((bindingList && bindingList.length) || visibleDefaultBinding) {
            return factory.updateImportDeclaration(
                decl,
                decl.modifiers,
                factory.updateImportClause(
                    decl.importClause,
                    decl.importClause.isTypeOnly,
                    visibleDefaultBinding,
                    bindingList && bindingList.length ? factory.updateNamedImports(decl.importClause.namedBindings, bindingList) : undefined,
                ),
                rewriteModuleSpecifier(decl, decl.moduleSpecifier),
                getResolutionModeOverrideForClauseInNightly(decl.assertClause)
            );
        }
        // Augmentation of export depends on import
        if (resolver.isImportRequiredByAugmentation(decl)) {
            return factory.updateImportDeclaration(
                decl,
                decl.modifiers,
                /*importClause*/ undefined,
                rewriteModuleSpecifier(decl, decl.moduleSpecifier),
                getResolutionModeOverrideForClauseInNightly(decl.assertClause)
            );
        }
        // Nothing visible
    }

    function getResolutionModeOverrideForClauseInNightly(assertClause: AssertClause | undefined) {
        const mode = getResolutionModeOverrideForClause(assertClause);
        if (mode !== undefined) {
            if (!isNightly()) {
                context.addDiagnostic(createDiagnosticForNode(assertClause!, Diagnostics.resolution_mode_assertions_are_unstable_Use_nightly_TypeScript_to_silence_this_error_Try_updating_with_npm_install_D_typescript_next));
            }
            return assertClause;
        }
        return undefined;
    }

    function transformAndReplaceLatePaintedStatements(statements: NodeArray<Statement>): NodeArray<Statement> {
        // This is a `while` loop because `handleSymbolAccessibilityError` can see additional import aliases marked as visible during
        // error handling which must now be included in the output and themselves checked for errors.
        // For example:
        // ```
        // module A {
        //   export module Q {}
        //   import B = Q;
        //   import C = B;
        //   export import D = C;
        // }
        // ```
        // In such a scenario, only Q and D are initially visible, but we don't consider imports as private names - instead we say they if they are referenced they must
        // be recorded. So while checking D's visibility we mark C as visible, then we must check C which in turn marks B, completing the chain of
        // dependent imports and allowing a valid declaration file output. Today, this dependent alias marking only happens for internal import aliases.
        while (length(lateMarkedStatements)) {
            const i = lateMarkedStatements!.shift()!;
            if (!isLateVisibilityPaintedStatement(i)) {
                return Debug.fail(`Late replaced statement was found which is not handled by the declaration transformer!: ${Debug.formatSyntaxKind((i as Node).kind)}`);
            }
            const priorNeedsDeclare = needsDeclare;
            needsDeclare = i.parent && isSourceFile(i.parent) && !(isExternalModule(i.parent) && isBundledEmit);
            const result = transformTopLevelDeclaration(i);
            needsDeclare = priorNeedsDeclare;
            lateStatementReplacementMap.set(getOriginalNodeId(i), result);
        }

        // And lastly, we need to get the final form of all those indetermine import declarations from before and add them to the output list
        // (and remove them from the set to examine for outter declarations)
        return visitNodes(statements, visitLateVisibilityMarkedStatements, isStatement);

        function visitLateVisibilityMarkedStatements(statement: Statement) {
            if (isLateVisibilityPaintedStatement(statement)) {
                const key = getOriginalNodeId(statement);
                if (lateStatementReplacementMap.has(key)) {
                    const result = lateStatementReplacementMap.get(key) as Statement | readonly Statement[] | undefined;
                    lateStatementReplacementMap.delete(key);
                    if (result) {
                        if (isArray(result) ? some(result, needsScopeMarker) : needsScopeMarker(result)) {
                            // Top-level declarations in .d.ts files are always considered exported even without a modifier unless there's an export assignment or specifier
                            needsScopeFixMarker = true;
                        }
                        if (isSourceFile(statement.parent) && (isArray(result) ? some(result, isExternalModuleIndicator) : isExternalModuleIndicator(result))) {
                            resultHasExternalModuleIndicator = true;
                        }
                    }
                    return result;
                }
            }
            return statement;
        }
    }

    function visitDeclarationSubtree(input: Node): VisitResult<Node | undefined> {
        if (shouldStripInternal(input)) return;
        if (isDeclaration(input)) {
            if (isDeclarationAndNotVisible(input)) return;
            if (hasDynamicName(input) && !resolver.isLateBound(getParseTreeNode(input) as Declaration)) {
                return;
            }
        }

        // Elide implementation signatures from overload sets
        if (isFunctionLike(input) && resolver.isImplementationOfOverload(input)) return;

        // Elide semicolon class statements
        if (isSemicolonClassElement(input)) return;

        let previousEnclosingDeclaration: typeof enclosingDeclaration;
        if (isEnclosingDeclaration(input)) {
            previousEnclosingDeclaration = enclosingDeclaration;
            enclosingDeclaration = input as Declaration;
        }
        const oldDiag = getSymbolAccessibilityDiagnostic;

        // Setup diagnostic-related flags before first potential `cleanup` call, otherwise
        // We'd see a TDZ violation at runtime
        const canProduceDiagnostic = canProduceDiagnostics(input);
        const oldWithinObjectLiteralType = suppressNewDiagnosticContexts;
        let shouldEnterSuppressNewDiagnosticsContextContext = ((input.kind === SyntaxKind.TypeLiteral || input.kind === SyntaxKind.MappedType) && input.parent.kind !== SyntaxKind.TypeAliasDeclaration);

        // Emit methods which are private as properties with no type information
        if (isMethodDeclaration(input) || isMethodSignature(input)) {
            if (hasEffectiveModifier(input, ModifierFlags.Private)) {
                if (input.symbol && input.symbol.declarations && input.symbol.declarations[0] !== input) return; // Elide all but the first overload
                return cleanup(factory.createPropertyDeclaration(ensureModifiers(input), input.name, /*questionOrExclamationToken*/ undefined, /*type*/ undefined, /*initializer*/ undefined));
            }
        }

        if (canProduceDiagnostic && !suppressNewDiagnosticContexts) {
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(input);
        }

        if (isTypeQueryNode(input)) {
            checkEntityNameVisibility(input.exprName, enclosingDeclaration);
        }

        if (shouldEnterSuppressNewDiagnosticsContextContext) {
            // We stop making new diagnostic contexts within object literal types. Unless it's an object type on the RHS of a type alias declaration. Then we do.
            suppressNewDiagnosticContexts = true;
        }

        if (isProcessedComponent(input)) {
            switch (input.kind) {
                case SyntaxKind.ExpressionWithTypeArguments: {
                    if ((isEntityName(input.expression) || isEntityNameExpression(input.expression))) {
                        checkEntityNameVisibility(input.expression, enclosingDeclaration);
                    }
                    const node = visitEachChild(input, visitDeclarationSubtree, context);
                    return cleanup(factory.updateExpressionWithTypeArguments(node, node.expression, node.typeArguments));
                }
                case SyntaxKind.TypeReference: {
                    checkEntityNameVisibility(input.typeName, enclosingDeclaration);
                    const node = visitEachChild(input, visitDeclarationSubtree, context);
                    return cleanup(factory.updateTypeReferenceNode(node, node.typeName, node.typeArguments));
                }
                case SyntaxKind.ConstructSignature:
                    return cleanup(factory.updateConstructSignature(
                        input,
                        ensureTypeParams(input, input.typeParameters),
                        updateParamsList(input, input.parameters),
                        ensureType(input, input.type)
                    ));
                case SyntaxKind.Constructor: {
                    // A constructor declaration may not have a type annotation
                    const ctor = factory.createConstructorDeclaration(
                        /*modifiers*/ ensureModifiers(input),
                        updateParamsList(input, input.parameters, ModifierFlags.None),
                        /*body*/ undefined
                    );
                    return cleanup(ctor);
                }
                case SyntaxKind.MethodDeclaration: {
                    if (isPrivateIdentifier(input.name)) {
                        return cleanup(/*returnValue*/ undefined);
                    }
                    const sig = factory.createMethodDeclaration(
                        ensureModifiers(input),
                        /*asteriskToken*/ undefined,
                        input.name,
                        input.questionToken,
                        ensureTypeParams(input, input.typeParameters),
                        updateParamsList(input, input.parameters),
                        ensureType(input, input.type),
                        /*body*/ undefined
                    );
                    return cleanup(sig);
                }
                case SyntaxKind.GetAccessor: {
                    if (isPrivateIdentifier(input.name)) {
                        return cleanup(/*returnValue*/ undefined);
                    }
                    const accessorType = getTypeAnnotationFromAllAccessorDeclarations(input, resolver.getAllAccessorDeclarations(input));
                    return cleanup(factory.updateGetAccessorDeclaration(
                        input,
                        ensureModifiers(input),
                        input.name,
                        updateAccessorParamsList(input, hasEffectiveModifier(input, ModifierFlags.Private)),
                        ensureType(input, accessorType),
                        /*body*/ undefined));
                }
                case SyntaxKind.SetAccessor: {
                    if (isPrivateIdentifier(input.name)) {
                        return cleanup(/*returnValue*/ undefined);
                    }
                    return cleanup(factory.updateSetAccessorDeclaration(
                        input,
                        ensureModifiers(input),
                        input.name,
                        updateAccessorParamsList(input, hasEffectiveModifier(input, ModifierFlags.Private)),
                        /*body*/ undefined));
                }
                case SyntaxKind.PropertyDeclaration:
                    if (isPrivateIdentifier(input.name)) {
                        return cleanup(/*returnValue*/ undefined);
                    }
                    return cleanup(factory.updatePropertyDeclaration(
                        input,
                        ensureModifiers(input),
                        input.name,
                        input.questionToken,
                        ensureType(input, input.type),
                        ensureNoInitializer(input)
                    ));
                case SyntaxKind.PropertySignature:
                    if (isPrivateIdentifier(input.name)) {
                        return cleanup(/*returnValue*/ undefined);
                    }
                    return cleanup(factory.updatePropertySignature(
                        input,
                        ensureModifiers(input),
                        input.name,
                        input.questionToken,
                        ensureType(input, input.type)
                    ));
                case SyntaxKind.MethodSignature: {
                    if (isPrivateIdentifier(input.name)) {
                        return cleanup(/*returnValue*/ undefined);
                    }
                    return cleanup(factory.updateMethodSignature(
                        input,
                        ensureModifiers(input),
                        input.name,
                        input.questionToken,
                        ensureTypeParams(input, input.typeParameters),
                        updateParamsList(input, input.parameters),
                        ensureType(input, input.type)
                    ));
                }
                case SyntaxKind.CallSignature: {
                    return cleanup(factory.updateCallSignature(
                        input,
                        ensureTypeParams(input, input.typeParameters),
                        updateParamsList(input, input.parameters),
                        ensureType(input, input.type)
                    ));
                }
                case SyntaxKind.IndexSignature: {
                    return cleanup(factory.updateIndexSignature(
                        input,
                        ensureModifiers(input),
                        updateParamsList(input, input.parameters),
                        visitNode(input.type, visitDeclarationSubtree, isTypeNode) || factory.createKeywordTypeNode(SyntaxKind.AnyKeyword)
                    ));
                }
                case SyntaxKind.VariableDeclaration: {
                    if (isBindingPattern(input.name)) {
                        return recreateBindingPattern(input.name);
                    }
                    shouldEnterSuppressNewDiagnosticsContextContext = true;
                    suppressNewDiagnosticContexts = true; // Variable declaration types also suppress new diagnostic contexts, provided the contexts wouldn't be made for binding pattern types
                    return cleanup(factory.updateVariableDeclaration(input, input.name, /*exclamationToken*/ undefined, ensureType(input, input.type), ensureNoInitializer(input)));
                }
                case SyntaxKind.TypeParameter: {
                    if (isPrivateMethodTypeParameter(input) && (input.default || input.constraint)) {
                        return cleanup(factory.updateTypeParameterDeclaration(input, input.modifiers, input.name, /*constraint*/ undefined, /*defaultType*/ undefined));
                    }
                    return cleanup(visitEachChild(input, visitDeclarationSubtree, context));
                }
                case SyntaxKind.ConditionalType: {
                    // We have to process conditional types in a special way because for visibility purposes we need to push a new enclosingDeclaration
                    // just for the `infer` types in the true branch. It's an implicit declaration scope that only applies to _part_ of the type.
                    const checkType = visitNode(input.checkType, visitDeclarationSubtree, isTypeNode);
                    const extendsType = visitNode(input.extendsType, visitDeclarationSubtree, isTypeNode);
                    const oldEnclosingDecl = enclosingDeclaration;
                    enclosingDeclaration = input.trueType;
                    const trueType = visitNode(input.trueType, visitDeclarationSubtree, isTypeNode);
                    enclosingDeclaration = oldEnclosingDecl;
                    const falseType = visitNode(input.falseType, visitDeclarationSubtree, isTypeNode);
                    Debug.assert(checkType);
                    Debug.assert(extendsType);
                    Debug.assert(trueType);
                    Debug.assert(falseType);
                    return cleanup(factory.updateConditionalTypeNode(input, checkType, extendsType, trueType, falseType));
                }
                case SyntaxKind.FunctionType: {
                    return cleanup(factory.updateFunctionTypeNode(input, visitNodes(input.typeParameters, visitDeclarationSubtree, isTypeParameterDeclaration), updateParamsList(input, input.parameters), Debug.checkDefined(visitNode(input.type, visitDeclarationSubtree, isTypeNode))));
                }
                case SyntaxKind.ConstructorType: {
                    return cleanup(factory.updateConstructorTypeNode(input, ensureModifiers(input), visitNodes(input.typeParameters, visitDeclarationSubtree, isTypeParameterDeclaration), updateParamsList(input, input.parameters), Debug.checkDefined(visitNode(input.type, visitDeclarationSubtree, isTypeNode))));
                }
                case SyntaxKind.ImportType: {
                    if (!isLiteralImportTypeNode(input)) return cleanup(input);
                    return cleanup(factory.updateImportTypeNode(
                        input,
                        factory.updateLiteralTypeNode(input.argument, rewriteModuleSpecifier(input, input.argument.literal)),
                        input.assertions,
                        input.qualifier,
                        visitNodes(input.typeArguments, visitDeclarationSubtree, isTypeNode),
                        input.isTypeOf
                    ));
                }
                default: Debug.assertNever(input, `Attempted to process unhandled node kind: ${Debug.formatSyntaxKind((input as Node).kind)}`);
            }
        }

        if (isTupleTypeNode(input) && (getLineAndCharacterOfPosition(currentSourceFile, input.pos).line === getLineAndCharacterOfPosition(currentSourceFile, input.end).line)) {
            setEmitFlags(input, EmitFlags.SingleLine);
        }

        return cleanup(visitEachChild(input, visitDeclarationSubtree, context));

        function cleanup<T extends Node>(returnValue: T | undefined): T | undefined {
            if (returnValue && canProduceDiagnostic && hasDynamicName(input as Declaration)) {
                checkName(input);
            }
            if (isEnclosingDeclaration(input)) {
                enclosingDeclaration = previousEnclosingDeclaration;
            }
            if (canProduceDiagnostic && !suppressNewDiagnosticContexts) {
                getSymbolAccessibilityDiagnostic = oldDiag;
            }
            if (shouldEnterSuppressNewDiagnosticsContextContext) {
                suppressNewDiagnosticContexts = oldWithinObjectLiteralType;
            }
            if (returnValue === input) {
                return returnValue;
            }
            return returnValue && setOriginalNode(preserveJsDoc(returnValue, input), input);
        }
    }

    function isPrivateMethodTypeParameter(node: TypeParameterDeclaration) {
        return node.parent.kind === SyntaxKind.MethodDeclaration && hasEffectiveModifier(node.parent, ModifierFlags.Private);
    }

    function visitDeclarationStatements(input: Node): VisitResult<Node | undefined> {
        if (!isPreservedDeclarationStatement(input)) {
            // return undefined for unmatched kinds to omit them from the tree
            return;
        }
        if (shouldStripInternal(input)) return;

        switch (input.kind) {
            case SyntaxKind.ExportDeclaration: {
                if (isSourceFile(input.parent)) {
                    resultHasExternalModuleIndicator = true;
                }
                resultHasScopeMarker = true;
                // Always visible if the parent node isn't dropped for being not visible
                // Rewrite external module names if necessary
                return factory.updateExportDeclaration(
                    input,
                    input.modifiers,
                    input.isTypeOnly,
                    input.exportClause,
                    rewriteModuleSpecifier(input, input.moduleSpecifier),
                    getResolutionModeOverrideForClause(input.assertClause) ? input.assertClause : undefined
                );
            }
            case SyntaxKind.ExportAssignment: {
                // Always visible if the parent node isn't dropped for being not visible
                if (isSourceFile(input.parent)) {
                    resultHasExternalModuleIndicator = true;
                }
                resultHasScopeMarker = true;
                if (input.expression.kind === SyntaxKind.Identifier) {
                    return input;
                }
                else {
                    const newId = factory.createUniqueName("_default", GeneratedIdentifierFlags.Optimistic);
                    getSymbolAccessibilityDiagnostic = () => ({
                        diagnosticMessage: Diagnostics.Default_export_of_the_module_has_or_is_using_private_name_0,
                        errorNode: input
                    });
                    errorFallbackNode = input;
                    const varDecl = factory.createVariableDeclaration(newId, /*exclamationToken*/ undefined, resolver.createTypeOfExpression(input.expression, input, declarationEmitNodeBuilderFlags, symbolTracker), /*initializer*/ undefined);
                    errorFallbackNode = undefined;
                    const statement = factory.createVariableStatement(needsDeclare ? [factory.createModifier(SyntaxKind.DeclareKeyword)] : [], factory.createVariableDeclarationList([varDecl], NodeFlags.Const));

                    preserveJsDoc(statement, input);
                    removeAllComments(input);
                    return [statement, factory.updateExportAssignment(input, input.modifiers, newId)];
                }
            }
        }

        const result = transformTopLevelDeclaration(input);
        // Don't actually transform yet; just leave as original node - will be elided/swapped by late pass
        lateStatementReplacementMap.set(getOriginalNodeId(input), result);
        return input;
    }

    function stripExportModifiers(statement: Statement): Statement {
        if (isImportEqualsDeclaration(statement) || hasEffectiveModifier(statement, ModifierFlags.Default) || !canHaveModifiers(statement)) {
            // `export import` statements should remain as-is, as imports are _not_ implicitly exported in an ambient namespace
            // Likewise, `export default` classes and the like and just be `default`, so we preserve their `export` modifiers, too
            return statement;
        }

        const modifiers = factory.createModifiersFromModifierFlags(getEffectiveModifierFlags(statement) & (ModifierFlags.All ^ ModifierFlags.Export));
        return factory.updateModifiers(statement, modifiers);
    }

    function transformTopLevelDeclaration(input: LateVisibilityPaintedStatement) {
        if (lateMarkedStatements) {
            while (orderedRemoveItem(lateMarkedStatements, input));
        }
        if (shouldStripInternal(input)) return;
        switch (input.kind) {
            case SyntaxKind.ImportEqualsDeclaration: {
                return transformImportEqualsDeclaration(input);
            }
            case SyntaxKind.ImportDeclaration: {
                return transformImportDeclaration(input);
            }
        }
        if (isDeclaration(input) && isDeclarationAndNotVisible(input)) return;

        // Elide implementation signatures from overload sets
        if (isFunctionLike(input) && resolver.isImplementationOfOverload(input)) return;

        let previousEnclosingDeclaration: typeof enclosingDeclaration;
        if (isEnclosingDeclaration(input)) {
            previousEnclosingDeclaration = enclosingDeclaration;
            enclosingDeclaration = input as Declaration;
        }

        const canProdiceDiagnostic = canProduceDiagnostics(input);
        const oldDiag = getSymbolAccessibilityDiagnostic;
        if (canProdiceDiagnostic) {
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(input as DeclarationDiagnosticProducing);
        }

        const previousNeedsDeclare = needsDeclare;
        switch (input.kind) {
            case SyntaxKind.TypeAliasDeclaration: {
                needsDeclare = false;
                const clean = cleanup(factory.updateTypeAliasDeclaration(
                    input,
                    ensureModifiers(input),
                    input.name,
                    visitNodes(input.typeParameters, visitDeclarationSubtree, isTypeParameterDeclaration),
                    Debug.checkDefined(visitNode(input.type, visitDeclarationSubtree, isTypeNode))
                ));
                needsDeclare = previousNeedsDeclare;
                return clean;
            }
            case SyntaxKind.InterfaceDeclaration: {
                return cleanup(factory.updateInterfaceDeclaration(
                    input,
                    ensureModifiers(input),
                    input.name,
                    ensureTypeParams(input, input.typeParameters),
                    transformHeritageClauses(input.heritageClauses),
                    visitNodes(input.members, visitDeclarationSubtree, isTypeElement)
                ));
            }
            case SyntaxKind.FunctionDeclaration: {
                // Generators lose their generator-ness, excepting their return type
                const clean = cleanup(factory.updateFunctionDeclaration(
                    input,
                    ensureModifiers(input),
                    /*asteriskToken*/ undefined,
                    input.name,
                    ensureTypeParams(input, input.typeParameters),
                    updateParamsList(input, input.parameters),
                    ensureType(input, input.type),
                    /*body*/ undefined
                ));
                if (clean && resolver.isExpandoFunctionDeclaration(input) && shouldEmitFunctionProperties(input)) {
                    const props = resolver.getPropertiesOfContainerFunction(input);
                    // Use parseNodeFactory so it is usable as an enclosing declaration
                    const fakespace = parseNodeFactory.createModuleDeclaration(/*modifiers*/ undefined, clean.name || factory.createIdentifier("_default"), factory.createModuleBlock([]), NodeFlags.Namespace);
                    setParent(fakespace, enclosingDeclaration as SourceFile | NamespaceDeclaration);
                    fakespace.locals = createSymbolTable(props);
                    fakespace.symbol = props[0].parent!;
                    const exportMappings: [Identifier, string][] = [];
                    let declarations: (VariableStatement | ExportDeclaration)[] = mapDefined(props, p => {
                        if (!p.valueDeclaration || !(isPropertyAccessExpression(p.valueDeclaration) || isElementAccessExpression(p.valueDeclaration) || isBinaryExpression(p.valueDeclaration))) {
                            return undefined;
                        }
                        const nameStr = unescapeLeadingUnderscores(p.escapedName);
                        if (!isIdentifierText(nameStr, ScriptTarget.ESNext)) {
                            return undefined; // unique symbol or non-identifier name - omit, since there's no syntax that can preserve it
                        }
                        getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(p.valueDeclaration);
                        const type = resolver.createTypeOfDeclaration(p.valueDeclaration, fakespace, declarationEmitNodeBuilderFlags, symbolTracker);
                        getSymbolAccessibilityDiagnostic = oldDiag;
                        const isNonContextualKeywordName = isStringANonContextualKeyword(nameStr);
                        const name = isNonContextualKeywordName ? factory.getGeneratedNameForNode(p.valueDeclaration) : factory.createIdentifier(nameStr);
                        if (isNonContextualKeywordName) {
                            exportMappings.push([name, nameStr]);
                        }
                        const varDecl = factory.createVariableDeclaration(name, /*exclamationToken*/ undefined, type, /*initializer*/ undefined);
                        return factory.createVariableStatement(isNonContextualKeywordName ? undefined : [factory.createToken(SyntaxKind.ExportKeyword)], factory.createVariableDeclarationList([varDecl]));
                    });
                    if (!exportMappings.length) {
                        declarations = mapDefined(declarations, declaration => factory.updateModifiers(declaration, ModifierFlags.None));
                    }
                    else {
                        declarations.push(factory.createExportDeclaration(
                            /*modifiers*/ undefined,
                            /*isTypeOnly*/ false,
                            factory.createNamedExports(map(exportMappings, ([gen, exp]) => {
                                return factory.createExportSpecifier(/*isTypeOnly*/ false, gen, exp);
                            }))
                        ));
                    }
                    const namespaceDecl = factory.createModuleDeclaration(ensureModifiers(input), input.name!, factory.createModuleBlock(declarations), NodeFlags.Namespace);
                    if (!hasEffectiveModifier(clean, ModifierFlags.Default)) {
                        return [clean, namespaceDecl];
                    }

                    const modifiers = factory.createModifiersFromModifierFlags((getEffectiveModifierFlags(clean) & ~ModifierFlags.ExportDefault) | ModifierFlags.Ambient);
                    const cleanDeclaration = factory.updateFunctionDeclaration(
                        clean,
                        modifiers,
                        /*asteriskToken*/ undefined,
                        clean.name,
                        clean.typeParameters,
                        clean.parameters,
                        clean.type,
                        /*body*/ undefined
                    );

                    const namespaceDeclaration = factory.updateModuleDeclaration(
                        namespaceDecl,
                        modifiers,
                        namespaceDecl.name,
                        namespaceDecl.body
                    );

                    const exportDefaultDeclaration = factory.createExportAssignment(
                        /*modifiers*/ undefined,
                        /*isExportEquals*/ false,
                        namespaceDecl.name
                    );

                    if (isSourceFile(input.parent)) {
                        resultHasExternalModuleIndicator = true;
                    }
                    resultHasScopeMarker = true;

                    return [cleanDeclaration, namespaceDeclaration, exportDefaultDeclaration];
                }
                else {
                    return clean;
                }
            }
            case SyntaxKind.ModuleDeclaration: {
                needsDeclare = false;
                const inner = input.body;
                if (inner && inner.kind === SyntaxKind.ModuleBlock) {
                    const oldNeedsScopeFix = needsScopeFixMarker;
                    const oldHasScopeFix = resultHasScopeMarker;
                    resultHasScopeMarker = false;
                    needsScopeFixMarker = false;
                    const statements = visitNodes(inner.statements, visitDeclarationStatements, isStatement);
                    let lateStatements = transformAndReplaceLatePaintedStatements(statements);
                    if (input.flags & NodeFlags.Ambient) {
                        needsScopeFixMarker = false; // If it was `declare`'d everything is implicitly exported already, ignore late printed "privates"
                    }
                    // With the final list of statements, there are 3 possibilities:
                    // 1. There's an export assignment or export declaration in the namespace - do nothing
                    // 2. Everything is exported and there are no export assignments or export declarations - strip all export modifiers
                    // 3. Some things are exported, some are not, and there's no marker - add an empty marker
                    if (!isGlobalScopeAugmentation(input) && !hasScopeMarker(lateStatements) && !resultHasScopeMarker) {
                        if (needsScopeFixMarker) {
                            lateStatements = factory.createNodeArray([...lateStatements, createEmptyExports(factory)]);
                        }
                        else {
                            lateStatements = visitNodes(lateStatements, stripExportModifiers, isStatement);
                        }
                    }
                    const body = factory.updateModuleBlock(inner, lateStatements);
                    needsDeclare = previousNeedsDeclare;
                    needsScopeFixMarker = oldNeedsScopeFix;
                    resultHasScopeMarker = oldHasScopeFix;
                    const mods = ensureModifiers(input);
                    return cleanup(factory.updateModuleDeclaration(
                        input,
                        mods,
                        isExternalModuleAugmentation(input) ? rewriteModuleSpecifier(input, input.name) : input.name,
                        body
                    ));
                }
                else {
                    needsDeclare = previousNeedsDeclare;
                    const mods = ensureModifiers(input);
                    needsDeclare = false;
                    visitNode(inner, visitDeclarationStatements);
                    // eagerly transform nested namespaces (the nesting doesn't need any elision or painting done)
                    const id = getOriginalNodeId(inner!); // TODO: GH#18217
                    const body = lateStatementReplacementMap.get(id);
                    lateStatementReplacementMap.delete(id);
                    return cleanup(factory.updateModuleDeclaration(
                        input,
                        mods,
                        input.name,
                        body as ModuleBody
                    ));
                }
            }
            case SyntaxKind.ClassDeclaration: {
                errorNameNode = input.name;
                errorFallbackNode = input;
                const modifiers = factory.createNodeArray(ensureModifiers(input));
                const typeParameters = ensureTypeParams(input, input.typeParameters);
                const ctor = getFirstConstructorWithBody(input);
                let parameterProperties: readonly PropertyDeclaration[] | undefined;
                if (ctor) {
                    const oldDiag = getSymbolAccessibilityDiagnostic;
                    parameterProperties = compact(flatMap(ctor.parameters, (param) => {
                        if (!hasSyntacticModifier(param, ModifierFlags.ParameterPropertyModifier) || shouldStripInternal(param)) return;
                        getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(param);
                        if (param.name.kind === SyntaxKind.Identifier) {
                            return preserveJsDoc(factory.createPropertyDeclaration(
                                ensureModifiers(param),
                                param.name,
                                param.questionToken,
                                ensureType(param, param.type),
                                ensureNoInitializer(param)), param);
                        }
                        else {
                            // Pattern - this is currently an error, but we emit declarations for it somewhat correctly
                            return walkBindingPattern(param.name);
                        }

                        function walkBindingPattern(pattern: BindingPattern) {
                            let elems: PropertyDeclaration[] | undefined;
                            for (const elem of pattern.elements) {
                                if (isOmittedExpression(elem)) continue;
                                if (isBindingPattern(elem.name)) {
                                    elems = concatenate(elems, walkBindingPattern(elem.name));
                                }
                                elems = elems || [];
                                elems.push(factory.createPropertyDeclaration(
                                    ensureModifiers(param),
                                    elem.name as Identifier,
                                    /*questionOrExclamationToken*/ undefined,
                                    ensureType(elem, /*type*/ undefined),
                                    /*initializer*/ undefined
                                ));
                            }
                            return elems;
                        }
                    }));
                    getSymbolAccessibilityDiagnostic = oldDiag;
                }

                const hasPrivateIdentifier = some(input.members, member => !!member.name && isPrivateIdentifier(member.name));
                // When the class has at least one private identifier, create a unique constant identifier to retain the nominal typing behavior
                // Prevents other classes with the same public members from being used in place of the current class
                const privateIdentifier = hasPrivateIdentifier ? [
                    factory.createPropertyDeclaration(
                        /*modifiers*/ undefined,
                        factory.createPrivateIdentifier("#private"),
                        /*questionOrExclamationToken*/ undefined,
                        /*type*/ undefined,
                        /*initializer*/ undefined
                    )
                ] : undefined;
                const memberNodes = concatenate(concatenate(privateIdentifier, parameterProperties), visitNodes(input.members, visitDeclarationSubtree, isClassElement));
                const members = factory.createNodeArray(memberNodes);

                const extendsClause = getEffectiveBaseTypeNode(input);
                if (extendsClause && !isEntityNameExpression(extendsClause.expression) && extendsClause.expression.kind !== SyntaxKind.NullKeyword) {
                    // We must add a temporary declaration for the extends clause expression

                    const oldId = input.name ? unescapeLeadingUnderscores(input.name.escapedText) : "default";
                    const newId = factory.createUniqueName(`${oldId}_base`, GeneratedIdentifierFlags.Optimistic);
                    getSymbolAccessibilityDiagnostic = () => ({
                        diagnosticMessage: Diagnostics.extends_clause_of_exported_class_0_has_or_is_using_private_name_1,
                        errorNode: extendsClause,
                        typeName: input.name
                    });
                    const varDecl = factory.createVariableDeclaration(newId, /*exclamationToken*/ undefined, resolver.createTypeOfExpression(extendsClause.expression, input, declarationEmitNodeBuilderFlags, symbolTracker), /*initializer*/ undefined);
                    const statement = factory.createVariableStatement(needsDeclare ? [factory.createModifier(SyntaxKind.DeclareKeyword)] : [], factory.createVariableDeclarationList([varDecl], NodeFlags.Const));
                    const heritageClauses = factory.createNodeArray(map(input.heritageClauses, clause => {
                        if (clause.token === SyntaxKind.ExtendsKeyword) {
                            const oldDiag = getSymbolAccessibilityDiagnostic;
                            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(clause.types[0]);
                            const newClause = factory.updateHeritageClause(clause, map(clause.types, t => factory.updateExpressionWithTypeArguments(t, newId, visitNodes(t.typeArguments, visitDeclarationSubtree, isTypeNode))));
                            getSymbolAccessibilityDiagnostic = oldDiag;
                            return newClause;
                        }
                        return factory.updateHeritageClause(clause, visitNodes(factory.createNodeArray(filter(clause.types, t => isEntityNameExpression(t.expression) || t.expression.kind === SyntaxKind.NullKeyword)), visitDeclarationSubtree, isExpressionWithTypeArguments));
                    }));
                    return [statement, cleanup(factory.updateClassDeclaration(
                        input,
                        modifiers,
                        input.name,
                        typeParameters,
                        heritageClauses,
                        members
                    ))!]; // TODO: GH#18217
                }
                else {
                    const heritageClauses = transformHeritageClauses(input.heritageClauses);
                    return cleanup(factory.updateClassDeclaration(
                        input,
                        modifiers,
                        input.name,
                        typeParameters,
                        heritageClauses,
                        members
                    ));
                }
            }
            case SyntaxKind.VariableStatement: {
                return cleanup(transformVariableStatement(input));
            }
            case SyntaxKind.EnumDeclaration: {
                return cleanup(factory.updateEnumDeclaration(input, factory.createNodeArray(ensureModifiers(input)), input.name, factory.createNodeArray(mapDefined(input.members, m => {
                    if (shouldStripInternal(m)) return;
                    // Rewrite enum values to their constants, if available
                    const constValue = resolver.getConstantValue(m);
                    return preserveJsDoc(factory.updateEnumMember(m, m.name, constValue !== undefined ? typeof constValue === "string" ? factory.createStringLiteral(constValue) : factory.createNumericLiteral(constValue) : undefined), m);
                }))));
            }
        }
        // Anything left unhandled is an error, so this should be unreachable
        return Debug.assertNever(input, `Unhandled top-level node in declaration emit: ${Debug.formatSyntaxKind((input as Node).kind)}`);

        function cleanup<T extends Node>(node: T | undefined): T | undefined {
            if (isEnclosingDeclaration(input)) {
                enclosingDeclaration = previousEnclosingDeclaration;
            }
            if (canProdiceDiagnostic) {
                getSymbolAccessibilityDiagnostic = oldDiag;
            }
            if (input.kind === SyntaxKind.ModuleDeclaration) {
                needsDeclare = previousNeedsDeclare;
            }
            if (node as Node === input) {
                return node;
            }
            errorFallbackNode = undefined;
            errorNameNode = undefined;
            return node && setOriginalNode(preserveJsDoc(node, input), input);
        }
    }

    function transformVariableStatement(input: VariableStatement) {
        if (!forEach(input.declarationList.declarations, getBindingNameVisible)) return;
        const nodes = visitNodes(input.declarationList.declarations, visitDeclarationSubtree, isVariableDeclaration);
        if (!length(nodes)) return;
        return factory.updateVariableStatement(input, factory.createNodeArray(ensureModifiers(input)), factory.updateVariableDeclarationList(input.declarationList, nodes));
    }

    function recreateBindingPattern(d: BindingPattern): VariableDeclaration[] {
        return flatten<VariableDeclaration>(mapDefined(d.elements, e => recreateBindingElement(e)));
    }

    function recreateBindingElement(e: ArrayBindingElement) {
        if (e.kind === SyntaxKind.OmittedExpression) {
            return;
        }
        if (e.name) {
            if (!getBindingNameVisible(e)) return;
            if (isBindingPattern(e.name)) {
                return recreateBindingPattern(e.name);
            }
            else {
                return factory.createVariableDeclaration(e.name, /*exclamationToken*/ undefined, ensureType(e, /*type*/ undefined), /*initializer*/ undefined);
            }
        }
    }

    function checkName(node: DeclarationDiagnosticProducing) {
        let oldDiag: typeof getSymbolAccessibilityDiagnostic | undefined;
        if (!suppressNewDiagnosticContexts) {
            oldDiag = getSymbolAccessibilityDiagnostic;
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNodeName(node);
        }
        errorNameNode = (node as NamedDeclaration).name;
        Debug.assert(resolver.isLateBound(getParseTreeNode(node) as Declaration)); // Should only be called with dynamic names
        const decl = node as NamedDeclaration as LateBoundDeclaration;
        const entityName = decl.name.expression;
        checkEntityNameVisibility(entityName, enclosingDeclaration);
        if (!suppressNewDiagnosticContexts) {
            getSymbolAccessibilityDiagnostic = oldDiag!;
        }
        errorNameNode = undefined;
    }

    function shouldStripInternal(node: Node) {
        return !!stripInternal && !!node && isInternalDeclaration(node, currentSourceFile);
    }

    function isScopeMarker(node: Node) {
        return isExportAssignment(node) || isExportDeclaration(node);
    }

    function hasScopeMarker(statements: readonly Statement[]) {
        return some(statements, isScopeMarker);
    }

    function ensureModifiers<T extends HasModifiers>(node: T): readonly Modifier[] | undefined {
        const currentFlags = getEffectiveModifierFlags(node);
        const newFlags = ensureModifierFlags(node);
        if (currentFlags === newFlags) {
            return visitArray(node.modifiers, n => tryCast(n, isModifier), isModifier);
        }
        return factory.createModifiersFromModifierFlags(newFlags);
    }

    function ensureModifierFlags(node: Node): ModifierFlags {
        let mask = ModifierFlags.All ^ (ModifierFlags.Public | ModifierFlags.Async | ModifierFlags.Override); // No async and override modifiers in declaration files
        let additions = (needsDeclare && !isAlwaysType(node)) ? ModifierFlags.Ambient : ModifierFlags.None;
        const parentIsFile = node.parent.kind === SyntaxKind.SourceFile;
        if (!parentIsFile || (isBundledEmit && parentIsFile && isExternalModule(node.parent as SourceFile))) {
            mask ^= ModifierFlags.Ambient;
            additions = ModifierFlags.None;
        }
        return maskModifierFlags(node, mask, additions);
    }

    function getTypeAnnotationFromAllAccessorDeclarations(node: AccessorDeclaration, accessors: AllAccessorDeclarations) {
        let accessorType = getTypeAnnotationFromAccessor(node);
        if (!accessorType && node !== accessors.firstAccessor) {
            accessorType = getTypeAnnotationFromAccessor(accessors.firstAccessor);
            // If we end up pulling the type from the second accessor, we also need to change the diagnostic context to get the expected error message
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(accessors.firstAccessor);
        }
        if (!accessorType && accessors.secondAccessor && node !== accessors.secondAccessor) {
            accessorType = getTypeAnnotationFromAccessor(accessors.secondAccessor);
            // If we end up pulling the type from the second accessor, we also need to change the diagnostic context to get the expected error message
            getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(accessors.secondAccessor);
        }
        return accessorType;
    }

    function transformHeritageClauses(nodes: NodeArray<HeritageClause> | undefined) {
        return factory.createNodeArray(filter(map(nodes, clause => factory.updateHeritageClause(clause, visitNodes(factory.createNodeArray(filter(clause.types, t => {
            return isEntityNameExpression(t.expression) || (clause.token === SyntaxKind.ExtendsKeyword && t.expression.kind === SyntaxKind.NullKeyword);
        })), visitDeclarationSubtree, isExpressionWithTypeArguments))), clause => clause.types && !!clause.types.length));
    }
}

function isAlwaysType(node: Node) {
    if (node.kind === SyntaxKind.InterfaceDeclaration) {
        return true;
    }
    return false;
}

// Elide "public" modifier, as it is the default
function maskModifiers(factory: NodeFactory, node: Node, modifierMask?: ModifierFlags, modifierAdditions?: ModifierFlags): Modifier[] | undefined {
    return factory.createModifiersFromModifierFlags(maskModifierFlags(node, modifierMask, modifierAdditions));
}

function maskModifierFlags(node: Node, modifierMask: ModifierFlags = ModifierFlags.All ^ ModifierFlags.Public, modifierAdditions: ModifierFlags = ModifierFlags.None): ModifierFlags {
    let flags = (getEffectiveModifierFlags(node) & modifierMask) | modifierAdditions;
    if (flags & ModifierFlags.Default && !(flags & ModifierFlags.Export)) {
        // A non-exported default is a nonsequitor - we usually try to remove all export modifiers
        // from statements in ambient declarations; but a default export must retain its export modifier to be syntactically valid
        flags ^= ModifierFlags.Export;
    }
    if (flags & ModifierFlags.Default && flags & ModifierFlags.Ambient) {
        flags ^= ModifierFlags.Ambient; // `declare` is never required alongside `default` (and would be an error if printed)
    }
    return flags;
}

function getTypeAnnotationFromAccessor(accessor: AccessorDeclaration): TypeNode | undefined {
    if (accessor) {
        return accessor.kind === SyntaxKind.GetAccessor
            ? accessor.type // Getter - return type
            : accessor.parameters.length > 0
                ? accessor.parameters[0].type // Setter parameter type
                : undefined;
    }
}

type CanHaveLiteralInitializer = VariableDeclaration | PropertyDeclaration | PropertySignature | ParameterDeclaration;
function canHaveLiteralInitializer(node: Node): boolean {
    switch (node.kind) {
        case SyntaxKind.PropertyDeclaration:
        case SyntaxKind.PropertySignature:
            return !hasEffectiveModifier(node, ModifierFlags.Private);
        case SyntaxKind.Parameter:
        case SyntaxKind.VariableDeclaration:
            return true;
    }
    return false;
}

type ProcessedDeclarationStatement =
    | FunctionDeclaration
    | ModuleDeclaration
    | ImportEqualsDeclaration
    | InterfaceDeclaration
    | ClassDeclaration
    | TypeAliasDeclaration
    | EnumDeclaration
    | VariableStatement
    | ImportDeclaration
    | ExportDeclaration
    | ExportAssignment;

function isPreservedDeclarationStatement(node: Node): node is ProcessedDeclarationStatement {
    switch (node.kind) {
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.ModuleDeclaration:
        case SyntaxKind.ImportEqualsDeclaration:
        case SyntaxKind.InterfaceDeclaration:
        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.TypeAliasDeclaration:
        case SyntaxKind.EnumDeclaration:
        case SyntaxKind.VariableStatement:
        case SyntaxKind.ImportDeclaration:
        case SyntaxKind.ExportDeclaration:
        case SyntaxKind.ExportAssignment:
            return true;
    }
    return false;
}

type ProcessedComponent =
    | ConstructSignatureDeclaration
    | ConstructorDeclaration
    | MethodDeclaration
    | GetAccessorDeclaration
    | SetAccessorDeclaration
    | PropertyDeclaration
    | PropertySignature
    | MethodSignature
    | CallSignatureDeclaration
    | IndexSignatureDeclaration
    | VariableDeclaration
    | TypeParameterDeclaration
    | ExpressionWithTypeArguments
    | TypeReferenceNode
    | ConditionalTypeNode
    | FunctionTypeNode
    | ConstructorTypeNode
    | ImportTypeNode;

function isProcessedComponent(node: Node): node is ProcessedComponent {
    switch (node.kind) {
        case SyntaxKind.ConstructSignature:
        case SyntaxKind.Constructor:
        case SyntaxKind.MethodDeclaration:
        case SyntaxKind.GetAccessor:
        case SyntaxKind.SetAccessor:
        case SyntaxKind.PropertyDeclaration:
        case SyntaxKind.PropertySignature:
        case SyntaxKind.MethodSignature:
        case SyntaxKind.CallSignature:
        case SyntaxKind.IndexSignature:
        case SyntaxKind.VariableDeclaration:
        case SyntaxKind.TypeParameter:
        case SyntaxKind.ExpressionWithTypeArguments:
        case SyntaxKind.TypeReference:
        case SyntaxKind.ConditionalType:
        case SyntaxKind.FunctionType:
        case SyntaxKind.ConstructorType:
        case SyntaxKind.ImportType:
            return true;
    }
    return false;
}
