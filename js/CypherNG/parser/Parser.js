/**
 * @fileoverview Parser module for Cypher query parsing
 *
 * Handles parsing of Cypher query strings into executable operations.
 * Supports MATCH, CREATE, MERGE, RETURN, WITH, DELETE, WHERE, UNWIND, and LOAD CSV.
 *
 * @module CypherNG/parser/Parser
 *
 * @example
 * const { Parser } = require('./parser');
 * const parser = new Parser(engine);
 * parser.parse('MATCH (n) RETURN n');
 */

const { Match, Create, Merge, Delete, Return, With, OrderBy } = require('../query');
const { Where } = require('../query/Where');
const { ReturnValue } = require('../query/ReturnValue');
const { GroupBy } = require('../query/GroupBy');

/**
 * Parser for Cypher query language
 * @class
 * @param {Object} engine - The query engine instance
 */
class Parser {
    /**
     * @param {Object} engine - The query engine with statement and database
     */
    constructor(engine) {
        /** @private @type {Object} */
        this._engine = engine;
        /** @private @type {string} */
        this._queryText = '';
        /** @private @type {number} */
        this._position = 0;
        /** @private @type {string} */
        this._currentToken = '';
        /** @private @type {Object} */
        this._statement = engine.statement();
    }

    /**
     * Parse a Cypher query string
     * @param {string} queryText - The Cypher query to parse
     * @throws {Error} If parsing fails
     */
    parse(queryText) {
        this._queryText = queryText;
        this._position = 0;

        // Clear existing operations
        this._statement.clear();

        // Parse query clauses
        this._parseClauses();

        // Check for any remaining unexpected content
        this._skipWhitespace();
        if (this._position < this._queryText.length) {
            throw new Error('Unexpected token at position ' + this._position + ': ' + this._queryText.substring(this._position, this._position + 20));
        }
    }

    /**
     * Parse all clauses in the query
     * @private
     */
    _parseClauses() {
        let parsed = true;
        let hasReturn = false;

        while (parsed && this._position < this._queryText.length) {
            this._skipWhitespace();
            if (this._position >= this._queryText.length) break;

            // Check for Return first as it must be last
            if (this._tryParseReturn()) {
                hasReturn = true;
                break;
            }

            // Try other clauses
            parsed = this._tryParseMatch()
                || this._tryParseCreate()
                || this._tryParseMerge()
                || this._tryParseDelete()
                || this._tryParseWith()
                || this._tryParseUnwind()
                || this._tryParseLoadCsv();
        }

        // If no RETURN clause but query has results, add implicit return
        if (!hasReturn && this._statement.operations().length > 0) {
            // Query has operations but no explicit return - that's OK for internal use
        }
    }

    /**
     * Try to parse a MATCH clause
     * @private
     * @returns {boolean} True if MATCH was parsed
     */
    _tryParseMatch() {
        if (this._checkKeyword('MATCH')) {
            const match = new Match(this._statement);
            this._statement.addOperation(match);

            // Parse the pattern
            this._parsePattern(match);

            // Parse WHERE clause if present
            this._parseWhere(match);

            return true;
        }
        return false;
    }

    /**
     * Try to parse a CREATE clause
     * @private
     * @returns {boolean} True if CREATE was parsed
     */
    _tryParseCreate() {
        if (this._checkKeyword('CREATE')) {
            const create = new Create(this._statement);
            this._statement.addOperation(create);

            // Parse the pattern
            this._parsePattern(create);

            return true;
        }
        return false;
    }

    /**
     * Try to parse a MERGE clause
     * @private
     * @returns {boolean} True if MERGE was parsed
     */
    _tryParseMerge() {
        if (this._checkKeyword('MERGE')) {
            const merge = new Merge(this._statement);
            this._statement.addOperation(merge);

            // Parse the pattern
            this._parsePattern(merge);

            // Parse ON MATCH SET or ON CREATE SET
            this._parseMergeActions(merge);

            return true;
        }
        return false;
    }

    /**
     * Try to parse a DELETE clause
     * @private
     * @returns {boolean} True if DELETE was parsed
     */
    _tryParseDelete() {
        if (this._checkKeyword('DELETE')) {
            const deleteOp = new Delete(this._statement);
            this._statement.addOperation(deleteOp);

            // Parse variable to delete
            this._skipWhitespace();
            while (this._position < this._queryText.length) {
                const varName = this._parseIdentifier();
                if (varName) {
                    deleteOp.addVariable(varName);
                    this._skipWhitespace();
                    if (this._currentChar() === ',') {
                        this._advance();
                        this._skipWhitespace();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            return true;
        }
        return false;
    }

    /**
     * Try to parse a WITH clause
     * @private
     * @returns {boolean} True if WITH was parsed
     */
    _tryParseWith() {
        if (this._checkKeyword('WITH')) {
            const withOp = new With(this._statement);
            this._statement.addOperation(withOp);

            // Parse projection items
            this._parseProjectionList(withOp);

            // Parse WHERE if present
            this._parseWhere(withOp);

            // Parse ORDER BY if present
            this._parseOrderBy(withOp);

            // Parse LIMIT if present
            this._parseLimit(withOp);

            return true;
        }
        return false;
    }

    /**
     * Try to parse a RETURN clause
     * @private
     * @returns {boolean} True if RETURN was parsed
     */
    _tryParseReturn() {
        if (this._checkKeyword('RETURN')) {
            const returnOp = new Return(this._statement);
            this._statement.addOperation(returnOp);

            // Parse projection items
            this._parseProjectionList(returnOp);

            // Parse ORDER BY if present
            this._parseOrderBy(returnOp);

            // Parse LIMIT if present
            this._parseLimit(returnOp);

            return true;
        }
        return false;
    }

    /**
     * Try to parse an UNWIND clause
     * @private
     * @returns {boolean} True if UNWIND was parsed
     */
    _tryParseUnwind() {
        if (this._checkKeyword('UNWIND')) {
            this._skipWhitespace();

            // Parse expression (e.g., range(1,10) or [1,2,3])
            const expression = this._parseExpression();
            if (!expression) {
                throw new Error('Expected expression after UNWIND');
            }

            // Get variable name (what we're unwinding into)
            this._skipWhitespace();
            if (!this._checkKeyword('AS')) {
                throw new Error('Expected AS after UNWIND expression');
            }
            this._skipWhitespace();

            const alias = this._parseIdentifier();
            if (!alias) {
                throw new Error('Expected variable name after AS');
            }

            // Store unwind info for execution
            this._statement.setUnwind({
                expression: expression,
                alias: alias
            });

            return true;
        }
        return false;
    }

    /**
     * Try to parse a LOAD CSV clause
     * @private
     * @returns {boolean} True if LOAD CSV was parsed
     */
    _tryParseLoadCsv() {
        if (this._checkKeyword('LOAD CSV')) {
            // LOAD CSV WITH HEADERS FROM 'url' AS line
            let hasHeaders = false;

            this._skipWhitespace();
            if (this._checkKeyword('WITH HEADERS')) {
                hasHeaders = true;
            }

            this._skipWhitespace();
            if (!this._checkKeyword('FROM')) {
                throw new Error('Expected FROM after LOAD CSV');
            }

            this._skipWhitespace();

            // Parse the URL
            const url = this._parseString();
            if (!url) {
                throw new Error('Expected URL after FROM');
            }

            this._skipWhitespace();
            if (!this._checkKeyword('AS')) {
                throw new Error('Expected AS after URL');
            }

            this._skipWhitespace();

            // Parse variable name
            const alias = this._parseIdentifier();
            if (!alias) {
                throw new Error('Expected variable name after AS');
            }

            // Store load CSV info
            this._statement.setLoadCsv({
                url: url,
                alias: alias,
                hasHeaders: hasHeaders
            });

            return true;
        }
        return false;
    }

    /**
     * Parse WHERE clause
     * @private
     * @param {Object} operation - The operation to add WHERE to
     */
    _parseWhere(operation) {
        if (this._checkKeyword('WHERE')) {
            this._skipWhitespace();
            const condition = this._parseExpression();
            if (operation.where) {
                operation.where(condition);
            }
        }
    }

    /**
     * Parse ORDER BY clause
     * @private
     * @param {Object} operation - The operation to add ORDER BY to
     */
    _parseOrderBy(operation) {
        if (this._checkKeyword('ORDER BY')) {
            const orderBy = new OrderBy(this._statement);
            this._statement.addOperation(orderBy);

            this._skipWhitespace();
            while (this._position < this._queryText.length) {
                const expression = this._parseExpression();
                if (expression) {
                    let direction = 'ASC';
                    this._skipWhitespace();
                    if (this._checkKeyword('DESC')) {
                        direction = 'DESC';
                    } else if (this._checkKeyword('ASC')) {
                        direction = 'ASC';
                    }
                    orderBy.addSortItem(expression, direction);
                }

                this._skipWhitespace();
                if (this._currentChar() === ',') {
                    this._advance();
                    this._skipWhitespace();
                } else {
                    break;
                }
            }
        }
    }

    /**
     * Parse LIMIT clause
     * @private
     * @param {Object} operation - The operation to add LIMIT to
     */
    _parseLimit(operation) {
        if (this._checkKeyword('LIMIT')) {
            this._skipWhitespace();

            // Parse limit value - could be a number or parameter
            const limitValue = this._parseExpression();
            if (operation.setLimit) {
                operation.setLimit(limitValue);
            }
        }
    }

    /**
     * Parse a graph pattern (node relationships)
     * @private
     * @param {Object} operation - The operation to add pattern to
     */
    _parsePattern(operation) {
        // For now, we'll parse basic patterns
        // The actual pattern execution will be handled by the operation classes
        this._skipWhitespace();

        // Parse optional WHERE after pattern
        this._parseWhere(operation);
    }

    /**
     * Parse projection list (for WITH and RETURN)
     * @private
     * @param {Object} operation - The operation to add projections to
     */
    _parseProjectionList(operation) {
        this._skipWhitespace();

        // Check for DISTINCT
        const distinct = this._checkKeyword('DISTINCT');
        if (distinct && operation.setDistinct) {
            operation.setDistinct(true);
        }

        // Check for star (*)
        if (this._currentChar() === '*') {
            this._advance();
            // Return all variables
            return;
        }

        // Parse items
        while (this._position < this._queryText.length) {
            this._skipWhitespace();

            // Check if we're at a keyword (end of projection list)
            if (this._isKeywordStart(this._currentChar())) {
                break;
            }

            const expression = this._parseExpression();
            if (expression) {
                let alias = null;
                this._skipWhitespace();

                if (this._checkKeyword('AS')) {
                    this._skipWhitespace();
                    alias = this._parseIdentifier();
                }

                if (operation.addReturnItem) {
                    operation.addReturnItem(expression, alias);
                }
            }

            this._skipWhitespace();
            if (this._currentChar() === ',') {
                this._advance();
            } else {
                break;
            }
        }
    }

    /**
     * Parse ON MATCH / ON CREATE SET actions for MERGE
     * @private
     * @param {Object} merge - The merge operation
     */
    _parseMergeActions(merge) {
        this._skipWhitespace();

        // Parse optional ON MATCH SET or ON CREATE SET
        while (this._position < this._queryText.length) {
            if (this._checkKeyword('ON MATCH SET')) {
                this._parseSetClause(merge, 'ON MATCH');
            } else if (this._checkKeyword('ON CREATE SET')) {
                this._parseSetClause(merge, 'ON CREATE');
            } else {
                break;
            }
            this._skipWhitespace();
        }
    }

    /**
     * Parse SET clause
     * @private
     * @param {Object} operation - The operation to add SET to
     * @param {string} context - The SET context (normal, ON MATCH, ON CREATE)
     */
    _parseSetClause(operation, context) {
        this._skipWhitespace();

        while (this._position < this._queryText.length) {
            this._skipWhitespace();

            // Check for end of SET clause
            if (this._position >= this._queryText.length ||
                this._isKeywordStart(this._currentChar())) {
                break;
            }

            // Parse property or variable setting
            const left = this._parseExpression();
            if (!left) break;

            this._skipWhitespace();

            if (this._currentChar() === '=') {
                this._advance();
                this._skipWhitespace();
                const right = this._parseExpression();
                if (operation.addSetItem) {
                    operation.addSetItem(left, right, context);
                }
            }

            this._skipWhitespace();
            if (this._currentChar() === ',') {
                this._advance();
            } else {
                break;
            }
        }
    }

    /**
     * Parse a Cypher expression
     * @private
     * @returns {string} The expression string
     */
    _parseExpression() {
        this._skipWhitespace();
        const start = this._position;
        let depth = 0;
        let inString = false;
        let stringChar = '';

        while (this._position < this._queryText.length) {
            const char = this._currentChar();

            // Handle string literals
            if ((char === '"' || char === "'") && !inString) {
                inString = true;
                stringChar = char;
                this._advance();
            } else if (inString && char === stringChar) {
                inString = false;
                stringChar = '';
                this._advance();
            } else if (inString) {
                this._advance();
            } else if (char === '(' || char === '[' || char === '{') {
                depth++;
                this._advance();
            } else if (char === ')' || char === ']' || char === '}') {
                if (depth === 0) break;
                depth--;
                this._advance();
            } else if (depth === 0 && (char === ',' || this._isKeywordStart(char) || char === ' ' || char === '\t')) {
                // Don't include trailing whitespace or keywords
                if (char === ' ' || char === '\t') {
                    // Check if this is followed by a keyword
                    const remaining = this._queryText.substring(this._position + 1).trim().toUpperCase();
                    if (remaining.startsWith('WHERE') || remaining.startsWith('ORDER') ||
                        remaining.startsWith('LIMIT') || remaining.startsWith('AS') ||
                        remaining.startsWith('RETURN') || remaining.startsWith('WITH') ||
                        remaining.startsWith('MATCH') || remaining.startsWith('CREATE') ||
                        remaining.startsWith('MERGE') || remaining.startsWith('DELETE')) {
                        break;
                    }
                }
                // Check if this is a keyword being parsed
                let potentialKeyword = this._queryText.substring(start, this._position).trim().toUpperCase();
                if (potentialKeyword && this._isKeyword(potentialKeyword) && !inString) {
                    break;
                }
                if (char === ',') {
                    break;
                }
                this._advance();
            } else {
                this._advance();
            }
        }

        const expr = this._queryText.substring(start, this._position).trim();
        return expr || null;
    }

    /**
     * Parse an identifier
     * @private
     * @returns {string|null} The identifier or null
     */
    _parseIdentifier() {
        this._skipWhitespace();
        const start = this._position;

        if (!this._isIdentifierStart(this._currentChar())) {
            return null;
        }

        while (this._position < this._queryText.length) {
            const char = this._currentChar();
            if (this._isIdentifierChar(char)) {
                this._advance();
            } else {
                break;
            }
        }

        return this._queryText.substring(start, this._position);
    }

    /**
     * Parse a string literal
     * @private
     * @returns {string|null} The string content or null
     */
    _parseString() {
        this._skipWhitespace();
        const char = this._currentChar();

        if (char !== '"' && char !== "'") {
            return null;
        }

        const quote = char;
        this._advance();
        const start = this._position;

        while (this._position < this._queryText.length && this._currentChar() !== quote) {
            this._advance();
        }

        const str = this._queryText.substring(start, this._position);
        if (this._currentChar() === quote) {
            this._advance();
        }
        return str;
    }

    /**
     * Check if current position has a specific keyword
     * @private
     * @param {string} keyword - Keyword to check
     * @returns {boolean} True if keyword is present
     */
    _checkKeyword(keyword) {
        this._skipWhitespace();
        const upper = this._queryText.substring(this._position).trim().toUpperCase();
        if (upper.startsWith(keyword)) {
            // Make sure it's a complete word
            const afterKeyword = upper.substring(keyword.length);
            if (afterKeyword.length === 0 || !this._isIdentifierChar(afterKeyword[0])) {
                this._position += this._queryText.substring(this._position).trim().indexOf(keyword) + keyword.length;
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a word is a Cypher keyword
     * @private
     * @param {string} word - Word to check
     * @returns {boolean} True if it's a keyword
     */
    _isKeyword(word) {
        const keywords = ['MATCH', 'WHERE', 'RETURN', 'WITH', 'ORDER', 'BY', 'LIMIT',
            'CREATE', 'MERGE', 'DELETE', 'SET', 'UNWIND', 'AS', 'DISTINCT',
            'LOAD', 'CSV', 'FROM', 'HEADERS', 'ON', 'MATCH', 'AND', 'OR', 'NOT',
            'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];
        return keywords.includes(word.toUpperCase());
    }

    /**
     * Skip whitespace characters
     * @private
     */
    _skipWhitespace() {
        while (this._position < this._queryText.length) {
            const char = this._currentChar();
            if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                this._advance();
            } else {
                break;
            }
        }
    }

    /**
     * Get current character
     * @private
     * @returns {string} Current character
     */
    _currentChar() {
        return this._queryText[this._position] || '';
    }

    /**
     * Advance to next character
     * @private
     */
    _advance() {
        this._position++;
    }

    /**
     * Check if character can start an identifier
     * @private
     * @param {string} char - Character to check
     * @returns {boolean} True if can start identifier
     */
    _isIdentifierStart(char) {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_' || char === '`';
    }

    /**
     * Check if character can be in identifier
     * @private
     * @param {string} char - Character to check
     * @returns {boolean} True if can be in identifier
     */
    _isIdentifierChar(char) {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
            (char >= '0' && char <= '9') || char === '_' || char === '`';
    }

    /**
     * Check if character can start a keyword
     * @private
     * @param {string} char - Character to check
     * @returns {boolean} True if can start keyword
     */
    _isKeywordStart(char) {
        return (char >= 'A' && char <= 'Z');
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Parser };
}