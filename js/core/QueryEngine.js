/**
 * QueryEngine - Parses and plans Cypher queries
 * Extracted from Cypher.js and modularized for CypherNG
 * @author Factory Droid
 */

/**
 * @class QueryEngine
 * @description Handles parsing and planning of Cypher queries
 * Extracted from the original Cypher.js Parser class
 */
class QueryEngine {
    /**
     * Creates a new QueryEngine instance
     * @param {Object} dataAdapter - Data adapter for query execution
     */
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
        this.position = 0;
        this.statementText = '';
        this.token = '';
        this.inQuotes = false;
        this.rollbackPosition = undefined;
    }

    /**
     * Parses a Cypher query string
     * @param {string} queryText - The Cypher query to parse
     * @returns {Object} Parsed query plan
     * @throws {Error} When query syntax is invalid
     */
    parse(queryText) {
        this.reset();
        this.statementText = queryText;
        
        const queryPlan = {
            type: 'SELECT', // Default type
            statements: [],
            returns: [],
            where: null,
            limits: [],
            order: []
        };

        try {
            this.parseQuery(queryPlan);
            return queryPlan;
        } catch (error) {
            throw new Error(`Query parsing failed: ${error.message}`);
        }
    }

    /**
     * Parses the main query structure
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseQuery(queryPlan) {
        this.ignoreWhiteSpaceAndComments();
        
        if (this.matchKeyword('CREATE')) {
            queryPlan.type = 'CREATE';
            this.parsePattern(queryPlan);
        } else if (this.matchKeyword('MATCH')) {
            queryPlan.type = 'MATCH';
            this.parsePattern(queryPlan);
        } else if (this.matchKeyword('MERGE')) {
            queryPlan.type = 'MERGE';
            this.parsePattern(queryPlan);
        } else if (this.matchKeyword('RETURN')) {
            queryPlan.type = 'RETURN';
            this.parseReturnClause(queryPlan);
        } else if (this.matchKeyword('WITH')) {
            queryPlan.type = 'WITH';
            this.parseWithClause(queryPlan);
        } else if (this.matchKeyword('DELETE')) {
            queryPlan.type = 'DELETE';
            this.parseDeleteClause(queryPlan);
        } else if (this.matchKeyword('SET')) {
            queryPlan.type = 'SET';
            this.parseSetClause(queryPlan);
        } else if (this.matchKeyword('UNWIND')) {
            queryPlan.type = 'UNWIND';
            this.parseUnwindClause(queryPlan);
        } else if (this.matchKeyword('LOAD')) {
            queryPlan.type = 'LOAD';
            this.parseLoadCsvClause(queryPlan);
        } else {
            throw new Error('Expected query keyword (CREATE, MATCH, RETURN, etc.)');
        }

        // Parse optional clauses
        this.parseOptionalClauses(queryPlan);
    }

    /**
     * Parses pattern matching clauses (CREATE, MATCH, MERGE)
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parsePattern(queryPlan) {
        const pattern = {
            nodes: [],
            relationships: []
        };

        this.ignoreWhiteSpaceAndComments();
        
        if (!this.checkChar('(')) {
            throw new Error('Expected node pattern starting with "("');
        }

        this.parseNode(pattern);

        while (this.hasMore()) {
            this.ignoreWhiteSpaceAndComments();
            
            // Parse relationship pattern
            if (this.checkChar('-') || this.checkChar('<')) {
                this.parseRelationship(pattern);
                this.parseNode(pattern);
            } else {
                break;
            }
        }

        queryPlan.pattern = pattern;
    }

    /**
     * Parses a node pattern
     * @param {Object} pattern - Pattern object to populate
     * @private
     */
    parseNode(pattern) {
        this.expectChar('(');
        
        const node = {
            variable: null,
            labels: [],
            properties: {}
        };

        // Parse variable name
        if (this.peekVariableName()) {
            node.variable = this.getToken();
            this.advanceToken();
        }

        // Parse labels
        while (this.checkChar(':')) {
            this.expectChar(':');
            const label = this.parseIdentifier();
            node.labels.push(label);
        }

        // Parse properties
        if (this.checkChar('{')) {
            this.parseProperties(node.properties);
        }

        this.expectChar(')');
        
        pattern.nodes.push(node);
    }

    /**
     * Parses a relationship pattern
     * @param {Object} pattern - Pattern object to populate
     * @private
     */
    parseRelationship(pattern) {
        let direction = 'none';
        
        // Parse direction
        if (this.checkChar('<')) {
            this.expectChar('<');
            direction = 'left';
        }
        
        this.expectChar('-');
        
        const relationship = {
            variable: null,
            type: null,
            properties: {},
            direction: direction
        };

        if (this.checkChar('[')) {
            this.expectChar('[');
            
            // Parse variable name
            if (this.peekVariableName()) {
                relationship.variable = this.getToken();
                this.advanceToken();
                
                // Check for variable length after variable name but before type
                if (this.checkChar('*')) {
                    this.expectChar('*');
                    relationship.variableLength = 'unbounded';
                    
                    // Check for length bounds like *..3
                    if (this.checkChar('.')) {
                        this.expectChar('.');
                        this.expectChar('.');
                        if (this.checkNumber()) {
                            relationship.variableLength = {
                                min: 1,
                                max: parseInt(this.getToken())
                            };
                            this.advanceToken();
                        }
                    }
                }
            }
            
            // Parse relationship type
            if (this.checkChar(':')) {
                this.expectChar(':');
                relationship.type = this.parseIdentifier();
                
                // Check for variable length indicator in type
                if (this.checkChar('*')) {
                    this.expectChar('*');
                    relationship.variableLength = 'unbounded';
                    
                    // Check for length bounds like *..3
                    if (this.checkChar('.')) {
                        this.expectChar('.');
                        this.expectChar('.');
                        if (this.checkNumber()) {
                            relationship.variableLength = {
                                min: 1,
                                max: parseInt(this.getToken())
                            };
                            this.advanceToken();
                        }
                    }
                }
            }
            
            // Parse properties
            if (this.checkChar('{')) {
                this.parseProperties(relationship.properties);
            }
            
            this.expectChar(']');
        } else {
            // Handle case where there's no [] but there might be a variable pattern like [r*]
            // This actually means variable length relationships without brackets
            // But in Cypher, this should be handled as [r*]
            // For now, we'll just note this as an issue
        }
        
        this.expectChar('-');
        
        if (this.checkChar('>')) {
            this.expectChar('>');
            if (direction === 'none') {
                relationship.direction = 'right';
            } else {
                relationship.direction = 'both';
            }
        }
        
        pattern.relationships.push(relationship);
    }

    /**
     * Parses properties object
     * @param {Object} properties - Properties object to populate
     * @private
     */
    parseProperties(properties) {
        this.expectChar('{');
        this.ignoreWhiteSpaceAndComments();
        
        while (!this.checkChar('}')) {
            const key = this.parseIdentifier();
            this.expectChar(':');
            const value = this.parseExpression();
            properties[key] = value;
            
            if (this.checkChar(',')) {
                this.expectChar(',');
                this.ignoreWhiteSpaceAndComments();
            }
        }
        
        this.expectChar('}');
    }

    /**
     * Parse RETURN clause
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseReturnClause(queryPlan) {
        if (this.matchKeyword('DISTINCT')) {
            queryPlan.distinct = true;
        }
        
        this.ignoreWhiteSpaceAndComments();
        
        // Parse return items
        do {
            const item = this.parseReturnItem();
            queryPlan.returns.push(item);
            
            if (this.checkChar(',')) {
                this.expectChar(',');
            } else {
                break;
            }
            
            this.ignoreWhiteSpaceAndComments();
        } while (this.hasMore());
    }

    /**
     * Parse a single return item
     * @returns {Object} Return item object
     * @private
     */
    parseReturnItem() {
        const expression = this.parseExpression();
        const item = { expression };
        
        this.ignoreWhiteSpaceAndComments();
        
        // Check for alias
        if (this.matchKeyword('AS')) {
            item.alias = this.parseIdentifier();
        }
        
        return item;
    }

    /**
     * Parse expression
     * @returns {Object} Expression AST node
     * @private
     */
    parseExpression() {
        this.ignoreWhiteSpaceAndComments();
        
        // Handle different expression types
        if (this.checkChar('[')) {
            return this.parseArrayExpression();
        }
        
        if (this.checkChar('{')) {
            return this.parseMapExpression();
        }
        
        if (this.checkChar('(')) {
            return this.parseParenthesizedExpression();
        }
        
        // Check for function calls like count(), size(), collect(), etc.
        if (this.peekFunctionName()) {
            return this.parseFunctionCall();
        }
        
        // String literals
        if (this.checkStringLiteral()) {
            const beforePos = this.position;
            const value = this.parseStringLiteral();
            this.token = ''; // Clear token
            return { type: 'literal', value, dataType: 'string' };
        }
        
        // Numbers
        if (this.checkNumber()) {
            const value = parseFloat(this.getToken());
            this.advanceToken();
            return { type: 'literal', value, dataType: 'number' };
        }
        
        // Boolean values
        if (this.checkKeyword('TRUE')) {
            this.expectKeyword('TRUE');
            return { type: 'literal', value: true, dataType: 'boolean' };
        }
        
        if (this.checkKeyword('FALSE')) {
            this.expectKeyword('FALSE');
            return { type: 'literal', value: false, dataType: 'boolean' };
        }
        
        if (this.checkKeyword('NULL')) {
            this.expectKeyword('NULL');
            return { type: 'literal', value: null, dataType: 'null' };
        }
        
        // Case expression
        if (this.checkKeyword('CASE')) {
            return this.parseCaseExpression();
        }
        
        // Identifiers and property access
        if (this.checkIdentifier()) {
            return this.parseIdentifierExpression();
        }
        
        // The issue: getToken is being called before we've accumulated the right token
        // Let's accumulate the token at the current position first
        this.accumulateToken();
        const token = this.token;
        throw new Error(`Expected expression, got: ${token}`);
    }

    /**
     * Parse array expression [1, 2, 3]
     * @returns {Object} Array expression AST node
     * @private
     */
    parseArrayExpression() {
        this.expectChar('[');
        const elements = [];
        
        this.ignoreWhiteSpaceAndComments();
        
        while (!this.checkChar(']')) {
            const element = this.parseExpression();
            elements.push(element);
            
            this.ignoreWhiteSpaceAndComments();
            
            if (this.checkChar(',')) {
                this.expectChar(',');
                this.ignoreWhiteSpaceAndComments();
            } else {
                break;
            }
        }
        
        this.expectChar(']');
        return { type: 'array', elements };
    }

    /**
     * Parse map/object expression {key: value, ...}
     * @returns {Object} Map expression AST node
     * @private
     */
    parseMapExpression() {
        this.expectChar('{');
        const properties = {};
        
        this.ignoreWhiteSpaceAndComments();
        
        while (!this.checkChar('}')) {
            const key = this.parseIdentifier();
            this.expectChar(':');
            const value = this.parseExpression();
            properties[key] = value;
            
            this.ignoreWhiteSpaceAndComments();
            
            if (this.checkChar(',')) {
                this.expectChar(',');
                this.ignoreWhiteSpaceAndComments();
            } else {
                break;
            }
        }
        
        this.expectChar('}');
        return { type: 'map', properties };
    }

    /**
     * Parse parenthesized expression (expression)
     * @returns {Object} Expression AST node
     * @private
     */
    parseParenthesizedExpression() {
        this.expectChar('(');
        const expression = this.parseExpression();
        this.expectChar(')');
        return expression;
    }

    /**
     * Parse function call expression like count(1)
     * @returns {Object} Function call AST node
     * @private
     */
    parseFunctionCall() {
        const functionName = this.parseIdentifier();
        this.expectChar('(');
        
        const args = [];
        
        this.ignoreWhiteSpaceAndComments();
        
        while (!this.checkChar(')')) {
            const arg = this.parseExpression();
            args.push(arg);
            
            this.ignoreWhiteSpaceAndComments();
            
            if (this.checkChar(',')) {
                this.expectChar(',');
                this.ignoreWhiteSpaceAndComments();
            } else {
                break;
            }
        }
        
        this.expectChar(')');
        
        return {
            type: 'function_call',
            function: functionName,
            arguments: args
        };
    }

    /**
     * Parse CASE expression
     * @returns {Object} Case expression AST node
     * @private
     */
    parseCaseExpression() {
        this.expectKeyword('CASE');
        
        const caseExpression = {
            type: 'case',
            cases: [],
            elseBranch: null
        };
        
        // Parse case branches
        while (this.checkKeyword('WHEN')) {
            this.expectKeyword('WHEN');
            const condition = this.parseExpression();
            this.expectKeyword('THEN');
            const thenValue = this.parseExpression();
            
            caseExpression.cases.push({
                condition: condition,
                thenValue: thenValue
            });
        }
        
        // Parse else branch
        if (this.checkKeyword('ELSE')) {
            this.expectKeyword('ELSE');
            caseExpression.elseBranch = this.parseExpression();
        }
        
        this.expectKeyword('END');
        
        return caseExpression;
    }

    /**
     * Parse identifier expression which may include property access
     * @returns {Object} Identifier expression AST node
     * @private
     */
    parseIdentifierExpression() {
        const identifier = this.parseIdentifier();
        let expression = { type: 'identifier', value: identifier };
        
        this.ignoreWhiteSpaceAndComments();
        
        // Check for property access .property
        while (this.checkChar('.')) {
            this.expectChar('.');
            const property = this.parseIdentifier();
            
            expression = {
                type: 'property_access',
                object: expression,
                property: property
            };
            
            this.ignoreWhiteSpaceAndComments();
        }
        
        return expression;
    }

    /**
     * Check if current token looks like a function name (followed by '(')
     * @returns {boolean}
     * @private
     */
    peekFunctionName() {
        if (!this.checkIdentifier()) {
            return false;
        }
        
        const identifier = this.getToken();
        const pos = this.position;
        
        // Skip identifier
        while (this.hasMore() && this.isValidIdentifierChar(this.currentChar())) {
            this.position++;
        }
        
        this.ignoreWhiteSpaceAndComments();
        const hasParenthesis = this.checkChar('(');
        
        // Reset position
        this.position = pos;
        
        return hasParenthesis;
    }

    /**
     * Parse identifier
     * @returns {string} Identifier string
     * @private
     */
    parseIdentifier() {
        this.ignoreWhiteSpaceAndComments();
        let identifier = '';
        
        while (this.hasMore() && this.isValidIdentifierChar(this.currentChar())) {
            identifier += this.currentChar();
            this.position++;
        }
        
        if (!identifier) {
            throw new Error('Expected identifier');
        }
        
        return identifier;
    }

    /**
     * Parse string literal
     * @returns {string} String literal value
     * @private
     */
    parseStringLiteral() {
        const quote = this.currentChar();
        if (quote !== "'" && quote !== '"') {
            throw new Error('Expected string literal');
        }
        
        const startPos = this.position;
        this.position++; // Skip opening quote
        this.token = ''; // Clear current token
        
        let value = '';
        let escaped = false;
        
        while (this.hasMore() && (escaped || this.currentChar() !== quote)) {
            if (escaped) {
                value += this.currentChar();
                escaped = false;
            } else if (this.currentChar() === '\\') {
                escaped = true;
            } else {
                value += this.currentChar();
            }
            this.position++;
        }
        
        if (this.currentChar() !== quote) {
            throw new Error('Unterminated string literal');
        }
        
        this.position++; // Skip closing quote
        
        // Clear any accumulated token that might have been built during string parsing
        this.token = '';
        
        return value;
    }

    /**
     * Parse optional clauses (WHERE, ORDER BY, LIMIT, SKIP)
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseOptionalClauses(queryPlan) {
        while (this.hasMore()) {
            this.ignoreWhiteSpaceAndComments();
            
            if (this.matchKeyword('WHERE')) {
                queryPlan.where = this.parseExpression();
            } else if (this.matchKeyword('ORDER')) {
                this.expectKeyword('BY');
                const order = {
                    items: []
                };
                
                do {
                    const item = {
                        expression: this.parseExpression(),
                        direction: 'ASC'
                    };
                    
                    if (this.matchKeyword('DESC')) {
                        item.direction = 'DESC';
                    } else if (this.matchKeyword('ASC')) {
                        item.direction = 'ASC';
                    }
                    
                    order.items.push(item);
                    
                    if (this.checkChar(',')) {
                        this.expectChar(',');
                    } else {
                        break;
                    }
                } while (this.hasMore());
                
                queryPlan.order = order;
            } else if (this.matchKeyword('LIMIT')) {
                queryPlan.limit = this.parseExpression();
            } else if (this.matchKeyword('SKIP')) {
                queryPlan.skip = this.parseExpression();
            } else {
                break;
            }
        }
    }

    /**
     * Parse UNWIND clause
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseUnwindClause(queryPlan) {
        this.ignoreWhiteSpaceAndComments();
        
        // Parse the expression to unwind
        const unwindExpression = this.parseExpression();
        
        this.ignoreWhiteSpaceAndComments();
        this.expectKeyword('AS');
        this.ignoreWhiteSpaceAndComments();
        
        // Parse the variable name
        const variable = this.parseIdentifier();
        
        queryPlan.unwind = {
            expression: unwindExpression,
            variable: variable
        };
    }

    /**
     * Parse LOAD CSV clause
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseLoadCsvClause(queryPlan) {
        this.ignoreWhiteSpaceAndComments();
        this.expectKeyword('CSV');
        
        this.ignoreWhiteSpaceAndComments();
        
        // Check for WITH HEADERS
        let withHeaders = false;
        if (this.matchKeyword('WITH')) {
            this.expectKeyword('HEADERS');
            withHeaders = true;
        }
        
        this.ignoreWhiteSpaceAndComments();
        this.expectKeyword('FROM');
        
        this.ignoreWhiteSpaceAndComments();
        
        // Parse the URL/FILE path as a string literal
        const fromExpression = this.parseExpression();
        
        this.ignoreWhiteSpaceAndComments();
        this.expectKeyword('AS');
        
        this.ignoreWhiteSpaceAndComments();
        
        // Parse the variable name
        const variable = this.parseIdentifier();
        
        queryPlan.loadCsv = {
            withHeaders: withHeaders,
            from: fromExpression,
            variable: variable
        };
    }

    /**
     * Parse WITH clause
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseWithClause(queryPlan) {
        if (this.matchKeyword('DISTINCT')) {
            queryPlan.distinct = true;
        }
        
        this.ignoreWhiteSpaceAndComments();
        
        // Parse with items
        do {
            const item = this.parseReturnItem();
            queryPlan.returns.push(item);
            
            if (this.checkChar(',')) {
                this.expectChar(',');
            } else {
                break;
            }
            
            this.ignoreWhiteSpaceAndComments();
        } while (this.hasMore());
    }

    /**
     * Parse DELETE clause
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseDeleteClause(queryPlan) {
        this.ignoreWhiteSpaceAndComments();
        
        queryPlan.delete = {
            items: []
        };
        
        // Parse expressions to delete
        do {
            const expression = this.parseExpression();
            queryPlan.delete.items.push(expression);
            
            if (this.checkChar(',')) {
                this.expectChar(',');
            } else {
                break;
            }
            
            this.ignoreWhiteSpaceAndComments();
        } while (this.hasMore());
    }

    /**
     * Parse SET clause
     * @param {Object} queryPlan - Query plan to populate
     * @private
     */
    parseSetClause(queryPlan) {
        this.ignoreWhiteSpaceAndComments();
        
        queryPlan.set = {
            items: []
        };
        
        // Parse property assignments
        do {
            const property = this.parseExpression();
            this.expectChar('=');
            const value = this.parseExpression();
            
            queryPlan.set.items.push({
                property: property,
                value: value
            });
            
            if (this.checkChar(',')) {
                this.expectChar(',');
            } else {
                break;
            }
            
            this.ignoreWhiteSpaceAndComments();
        } while (this.hasMore());
    }

    // Utility methods
    reset() {
        this.position = 0;
        this.token = '';
        this.rollbackPosition = undefined;
        this.inQuotes = false;
    }

    hasMore() {
        return this.position < this.statementText.length;
    }

    currentChar() {
        return this.statementText.charAt(this.position);
    }

    nextChar() {
        return this.statementText.charAt(this.position + 1);
    }

    advanceToken() {
        this.token = '';
    }

    getToken() {
        if (this.token === '') {
            this.accumulateToken();
        }
        return this.token;
    }

    accumulateToken() {
        this.ignoreWhiteSpaceAndComments();
        this.token = '';
        
        while (this.hasMore() && !this.isTokenSeparator(this.currentChar())) {
            this.token += this.currentChar();
            this.position++;
        }
    }

    isTokenSeparator(char) {
        return ' \n\r\t(),:{}'.includes(char) || char === '"' || char === "'" || char === '[' || char === ']' || char === '*';
    }

    isValidIdentifierChar(char) {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(char) || 
               (this.token.length > 0 && /[a-zA-Z0-9_]/.test(char));
    }

    checkChar(char) {
        this.ignoreWhiteSpaceAndComments();
        if (this.currentChar() === char) {
            return true;
        }
        return false;
    }

    expectChar(char) {
        this.ignoreWhiteSpaceAndComments();
        if (this.currentChar() !== char) {
            throw new Error(`Expected '${char}', got '${this.currentChar()}'`);
        }
        this.position++;
    }

    checkKeyword(keyword) {
        this.ignoreWhiteSpaceAndComments();
        const remaining = this.statementText.substring(this.position);
        const keywordUpper = keyword.toUpperCase();
        
        if (remaining.toUpperCase().startsWith(keywordUpper)) {
            const nextChar = remaining.charAt(keyword.length);
            if (!nextChar || /[ \n\r\t(),]/.test(nextChar)) {
                return true;
            }
        }
        return false;
    }

    matchKeyword(keyword) {
        if (this.checkKeyword(keyword)) {
            this.position += keyword.length;
            return true;
        }
        return false;
    }

    expectKeyword(keyword) {
        if (!this.matchKeyword(keyword)) {
            throw new Error(`Expected keyword '${keyword}'`);
        }
    }

    checkStringLiteral() {
        const char = this.currentChar();
        return char === '"' || char === "'";
    }

    checkNumber() {
        const token = this.getToken();
        return !isNaN(parseFloat(token)) && isFinite(token);
    }

    checkIdentifier() {
        const token = this.getToken();
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token);
    }

    peekVariableName() {
        this.accumulateToken();
        const token = this.getToken();
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token) && 
               !this.checkKeyword(token) && 
               !this.checkNumber();
    }

    ignoreWhiteSpaceAndComments() {
        while (this.hasMore()) {
            const char = this.currentChar();
            
            if (' \n\r\t'.includes(char)) {
                this.position++;
                continue;
            }
            
            if (char === '/' && this.nextChar() === '/') {
                while (this.hasMore() && this.currentChar() !== '\n') {
                    this.position++;
                }
                continue;
            }
            
            break;
        }
    }
}

module.exports = { QueryEngine };
