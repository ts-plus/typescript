/* @internal */
namespace ts {

    // Compound nodes

    export function createEmptyExports(factory: NodeFactory) {
        return factory.createExportDeclaration(/*modifiers*/ undefined, /*isTypeOnly*/ false, factory.createNamedExports([]), /*moduleSpecifier*/ undefined);
    }

    export function createMemberAccessForPropertyName(factory: NodeFactory, target: Expression, memberName: PropertyName, location?: TextRange): MemberExpression {
        if (isComputedPropertyName(memberName)) {
             return setTextRange(factory.createElementAccessExpression(target, memberName.expression), location);
        }
        else {
            const expression = setTextRange(
                isMemberName(memberName)
                    ? factory.createPropertyAccessExpression(target, memberName)
                    : factory.createElementAccessExpression(target, memberName),
                memberName
            );
            getOrCreateEmitNode(expression).flags |= EmitFlags.NoNestedSourceMaps;
            return expression;
        }
    }

    function createReactNamespace(reactNamespace: string, parent: JsxOpeningLikeElement | JsxOpeningFragment) {
        // To ensure the emit resolver can properly resolve the namespace, we need to
        // treat this identifier as if it were a source tree node by clearing the `Synthesized`
        // flag and setting a parent node.
        const react = parseNodeFactory.createIdentifier(reactNamespace || "React");
        // Set the parent that is in parse tree
        // this makes sure that parent chain is intact for checker to traverse complete scope tree
        setParent(react, getParseTreeNode(parent));
        return react;
    }

    function createJsxFactoryExpressionFromEntityName(factory: NodeFactory, jsxFactory: EntityName, parent: JsxOpeningLikeElement | JsxOpeningFragment): Expression {
        if (isQualifiedName(jsxFactory)) {
            const left = createJsxFactoryExpressionFromEntityName(factory, jsxFactory.left, parent);
            const right = factory.createIdentifier(idText(jsxFactory.right)) as Mutable<Identifier>;
            right.escapedText = jsxFactory.right.escapedText;
            return factory.createPropertyAccessExpression(left, right);
        }
        else {
            return createReactNamespace(idText(jsxFactory), parent);
        }
    }

    export function createJsxFactoryExpression(factory: NodeFactory, jsxFactoryEntity: EntityName | undefined, reactNamespace: string, parent: JsxOpeningLikeElement | JsxOpeningFragment): Expression {
        return jsxFactoryEntity ?
            createJsxFactoryExpressionFromEntityName(factory, jsxFactoryEntity, parent) :
            factory.createPropertyAccessExpression(
                createReactNamespace(reactNamespace, parent),
                "createElement"
            );
    }

    function createJsxFragmentFactoryExpression(factory: NodeFactory, jsxFragmentFactoryEntity: EntityName | undefined, reactNamespace: string, parent: JsxOpeningLikeElement | JsxOpeningFragment): Expression {
        return jsxFragmentFactoryEntity ?
            createJsxFactoryExpressionFromEntityName(factory, jsxFragmentFactoryEntity, parent) :
            factory.createPropertyAccessExpression(
                createReactNamespace(reactNamespace, parent),
                "Fragment"
            );
    }

    export function createExpressionForJsxElement(factory: NodeFactory, callee: Expression, tagName: Expression, props: Expression | undefined, children: readonly Expression[] | undefined, location: TextRange): LeftHandSideExpression {
        const argumentsList = [tagName];
        if (props) {
            argumentsList.push(props);
        }

        if (children && children.length > 0) {
            if (!props) {
                argumentsList.push(factory.createNull());
            }

            if (children.length > 1) {
                for (const child of children) {
                    startOnNewLine(child);
                    argumentsList.push(child);
                }
            }
            else {
                argumentsList.push(children[0]);
            }
        }

        return setTextRange(
            factory.createCallExpression(
                callee,
                /*typeArguments*/ undefined,
                argumentsList
            ),
            location
        );
    }

    export function createExpressionForJsxFragment(factory: NodeFactory, jsxFactoryEntity: EntityName | undefined, jsxFragmentFactoryEntity: EntityName | undefined, reactNamespace: string, children: readonly Expression[], parentElement: JsxOpeningFragment, location: TextRange): LeftHandSideExpression {
        const tagName = createJsxFragmentFactoryExpression(factory, jsxFragmentFactoryEntity, reactNamespace, parentElement);
        const argumentsList = [tagName, factory.createNull()];

        if (children && children.length > 0) {
            if (children.length > 1) {
                for (const child of children) {
                    startOnNewLine(child);
                    argumentsList.push(child);
                }
            }
            else {
                argumentsList.push(children[0]);
            }
        }

        return setTextRange(
            factory.createCallExpression(
                createJsxFactoryExpression(factory, jsxFactoryEntity, reactNamespace, parentElement),
                /*typeArguments*/ undefined,
                argumentsList
            ),
            location
        );
    }

    // Utilities

    export function createForOfBindingStatement(factory: NodeFactory, node: ForInitializer, boundValue: Expression): Statement {
        if (isVariableDeclarationList(node)) {
            const firstDeclaration = first(node.declarations);
            const updatedDeclaration = factory.updateVariableDeclaration(
                firstDeclaration,
                firstDeclaration.name,
                /*exclamationToken*/ undefined,
                /*type*/ undefined,
                boundValue
            );
            return setTextRange(
                factory.createVariableStatement(
                    /*modifiers*/ undefined,
                    factory.updateVariableDeclarationList(node, [updatedDeclaration])
                ),
                /*location*/ node
            );
        }
        else {
            const updatedExpression = setTextRange(factory.createAssignment(node, boundValue), /*location*/ node);
            return setTextRange(factory.createExpressionStatement(updatedExpression), /*location*/ node);
        }
    }

    export function insertLeadingStatement(factory: NodeFactory, dest: Statement, source: Statement) {
        if (isBlock(dest)) {
            return factory.updateBlock(dest, setTextRange(factory.createNodeArray([source, ...dest.statements]), dest.statements));
        }
        else {
            return factory.createBlock(factory.createNodeArray([dest, source]), /*multiLine*/ true);
        }
    }

    export function createExpressionFromEntityName(factory: NodeFactory, node: EntityName | Expression): Expression {
        if (isQualifiedName(node)) {
            const left = createExpressionFromEntityName(factory, node.left);
            // TODO(rbuckton): Does this need to be parented?
            const right = setParent(setTextRange(factory.cloneNode(node.right), node.right), node.right.parent);
            return setTextRange(factory.createPropertyAccessExpression(left, right), node);
        }
        else {
            // TODO(rbuckton): Does this need to be parented?
            return setParent(setTextRange(factory.cloneNode(node), node), node.parent);
        }
    }

    export function createExpressionForPropertyName(factory: NodeFactory, memberName: Exclude<PropertyName, PrivateIdentifier>): Expression {
        if (isIdentifier(memberName)) {
            return factory.createStringLiteralFromNode(memberName);
        }
        else if (isComputedPropertyName(memberName)) {
            // TODO(rbuckton): Does this need to be parented?
            return setParent(setTextRange(factory.cloneNode(memberName.expression), memberName.expression), memberName.expression.parent);
        }
        else {
            // TODO(rbuckton): Does this need to be parented?
            return setParent(setTextRange(factory.cloneNode(memberName), memberName), memberName.parent);
        }
    }

    function createExpressionForAccessorDeclaration(factory: NodeFactory, properties: NodeArray<Declaration>, property: AccessorDeclaration & { readonly name: Exclude<PropertyName, PrivateIdentifier>; }, receiver: Expression, multiLine: boolean) {
        const { firstAccessor, getAccessor, setAccessor } = getAllAccessorDeclarations(properties, property);
        if (property === firstAccessor) {
            return setTextRange(
                factory.createObjectDefinePropertyCall(
                    receiver,
                    createExpressionForPropertyName(factory, property.name),
                    factory.createPropertyDescriptor({
                        enumerable: factory.createFalse(),
                        configurable: true,
                        get: getAccessor && setTextRange(
                            setOriginalNode(
                                factory.createFunctionExpression(
                                    getModifiers(getAccessor),
                                    /*asteriskToken*/ undefined,
                                    /*name*/ undefined,
                                    /*typeParameters*/ undefined,
                                    getAccessor.parameters,
                                    /*type*/ undefined,
                                    getAccessor.body! // TODO: GH#18217
                                ),
                                getAccessor
                            ),
                            getAccessor
                        ),
                        set: setAccessor && setTextRange(
                            setOriginalNode(
                                factory.createFunctionExpression(
                                    getModifiers(setAccessor),
                                    /*asteriskToken*/ undefined,
                                    /*name*/ undefined,
                                    /*typeParameters*/ undefined,
                                    setAccessor.parameters,
                                    /*type*/ undefined,
                                    setAccessor.body! // TODO: GH#18217
                                ),
                                setAccessor
                            ),
                            setAccessor
                        )
                    }, !multiLine)
                ),
                firstAccessor
            );
        }

        return undefined;
    }

    function createExpressionForPropertyAssignment(factory: NodeFactory, property: PropertyAssignment, receiver: Expression) {
        return setOriginalNode(
            setTextRange(
                factory.createAssignment(
                    createMemberAccessForPropertyName(factory, receiver, property.name, /*location*/ property.name),
                    property.initializer
                ),
                property
            ),
            property
        );
    }

    function createExpressionForShorthandPropertyAssignment(factory: NodeFactory, property: ShorthandPropertyAssignment, receiver: Expression) {
        return setOriginalNode(
            setTextRange(
                factory.createAssignment(
                    createMemberAccessForPropertyName(factory, receiver, property.name, /*location*/ property.name),
                    factory.cloneNode(property.name)
                ),
                /*location*/ property
            ),
            /*original*/ property
        );
    }

    function createExpressionForMethodDeclaration(factory: NodeFactory, method: MethodDeclaration, receiver: Expression) {
        return setOriginalNode(
            setTextRange(
                factory.createAssignment(
                    createMemberAccessForPropertyName(factory, receiver, method.name, /*location*/ method.name),
                    setOriginalNode(
                        setTextRange(
                            factory.createFunctionExpression(
                                getModifiers(method),
                                method.asteriskToken,
                                /*name*/ undefined,
                                /*typeParameters*/ undefined,
                                method.parameters,
                                /*type*/ undefined,
                                method.body! // TODO: GH#18217
                            ),
                            /*location*/ method
                        ),
                        /*original*/ method
                    )
                ),
                /*location*/ method
            ),
            /*original*/ method
        );
    }

    export function createExpressionForObjectLiteralElementLike(factory: NodeFactory, node: ObjectLiteralExpression, property: ObjectLiteralElementLike, receiver: Expression): Expression | undefined {
        if (property.name && isPrivateIdentifier(property.name)) {
            Debug.failBadSyntaxKind(property.name, "Private identifiers are not allowed in object literals.");
        }
        switch (property.kind) {
            case SyntaxKind.GetAccessor:
            case SyntaxKind.SetAccessor:
                return createExpressionForAccessorDeclaration(factory, node.properties, property as typeof property & { readonly name: Exclude<PropertyName, PrivateIdentifier> }, receiver, !!node.multiLine);
            case SyntaxKind.PropertyAssignment:
                return createExpressionForPropertyAssignment(factory, property, receiver);
            case SyntaxKind.ShorthandPropertyAssignment:
                return createExpressionForShorthandPropertyAssignment(factory, property, receiver);
            case SyntaxKind.MethodDeclaration:
                return createExpressionForMethodDeclaration(factory, property, receiver);
        }
    }

    /**
     * Expand the read and increment/decrement operations a pre- or post-increment or pre- or post-decrement expression.
     *
     * ```ts
     * // input
     * <expression>++
     * // output (if result is not discarded)
     * var <temp>;
     * (<temp> = <expression>, <resultVariable> = <temp>++, <temp>)
     * // output (if result is discarded)
     * var <temp>;
     * (<temp> = <expression>, <temp>++, <temp>)
     *
     * // input
     * ++<expression>
     * // output (if result is not discarded)
     * var <temp>;
     * (<temp> = <expression>, <resultVariable> = ++<temp>)
     * // output (if result is discarded)
     * var <temp>;
     * (<temp> = <expression>, ++<temp>)
     * ```
     *
     * It is up to the caller to supply a temporary variable for `<resultVariable>` if one is needed.
     * The temporary variable `<temp>` is injected so that `++` and `--` work uniformly with `number` and `bigint`.
     * The result of the expression is always the final result of incrementing or decrementing the expression, so that it can be used for storage.
     *
     * @param factory {@link NodeFactory} used to create the expanded representation.
     * @param node The original prefix or postfix unary node.
     * @param expression The expression to use as the value to increment or decrement
     * @param resultVariable A temporary variable in which to store the result. Pass `undefined` if the result is discarded, or if the value of `<temp>` is the expected result.
     */
    export function expandPreOrPostfixIncrementOrDecrementExpression(factory: NodeFactory, node: PrefixUnaryExpression | PostfixUnaryExpression, expression: Expression, recordTempVariable: (node: Identifier) => void, resultVariable: Identifier | undefined) {
        const operator = node.operator;
        Debug.assert(operator === SyntaxKind.PlusPlusToken || operator === SyntaxKind.MinusMinusToken, "Expected 'node' to be a pre- or post-increment or pre- or post-decrement expression");

        const temp = factory.createTempVariable(recordTempVariable);
        expression = factory.createAssignment(temp, expression);
        setTextRange(expression, node.operand);

        let operation: Expression = isPrefixUnaryExpression(node) ?
            factory.createPrefixUnaryExpression(operator, temp) :
            factory.createPostfixUnaryExpression(temp, operator);
        setTextRange(operation, node);

        if (resultVariable) {
            operation = factory.createAssignment(resultVariable, operation);
            setTextRange(operation, node);
        }

        expression = factory.createComma(expression, operation);
        setTextRange(expression, node);

        if (isPostfixUnaryExpression(node)) {
            expression = factory.createComma(expression, temp);
            setTextRange(expression, node);
        }

        return expression;
    }

    /**
     * Gets whether an identifier should only be referred to by its internal name.
     */
    export function isInternalName(node: Identifier) {
        return (getEmitFlags(node) & EmitFlags.InternalName) !== 0;
    }

    /**
     * Gets whether an identifier should only be referred to by its local name.
     */
    export function isLocalName(node: Identifier) {
        return (getEmitFlags(node) & EmitFlags.LocalName) !== 0;
    }

    /**
     * Gets whether an identifier should only be referred to by its export representation if the
     * name points to an exported symbol.
     */
    export function isExportName(node: Identifier) {
        return (getEmitFlags(node) & EmitFlags.ExportName) !== 0;
    }

    function isUseStrictPrologue(node: ExpressionStatement): boolean {
        return isStringLiteral(node.expression) && node.expression.text === "use strict";
    }

    export function findUseStrictPrologue(statements: readonly Statement[]): Statement | undefined {
        for (const statement of statements) {
            if (isPrologueDirective(statement)) {
                if (isUseStrictPrologue(statement)) {
                    return statement;
                }
            }
            else {
                break;
            }
        }
        return undefined;
    }

    export function startsWithUseStrict(statements: readonly Statement[]) {
        const firstStatement = firstOrUndefined(statements);
        return firstStatement !== undefined
            && isPrologueDirective(firstStatement)
            && isUseStrictPrologue(firstStatement);
    }

    export function isCommaSequence(node: Expression): node is BinaryExpression & {operatorToken: Token<SyntaxKind.CommaToken>} | CommaListExpression {
        return node.kind === SyntaxKind.BinaryExpression && (node as BinaryExpression).operatorToken.kind === SyntaxKind.CommaToken ||
            node.kind === SyntaxKind.CommaListExpression;
    }

    export function isJSDocTypeAssertion(node: Node): node is JSDocTypeAssertion {
        return isParenthesizedExpression(node)
            && isInJSFile(node)
            && !!getJSDocTypeTag(node);
    }

    export function getJSDocTypeAssertionType(node: JSDocTypeAssertion) {
        const type = getJSDocType(node);
        Debug.assertIsDefined(type);
        return type;
    }

    export function isOuterExpression(node: Node, kinds = OuterExpressionKinds.All): node is OuterExpression {
        switch (node.kind) {
            case SyntaxKind.ParenthesizedExpression:
                if (kinds & OuterExpressionKinds.ExcludeJSDocTypeAssertion && isJSDocTypeAssertion(node)) {
                    return false;
                }
                return (kinds & OuterExpressionKinds.Parentheses) !== 0;
            case SyntaxKind.TypeAssertionExpression:
            case SyntaxKind.AsExpression:
            case SyntaxKind.SatisfiesExpression:
                return (kinds & OuterExpressionKinds.TypeAssertions) !== 0;
            case SyntaxKind.NonNullExpression:
                return (kinds & OuterExpressionKinds.NonNullAssertions) !== 0;
            case SyntaxKind.PartiallyEmittedExpression:
                return (kinds & OuterExpressionKinds.PartiallyEmittedExpressions) !== 0;
        }
        return false;
    }

    export function skipOuterExpressions(node: Expression, kinds?: OuterExpressionKinds): Expression;
    export function skipOuterExpressions(node: Node, kinds?: OuterExpressionKinds): Node;
    export function skipOuterExpressions(node: Node, kinds = OuterExpressionKinds.All) {
        while (isOuterExpression(node, kinds)) {
            node = node.expression;
        }
        return node;
    }

    export function skipAssertions(node: Expression): Expression;
    export function skipAssertions(node: Node): Node;
    export function skipAssertions(node: Node): Node {
        return skipOuterExpressions(node, OuterExpressionKinds.Assertions);
    }

    export function startOnNewLine<T extends Node>(node: T): T {
        return setStartsOnNewLine(node, /*newLine*/ true);
    }

    export function getExternalHelpersModuleName(node: SourceFile) {
        const parseNode = getOriginalNode(node, isSourceFile);
        const emitNode = parseNode && parseNode.emitNode;
        return emitNode && emitNode.externalHelpersModuleName;
    }

    export function hasRecordedExternalHelpers(sourceFile: SourceFile) {
        const parseNode = getOriginalNode(sourceFile, isSourceFile);
        const emitNode = parseNode && parseNode.emitNode;
        return !!emitNode && (!!emitNode.externalHelpersModuleName || !!emitNode.externalHelpers);
    }

    export function createExternalHelpersImportDeclarationIfNeeded(nodeFactory: NodeFactory, helperFactory: EmitHelperFactory, sourceFile: SourceFile, compilerOptions: CompilerOptions, hasExportStarsToExportValues?: boolean, hasImportStar?: boolean, hasImportDefault?: boolean) {
        if (compilerOptions.importHelpers && isEffectiveExternalModule(sourceFile, compilerOptions)) {
            let namedBindings: NamedImportBindings | undefined;
            const moduleKind = getEmitModuleKind(compilerOptions);
            if ((moduleKind >= ModuleKind.ES2015 && moduleKind <= ModuleKind.ESNext) || sourceFile.impliedNodeFormat === ModuleKind.ESNext) {
                // use named imports
                const helpers = getEmitHelpers(sourceFile);
                if (helpers) {
                    const helperNames: string[] = [];
                    for (const helper of helpers) {
                        if (!helper.scoped) {
                            const importName = helper.importName;
                            if (importName) {
                                pushIfUnique(helperNames, importName);
                            }
                        }
                    }
                    if (some(helperNames)) {
                        helperNames.sort(compareStringsCaseSensitive);
                        // Alias the imports if the names are used somewhere in the file.
                        // NOTE: We don't need to care about global import collisions as this is a module.
                        namedBindings = nodeFactory.createNamedImports(
                            map(helperNames, name => isFileLevelUniqueName(sourceFile, name)
                                ? nodeFactory.createImportSpecifier(/*isTypeOnly*/ false, /*propertyName*/ undefined, nodeFactory.createIdentifier(name))
                                : nodeFactory.createImportSpecifier(/*isTypeOnly*/ false, nodeFactory.createIdentifier(name), helperFactory.getUnscopedHelperName(name))
                            )
                        );
                        const parseNode = getOriginalNode(sourceFile, isSourceFile);
                        const emitNode = getOrCreateEmitNode(parseNode);
                        emitNode.externalHelpers = true;
                    }
                }
            }
            else {
                // use a namespace import
                const externalHelpersModuleName = getOrCreateExternalHelpersModuleNameIfNeeded(nodeFactory, sourceFile, compilerOptions, hasExportStarsToExportValues, hasImportStar || hasImportDefault);
                if (externalHelpersModuleName) {
                    namedBindings = nodeFactory.createNamespaceImport(externalHelpersModuleName);
                }
            }
            if (namedBindings) {
                const externalHelpersImportDeclaration = nodeFactory.createImportDeclaration(
                    /*modifiers*/ undefined,
                    nodeFactory.createImportClause(/*isTypeOnly*/ false, /*name*/ undefined, namedBindings),
                    nodeFactory.createStringLiteral(externalHelpersModuleNameText),
                     /*assertClause*/ undefined
                );
                addEmitFlags(externalHelpersImportDeclaration, EmitFlags.NeverApplyImportHelper);
                return externalHelpersImportDeclaration;
            }
        }
    }

    export function getOrCreateExternalHelpersModuleNameIfNeeded(factory: NodeFactory, node: SourceFile, compilerOptions: CompilerOptions, hasExportStarsToExportValues?: boolean, hasImportStarOrImportDefault?: boolean) {
        if (compilerOptions.importHelpers && isEffectiveExternalModule(node, compilerOptions)) {
            const externalHelpersModuleName = getExternalHelpersModuleName(node);
            if (externalHelpersModuleName) {
                return externalHelpersModuleName;
            }

            const moduleKind = getEmitModuleKind(compilerOptions);
            let create = (hasExportStarsToExportValues || (getESModuleInterop(compilerOptions) && hasImportStarOrImportDefault))
                && moduleKind !== ModuleKind.System
                && (moduleKind < ModuleKind.ES2015 || node.impliedNodeFormat === ModuleKind.CommonJS);
            if (!create) {
                const helpers = getEmitHelpers(node);
                if (helpers) {
                    for (const helper of helpers) {
                        if (!helper.scoped) {
                            create = true;
                            break;
                        }
                    }
                }
            }

            if (create) {
                const parseNode = getOriginalNode(node, isSourceFile);
                const emitNode = getOrCreateEmitNode(parseNode);
                return emitNode.externalHelpersModuleName || (emitNode.externalHelpersModuleName = factory.createUniqueName(externalHelpersModuleNameText));
            }
        }
    }

    /**
     * Get the name of that target module from an import or export declaration
     */
    export function getLocalNameForExternalImport(factory: NodeFactory, node: ImportDeclaration | ExportDeclaration | ImportEqualsDeclaration, sourceFile: SourceFile): Identifier | undefined {
        const namespaceDeclaration = getNamespaceDeclarationNode(node);
        if (namespaceDeclaration && !isDefaultImport(node) && !isExportNamespaceAsDefaultDeclaration(node)) {
            const name = namespaceDeclaration.name;
            return isGeneratedIdentifier(name) ? name : factory.createIdentifier(getSourceTextOfNodeFromSourceFile(sourceFile, name) || idText(name));
        }
        if (node.kind === SyntaxKind.ImportDeclaration && node.importClause) {
            return factory.getGeneratedNameForNode(node);
        }
        if (node.kind === SyntaxKind.ExportDeclaration && node.moduleSpecifier) {
            return factory.getGeneratedNameForNode(node);
        }
        return undefined;
    }

    /**
     * Get the name of a target module from an import/export declaration as should be written in the emitted output.
     * The emitted output name can be different from the input if:
     *  1. The module has a /// <amd-module name="<new name>" />
     *  2. --out or --outFile is used, making the name relative to the rootDir
     *  3- The containing SourceFile has an entry in renamedDependencies for the import as requested by some module loaders (e.g. System).
     * Otherwise, a new StringLiteral node representing the module name will be returned.
     */
    export function getExternalModuleNameLiteral(factory: NodeFactory, importNode: ImportDeclaration | ExportDeclaration | ImportEqualsDeclaration | ImportCall, sourceFile: SourceFile, host: EmitHost, resolver: EmitResolver, compilerOptions: CompilerOptions) {
        const moduleName = getExternalModuleName(importNode);
        if (moduleName && isStringLiteral(moduleName)) {
            return tryGetModuleNameFromDeclaration(importNode, host, factory, resolver, compilerOptions)
                || tryRenameExternalModule(factory, moduleName, sourceFile)
                || factory.cloneNode(moduleName);
        }

        return undefined;
    }

    /**
     * Some bundlers (SystemJS builder) sometimes want to rename dependencies.
     * Here we check if alternative name was provided for a given moduleName and return it if possible.
     */
    function tryRenameExternalModule(factory: NodeFactory, moduleName: LiteralExpression, sourceFile: SourceFile) {
        const rename = sourceFile.renamedDependencies && sourceFile.renamedDependencies.get(moduleName.text);
        return rename ? factory.createStringLiteral(rename) : undefined;
    }

    /**
     * Get the name of a module as should be written in the emitted output.
     * The emitted output name can be different from the input if:
     *  1. The module has a /// <amd-module name="<new name>" />
     *  2. --out or --outFile is used, making the name relative to the rootDir
     * Otherwise, a new StringLiteral node representing the module name will be returned.
     */
    export function tryGetModuleNameFromFile(factory: NodeFactory, file: SourceFile | undefined, host: EmitHost, options: CompilerOptions): StringLiteral | undefined {
        if (!file) {
            return undefined;
        }
        if (file.moduleName) {
            return factory.createStringLiteral(file.moduleName);
        }
        if (!file.isDeclarationFile && outFile(options)) {
            return factory.createStringLiteral(getExternalModuleNameFromPath(host, file.fileName));
        }
        return undefined;
    }

    function tryGetModuleNameFromDeclaration(declaration: ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ImportCall, host: EmitHost, factory: NodeFactory, resolver: EmitResolver, compilerOptions: CompilerOptions) {
        return tryGetModuleNameFromFile(factory, resolver.getExternalModuleFileFromDeclaration(declaration), host, compilerOptions);
    }

    /**
     * Gets the initializer of an BindingOrAssignmentElement.
     */
    export function getInitializerOfBindingOrAssignmentElement(bindingElement: BindingOrAssignmentElement): Expression | undefined {
        if (isDeclarationBindingElement(bindingElement)) {
            // `1` in `let { a = 1 } = ...`
            // `1` in `let { a: b = 1 } = ...`
            // `1` in `let { a: {b} = 1 } = ...`
            // `1` in `let { a: [b] = 1 } = ...`
            // `1` in `let [a = 1] = ...`
            // `1` in `let [{a} = 1] = ...`
            // `1` in `let [[a] = 1] = ...`
            return bindingElement.initializer;
        }

        if (isPropertyAssignment(bindingElement)) {
            // `1` in `({ a: b = 1 } = ...)`
            // `1` in `({ a: {b} = 1 } = ...)`
            // `1` in `({ a: [b] = 1 } = ...)`
            const initializer = bindingElement.initializer;
            return isAssignmentExpression(initializer, /*excludeCompoundAssignment*/ true)
                ? initializer.right
                : undefined;
        }

        if (isShorthandPropertyAssignment(bindingElement)) {
            // `1` in `({ a = 1 } = ...)`
            return bindingElement.objectAssignmentInitializer;
        }

        if (isAssignmentExpression(bindingElement, /*excludeCompoundAssignment*/ true)) {
            // `1` in `[a = 1] = ...`
            // `1` in `[{a} = 1] = ...`
            // `1` in `[[a] = 1] = ...`
            return bindingElement.right;
        }

        if (isSpreadElement(bindingElement)) {
            // Recovery consistent with existing emit.
            return getInitializerOfBindingOrAssignmentElement(bindingElement.expression as BindingOrAssignmentElement);
        }
    }

    /**
     * Gets the name of an BindingOrAssignmentElement.
     */
    export function getTargetOfBindingOrAssignmentElement(bindingElement: BindingOrAssignmentElement): BindingOrAssignmentElementTarget | undefined {
        if (isDeclarationBindingElement(bindingElement)) {
            // `a` in `let { a } = ...`
            // `a` in `let { a = 1 } = ...`
            // `b` in `let { a: b } = ...`
            // `b` in `let { a: b = 1 } = ...`
            // `a` in `let { ...a } = ...`
            // `{b}` in `let { a: {b} } = ...`
            // `{b}` in `let { a: {b} = 1 } = ...`
            // `[b]` in `let { a: [b] } = ...`
            // `[b]` in `let { a: [b] = 1 } = ...`
            // `a` in `let [a] = ...`
            // `a` in `let [a = 1] = ...`
            // `a` in `let [...a] = ...`
            // `{a}` in `let [{a}] = ...`
            // `{a}` in `let [{a} = 1] = ...`
            // `[a]` in `let [[a]] = ...`
            // `[a]` in `let [[a] = 1] = ...`
            return bindingElement.name;
        }

        if (isObjectLiteralElementLike(bindingElement)) {
            switch (bindingElement.kind) {
                case SyntaxKind.PropertyAssignment:
                    // `b` in `({ a: b } = ...)`
                    // `b` in `({ a: b = 1 } = ...)`
                    // `{b}` in `({ a: {b} } = ...)`
                    // `{b}` in `({ a: {b} = 1 } = ...)`
                    // `[b]` in `({ a: [b] } = ...)`
                    // `[b]` in `({ a: [b] = 1 } = ...)`
                    // `b.c` in `({ a: b.c } = ...)`
                    // `b.c` in `({ a: b.c = 1 } = ...)`
                    // `b[0]` in `({ a: b[0] } = ...)`
                    // `b[0]` in `({ a: b[0] = 1 } = ...)`
                    return getTargetOfBindingOrAssignmentElement(bindingElement.initializer as BindingOrAssignmentElement);

                case SyntaxKind.ShorthandPropertyAssignment:
                    // `a` in `({ a } = ...)`
                    // `a` in `({ a = 1 } = ...)`
                    return bindingElement.name;

                case SyntaxKind.SpreadAssignment:
                    // `a` in `({ ...a } = ...)`
                    return getTargetOfBindingOrAssignmentElement(bindingElement.expression as BindingOrAssignmentElement);
            }

            // no target
            return undefined;
        }

        if (isAssignmentExpression(bindingElement, /*excludeCompoundAssignment*/ true)) {
            // `a` in `[a = 1] = ...`
            // `{a}` in `[{a} = 1] = ...`
            // `[a]` in `[[a] = 1] = ...`
            // `a.b` in `[a.b = 1] = ...`
            // `a[0]` in `[a[0] = 1] = ...`
            return getTargetOfBindingOrAssignmentElement(bindingElement.left as BindingOrAssignmentElement);
        }

        if (isSpreadElement(bindingElement)) {
            // `a` in `[...a] = ...`
            return getTargetOfBindingOrAssignmentElement(bindingElement.expression as BindingOrAssignmentElement);
        }

        // `a` in `[a] = ...`
        // `{a}` in `[{a}] = ...`
        // `[a]` in `[[a]] = ...`
        // `a.b` in `[a.b] = ...`
        // `a[0]` in `[a[0]] = ...`
        return bindingElement;
    }

    /**
     * Determines whether an BindingOrAssignmentElement is a rest element.
     */
    export function getRestIndicatorOfBindingOrAssignmentElement(bindingElement: BindingOrAssignmentElement): BindingOrAssignmentElementRestIndicator | undefined {
        switch (bindingElement.kind) {
            case SyntaxKind.Parameter:
            case SyntaxKind.BindingElement:
                // `...` in `let [...a] = ...`
                return bindingElement.dotDotDotToken;

            case SyntaxKind.SpreadElement:
            case SyntaxKind.SpreadAssignment:
                // `...` in `[...a] = ...`
                return bindingElement;
        }

        return undefined;
    }

    /**
     * Gets the property name of a BindingOrAssignmentElement
     */
    export function getPropertyNameOfBindingOrAssignmentElement(bindingElement: BindingOrAssignmentElement): Exclude<PropertyName, PrivateIdentifier> | undefined {
        const propertyName = tryGetPropertyNameOfBindingOrAssignmentElement(bindingElement);
        Debug.assert(!!propertyName || isSpreadAssignment(bindingElement), "Invalid property name for binding element.");
        return propertyName;
    }

    export function tryGetPropertyNameOfBindingOrAssignmentElement(bindingElement: BindingOrAssignmentElement): Exclude<PropertyName, PrivateIdentifier> | undefined {
        switch (bindingElement.kind) {
            case SyntaxKind.BindingElement:
                // `a` in `let { a: b } = ...`
                // `[a]` in `let { [a]: b } = ...`
                // `"a"` in `let { "a": b } = ...`
                // `1` in `let { 1: b } = ...`
                if (bindingElement.propertyName) {
                    const propertyName = bindingElement.propertyName;
                    if (isPrivateIdentifier(propertyName)) {
                        return Debug.failBadSyntaxKind(propertyName);
                    }
                    return isComputedPropertyName(propertyName) && isStringOrNumericLiteral(propertyName.expression)
                        ? propertyName.expression
                        : propertyName;
                }

                break;

            case SyntaxKind.PropertyAssignment:
                // `a` in `({ a: b } = ...)`
                // `[a]` in `({ [a]: b } = ...)`
                // `"a"` in `({ "a": b } = ...)`
                // `1` in `({ 1: b } = ...)`
                if (bindingElement.name) {
                    const propertyName = bindingElement.name;
                    if (isPrivateIdentifier(propertyName)) {
                        return Debug.failBadSyntaxKind(propertyName);
                    }
                    return isComputedPropertyName(propertyName) && isStringOrNumericLiteral(propertyName.expression)
                        ? propertyName.expression
                        : propertyName;
                }

                break;

            case SyntaxKind.SpreadAssignment:
                // `a` in `({ ...a } = ...)`
                if (bindingElement.name && isPrivateIdentifier(bindingElement.name)) {
                    return Debug.failBadSyntaxKind(bindingElement.name);
                }
                return bindingElement.name;
        }

        const target = getTargetOfBindingOrAssignmentElement(bindingElement);
        if (target && isPropertyName(target)) {
            return target;
        }
    }

    function isStringOrNumericLiteral(node: Node): node is StringLiteral | NumericLiteral {
        const kind = node.kind;
        return kind === SyntaxKind.StringLiteral
            || kind === SyntaxKind.NumericLiteral;
    }

    /**
     * Gets the elements of a BindingOrAssignmentPattern
     */
    export function getElementsOfBindingOrAssignmentPattern(name: BindingOrAssignmentPattern): readonly BindingOrAssignmentElement[] {
        switch (name.kind) {
            case SyntaxKind.ObjectBindingPattern:
            case SyntaxKind.ArrayBindingPattern:
            case SyntaxKind.ArrayLiteralExpression:
                // `a` in `{a}`
                // `a` in `[a]`
                return name.elements as readonly BindingOrAssignmentElement[];

            case SyntaxKind.ObjectLiteralExpression:
                // `a` in `{a}`
                return name.properties as readonly BindingOrAssignmentElement[];
        }
    }

    /* @internal */
    export function getJSDocTypeAliasName(fullName: JSDocNamespaceBody | undefined) {
        if (fullName) {
            let rightNode = fullName;
            while (true) {
                if (isIdentifier(rightNode) || !rightNode.body) {
                    return isIdentifier(rightNode) ? rightNode : rightNode.name;
                }
                rightNode = rightNode.body;
            }
        }
    }

    export function canHaveIllegalType(node: Node): node is HasIllegalType {
        const kind = node.kind;
        return kind === SyntaxKind.Constructor
            || kind === SyntaxKind.SetAccessor;
    }

    export function canHaveIllegalTypeParameters(node: Node): node is HasIllegalTypeParameters {
        const kind = node.kind;
        return kind === SyntaxKind.Constructor
            || kind === SyntaxKind.GetAccessor
            || kind === SyntaxKind.SetAccessor;
    }

    export function canHaveIllegalDecorators(node: Node): node is HasIllegalDecorators {
        const kind = node.kind;
        return kind === SyntaxKind.PropertyAssignment
            || kind === SyntaxKind.ShorthandPropertyAssignment
            || kind === SyntaxKind.FunctionDeclaration
            || kind === SyntaxKind.Constructor
            || kind === SyntaxKind.IndexSignature
            || kind === SyntaxKind.ClassStaticBlockDeclaration
            || kind === SyntaxKind.MissingDeclaration
            || kind === SyntaxKind.VariableStatement
            || kind === SyntaxKind.InterfaceDeclaration
            || kind === SyntaxKind.TypeAliasDeclaration
            || kind === SyntaxKind.EnumDeclaration
            || kind === SyntaxKind.ModuleDeclaration
            || kind === SyntaxKind.ImportEqualsDeclaration
            || kind === SyntaxKind.ImportDeclaration
            || kind === SyntaxKind.NamespaceExportDeclaration
            || kind === SyntaxKind.ExportDeclaration
            || kind === SyntaxKind.ExportAssignment;
    }

    export function canHaveIllegalModifiers(node: Node): node is HasIllegalModifiers {
        const kind = node.kind;
        return kind === SyntaxKind.ClassStaticBlockDeclaration
            || kind === SyntaxKind.PropertyAssignment
            || kind === SyntaxKind.ShorthandPropertyAssignment
            || kind === SyntaxKind.FunctionType
            || kind === SyntaxKind.MissingDeclaration
            || kind === SyntaxKind.NamespaceExportDeclaration;
    }

    export const isTypeNodeOrTypeParameterDeclaration = or(isTypeNode, isTypeParameterDeclaration) as (node: Node) => node is TypeNode | TypeParameterDeclaration;
    export const isQuestionOrExclamationToken = or(isQuestionToken, isExclamationToken) as (node: Node) => node is QuestionToken | ExclamationToken;
    export const isIdentifierOrThisTypeNode = or(isIdentifier, isThisTypeNode) as (node: Node) => node is Identifier | ThisTypeNode;
    export const isReadonlyKeywordOrPlusOrMinusToken = or(isReadonlyKeyword, isPlusToken, isMinusToken) as (node: Node) => node is ReadonlyKeyword | PlusToken | MinusToken;
    export const isQuestionOrPlusOrMinusToken = or(isQuestionToken, isPlusToken, isMinusToken) as (node: Node) => node is QuestionToken | PlusToken | MinusToken;
    export const isModuleName = or(isIdentifier, isStringLiteral) as (node: Node) => node is ModuleName;

    export function isLiteralTypeLikeExpression(node: Node): node is NullLiteral | BooleanLiteral | LiteralExpression | PrefixUnaryExpression {
        const kind = node.kind;
        return kind === SyntaxKind.NullKeyword
            || kind === SyntaxKind.TrueKeyword
            || kind === SyntaxKind.FalseKeyword
            || isLiteralExpression(node)
            || isPrefixUnaryExpression(node);
    }

    function isExponentiationOperator(kind: SyntaxKind): kind is ExponentiationOperator {
        return kind === SyntaxKind.AsteriskAsteriskToken;
    }

    function isMultiplicativeOperator(kind: SyntaxKind): kind is MultiplicativeOperator {
        return kind === SyntaxKind.AsteriskToken
            || kind === SyntaxKind.SlashToken
            || kind === SyntaxKind.PercentToken;
    }

    function isMultiplicativeOperatorOrHigher(kind: SyntaxKind): kind is MultiplicativeOperatorOrHigher {
        return isExponentiationOperator(kind)
            || isMultiplicativeOperator(kind);
    }

    function isAdditiveOperator(kind: SyntaxKind): kind is AdditiveOperator {
        return kind === SyntaxKind.PlusToken
            || kind === SyntaxKind.MinusToken;
    }

    function isAdditiveOperatorOrHigher(kind: SyntaxKind): kind is AdditiveOperatorOrHigher {
        return isAdditiveOperator(kind)
            || isMultiplicativeOperatorOrHigher(kind);
    }

    function isShiftOperator(kind: SyntaxKind): kind is ShiftOperator {
        return kind === SyntaxKind.LessThanLessThanToken
            || kind === SyntaxKind.GreaterThanGreaterThanToken
            || kind === SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
    }

    function isShiftOperatorOrHigher(kind: SyntaxKind): kind is ShiftOperatorOrHigher {
        return isShiftOperator(kind)
            || isAdditiveOperatorOrHigher(kind);
    }

    function isRelationalOperator(kind: SyntaxKind): kind is RelationalOperator {
        return kind === SyntaxKind.LessThanToken
            || kind === SyntaxKind.LessThanEqualsToken
            || kind === SyntaxKind.GreaterThanToken
            || kind === SyntaxKind.GreaterThanEqualsToken
            || kind === SyntaxKind.InstanceOfKeyword
            || kind === SyntaxKind.InKeyword;
    }

    function isRelationalOperatorOrHigher(kind: SyntaxKind): kind is RelationalOperatorOrHigher {
        return isRelationalOperator(kind)
            || isShiftOperatorOrHigher(kind);
    }

    function isEqualityOperator(kind: SyntaxKind): kind is EqualityOperator {
        return kind === SyntaxKind.EqualsEqualsToken
            || kind === SyntaxKind.EqualsEqualsEqualsToken
            || kind === SyntaxKind.ExclamationEqualsToken
            || kind === SyntaxKind.ExclamationEqualsEqualsToken;
    }

    function isEqualityOperatorOrHigher(kind: SyntaxKind): kind is EqualityOperatorOrHigher {
        return isEqualityOperator(kind)
            || isRelationalOperatorOrHigher(kind);
    }

    function isBitwiseOperator(kind: SyntaxKind): kind is BitwiseOperator {
        return kind === SyntaxKind.AmpersandToken
            || kind === SyntaxKind.BarToken
            || kind === SyntaxKind.CaretToken;
    }

    function isBitwiseOperatorOrHigher(kind: SyntaxKind): kind is BitwiseOperatorOrHigher {
        return isBitwiseOperator(kind)
            || isEqualityOperatorOrHigher(kind);
    }

    // NOTE: The version in utilities includes ExclamationToken, which is not a binary operator.
    function isLogicalOperator(kind: SyntaxKind): kind is LogicalOperator {
        return kind === SyntaxKind.AmpersandAmpersandToken
            || kind === SyntaxKind.BarBarToken;
    }

    function isLogicalOperatorOrHigher(kind: SyntaxKind): kind is LogicalOperatorOrHigher {
        return isLogicalOperator(kind)
            || isBitwiseOperatorOrHigher(kind);
    }

    function isAssignmentOperatorOrHigher(kind: SyntaxKind): kind is AssignmentOperatorOrHigher {
        return kind === SyntaxKind.QuestionQuestionToken
            || isLogicalOperatorOrHigher(kind)
            || isAssignmentOperator(kind);
    }

    function isBinaryOperator(kind: SyntaxKind): kind is BinaryOperator {
        return isAssignmentOperatorOrHigher(kind)
            || kind === SyntaxKind.CommaToken;
    }

    export function isBinaryOperatorToken(node: Node): node is BinaryOperatorToken {
        return isBinaryOperator(node.kind);
    }

    type BinaryExpressionState = <TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], resultHolder: { value: TResult }, outerState: TOuterState) => number;

    namespace BinaryExpressionState {
        /**
         * Handles walking into a `BinaryExpression`.
         * @param machine State machine handler functions
         * @param frame The current frame
         * @returns The new frame
         */
        export function enter<TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], _resultHolder: { value: TResult }, outerState: TOuterState): number {
            const prevUserState = stackIndex > 0 ? userStateStack[stackIndex - 1] : undefined;
            Debug.assertEqual(stateStack[stackIndex], enter);
            userStateStack[stackIndex] = machine.onEnter(nodeStack[stackIndex], prevUserState, outerState);
            stateStack[stackIndex] = nextState(machine, enter);
            return stackIndex;
        }

        /**
         * Handles walking the `left` side of a `BinaryExpression`.
         * @param machine State machine handler functions
         * @param frame The current frame
         * @returns The new frame
         */
        export function left<TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], _resultHolder: { value: TResult }, _outerState: TOuterState): number {
            Debug.assertEqual(stateStack[stackIndex], left);
            Debug.assertIsDefined(machine.onLeft);
            stateStack[stackIndex] = nextState(machine, left);
            const nextNode = machine.onLeft(nodeStack[stackIndex].left, userStateStack[stackIndex], nodeStack[stackIndex]);
            if (nextNode) {
                checkCircularity(stackIndex, nodeStack, nextNode);
                return pushStack(stackIndex, stateStack, nodeStack, userStateStack, nextNode);
            }
            return stackIndex;
        }

        /**
         * Handles walking the `operatorToken` of a `BinaryExpression`.
         * @param machine State machine handler functions
         * @param frame The current frame
         * @returns The new frame
         */
        export function operator<TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], _resultHolder: { value: TResult }, _outerState: TOuterState): number {
            Debug.assertEqual(stateStack[stackIndex], operator);
            Debug.assertIsDefined(machine.onOperator);
            stateStack[stackIndex] = nextState(machine, operator);
            machine.onOperator(nodeStack[stackIndex].operatorToken, userStateStack[stackIndex], nodeStack[stackIndex]);
            return stackIndex;
        }

        /**
         * Handles walking the `right` side of a `BinaryExpression`.
         * @param machine State machine handler functions
         * @param frame The current frame
         * @returns The new frame
         */
        export function right<TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], _resultHolder: { value: TResult }, _outerState: TOuterState): number {
            Debug.assertEqual(stateStack[stackIndex], right);
            Debug.assertIsDefined(machine.onRight);
            stateStack[stackIndex] = nextState(machine, right);
            const nextNode = machine.onRight(nodeStack[stackIndex].right, userStateStack[stackIndex], nodeStack[stackIndex]);
            if (nextNode) {
                checkCircularity(stackIndex, nodeStack, nextNode);
                return pushStack(stackIndex, stateStack, nodeStack, userStateStack, nextNode);
            }
            return stackIndex;
        }

        /**
         * Handles walking out of a `BinaryExpression`.
         * @param machine State machine handler functions
         * @param frame The current frame
         * @returns The new frame
         */
        export function exit<TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], resultHolder: { value: TResult }, _outerState: TOuterState): number {
            Debug.assertEqual(stateStack[stackIndex], exit);
            stateStack[stackIndex] = nextState(machine, exit);
            const result = machine.onExit(nodeStack[stackIndex], userStateStack[stackIndex]);
            if (stackIndex > 0) {
                stackIndex--;
                if (machine.foldState) {
                    const side = stateStack[stackIndex] === exit ? "right" : "left";
                    userStateStack[stackIndex] = machine.foldState(userStateStack[stackIndex], result, side);
                }
            }
            else {
                resultHolder.value = result;
            }
            return stackIndex;
        }

        /**
         * Handles a frame that is already done.
         * @returns The `done` state.
         */
        export function done<TOuterState, TState, TResult>(_machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, stackIndex: number, stateStack: BinaryExpressionState[], _nodeStack: BinaryExpression[], _userStateStack: TState[], _resultHolder: { value: TResult }, _outerState: TOuterState): number {
            Debug.assertEqual(stateStack[stackIndex], done);
            return stackIndex;
        }

        export function nextState<TOuterState, TState, TResult>(machine: BinaryExpressionStateMachine<TOuterState, TState, TResult>, currentState: BinaryExpressionState) {
            switch (currentState) {
                case enter:
                    if (machine.onLeft) return left;
                    // falls through
                case left:
                    if (machine.onOperator) return operator;
                    // falls through
                case operator:
                    if (machine.onRight) return right;
                    // falls through
                case right: return exit;
                case exit: return done;
                case done: return done;
                default: Debug.fail("Invalid state");
            }
        }

        function pushStack<TState>(stackIndex: number, stateStack: BinaryExpressionState[], nodeStack: BinaryExpression[], userStateStack: TState[], node: BinaryExpression) {
            stackIndex++;
            stateStack[stackIndex] = enter;
            nodeStack[stackIndex] = node;
            userStateStack[stackIndex] = undefined!;
            return stackIndex;
        }

        function checkCircularity(stackIndex: number, nodeStack: BinaryExpression[], node: BinaryExpression) {
            if (Debug.shouldAssert(AssertionLevel.Aggressive)) {
                while (stackIndex >= 0) {
                    Debug.assert(nodeStack[stackIndex] !== node, "Circular traversal detected.");
                    stackIndex--;
                }
            }
        }
    }

    /**
     * Holds state machine handler functions
     */
    class BinaryExpressionStateMachine<TOuterState, TState, TResult> {
        constructor(
            readonly onEnter: (node: BinaryExpression, prev: TState | undefined, outerState: TOuterState) => TState,
            readonly onLeft: ((left: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
            readonly onOperator: ((operatorToken: BinaryOperatorToken, userState: TState, node: BinaryExpression) => void) | undefined,
            readonly onRight: ((right: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
            readonly onExit: (node: BinaryExpression, userState: TState) => TResult,
            readonly foldState: ((userState: TState, result: TResult, side: "left" | "right") => TState) | undefined,
        ) {
        }
    }

    /**
     * Creates a state machine that walks a `BinaryExpression` using the heap to reduce call-stack depth on a large tree.
     * @param onEnter Callback evaluated when entering a `BinaryExpression`. Returns new user-defined state to associate with the node while walking.
     * @param onLeft Callback evaluated when walking the left side of a `BinaryExpression`. Return a `BinaryExpression` to continue walking, or `void` to advance to the right side.
     * @param onRight Callback evaluated when walking the right side of a `BinaryExpression`. Return a `BinaryExpression` to continue walking, or `void` to advance to the end of the node.
     * @param onExit Callback evaluated when exiting a `BinaryExpression`. The result returned will either be folded into the parent's state, or returned from the walker if at the top frame.
     * @param foldState Callback evaluated when the result from a nested `onExit` should be folded into the state of that node's parent.
     * @returns A function that walks a `BinaryExpression` node using the above callbacks, returning the result of the call to `onExit` from the outermost `BinaryExpression` node.
     */
     export function createBinaryExpressionTrampoline<TState, TResult>(
        onEnter: (node: BinaryExpression, prev: TState | undefined) => TState,
        onLeft: ((left: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
        onOperator: ((operatorToken: BinaryOperatorToken, userState: TState, node: BinaryExpression) => void) | undefined,
        onRight: ((right: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
        onExit: (node: BinaryExpression, userState: TState) => TResult,
        foldState: ((userState: TState, result: TResult, side: "left" | "right") => TState) | undefined,
    ): (node: BinaryExpression) => TResult;
    /**
     * Creates a state machine that walks a `BinaryExpression` using the heap to reduce call-stack depth on a large tree.
     * @param onEnter Callback evaluated when entering a `BinaryExpression`. Returns new user-defined state to associate with the node while walking.
     * @param onLeft Callback evaluated when walking the left side of a `BinaryExpression`. Return a `BinaryExpression` to continue walking, or `void` to advance to the right side.
     * @param onRight Callback evaluated when walking the right side of a `BinaryExpression`. Return a `BinaryExpression` to continue walking, or `void` to advance to the end of the node.
     * @param onExit Callback evaluated when exiting a `BinaryExpression`. The result returned will either be folded into the parent's state, or returned from the walker if at the top frame.
     * @param foldState Callback evaluated when the result from a nested `onExit` should be folded into the state of that node's parent.
     * @returns A function that walks a `BinaryExpression` node using the above callbacks, returning the result of the call to `onExit` from the outermost `BinaryExpression` node.
     */
    export function createBinaryExpressionTrampoline<TOuterState, TState, TResult>(
        onEnter: (node: BinaryExpression, prev: TState | undefined, outerState: TOuterState) => TState,
        onLeft: ((left: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
        onOperator: ((operatorToken: BinaryOperatorToken, userState: TState, node: BinaryExpression) => void) | undefined,
        onRight: ((right: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
        onExit: (node: BinaryExpression, userState: TState) => TResult,
        foldState: ((userState: TState, result: TResult, side: "left" | "right") => TState) | undefined,
    ): (node: BinaryExpression, outerState: TOuterState) => TResult;
    export function createBinaryExpressionTrampoline<TOuterState, TState, TResult>(
        onEnter: (node: BinaryExpression, prev: TState | undefined, outerState: TOuterState) => TState,
        onLeft: ((left: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
        onOperator: ((operatorToken: BinaryOperatorToken, userState: TState, node: BinaryExpression) => void) | undefined,
        onRight: ((right: Expression, userState: TState, node: BinaryExpression) => BinaryExpression | void) | undefined,
        onExit: (node: BinaryExpression, userState: TState) => TResult,
        foldState: ((userState: TState, result: TResult, side: "left" | "right") => TState) | undefined,
    ) {
        const machine = new BinaryExpressionStateMachine(onEnter, onLeft, onOperator, onRight, onExit, foldState);
        return trampoline;

        function trampoline(node: BinaryExpression, outerState?: TOuterState) {
            const resultHolder: { value: TResult } = { value: undefined! };
            const stateStack: BinaryExpressionState[] = [BinaryExpressionState.enter];
            const nodeStack: BinaryExpression[] = [node];
            const userStateStack: TState[] = [undefined!];
            let stackIndex = 0;
            while (stateStack[stackIndex] !== BinaryExpressionState.done) {
                stackIndex = stateStack[stackIndex](machine, stackIndex, stateStack, nodeStack, userStateStack, resultHolder, outerState);
            }
            Debug.assertEqual(stackIndex, 0);
            return resultHolder.value;
        }
    }

    /**
     * If `nodes` is not undefined, creates an empty `NodeArray` that preserves the `pos` and `end` of `nodes`.
     * @internal
     */
    export function elideNodes<T extends Node>(factory: NodeFactory, nodes: NodeArray<T>): NodeArray<T>;
    export function elideNodes<T extends Node>(factory: NodeFactory, nodes: NodeArray<T> | undefined): NodeArray<T> | undefined;
    export function elideNodes<T extends Node>(factory: NodeFactory, nodes: NodeArray<T> | undefined): NodeArray<T> | undefined {
        if (nodes === undefined) return undefined;
        if (nodes.length === 0) return nodes;
        return setTextRange(factory.createNodeArray([], nodes.hasTrailingComma), nodes);
    }

    /**
     * Gets the node from which a name should be generated.
     */
    export function getNodeForGeneratedName(name: GeneratedIdentifier | GeneratedPrivateIdentifier) {
        if (name.autoGenerateFlags & GeneratedIdentifierFlags.Node) {
            const autoGenerateId = name.autoGenerateId;
            let node = name as Node;
            let original = node.original;
            while (original) {
                node = original;

                // if "node" is a different generated name (having a different "autoGenerateId"), use it and stop traversing.
                if (isMemberName(node)
                    && !!(node.autoGenerateFlags! & GeneratedIdentifierFlags.Node)
                    && node.autoGenerateId !== autoGenerateId) {
                    break;
                }

                original = node.original;
            }
            // otherwise, return the original node for the source
            return node;
        }
        return name;
    }

    /**
     * Formats a prefix or suffix of a generated name.
     */
    export function formatGeneratedNamePart(part: string | undefined): string;
    /**
     * Formats a prefix or suffix of a generated name. If the part is a {@link GeneratedNamePart}, calls {@link generateName} to format the source node.
     */
    export function formatGeneratedNamePart(part: string | GeneratedNamePart | undefined, generateName: (name: GeneratedIdentifier | GeneratedPrivateIdentifier) => string): string;
    export function formatGeneratedNamePart(part: string | GeneratedNamePart | undefined, generateName?: (name: GeneratedIdentifier | GeneratedPrivateIdentifier) => string): string {
        return typeof part === "object" ? formatGeneratedName(/*privateName*/ false, part.prefix, part.node, part.suffix, generateName!) :
            typeof part === "string" ? part.length > 0 && part.charCodeAt(0) === CharacterCodes.hash ? part.slice(1) : part :
            "";
    }

    function formatIdentifier(name: string | Identifier | PrivateIdentifier, generateName?: (name: GeneratedIdentifier | GeneratedPrivateIdentifier) => string) {
        return typeof name === "string" ? name :
            formatIdentifierWorker(name, Debug.checkDefined(generateName));
    }

    function formatIdentifierWorker(node: Identifier | PrivateIdentifier, generateName: (name: GeneratedIdentifier | GeneratedPrivateIdentifier) => string) {
        return isGeneratedPrivateIdentifier(node) ? generateName(node).slice(1) :
            isGeneratedIdentifier(node) ? generateName(node) :
            isPrivateIdentifier(node) ? (node.escapedText as string).slice(1) :
            idText(node);
    }

    /**
     * Formats a generated name.
     * @param privateName When `true`, inserts a `#` character at the start of the result.
     * @param prefix The prefix (if any) to include before the base name.
     * @param baseName The base name for the generated name.
     * @param suffix The suffix (if any) to include after the base name.
     */
    export function formatGeneratedName(privateName: boolean, prefix: string | undefined, baseName: string, suffix: string | undefined): string;
    /**
     * Formats a generated name.
     * @param privateName When `true`, inserts a `#` character at the start of the result.
     * @param prefix The prefix (if any) to include before the base name.
     * @param baseName The base name for the generated name.
     * @param suffix The suffix (if any) to include after the base name.
     * @param generateName Called to format the source node of {@link prefix} when it is a {@link GeneratedNamePart}.
     */
    export function formatGeneratedName(privateName: boolean, prefix: string | GeneratedNamePart | undefined, baseName: string | Identifier | PrivateIdentifier, suffix: string | GeneratedNamePart | undefined, generateName: (name: GeneratedIdentifier | GeneratedPrivateIdentifier) => string): string;
    export function formatGeneratedName(privateName: boolean, prefix: string | GeneratedNamePart | undefined, baseName: string | Identifier | PrivateIdentifier, suffix: string | GeneratedNamePart | undefined, generateName?: (name: GeneratedIdentifier | GeneratedPrivateIdentifier) => string) {
        prefix = formatGeneratedNamePart(prefix, generateName!);
        suffix = formatGeneratedNamePart(suffix, generateName!);
        baseName = formatIdentifier(baseName, generateName);
        return `${privateName ? "#" : ""}${prefix}${baseName}${suffix}`;
    }


    /**
     * Creates a private backing field for an `accessor` {@link PropertyDeclaration}.
     */
    export function createAccessorPropertyBackingField(factory: NodeFactory, node: PropertyDeclaration, modifiers: ModifiersArray | undefined, initializer: Expression | undefined) {
        return factory.updatePropertyDeclaration(
            node,
            modifiers,
            factory.getGeneratedPrivateNameForNode(node.name, /*prefix*/ undefined, "_accessor_storage"),
            /*questionOrExclamationToken*/ undefined,
            /*type*/ undefined,
            initializer
        );
    }

    /**
     * Creates a {@link GetAccessorDeclaration} that reads from a private backing field.
     */
    export function createAccessorPropertyGetRedirector(factory: NodeFactory, node: PropertyDeclaration, modifiers: ModifiersArray | undefined, name: PropertyName) {
        return factory.createGetAccessorDeclaration(
            modifiers,
            name,
            [],
            /*type*/ undefined,
            factory.createBlock([
                factory.createReturnStatement(
                    factory.createPropertyAccessExpression(
                        factory.createThis(),
                        factory.getGeneratedPrivateNameForNode(node.name, /*prefix*/ undefined, "_accessor_storage")
                    )
                )
            ])
        );
    }

    /**
     * Creates a {@link SetAccessorDeclaration} that writes to a private backing field.
     */
    export function createAccessorPropertySetRedirector(factory: NodeFactory, node: PropertyDeclaration, modifiers: ModifiersArray | undefined, name: PropertyName) {
        return factory.createSetAccessorDeclaration(
            modifiers,
            name,
            [factory.createParameterDeclaration(
                /*modifiers*/ undefined,
                /*dotdotDotToken*/ undefined,
                "value"
            )],
            factory.createBlock([
                factory.createExpressionStatement(
                    factory.createAssignment(
                        factory.createPropertyAccessExpression(
                            factory.createThis(),
                            factory.getGeneratedPrivateNameForNode(node.name, /*prefix*/ undefined, "_accessor_storage")
                        ),
                        factory.createIdentifier("value")
                    )
                )
            ])
        );
    }
    export function getParametersOfFunctionOrVariableDeclaration(node: FunctionDeclaration | VariableDeclaration): readonly ParameterDeclaration[] | undefined {
        if (isFunctionDeclaration(node)) {
            return node.parameters;
        }
        if (node.initializer && (isArrowFunction(node.initializer) || isFunctionExpression(node.initializer))) {
            return node.initializer.parameters
        }
    }
}
