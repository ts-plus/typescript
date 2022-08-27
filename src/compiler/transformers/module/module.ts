/*@internal*/
namespace ts {

    export function transformModule(context: TransformationContext) {
        interface AsynchronousDependencies {
            aliasedModuleNames: Expression[];
            unaliasedModuleNames: Expression[];
            importAliasNames: ParameterDeclaration[];
        }

        function getTransformModuleDelegate(moduleKind: ModuleKind): (node: SourceFile) => SourceFile {
            switch (moduleKind) {
                case ModuleKind.AMD: return transformAMDModule;
                case ModuleKind.UMD: return transformUMDModule;
                default: return transformCommonJSModule;
            }
        }

        const {
            factory,
            getEmitHelperFactory: emitHelpers,
            startLexicalEnvironment,
            endLexicalEnvironment,
            hoistVariableDeclaration
        } = context;

        const compilerOptions = context.getCompilerOptions();
        const resolver = context.getEmitResolver();
        const host = context.getEmitHost();
        const languageVersion = getEmitScriptTarget(compilerOptions);
        const moduleKind = getEmitModuleKind(compilerOptions);
        const previousOnSubstituteNode = context.onSubstituteNode;
        const previousOnEmitNode = context.onEmitNode;
        context.onSubstituteNode = onSubstituteNode;
        context.onEmitNode = onEmitNode;
        context.enableSubstitution(SyntaxKind.CallExpression); // Substitute calls to imported/exported symbols to avoid incorrect `this`.
        context.enableSubstitution(SyntaxKind.TaggedTemplateExpression); // Substitute calls to imported/exported symbols to avoid incorrect `this`.
        context.enableSubstitution(SyntaxKind.Identifier); // Substitutes expression identifiers with imported/exported symbols.
        context.enableSubstitution(SyntaxKind.BinaryExpression); // Substitutes assignments to exported symbols.
        context.enableSubstitution(SyntaxKind.ShorthandPropertyAssignment); // Substitutes shorthand property assignments for imported/exported symbols.
        context.enableEmitNotification(SyntaxKind.SourceFile); // Restore state when substituting nodes in a file.

        const moduleInfoMap: ExternalModuleInfo[] = []; // The ExternalModuleInfo for each file.
        const deferredExports: (Statement[] | undefined)[] = []; // Exports to defer until an EndOfDeclarationMarker is found.

        let currentSourceFile: SourceFile; // The current file.
        let currentModuleInfo: ExternalModuleInfo; // The ExternalModuleInfo for the current file.
        const noSubstitution: boolean[] = []; // Set of nodes for which substitution rules should be ignored.
        let needUMDDynamicImportHelper: boolean;

        return chainBundle(context, transformSourceFile);

        /**
         * Transforms the module aspects of a SourceFile.
         *
         * @param node The SourceFile node.
         */
        function transformSourceFile(node: SourceFile) {
            if (node.isDeclarationFile ||
                !(isEffectiveExternalModule(node, compilerOptions) ||
                    node.transformFlags & TransformFlags.ContainsDynamicImport ||
                    (isJsonSourceFile(node) && hasJsonModuleEmitEnabled(compilerOptions) && outFile(compilerOptions)))) {
                return node;
            }

            currentSourceFile = node;
            currentModuleInfo = collectExternalModuleInfo(context, node, resolver, compilerOptions);
            moduleInfoMap[getOriginalNodeId(node)] = currentModuleInfo;

            // Perform the transformation.
            const transformModule = getTransformModuleDelegate(moduleKind);
            const updated = transformModule(node);
            currentSourceFile = undefined!;
            currentModuleInfo = undefined!;
            needUMDDynamicImportHelper = false;
            return updated;
        }


        function shouldEmitUnderscoreUnderscoreESModule() {
            if (!currentModuleInfo.exportEquals && isExternalModule(currentSourceFile)) {
                return true;
            }
            return false;
        }

        /**
         * Transforms a SourceFile into a CommonJS module.
         *
         * @param node The SourceFile node.
         */
        function transformCommonJSModule(node: SourceFile) {
            startLexicalEnvironment();

            const statements: Statement[] = [];
            const ensureUseStrict = getStrictOptionValue(compilerOptions, "alwaysStrict") || (!compilerOptions.noImplicitUseStrict && isExternalModule(currentSourceFile));
            const statementOffset = factory.copyPrologue(node.statements, statements, ensureUseStrict && !isJsonSourceFile(node), topLevelVisitor);

            if (shouldEmitUnderscoreUnderscoreESModule()) {
                append(statements, createUnderscoreUnderscoreESModule());
            }
            if (length(currentModuleInfo.exportedNames)) {
                const chunkSize = 50;
                for (let i=0; i<currentModuleInfo.exportedNames!.length; i += chunkSize) {
                    append(
                        statements,
                        factory.createExpressionStatement(
                            reduceLeft(
                                currentModuleInfo.exportedNames!.slice(i, i + chunkSize),
                                (prev, nextId) => factory.createAssignment(factory.createPropertyAccessExpression(factory.createIdentifier("exports"), factory.createIdentifier(idText(nextId))), prev),
                                factory.createVoidZero() as Expression
                            )
                        )
                    );
                }
            }

            append(statements, visitNode(currentModuleInfo.externalHelpersImportDeclaration, topLevelVisitor, isStatement));
            addRange(statements, visitNodes(node.statements, topLevelVisitor, isStatement, statementOffset));
            addExportEqualsIfNeeded(statements, /*emitAsReturn*/ false);
            insertStatementsAfterStandardPrologue(statements, endLexicalEnvironment());

            const updated = factory.updateSourceFile(node, setTextRange(factory.createNodeArray(statements), node.statements));
            addEmitHelpers(updated, context.readEmitHelpers());
            return updated;
        }

        /**
         * Transforms a SourceFile into an AMD module.
         *
         * @param node The SourceFile node.
         */
        function transformAMDModule(node: SourceFile) {
            const define = factory.createIdentifier("define");
            const moduleName = tryGetModuleNameFromFile(factory, node, host, compilerOptions);
            const jsonSourceFile = isJsonSourceFile(node) && node;

            // An AMD define function has the following shape:
            //
            //     define(id?, dependencies?, factory);
            //
            // This has the shape of the following:
            //
            //     define(name, ["module1", "module2"], function (module1Alias) { ... }
            //
            // The location of the alias in the parameter list in the factory function needs to
            // match the position of the module name in the dependency list.
            //
            // To ensure this is true in cases of modules with no aliases, e.g.:
            //
            //     import "module"
            //
            // or
            //
            //     /// <amd-dependency path= "a.css" />
            //
            // we need to add modules without alias names to the end of the dependencies list

            const { aliasedModuleNames, unaliasedModuleNames, importAliasNames } = collectAsynchronousDependencies(node, /*includeNonAmdDependencies*/ true);

            // Create an updated SourceFile:
            //
            //     define(mofactory.updateSourceFile", "module2"], function ...
            const updated = factory.updateSourceFile(node,
                setTextRange(
                    factory.createNodeArray([
                        factory.createExpressionStatement(
                            factory.createCallExpression(
                                define,
                                /*typeArguments*/ undefined,
                                [
                                    // Add the module name (if provided).
                                    ...(moduleName ? [moduleName] : []),

                                    // Add the dependency array argument:
                                    //
                                    //     ["require", "exports", module1", "module2", ...]
                                    factory.createArrayLiteralExpression(jsonSourceFile ? emptyArray : [
                                        factory.createStringLiteral("require"),
                                        factory.createStringLiteral("exports"),
                                        ...aliasedModuleNames,
                                        ...unaliasedModuleNames
                                    ]),

                                    // Add the module body function argument:
                                    //
                                    //     function (require, exports, module1, module2) ...
                                    jsonSourceFile ?
                                        jsonSourceFile.statements.length ? jsonSourceFile.statements[0].expression : factory.createObjectLiteralExpression() :
                                        factory.createFunctionExpression(
                                            /*modifiers*/ undefined,
                                            /*asteriskToken*/ undefined,
                                            /*name*/ undefined,
                                            /*typeParameters*/ undefined,
                                            [
                                                factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, "require"),
                                                factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, "exports"),
                                                ...importAliasNames
                                            ],
                                            /*type*/ undefined,
                                            transformAsynchronousModuleBody(node)
                                        )
                                ]
                            )
                        )
                    ]),
                    /*location*/ node.statements
                )
            );

            addEmitHelpers(updated, context.readEmitHelpers());
            return updated;
        }

        /**
         * Transforms a SourceFile into a UMD module.
         *
         * @param node The SourceFile node.
         */
        function transformUMDModule(node: SourceFile) {
            const { aliasedModuleNames, unaliasedModuleNames, importAliasNames } = collectAsynchronousDependencies(node, /*includeNonAmdDependencies*/ false);
            const moduleName = tryGetModuleNameFromFile(factory, node, host, compilerOptions);
            const umdHeader = factory.createFunctionExpression(
                /*modifiers*/ undefined,
                /*asteriskToken*/ undefined,
                /*name*/ undefined,
                /*typeParameters*/ undefined,
                [factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, "factory")],
                /*type*/ undefined,
                setTextRange(
                    factory.createBlock(
                        [
                            factory.createIfStatement(
                                factory.createLogicalAnd(
                                    factory.createTypeCheck(factory.createIdentifier("module"), "object"),
                                    factory.createTypeCheck(factory.createPropertyAccessExpression(factory.createIdentifier("module"), "exports"), "object")
                                ),
                                factory.createBlock([
                                    factory.createVariableStatement(
                                        /*modifiers*/ undefined,
                                        [
                                            factory.createVariableDeclaration(
                                                "v",
                                                /*exclamationToken*/ undefined,
                                                /*type*/ undefined,
                                                factory.createCallExpression(
                                                    factory.createIdentifier("factory"),
                                                    /*typeArguments*/ undefined,
                                                    [
                                                        factory.createIdentifier("require"),
                                                        factory.createIdentifier("exports")
                                                    ]
                                                )
                                            )
                                        ]
                                    ),
                                    setEmitFlags(
                                        factory.createIfStatement(
                                            factory.createStrictInequality(
                                                factory.createIdentifier("v"),
                                                factory.createIdentifier("undefined")
                                            ),
                                            factory.createExpressionStatement(
                                                factory.createAssignment(
                                                    factory.createPropertyAccessExpression(factory.createIdentifier("module"), "exports"),
                                                    factory.createIdentifier("v")
                                                )
                                            )
                                        ),
                                        EmitFlags.SingleLine
                                    )
                                ]),
                                factory.createIfStatement(
                                    factory.createLogicalAnd(
                                        factory.createTypeCheck(factory.createIdentifier("define"), "function"),
                                        factory.createPropertyAccessExpression(factory.createIdentifier("define"), "amd")
                                    ),
                                    factory.createBlock([
                                        factory.createExpressionStatement(
                                            factory.createCallExpression(
                                                factory.createIdentifier("define"),
                                                /*typeArguments*/ undefined,
                                                [
                                                    // Add the module name (if provided).
                                                    ...(moduleName ? [moduleName] : []),
                                                    factory.createArrayLiteralExpression([
                                                        factory.createStringLiteral("require"),
                                                        factory.createStringLiteral("exports"),
                                                        ...aliasedModuleNames,
                                                        ...unaliasedModuleNames
                                                    ]),
                                                    factory.createIdentifier("factory")
                                                ]
                                            )
                                        )
                                    ])
                                )
                            )
                        ],
                        /*multiLine*/ true
                    ),
                    /*location*/ undefined
                )
            );

            // Create an updated SourceFile:
            //
            //  (function (factory) {
            //      if (typeof module === "object" && typeof module.exports === "object") {
            //          var v = factory(require, exports);
            //          if (v !== undefined) module.exports = v;
            //      }
            //      else if (typeof define === 'function' && define.amd) {
            //          define(["require", "exports"], factory);
            //      }
            //  })(function ...)

            const updated = factory.updateSourceFile(
                node,
                setTextRange(
                    factory.createNodeArray([
                        factory.createExpressionStatement(
                            factory.createCallExpression(
                                umdHeader,
                                /*typeArguments*/ undefined,
                                [
                                    // Add the module body function argument:
                                    //
                                    //     function (require, exports) ...
                                    factory.createFunctionExpression(
                                        /*modifiers*/ undefined,
                                        /*asteriskToken*/ undefined,
                                        /*name*/ undefined,
                                        /*typeParameters*/ undefined,
                                        [
                                            factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, "require"),
                                            factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, "exports"),
                                            ...importAliasNames
                                        ],
                                        /*type*/ undefined,
                                        transformAsynchronousModuleBody(node)
                                    )
                                ]
                            )
                        )
                    ]),
                    /*location*/ node.statements
                )
            );

            addEmitHelpers(updated, context.readEmitHelpers());
            return updated;
        }

        /**
         * Collect the additional asynchronous dependencies for the module.
         *
         * @param node The source file.
         * @param includeNonAmdDependencies A value indicating whether to include non-AMD dependencies.
         */
        function collectAsynchronousDependencies(node: SourceFile, includeNonAmdDependencies: boolean): AsynchronousDependencies {
            // names of modules with corresponding parameter in the factory function
            const aliasedModuleNames: Expression[] = [];

            // names of modules with no corresponding parameters in factory function
            const unaliasedModuleNames: Expression[] = [];

            // names of the parameters in the factory function; these
            // parameters need to match the indexes of the corresponding
            // module names in aliasedModuleNames.
            const importAliasNames: ParameterDeclaration[] = [];

            // Fill in amd-dependency tags
            for (const amdDependency of node.amdDependencies) {
                if (amdDependency.name) {
                    aliasedModuleNames.push(factory.createStringLiteral(amdDependency.path));
                    importAliasNames.push(factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, amdDependency.name));
                }
                else {
                    unaliasedModuleNames.push(factory.createStringLiteral(amdDependency.path));
                }
            }

            for (const importNode of currentModuleInfo.externalImports) {
                // Find the name of the external module
                const externalModuleName = getExternalModuleNameLiteral(factory, importNode, currentSourceFile, host, resolver, compilerOptions);

                // Find the name of the module alias, if there is one
                const importAliasName = getLocalNameForExternalImport(factory, importNode, currentSourceFile);
                // It is possible that externalModuleName is undefined if it is not string literal.
                // This can happen in the invalid import syntax.
                // E.g : "import * from alias from 'someLib';"
                if (externalModuleName) {
                    if (includeNonAmdDependencies && importAliasName) {
                        // Set emitFlags on the name of the classDeclaration
                        // This is so that when printer will not substitute the identifier
                        setEmitFlags(importAliasName, EmitFlags.NoSubstitution);
                        aliasedModuleNames.push(externalModuleName);
                        importAliasNames.push(factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, importAliasName));
                    }
                    else {
                        unaliasedModuleNames.push(externalModuleName);
                    }
                }
            }

            return { aliasedModuleNames, unaliasedModuleNames, importAliasNames };
        }

        function getAMDImportExpressionForImport(node: ImportDeclaration | ExportDeclaration | ImportEqualsDeclaration) {
            if (isImportEqualsDeclaration(node) || isExportDeclaration(node) || !getExternalModuleNameLiteral(factory, node, currentSourceFile, host, resolver, compilerOptions)) {
                return undefined;
            }
            const name = getLocalNameForExternalImport(factory, node, currentSourceFile)!; // TODO: GH#18217
            const expr = getHelperExpressionForImport(node, name);
            if (expr === name) {
                return undefined;
            }
            return factory.createExpressionStatement(factory.createAssignment(name, expr));
        }

        /**
         * Transforms a SourceFile into an AMD or UMD module body.
         *
         * @param node The SourceFile node.
         */
        function transformAsynchronousModuleBody(node: SourceFile) {
            startLexicalEnvironment();

            const statements: Statement[] = [];
            const statementOffset = factory.copyPrologue(node.statements, statements, /*ensureUseStrict*/ !compilerOptions.noImplicitUseStrict, topLevelVisitor);

            if (shouldEmitUnderscoreUnderscoreESModule()) {
                append(statements, createUnderscoreUnderscoreESModule());
            }
            if (length(currentModuleInfo.exportedNames)) {
                append(statements, factory.createExpressionStatement(reduceLeft(currentModuleInfo.exportedNames, (prev, nextId) => factory.createAssignment(factory.createPropertyAccessExpression(factory.createIdentifier("exports"), factory.createIdentifier(idText(nextId))), prev), factory.createVoidZero() as Expression)));
            }

            // Visit each statement of the module body.
            append(statements, visitNode(currentModuleInfo.externalHelpersImportDeclaration, topLevelVisitor, isStatement));
            if (moduleKind === ModuleKind.AMD) {
                addRange(statements, mapDefined(currentModuleInfo.externalImports, getAMDImportExpressionForImport));
            }
            addRange(statements, visitNodes(node.statements, topLevelVisitor, isStatement, statementOffset));

            // Append the 'export =' statement if provided.
            addExportEqualsIfNeeded(statements, /*emitAsReturn*/ true);

            // End the lexical environment for the module body
            // and merge any new lexical declarations.
            insertStatementsAfterStandardPrologue(statements, endLexicalEnvironment());

            const body = factory.createBlock(statements, /*multiLine*/ true);
            if (needUMDDynamicImportHelper) {
                addEmitHelper(body, dynamicImportUMDHelper);
            }

            return body;
        }

        /**
         * Adds the down-level representation of `export=` to the statement list if one exists
         * in the source file.
         *
         * @param statements The Statement list to modify.
         * @param emitAsReturn A value indicating whether to emit the `export=` statement as a
         * return statement.
         */
        function addExportEqualsIfNeeded(statements: Statement[], emitAsReturn: boolean) {
            if (currentModuleInfo.exportEquals) {
                const expressionResult = visitNode(currentModuleInfo.exportEquals.expression, visitor);
                if (expressionResult) {
                    if (emitAsReturn) {
                        const statement = factory.createReturnStatement(expressionResult);
                        setTextRange(statement, currentModuleInfo.exportEquals);
                        setEmitFlags(statement, EmitFlags.NoTokenSourceMaps | EmitFlags.NoComments);
                        statements.push(statement);
                    }
                    else {
                        const statement = factory.createExpressionStatement(
                            factory.createAssignment(
                                factory.createPropertyAccessExpression(
                                    factory.createIdentifier("module"),
                                    "exports"
                                ),
                                expressionResult
                            )
                        );

                        setTextRange(statement, currentModuleInfo.exportEquals);
                        setEmitFlags(statement, EmitFlags.NoComments);
                        statements.push(statement);
                    }
                }
            }
        }

        //
        // Top-Level Source Element Visitors
        //

        /**
         * Visits a node at the top level of the source file.
         *
         * @param node The node to visit.
         */
        function topLevelVisitor(node: Node): VisitResult<Node> {
            switch (node.kind) {
                case SyntaxKind.ImportDeclaration:
                    return visitImportDeclaration(node as ImportDeclaration);

                case SyntaxKind.ImportEqualsDeclaration:
                    return visitImportEqualsDeclaration(node as ImportEqualsDeclaration);

                case SyntaxKind.ExportDeclaration:
                    return visitExportDeclaration(node as ExportDeclaration);

                case SyntaxKind.ExportAssignment:
                    return visitExportAssignment(node as ExportAssignment);

                case SyntaxKind.VariableStatement:
                    return visitVariableStatement(node as VariableStatement);

                case SyntaxKind.FunctionDeclaration:
                    return visitFunctionDeclaration(node as FunctionDeclaration);

                case SyntaxKind.ClassDeclaration:
                    return visitClassDeclaration(node as ClassDeclaration);

                case SyntaxKind.MergeDeclarationMarker:
                    return visitMergeDeclarationMarker(node as MergeDeclarationMarker);

                case SyntaxKind.EndOfDeclarationMarker:
                    return visitEndOfDeclarationMarker(node as EndOfDeclarationMarker);

                default:
                    return visitor(node);
            }
        }

        function visitorWorker(node: Node, valueIsDiscarded: boolean): VisitResult<Node> {
            // This visitor does not need to descend into the tree if there is no dynamic import, destructuring assignment, or update expression
            // as export/import statements are only transformed at the top level of a file.
            if (!(node.transformFlags & (TransformFlags.ContainsDynamicImport | TransformFlags.ContainsDestructuringAssignment | TransformFlags.ContainsUpdateExpressionForIdentifier))) {
                return node;
            }

            switch (node.kind) {
                case SyntaxKind.ForStatement:
                    return visitForStatement(node as ForStatement);
                case SyntaxKind.ExpressionStatement:
                    return visitExpressionStatement(node as ExpressionStatement);
                case SyntaxKind.ParenthesizedExpression:
                    return visitParenthesizedExpression(node as ParenthesizedExpression, valueIsDiscarded);
                case SyntaxKind.PartiallyEmittedExpression:
                    return visitPartiallyEmittedExpression(node as PartiallyEmittedExpression, valueIsDiscarded);
                case SyntaxKind.CallExpression:
                    if (isImportCall(node) && currentSourceFile.impliedNodeFormat === undefined) {
                        return visitImportCallExpression(node);
                    }
                    break;
                case SyntaxKind.BinaryExpression:
                    if (isDestructuringAssignment(node)) {
                        return visitDestructuringAssignment(node, valueIsDiscarded);
                    }
                    break;
                case SyntaxKind.PrefixUnaryExpression:
                case SyntaxKind.PostfixUnaryExpression:
                    return visitPreOrPostfixUnaryExpression(node as PrefixUnaryExpression | PostfixUnaryExpression, valueIsDiscarded);
            }

            return visitEachChild(node, visitor, context);
        }

        function visitor(node: Node): VisitResult<Node> {
            return visitorWorker(node, /*valueIsDiscarded*/ false);
        }

        function discardedValueVisitor(node: Node): VisitResult<Node> {
            return visitorWorker(node, /*valueIsDiscarded*/ true);
        }

        function destructuringNeedsFlattening(node: Expression): boolean {
            if (isObjectLiteralExpression(node)) {
                for (const elem of node.properties) {
                    switch (elem.kind) {
                        case SyntaxKind.PropertyAssignment:
                            if (destructuringNeedsFlattening(elem.initializer)) {
                                return true;
                            }
                            break;
                        case SyntaxKind.ShorthandPropertyAssignment:
                            if (destructuringNeedsFlattening(elem.name)) {
                                return true;
                            }
                            break;
                        case SyntaxKind.SpreadAssignment:
                            if (destructuringNeedsFlattening(elem.expression)) {
                                return true;
                            }
                            break;
                        case SyntaxKind.MethodDeclaration:
                        case SyntaxKind.GetAccessor:
                        case SyntaxKind.SetAccessor:
                            return false;
                        default: Debug.assertNever(elem, "Unhandled object member kind");
                    }
                }
            }
            else if (isArrayLiteralExpression(node)) {
                for (const elem of node.elements) {
                    if (isSpreadElement(elem)) {
                        if (destructuringNeedsFlattening(elem.expression)) {
                            return true;
                        }
                    }
                    else if (destructuringNeedsFlattening(elem)) {
                        return true;
                    }
                }
            }
            else if (isIdentifier(node)) {
                return length(getExports(node)) > (isExportName(node) ? 1 : 0);
            }
            return false;
        }

        function visitDestructuringAssignment(node: DestructuringAssignment, valueIsDiscarded: boolean): Expression {
            if (destructuringNeedsFlattening(node.left)) {
                return flattenDestructuringAssignment(node, visitor, context, FlattenLevel.All, !valueIsDiscarded, createAllExportExpressions);
            }
            return visitEachChild(node, visitor, context);
        }

        function visitForStatement(node: ForStatement) {
            return factory.updateForStatement(
                node,
                visitNode(node.initializer, discardedValueVisitor, isForInitializer),
                visitNode(node.condition, visitor, isExpression),
                visitNode(node.incrementor, discardedValueVisitor, isExpression),
                visitIterationBody(node.statement, visitor, context)
            );
        }

        function visitExpressionStatement(node: ExpressionStatement) {
            return factory.updateExpressionStatement(
                node,
                visitNode(node.expression, discardedValueVisitor, isExpression)
            );
        }

        function visitParenthesizedExpression(node: ParenthesizedExpression, valueIsDiscarded: boolean) {
            return factory.updateParenthesizedExpression(node, visitNode(node.expression, valueIsDiscarded ? discardedValueVisitor : visitor, isExpression));
        }

        function visitPartiallyEmittedExpression(node: PartiallyEmittedExpression, valueIsDiscarded: boolean) {
            return factory.updatePartiallyEmittedExpression(node, visitNode(node.expression, valueIsDiscarded ? discardedValueVisitor : visitor, isExpression));
        }

        function visitPreOrPostfixUnaryExpression(node: PrefixUnaryExpression | PostfixUnaryExpression, valueIsDiscarded: boolean) {
            // When we see a prefix or postfix increment expression whose operand is an exported
            // symbol, we should ensure all exports of that symbol are updated with the correct
            // value.
            //
            // - We do not transform generated identifiers for any reason.
            // - We do not transform identifiers tagged with the LocalName flag.
            // - We do not transform identifiers that were originally the name of an enum or
            //   namespace due to how they are transformed in TypeScript.
            // - We only transform identifiers that are exported at the top level.
            if ((node.operator === SyntaxKind.PlusPlusToken || node.operator === SyntaxKind.MinusMinusToken)
                && isIdentifier(node.operand)
                && !isGeneratedIdentifier(node.operand)
                && !isLocalName(node.operand)
                && !isDeclarationNameOfEnumOrNamespace(node.operand)) {
                const exportedNames = getExports(node.operand);
                if (exportedNames) {
                    let temp: Identifier | undefined;
                    let expression: Expression = visitNode(node.operand, visitor, isExpression);
                    if (isPrefixUnaryExpression(node)) {
                        expression = factory.updatePrefixUnaryExpression(node, expression);
                    }
                    else {
                        expression = factory.updatePostfixUnaryExpression(node, expression);
                        if (!valueIsDiscarded) {
                            temp = factory.createTempVariable(hoistVariableDeclaration);
                            expression = factory.createAssignment(temp, expression);
                            setTextRange(expression, node);
                        }
                        expression = factory.createComma(expression, factory.cloneNode(node.operand));
                        setTextRange(expression, node);
                    }

                    for (const exportName of exportedNames) {
                        noSubstitution[getNodeId(expression)] = true;
                        expression = createExportExpression(exportName, expression);
                        setTextRange(expression, node);
                    }

                    if (temp) {
                        noSubstitution[getNodeId(expression)] = true;
                        expression = factory.createComma(expression, temp);
                        setTextRange(expression, node);
                    }
                    return expression;
                }
            }
            return visitEachChild(node, visitor, context);
        }

        function visitImportCallExpression(node: ImportCall): Expression {
            const externalModuleName = getExternalModuleNameLiteral(factory, node, currentSourceFile, host, resolver, compilerOptions);
            const firstArgument = visitNode(firstOrUndefined(node.arguments), visitor);
            // Only use the external module name if it differs from the first argument. This allows us to preserve the quote style of the argument on output.
            const argument = externalModuleName && (!firstArgument || !isStringLiteral(firstArgument) || firstArgument.text !== externalModuleName.text) ? externalModuleName : firstArgument;
            const containsLexicalThis = !!(node.transformFlags & TransformFlags.ContainsLexicalThis);
            switch (compilerOptions.module) {
                case ModuleKind.AMD:
                    return createImportCallExpressionAMD(argument, containsLexicalThis);
                case ModuleKind.UMD:
                    return createImportCallExpressionUMD(argument ?? factory.createVoidZero(), containsLexicalThis);
                case ModuleKind.CommonJS:
                default:
                    return createImportCallExpressionCommonJS(argument, containsLexicalThis);
            }
        }

        function createImportCallExpressionUMD(arg: Expression, containsLexicalThis: boolean): Expression {
            // (function (factory) {
            //      ... (regular UMD)
            // }
            // })(function (require, exports, useSyncRequire) {
            //      "use strict";
            //      Object.defineProperty(exports, "__esModule", { value: true });
            //      var __syncRequire = typeof module === "object" && typeof module.exports === "object";
            //      var __resolved = new Promise(function (resolve) { resolve(); });
            //      .....
            //      __syncRequire
            //          ? __resolved.then(function () { return require(x); }) /*CommonJs Require*/
            //          : new Promise(function (_a, _b) { require([x], _a, _b); }); /*Amd Require*/
            // });
            needUMDDynamicImportHelper = true;
            if (isSimpleCopiableExpression(arg)) {
                const argClone = isGeneratedIdentifier(arg) ? arg : isStringLiteral(arg) ? factory.createStringLiteralFromNode(arg) : setEmitFlags(setTextRange(factory.cloneNode(arg), arg), EmitFlags.NoComments);
                return factory.createConditionalExpression(
                    /*condition*/ factory.createIdentifier("__syncRequire"),
                    /*questionToken*/ undefined,
                    /*whenTrue*/ createImportCallExpressionCommonJS(arg, containsLexicalThis),
                    /*colonToken*/ undefined,
                    /*whenFalse*/ createImportCallExpressionAMD(argClone, containsLexicalThis)
                );
            }
            else {
                const temp = factory.createTempVariable(hoistVariableDeclaration);
                return factory.createComma(factory.createAssignment(temp, arg), factory.createConditionalExpression(
                    /*condition*/ factory.createIdentifier("__syncRequire"),
                    /*questionToken*/ undefined,
                    /*whenTrue*/ createImportCallExpressionCommonJS(temp, containsLexicalThis),
                    /*colonToken*/ undefined,
                    /*whenFalse*/ createImportCallExpressionAMD(temp, containsLexicalThis)
                ));
            }
        }

        function createImportCallExpressionAMD(arg: Expression | undefined, containsLexicalThis: boolean): Expression {
            // improt("./blah")
            // emit as
            // define(["require", "exports", "blah"], function (require, exports) {
            //     ...
            //     new Promise(function (_a, _b) { require([x], _a, _b); }); /*Amd Require*/
            // });
            const resolve = factory.createUniqueName("resolve");
            const reject = factory.createUniqueName("reject");
            const parameters = [
                factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, /*name*/ resolve),
                factory.createParameterDeclaration(/*modifiers*/ undefined, /*dotDotDotToken*/ undefined, /*name*/ reject)
            ];
            const body = factory.createBlock([
                factory.createExpressionStatement(
                    factory.createCallExpression(
                        factory.createIdentifier("require"),
                        /*typeArguments*/ undefined,
                        [factory.createArrayLiteralExpression([arg || factory.createOmittedExpression()]), resolve, reject]
                    )
                )
            ]);

            let func: FunctionExpression | ArrowFunction;
            if (languageVersion >= ScriptTarget.ES2015) {
                func = factory.createArrowFunction(
                    /*modifiers*/ undefined,
                    /*typeParameters*/ undefined,
                    parameters,
                    /*type*/ undefined,
                    /*equalsGreaterThanToken*/ undefined,
                    body);
            }
            else {
                func = factory.createFunctionExpression(
                    /*modifiers*/ undefined,
                    /*asteriskToken*/ undefined,
                    /*name*/ undefined,
                    /*typeParameters*/ undefined,
                    parameters,
                    /*type*/ undefined,
                    body);

                // if there is a lexical 'this' in the import call arguments, ensure we indicate
                // that this new function expression indicates it captures 'this' so that the
                // es2015 transformer will properly substitute 'this' with '_this'.
                if (containsLexicalThis) {
                    setEmitFlags(func, EmitFlags.CapturesThis);
                }
            }

            const promise = factory.createNewExpression(factory.createIdentifier("Promise"), /*typeArguments*/ undefined, [func]);
            if (getESModuleInterop(compilerOptions)) {
                return factory.createCallExpression(factory.createPropertyAccessExpression(promise, factory.createIdentifier("then")), /*typeArguments*/ undefined, [emitHelpers().createImportStarCallbackHelper()]);
            }
            return promise;
        }

        function createImportCallExpressionCommonJS(arg: Expression | undefined, containsLexicalThis: boolean): Expression {
            // import("./blah")
            // emit as
            // Promise.resolve().then(function () { return require(x); }) /*CommonJs Require*/
            // We have to wrap require in then callback so that require is done in asynchronously
            // if we simply do require in resolve callback in Promise constructor. We will execute the loading immediately
            const promiseResolveCall = factory.createCallExpression(factory.createPropertyAccessExpression(factory.createIdentifier("Promise"), "resolve"), /*typeArguments*/ undefined, /*argumentsArray*/ []);
            let requireCall: Expression = factory.createCallExpression(factory.createIdentifier("require"), /*typeArguments*/ undefined, arg ? [arg] : []);
            if (getESModuleInterop(compilerOptions)) {
                requireCall = emitHelpers().createImportStarHelper(requireCall);
            }

            let func: FunctionExpression | ArrowFunction;
            if (languageVersion >= ScriptTarget.ES2015) {
                func = factory.createArrowFunction(
                    /*modifiers*/ undefined,
                    /*typeParameters*/ undefined,
                    /*parameters*/ [],
                    /*type*/ undefined,
                    /*equalsGreaterThanToken*/ undefined,
                    requireCall);
            }
            else {
                func = factory.createFunctionExpression(
                    /*modifiers*/ undefined,
                    /*asteriskToken*/ undefined,
                    /*name*/ undefined,
                    /*typeParameters*/ undefined,
                    /*parameters*/ [],
                    /*type*/ undefined,
                    factory.createBlock([factory.createReturnStatement(requireCall)]));

                // if there is a lexical 'this' in the import call arguments, ensure we indicate
                // that this new function expression indicates it captures 'this' so that the
                // es2015 transformer will properly substitute 'this' with '_this'.
                if (containsLexicalThis) {
                    setEmitFlags(func, EmitFlags.CapturesThis);
                }
            }

            return factory.createCallExpression(factory.createPropertyAccessExpression(promiseResolveCall, "then"), /*typeArguments*/ undefined, [func]);
        }

        function getHelperExpressionForExport(node: ExportDeclaration, innerExpr: Expression) {
            if (!getESModuleInterop(compilerOptions) || getEmitFlags(node) & EmitFlags.NeverApplyImportHelper) {
                return innerExpr;
            }
            if (getExportNeedsImportStarHelper(node)) {
                return emitHelpers().createImportStarHelper(innerExpr);
            }
            return innerExpr;
        }

        function getHelperExpressionForImport(node: ImportDeclaration, innerExpr: Expression) {
            if (!getESModuleInterop(compilerOptions) || getEmitFlags(node) & EmitFlags.NeverApplyImportHelper) {
                return innerExpr;
            }
            if (getImportNeedsImportStarHelper(node)) {
                return emitHelpers().createImportStarHelper(innerExpr);
            }
            if (getImportNeedsImportDefaultHelper(node)) {
                return emitHelpers().createImportDefaultHelper(innerExpr);
            }
            return innerExpr;
        }

        /**
         * Visits an ImportDeclaration node.
         *
         * @param node The node to visit.
         */
        function visitImportDeclaration(node: ImportDeclaration): VisitResult<Statement> {
            let statements: Statement[] | undefined;
            const namespaceDeclaration = getNamespaceDeclarationNode(node);
            if (moduleKind !== ModuleKind.AMD) {
                if (!node.importClause) {
                    // import "mod";
                    return setOriginalNode(setTextRange(factory.createExpressionStatement(createRequireCall(node)), node), node);
                }
                else {
                    const variables: VariableDeclaration[] = [];
                    if (namespaceDeclaration && !isDefaultImport(node)) {
                        // import * as n from "mod";
                        variables.push(
                            factory.createVariableDeclaration(
                                factory.cloneNode(namespaceDeclaration.name),
                                /*exclamationToken*/ undefined,
                                /*type*/ undefined,
                                getHelperExpressionForImport(node, createRequireCall(node))
                            )
                        );
                    }
                    else {
                        // import d from "mod";
                        // import { x, y } from "mod";
                        // import d, { x, y } from "mod";
                        // import d, * as n from "mod";
                        variables.push(
                            factory.createVariableDeclaration(
                                factory.getGeneratedNameForNode(node),
                                /*exclamationToken*/ undefined,
                                /*type*/ undefined,
                                getHelperExpressionForImport(node, createRequireCall(node))
                            )
                        );

                        if (namespaceDeclaration && isDefaultImport(node)) {
                            variables.push(
                                factory.createVariableDeclaration(
                                    factory.cloneNode(namespaceDeclaration.name),
                                    /*exclamationToken*/ undefined,
                                    /*type*/ undefined,
                                    factory.getGeneratedNameForNode(node)
                                )
                            );
                        }
                    }

                    statements = append(statements,
                        setOriginalNode(
                            setTextRange(
                                factory.createVariableStatement(
                                    /*modifiers*/ undefined,
                                    factory.createVariableDeclarationList(
                                        variables,
                                        languageVersion >= ScriptTarget.ES2015 ? NodeFlags.Const : NodeFlags.None
                                    )
                                ),
                                /*location*/ node),
                            /*original*/ node
                        )
                    );
                }
            }
            else if (namespaceDeclaration && isDefaultImport(node)) {
                // import d, * as n from "mod";
                statements = append(statements,
                    factory.createVariableStatement(
                        /*modifiers*/ undefined,
                        factory.createVariableDeclarationList(
                            [
                                setOriginalNode(
                                    setTextRange(
                                        factory.createVariableDeclaration(
                                            factory.cloneNode(namespaceDeclaration.name),
                                            /*exclamationToken*/ undefined,
                                            /*type*/ undefined,
                                            factory.getGeneratedNameForNode(node)
                                        ),
                                        /*location*/ node),
                                    /*original*/ node
                                )
                            ],
                            languageVersion >= ScriptTarget.ES2015 ? NodeFlags.Const : NodeFlags.None
                        )
                    )
                );
            }

            if (hasAssociatedEndOfDeclarationMarker(node)) {
                // Defer exports until we encounter an EndOfDeclarationMarker node
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportsOfImportDeclaration(deferredExports[id], node);
            }
            else {
                statements = appendExportsOfImportDeclaration(statements, node);
            }

            return singleOrMany(statements);
        }

        /**
         * Creates a `require()` call to import an external module.
         *
         * @param importNode The declararation to import.
         */
        function createRequireCall(importNode: ImportDeclaration | ImportEqualsDeclaration | ExportDeclaration) {
            const moduleName = getExternalModuleNameLiteral(factory, importNode, currentSourceFile, host, resolver, compilerOptions);
            const args: Expression[] = [];
            if (moduleName) {
                args.push(moduleName);
            }

            return factory.createCallExpression(factory.createIdentifier("require"), /*typeArguments*/ undefined, args);
        }

        /**
         * Visits an ImportEqualsDeclaration node.
         *
         * @param node The node to visit.
         */
        function visitImportEqualsDeclaration(node: ImportEqualsDeclaration): VisitResult<Statement> {
            Debug.assert(isExternalModuleImportEqualsDeclaration(node), "import= for internal module references should be handled in an earlier transformer.");

            let statements: Statement[] | undefined;
            if (moduleKind !== ModuleKind.AMD) {
                if (hasSyntacticModifier(node, ModifierFlags.Export)) {
                    statements = append(statements,
                        setOriginalNode(
                            setTextRange(
                                factory.createExpressionStatement(
                                    createExportExpression(
                                        node.name,
                                        createRequireCall(node)
                                    )
                                ),
                                node),
                            node
                        )
                    );
                }
                else {
                    statements = append(statements,
                        setOriginalNode(
                            setTextRange(
                                factory.createVariableStatement(
                                    /*modifiers*/ undefined,
                                    factory.createVariableDeclarationList(
                                        [
                                            factory.createVariableDeclaration(
                                                factory.cloneNode(node.name),
                                                /*exclamationToken*/ undefined,
                                                /*type*/ undefined,
                                                createRequireCall(node)
                                            )
                                        ],
                                        /*flags*/ languageVersion >= ScriptTarget.ES2015 ? NodeFlags.Const : NodeFlags.None
                                    )
                                ),
                                node),
                            node
                        )
                    );
                }
            }
            else {
                if (hasSyntacticModifier(node, ModifierFlags.Export)) {
                    statements = append(statements,
                        setOriginalNode(
                            setTextRange(
                                factory.createExpressionStatement(
                                    createExportExpression(factory.getExportName(node), factory.getLocalName(node))
                                ),
                                node),
                            node
                        )
                    );
                }
            }

            if (hasAssociatedEndOfDeclarationMarker(node)) {
                // Defer exports until we encounter an EndOfDeclarationMarker node
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportsOfImportEqualsDeclaration(deferredExports[id], node);
            }
            else {
                statements = appendExportsOfImportEqualsDeclaration(statements, node);
            }

            return singleOrMany(statements);
        }

        /**
         * Visits an ExportDeclaration node.
         *
         * @param The node to visit.
         */
        function visitExportDeclaration(node: ExportDeclaration): VisitResult<Statement> {
            if (!node.moduleSpecifier) {
                // Elide export declarations with no module specifier as they are handled
                // elsewhere.
                return undefined;
            }

            const generatedName = factory.getGeneratedNameForNode(node);

            if (node.exportClause && isNamedExports(node.exportClause)) {
                const statements: Statement[] = [];
                // export { x, y } from "mod";
                if (moduleKind !== ModuleKind.AMD) {
                    statements.push(
                        setOriginalNode(
                            setTextRange(
                                factory.createVariableStatement(
                                    /*modifiers*/ undefined,
                                    factory.createVariableDeclarationList([
                                        factory.createVariableDeclaration(
                                            generatedName,
                                            /*exclamationToken*/ undefined,
                                            /*type*/ undefined,
                                            createRequireCall(node)
                                        )
                                    ])
                                ),
                                /*location*/ node),
                            /* original */ node
                        )
                    );
                }
                for (const specifier of node.exportClause.elements) {
                    if (languageVersion === ScriptTarget.ES3) {
                        statements.push(
                            setOriginalNode(
                                setTextRange(
                                    factory.createExpressionStatement(
                                        emitHelpers().createCreateBindingHelper(generatedName, factory.createStringLiteralFromNode(specifier.propertyName || specifier.name), specifier.propertyName ? factory.createStringLiteralFromNode(specifier.name) : undefined)
                                    ),
                                    specifier),
                                specifier
                            )
                        );
                    }
                    else {
                        const exportNeedsImportDefault =
                            !!getESModuleInterop(compilerOptions) &&
                            !(getEmitFlags(node) & EmitFlags.NeverApplyImportHelper) &&
                            idText(specifier.propertyName || specifier.name) === "default";
                        const exportedValue = factory.createPropertyAccessExpression(
                            exportNeedsImportDefault ? emitHelpers().createImportDefaultHelper(generatedName) : generatedName,
                            specifier.propertyName || specifier.name);
                        statements.push(
                            setOriginalNode(
                                setTextRange(
                                    factory.createExpressionStatement(
                                        createExportExpression(factory.getExportName(specifier), exportedValue, /* location */ undefined, /* liveBinding */ true)
                                    ),
                                    specifier),
                                specifier
                            )
                        );
                    }
                }

                return singleOrMany(statements);
            }
            else if (node.exportClause) {
                const statements: Statement[] = [];
                // export * as ns from "mod";
                // export * as default from "mod";
                statements.push(
                    setOriginalNode(
                        setTextRange(
                            factory.createExpressionStatement(
                                createExportExpression(
                                    factory.cloneNode(node.exportClause.name),
                                    getHelperExpressionForExport(node, moduleKind !== ModuleKind.AMD ?
                                        createRequireCall(node) :
                                        isExportNamespaceAsDefaultDeclaration(node) ? generatedName :
                                            factory.createIdentifier(idText(node.exportClause.name)))
                                )
                            ),
                            node
                        ),
                        node
                    )
                );

                return singleOrMany(statements);
            }
            else {
                // export * from "mod";
                return setOriginalNode(
                    setTextRange(
                        factory.createExpressionStatement(
                            emitHelpers().createExportStarHelper(moduleKind !== ModuleKind.AMD ? createRequireCall(node) : generatedName)
                        ),
                        node),
                    node
                );
            }
        }

        /**
         * Visits an ExportAssignment node.
         *
         * @param node The node to visit.
         */
        function visitExportAssignment(node: ExportAssignment): VisitResult<Statement> {
            if (node.isExportEquals) {
                return undefined;
            }

            let statements: Statement[] | undefined;
            const original = node.original;
            if (original && hasAssociatedEndOfDeclarationMarker(original)) {
                // Defer exports until we encounter an EndOfDeclarationMarker node
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportStatement(deferredExports[id], factory.createIdentifier("default"), visitNode(node.expression, visitor), /*location*/ node, /*allowComments*/ true);
            }
            else {
                statements = appendExportStatement(statements, factory.createIdentifier("default"), visitNode(node.expression, visitor), /*location*/ node, /*allowComments*/ true);
            }

            return singleOrMany(statements);
        }

        /**
         * Visits a FunctionDeclaration node.
         *
         * @param node The node to visit.
         */
        function visitFunctionDeclaration(node: FunctionDeclaration): VisitResult<Statement> {
            let statements: Statement[] | undefined;
            if (hasSyntacticModifier(node, ModifierFlags.Export)) {
                statements = append(statements,
                    setOriginalNode(
                        setTextRange(
                            factory.createFunctionDeclaration(
                                visitNodes(node.modifiers, modifierVisitor, isModifier),
                                node.asteriskToken,
                                factory.getDeclarationName(node, /*allowComments*/ true, /*allowSourceMaps*/ true),
                                /*typeParameters*/ undefined,
                                visitNodes(node.parameters, visitor),
                                /*type*/ undefined,
                                visitEachChild(node.body, visitor, context)
                            ),
                            /*location*/ node
                        ),
                        /*original*/ node
                    )
                );
            }
            else {
                statements = append(statements, visitEachChild(node, visitor, context));
            }

            if (hasAssociatedEndOfDeclarationMarker(node)) {
                // Defer exports until we encounter an EndOfDeclarationMarker node
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportsOfHoistedDeclaration(deferredExports[id], node);
            }
            else {
                statements = appendExportsOfHoistedDeclaration(statements, node);
            }

            return singleOrMany(statements);
        }

        /**
         * Visits a ClassDeclaration node.
         *
         * @param node The node to visit.
         */
        function visitClassDeclaration(node: ClassDeclaration): VisitResult<Statement> {
            let statements: Statement[] | undefined;
            if (hasSyntacticModifier(node, ModifierFlags.Export)) {
                statements = append(statements,
                    setOriginalNode(
                        setTextRange(
                            factory.createClassDeclaration(
                                visitNodes(node.modifiers, modifierVisitor, isModifierLike),
                                factory.getDeclarationName(node, /*allowComments*/ true, /*allowSourceMaps*/ true),
                                /*typeParameters*/ undefined,
                                visitNodes(node.heritageClauses, visitor),
                                visitNodes(node.members, visitor)
                            ),
                            node
                        ),
                        node
                    )
                );
            }
            else {
                statements = append(statements, visitEachChild(node, visitor, context));
            }

            if (hasAssociatedEndOfDeclarationMarker(node)) {
                // Defer exports until we encounter an EndOfDeclarationMarker node
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportsOfHoistedDeclaration(deferredExports[id], node);
            }
            else {
                statements = appendExportsOfHoistedDeclaration(statements, node);
            }

            return singleOrMany(statements);
        }

        /**
         * Visits a VariableStatement node.
         *
         * @param node The node to visit.
         */
        function visitVariableStatement(node: VariableStatement): VisitResult<Statement> {
            let statements: Statement[] | undefined;
            let variables: VariableDeclaration[] | undefined;
            let expressions: Expression[] | undefined;

            if (hasSyntacticModifier(node, ModifierFlags.Export)) {
                let modifiers: NodeArray<Modifier> | undefined;
                let removeCommentsOnExpressions = false;

                // If we're exporting these variables, then these just become assignments to 'exports.x'.
                for (const variable of node.declarationList.declarations) {
                    if (isIdentifier(variable.name) && isLocalName(variable.name)) {
                        if (!modifiers) {
                            modifiers = visitNodes(node.modifiers, modifierVisitor, isModifier);
                        }

                        variables = append(variables, variable);
                    }
                    else if (variable.initializer) {
                        if (!isBindingPattern(variable.name) && (isArrowFunction(variable.initializer) || isFunctionExpression(variable.initializer) || isClassExpression(variable.initializer))) {
                            const expression = factory.createAssignment(
                                setTextRange(
                                    factory.createPropertyAccessExpression(
                                        factory.createIdentifier("exports"),
                                        variable.name
                                    ),
                                    /*location*/ variable.name
                                ),
                                factory.createIdentifier(getTextOfIdentifierOrLiteral(variable.name))
                            );
                            const updatedVariable = factory.createVariableDeclaration(
                                variable.name,
                                variable.exclamationToken,
                                variable.type,
                                visitNode(variable.initializer, visitor)
                            );

                            variables = append(variables, updatedVariable);
                            expressions = append(expressions, expression);
                            removeCommentsOnExpressions = true;
                        }
                        else {
                            expressions = append(expressions, transformInitializedVariable(variable as InitializedVariableDeclaration));
                        }
                    }
                }

                if (variables) {
                    statements = append(statements, factory.updateVariableStatement(node, modifiers, factory.updateVariableDeclarationList(node.declarationList, variables)));
                }

                if (expressions) {
                    const statement = setOriginalNode(setTextRange(factory.createExpressionStatement(factory.inlineExpressions(expressions)), node), node);
                    if (removeCommentsOnExpressions) {
                        removeAllComments(statement);
                    }
                    statements = append(statements, statement);
                }
            }
            else {
                statements = append(statements, visitEachChild(node, visitor, context));
            }

            if (hasAssociatedEndOfDeclarationMarker(node)) {
                // Defer exports until we encounter an EndOfDeclarationMarker node
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportsOfVariableStatement(deferredExports[id], node);
            }
            else {
                statements = appendExportsOfVariableStatement(statements, node);
            }

            return singleOrMany(statements);
        }

        function createAllExportExpressions(name: Identifier, value: Expression, location?: TextRange) {
            const exportedNames = getExports(name);
            if (exportedNames) {
                // For each additional export of the declaration, apply an export assignment.
                let expression: Expression = isExportName(name) ? value : factory.createAssignment(name, value);
                for (const exportName of exportedNames) {
                    // Mark the node to prevent triggering substitution.
                    setEmitFlags(expression, EmitFlags.NoSubstitution);
                    expression = createExportExpression(exportName, expression, /*location*/ location);
                }

                return expression;
            }
            return factory.createAssignment(name, value);
        }

        /**
         * Transforms an exported variable with an initializer into an expression.
         *
         * @param node The node to transform.
         */
        function transformInitializedVariable(node: InitializedVariableDeclaration): Expression {
            if (isBindingPattern(node.name)) {
                return flattenDestructuringAssignment(
                    visitNode(node, visitor),
                    /*visitor*/ undefined,
                    context,
                    FlattenLevel.All,
                    /*needsValue*/ false,
                    createAllExportExpressions
                );
            }
            else {
                return factory.createAssignment(
                    setTextRange(
                        factory.createPropertyAccessExpression(
                            factory.createIdentifier("exports"),
                            node.name
                        ),
                        /*location*/ node.name
                    ),
                    node.initializer ? visitNode(node.initializer, visitor) : factory.createVoidZero()
                );
            }
        }

        /**
         * Visits a MergeDeclarationMarker used as a placeholder for the beginning of a merged
         * and transformed declaration.
         *
         * @param node The node to visit.
         */
        function visitMergeDeclarationMarker(node: MergeDeclarationMarker): VisitResult<Statement> {
            // For an EnumDeclaration or ModuleDeclaration that merges with a preceeding
            // declaration we do not emit a leading variable declaration. To preserve the
            // begin/end semantics of the declararation and to properly handle exports
            // we wrapped the leading variable declaration in a `MergeDeclarationMarker`.
            //
            // To balance the declaration, add the exports of the elided variable
            // statement.
            if (hasAssociatedEndOfDeclarationMarker(node) && node.original!.kind === SyntaxKind.VariableStatement) {
                const id = getOriginalNodeId(node);
                deferredExports[id] = appendExportsOfVariableStatement(deferredExports[id], node.original as VariableStatement);
            }

            return node;
        }

        /**
         * Determines whether a node has an associated EndOfDeclarationMarker.
         *
         * @param node The node to test.
         */
        function hasAssociatedEndOfDeclarationMarker(node: Node) {
            return (getEmitFlags(node) & EmitFlags.HasEndOfDeclarationMarker) !== 0;
        }

        /**
         * Visits a DeclarationMarker used as a placeholder for the end of a transformed
         * declaration.
         *
         * @param node The node to visit.
         */
        function visitEndOfDeclarationMarker(node: EndOfDeclarationMarker): VisitResult<Statement> {
            // For some transformations we emit an `EndOfDeclarationMarker` to mark the actual
            // end of the transformed declaration. We use this marker to emit any deferred exports
            // of the declaration.
            const id = getOriginalNodeId(node);
            const statements = deferredExports[id];
            if (statements) {
                delete deferredExports[id];
                return append(statements, node);
            }

            return node;
        }

        /**
         * Appends the exports of an ImportDeclaration to a statement list, returning the
         * statement list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param decl The declaration whose exports are to be recorded.
         */
        function appendExportsOfImportDeclaration(statements: Statement[] | undefined, decl: ImportDeclaration): Statement[] | undefined {
            if (currentModuleInfo.exportEquals) {
                return statements;
            }

            const importClause = decl.importClause;
            if (!importClause) {
                return statements;
            }

            if (importClause.name) {
                statements = appendExportsOfDeclaration(statements, importClause);
            }

            const namedBindings = importClause.namedBindings;
            if (namedBindings) {
                switch (namedBindings.kind) {
                    case SyntaxKind.NamespaceImport:
                        statements = appendExportsOfDeclaration(statements, namedBindings);
                        break;

                    case SyntaxKind.NamedImports:
                        for (const importBinding of namedBindings.elements) {
                            statements = appendExportsOfDeclaration(statements, importBinding, /* liveBinding */ true);
                        }

                        break;
                }
            }

            return statements;
        }

        /**
         * Appends the exports of an ImportEqualsDeclaration to a statement list, returning the
         * statement list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param decl The declaration whose exports are to be recorded.
         */
        function appendExportsOfImportEqualsDeclaration(statements: Statement[] | undefined, decl: ImportEqualsDeclaration): Statement[] | undefined {
            if (currentModuleInfo.exportEquals) {
                return statements;
            }

            return appendExportsOfDeclaration(statements, decl);
        }

        /**
         * Appends the exports of a VariableStatement to a statement list, returning the statement
         * list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param node The VariableStatement whose exports are to be recorded.
         */
        function appendExportsOfVariableStatement(statements: Statement[] | undefined, node: VariableStatement): Statement[] | undefined {
            if (currentModuleInfo.exportEquals) {
                return statements;
            }

            for (const decl of node.declarationList.declarations) {
                statements = appendExportsOfBindingElement(statements, decl);
            }

            return statements;
        }

        /**
         * Appends the exports of a VariableDeclaration or BindingElement to a statement list,
         * returning the statement list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param decl The declaration whose exports are to be recorded.
         */
        function appendExportsOfBindingElement(statements: Statement[] | undefined, decl: VariableDeclaration | BindingElement): Statement[] | undefined {
            if (currentModuleInfo.exportEquals) {
                return statements;
            }

            if (isBindingPattern(decl.name)) {
                for (const element of decl.name.elements) {
                    if (!isOmittedExpression(element)) {
                        statements = appendExportsOfBindingElement(statements, element);
                    }
                }
            }
            else if (!isGeneratedIdentifier(decl.name)) {
                statements = appendExportsOfDeclaration(statements, decl);
            }

            return statements;
        }

        /**
         * Appends the exports of a ClassDeclaration or FunctionDeclaration to a statement list,
         * returning the statement list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param decl The declaration whose exports are to be recorded.
         */
        function appendExportsOfHoistedDeclaration(statements: Statement[] | undefined, decl: ClassDeclaration | FunctionDeclaration): Statement[] | undefined {
            if (currentModuleInfo.exportEquals) {
                return statements;
            }

            if (hasSyntacticModifier(decl, ModifierFlags.Export)) {
                const exportName = hasSyntacticModifier(decl, ModifierFlags.Default) ? factory.createIdentifier("default") : factory.getDeclarationName(decl);
                statements = appendExportStatement(statements, exportName, factory.getLocalName(decl), /*location*/ decl);
            }

            if (decl.name) {
                statements = appendExportsOfDeclaration(statements, decl);
            }

            return statements;
        }

        /**
         * Appends the exports of a declaration to a statement list, returning the statement list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param decl The declaration to export.
         */
        function appendExportsOfDeclaration(statements: Statement[] | undefined, decl: Declaration, liveBinding?: boolean): Statement[] | undefined {
            const name = factory.getDeclarationName(decl);
            // TSPLUS EXTENSION START
            let exportSpecifiers = currentModuleInfo.exportSpecifiers.get(idText(name));
            exportSpecifiers ||= [];
            if (currentModuleInfo.generatedExportSpecifiers) {
                if (currentModuleInfo.generatedExportSpecifiers.has(name)) {
                    exportSpecifiers = concatenate(exportSpecifiers, currentModuleInfo.generatedExportSpecifiers.get(name)!)
                }
            }
            // TSPLUS EXTENSION END
            for (const exportSpecifier of exportSpecifiers) {
                statements = appendExportStatement(statements, exportSpecifier.name, name, /*location*/ exportSpecifier.name, /* allowComments */ undefined, liveBinding);
            }
            // TSPLUS EXTENSION START
            if (isNamedDeclaration(decl) && isIdentifier(decl.name) && isTsPlusUniqueIdentifier(decl.name) && currentModuleInfo.generatedExportSpecifiers) {
                if (currentModuleInfo.generatedExportSpecifiers.has(decl.name)) {
                    for (const exportSpecifier of currentModuleInfo.generatedExportSpecifiers.get(decl.name)!) {
                        statements = appendExportStatement(statements, exportSpecifier.name, decl.name, exportSpecifier.name, undefined, liveBinding);
                    }
                }
            }
            // TSPLUS EXTENSION END
            return statements;
        }

        /**
         * Appends the down-level representation of an export to a statement list, returning the
         * statement list.
         *
         * @param statements A statement list to which the down-level export statements are to be
         * appended. If `statements` is `undefined`, a new array is allocated if statements are
         * appended.
         * @param exportName The name of the export.
         * @param expression The expression to export.
         * @param location The location to use for source maps and comments for the export.
         * @param allowComments Whether to allow comments on the export.
         */
        function appendExportStatement(statements: Statement[] | undefined, exportName: Identifier, expression: Expression, location?: TextRange, allowComments?: boolean, liveBinding?: boolean): Statement[] | undefined {
            statements = append(statements, createExportStatement(exportName, expression, location, allowComments, liveBinding));
            return statements;
        }

        function createUnderscoreUnderscoreESModule() {
            let statement: Statement;
            if (languageVersion === ScriptTarget.ES3) {
                statement = factory.createExpressionStatement(
                    createExportExpression(
                        factory.createIdentifier("__esModule"),
                        factory.createTrue()
                    )
                );
            }
            else {
                statement = factory.createExpressionStatement(
                    factory.createCallExpression(
                        factory.createPropertyAccessExpression(factory.createIdentifier("Object"), "defineProperty"),
                        /*typeArguments*/ undefined,
                        [
                            factory.createIdentifier("exports"),
                            factory.createStringLiteral("__esModule"),
                            factory.createObjectLiteralExpression([
                                factory.createPropertyAssignment("value", factory.createTrue())
                            ])
                        ]
                    )
                );
            }
            setEmitFlags(statement, EmitFlags.CustomPrologue);
            return statement;
        }

        /**
         * Creates a call to the current file's export function to export a value.
         *
         * @param name The bound name of the export.
         * @param value The exported value.
         * @param location The location to use for source maps and comments for the export.
         * @param allowComments An optional value indicating whether to emit comments for the statement.
         */
        function createExportStatement(name: Identifier, value: Expression, location?: TextRange, allowComments?: boolean, liveBinding?: boolean) {
            const statement = setTextRange(factory.createExpressionStatement(createExportExpression(name, value, /* location */ undefined, liveBinding)), location);
            startOnNewLine(statement);
            if (!allowComments) {
                setEmitFlags(statement, EmitFlags.NoComments);
            }

            return statement;
        }

        /**
         * Creates a call to the current file's export function to export a value.
         *
         * @param name The bound name of the export.
         * @param value The exported value.
         * @param location The location to use for source maps and comments for the export.
         */
        function createExportExpression(name: Identifier, value: Expression, location?: TextRange, liveBinding?: boolean) {
            return setTextRange(
                liveBinding && languageVersion !== ScriptTarget.ES3 ? factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                        factory.createIdentifier("Object"),
                        "defineProperty"
                    ),
                    /*typeArguments*/ undefined,
                    [
                        factory.createIdentifier("exports"),
                        factory.createStringLiteralFromNode(name),
                        factory.createObjectLiteralExpression([
                            factory.createPropertyAssignment("enumerable", factory.createTrue()),
                            factory.createPropertyAssignment("get", factory.createFunctionExpression(
                                /*modifiers*/ undefined,
                                /*asteriskToken*/ undefined,
                                /*name*/ undefined,
                                /*typeParameters*/ undefined,
                                /*parameters*/ [],
                                /*type*/ undefined,
                                factory.createBlock([factory.createReturnStatement(value)])
                            ))
                        ])
                    ]
                ) : factory.createAssignment(
                    factory.createPropertyAccessExpression(
                        factory.createIdentifier("exports"),
                        factory.cloneNode(name)
                    ),
                    value
                ),
                location
            );
        }

        //
        // Modifier Visitors
        //

        /**
         * Visit nodes to elide module-specific modifiers.
         *
         * @param node The node to visit.
         */
        function modifierVisitor(node: Node): VisitResult<Node> {
            // Elide module-specific modifiers.
            switch (node.kind) {
                case SyntaxKind.ExportKeyword:
                case SyntaxKind.DefaultKeyword:
                    return undefined;
            }

            return node;
        }

        //
        // Emit Notification
        //

        /**
         * Hook for node emit notifications.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to emit.
         * @param emit A callback used to emit the node in the printer.
         */
        function onEmitNode(hint: EmitHint, node: Node, emitCallback: (hint: EmitHint, node: Node) => void): void {
            if (node.kind === SyntaxKind.SourceFile) {
                currentSourceFile = node as SourceFile;
                currentModuleInfo = moduleInfoMap[getOriginalNodeId(currentSourceFile)];

                previousOnEmitNode(hint, node, emitCallback);

                currentSourceFile = undefined!;
                currentModuleInfo = undefined!;
            }
            else {
                previousOnEmitNode(hint, node, emitCallback);
            }
        }

        //
        // Substitutions
        //

        /**
         * Hooks node substitutions.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to substitute.
         */
        function onSubstituteNode(hint: EmitHint, node: Node) {
            node = previousOnSubstituteNode(hint, node);
            if (node.id && noSubstitution[node.id]) {
                return node;
            }

            if (hint === EmitHint.Expression) {
                return substituteExpression(node as Expression);
            }
            else if (isShorthandPropertyAssignment(node)) {
                return substituteShorthandPropertyAssignment(node);
            }

            return node;
        }

        /**
         * Substitution for a ShorthandPropertyAssignment whose declaration name is an imported
         * or exported symbol.
         *
         * @param node The node to substitute.
         */
        function substituteShorthandPropertyAssignment(node: ShorthandPropertyAssignment): ObjectLiteralElementLike {
            const name = node.name;
            const exportedOrImportedName = substituteExpressionIdentifier(name);
            if (exportedOrImportedName !== name) {
                // A shorthand property with an assignment initializer is probably part of a
                // destructuring assignment
                if (node.objectAssignmentInitializer) {
                    const initializer = factory.createAssignment(exportedOrImportedName, node.objectAssignmentInitializer);
                    return setTextRange(factory.createPropertyAssignment(name, initializer), node);
                }
                return setTextRange(factory.createPropertyAssignment(name, exportedOrImportedName), node);
            }
            return node;
        }

        /**
         * Substitution for an Expression that may contain an imported or exported symbol.
         *
         * @param node The node to substitute.
         */
        function substituteExpression(node: Expression) {
            switch (node.kind) {
                case SyntaxKind.Identifier:
                    return substituteExpressionIdentifier(node as Identifier);
                case SyntaxKind.CallExpression:
                    return substituteCallExpression(node as CallExpression);
                case SyntaxKind.TaggedTemplateExpression:
                    return substituteTaggedTemplateExpression(node as TaggedTemplateExpression);
                case SyntaxKind.BinaryExpression:
                    return substituteBinaryExpression(node as BinaryExpression);
            }

            return node;
        }

        function substituteCallExpression(node: CallExpression) {
            if (isIdentifier(node.expression)) {
                const expression = substituteExpressionIdentifier(node.expression);
                noSubstitution[getNodeId(expression)] = true;
                if (!isIdentifier(expression) && !(getEmitFlags(node.expression) & EmitFlags.HelperName)) {
                    return addEmitFlags(
                        factory.updateCallExpression(node,
                            expression,
                            /*typeArguments*/ undefined,
                            node.arguments
                        ),
                        EmitFlags.IndirectCall
                    );

                }
            }
            return node;
        }

        function substituteTaggedTemplateExpression(node: TaggedTemplateExpression) {
            if (isIdentifier(node.tag)) {
                const tag = substituteExpressionIdentifier(node.tag);
                noSubstitution[getNodeId(tag)] = true;
                if (!isIdentifier(tag) && !(getEmitFlags(node.tag) & EmitFlags.HelperName)) {
                    return addEmitFlags(
                        factory.updateTaggedTemplateExpression(node,
                            tag,
                            /*typeArguments*/ undefined,
                            node.template
                        ),
                        EmitFlags.IndirectCall
                    );
                }
            }
            return node;
        }

        /**
         * Substitution for an Identifier expression that may contain an imported or exported
         * symbol.
         *
         * @param node The node to substitute.
         */
        function substituteExpressionIdentifier(node: Identifier): Expression {
            if (getEmitFlags(node) & EmitFlags.HelperName) {
                const externalHelpersModuleName = getExternalHelpersModuleName(currentSourceFile);
                if (externalHelpersModuleName) {
                    return factory.createPropertyAccessExpression(externalHelpersModuleName, node);
                }
                return node;
            }
            else if (!(isGeneratedIdentifier(node) && !(node.autoGenerateFlags & GeneratedIdentifierFlags.AllowNameSubstitution)) && !isLocalName(node)) {
                const exportContainer = resolver.getReferencedExportContainer(node, isExportName(node));
                if (exportContainer && exportContainer.kind === SyntaxKind.SourceFile) {
                    return setTextRange(
                        factory.createPropertyAccessExpression(
                            factory.createIdentifier("exports"),
                            factory.cloneNode(node)
                        ),
                        /*location*/ node
                    );
                }
                const importDeclaration = resolver.getReferencedImportDeclaration(node);
                if (importDeclaration) {
                    if (isImportClause(importDeclaration)) {
                        return setTextRange(
                            factory.createPropertyAccessExpression(
                                factory.getGeneratedNameForNode(importDeclaration.parent),
                                factory.createIdentifier("default")
                            ),
                            /*location*/ node
                        );
                    }
                    else if (isImportSpecifier(importDeclaration)) {
                        const name = importDeclaration.propertyName || importDeclaration.name;
                        return setTextRange(
                            factory.createPropertyAccessExpression(
                                factory.getGeneratedNameForNode(importDeclaration.parent?.parent?.parent || importDeclaration),
                                factory.cloneNode(name)
                            ),
                            /*location*/ node
                        );
                    }
                }
            }
            return node;
        }

        /**
         * Substitution for a BinaryExpression that may contain an imported or exported symbol.
         *
         * @param node The node to substitute.
         */
        function substituteBinaryExpression(node: BinaryExpression): Expression {
            // When we see an assignment expression whose left-hand side is an exported symbol,
            // we should ensure all exports of that symbol are updated with the correct value.
            //
            // - We do not substitute generated identifiers for any reason.
            // - We do not substitute identifiers tagged with the LocalName flag.
            // - We do not substitute identifiers that were originally the name of an enum or
            //   namespace due to how they are transformed in TypeScript.
            // - We only substitute identifiers that are exported at the top level.
            if (isAssignmentOperator(node.operatorToken.kind)
                && isIdentifier(node.left)
                && !isGeneratedIdentifier(node.left)
                && !isLocalName(node.left)
                && !isDeclarationNameOfEnumOrNamespace(node.left)) {
                const exportedNames = getExports(node.left);
                if (exportedNames) {
                    // For each additional export of the declaration, apply an export assignment.
                    let expression: Expression = node;
                    for (const exportName of exportedNames) {
                        // Mark the node to prevent triggering this rule again.
                        noSubstitution[getNodeId(expression)] = true;
                        expression = createExportExpression(exportName, expression, /*location*/ node);
                    }

                    return expression;
                }
            }

            return node;
        }

        /**
         * Gets the additional exports of a name.
         *
         * @param name The name.
         */
        function getExports(name: Identifier): Identifier[] | undefined {
            if (!isGeneratedIdentifier(name)) {
                const valueDeclaration = resolver.getReferencedImportDeclaration(name)
                    || resolver.getReferencedValueDeclaration(name);
                if (valueDeclaration) {
                    return currentModuleInfo
                        && currentModuleInfo.exportedBindings[getOriginalNodeId(valueDeclaration)];
                }
            }
        }
    }

    // emit helper for dynamic import
    const dynamicImportUMDHelper: EmitHelper = {
        name: "typescript:dynamicimport-sync-require",
        scoped: true,
        text: `
            var __syncRequire = typeof module === "object" && typeof module.exports === "object";`
    };
}
