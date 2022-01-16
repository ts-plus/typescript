import * as ts from "../_namespaces/ts"
import {
    BinaryExpression, Block, Bundle, CallExpression, chainBundle, CharacterCodes, ClassDeclaration, CompilerHost, CompilerOptions,
    ConciseBody, Debug, Declaration, Derivation, ElementAccessExpression, escapeString, Expression, factory, filter, flatMapToMutable,
    FunctionDeclaration, getAllJSDocTags, getEnclosingBlockScopeContainer, getFileMap, getImportLocation, getLineAndCharacterOfPosition,
    getOriginalNode, getParametersOfFunctionOrVariableDeclaration, getSourceFileOfNode, getTraceLocation, getTraceMap, HasModifiers, Identifier, identity, ImportDeclaration,
    isArrowFunction, isBlock, isCallExpression, isDeclaration, isDeclarationName, isExportDeclaration, isExpressionStatement, isFunctionDeclaration,
    isIdentifier, isNamedDeclaration, isNamespaceImport, isNumericLiteral, isParenthesizedExpression, isPartOfTypeNode, isPartOfTypeQuery,
    isPropertyAccessExpression, isReturnStatement, isSpreadElement, isStringLiteral, isSuperCall, isTsPlusSignature, isVariableDeclaration,
    isVariableStatement, JSDocTag, map, NamedDeclaration, Node, NodeArray, NodeFactory, NodeFlags, ParameterDeclaration, PropertyAccessExpression,
    reduceLeft, setOriginalNode, SourceFile, Statement, symbolName, SyntaxKind, TransformationContext, TsPlusPipeableDeclarationSymbol, TsPlusSignature, TypeChecker,
    VariableStatement, visitEachChild, visitNode, visitNodes, Visitor, VisitResult, __String, TypeNode
} from "../_namespaces/ts";

/*@internal*/
class TsPlusImporter {
    readonly imports: Map<string, { name: Identifier, exists: boolean }> = new Map();

    readonly refCount: Map<string, number> = new Map();
    constructor(readonly factory: NodeFactory) { }

    add(name: Identifier, path: string): void {
        this.imports.set(path, { name, exists: true })
        this.refCount.set(path, Infinity)
    }

    get(path: string): Identifier {
        if (!this.imports.has(path)) {
            this.imports.set(path, { name: this.factory.createUniqueName("tsplus_module"), exists: false });
        }
        this.refCount.set(path, (this.refCount.get(path) ?? 0) + 1);
        return this.imports.get(path)!.name;
    }

    remove(path: string): void {
        if (!this.imports.has(path)) {
            return;
        }
        const refCount = this.refCount.get(path)!;
        if (refCount - 1 === 0) {
            this.imports.delete(path);
            this.refCount.delete(path);
        }
        else {
            this.refCount.set(path, refCount - 1);
        }
    }
}
class UniqueNameOfDerivation {
    readonly cache = new Map<Derivation, Identifier>()
    constructor(readonly factory: NodeFactory) { }
    get(d: Derivation) {
        if (!this.cache.has(d)) {
            this.cache.set(d, this.factory.createUniqueName("derive"))
        }
        return this.cache.get(d)!
    }
}
class SourceFileUniqueNames {
    readonly cache = new Map<string, SourceFileUniqueName>()
    constructor(readonly factory: NodeFactory) { }
    get(text: string, isExported = true) {
        if (!this.cache.has(text)) {
            this.cache.set(text, { name: this.factory.createTsPlusUniqueName(text), isExported });
        }
        return this.cache.get(text)!;
    }
    has(text: string) {
        return this.cache.has(text);
    }
    clear() {
        this.cache.clear();
    }
}
interface SourceFileUniqueName {
    readonly name: Identifier
    readonly isExported: boolean
}
export function transformTsPlus(checker: TypeChecker, options: CompilerOptions, host: CompilerHost): (context: TransformationContext) => (sourceFile: SourceFile | Bundle) => SourceFile | Bundle {
    if (options.tsPlusEnabled === false) {
        return () => identity;
    }
    const fileMap: [string, RegExp][] = getFileMap(options, host);
    const traceMap: [string, RegExp][] = getTraceMap(options, host);
    return function (context: TransformationContext) {
        const importer = new TsPlusImporter(context.factory);
        const uniqueNameOfDerivation = new UniqueNameOfDerivation(context.factory);
        const sourceFileUniqueNames = new SourceFileUniqueNames(context.factory);
        const fileVar = factory.createUniqueName("fileName");
        let fileVarUsed = false;
        return chainBundle(context, transformSourceFile);
        function transformSourceFile(node: SourceFile) {
            if (node.isDeclarationFile) {
                return node;
            }

            const transformed = visitEachChild(node, visitor(node, void 0), context);

            const uniqueDeclarations: Statement[] = [];

            const transformedWithUniqueDeclarations = visitEachChild(
                transformed,
                addSourceFileUniqueNamesVisitor(uniqueDeclarations, sourceFileUniqueNames, context),
                context
            )

            sourceFileUniqueNames.clear();

            const imports: Statement[] = []
            importer.imports.forEach(({ name, exists }, path) => {
                if (!exists) {
                    imports.push(
                        factory.createImportDeclaration(
                            undefined,
                            factory.createImportClause(
                                false,
                                undefined,
                                factory.createNamespaceImport(name)
                            ),
                            factory.createStringLiteral(path),
                            undefined
                        )
                    );
                }
            })
            const fileVarDef = fileVarUsed ? [
                context.factory.createVariableStatement(
                    undefined,
                    factory.createVariableDeclarationList(
                        [
                            factory.createVariableDeclaration(
                                fileVar,
                                undefined,
                                undefined,
                                factory.createStringLiteral(
                                    getTraceLocation(traceMap, node.fileName)
                                )
                            )
                        ],
                        ts.NodeFlags.Const
                    )
                )
            ] : [];
            return context.factory.updateSourceFile(
                transformed,
                [...fileVarDef, ...imports, ...uniqueDeclarations, ...transformedWithUniqueDeclarations.statements],
                transformed.isDeclarationFile,
                transformed.referencedFiles,
                transformed.typeReferenceDirectives,
                transformed.hasNoDefaultLib,
                transformed.libReferenceDirectives
            );
        }
        function getTrace(source: SourceFile, node: ts.Node) {
            const nodeEnd = getLineAndCharacterOfPosition(source, node.end)
            fileVarUsed = true;
            return factory.createBinaryExpression(
                fileVar,
                factory.createToken(ts.SyntaxKind.PlusToken),
                factory.createStringLiteral(`:${nodeEnd.line + 1}:${nodeEnd.character + 1}`)
            )
        }
        function visitor(source: SourceFile, traceInScope: Identifier | undefined) {
            return function (node: Node): VisitResult<Node> {
                switch (node.kind) {
                    case SyntaxKind.ElementAccessExpression:
                        return visitElementAccessExpression(source, traceInScope, node as ElementAccessExpression, context)
                    case SyntaxKind.BinaryExpression:
                        return visitBinaryExpression(source, traceInScope, node as BinaryExpression, context)
                    case SyntaxKind.FunctionDeclaration:
                        return visitFunctionDeclaration(source, traceInScope, node as FunctionDeclaration, context);
                    case SyntaxKind.PropertyAccessExpression:
                        return visitPropertyAccessExpression(source, traceInScope, node as PropertyAccessExpression, visitor(source, traceInScope), context);
                    case SyntaxKind.CallExpression:
                        return visitCallExpressionOrFluentCallExpression(source, traceInScope, node as CallExpression, visitor(source, traceInScope), context);
                    case SyntaxKind.VariableStatement:
                        return visitVariableStatement(source, node as VariableStatement, visitor(source, traceInScope), context)
                    case SyntaxKind.Identifier:
                        return visitIdentifier(source, traceInScope, node as Identifier, context);
                    case SyntaxKind.Block:
                        return visitBlock(node as Block, visitor(source, traceInScope), context);
                    case SyntaxKind.ImportDeclaration:
                        return visitImportDeclaration(node as ImportDeclaration)
                    default:
                        return visitEachChild(node, visitor(source, traceInScope), context);
                }
            }
        }
        function visitBlock(node: Block, visitor: Visitor, context: TransformationContext) {
            const uniqueNames = checker.getNodeLinks(getEnclosingBlockScopeContainer(node)).uniqueNames;
            if (uniqueNames) {
                const remainingNames = new Set(uniqueNames);
                const updatedStatements = flatMapToMutable(node.statements, (statement) => {
                    if (isVariableStatement(statement) && statement.declarationList.declarations[0]) {
                        const declaration = statement.declarationList.declarations[0];
                        const declarationLinks = checker.getNodeLinks(declaration);
                        if (declarationLinks.needsUniqueNameInSope) {
                            Debug.assert(isNamedDeclaration(declaration) && isIdentifier(declaration.name));
                            const uniqueIdentifier = context.factory.createUniqueName(declaration.name.escapedText as string);
                            declarationLinks.uniqueNameInScope = uniqueIdentifier;
                            declarationLinks.needsUniqueNameInSope = false;
                            remainingNames.delete(declaration as NamedDeclaration & { name: Identifier });
                            return [
                                statement,
                                context.factory.createVariableStatement(
                                    [context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                    context.factory.createVariableDeclarationList([
                                        context.factory.createVariableDeclaration(uniqueIdentifier, undefined, undefined, declaration.name)
                                    ], NodeFlags.Const)
                                ),
                            ];
                        }
                    }
                    return statement;
                })
                remainingNames.forEach((declaration) => {
                    const declarationLinks = checker.getNodeLinks(declaration);
                    if (declarationLinks.needsUniqueNameInSope) {
                        Debug.assert(isNamedDeclaration(declaration) && isIdentifier(declaration.name));
                        const uniqueIdentifier = context.factory.createUniqueName(declaration.name.escapedText as string);
                        declarationLinks.uniqueNameInScope = uniqueIdentifier;
                        declarationLinks.needsUniqueNameInSope = false;
                        updatedStatements.unshift(
                            context.factory.createVariableStatement(
                                [context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                context.factory.createVariableDeclarationList([
                                    context.factory.createVariableDeclaration(uniqueIdentifier, undefined, undefined, declaration.name)
                                ], NodeFlags.Const)
                            ),
                        );
                    }
                })
                remainingNames.clear();
                return context.factory.updateBlock(
                    node,
                    visitNodes(context.factory.createNodeArray(updatedStatements), visitor) as NodeArray<Statement>
                )
            }
            return visitEachChild(node, visitor, context);
        }
        function visitImportDeclaration(node: ImportDeclaration) {
            if (node.importClause && node.importClause.namedBindings && isNamespaceImport(node.importClause.namedBindings) && isStringLiteral(node.moduleSpecifier)) {
                importer.add(node.importClause.namedBindings.name, node.moduleSpecifier.text)
            }
            return node
        }
        function isExtension(node: Node): boolean {
            const extensionRegex = /^(static|fluent|getter|operator|index|pipeable).*/;
            return getAllJSDocTags(node, (tag): tag is JSDocTag => tag.tagName.escapedText === "tsplus" && typeof tag.comment === "string" && extensionRegex.test(tag.comment)).length > 0;
        }
        function shouldTransformIdentifier(node: Identifier) {
            if (node.parent && isDeclarationName(node) && !isExportDeclaration(node.parent)) {
                return false;
            }
            if (node.parent && isPartOfTypeNode(node.parent)) {
                return false;
            }
            if (node.parent && isPartOfTypeQuery(node.parent)) {
                return false;
            }
            return true
        }
        function visitIdentifier(source: SourceFile, traceInScope: Identifier | undefined, node: Identifier, context: TransformationContext) {
            if (shouldTransformIdentifier(node)) {
                const symbol = checker.getSymbolAtLocation(node);
                if (symbol) {
                    if (symbol.valueDeclaration && isExtension(symbol.valueDeclaration) && getSourceFileOfNode(symbol.valueDeclaration) === source) {
                        const name = node.escapedText.toString();
                        return sourceFileUniqueNames.get(name).name;
                    }
                    const links = checker.getNodeLinks(node);
                    const globalImport = checker.getTsPlusGlobal(node.escapedText.toString());
                    if (links.isTsPlusGlobalIdentifier && globalImport) {
                        return getPathOfGlobalImport(context, importer, node, globalImport.moduleSpecifier.text)
                    }
                }
            }
            return visitEachChild(node, visitor(source, traceInScope), context);
        }
        function visitElementAccessExpression(source: SourceFile, traceInScope: Identifier | undefined, node: ElementAccessExpression, context: TransformationContext): VisitResult<Node> {
            const custom = checker.getIndexAccessExpressionCache().get(node)
            if (custom) {
                const expression = visitNode(node.expression, visitor(source, traceInScope)) as Expression
                const argument = visitNode(node.argumentExpression, visitor(source, traceInScope)) as Expression
                if (custom.signature && isTsPlusSignature(custom.signature) && custom.signature.tsPlusPipeable) {
                    return context.factory.createCallExpression(
                        context.factory.createCallExpression(
                            getPathOfExtension(context, importer, custom, source, sourceFileUniqueNames),
                            [],
                            [argument]
                        ),
                        [],
                        [expression]
                    )
                }
                return context.factory.createCallExpression(
                    getPathOfExtension(context, importer, custom, source, sourceFileUniqueNames),
                    [],
                    [expression, argument]
                )
            }
            return visitEachChild(node, visitor(source, traceInScope), context)
        }
        function visitBinaryExpression(source: SourceFile, traceInScope: Identifier | undefined, node: BinaryExpression, context: TransformationContext): VisitResult<Node> {
            const operatorLinks = checker.getNodeLinks(node.operatorToken);
            if (operatorLinks.isTsPlusOperatorToken && operatorLinks.resolvedSignature && operatorLinks.resolvedSignature.declaration) {
                const call = operatorLinks.resolvedSignature;
                const isPipeable = (isTsPlusSignature(call) && !!call.tsPlusPipeable) || (!!call.target && isTsPlusSignature(call.target) && !!call.target.tsPlusPipeable);
                const declaration = call.declaration!;
                let exportName: string
                if (isPipeable) {
                    exportName = (declaration.symbol as TsPlusPipeableDeclarationSymbol).tsPlusDeclaration.symbol.escapedName!
                }
                else {
                    if (isFunctionDeclaration(declaration)) {
                        exportName = declaration.symbol.escapedName as string;
                    } else if (isDeclaration(declaration.parent)) {
                        exportName = declaration.parent.symbol.escapedName as string;
                    } else if (isDeclaration(declaration.parent.parent)) {
                        exportName = declaration.parent.parent.symbol.escapedName as string;
                    } else {
                        throw new Error("Cannot find export name for operator extension");
                    }
                }
                const params = [visitNode(node.left, visitor(source, traceInScope)), visitNode(node.right, visitor(source, traceInScope))] as Expression[];
                if (checker.getNodeLinks(node.left).tsPlusLazy) {
                    params[0] = context.factory.createArrowFunction(void 0, void 0, [], void 0, void 0, params[0]);
                }
                if (checker.getNodeLinks(node.right).tsPlusLazy) {
                    params[1] = context.factory.createArrowFunction(void 0, void 0, [], void 0, void 0, params[1]);
                }
                if (checker.isTsPlusMacroCall(node, "pipe")) {
                    return optimizePipe(
                        context.factory.createNodeArray(params, false),
                        context.factory,
                        source
                    );
                }
                const lastTrace = call.parameters.length > 0 ? call.parameters[call.parameters.length - 1].escapedName === "___tsplusTrace" : false;
                if (lastTrace) {
                    params.push(traceInScope ? traceInScope : getTrace(source, node.operatorToken))
                }
                if (isPipeable) {
                    return context.factory.createCallExpression(
                        context.factory.createCallExpression(
                            getPathOfExtension(context, importer, {
                                definition: getSourceFileOfNode((declaration.symbol as TsPlusPipeableDeclarationSymbol).tsPlusDeclaration),
                                exportName: exportName
                            }, source, sourceFileUniqueNames),
                            [],
                            params.slice(1)
                        ),
                        [],
                        [params[0]]
                    )
                }
                else {
                    return context.factory.createCallExpression(
                        getPathOfExtension(context, importer, {
                            definition: getSourceFileOfNode(declaration),
                            exportName: exportName
                        }, source, sourceFileUniqueNames),
                        [],
                        params
                    )
                }
            }
            return visitEachChild(node, visitor(source, traceInScope), context)
        }
        function visitFunctionDeclaration(source: SourceFile, traceInScope: Identifier | undefined, node: FunctionDeclaration, context: TransformationContext): VisitResult<Node> {
            if (node.parameters.length > 0) {
                const last = node.parameters[node.parameters.length - 1]

                if (last.name.kind === SyntaxKind.Identifier) {
                    if ((last.name as Identifier).escapedText === "___tsplusTrace") {
                        return visitEachChild(node, visitor(source, last.name as Identifier), context)
                    }
                }
            }
            return visitEachChild(node, visitor(source, traceInScope), context)
        }
        function visitPropertyAccessExpression(source: SourceFile, traceInScope: Identifier | undefined, node: PropertyAccessExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
            const nodeLinks = checker.getNodeLinks(node);
            if (nodeLinks.tsPlusStaticExtension) {
                return getPathOfExtension(context, importer, nodeLinks.tsPlusStaticExtension, source, sourceFileUniqueNames, node);
            }
            if (nodeLinks.tsPlusGetterExtension) {
                if (checker.isTsPlusMacroGetter(node, "identity")) {
                    return visitNode(node.expression, visitor) as Expression;
                }
                const args = [simplyfy(visitNode(node.expression, visitor) as Expression)]
                const parameters = getParametersOfFunctionOrVariableDeclaration(nodeLinks.tsPlusGetterExtension.declaration)
                if (parameters) {
                    const lastParam = parameters[parameters.length - 1];
                    if (lastParam && isIdentifier(lastParam.name) && lastParam.name.escapedText === "___tsplusTrace") {
                        if (traceInScope) {
                            args.push(traceInScope);
                        } else {
                            args.push(getTrace(source, node.expression));
                        }
                    }
                }
                return setOriginalNode(
                    factory.createCallExpression(
                        getPathOfExtension(context, importer, nodeLinks.tsPlusGetterExtension, source, sourceFileUniqueNames, node),
                        void 0,
                        args
                    ),
                    node,
                );
            }
            return visitEachChild(node, visitor, context);
        }
        function visitVariableStatement(_source: SourceFile, node: VariableStatement, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
            if (node.declarationList.declarations.length > 0) {
                const declaration = node.declarationList.declarations[0];
                const nodeLinks = checker.getNodeLinks(declaration);
                if (nodeLinks.tsPlusDataFirstDeclaration && declaration.initializer && isCallExpression(declaration.initializer)) {
                    const signatureDeclaration = nodeLinks.tsPlusDataFirstDeclaration;
                    const updatedDeclaration = factory.updateVariableDeclaration(
                        declaration,
                        declaration.name,
                        undefined,
                        undefined,
                        factory.createArrowFunction(
                            undefined,
                            undefined,
                            signatureDeclaration.parameters.slice(1, signatureDeclaration.parameters.length),
                            undefined,
                            undefined,
                            factory.createArrowFunction(
                                undefined,
                                undefined,
                                [signatureDeclaration.parameters[0]],
                                undefined,
                                undefined,
                                factory.createCallExpression(
                                    declaration.initializer.arguments[0],
                                    undefined,
                                    map(signatureDeclaration.parameters, (pdecl) => pdecl.name as Identifier)
                                )
                            )
                        )
                    )
                    const updatedStatement = factory.updateVariableStatement(
                        node,
                        node.modifiers,
                        factory.updateVariableDeclarationList(
                            node.declarationList,
                            [updatedDeclaration]
                        )
                    )
                    return updatedStatement;
                }
            }
            return ts.visitEachChild(node, visitor, context)
        }
        function createDataFirstCall(call: CallExpression, args: Expression[], definition: SourceFile, exportName: string, source: SourceFile) {
            return factory.updateCallExpression(
                call,
                getPathOfExtension(
                    context,
                    importer,
                    {
                        definition,
                        exportName
                    },
                    source,
                    sourceFileUniqueNames,
                    call.expression,
                ),
                undefined,
                args
            )
        }
        function tryGetOptimizedPipeableCall(call: CallExpression): { definition: SourceFile, exportName: string } | undefined {
            const original = getOriginalNode(call);
            const optimized = checker.getNodeLinks(original).tsPlusOptimizedDataFirst;
            if (optimized) {
                if (isExpressionWithReferencedImport(call.expression)) {
                    importer.remove(call.expression.tsPlusReferencedImport);
                }
                if (isExpressionWithReferencedGlobalImport(call.expression)) {
                    importer.remove(call.expression.tsPlusReferencedGlobalImport);
                }
            }
            return optimized;
        }
        function optimizePipe(
            args: NodeArray<Expression>,
            factory: NodeFactory,
            source: SourceFile
        ): Expression {
            return reduceLeft(args.slice(1), (accumulatedCall, pipeArg) => {
                if (isCallExpression(pipeArg)) {
                    const optimized = tryGetOptimizedPipeableCall(pipeArg);
                    if (optimized) {
                        return createDataFirstCall(getOriginalNode(pipeArg) as CallExpression, [accumulatedCall, ...pipeArg.arguments], optimized.definition, optimized.exportName, source);
                    }
                }
                return factory.createCallExpression(pipeArg, undefined, [accumulatedCall]);
            }, args[0]!);
        }
        function optimizeIdentity(
            node: CallExpression,
        ): Expression {
            if (node.arguments.length === 1 && !isSpreadElement(node.arguments[0])) {
                return node.arguments[0];
            } else {
                return node;
            }
        }
        function simplyfy(node: Expression): Expression {
            if (isParenthesizedExpression(node) && isNumericLiteral(node.expression)) {
                return node.expression
            }
            return node
        }
        function produceDerivation(derivation: Derivation | undefined, context: TransformationContext, importer: TsPlusImporter, source: SourceFile, sourceFileUniqueNames: SourceFileUniqueNames): Expression {
            if (derivation) {
                switch (derivation._tag) {
                    case "FromBlockScope": {
                        const nodeLinks = checker.getNodeLinks(derivation.implicit);
                        if (nodeLinks.uniqueNameInScope) {
                            // Block-scoped (other than SourceFile) implicit
                            return nodeLinks.uniqueNameInScope;
                        }
                        else {
                            // SourceFile-scoped implicit
                            return getPathOfImplicitOrRule(context, importer, derivation.implicit, source, sourceFileUniqueNames);
                        }
                    }
                    case "FromImplicitScope": {
                        return getPathOfImplicitOrRule(context, importer, derivation.implicit, source, sourceFileUniqueNames);
                    }
                    case "EmptyObjectDerivation": {
                        return factory.createObjectLiteralExpression(
                            [],
                            false
                        );
                    }
                    case "FromLiteral": {
                        return typeof derivation.value === "number" ? factory.createNumericLiteral(derivation.value) : factory.createStringLiteral(derivation.value);
                    }
                    case "FromIntersectionStructure": {
                        return factory.createObjectLiteralExpression(
                            derivation.fields.map((child) => factory.createSpreadAssignment(produceDerivation(child, context, importer, source, sourceFileUniqueNames))),
                            false
                        );
                    }
                    case "FromObjectStructure": {
                        return factory.createObjectLiteralExpression(
                            derivation.fields.map((child) => factory.createPropertyAssignment(
                                factory.createIdentifier(`"${escapeString(symbolName(child.prop), CharacterCodes.doubleQuote)}"`),
                                produceDerivation(child.value, context, importer, source, sourceFileUniqueNames)
                            )),
                            false
                        );
                    }
                    case "FromTupleStructure": {
                        return factory.createArrayLiteralExpression(
                            derivation.fields.map((child) => produceDerivation(child, context, importer, source, sourceFileUniqueNames)),
                            false
                        );
                    }
                    case "FromPriorDerivation": {
                        const name = uniqueNameOfDerivation.get(derivation.derivation);
                        if (name) {
                            return name;
                        }
                        break
                    }
                    case "FromRule": {
                        if (derivation.usedBy.length === 0) {
                            return factory.createCallExpression(
                                getPathOfImplicitOrRule(context, importer, derivation.rule, source, sourceFileUniqueNames),
                                undefined,
                                derivation.arguments.map((child) => produceDerivation(child, context, importer, source, sourceFileUniqueNames))
                            );
                        } else if (derivation.lazyRule) {
                            const name = uniqueNameOfDerivation.get(derivation);
                            const lazy = getPathOfImplicitOrRule(context, importer, derivation.lazyRule, source, sourceFileUniqueNames);
                            return factory.createCallExpression(
                                lazy,
                                undefined,
                                [factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [factory.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        name,
                                        undefined,
                                        undefined,
                                        undefined
                                    )],
                                    undefined,
                                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                                    factory.createCallExpression(
                                        getPathOfImplicitOrRule(context, importer, derivation.rule, source, sourceFileUniqueNames),
                                        undefined,
                                        derivation.arguments.map((child) => produceDerivation(child, context, importer, source, sourceFileUniqueNames))
                                    )
                                )]
                            );
                        }
                        break
                    }
                    case "InvalidDerivation": {
                        break
                    }
                }
            }
            return factory.createCallExpression(
                factory.createParenthesizedExpression(factory.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    factory.createBlock(
                        [factory.createThrowStatement(factory.createNewExpression(
                            factory.createIdentifier("Error"),
                            undefined,
                            [factory.createStringLiteral("Not Implemented")]
                        ))],
                        false
                    )
                )),
                undefined,
                []
            );
        }
        function visitDo(
            source: SourceFile,
            traceInScope: Identifier | undefined,
            node: CallExpression,
            visitor: Visitor,
            context: TransformationContext,
            functions: {
                map: TsPlusSignature;
                flatMap: TsPlusSignature;
            }
        ): VisitResult<Node> {
            if (isArrowFunction(node.arguments[0])) {
                const body = node.arguments[0].body;
                if (isBlock(body)) {
                    let currentScope: Statement[] = []
                    let isLast = true;
                    for (let i = body.statements.length - 1; i >= 0; i--) {
                        const statement = body.statements[i];
                        if (
                            isVariableStatement(statement) &&
                            checker.getNodeLinks(statement).tsPlusDoBindType &&
                            statement.declarationList.declarations.length === 1 &&
                            statement.declarationList.declarations[0].initializer &&
                            statement.declarationList.declarations[0].name &&
                            isCallExpression(statement.declarationList.declarations[0].initializer)
                        ) {
                            if (isLast) {
                                isLast = false
                                const mapper = factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [factory.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        statement.declarationList.declarations[0].name,
                                        undefined,
                                        undefined,
                                        undefined
                                    )],
                                    undefined,
                                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                                    getArrowBody(currentScope)
                                );
                                const args = [visitNode(statement.declarationList.declarations[0].initializer.arguments[0], visitor), mapper] as Expression[];
                                if (args.length === functions.map.tsPlusOriginal.parameters.length - 1) {
                                    if (functions.map.tsPlusOriginal.parameters[functions.map.tsPlusOriginal.parameters.length - 1].escapedName === "___tsplusTrace") {
                                        if (traceInScope) {
                                            args.push(traceInScope);
                                        } else {
                                            args.push(getTrace(source, statement.declarationList.declarations[0].initializer.expression));
                                        }
                                    }
                                }
                                currentScope = [factory.createReturnStatement(produceTsPlusCallExpression(functions.map, args, context, importer, source, sourceFileUniqueNames))];
                            }
                            else {
                                const mapper = factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [factory.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        statement.declarationList.declarations[0].name,
                                        undefined,
                                        undefined,
                                        undefined
                                    )],
                                    undefined,
                                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                                    getArrowBody(currentScope)
                                );
                                const args = [visitNode(statement.declarationList.declarations[0].initializer.arguments[0], visitor), mapper] as Expression[];
                                if (args.length === functions.flatMap.tsPlusOriginal.parameters.length - 1) {
                                    if (functions.flatMap.tsPlusOriginal.parameters[functions.flatMap.tsPlusOriginal.parameters.length - 1].escapedName === "___tsplusTrace") {
                                        if (traceInScope) {
                                            args.push(traceInScope);
                                        } else {
                                            args.push(getTrace(source, statement.declarationList.declarations[0].initializer.expression));
                                        }
                                    }
                                }
                                currentScope = [factory.createReturnStatement(produceTsPlusCallExpression(functions.flatMap, args, context, importer, source, sourceFileUniqueNames))];
                            }
                        }
                        else if (isExpressionStatement(statement) && isCallExpression(statement.expression) && checker.getNodeLinks(statement).tsPlusDoBindType) {
                            if (isLast) {
                                isLast = false
                                const mapper = factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [],
                                    undefined,
                                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                                    getArrowBody(currentScope)
                                );
                                const args = [visitNode(statement.expression.arguments[0], visitor), mapper] as Expression[];
                                if (args.length === functions.map.tsPlusOriginal.parameters.length - 1) {
                                    if (functions.map.tsPlusOriginal.parameters[functions.map.tsPlusOriginal.parameters.length - 1].escapedName === "___tsplusTrace") {
                                        if (traceInScope) {
                                            args.push(traceInScope);
                                        } else {
                                            args.push(getTrace(source, statement.expression.expression));
                                        }
                                    }
                                }
                                currentScope = [factory.createReturnStatement(produceTsPlusCallExpression(functions.map, args, context, importer, source, sourceFileUniqueNames))];
                            }
                            else {
                                const mapper = factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                    [],
                                    undefined,
                                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                                    getArrowBody(currentScope)
                                );
                                const args = [visitNode(statement.expression.arguments[0], visitor), mapper] as Expression[];
                                if (args.length === functions.flatMap.tsPlusOriginal.parameters.length - 1) {
                                    if (functions.flatMap.tsPlusOriginal.parameters[functions.flatMap.tsPlusOriginal.parameters.length - 1].escapedName === "___tsplusTrace") {
                                        if (traceInScope) {
                                            args.push(traceInScope);
                                        } else {
                                            args.push(getTrace(source, statement.expression.expression));
                                        }
                                    }
                                }
                                currentScope = [factory.createReturnStatement(produceTsPlusCallExpression(functions.flatMap, args, context, importer, source, sourceFileUniqueNames))];
                            }
                        }
                        else if (isReturnStatement(statement) && statement.expression && isCallExpression(statement.expression) && checker.getNodeLinks(statement).tsPlusDoBindType) {
                            isLast = false
                            currentScope = [factory.createReturnStatement(visitNode(statement.expression.arguments[0], visitor) as Expression)];
                        }
                        else {
                            currentScope.push(visitNode(statement, visitor) as Statement)
                        }
                    }
                    if (currentScope.length === 1 && isReturnStatement(currentScope[0]) && currentScope[0].expression) {
                        return currentScope[0].expression;
                    }
                    const mapper = factory.createArrowFunction(
                        undefined,
                        undefined,
                        [],
                        undefined,
                        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                        factory.createBlock(
                            currentScope.reverse(),
                            true
                        )
                    );
                    return factory.createCallExpression(
                        factory.createParenthesizedExpression(mapper),
                        undefined,
                        []
                    )
                }
            }
            return node;
        }
        function getArrowBody(currentScope: Statement[]): ConciseBody {
            return currentScope.length === 0
                ? factory.createVoidZero()
                : currentScope.length === 1 && isReturnStatement(currentScope[0]) && currentScope[0].expression
                    ? currentScope[0].expression
                    : factory.createBlock(currentScope.reverse(), true);
        }
        function visitCallExpressionOrFluentCallExpression(source: SourceFile, traceInScope: Identifier | undefined, node: CallExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
            if (checker.isPipeCall(node)) {
                return optimizePipe(visitNodes(node.arguments, visitor) as NodeArray<Expression>, context.factory, source);
            }
            if (checker.isTsPlusMacroCall(node, "identity")) {
                return optimizeIdentity(visitEachChild(node, visitor, context));
            }
            if (checker.isTsPlusMacroCall(node, "remove")) {
                return factory.createVoidZero();
            }
            if (checker.isTsPlusMacroCall(node, "Derive")) {
                return produceDerivation(checker.getNodeLinks(node).tsPlusDerivation, context, importer, source, sourceFileUniqueNames);
            }
            if (node.arguments.length === 1 && isCallExpression(node.expression)) {
                const optimizedPipeable = tryGetOptimizedPipeableCall(node.expression);
                if (optimizedPipeable) {
                    return createDataFirstCall(
                        node.expression,
                        [visitNode(node.arguments[0], visitor) as Expression, ...visitNodes(node.expression.arguments, visitor) as NodeArray<Expression>],
                        optimizedPipeable.definition,
                        optimizedPipeable.exportName,
                        source
                    );
                }
            }
            // Avoid transforming super call as __call extension
            if (isSuperCall(node)) {
                return visitCallExpression(source, traceInScope, node, visitor, context);
            }
            const nodeLinks = checker.getNodeLinks(node);
            if (nodeLinks.tsPlusDoFunctions && nodeLinks.tsPlusDoBindTypes && nodeLinks.tsPlusDoBindTypes.length > 0) {
                return visitDo(
                    source,
                    traceInScope,
                    node,
                    visitor,
                    context,
                    nodeLinks.tsPlusDoFunctions
                );
            }
            if (nodeLinks.tsPlusCallExtension) {
                const visited = visitCallExpression(source, traceInScope, node, visitor, context);
                if (isExpressionWithReferencedGlobalImport(visited.expression)) {
                    importer.remove(visited.expression.tsPlusReferencedGlobalImport);
                }
                return factory.updateCallExpression(
                    visited,
                    getPathOfExtension(context, importer, nodeLinks.tsPlusCallExtension, source, sourceFileUniqueNames, visited.expression),
                    visited.typeArguments,
                    visited.arguments
                );
            }
            if (nodeLinks.isFluentCall && nodeLinks.resolvedSignature) {
                let fluentExtension: TsPlusSignature | undefined;

                if (isTsPlusSignature(nodeLinks.resolvedSignature)) {
                    fluentExtension = nodeLinks.resolvedSignature;
                }
                else if (nodeLinks.resolvedSignature.target && isTsPlusSignature(nodeLinks.resolvedSignature.target)) {
                    fluentExtension = nodeLinks.resolvedSignature.target;
                }

                if (!fluentExtension) {
                    throw new Error("BUG: No fluent signature found for fluent extension");
                }

                if (fluentExtension.tsPlusDeclaration) {
                    const macroTags = checker.collectTsPlusMacroTags(fluentExtension.tsPlusDeclaration)

                    if (macroTags.find((tag) => tag === "pipe")) {
                        return optimizePipe(
                            visitNodes(factory.createNodeArray([simplyfy(node.expression), ...node.arguments], node.arguments.hasTrailingComma), visitor) as NodeArray<Expression>,
                            context.factory,
                            source
                        );
                    }
                }
                const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                if (isExpressionWithReferencedGlobalImport(visited.expression)) {
                    importer.remove(visited.expression.tsPlusReferencedGlobalImport);
                }
                const shouldMakeLazy = checker.getNodeLinks(node.expression).tsPlusLazy === true;
                if (fluentExtension.tsPlusPipeable) {
                    let expression = simplyfy(visited.expression);
                    if (shouldMakeLazy) {
                        expression = context.factory.createArrowFunction(
                            void 0,
                            void 0,
                            [],
                            void 0,
                            void 0,
                            expression
                        )
                    }
                    return factory.updateCallExpression(
                        visited,
                        setOriginalNode(
                            factory.createCallExpression(
                                getPathOfExtension(
                                    context,
                                    importer,
                                    { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName },
                                    source,
                                    sourceFileUniqueNames,
                                    visited.expression,
                                ),
                                undefined,
                                visited.arguments
                            ),
                            visited
                        ),
                        undefined,
                        [expression]
                    )
                }
                else {
                    let expression = simplyfy((visited as CallExpression).expression);
                    if (shouldMakeLazy) {
                        expression = context.factory.createArrowFunction(
                            void 0,
                            void 0,
                            [],
                            void 0,
                            void 0,
                            expression
                        )
                    }
                    return factory.updateCallExpression(
                        visited,
                        getPathOfExtension(
                            context,
                            importer,
                            { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName },
                            source,
                            sourceFileUniqueNames,
                            visited.expression,
                        ),
                        visited.typeArguments,
                        [expression, ...visited.arguments]
                    );
                }
            }
            if (isPropertyAccessExpression(node.expression) && checker.getNodeLinks(node.expression).isFluent && nodeLinks.resolvedSignature) {
                let fluentExtension: TsPlusSignature | undefined;
                if (isTsPlusSignature(nodeLinks.resolvedSignature)) {
                    fluentExtension = nodeLinks.resolvedSignature;
                }
                else if (nodeLinks.resolvedSignature.target && isTsPlusSignature(nodeLinks.resolvedSignature.target)) {
                    fluentExtension = nodeLinks.resolvedSignature.target;
                }
                if (!fluentExtension) {
                    throw new Error("BUG: No fluent signature found for fluent extension");
                }
                if (fluentExtension.tsPlusDeclaration) {
                    const macroTags = checker.collectTsPlusMacroTags(fluentExtension.tsPlusDeclaration)

                    if (macroTags.find((tag) => tag === "pipe")) {
                        return optimizePipe(
                            visitNodes(factory.createNodeArray([simplyfy(node.expression.expression), ...node.arguments], node.arguments.hasTrailingComma), visitor) as NodeArray<Expression>,
                            context.factory,
                            source
                        );
                    }
                }
                const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                if (isExpressionWithReferencedGlobalImport(visited.expression)) {
                    importer.remove(visited.expression.tsPlusReferencedGlobalImport);
                }
                const shouldMakeLazy = checker.getNodeLinks(node.expression.expression).tsPlusLazy === true;
                if (fluentExtension.tsPlusPipeable) {
                    let expression = simplyfy((visited.expression as PropertyAccessExpression).expression);
                    if (shouldMakeLazy) {
                        expression = context.factory.createArrowFunction(
                            void 0,
                            void 0,
                            [],
                            void 0,
                            void 0,
                            expression
                        )
                    }
                    return factory.updateCallExpression(
                        visited,
                        setOriginalNode(
                            factory.createCallExpression(
                                getPathOfExtension(
                                    context,
                                    importer,
                                    { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName },
                                    source,
                                    sourceFileUniqueNames,
                                    visited.expression,
                                ),
                                undefined,
                                visited.arguments
                            ),
                            visited,
                        ),
                        undefined,
                        [expression]
                    )
                }
                else {
                    let expression = simplyfy(((visited as CallExpression).expression as PropertyAccessExpression).expression);
                    if (shouldMakeLazy) {
                        expression = context.factory.createArrowFunction(
                            void 0,
                            void 0,
                            [],
                            void 0,
                            void 0,
                            expression
                        )
                    }
                    return factory.updateCallExpression(
                        visited as CallExpression,
                        getPathOfExtension(
                            context,
                            importer,
                            { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName },
                            source,
                            sourceFileUniqueNames,
                            visited.expression,
                        ),
                        (visited as CallExpression).typeArguments,
                        [expression, ...(visited as CallExpression).arguments]
                    );
                }
            }
            return visitCallExpression(source, traceInScope, node, visitor, context);;
        }
        function visitCallExpression(source: SourceFile, traceInScope: Identifier | undefined, node: CallExpression, visitor: Visitor, context: TransformationContext): CallExpression {
            const signature = checker.getResolvedSignature(node);
            if (signature) {
                const params = signature.parameters;
                const newArgs: Expression[] = [];
                for (let i = 0; i < Math.max(params.length, node.arguments.length); i++) {
                    if (i < node.arguments.length) {
                        if (i < params.length && checker.getNodeLinks(node.arguments[i]).tsPlusLazy === true) {
                            newArgs.push(
                                context.factory.createArrowFunction(
                                    void 0,
                                    void 0,
                                    [],
                                    void 0,
                                    void 0,
                                    visitNode(node.arguments[i], visitor) as Expression
                                )
                            );
                        } else {
                            newArgs.push(
                                visitNode(node.arguments[i], visitor) as Expression
                            );
                        }
                    } else {
                        const param = params[i];
                        if (param.valueDeclaration && (param.valueDeclaration as ParameterDeclaration).isAuto) {
                            newArgs.push(produceDerivation(checker.getNodeLinks(node).tsPlusParameterDerivations!.get(i)!, context, importer, source, sourceFileUniqueNames))
                        }
                    }
                }
                if (newArgs.length === params.length - 1) {
                    if (params[params.length - 1].escapedName === "___tsplusTrace") {
                        if (traceInScope) {
                            newArgs.push(traceInScope);
                        } else {
                            newArgs.push(getTrace(source, node.expression));
                        }
                    }
                }
                return context.factory.updateCallExpression(
                    node,
                    visitNode(node.expression, visitor) as Expression,
                    node.typeArguments ? visitNodes(node.typeArguments, visitor) as NodeArray<TypeNode> : void 0,
                    newArgs
                )
            }
            return visitEachChild(node, visitor, context);
        }
    }

    function produceTsPlusCallExpression(fn: TsPlusSignature, args: Expression[], context: TransformationContext, importer: TsPlusImporter, source: SourceFile, sourceFileUniqueNames: SourceFileUniqueNames) {
        const expr = getPathOfExtension(context, importer, { definition: fn.tsPlusFile, exportName: fn.tsPlusExportName }, source, sourceFileUniqueNames)
        return fn.tsPlusPipeable ? factory.createCallExpression(
            factory.createCallExpression(
                expr,
                undefined,
                args.slice(1)
            ),
            undefined,
            [args[0]]
        ) : factory.createCallExpression(
            expr,
            undefined,
            args
        );
    }

    function addSourceFileUniqueNamesVisitor(hoistedStatements: Array<Statement>, sourceFileUniqueNames: SourceFileUniqueNames, context: TransformationContext) {
        return function (node: Node): VisitResult<Node> {
            switch (node.kind) {
                case SyntaxKind.FunctionDeclaration: {
                    const declaration = node as FunctionDeclaration
                    if (declaration.name && declaration.body) {
                        const name = declaration.name.escapedText.toString()
                        if (sourceFileUniqueNames.has(name)) {
                            const uniqueName = sourceFileUniqueNames.get(name)!
                            if (uniqueName.isExported) {
                                hoistedStatements.push(
                                    context.factory.createVariableStatement(
                                        [context.factory.createModifier(SyntaxKind.ExportKeyword), context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                        context.factory.createVariableDeclarationList([
                                            context.factory.createVariableDeclaration(declaration.name, declaration.exclamationToken, undefined, uniqueName.name)
                                        ], NodeFlags.Const)
                                    )
                                );
                            }
                            return context.factory.updateFunctionDeclaration(
                                declaration,
                                filter(declaration.modifiers, (mod) => mod.kind !== SyntaxKind.ExportKeyword),
                                declaration.asteriskToken,
                                uniqueName.name,
                                declaration.typeParameters,
                                declaration.parameters,
                                declaration.type,
                                declaration.body
                            );
                        }
                    }
                    return node;
                }
                case SyntaxKind.VariableStatement: {
                    const variableStatement = node as VariableStatement;
                    const declaration = variableStatement.declarationList.declarations[0];
                    if (declaration && declaration.name && isIdentifier(declaration.name)) {
                        const name = declaration.name.escapedText.toString();
                        if (sourceFileUniqueNames.has(name)) {
                            const uniqueName = sourceFileUniqueNames.get(name)!;
                            const updated = [
                                context.factory.updateVariableStatement(
                                    variableStatement,
                                    filter((node as VariableStatement).modifiers, (mod) => mod.kind !== SyntaxKind.ExportKeyword),
                                    context.factory.updateVariableDeclarationList(variableStatement.declarationList, [
                                        context.factory.updateVariableDeclaration(
                                            declaration,
                                            uniqueName.name,
                                            declaration.exclamationToken,
                                            declaration.type,
                                            declaration.initializer
                                        ),
                                        ...variableStatement.declarationList.declarations.slice(1)
                                    ])
                                ),
                            ]
                            if (uniqueName.isExported) {
                                updated.push(
                                    context.factory.createVariableStatement(
                                        [context.factory.createModifier(SyntaxKind.ExportKeyword), context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                        context.factory.createVariableDeclarationList([
                                            context.factory.createVariableDeclaration(declaration.name, declaration.exclamationToken, undefined, uniqueName.name)
                                        ], NodeFlags.Const)
                                    )
                                );
                            }
                            return updated;
                        }
                    }
                    return node;
                }
                case SyntaxKind.ClassDeclaration: {
                    const classDeclaration = node as ClassDeclaration;
                    if (classDeclaration.name) {
                        const name = classDeclaration.name.escapedText.toString()
                        if (sourceFileUniqueNames.has(name)) {
                            const uniqueName = sourceFileUniqueNames.get(name)!;
                            const updated: Node[] = [
                                context.factory.updateClassDeclaration(
                                    classDeclaration,
                                    filter((node as ClassDeclaration).modifiers, (mod) => mod.kind !== SyntaxKind.ExportKeyword),
                                    uniqueName.name,
                                    classDeclaration.typeParameters,
                                    classDeclaration.heritageClauses,
                                    classDeclaration.members
                                ),
                                context.factory.createAssignment(
                                    context.factory.createPropertyAccessExpression(context.factory.createPropertyAccessExpression(uniqueName.name, context.factory.createIdentifier("constructor")), context.factory.createIdentifier('name')),
                                    context.factory.createStringLiteral(name)
                                )
                            ]
                            if (uniqueName.isExported) {
                                updated.push(
                                    context.factory.createVariableStatement(
                                        [context.factory.createModifier(SyntaxKind.ExportKeyword), context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                        context.factory.createVariableDeclarationList([
                                            context.factory.createVariableDeclaration(classDeclaration.name, undefined, undefined, uniqueName.name)
                                        ], NodeFlags.Const)
                                    )
                                );
                            }
                            return updated;
                        }
                    }
                    return node;
                }
                default: {
                    return node;
                }
            }
        }
    }

    function getPathOfGlobalImport(context: TransformationContext, importer: TsPlusImporter, identifier: Identifier, location: string) {
        const factory = context.factory;
        const id = importer.get(location);
        const node = factory.createPropertyAccessExpression(id, identifier);
        (node as ExpressionWithReferencedImport<PropertyAccessExpression>).tsPlusReferencedImport = location;
        (node as ExpressionWithReferencedGlobalImport<PropertyAccessExpression>).tsPlusReferencedGlobalImport = location;
        return node;
    }

    function isExportedWorker(declaration: Node): boolean {
        if (!(declaration as HasModifiers).modifiers) {
            return false;
        }
        return (declaration as HasModifiers).modifiers!.findIndex((mod) => mod.kind === SyntaxKind.ExportKeyword) !== -1
    }

    function isExported(declaration: Declaration): boolean {
        if (isVariableDeclaration(declaration) && declaration.parent && declaration.parent.parent) {
            return isExportedWorker(declaration.parent.parent);
        }
        return isExportedWorker(declaration);
    }

    function getPathOfImplicitOrRule(context: TransformationContext, importer: TsPlusImporter, implicitOrRule: Declaration, source: SourceFile, sourceFileUniqueNames: SourceFileUniqueNames) {
        const factory = context.factory;
        const sourceExtension = getSourceFileOfNode(implicitOrRule);
        // TODO(Mike): carry over proper export name don't rely on the symbol of the declaration being exported
        const exportName = implicitOrRule.symbol.escapedName as string;
        if (source.fileName === sourceExtension.fileName) {
            return sourceFileUniqueNames.get(exportName, isExported(implicitOrRule)).name;
        }
        let path: string | undefined;
        const locationTag = getAllJSDocTags(implicitOrRule, (tag): tag is JSDocTag => tag.tagName.escapedText === "tsplus" && tag.comment?.toString().startsWith("location") === true)[0];
        if (locationTag) {
            const match = locationTag.comment!.toString().match(/^location "(.*)"/);
            if (match) {
                path = match[1]
            }
        }
        if (!path) {
            path = getImportLocation(fileMap, sourceExtension.fileName);
        }
        const id = importer.get(path);
        const node = factory.createPropertyAccessExpression(
            id,
            factory.createIdentifier(exportName)
        );
        (node as ExpressionWithReferencedImport<PropertyAccessExpression>).tsPlusReferencedImport = path;
        return node;
    }

    function getPathOfExtension(context: TransformationContext, importer: TsPlusImporter, extension: { definition: SourceFile; exportName: string; }, source: SourceFile, sourceFileUniqueNames: SourceFileUniqueNames, original?: Node) {
        const factory = context.factory;
        if (source.fileName === extension.definition.fileName) {
            return sourceFileUniqueNames.get(extension.exportName).name;
        }

        const def = extension.definition.locals!.get(extension.exportName as __String)!
        let path: string | undefined;
        for (const decl of def.declarations!) {
            const locationTag = getAllJSDocTags(decl, (tag): tag is JSDocTag => tag.tagName.escapedText === "tsplus" && tag.comment?.toString().startsWith("location") === true)[0];
            if (locationTag) {
                const match = locationTag.comment!.toString().match(/^location "(.*)"/);
                if (match) {
                    path = match[1]
                }
            }
        }

        if (!path) {
            path = getImportLocation(fileMap, extension.definition.fileName);
        }

        const id = importer.get(path);

        const identifier = factory.createIdentifier(extension.exportName);
        if (original && isPropertyAccessExpression(original)) {
            setOriginalNode(identifier, original.name);
        }

        const node = factory.createPropertyAccessExpression(id, identifier);

        (node as ExpressionWithReferencedImport<PropertyAccessExpression>).tsPlusReferencedImport = path;
        setOriginalNode(node, original);

        return node;
    }
}

type ExpressionWithReferencedImport<T extends Expression = Expression> = T & { tsPlusReferencedImport: string };

function isExpressionWithReferencedImport(node: Expression): node is ExpressionWithReferencedImport {
    return !!(node as ExpressionWithReferencedImport).tsPlusReferencedImport;
}

type ExpressionWithReferencedGlobalImport<T extends Expression = Expression> = T & { tsPlusReferencedGlobalImport: string };

function isExpressionWithReferencedGlobalImport(node: Expression): node is ExpressionWithReferencedGlobalImport {
    return !!(node as ExpressionWithReferencedGlobalImport).tsPlusReferencedGlobalImport;
}
