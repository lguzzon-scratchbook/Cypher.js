/**
 * ExpressionEvaluator - Evaluates Cypher expressions
 */
export class ExpressionEvaluator {
	/**
	 * @param {Object} context - Execution context
	 */
	constructor(context = {}) {
		this.context = context;
	}

	/**
	 * Evaluate an expression
	 * @param {*} expr - Expression to evaluate
	 * @param {Object} [context={}] - Execution context
	 * @returns {*}
	 */
	evaluate(expr, context = {}) {
		const ctx = { ...this.context, ...context };

		if (expr === null || expr === undefined) {
			return null;
		}

		// Handle object expressions
		if (typeof expr === 'object') {
			if (expr.type) {
				return this.evaluateNode(expr, ctx);
			}
			return expr;
		}

		// Handle string expressions
		if (typeof expr === 'string') {
			return this.evaluateString(expr, ctx);
		}

		return expr;
	}

	/**
	 * Evaluate a node expression
	 * @param {Object} expr
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluateNode(expr, context) {
		switch (expr.type) {
			case 'Literal':
				return expr.value;

			case 'PropertyAccess':
				return this.evaluatePropertyAccess(expr, context);

			case 'FunctionCall':
				return this.evaluateFunctionCall(expr, context);

			case 'BinaryExpression':
				return this.evaluateBinaryExpression(expr, context);

			case 'UnaryExpression':
				return this.evaluateUnaryExpression(expr, context);

			case 'Identifier':
				return context[expr.name] ?? null;

			default:
				return null;
		}
	}

	/**
	 * Evaluate property access
	 * @param {Object} expr
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluatePropertyAccess(expr, context) {
		const object = this.evaluate(expr.object, context);
		if (object && typeof object === 'object') {
			return object[expr.property];
		}
		return null;
	}

	/**
	 * Evaluate function call
	 * @param {Object} expr
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluateFunctionCall(expr, context) {
		const fn = this.functions[expr.name];
		if (fn) {
			const args = (expr.arguments || []).map((arg) =>
				this.evaluate(arg, context)
			);
			return fn.apply(this, args);
		}
		return null;
	}

	/**
	 * Evaluate binary expression
	 * @param {Object} expr
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluateBinaryExpression(expr, context) {
		const left = this.evaluate(expr.left, context);
		const right = this.evaluate(expr.right, context);

		switch (expr.operator) {
			case '+':
				return left + right;
			case '-':
				return left - right;
			case '*':
				return left * right;
			case '/':
				return left / right;
			case '%':
				return left % right;
			case '=':
				return left === right;
			case '==':
				return left === right;
			case '!=':
				return left !== right;
			case '<':
				return left < right;
			case '>':
				return left > right;
			case '<=':
				return left <= right;
			case '>=':
				return left >= right;
			case 'AND':
				return left && right;
			case 'OR':
				return left || right;
			case 'CONTAINS':
				return String(left).includes(String(right));
			case 'STARTS WITH':
				return String(left).startsWith(String(right));
			case 'ENDS WITH':
				return String(left).endsWith(String(right));
			case 'IN':
				return Array.isArray(right) && right.includes(left);
			default:
				return null;
		}
	}

	/**
	 * Evaluate unary expression
	 * @param {Object} expr
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluateUnaryExpression(expr, context) {
		const operand = this.evaluate(expr.operand, context);

		switch (expr.operator) {
			case 'NOT':
				return !operand;
			case '-':
				return -operand;
			default:
				return null;
		}
	}

	/**
	 * Evaluate string expression (simple evaluation)
	 * @param {string} expr
	 * @param {Object} context
	 * @returns {*}
	 */
	evaluateString(expr, context) {
		// Handle simple string literals
		if (
			(expr.startsWith('"') && expr.endsWith('"')) ||
			(expr.startsWith("'") && expr.endsWith("'"))
		) {
			return expr.slice(1, -1);
		}

		// Handle numeric literals
		if (/^-?\d+(\.\d+)?$/.test(expr)) {
			return parseFloat(expr);
		}

		// Handle boolean literals
		if (expr === 'true') return true;
		if (expr === 'false') return false;
		if (expr === 'null') return null;

		// Look up in context
		return context[expr];
	}

	/**
	 * Built-in functions
	 */
	functions = {
		// String functions
		toUpper: (s) => String(s).toUpperCase(),
		toLower: (s) => String(s).toLowerCase(),
		trim: (s) => String(s).trim(),
		left: (s, n) => String(s).slice(0, n),
		right: (s, n) => String(s).slice(-n),
		substring: (s, start, len) => String(s).substring(start, start + len),
		replace: (s, find, replace) => String(s).replace(find, replace),
		split: (s, delimiter) => String(s).split(delimiter),
		length: (s) => String(s).length,

		// Math functions
		abs: (n) => Math.abs(n),
		ceil: (n) => Math.ceil(n),
		floor: (n) => Math.floor(n),
		round: (n) => Math.round(n),
		sqrt: (n) => Math.sqrt(n),
		rand: () => Math.random(),
		sin: (n) => Math.sin(n),
		cos: (n) => Math.cos(n),
		tan: (n) => Math.tan(n),

		// Type functions
		toString: (v) => String(v),
		toInteger: (v) => parseInt(v, 10),
		toFloat: (v) => parseFloat(v),
		type: (v) => typeof v,
		labels: (node) => node?.labels || [],
		keys: (obj) => Object.keys(obj || {}),
		properties: (obj) => (obj ? { ...obj } : null),

		// Collection functions
		size: (arr) => (Array.isArray(arr) ? arr.length : String(arr).length),
		head: (arr) => arr?.[0],
		last: (arr) => arr?.[arr.length - 1],
		tail: (arr) => arr?.slice(1),
		collect: (v) => [v],
		reverse: (arr) => [...(arr || [])].reverse(),
	};
}

export default ExpressionEvaluator;
