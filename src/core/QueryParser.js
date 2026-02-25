/**
 * QueryParser - Parses Cypher queries into an AST
 */
export class QueryParser {
	constructor() {
		// Reserved keywords
		this.keywords = [
			'MATCH',
			'OPTIONAL',
			'WHERE',
			'RETURN',
			'ORDER',
			'BY',
			'SKIP',
			'LIMIT',
			'CREATE',
			'MERGE',
			'SET',
			'DELETE',
			'REMOVE',
			'WITH',
			'UNWIND',
			'AS',
			'DISTINCT',
			'CALL',
			'YIELD',
			'UNION',
			'LOAD',
			'CSV',
			'FOREACH',
			'START',
			'END',
			'NULL',
			'TRUE',
			'FALSE',
			'AND',
			'OR',
			'NOT',
			'STARTS',
			'ENDS',
			'CONTAINS',
			'IN',
			'IS',
			'REVERSE',
		];

		// Clauses that can start a query
		this.clauseStarters = [
			'MATCH',
			'OPTIONAL',
			'CREATE',
			'MERGE',
			'SET',
			'DELETE',
			'REMOVE',
			'RETURN',
			'WITH',
			'UNWIND',
			'CALL',
			'WHERE',
			'ORDER',
			'SKIP',
			'LIMIT',
			'LOAD',
		];
	}

	/**
	 * Parse a Cypher query into an AST
	 * @param {string} query
	 * @returns {Object}
	 */
	parse(query) {
		const normalized = this.normalize(query);
		const tokens = this.tokenize(normalized);

		return this.buildAST(tokens);
	}

	/**
	 * Normalize query string
	 * @param {string} query
	 * @returns {string}
	 */
	normalize(query) {
		return query.replace(/\s+/g, ' ').trim();
	}

	/**
	 * Simple tokenizer
	 * @param {string} query
	 * @returns {string[]}
	 */
	tokenize(query) {
		const tokens = [];
		let current = '';
		let inString = false;
		let stringChar = '';

		for (let i = 0; i < query.length; i++) {
			const char = query[i];
			const prevChar = query[i - 1] || '';
			const nextChar = query[i + 1] || '';

			if ((char === '"' || char === "'") && !inString) {
				inString = true;
				stringChar = char;
				current += char;
			} else if (char === stringChar && inString) {
				inString = false;
				current += char;
				tokens.push(current);
				current = '';
			} else if (char === ' ' && !inString) {
				if (current) {
					tokens.push(current);
					current = '';
				}
			} else if (!inString && this.isDelimiter(char)) {
				if (char === '.' && /\d/.test(prevChar) && /\d/.test(nextChar)) {
					current += char;
					continue;
				}
				if (current) {
					tokens.push(current);
					current = '';
				}
				tokens.push(char);
			} else {
				current += char;
			}
		}

		if (current) {
			tokens.push(current);
		}

		return tokens;
	}

	/**
	 * Check if character is a delimiter
	 * @param {string} char
	 * @returns {boolean}
	 */
	isDelimiter(char) {
		return '(){},[]=<>.*:+-/'.includes(char);
	}

	/**
	 * Build AST from tokens
	 * @param {string[]} tokens
	 * @returns {Object}
	 */
	buildAST(tokens) {
		// Basic AST structure
		const ast = {
			type: 'Query',
			clauses: [],
			parameters: {},
		};

		let currentClause = null;
		let i = 0;

		while (i < tokens.length) {
			const token = tokens[i].toUpperCase();

			if (this.isClauseStarter(token)) {
				// Handle STARTS WITH and ENDS WITH as compound operators within WHERE
				if (token === 'WITH' && currentClause) {
					const prevTokens = currentClause.body;
					const lastToken = prevTokens[prevTokens.length - 1]?.toUpperCase();
					if (lastToken === 'STARTS' || lastToken === 'ENDS') {
						currentClause.body.push(tokens[i]);
						i++;
						continue;
					}
				}

				if (currentClause) {
					ast.clauses.push(currentClause);
				}
				currentClause = {
					type: token,
					body: [],
				};
				i++;
			} else if (currentClause) {
				currentClause.body.push(tokens[i]);
				i++;
			} else {
				i++;
			}
		}

		if (currentClause) {
			ast.clauses.push(currentClause);
		}

		return ast;
	}

	/**
	 * Check if token is a clause starter
	 * @param {string} token
	 * @returns {boolean}
	 */
	isClauseStarter(token) {
		return this.clauseStarters.includes(token);
	}
}

export default QueryParser;
