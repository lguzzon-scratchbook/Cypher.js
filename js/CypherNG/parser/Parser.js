/**
 * @fileoverview Main Cypher query parser for CypherNG.
 * Implements a recursive descent parser with shunting-yard algorithm for expression parsing.
 */

// Import parser dependencies
var KeyWord = (typeof module !== 'undefined' && module.exports ?
    require('./KeyWords.js').KeyWord :
    (this.CypherNG && this.CypherNG.parser) ? this.CypherNG.parser.KeyWord : null);

var Operator = (typeof module !== 'undefined' && module.exports ?
    require('./Operators.js').Operator :
    (this.CypherNG && this.CypherNG.parser) ? this.CypherNG.parser.Operator : null);

var _Function = (typeof module !== 'undefined' && module.exports ?
    require('./Functions.js')._Function :
    (this.CypherNG && this.CypherNG.parser) ? this.CypherNG.parser._Function : null);

var AggregateFunction = (typeof module !== 'undefined' && module.exports ?
    require('./AggregateFunctions.js').AggregateFunction :
    (this.CypherNG && this.CypherNG.parser) ? this.CypherNG.parser.AggregateFunction : null);

var PredicateFunctionLookup = (typeof module !== 'undefined' && module.exports ?
    require('./PredicateFunctionLookup.js').PredicateFunctionLookup :
    (this.CypherNG && this.CypherNG.parser) ? this.CypherNG.parser.PredicateFunctionLookup : null);

/**
 * Parser - Main Cypher query parser.
 *
 * @class
 * @memberof CypherNG.parser
 * @param {Object} _engine - The engine instance to drive parsing
 */
function Parser(_engine) {
    var engine = _engine;
    var statementText;
    var rollbackPosition = undefined;
    var position = 0;
    var token = '';
    var inQuotes = false;

    var forbiddenCharsList = '(): {}"\',.\n\r\t+-/*^[]=<>!';
    var forbiddenChars = {};

    // Used to flag whether a parsed element is optional
    var optional = false;

    var setOptional = function() {
        optional = true;
    };
    var isOptional = function() {
        var _optional = optional;
        optional = false;
        return _optional;
    };

    this.statementText = function() {
        return statementText;
    };
    this.position = function() {
        return position;
    };

    // Used to prevent nesting of aggregation functions
    var aggregationFunctionLevel = 0;

    var nestedAggregationFunction = function() {
        return aggregationFunctionLevel > 0;
    };
    var increaseAggregationFunctionLevel = function() {
        aggregationFunctionLevel++;
    };
    var decreaseAggregationFunctionLevel = function() {
        aggregationFunctionLevel--;
    };

    var setupForbiddenChars = function() {
        for (var i = 0; i < forbiddenCharsList.length; i++) {
            forbiddenChars[forbiddenCharsList[i]] = true;
        }
    };
    setupForbiddenChars();

    this.parse = function(_statementText) {
        statementText = _statementText;
        position = 0;
        token = '';
        optional = false;
        aggregationFunctionLevel = 0;
        parseToken();
    };

    var parseToken = function() {
        ignoreWhiteSpaceAndComments();
        if (parseLoad() || parseCreate() || parseMerge() || parseMatch() || parseWith() || parseReturn() || parseUnwind()) {
            parseToken();
        }
        if (more()) {
            throw exception("Expected keyword.");
        }
    };

    var parseUnwind = function() {
        ignoreWhiteSpaceAndComments();
        if (unwind()) {
            parseExpression();
            engine.expression();
            parseUnwindAlias();
            parseSetter();
            return true;
        }
        return false;
    };

    var parseLoad = function() {
        ignoreWhiteSpaceAndComments();
        if (load()) {
            ignoreWhiteSpaceAndComments();
            if (csv()) {
                ignoreWhiteSpaceAndComments();
                if (_with(true)) {
                    ignoreWhiteSpaceAndComments();
                    if (!headers()) {
                        throw exception("Expected HEADERS-keyword.");
                    }
                    engine.statement().context().headers();
                }
                ignoreWhiteSpaceAndComments();
                if (from()) {
                    parseLoadFrom();
                    parseFieldTerminator();
                    ignoreWhiteSpaceAndComments();
                    if (!parseLoadAlias()) {
                        throw exception("Expected alias.");
                    }
                } else {
                    throw exception("Expected FROM-keyword.");
                }
            } else if (json() || text()) {
                ignoreWhiteSpaceAndComments();
                if (from()) {
                    parseLoadFrom();
                } else {
                    throw exception("Expected FROM-keyword.");
                }
                ignoreWhiteSpaceAndComments();
                var headersParsed = false;
                if (headers()) {
                    parseHeaders();
                    headersParsed = true;
                }
                ignoreWhiteSpaceAndComments();
                if (post()) {
                    parsePost();
                }
                ignoreWhiteSpaceAndComments();
                if (!headersParsed && headers()) {
                    parseHeaders();
                }
                ignoreWhiteSpaceAndComments();
                if (!parseLoadAlias()) {
                    throw exception("Expected alias.");
                }
            } else {
                throw exception("Expected CSV-, JSON-, or TEXT-keyword.");
            }
            return true;
        }
        return false;
    };

    var parseLoadFrom = function() {
        parseExpression();
        engine.expression();
    };
    var parsePost = function() {
        parseExpression();
        engine.expression();
    };
    var parseHeaders = function() {
        var array = parseAssociativeArray();
        if (array) {
            engine.statement().context().setHTTPHeaders(array);
        } else {
            throw exception("Expected associative array.");
        }
    };
    var parseFieldTerminator = function() {
        ignoreWhiteSpaceAndComments();
        if (fieldterminator()) {
            ignoreWhiteSpaceAndComments();
            if (parseString()) {
                engine.statement().context().setFieldTerminator(
                    getAndResetToken()
                );
            } else {
                throw exception("Expected single- or doublequoted string.");
            }
        }
    };

    var parseWith = function() {
        ignoreWhiteSpaceAndComments();
        if (_with()) {
            if (parseWithOrReturnBody(true)) {
                parseSetter();
                return true;
            }
        }
        return false;
    };
    var parseReturn = function() {
        ignoreWhiteSpaceAndComments();
        if (_return()) {
            return parseWithOrReturnBody();
        }
        return false;
    };
    var parseWithOrReturnBody = function(expressionMustHaveAlias) {
        do {
            ignoreWhiteSpaceAndComments();
            if (star()) {
                addAllVariables();
            } else {
                parseExpression();
                engine.expression();
                if (!parseAlias() && expressionMustHaveAlias && !engine.lastObject().hasKey()) {
                    throw exception("Expression in WITH must be aliased (use AS).");
                }
            }
        } while (comma());
        parseWhere();
        ignoreWhiteSpaceAndComments();
        parseLimit();

        ignoreWhiteSpaceAndComments();
        if (into()) {
            ignoreWhiteSpaceAndComments();
            if (!parseTableName()) {
                throw exception("Expected table name.");
            }
            engine.insertInto(
                getAndResetToken()
            );
        }
        return true;
    };

    var parseNodePattern = function(addPattern) {
        if (openingParentheses()) {
            if (addPattern) {
                engine.pattern();
            }
            engine.node();
            if (parseVariable(true)) {
                var variableKey = getAndResetToken();
                var parsedLabel = parseLabel();
                var parsedProperties = parseProperties();
                if (parsedLabel || parsedProperties) {
                    if (engine.variableExists(variableKey)) {
                        throw "It is not allowed to create a new node in this context.";
                    }
                    engine.variable(variableKey);
                } else {
                    if (engine.variableExists(variableKey)) {
                        var referredObject = engine.getVariable(variableKey).getObject();
                        if (referredObject.constructor != Unwind && !referredObject.isNode()) {
                            throw "Variable `" + variableKey + "` is bound to a " + referredObject.type() + ".";
                        }
                        engine.lastObject().setReferredNode(referredObject);
                    } else {
                        engine.variable(variableKey);
                    }
                }
            } else {
                parseLabel();
                parseProperties();
            }
            if (!closingParentheses()) {
                throw exception('Expecting closing parentheses.');
            }
            return true;
        }
        return false;
    };

    var parsePathLengthConstraints = function() {
        if (star()) {
            if (engine.operation() == "Merge" || engine.operation() == "Create") {
                throw 'Variable path length not supported in this context.';
            }
            engine.context().setHasVariablePathLength();
            if (parsePositiveInteger()) {
                engine.context().setPathLengthFrom(
                    parseInt(getAndResetToken())
                );
            }
            if (dot()) {
                if (dot()) {
                    if (parsePositiveInteger()) {
                        engine.context().setPathLengthTo(
                            parseInt(getAndResetToken())
                        );
                    }
                } else {
                    throw exception('Expected "."');
                }
            }
            return true;
        }
        return false;
    };

    var parseRelationshipPattern = function() {
        var _relationshipLeftDirection = relationshipLeftDirection();
        if (relationshipLine()) {
            engine.relationship();
            if (_relationshipLeftDirection) {
                engine.leftDirection();
            }
            if (openingSquareBracket()) {
                if (parseVariable(true)) {
                    var variableKey = getAndResetToken();
                    var parsedType = parseType();
                    var parsedProperties = parseProperties();
                    var parsedPathLengthConstraints = parsePathLengthConstraints();
                    if (parsedType || parsedProperties || parsedPathLengthConstraints) {
                        if (engine.variableExists(variableKey)) {
                            throw "It is not allowed to create a new relationship in this context.";
                        }
                        engine.variable(variableKey);
                    } else {
                        if (engine.variableExists(variableKey)) {
                            var referredObject = engine.getVariable(variableKey).getObject();
                            if (!referredObject.isRelationship()) {
                                throw "Variable `" + variableKey + "` is bound to a " + referredObject.type() + ".";
                            }
                            engine.lastObject().setReferredRelationship(referredObject);
                        } else {
                            engine.variable(variableKey);
                        }
                    }
                } else {
                    parseType();
                    parseProperties();
                    parsePathLengthConstraints();
                }
                if (!closingSquareBracket()) {
                    throw exception("Expected closing square bracket.");
                }
                if (!relationshipLine()) {
                    throw exception("Expected relationship line.");
                }
                if (relationshipRightDirection()) {
                    engine.rightDirection();
                }
                return true;
            } else {
                throw exception("Expected opening square bracket.");
            }
        }
        return false;
    };

    var parseGraphPatternExpression = function() {
        setRollbackPosition();
        if (!openingParentheses()) {
            return false;
        } else {
            position--;
        }
        var resetContext = false;
        try {
            var patternExpressionElement = parseNodePatternExpression();

            if (patternExpressionElement) {
                while (parseRelationshipPatternExpression(patternExpressionElement)) {
                    if (!parseNodePatternExpression(patternExpressionElement)) {
                        throw exception("Expecting node pattern.");
                    }
                }

                patternExpressionElement.element().useAsCondition();

                statement.resetContext();

                return patternExpressionElement;
            }

        } catch (e) {
            resetContext = true;
            statement.resetContext();
            throw e;
        }
        if (!resetContext) {
            statement.resetContext();
        }
        return false;
    };

    var parseNodePatternExpression = function(_patternExpressionElement) {
        var patternExpressionElement = _patternExpressionElement;
        var referredObject;
        var parsedPattern = false;
        setRollbackPosition();
        if (openingParentheses()) {
            setOptional();
            referredObject = parseExpressionLayer();
            if (!patternExpressionElement) {
                patternExpressionElement = addPattern(new Pattern());
                statement.setContext(patternExpressionElement.element());
            }
            patternExpressionElement.element().addNode(new Node(db));
            if (referredObject && isNode(referredObject)) {
                patternExpressionElement.element().lastObject().setReferredNode(referredObject);
                parsedPattern = true;
            }
            if (parseLabel()) {
                parsedPattern = true;
            }
            if (parseProperties()) {
                parsedPattern = true;
            }
            if (!closingParentheses()) {
                if (parsedPattern) {
                    throw exception('Expecting closing parentheses.');
                }
                rollback();
                removeLastPattern();
                return false;
            }
            if (!isNodeExpression(patternExpressionElement.element().lastObject())) {
                rollback();
                removeLastPattern();
                return false;
            }
            return patternExpressionElement;
        }
        return false;
    };

    var isNode = function(o) {
        return o.rootObject().constructor == Node;
    };
    var isNodeExpression = function(node) {
        if (node.getLabels().length > 0) {
            return true;
        }
        if (node.getProperties().length > 0) {
            return true;
        }
        if (node.getReferredNode()) {
            return true;
        }
        if (node.getLabels().length == 0 &&
            node.getProperties().length == 0 &&
            !node.getReferredNode()) {
            return true;
        }
        return false;
    };

    var parseRelationshipPatternExpression = function(patternExpressionElement) {
        var _relationshipLeftDirection = relationshipLeftDirection();
        if (relationshipLine()) {
            patternExpressionElement.element().addRelationship(new Relationship(db));
            if (_relationshipLeftDirection) {
                patternExpressionElement.element().leftDirection();
            }
            if (openingSquareBracket()) {
                var referredObject;
                if (parseVariable(true)) {
                    var variableKey = getAndResetToken();
                    if (!engine.variableExists(variableKey)) {
                        throw "Variable \"" + variableKey + "\" does not exist.";
                    }
                    referredObject = engine.getVariable(variableKey).getObject();
                    if (!referredObject.isRelationship()) {
                        throw "Variable `" + variableKey + "` is bound to a " + referredObject.type() + ".";
                    }
                    patternExpressionElement.element().lastObject().setReferredRelationship(
                        engine.getVariable(variableKey).getObject()
                    );
                }
                parseType();
                parseProperties();
                if (parsePathLengthConstraints() && referredObject) {
                    throw "Path expansion not allowed for referred relationship.";
                }
                if (!closingSquareBracket()) {
                    throw exception("Expected closing square bracket.");
                }
                if (!relationshipLine()) {
                    throw exception("Expected relationship line.");
                }
                if (relationshipRightDirection()) {
                    engine.rightDirection();
                }
                return true;
            } else {
                throw exception("Expected opening square bracket.");
            }
        }
        return false;
    };

    var parseGraphPattern = function(pathVariableNotAllowed) {
        var pathVariableName = undefined;
        if (parseVariable(true)) {
            ignoreWhiteSpaceAndComments();
            if (pathVariableNotAllowed && equals()) {
                throw exception("Path variable not allowed in this context.");
            }
            pathVariableName = getAndResetToken();
            if (!equals()) {
                throw exception("Expected variable assignment.");
            }
            ignoreWhiteSpaceAndComments();
        }
        var shortestPath = false;
        var nodeCount = 0;
        var relationshipCount = 0;
        if (shortestpath()) {
            shortestPath = true;
            getAndResetToken();
            if (!openingParentheses()) {
                throw exception("Expected opening parentheses.");
            }
        }
        if (parseNodePattern(true)) {
            nodeCount++;
            if (pathVariableName) {
                statement.addVariable(
                    pathVariableName,
                    statement.context().getLast().getPattern()
                );
            }
            while (parseRelationshipPattern()) {
                if (!parseNodePattern()) {
                    throw exception("Expecting node pattern.");
                }
                nodeCount++;
                relationshipCount++;
            }
        }
        if (shortestPath && (relationshipCount == 0 || relationshipCount > 1)) {
            throw "Expected single relationship pattern.";
        }
        if (shortestPath && !closingParentheses()) {
            throw exception("Expected closing parentheses.");
        }
        if (shortestPath) {
            statement.context().getPattern().shortestpath();
        }
        if (nodeCount > 0) {
            return true;
        }
        return false;
    };

    var parseMerge = function() {
        ignoreWhiteSpaceAndComments();
        if (merge()) {
            ignoreWhiteSpaceAndComments();
            if (!parseGraphPattern()) {
                throw exception('Expecting graph pattern.');
            }
            parseWhere();
            parseSetter();
            return true;
        }
        return false;
    };

    var parseCreate = function() {
        ignoreWhiteSpaceAndComments();
        if (create()) {
            do {
                ignoreWhiteSpaceAndComments();
                if (!parseGraphPattern()) {
                    throw exception('Expecting graph pattern.');
                }
            } while (comma());
            parseWhere();
            parseSetter();
            return true;
        }
        return false;
    };

    var parseMatch = function() {
        ignoreWhiteSpaceAndComments();
        if (match()) {
            do {
                ignoreWhiteSpaceAndComments();
                if (!parseGraphPattern()) {
                    throw exception('Expecting graph pattern.');
                }
            } while (comma());
            parseWhere();
            parseSetter();
            return true;
        }
        return false;
    };

    var parseWhere = function() {
        if (where()) {
            parseExpression();
            engine.where(parser.getExpression());
        }
    };

    var parseSetter = function() {
        ignoreWhiteSpaceAndComments();
        if (set()) {
            engine.setter();
            do {
                if (!parseVariable(true)) {
                    throw exception('Expected variable.');
                }
                var variable = engine.getVariable(
                    getAndResetToken()
                );
                if (dot()) {
                    var propertyKey;
                    if (parsePropertyKey()) {
                        propertyKey = getAndResetToken();
                    } else {
                        throw exception("Expected property key.");
                    }
                    ignoreWhiteSpaceAndComments();
                    if (!equals()) {
                        throw exception('Expected equals character (=).');
                    }
                    ignoreWhiteSpaceAndComments();
                    parseExpression();
                    var expression = parser.getExpression();
                    engine.operationContext().addSetter(
                        variable, propertyKey, expression
                    );
                } else {
                    var variableType = variable.getObject().constructor;
                    if (variableType != Node && variableType != Relationship) {
                        throw "Can't assign a label/type to a \"" + variable.getObject().getType() + "\".";
                    }
                    if (colon()) {
                        if (!parseExpression()) {
                            throw "Expected expression.";
                        }
                        var expression = parser.getExpression();
                        if (variableType == Node) {
                            engine.operationContext().addLabelSetter(
                                variable, expression
                            );
                        } else if (variableType == Relationship) {
                            engine.operationContext().addTypeSetter(
                                variable, expression
                            );
                        }
                    } else if (plus_equals()) {
                        if (!parseExpression()) {
                            throw "Expected expression.";
                        }
                        var expression = parser.getExpression();
                        if (variableType == Node || variableType == Relationship) {
                            engine.operationContext().addMapSetter(
                                variable, expression
                            );
                        }
                    }
                }
            } while (comma());
        }
    };

    var parseLimit = function() {
        if (limit()) {
            parseExpression(true);
            engine.limit(parser.getExpression());
        }
    };

    var parseExpression = function(variablesNotAllowed) {
        var parsedConstruct;
        var allowLookup = true, element;

        if ((element = parseGraphPatternExpression())) {
            allowLookup = false;
        } else if (openingParentheses()) {
            addOpeningParentheses();
            element = parseExpression(variablesNotAllowed);
            if (!closingParentheses()) {
                throw exception("Expected closing parentheses.");
            }
            addClosingParentheses();
        } else if ((parsedConstruct = parsePredicateFunction())) {
            element = addPredicateFunction(parsedConstruct);
            allowLookup = false;
        } else if (_function()) {
            element = parseFunction();
        } else if (aggregateFunction()) {
            element = parseAggregateFunction();
        } else if (parseConstant()) {
            element = addConstant(getAndResetToken());
        } else if ((parsedConstruct = parseCase())) {
            addCase(parsedConstruct);
            allowLookup = false;
        } else if ((parsedConstruct = parseFString())) {
            addFString(parsedConstruct);
        } else if (parseVariable(true)) {
            if (variablesNotAllowed) {
                throw exception("Variables not allowed within this context.");
            }
            element = addVariable(getAndResetToken());
        } else if ((parsedConstruct = parseList())) {
            element = addList(parsedConstruct);
        } else if ((parsedConstruct = parseAssociativeArray())) {
            element = addAssociativeArray(parsedConstruct);
        } else {
            if (!isOptional()) {
                throw exception("Expected expression");
            }
        }
        if (element && allowLookup) {
            parseLookup(element);
        }
        ignoreWhiteSpaceAndComments();
        if (operator()) {
            addOperator(Operator.latestParsed);
            ignoreWhiteSpaceAndComments();
            parseExpression();
        }
        return element;
    };

    var parseExpressionLayer = function() {
        parser.addLayer();
        parseExpression();
        var expression = parser.getExpression();
        parser.finishLayer();
        return expression;
    };

    var parseLookup = function(element) {
        while (1) {
            if (dot()) {
                if (parsePropertyKey()) {
                    addObjectLookup(element, getAndResetToken());
                } else {
                    throw exception("Expected property key.");
                }
            } else if (parseListIndex(element)) {
                ;
            } else {
                noLookup();
                break;
            }
        }
    };

    var parseListIndex = function(element) {
        if (openingSquareBracket()) {
            addListLookup(element, parseExpressionLayer());
            if (!closingSquareBracket()) {
                throw exception("Expected closing square bracket.");
            }
            return true;
        }
        return false;
    };

    var parseCase = function() {
        if (_case()) {
            ignoreWhiteSpaceAndComments();
            var caseStatement = new Case();
            while (when()) {
                caseStatement.when(parseExpressionLayer());
                ignoreWhiteSpaceAndComments();
                if (_then()) {
                    caseStatement.then(parseExpressionLayer());
                } else {
                    throw exception("Expected THEN keyword");
                }
                ignoreWhiteSpaceAndComments();
            }
            if (caseStatement.whenCount() == 0) {
                throw exception("Expected WHEN keyword");
            }
            ignoreWhiteSpaceAndComments();
            if (_else()) {
                caseStatement.else(parseExpressionLayer());
            }
            ignoreWhiteSpaceAndComments();
            if (!end()) {
                throw exception("Expected END keyword");
            }
            return caseStatement;
        }
        return false;
    };

    var parseAssociativeArray = function() {
        if (openingCurlyBrackets()) {
            var associativeArray = new AssociativeArray();
            do {
                if (parsePropertyKey()) {
                    var key = getAndResetToken();
                    if (!colon()) {
                        throw exception("Expected colon.");
                    }
                    associativeArray.addEntry(
                        key,
                        parseExpressionLayer()
                    );
                }
            } while (comma());
            if (!closingCurlyBrackets()) {
                throw exception("Expected closing curly bracket.");
            }
            return associativeArray;
        }
        return false;
    };

    var parseList = function() {
        if (openingSquareBracket()) {
            var list = new List();
            do {
                setOptional();
                list.add(parseExpressionLayer());
            } while (comma());
            if (!closingSquareBracket()) {
                throw exception("Expected closing bracket.");
            }
            return list;
        }
        return false;
    };

    var parseAggregateFunction = function() {
        if (nestedAggregationFunction()) {
            throw exception("Not allowed to nest aggregation functions.");
        }
        if (openingParentheses()) {
            var aggregateExpressionElement =
                addAggregateFunction(
                    AggregateFunction.latestParsed
                );
            addOpeningParentheses();
            increaseAggregationFunctionLevel();
            ignoreWhiteSpaceAndComments();
            if (distinct()) {
                aggregateExpressionElement.setDistinct();
            }
            ignoreWhiteSpaceAndComments();
            if (AggregateFunction.latestParsed.parametric()) {
                var parameterCount = 0;
                do {
                    parseFunctionParameter();
                    parameterCount++;
                } while (comma());
                try {
                    aggregateExpressionElement.verifyParsedParameterCount(
                        parameterCount
                    );
                } catch (e) {
                    throw exception(e);
                }
            }
            if (closingParentheses()) {
                addClosingParentheses();
                decreaseAggregationFunctionLevel();
            } else {
                throw exception("Expected closing parentheses.");
            }
            return aggregateExpressionElement;
        } else {
            throw exception("Expected opening parentheses.");
        }
    };

    var parseFunction = function() {
        if (openingParentheses()) {
            var functionElement =
                addFunction(_Function.latestParsed);
            addOpeningParentheses();
            if (_Function.latestParsed.parametric()) {
                var parameterCount = 0;
                do {
                    parseFunctionParameter();
                    parameterCount++;
                } while (comma());
                try {
                    functionElement.verifyParsedParameterCount(
                        parameterCount
                    );
                } catch (e) {
                    throw exception(e);
                }
            }
            if (closingParentheses()) {
                addClosingParentheses();
            } else {
                throw exception("Expected closing parentheses.");
            }
            return functionElement;
        } else {
            throw exception("Expected opening parentheses.");
        }
    };

    var parseFunctionParameter = function() {
        addExpression(parseExpressionLayer());
    };

    var parsePredicateFunction = function() {
        var initialPosition = position;
        if ((charsToAccumulate = PredicateFunctionLookup.isPredicateFunction(statementText, position)) > 0) {
            position += charsToAccumulate;
            if (openingParentheses(false, true)) {
                var predicate = new Predicate();
                predicate.setPredicateFunctionName(PredicateFunctionLookup.latestParsed.displayValue());
                ignoreWhiteSpaceAndComments();
                if (parseVariable(true)) {
                    var variableKey = getAndResetToken();
                    predicate.variable(variableKey);
                    ignoreWhiteSpaceAndComments();
                    if (_in()) {
                        ignoreWhiteSpaceAndComments();
                        var listExpression = parseExpressionLayer();
                        if (!listExpression) {
                            throw exception("Expected list.");
                        }
                        predicate.list(listExpression);
                        ignoreWhiteSpaceAndComments();
                        if (!where()) {
                            throw exception("Expected WHERE-keyword.");
                        }
                        ignoreWhiteSpaceAndComments();
                        var expression = parseExpressionLayer();
                        predicate.where(expression);
                        ignoreWhiteSpaceAndComments();
                        if (!closingParentheses()) {
                            throw exception("Expected closing parentheses.");
                        }
                        return predicate;
                    }
                }
            }
        }
        position = initialPosition;
        return false;
    };

    var parseFString = function() {
        if (currentChar() != 'f') {
            return false;
        }
        position++;
        var quoteFunction = null;
        if (singleQuote()) {
            quoteFunction = singleQuote;
        } else if (doubleQuote()) {
            quoteFunction = doubleQuote;
        } else if (backTickQuote()) {
            quoteFunction = backTickQuote;
        } else {
            position--;
            return false;
        }
        var fstring = new FString();
        inQuotes = true;
        while (!quoteFunction()) {
            if (!more()) {
                throw exception("Expected closing quote.");
            }
            escape();
            if (openingDoubleCurlyBrackets()) {
                token += "{";
                while (more() && !closingDoubleCurlyBrackets()) {
                    escape();
                    token += currentChar();
                    position++;
                }
                if (!more()) {
                    throw exception("Expected closing double curly bracket.");
                }
                token += "}";
            }
            if (openingCurlyBrackets(true)) {
                var substring = getAndResetToken();
                var expression = parseExpressionLayer();
                if (!expression) {
                    throw exception("Expected expression.");
                }
                if (!closingCurlyBrackets(true)) {
                    throw exception("Expected closing curly bracket.");
                }
                if (substring.length > 0) {
                    fstring.string(substring);
                }
                fstring.expression(expression);
            }
            if (quoteFunction()) {
                break;
            }
            token += currentChar();
            position++;
        }
        inQuotes = false;
        if (token.length > 0) {
            fstring.string(getAndResetToken());
        }
        return fstring;
    };

    var parseVariable = function(dontAddToEngine) {
        var addToEngine = !dontAddToEngine;
        ignoreWhiteSpaceAndComments();
        if (isNumeric(currentChar())) return false;
        if (backTickQuote()) {
            while (more() && !backTickQuote()) {
                token += currentChar();
                position++;
            }
        } else if (!backTickQuote()) {
            while (more() && !forbiddenChars[currentChar()]) {
                token += currentChar();
                position++;
            }
        }
        if (token.length > 0 && validVariableName()) {
            if (addToEngine) {
                engine.variable(getAndResetToken());
            }
            return true;
        }
        return false;
    };
    var parseAliasLabel = function() {
        return parseVariable(true);
    };
    var parseLoadAliasLabel = function() {
        return parseVariable(false);
    };
    var parseUnwindAliasLabel = function() {
        return parseVariable(false);
    };
    var parseTableName = function() {
        return parseVariable(true);
    };

    var parseLabel = function() {
        ignoreWhiteSpaceAndComments();
        if (!colon()) return false;
        var labelName = '';
        if (backTickQuote()) {
            while (more() && !backTickQuote()) {
                labelName += currentChar();
                position++;
            }
        } else if (!backTickQuote()) {
            while (more() && !forbiddenChars[currentChar()]) {
                labelName += currentChar();
                position++;
            }
        }
        if (labelName == '') {
            throw exception('Expecting label name.');
        }
        engine.label(labelName);
        parseLabel();
        return true;
    };

    var parseType = function() {
        ignoreWhiteSpaceAndComments();
        if (!colon()) return false;
        var typeName = '';
        if (backTickQuote()) {
            while (more() && !backTickQuote()) {
                typeName += currentChar();
                position++;
            }
        } else if (!backTickQuote()) {
            while (more() && !forbiddenChars[currentChar()]) {
                typeName += currentChar();
                position++;
            }
        }
        if (typeName == '') {
            throw exception('Expecting type name.');
        }
        engine.type(typeName);
        return true;
    };

    var parseProperties = function() {
        ignoreWhiteSpaceAndComments();
        if (openingCurlyBrackets()) {
            if (!parseProperty()) {
                throw exception('Expecting at least one property.');
            }
            if (!closingCurlyBrackets()) {
                throw exception('Expecting closing curly brackets.');
            }
            return true;
        }
        return false;
    };

    var parseProperty = function() {
        if (parsePropertyKey()) {
            engine.propertyKey(getAndResetToken());
        } else {
            return false;
        }
        if (!colon()) {
            throw exception("Expected colon.");
        }
        engine.propertyValue(parseExpressionLayer());
        if (comma()) {
            return parseProperty();
        }
        return true;
    };

    var parsePropertyKey = function() {
        ignoreWhiteSpaceAndComments();
        if (isNumeric(currentChar())) return false;
        if (backTickQuote()) {
            while (more() && !backTickQuote()) {
                token += currentChar();
                position++;
            }
        } else if (!backTickQuote()) {
            while (more() && !forbiddenChars[currentChar()]) {
                token += currentChar();
                position++;
            }
        }
        if (token.length == 0) {
            return false;
        }
        return true;
    };

    var parseString = function() {
        var quoteFunction = null;
        if (singleQuote()) {
            quoteFunction = singleQuote;
        } else if (doubleQuote()) {
            quoteFunction = doubleQuote;
        } else if (backTickQuote()) {
            quoteFunction = backTickQuote;
        } else {
            return false;
        }
        inQuotes = true;
        while (!quoteFunction()) {
            if (!more()) {
                throw exception("Expected closing quote.");
            }
            escape();
            token += currentChar();
            position++;
        }
        inQuotes = false;
        return true;
    };

    var parseConstant = function() {
        if (parseString()) {
            ;
        } else if (parseNumber()) {
            token = parseFloat(token);
        } else if (_true()) {
            token = true;
        } else if (_false()) {
            token = false;
        } else if (_null()) {
            token = null;
        } else {
            return false;
        }
        return true;
    };

    var parseAlias = function() {
        ignoreWhiteSpaceAndComments();
        if (as()) {
            if (!parseAliasLabel()) {
                throw exception("Expected alias variable key.");
            }
            engine.as(getAndResetToken());
            return true;
        }
        return false;
    };

    var parseLoadAlias = function() {
        ignoreWhiteSpaceAndComments();
        if (as()) {
            if (!parseLoadAliasLabel()) {
                throw exception("Expected alias variable key.");
            }
            engine.as(getAndResetToken());
            return true;
        }
        return false;
    };

    var parseUnwindAlias = function() {
        ignoreWhiteSpaceAndComments();
        if (as()) {
            if (!parseUnwindAliasLabel()) {
                throw exception("Unwinded collection must be aliased.");
            }
            return true;
        }
        return false;
    };

    var parseNumber = function() {
        ignoreWhiteSpaceAndComments();
        var negated = false;
        if (negation()) {
            accumulatePreviousChar();
            negated = true;
        }
        if (numeric()) {
            accumulatePreviousChar();
            while (numeric()) {
                accumulatePreviousChar();
            }
            if (dot()) {
                accumulatePreviousChar();
                if (numeric()) {
                    accumulatePreviousChar();
                    while (numeric()) {
                        accumulatePreviousChar();
                    }
                } else {
                    throw exception('Expected one or more integers after decimal point.');
                }
            }
            ignoreWhiteSpaceAndComments();
        } else {
            if (negated) {
                throw exception('Expected number.');
            }
            return false;
        }
        return true;
    };

    var parsePositiveInteger = function() {
        ignoreWhiteSpaceAndComments();
        if (numeric()) {
            accumulatePreviousChar();
            while (numeric()) {
                accumulatePreviousChar();
            }
            ignoreWhiteSpaceAndComments();
        } else {
            return false;
        }
        return true;
    };

    var accumulatePreviousChar = function() {
        token += previousChar();
    };

    var setRollbackPosition = function() {
        rollbackPosition = position;
    };

    var rollback = function() {
        if (rollbackPosition == undefined || rollbackPosition > position) {
            return;
        }
        position -= (position - rollbackPosition);
        token = "";
        rollbackPosition = undefined;
    };

    var validVariableName = function() {
        if ((_Function.isFunction(token, 0) && openingParentheses(true)) ||
            (AggregateFunction.isAggregateFunction(token, 0) && openingParentheses(true)) ||
            KeyWord.isKeyWord(token, 0)) {
            position -= token.length;
            return false;
        }
        return true;
    };

    var getAndResetToken = function() {
        var r = token;
        token = "";
        return r;
    };

    var more = function() {
        return position < statementText.length;
    };

    var check = function(c, dontIgnoreWhiteSpace, dontIncrementPosition) {
        var incrementPosition = !dontIncrementPosition;
        if (!dontIgnoreWhiteSpace) {
            ignoreWhiteSpaceAndComments();
        }
        if (currentChar() == c) {
            if (incrementPosition) position++;
            return true;
        }
        return false;
    };

    // Keyword check functions
    var create = function() { return keyword(KeyWord.f.CREATE); };
    var match = function() { return keyword(KeyWord.f.MATCH); };
    var merge = function() { return keyword(KeyWord.f.MERGE); };
    var shortestpath = function() { return keyword(KeyWord.f.SHORTESTPATH); };
    var _with = function(noAction) { return keyword(KeyWord.f.WITH, noAction); };
    var _return = function() { return keyword(KeyWord.f.RETURN); };
    var into = function() { return keyword(KeyWord.f.INTO); };
    var limit = function() { return keyword(KeyWord.f.LIMIT); };
    var where = function() { return keyword(KeyWord.f.WHERE); };
    var load = function() { return keyword(KeyWord.f.LOAD); };
    var unwind = function() { return keyword(KeyWord.f.UNWIND); };
    var csv = function() { return keyword(KeyWord.f.CSV); };
    var json = function() { return keyword(KeyWord.f.JSON); };
    var text = function() { return keyword(KeyWord.f.TEXT); };
    var headers = function() { return keyword(KeyWord.f.HEADERS); };
    var from = function() { return keyword(KeyWord.f.FROM); };
    var post = function() { return keyword(KeyWord.f.POST); };
    var as = function() { return keyword(KeyWord.f.AS); };
    var fieldterminator = function() { return keyword(KeyWord.f.FIELDTERMINATOR); };
    var set = function() { return keyword(KeyWord.f.SET); };
    var distinct = function() { return keyword(KeyWord.f.DISTINCT); };
    var _true = function() { return keyword(KeyWord.f.TRUE); };
    var _false = function() { return keyword(KeyWord.f.FALSE); };
    var _null = function() { return keyword(KeyWord.f.NULL); };
    var _case = function() { return keyword(KeyWord.f.CASE); };
    var when = function() { return keyword(KeyWord.f.WHEN); };
    var _then = function() { return keyword(KeyWord.f.THEN); };
    var _else = function() { return keyword(KeyWord.f.ELSE); };
    var end = function() { return keyword(KeyWord.f.END); };
    var _in = function() { return keyword(KeyWord.f.IN); };

    var operator = function() {
        var charsToAccumulate = 0;
        if ((charsToAccumulate = Operator.isOperator(statementText, position)) > 0) {
            position += charsToAccumulate;
            return true;
        }
        return false;
    };

    var keyword = function(which, noAction) {
        var charsToAccumulate = 0;
        if ((charsToAccumulate = KeyWord.isKeyWord(statementText, position)) > 0) {
            if (KeyWord.latestParsed === which) {
                if (!noAction) {
                    KeyWord.latestParsed.action(engine);
                }
                position += charsToAccumulate;
                return true;
            }
        }
        return false;
    };

    // Character check functions
    var relationshipLeftDirection = function() { return check('<'); };
    var relationshipRightDirection = function() { return check('>'); };
    var relationshipLine = function() { return check('-'); };
    var negation = function() { return check('-'); };
    var isNumeric = function(c) { return !isNaN(parseInt(c)); };
    var numeric = function() {
        var r = isNumeric(currentChar());
        if (r) position++;
        return r;
    };
    var star = function() { return check('*'); };
    var dot = function() { return check('.'); };
    var singleQuote = function() {
        if (previousChar() == '\\' && currentChar() == '\'' && inQuotes) return false;
        return check('\'', true);
    };
    var doubleQuote = function() {
        if (previousChar() == '\\' && currentChar() == '"' && inQuotes) return false;
        return check('"', true);
    };
    var backTickQuote = function() {
        if (previousChar() == '\\' && currentChar() == '`' && inQuotes) return false;
        return check('`', true);
    };
    var colon = function() { return check(':'); };
    var equals = function() { return check('='); };
    var plus_equals = function() { return check('+') && check('='); };
    var comma = function() { return check(','); };
    var escape = function() { return check('\\', true); };
    var openingParentheses = function(dontIncrementPosition, dontIgnoreWhiteSpace) {
        return check('(', dontIgnoreWhiteSpace, dontIncrementPosition);
    };
    var closingParentheses = function() { return check(')'); };
    var openingCurlyBrackets = function(dontIgnoreWhiteSpace, dontIncrementPosition) {
        return check('{', dontIgnoreWhiteSpace, dontIncrementPosition);
    };
    var closingCurlyBrackets = function(dontIgnoreWhiteSpace, dontIncrementPosition) {
        return check('}', dontIgnoreWhiteSpace, dontIncrementPosition);
    };
    var openingDoubleCurlyBrackets = function() {
        var present = currentChar() == '{' && nextChar() == '{';
        if (present) {
            position += 2;
        }
        return present;
    };
    var closingDoubleCurlyBrackets = function() {
        var present = currentChar() == '}' && nextChar() == '}';
        if (present) {
            position += 2;
        }
        return present;
    };
    var openingSquareBracket = function() { return check('['); };
    var closingSquareBracket = function() { return check(']'); };

    var ignoreWhiteSpaceAndComments = function() {
        if (!more()) return;
        while (currentChar() == ' ' || currentChar() == '\n' || currentChar() == '\t' || currentChar() == '\r') {
            position++;
        }
        if (currentChar() == '/' && nextChar() == '/') {
            while (currentChar() != '\n' && more()) {
                position++;
            }
            ignoreWhiteSpaceAndComments();
        }
    };

    var previousChar = function() {
        return statementText.charAt(position - 1);
    };
    var currentChar = function() {
        return statementText.charAt(position);
    };
    var nextChar = function() {
        return statementText.charAt(position + 1);
    };

    var got = function() {
        return " Parsed \"" + statementText.substring(0, position) + "\". Got \"" + currentChar() + "\"";
    };

    var exception = function(message) {
        reset();
        return message + got();
    };

    // Placeholder references - these will be resolved when parser is used
    var db = null;
    var statement = null;
    var parser = this;
    var Pattern = null;
    var Node = null;
    var Relationship = null;
    var Case = null;
    var FString = null;
    var List = null;
    var AssociativeArray = null;
    var Predicate = null;
    var Constant = null;
    var Expression = null;
    var Unwind = null;

    // Inject dependencies when available
    this.setDependencies = function(deps) {
        db = deps.db;
        statement = deps.statement;
        Pattern = deps.Pattern;
        Node = deps.Node;
        Relationship = deps.Relationship;
        Case = deps.Case;
        FString = deps.FString;
        List = deps.List;
        AssociativeArray = deps.AssociativeArray;
        Predicate = deps.Predicate;
        Constant = deps.Constant;
        Expression = deps.Expression;
        Unwind = deps.Unwind;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.Parser = Parser;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
