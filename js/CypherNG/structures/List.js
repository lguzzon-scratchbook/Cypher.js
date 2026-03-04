/**
 * @fileoverview List - List wrapper with lazy binding support.
 * Part of CypherNG data structures.
 */

/**
 * List - A array wrapper with lazy binding support.
 *
 * @class
 * @memberof CypherNG.structures
 * @param {*[]} [list=[]] - Initial array of elements
 * @param {Function} [bindFunction] - Optional custom bind function for elements
 * @description
 * List wrapper that supports lazy binding - elements can be expressions
 * that are evaluated when the list is accessed. Useful for query
 * results where values may be computed lazily.
 *
 * Persistence Design Note: The internal list array stores raw elements
 * (potentially expressions). For persistence, serialize the bound values
 * only (call value() on each element before storage).
 */
function List(list, bindFunction) {
    var list = (list && (list.constructor == Array) && list) || [];
    var boundList = (typeof module !== 'undefined' && module.exports ?
        require('./utils.js').addArrayFunctions :
        CypherNG.structures.addArrayFunctions)([]);
    var me = this;

    /**
     * Bind all elements - evaluate expressions and store in bound list.
     * @private
     */
    var bind = function() {
        if (!bindFunction) {
            for (var i = 0; i < list.length; i++) {
                boundList[i] = (list[i].value && typeof list[i].value === 'function') ?
                    list[i].value() : list[i];
            }
        } else if (bindFunction) {
            for (var i = 0; i < list.length; i++) {
                boundList[i] = bindFunction(list[i]);
            }
        }
    };

    /**
     * Add an element to the list.
     *
     * @param {*} expression - The value or expression to add
     */
    this.add = function(expression) {
        if (!expression) {
            return;
        }
        list.push(expression);
        boundList.push(null);
    };

    /**
     * Get the list as a plain array.
     *
     * @returns {*[]} The bound list as a plain array with helper functions
     */
    this.get = function() {
        bind();
        var boundListCopy = new Array(boundList.length);
        for (var i = 0; i < boundList.length; i++) {
            // Check for NodeReference or RelationshipReference
            var NodeReference = (typeof module !== 'undefined' && module.exports ?
                require('../core/References.js').NodeReference :
                CypherNG.core.NodeReference);
            var RelationshipReference = (typeof module !== 'undefined' && module.exports ?
                require('../core/References.js').RelationshipReference :
                CypherNG.core.RelationshipReference);

            if (boundList[i].constructor == NodeReference ||
                boundList[i].constructor == RelationshipReference) {
                boundListCopy[i] = boundList[i];
                continue;
            }
            boundListCopy[i] = boundList[i];
            boundListCopy[i].constructor = boundList[i].constructor;
            for (var key in boundList[i]) {
                if (boundListCopy[i][key]) {
                    boundListCopy[i][key].constructor =
                        boundList[i][key].constructor;
                }
            }
        }
        return (typeof module !== 'undefined' && module.exports ?
            require('./utils.js').addArrayFunctions :
            CypherNG.structures.addArrayFunctions)(boundListCopy);
    };

    /**
     * Set an element at a specific index.
     *
     * @param {number} elementIndex - The index to set
     * @param {*} element - The new element value
     */
    this.setElement = function(elementIndex, element) {
        list[elementIndex] = element;
    };

    /**
     * Get the internal elements array (unbound).
     *
     * @returns {*[]} The internal elements array
     */
    this.getElements = function() {
        return list;
    };

    /**
     * Iterator: Get next element (not implemented).
     *
     * @returns {boolean} Always returns false
     */
    this.next = function() {
        return false;
    };

    /**
     * Iterator: Check if more elements exist.
     *
     * @returns {boolean} Always returns true
     */
    this.hasNext = function() {
        return true;
    };

    /**
     * Iterator: Reset iterator position.
     */
    this.reset = function() {
        ;
    };

    /**
     * Get the data object.
     *
     * @returns {List} This instance
     */
    this.getData = function() {
        return me;
    };

    /**
     * Get the value (alias for get).
     *
     * @returns {*[]} The bound list as a plain array
     */
    this.value = function() {
        return me.get();
    };

    /**
     * Get the type name.
     *
     * @returns {string} The constructor name
     */
    this.type = function() {
        return me.constructor.name;
    };

    /**
     * Group by key (alias for get).
     *
     * @returns {*[]} The bound list as a plain array
     */
    this.groupByKey = function() {
        return me.get();
    };

    /**
     * Group by value (alias for get).
     *
     * @returns {*[]} The bound list as a plain array
     */
    this.groupByValue = function() {
        return me.get();
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.List = List;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
