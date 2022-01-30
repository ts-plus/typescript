/*@internal*/
namespace ts {
    class TsPlusImporter {
        readonly imports: ESMap<string, Identifier> = new Map();
        constructor(readonly factory: NodeFactory) { }

        get(path: string): Identifier {
            if (!this.imports.has(path)) {
                this.imports.set(path, this.factory.createUniqueName("tsplus_module"));
            }
            return this.imports.get(path)!;
        }
    }
    export function transformTsPlus(checker: TypeChecker, options: CompilerOptions, host: CompilerHost) {
        return function (context: TransformationContext) {
            const importer = new TsPlusImporter(context.factory);
            const fileVar = factory.createUniqueName("fileName");
            let fileVarUsed = false;
            return chainBundle(context, transformSourceFile);
            function transformSourceFile(node: SourceFile) {
                if (node.isDeclarationFile) {
                    return node;
                }

                const transformed = visitEachChild(node, visitor(node, void 0), context)

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
                                        (options.tsPlusTracingPackageName ? options.tsPlusTracingPackageName + ":" : "") +
                                        (options.configFilePath ? getRelativePathFromFile(options.configFilePath, node.fileName, host.getCanonicalFileName).replace(/^\.(\\|\/)/, "") : node.fileName)
                                    )
                                )
                            ],
                            ts.NodeFlags.Const
                        )
                    )
                ] : [];
                return context.factory.updateSourceFile(
                    transformed,
                    [...fileVarDef, ...imports, ...transformed.statements],
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
                        case SyntaxKind.BinaryExpression:
                            return visitBinaryExpression(source, traceInScope, node as BinaryExpression, context)
                        case SyntaxKind.FunctionDeclaration:
                            return visitFunctionDeclaration(source, traceInScope, node as FunctionDeclaration, context);
                        case SyntaxKind.PropertyAccessExpression:
                            return visitPropertyAccessExpression(source, node as PropertyAccessExpression, visitor(source, traceInScope), context);
                        case SyntaxKind.CallExpression:
                            return visitCallExpressionOrFluentCallExpression(source, traceInScope, node as CallExpression, visitor(source, traceInScope), context);
                        default:
                            return visitEachChild(node, visitor(source, traceInScope), context);
                    }
                }
            }
            function visitBinaryExpression(source: SourceFile, traceInScope: Identifier | undefined, node: BinaryExpression, context: TransformationContext): VisitResult<Node> {
                const leftType = checker.getTypeAtLocation(node.left);
                const operator = checker.getOperatorExtension(leftType, getTextOfNode(node.operatorToken, false));

                if (operator) {
                    const type = checker.getTypeOfSymbol(operator.patched)
                    const call = checker.getSignaturesOfType(type, SignatureKind.Call)[0];
                    const lastTrace = call.parameters.length > 0 ? call.parameters[call.parameters.length - 1].escapedName === "___tsplusTrace" : false
                    const params = [visitNode(node.left, visitor(source, traceInScope)), visitNode(node.right, visitor(source, traceInScope))]
                    if (checker.shouldMakeLazy(call.parameters[1], checker.getTypeAtLocation(node.right))) {
                        params[1] = context.factory.createArrowFunction(void 0, void 0, [], void 0, void 0, params[1]);
                    }
                    if (lastTrace) {
                        params.push(traceInScope ? traceInScope : getTrace(source, node.operatorToken))
                    }
                    return context.factory.createCallExpression(
                        getPathOfExtension(context.factory, importer, operator, source),
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
                const expressionType = checker.getTypeAtLocation(node.expression);
                const inType = checker.getPropertyOfType(expressionType, node.name.escapedText.toString());
                if (!inType) {
                    const staticExtension = checker.getStaticExtension(expressionType, node.name.escapedText.toString());

                    if (staticExtension) {
                        return getPathOfExtension(context.factory, importer, staticExtension, source);
                    }
                    
                    const getterExtension = checker.getGetterExtension(expressionType, node.name.escapedText.toString());

                    if (getterExtension) {
                        return factory.createCallExpression(
                            getPathOfExtension(context.factory, importer, getterExtension, source),
                            void 0,
                            [visitNode(node.expression, visitor)]
                        );
                    }
                }
                return visitEachChild(node, visitor, context);
            }
            function optimisePipe(
                args: NodeArray<ts.Expression>,
                factory: ts.NodeFactory
            ): ts.Expression {
                return args
                    .slice(1)
                    .reduce(
                        (currentNode, memberNode) =>
                            factory.createCallExpression(memberNode, undefined, [currentNode]),
                        args[0]!
                    )
            }
            function visitCallExpressionOrFluentCallExpression(source: SourceFile, traceInScope: Identifier | undefined, node: CallExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
                if (checker.isPipeCall(node)) {
                    return optimisePipe(visitNodes(node.arguments, visitor), context.factory)
                }
                const expressionType = checker.getTypeAtLocation(node.expression)
                if (checker.getSignaturesOfType(expressionType, SignatureKind.Call).length === 0) {
                    const customCall = checker.getStaticExtension(expressionType, "__call")
                    if (customCall) {
                        const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                        return factory.updateCallExpression(
                            visited as CallExpression,
                            getPathOfExtension(context.factory, importer, customCall, source),
                            (visited as CallExpression).typeArguments,
                            (visited as CallExpression).arguments
                        );
                    }
                }
                if (isPropertyAccessExpression(node.expression)) {
                    const innerExpressionType = checker.getTypeAtLocation((node.expression as PropertyAccessExpression).expression);
                    const inType = checker.getPropertyOfType(innerExpressionType, (node.expression as PropertyAccessExpression).name.escapedText.toString());
                    if (!inType) {
                        const fluentExtension = checker.getFluentExtension(innerExpressionType, (node.expression as PropertyAccessExpression).name.escapedText.toString());

                        if (fluentExtension) {
                            const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                            return factory.updateCallExpression(
                                visited as CallExpression,
                                getPathOfExtension(context.factory, importer, fluentExtension, source),
                                (visited as CallExpression).typeArguments,
                                [((visited as CallExpression).expression as PropertyAccessExpression).expression, ...(visited as CallExpression).arguments]
                            );
                        }
                    }
                }
                return visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;;
            }
            function visitCallExpression(source: SourceFile, traceInScope: Identifier | undefined, node: CallExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
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
        function getPathOfExtension(factory: NodeFactory, importer: TsPlusImporter, extension: { definition: SourceFile; exportName: string; }, source: SourceFile) {
            if (source.fileName === extension.definition.fileName) {
                return factory.createIdentifier(extension.exportName);
            }

            const id = importer.get(extension.definition.isDeclarationFile ? checker.getGlobalImport(extension.definition) : checker.getLocalImport(source, extension.definition));

            return factory.createPropertyAccessExpression(
                id,
                factory.createIdentifier(extension.exportName)
            )
        }
    }
}
