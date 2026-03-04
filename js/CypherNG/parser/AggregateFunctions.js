/**
 * @fileoverview Aggregate functions for Cypher queries.
 * Defines aggregation functions like sum, count, min, max, etc.
 */

/**
 * AggregateFunction - Represents an aggregate function for Cypher queries.
 *
 * @class
 * @memberof CypherNG.parser
 * @param {string} _displayValue - The function name
 * @param {number} _minimumExpectedParameterCount - Minimum parameters required
 * @param {number} _maximumExpectedParameterCount - Maximum parameters allowed
 * @param {Function} _initFunction - Initialization function
 * @param {Function} _valueFunction - Function to get the aggregated value
 * @param {Function} _aggregateFunction - Function to perform aggregation
 * @param {*} [_returnType] - Optional return type hint
 */
function AggregateFunction(_displayValue, _minimumExpectedParameterCount, _maximumExpectedParameterCount, _initFunction, _valueFunction, _aggregateFunction, _returnType) {
    var displayValue = _displayValue;
    var parsedParameterCount = 0;
    var minimumExpectedParameterCount = _minimumExpectedParameterCount;
    var maximumExpectedParameterCount = _maximumExpectedParameterCount;
    var returnType = _returnType;

    this.initialize = _initFunction;
    this.value = _valueFunction;
    this.getObject = _valueFunction;
    this.aggregate = _aggregateFunction;
    this.isFunction = true;

    this.initializeIfNecessary = function() {
        this.initialize();
    };

    this.displayValue = function() {
        return displayValue;
    };
    this.precedence = function() {
        return 12;
    };
    this.leftAssociativity = function() {
        return true;
    };
    this.rightAssociativity = function() {
        return !this.leftAssociativity;
    };
    this.parametric = function() {
        return minimumExpectedParameterCount > 0;
    };
    this.parsedParameterCount = function() {
        return parsedParameterCount;
    };
    this.verifyParsedParameterCount = function(_parsedParameterCount) {
        parsedParameterCount = _parsedParameterCount;
        if (parsedParameterCount < minimumExpectedParameterCount) {
            throw "Too few parameters for function \"" + displayValue + "\".";
        } else if (parsedParameterCount > maximumExpectedParameterCount) {
            throw "Too many parameters for function \"" + displayValue + "\".";
        }
    };
    this.returnType = function() {
        return returnType;
    };
}

/**
 * Collection of all Cypher aggregate functions.
 * @namespace
 */
AggregateFunction.f = {};

/**
 * sum - Sum aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.sum =
    new AggregateFunction(
        "sum",
        1, 1,
        function() {
            if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = 0;
            }
        },
        function() {
            return this.getGroupBy().getReducer(this.getReducerId()).result || (new Number(0));
        },
        function() {
            this.initializeIfNecessary();
            this.getGroupBy().getReducer(this.getReducerId()).result += this.p[0].value();
        }
    );

/**
 * barchart - Barchart aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.barchart =
    new AggregateFunction(
        "barchart",
        1, 1,
        function() {
            if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = {};
            }
        },
        function() {
            var addAssociativeArrayFunctions = (typeof module !== 'undefined' && module.exports ?
                require('../structures/utils.js').addAssociativeArrayFunctions :
                CypherNG.structures.addAssociativeArrayFunctions);
            return addAssociativeArrayFunctions(
                this.getGroupBy().getReducer(this.getReducerId()).result
            );
        },
        function() {
            this.initializeIfNecessary();
            var key = (this.p[0].value().groupByKey &&
                this.p[0].value().groupByKey()) || this.p[0].value();
            if (this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                this.getGroupBy().getReducer(this.getReducerId()).result[key] = 0;
            }
            this.getGroupBy().getReducer(this.getReducerId()).result[key]++;
        }
    );

/**
 * histogram - Histogram aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.histogram =
    new AggregateFunction(
        "histogram",
        1, 2,
        function() {
            if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = {
                    values: [],
                    histogram: null
                };
            }
        },
        function() {
            var addArrayFunctions = (typeof module !== 'undefined' && module.exports ?
                require('../structures/utils.js').addArrayFunctions :
                CypherNG.structures.addArrayFunctions);
            var r = this.getGroupBy().getReducer(this.getReducerId()).result;
            if (r.histogram == null) {
                var bins = (this.p[1] && this.p[1].value()) || 10;
                var min = r.values[0], max = r.values[0];
                var histogram = new Array(bins).fill(0);
                for (var i = 0; i < r.values.length; i++) {
                    if (r.values[i] < min) {
                        min = r.values[i];
                    }
                    if (r.values[i] > max) {
                        max = r.values[i];
                    }
                }
                var step = (max - min) / bins;
                for (var i = 0; i < r.values.length; i++) {
                    histogram[Math.floor(r.values[i] / step)]++;
                }
                r.histogram = new Array(bins);
                var from = min;
                for (var i = 0; i < bins; i++) {
                    r.histogram[i] = {
                        label: "[" + from + ", " + (from + step) + ">",
                        value: histogram[i],
                        from: from,
                        to: from + step
                    };
                    from += step;
                }
            }
            return addArrayFunctions(r.histogram);
        },
        function() {
            this.initializeIfNecessary();
            this.getGroupBy().getReducer(this.getReducerId()).result.values.push(
                this.p[0].value()
            );
        }
    );

/**
 * min - Minimum aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.min =
    new AggregateFunction(
        "min",
        1, 1,
        function() {
            ;
        },
        function() {
            return this.getGroupBy().getReducer(this.getReducerId()).result;
        },
        function() {
            if ((this.getGroupBy().getReducer(this.getReducerId()).result == undefined) ||
                this.p[0].value() < this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = this.p[0].value();
            }
        }
    );

/**
 * max - Maximum aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.max =
    new AggregateFunction(
        "max",
        1, 1,
        function() {
            ;
        },
        function() {
            return this.getGroupBy().getReducer(this.getReducerId()).result;
        },
        function() {
            if ((this.getGroupBy().getReducer(this.getReducerId()).result == undefined) ||
                this.p[0].value() > this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = this.p[0].value();
            }
        }
    );

/**
 * count - Count aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.count =
    new AggregateFunction(
        "count",
        1, 1,
        function() {
            if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
                if (!this.distinct()) {
                    this.getGroupBy().getReducer(this.getReducerId()).result = 0;
                } else if (this.distinct()) {
                    this.getGroupBy().getReducer(this.getReducerId()).result = {};
                }
            }
        },
        function() {
            if (!this.distinct()) {
                return this.getGroupBy().getReducer(this.getReducerId()).result || (new Number(0));
            } else if (this.distinct()) {
                return Object.keys(this.getGroupBy().getReducer(this.getReducerId()).result).length;
            }
        },
        function() {
            this.initializeIfNecessary();
            if (!this.distinct()) {
                this.getGroupBy().getReducer(this.getReducerId()).result += 1;
            } else if (this.distinct()) {
                var key = (this.p[0].value().groupByKey &&
                    this.p[0].value().groupByKey()) || this.p[0].value();
                key = JSON.stringify(key);
                if (this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                    this.getGroupBy().getReducer(this.getReducerId()).result[key] = true;
                }
            }
        }
    );

/**
 * stdev - Standard deviation aggregation function.
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.stdev =
    new AggregateFunction(
        "stdev",
        1, 1,
        function() {
            if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
                this.getGroupBy().getReducer(this.getReducerId()).result = [];
            }
        },
        function() {
            var sum = 0, avg, values = this.getGroupBy().getReducer(this.getReducerId()).result;
            for (var i = 0; i < values.length; i++) {
                sum += values[i];
            }
            avg = sum / values.length;
            sum = 0;
            for (var i = 0; i < values.length; i++) {
                sum += Math.pow(values[i] - avg, 2);
            }
            return Math.sqrt(sum / (values.length - 1));
        },
        function() {
            this.initializeIfNecessary();
            this.getGroupBy().getReducer(this.getReducerId()).result.push(
                this.p[0].value()
            );
        }
    );

/**
 * collect - Collect aggregation function (returns array of values).
 * @memberof CypherNG.parser.AggregateFunction
 */
AggregateFunction.f.collect =
    new AggregateFunction(
        "collect",
        1, 1,
        function() {
            if (!this.getGroupBy().getReducer(this.getReducerId()).result) {
                if (!this.distinct()) {
                    var addArrayFunctions = (typeof module !== 'undefined' && module.exports ?
                        require('../structures/utils.js').addArrayFunctions :
                        CypherNG.structures.addArrayFunctions);
                    this.getGroupBy().getReducer(this.getReducerId()).result = addArrayFunctions([]);
                } else if (this.distinct()) {
                    this.getGroupBy().getReducer(this.getReducerId()).result = {};
                }
            }
        },
        function() {
            var addArrayFunctions = (typeof module !== 'undefined' && module.exports ?
                require('../structures/utils.js').addArrayFunctions :
                CypherNG.structures.addArrayFunctions);
            if (!this.distinct()) {
                return this.getGroupBy().getReducer(this.getReducerId()).result || addArrayFunctions([]);
            } else if (this.distinct()) {
                return addArrayFunctions(Object.values(this.getGroupBy().getReducer(this.getReducerId()).result));
            }
        },
        function() {
            this.initializeIfNecessary();
            var val = this.p[0].value();
            if (val == null && val == undefined) {
                return;
            }
            if (!this.distinct()) {
                this.getGroupBy().getReducer(this.getReducerId()).result.push(this.p[0].value());
            } else if (this.distinct()) {
                var key = (this.p[0].value().groupByKey &&
                    this.p[0].value().groupByKey()) || this.p[0].value();
                key = JSON.stringify(key);
                if (this.getGroupBy().getReducer(this.getReducerId()).result[key] == undefined) {
                    this.getGroupBy().getReducer(this.getReducerId()).result[key] = this.p[0].value();
                }
            }
        }
    );

// Build trie for fast aggregate function lookup
AggregateFunction.trie = (function() {
    var buildTrie = function(f) {
        var trie = {};
        for (var key in f) {
            var displayValue = f[key].displayValue();
            var trieNode = trie;
            for (var i = 0; i < displayValue.length; i++) {
                var char = displayValue.charAt(i).toUpperCase();
                if (!trieNode[char]) {
                    trieNode[char] = {};
                }
                trieNode = trieNode[char];
            }
            trieNode.isF = true;
            trieNode.f = f[key];
        }
        return trie;
    };
    return buildTrie(AggregateFunction.f);
})();

AggregateFunction.latestParsed = null;

/**
 * Check if text at position is an aggregate function.
 *
 * @memberof CypherNG.parser.AggregateFunction
 * @param {string} expression - The expression text
 * @param {number} position - The position to check
 * @returns {number} Number of characters matched, or 0 if not an aggregate function
 */
AggregateFunction.isAggregateFunction = function(expression, position) {
    var isF = function(what, trie, expr, pos, noEndOfKeyWordCheck) {
        var trieNode = trie;
        var i = pos;
        var get = function(ix) {
            return expr.charAt(ix).toUpperCase();
        };
        var endOfKeyWord = function(ix) {
            if (noEndOfKeyWordCheck) {
                return true;
            }
            return get(ix) == " " ||
                get(ix) == "(" ||
                get(ix) == ")" ||
                get(ix) == "," ||
                get(ix) == "" ||
                get(ix) == "}" ||
                get(ix) == "\t" ||
                get(ix) == "\n" ||
                get(ix) == "\r" ||
                (get(ix) == "/" && get(ix + 1) == "/");
        };
        for (;;) {
            if (trieNode[get(i)]) {
                trieNode = trieNode[get(i)];
                if (trieNode.isF && !trieNode[get(i + 1)] && endOfKeyWord(i + 1)) {
                    what.latestParsed = trieNode.f;
                    return (i - pos) + 1;
                }
                i++;
            } else {
                return 0;
            }
        }
    };
    return isF(AggregateFunction, AggregateFunction.trie, expression, position);
};

// Export for both browser and Node.js
(function(exports) {
    exports.AggregateFunction = AggregateFunction;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).parser = (this.CypherNG = this.CypherNG || {}).parser || {});
