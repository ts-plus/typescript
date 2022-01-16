/*@internal*/
namespace ts {
    class TsPlusGlobalTypeImporter {
        readonly imports: ESMap<string, Set<string>> = new Map();
        add(path: string, name: string): void {
            if (!this.imports.has(path)) {
                this.imports.set(path, new Set());
            }
            const names = this.imports.get(path)!;
            names.add(name);
        }
        has(path: string, name: string): boolean {
            if (!this.imports.has(path)) {
                return false;
            }
            return this.imports.get(path)!.has(name);
        }
    }

    export function transformTsPlusDeclaration(checker: TypeChecker, options: CompilerOptions, host: CompilerHost) {
        const fileMap: [string, RegExp][] = getFileMap(options, host);
        
        return function (context: TransformationContext) {
            const importer = new TsPlusGlobalTypeImporter();
            return chainBundle(context, transformSourceFile);
            function transformSourceFile(node: SourceFile) {
                if (node.isDeclarationFile) {
                    return node;
                }

                visitEachChild(node, visitor(node), context);
                visitEachChild(node, importVisitor, context);

                const imports: ImportDeclaration[] = []
                importer.imports.forEach((names, path) => {
                    imports.push(
                        factory.createImportDeclaration(
                            undefined,
                            undefined,
                            factory.createImportClause(
                                false,
                                undefined,
                                factory.createNamedImports(arrayFrom(mapIterator(names.values(), (name) =>
                                    factory.createImportSpecifier(false, undefined, factory.createIdentifier(name))
                                )))
                            ),
                            factory.createStringLiteral(path),
                            undefined
                        )
                    );
                });

                node.tsPlusGlobalImports = imports;
                return node;
            }
            function isTransformable(node: Node): boolean {
                const nodeLinks = checker.getNodeLinks(node);
                return !!nodeLinks.tsPlusCallExtension ||
                    !!nodeLinks.tsPlusGetterExtension ||
                    !!nodeLinks.tsPlusOptimizedDataFirst ||
                    !!nodeLinks.tsPlusStaticExtension ||
                    !!nodeLinks.isTsPlusOperatorToken ||
                    !!nodeLinks.isFluent
            }
            function importVisitor(node: Node): VisitResult<Node> {
                if (node.kind === SyntaxKind.Identifier) {
                    if (!isTransformable(node)) {
                        const { tsPlusGlobalIdentifier } = checker.getNodeLinks(node);
                        const name = (node as Identifier).escapedText as string;
                        const globalImport = checker.getTsPlusGlobal(name);
                        if (tsPlusGlobalIdentifier && globalImport && !importer.has(globalImport.location, name)) {
                            if (isPartOfTypeNode(node) || isPartOfTypeQuery(node)) {
                                importer.add(globalImport.location, name);
                            }
                        }
                    }
                }
                else {
                    visitEachChild(node, importVisitor, context);
                }
                return node;
            }
            function visitor(source: SourceFile) {
                return function (node: Node): VisitResult<Node> {
                    switch (node.kind) {
                        case SyntaxKind.VariableStatement:
                            return visitVariableStatement(source, node as VariableStatement, visitor(source), context)
                        case SyntaxKind.FunctionDeclaration:
                            return visitFunctionDeclaration(source, node as FunctionDeclaration, visitor(source), context)
                        default:
                            return node;
                    }
                }
            }
            function visitFunctionDeclaration(_source: SourceFile, node: FunctionDeclaration, _visitor: Visitor, _context: TransformationContext): VisitResult<Node> {
                if (checker.hasExportedPlusTags(node)) {
                    const emitNode = getOrCreateEmitNode(node);
                    if (!emitNode.tsPlusLocationComment) {
                        const existingJsDoc = node.jsDoc?.[0] ?? factory.createJSDocComment()
                        const existingTags = existingJsDoc.tags ?? factory.createNodeArray()
                        const newJsDoc = factory.createJSDocComment(
                            existingJsDoc.comment,
                            existingTags.concat([
                                factory.createJSDocUnknownTag(
                                    factory.createIdentifier("tsplus"),
                                    `location "${getImportLocation(fileMap, getSourceFileOfNode(node).fileName)}"`
                                )
                            ])
                        )
                        const newCommentText = createPrinter()
                            .printNode(EmitHint.Unspecified, newJsDoc, getSourceFileOfNode(node))
                            .trim()
                            .replace(/^\/\*|\*\/$/g, "")
                        removeAllComments(node);
                        node.original && removeAllComments(node.original);
                        setSyntheticLeadingComments(node, [{
                            pos: -1,
                            end: -1,
                            text: newCommentText,
                            kind: SyntaxKind.MultiLineCommentTrivia,
                            hasTrailingNewLine: true
                        }]);
                        emitNode.tsPlusLocationComment = true;
                    }
                }
                return node;
            }
            function visitVariableStatement(_source: SourceFile, node: VariableStatement, _visitor: Visitor, _context: TransformationContext): VisitResult<Node> {
                if (node.declarationList.declarations.length > 0) {
                    const declaration = node.declarationList.declarations[0];
                    if (declaration.initializer && checker.isTsPlusMacroCall(declaration.initializer, 'pipeable') && isIdentifier(declaration.name)) {
                        const targetType = checker.getTypeAtLocation(declaration.initializer.arguments[0])
                        if (targetType.symbol && targetType.symbol.valueDeclaration && isFunctionLikeDeclaration(targetType.symbol.valueDeclaration)) {
                            const signatureDeclaration = targetType.symbol.valueDeclaration
                            const signatureFluentTags = checker.collectTsPlusFluentTags(signatureDeclaration)
                            if (signatureFluentTags.length > 0) {
                                const { target, name } = signatureFluentTags[0]
                                const existingJsDoc = node.jsDoc?.[0] ?? factory.createJSDocComment()
                                const existingTags = existingJsDoc.tags ?? factory.createNodeArray()
                                const newJsDoc = factory.createJSDocComment(
                                    existingJsDoc.comment,
                                    existingTags.concat([
                                        factory.createJSDocUnknownTag(
                                            factory.createIdentifier("tsplus"),
                                            `pipeable ${target} ${name}`
                                        ),
                                        factory.createJSDocUnknownTag(
                                            factory.createIdentifier("tsplus"),
                                            `location "${getImportLocation(fileMap, getSourceFileOfNode(node).fileName)}"`
                                        )
                                    ])
                                );
                                const newCommentText = createPrinter()
                                    .printNode(EmitHint.Unspecified, newJsDoc, getSourceFileOfNode(node))
                                    .trim()
                                    .replace(/^\/\*|\*\/$/g, "")
                                removeAllComments(node);
                                node.original && removeAllComments(node.original);
                                setSyntheticLeadingComments(node, [{
                                    pos: -1,
                                    end: -1,
                                    text: newCommentText,
                                    kind: SyntaxKind.MultiLineCommentTrivia,
                                    hasTrailingNewLine: true
                                }]);
                                getOrCreateEmitNode(node).tsPlusPipeableComment = true;
                                getOrCreateEmitNode(node).tsPlusLocationComment = true;
                            }
                        }
                    } else {
                        const declaration = node.declarationList.declarations[0];
                        if (checker.hasExportedPlusTags(declaration)) {
                            const emitNode = getOrCreateEmitNode(node);
                            if (!emitNode.tsPlusLocationComment) {
                                const existingJsDoc = node.jsDoc?.[0] ?? factory.createJSDocComment()
                                const existingTags = existingJsDoc.tags ?? factory.createNodeArray()
                                const newJsDoc = factory.createJSDocComment(
                                    existingJsDoc.comment,
                                    existingTags.concat([
                                        factory.createJSDocUnknownTag(
                                            factory.createIdentifier("tsplus"),
                                            `location "${getImportLocation(fileMap, getSourceFileOfNode(node).fileName)}"`
                                        )
                                    ])
                                )
                                const newCommentText = createPrinter()
                                    .printNode(EmitHint.Unspecified, newJsDoc, getSourceFileOfNode(node))
                                    .trim()
                                    .replace(/^\/\*|\*\/$/g, "")
                                removeAllComments(node);
                                node.original && removeAllComments(node.original);
                                setSyntheticLeadingComments(node, [{
                                    pos: -1,
                                    end: -1,
                                    text: newCommentText,
                                    kind: SyntaxKind.MultiLineCommentTrivia,
                                    hasTrailingNewLine: true
                                }]);
                                emitNode.tsPlusLocationComment = true;
                            }
                        }
                        return node;
                    }
                }
                return node;
            }
        }
    }
}
