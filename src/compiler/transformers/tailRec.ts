import * as ts from "../_namespaces/ts"
import {
    ArrowFunction, Block, chainBundle, CompilerHost, CompilerOptions, ConciseBody, every, Expression, ExpressionStatement, factory, findIndex,
    FunctionDeclaration, getAllJSDocTags, Identifier, isArrowFunction, isBlock, isCallExpression, isExpression, isFunctionDeclaration,
    isIdentifier, isReturnStatement, isVariableDeclaration, JSDocTag, map, Node, NodeArray, NodeFactory, ParameterDeclaration, reduceLeft,
    SourceFile, Statement, SyntaxKind, TransformationContext, Type, TypeChecker, unescapeLeadingUnderscores, VariableDeclaration,
    visitEachChild, visitNode, VisitResult
} from "../_namespaces/ts";

/*@internal*/
export function transformTailRec(checker: TypeChecker, _options: CompilerOptions, _host: CompilerHost) {
    return function (context: TransformationContext) {
        return chainBundle(context, transformSourceFile);

        function transformSourceFile (node: SourceFile) {
            return visitEachChild(node, visitor(node), context);
        }
        function visitor(source: SourceFile) {
            return function (node: Node): VisitResult<Node> {
                switch (node.kind) {
                    case SyntaxKind.VariableDeclaration:
                        return visitVariableDeclaration(node as VariableDeclaration, context);
                    case SyntaxKind.FunctionDeclaration:
                        return visitFunctionDeclaration(node as FunctionDeclaration, context);
                    default:
                        return visitEachChild(node, visitor(source), context);
                }
            }
        }
        type IdentifierParameter = Omit<ParameterDeclaration, "name"> & { name: Identifier }
        type FunctionWithBody =
            | Omit<FunctionDeclaration, "body" | "parameters"> & { body: Block, parameters: NodeArray<IdentifierParameter> }
            | Omit<ArrowFunction, "body" | "parameters"> & { body: ConciseBody, parameters: NodeArray<IdentifierParameter> }
        function visitVariableDeclaration(node: VariableDeclaration, context: TransformationContext): VisitResult<Node> {
            if (node.name && isIdentifier(node.name) && node.initializer && isArrowFunction(node.initializer) && every(node.initializer.parameters, (p) => isIdentifier(p.name))) {
                return visitFunction(node.name, node, node.initializer as FunctionWithBody, context);
            } else {
                return node
            }
        }
        function visitFunctionDeclaration(node: FunctionDeclaration, context: TransformationContext): VisitResult<Node> {
            if (node.name && node.body && every(node.parameters, (p) => isIdentifier(p.name))) {
                return visitFunction(node.name, node, node as FunctionWithBody, context);
            } else {
                return node;
            }
        }
        function visitFunction(name: Identifier, declaration: FunctionDeclaration | VariableDeclaration, node: FunctionWithBody, context: TransformationContext) {
            const funcType = checker.getTypeAtLocation(node)
            const funcSymbol = funcType.symbol

            let tailRecTag: JSDocTag | undefined = undefined;
            if (funcSymbol && funcSymbol.declarations) {
                for (const declaration of funcSymbol.declarations) {
                    tailRecTag = getAllJSDocTags(
                        declaration,
                        (tag): tag is JSDocTag =>
                            tag.tagName.escapedText === "tsplus" &&
                            typeof tag.comment === "string" &&
                            tag.comment.startsWith("tailRec")
                    )[0];
                    if (tailRecTag) {
                        break;
                    }
                }
            }
            if (tailRecTag) {
                const originalParamNames = map(node.parameters, (param) => param.name);
                const [paramVariableNames, paramVariableDeclarations] = createTempVariables(node, factory);
                const [tempVariableNames, tempVariableDeclarations] = createTempVariables(node, factory);
                const funcIdentifierType = checker.getTypeAtLocation(name);
                try {
                    const loopBody = visitEachChild(
                        isBlock(node.body) ? node.body : factory.createBlock([factory.createReturnStatement(node.body)]),
                        visitFunctionBody(
                            funcIdentifierType,
                            originalParamNames,
                            paramVariableNames,
                            tempVariableNames,
                            checker,
                            factory,
                            context,
                        ),
                        context
                    );
                    const functionBody = factory.createBlock(
                        [
                            factory.createVariableStatement(
                                undefined,
                                factory.createVariableDeclarationList(paramVariableDeclarations)
                            ),
                            factory.createVariableStatement(
                                undefined,
                                factory.createVariableDeclarationList(tempVariableDeclarations)
                            ),
                            factory.createWhileStatement(
                                factory.createNumericLiteral(1),
                                loopBody
                            ),
                        ],
                        true
                    );
                    if (isArrowFunction(node) && isVariableDeclaration(declaration)) {
                        return factory.updateVariableDeclaration(
                            declaration,
                            declaration.name,
                                declaration.exclamationToken,
                                declaration.type,
                                factory.updateArrowFunction(
                                    node,
                                    node.modifiers,
                                    node.typeParameters,
                                    node.parameters,
                                    node.type,
                                    node.equalsGreaterThanToken,
                                    functionBody
                                )
                            );
                        } else if (isFunctionDeclaration(node)) {
                            return factory.updateFunctionDeclaration(
                                node,
                                node.modifiers,
                                node.asteriskToken,
                                node.name,
                                node.typeParameters,
                                node.parameters,
                                node.type,
                                functionBody
                            );
                        } else {
                            return declaration;
                        }
                    }
                    catch (e) {
                        console.error(e);
                        throw new Error("Unable to optimize tail recursive function")
                    }
                } else {
                    return declaration
                }
            }
            function createTempVariables(
                node: FunctionWithBody,
                factory: NodeFactory
            ): [Array<Identifier>, Array<VariableDeclaration>] {
                return reduceLeft(node.parameters, (b, param) => {
                    const uniqueName = factory.createUniqueName(unescapeLeadingUnderscores(param.name.escapedText))
                    b[0].push(uniqueName)
                    b[1].push(factory.createVariableDeclaration(uniqueName, undefined, undefined, param.name))
                    return b
                }, [[] as Array<Identifier>, [] as Array<VariableDeclaration>])
            }
            function visitExpression(originalParamIdentifiers: ReadonlyArray<Identifier>, tempParamIdentifiers: ReadonlyArray<Identifier>, checker: TypeChecker, factory: NodeFactory, context: TransformationContext) {
                return function(node: Node): VisitResult<Node> {
                    if (isIdentifier(node)) {
                        const symbol = checker.getSymbolAtLocation(node);
                        const paramIndex = findIndex(originalParamIdentifiers, (param) => checker.getSymbolAtLocation(param) === symbol);
                        if (paramIndex !== -1) {
                            return tempParamIdentifiers[paramIndex];
                        } else {
                            return node;
                        }
                    } else {
                        return visitEachChild(node, visitExpression(originalParamIdentifiers, tempParamIdentifiers, checker, factory, context), context);
                    }
                }
            }
            function visitFunctionBody(
                funcIdentifierType: Type,
                originalParamNames: ReadonlyArray<Identifier>,
                paramNames: ReadonlyArray<Identifier>,
                tempNames: ReadonlyArray<Identifier>,
                checker: TypeChecker,
                factory: NodeFactory,
                context: TransformationContext,
            ) {
                return function (node: Node): VisitResult<Node> {
                    if (isReturnStatement(node) && node.expression) {
                        if(isCallExpression(node.expression) && isIdentifier(node.expression.expression)) {
                            const callIdentifierType = checker.getTypeAtLocation(node.expression.expression);
                            if (callIdentifierType === funcIdentifierType) {
                                const tempAssignments: Array<ExpressionStatement> = []
                                const assignments: Array<ExpressionStatement> = []
                                for (let argIndex = 0, propIndex = 0; argIndex < node.expression.arguments.length; ++argIndex) {
                                    const arg = node.expression.arguments[argIndex];
                                    tempAssignments.push(
                                        factory.createExpressionStatement(
                                            factory.createAssignment(
                                                tempNames[propIndex],
                                                visitNode(arg, visitExpression(originalParamNames, paramNames, checker, factory, context)) as Expression
                                            )
                                        )
                                    );
                                    assignments.push(
                                        factory.createExpressionStatement(
                                            factory.createAssignment(
                                                paramNames[propIndex],
                                                tempNames[propIndex]
                                            )
                                        )
                                    );
                                    propIndex += 1;
                                }
                                const statements: Array<Statement> = tempAssignments.concat(assignments);
                                statements.push(factory.createContinueStatement());
                                return statements
                            } else {
                                return ts.visitEachChild(
                                    node,
                                    visitExpression(originalParamNames, paramNames, checker, factory, context),
                                    context
                                );
                            }
                        }
                        else {
                            return ts.visitEachChild(
                                node,
                                visitExpression(originalParamNames, paramNames, checker, factory, context),
                                context
                            );
                        }
                    }
                    else if (isExpression(node)) {
                        return ts.visitEachChild(
                            node,
                            visitExpression(originalParamNames, paramNames, checker, factory, context),
                            context
                        );
                    }
                    else {
                        return ts.visitEachChild(
                            node,
                            visitFunctionBody(funcIdentifierType, originalParamNames, paramNames, tempNames, checker, factory, context),
                            context
                        )
                    }
                }
            }
        }
    }