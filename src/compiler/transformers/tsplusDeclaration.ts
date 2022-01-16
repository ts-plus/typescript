/*@internal*/
namespace ts {
    export function transformTsPlusDeclaration(checker: TypeChecker, _options: CompilerOptions, _host: CompilerHost) {
        return function (context: TransformationContext) {
            return chainBundle(context, transformSourceFile);
            function transformSourceFile(node: SourceFile) {
                if (node.isDeclarationFile) {
                    return node;
                }
                const transformed = visitEachChild(node, visitor(node), context);
                return transformed
            }
            function visitor(source: SourceFile) {
                return function (node: Node): VisitResult<Node> {
                    switch (node.kind) {
                        case SyntaxKind.VariableStatement:
                            return visitVariableStatement(source, node as VariableStatement, visitor(source), context)
                        default:
                            return node;
                    }
                }
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
                                const [_, target, name] = signatureFluentTags[0].comment.split(" ")
                                const existingJsDoc = node.jsDoc?.[0] ?? factory.createJSDocComment()
                                const existingTags = existingJsDoc.tags ?? factory.createNodeArray()
                                const newJsDoc = factory.createJSDocComment(
                                    existingJsDoc.comment,
                                    existingTags.concat([
                                        factory.createJSDocUnknownTag(
                                            factory.createIdentifier("tsplus"),
                                            `pipeable ${target} ${name}`
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
                                getOrCreateEmitNode(node).tsPlusPipeableComment = true;
                            }
                        }
                    }
                }
                return node;
            }
        }
    }
}