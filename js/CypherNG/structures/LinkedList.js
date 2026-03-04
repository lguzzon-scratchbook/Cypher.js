/**
 * @fileoverview LinkedList - Linked list implementation.
 * Part of CypherNG data structures.
 */

/**
 * LinkedList - A doubly-linked list implementation.
 *
 * @class
 * @memberof CypherNG.structures
 * @description
 * Classic doubly-linked list with O(1) insertion at the end.
 * Each node has references to both previous and next nodes.
 *
 * Persistence Design Note: For persistence, convert to array using
 * toArray() and store the array. The linked list can be reconstructed
 * by adding elements back in order.
 */
function LinkedList() {
    var head = null;
    var current = null;
    var size = 0;

    /**
     * Node - Internal node class.
     *
     * @private
     * @param {*} data - The data stored in this node
     */
    function Node(_data) {
        var data = _data;
        var previous = null;
        var next = null;

        /**
         * Get the node data.
         *
         * @returns {*} The stored data
         */
        this.get = function() {
            return data;
        };

        /**
         * Set the previous node reference.
         *
         * @param {Node} node - The previous node
         */
        this.setPrevious = function(node) {
            previous = node;
        };

        /**
         * Set the next node reference.
         *
         * @param {Node} node - The next node
         */
        this.setNext = function(node) {
            next = node;
            if (node) {
                node.setPrevious(this);
            }
        };

        /**
         * Get the previous node.
         *
         * @returns {Node} The previous node
         */
        this.previous = function() {
            return previous;
        };

        /**
         * Get the next node.
         *
         * @returns {Node} The next node
         */
        this.next = function() {
            return next;
        };
    }

    /**
     * Add data to the end of the list.
     *
     * @param {*} data - The data to add
     */
    this.add = function(data) {
        if (current) {
            current.setNext(new Node(data));
            current = current.next();
        } else if (!current) {
            head = new Node(data);
            current = head;
        }
        size++;
    };

    /**
     * Remove the last element from the list.
     */
    this.removeLast = function() {
        if (!current) return;
        if (current.previous()) {
            current = current.previous();
            current.setNext(null);
        } else if (!current.previous()) {
            head = null;
            current = null;
        }
        size--;
    };

    /**
     * Get the head node.
     *
     * @returns {Node} The head node
     */
    this.head = function() {
        return head;
    };

    /**
     * Get the size of the list.
     *
     * @returns {number} The number of elements
     */
    this.size = function() {
        return size;
    };

    /**
     * Convert the linked list to an array.
     *
     * @returns {*[]} Array containing all elements in order
     */
    this.toArray = function() {
        var currentNode = head;
        var array = new Array(size);
        var arrayIdx = 0;
        while (currentNode) {
            array[arrayIdx++] = currentNode.get();
            currentNode = currentNode.next();
        }
        return array;
    };
}

// Export for both browser and Node.js
(function(exports) {
    exports.LinkedList = LinkedList;
})(typeof module !== 'undefined' && module.exports ? module.exports : (this.CypherNG = this.CypherNG || {}).structures = (this.CypherNG = this.CypherNG || {}).structures || {});
