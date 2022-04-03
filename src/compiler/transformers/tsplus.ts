/*@internal*/
namespace ts {
    class TsPlusImporter {
        readonly imports: ESMap<string, Identifier> = new Map();
        readonly refCount: ESMap<string, number> = new Map();
        constructor(readonly factory: NodeFactory) { }

        get(path: string): Identifier {
            if (!this.imports.has(path)) {
                this.imports.set(path, this.factory.createUniqueName("tsplus_module"));
            }
            this.refCount.set(path, (this.refCount.get(path) ?? 0) + 1);
            return this.imports.get(path)!;
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
    export function transformTsPlus(checker: TypeChecker, options: CompilerOptions, host: CompilerHost) {
        const fileMap: [string, RegExp][] = getFileMap(options, host);
        const traceMap: [string, RegExp][] = getTraceMap(options, host);
        return function (context: TransformationContext) {
            const importer = new TsPlusImporter(context.factory);
            const localUniqueExtensionNames = new Map<string, Identifier>();
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
                    addUniqueLocalExtensionsVisitor(uniqueDeclarations, localUniqueExtensionNames, context),
                    context
                )

                localUniqueExtensionNames.clear();

                const imports: Statement[] = []
                importer.imports.forEach((id, path) => {
                    imports.push(
                        factory.createImportDeclaration(
                            undefined,
                            undefined,
                            factory.createImportClause(
                                false,
                                undefined,
                                factory.createNamespaceImport(id)
                            ),
                            factory.createStringLiteral(path),
                            undefined
                        )
                    );
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
                            return visitPropertyAccessExpression(source, node as PropertyAccessExpression, visitor(source, traceInScope), context);
                        case SyntaxKind.CallExpression:
                            return visitCallExpressionOrFluentCallExpression(source, traceInScope, node as CallExpression, visitor(source, traceInScope), context);
                        case SyntaxKind.VariableStatement:
                            return visitVariableStatement(source, node as VariableStatement, visitor(source, traceInScope), context)
                        case SyntaxKind.Identifier:
                            return visitIdentifier(source, traceInScope, node as Identifier, context);
                        default:
                            return visitEachChild(node, visitor(source, traceInScope), context);
                    }
                }
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
                            if (localUniqueExtensionNames.has(name)) {
                                return localUniqueExtensionNames.get(name)!;
                            }
                            else {
                                const uniqueName = context.factory.createTsPlusUniqueName(node.escapedText.toString());
                                localUniqueExtensionNames.set(name, uniqueName);
                                return uniqueName;
                            }
                        }
                        const { tsPlusGlobalIdentifier } = checker.getNodeLinks(node);
                        const globalImport = checker.getTsPlusGlobal(node.escapedText.toString());
                        if (tsPlusGlobalIdentifier && globalImport) {
                            return getPathOfGlobalImport(context, importer, node, globalImport.location)
                        }
                    }
                }
                return visitEachChild(node, visitor(source, traceInScope), context);
            }
            function visitElementAccessExpression(source: SourceFile, traceInScope: Identifier | undefined, node: ElementAccessExpression, context: TransformationContext): VisitResult<Node> {
                const custom = checker.getIndexAccessExpressionCache().get(node)
                if (custom) {
                    const expression = visitNode(node.expression, visitor(source, traceInScope))
                    const argument = visitNode(node.argumentExpression, visitor(source, traceInScope))
                    return context.factory.createCallExpression(
                        getPathOfExtension(context, importer, custom, source, localUniqueExtensionNames),
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
                    const declaration = call.declaration!;
                    const exportName = isFunctionDeclaration(declaration) ? declaration.symbol.escapedName as string : declaration.parent.symbol.escapedName as string;
                    const lastTrace = call.parameters.length > 0 ? call.parameters[call.parameters.length - 1].escapedName === "___tsplusTrace" : false
                    const params = [visitNode(node.left, visitor(source, traceInScope)), visitNode(node.right, visitor(source, traceInScope))]
                    if (checker.shouldMakeLazy(call.parameters[1], checker.getTypeAtLocation(node.right))) {
                        params[1] = context.factory.createArrowFunction(void 0, void 0, [], void 0, void 0, params[1]);
                    }
                    if (lastTrace) {
                        params.push(traceInScope ? traceInScope : getTrace(source, node.operatorToken))
                    }
                    return context.factory.createCallExpression(
                        getPathOfExtension(context, importer, {
                            definition: getSourceFileOfNode(declaration),
                            exportName: exportName
                        }, source, localUniqueExtensionNames),
                        [],
                        params
                    )
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
            function visitPropertyAccessExpression(source: SourceFile, node: PropertyAccessExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
                const nodeLinks = checker.getNodeLinks(node);
                if (nodeLinks.tsPlusStaticExtension) {
                    return getPathOfExtension(context, importer, nodeLinks.tsPlusStaticExtension, source, localUniqueExtensionNames)
                }
                if (nodeLinks.tsPlusGetterExtension) {
                    return factory.createCallExpression(
                        getPathOfExtension(context, importer, nodeLinks.tsPlusGetterExtension, source, localUniqueExtensionNames),
                        void 0,
                        [simplyfy(visitNode(node.expression, visitor))]
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
                        localUniqueExtensionNames
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
            function visitCallExpressionOrFluentCallExpression(source: SourceFile, traceInScope: Identifier | undefined, node: CallExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
                if (checker.isPipeCall(node)) {
                    return optimizePipe(visitNodes(node.arguments, visitor), context.factory, source);
                }
                if (checker.isTsPlusMacroCall(node, "identity")) {
                    return optimizeIdentity(visitEachChild(node, visitor, context));
                }
                if (checker.isTsPlusMacroCall(node, "remove")) {
                    return factory.createVoidZero()
                }
                if (node.arguments.length === 1 && isCallExpression(node.expression)) {
                    const optimizedPipeable = tryGetOptimizedPipeableCall(node.expression);
                    if (optimizedPipeable) {
                        return createDataFirstCall(
                            node.expression,
                            [visitNode(node.arguments[0], visitor), ...visitNodes(node.expression.arguments, visitor)],
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
                if (nodeLinks.tsPlusCallExtension) {
                    const visited = visitCallExpression(source, traceInScope, node, visitor, context);
                    if (isExpressionWithReferencedGlobalImport(visited.expression)) {
                        importer.remove(visited.expression.tsPlusReferencedGlobalImport);
                    }
                    return factory.updateCallExpression(
                        visited,
                        getPathOfExtension(context, importer, nodeLinks.tsPlusCallExtension, source, localUniqueExtensionNames),
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

                        if (macroTags.find((tag) => tag.comment === "macro pipe")) {
                            return optimizePipe(
                                visitNodes(factory.createNodeArray([simplyfy(node.expression), ...node.arguments], node.arguments.hasTrailingComma), visitor),
                                context.factory,
                                source
                            );
                        }
                    }
                    const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                    if (isExpressionWithReferencedGlobalImport(visited.expression)) {
                        importer.remove(visited.expression.tsPlusReferencedGlobalImport);
                    }
                    if (fluentExtension.tsPlusPipeable) {
                        return factory.updateCallExpression(
                            visited,
                            factory.createCallExpression(
                                getPathOfExtension(context, importer, { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName }, source, localUniqueExtensionNames),
                                undefined,
                                visited.arguments
                            ),
                            undefined,
                            [simplyfy(visited.expression)]
                        )
                    }
                    else {
                        return factory.updateCallExpression(
                            visited as CallExpression,
                            getPathOfExtension(context, importer, { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName }, source, localUniqueExtensionNames),
                            (visited as CallExpression).typeArguments,
                            [simplyfy((visited as CallExpression).expression), ...(visited as CallExpression).arguments]
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

                        if (macroTags.find((tag) => tag.comment === "macro pipe")) {
                            return optimizePipe(
                                visitNodes(factory.createNodeArray([simplyfy(node.expression.expression), ...node.arguments], node.arguments.hasTrailingComma), visitor),
                                context.factory,
                                source
                            );
                        }
                    }
                    const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                    if (isExpressionWithReferencedGlobalImport(visited.expression)) {
                        importer.remove(visited.expression.tsPlusReferencedGlobalImport);
                    }
                    if (fluentExtension.tsPlusPipeable) {
                        return factory.updateCallExpression(
                            visited,
                            factory.createCallExpression(
                                getPathOfExtension(context, importer, { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName }, source, localUniqueExtensionNames),
                                undefined,
                                visited.arguments
                            ),
                            undefined,
                            [simplyfy((visited.expression as PropertyAccessExpression).expression)]
                        )
                    }
                    else {
                        return factory.updateCallExpression(
                            visited as CallExpression,
                            getPathOfExtension(context, importer, { definition: fluentExtension.tsPlusFile, exportName: fluentExtension.tsPlusExportName }, source, localUniqueExtensionNames),
                            (visited as CallExpression).typeArguments,
                            [simplyfy(((visited as CallExpression).expression as PropertyAccessExpression).expression), ...(visited as CallExpression).arguments]
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
                            if (i < params.length && checker.shouldMakeLazy(params[i], checker.getTypeAtLocation(node.arguments[i]))) {
                                newArgs.push(
                                    context.factory.createArrowFunction(
                                        void 0,
                                        void 0,
                                        [],
                                        void 0,
                                        void 0,
                                        visitNode(node.arguments[i], visitor)
                                    )
                                );
                            } else {
                                newArgs.push(
                                    visitNode(node.arguments[i], visitor)
                                );
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
                        visitNode(node.expression, visitor),
                        node.typeArguments ? visitNodes(node.typeArguments, visitor) : void 0,
                        newArgs
                    )
                }
                return visitEachChild(node, visitor, context);
            }
        }
        function addUniqueLocalExtensionsVisitor(hoistedStatements: Array<Statement>, localUniqueExtensionNames: ESMap<string, Identifier>, context: TransformationContext) {
            return function (node: Node): VisitResult<Node> {
                switch (node.kind) {
                    case SyntaxKind.FunctionDeclaration: {
                        const declaration = node as FunctionDeclaration
                        if (declaration.name && declaration.body) {
                            const name = declaration.name.escapedText.toString()
                            if (localUniqueExtensionNames.has(name)) {
                                const uniqueIdentifier = localUniqueExtensionNames.get(name)!
                                hoistedStatements.push(
                                    context.factory.createVariableStatement(
                                        [context.factory.createModifier(SyntaxKind.ExportKeyword), context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                        context.factory.createVariableDeclarationList([
                                            context.factory.createVariableDeclaration(declaration.name, declaration.exclamationToken, undefined, uniqueIdentifier)
                                        ], NodeFlags.Const)
                                    )
                                );
                                return context.factory.updateFunctionDeclaration(
                                    declaration,
                                    declaration.decorators,
                                    filter(declaration.modifiers, (mod) => mod.kind !== SyntaxKind.ExportKeyword),
                                    declaration.asteriskToken,
                                    uniqueIdentifier,
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
                            if (localUniqueExtensionNames.has(name)) {
                                const uniqueIdentifier = localUniqueExtensionNames.get(name)!;
                                return [
                                    context.factory.updateVariableStatement(
                                        variableStatement,
                                        filter(node.modifiers, (mod) => mod.kind !== SyntaxKind.ExportKeyword),
                                        context.factory.createVariableDeclarationList([
                                            context.factory.updateVariableDeclaration(
                                                declaration,
                                                uniqueIdentifier,
                                                declaration.exclamationToken,
                                                declaration.type,
                                                declaration.initializer
                                            ),
                                            ...variableStatement.declarationList.declarations.slice(1)
                                        ], NodeFlags.Const)
                                    ),
                                    context.factory.createVariableStatement(
                                        [context.factory.createModifier(SyntaxKind.ExportKeyword), context.factory.createModifier(SyntaxKind.ConstKeyword)],
                                        context.factory.createVariableDeclarationList([
                                            context.factory.createVariableDeclaration(declaration.name, declaration.exclamationToken, undefined, uniqueIdentifier)
                                        ], NodeFlags.Const)
                                    )
                                ];
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

        function getPathOfExtension(context: TransformationContext, importer: TsPlusImporter, extension: { definition: SourceFile; exportName: string; }, source: SourceFile, localUniqueExtensionNames: ESMap<string, Identifier>) {
            const factory = context.factory;
            if (source.fileName === extension.definition.fileName) {
                if (localUniqueExtensionNames.has(extension.exportName)) {
                    return localUniqueExtensionNames.get(extension.exportName)!;
                }
                const uniqueIdentifier = factory.createTsPlusUniqueName(extension.exportName);
                localUniqueExtensionNames.set(extension.exportName, uniqueIdentifier);
                return uniqueIdentifier;
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

            const node = factory.createPropertyAccessExpression(
                id,
                factory.createIdentifier(extension.exportName)
            );

            (node as ExpressionWithReferencedImport<PropertyAccessExpression>).tsPlusReferencedImport = path;
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
}
