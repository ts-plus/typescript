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
                        default:
                            return visitEachChild(node, visitor(source, traceInScope), context);
                    }
                }
            }
            function visitElementAccessExpression(source: SourceFile, traceInScope: Identifier | undefined, node: ElementAccessExpression, context: TransformationContext): VisitResult<Node> {
                const custom = checker.getIndexAccessExpressionCache().get(node)
                if (custom) {
                    const expression = visitNode(node.expression, visitor(source, traceInScope))
                    const argument = visitNode(node.argumentExpression, visitor(source, traceInScope))
                    return context.factory.createCallExpression(
                        getPathOfExtension(context.factory, importer, custom, source),
                        [],
                        [expression, argument]
                    )
                }
                return visitEachChild(node, visitor(source, traceInScope), context)
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
                    const staticFunctionExtension = checker.getStaticFunctionExtension(expressionType, node.name.escapedText.toString());

                    if (staticFunctionExtension) {
                        return getPathOfExtension(context.factory, importer, staticFunctionExtension, source);
                    }

                    const staticValueExtension = checker.getStaticValueExtension(expressionType, node.name.escapedText.toString());

                    if (staticValueExtension) {
                        return getPathOfExtension(context.factory, importer, staticValueExtension, source);
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
            function visitVariableStatement(_source: SourceFile, node: VariableStatement, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
                if (node.declarationList && node.declarationList.declarations.length > 0) {
                    const declaration = node.declarationList.declarations[0]
                    if(declaration.initializer && checker.isTsPlusMacroCall(declaration.initializer, 'pipeable') && isIdentifier(declaration.name)) {
                        return transformPipeable(declaration as VariableDeclaration & { name: Identifier, initializer: CallExpression })
                    }
                }
                return ts.visitEachChild(node, visitor, context)
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
            function transformPipeable(node: VariableDeclaration & { name: Identifier, initializer: CallExpression }): Node {
                const type = checker.getTypeAtLocation(node)
                const signatures = checker.getSignaturesOfType(type, SignatureKind.Call)
                if (signatures.length) {
                    const signature = signatures[0]
                    const signatureDeclaration = checker.signatureToSignatureDeclaration(
                        signature,
                        SyntaxKind.FunctionDeclaration,
                        undefined,
                        undefined
                    )
                    if (signatureDeclaration && signatureDeclaration.type && isFunctionTypeNode(signatureDeclaration.type)) {
                        const returnType = signatureDeclaration.type
                        return factory.createVariableStatement(
                            [factory.createModifier(SyntaxKind.ExportKeyword)],
                            factory.createVariableDeclarationList([
                                factory.createVariableDeclaration(
                                    node.name,
                                    undefined,
                                    undefined,
                                    factory.createArrowFunction(
                                        undefined,
                                        signatureDeclaration.typeParameters,
                                        signatureDeclaration.parameters,
                                        signatureDeclaration.type,
                                        undefined,
                                        factory.createArrowFunction(
                                            undefined,
                                            returnType.typeParameters,
                                            returnType.parameters,
                                            returnType.type,
                                            undefined,
                                            factory.createCallExpression(
                                                node.initializer.arguments[0],
                                                undefined,
                                                [
                                                    ...map(signatureDeclaration.type.parameters, (pdecl) => pdecl.name as Identifier),
                                                    ...map(signatureDeclaration.parameters, (pdecl) => pdecl.name as Identifier)
                                                ]
                                            )
                                        )
                                    )
                                )
                            ])
                        )
                    }
                }
                return node;
            }
            function visitCallExpressionOrFluentCallExpression(source: SourceFile, traceInScope: Identifier | undefined, node: CallExpression, visitor: Visitor, context: TransformationContext): VisitResult<Node> {
                if (checker.isPipeCall(node)) {
                    return optimisePipe(visitNodes(node.arguments, visitor), context.factory)
                }
                const expressionType = checker.getTypeAtLocation(node.expression)
                if (checker.getSignaturesOfType(expressionType, SignatureKind.Call).length === 0) {
                    const customCall = checker.getStaticFunctionExtension(expressionType, "__call")
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
                            let targetSignature: Signature = fluentExtension.signatures[0];

                            if (fluentExtension.signatures.length > 1) {
                                const resolvedSignature = checker.getResolvedSignature(node);
                                if (resolvedSignature) {
                                    // For signatures with type arguments, TsPlusSignature will be signature.target.
                                    // For signatures without type arguments, TsPlusSignature is the signature itself.
                                    if (isTsPlusSignature(resolvedSignature)) {
                                        targetSignature = resolvedSignature
                                    }
                                    else if (resolvedSignature.target && isTsPlusSignature(resolvedSignature.target)) {
                                        targetSignature = resolvedSignature.target
                                    }
                                }
                            }

                            if (!targetSignature || !isTsPlusSignature(targetSignature)) {
                                throw new Error("BUG: No applicable signature found for fluent extension");
                            }
                            
                            const visited = visitCallExpression(source, traceInScope, node as CallExpression, visitor, context) as CallExpression;
                            return factory.updateCallExpression(
                                visited as CallExpression,
                                getPathOfExtension(context.factory, importer, { definition: targetSignature.tsPlusFile, exportName: targetSignature.tsPlusExportName }, source),
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
