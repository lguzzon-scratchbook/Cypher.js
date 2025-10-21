/**
 * GraphProcessor - Executes query plans against the data adapter
 * Extracted from Cypher.js and modularized for CypherNG
 * @author Factory Droid
 */

/**
 * @class GraphProcessor
 * @description Executes parsed query plans using the data adapter
 */
class GraphProcessor {
    /**
     * Creates a new GraphProcessor instance
     * @param {Object} dataAdapter - Data adapter for data access
     */
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Executes a query plan against the data adapter
     * @param {Object} queryPlan - Parsed query plan from QueryEngine
     * @returns {Promise<Object>} Query execution results
     * @throws {Error} When execution fails
     */
    async execute(queryPlan) {
        switch (queryPlan.type) {
            case 'MATCH':
                return await this.executeMatch(queryPlan);
            case 'CREATE':
                return await this.executeCreate(queryPlan);
            case 'MERGE':
                return await this.executeMerge(queryPlan);
            case 'RETURN':
                return await this.executeReturn(queryPlan);
            case 'WITH':
                return await this.executeWith(queryPlan);
            case 'DELETE':
                return await this.executeDelete(queryPlan);
            case 'SET':
                return await this.executeSet(queryPlan);
            case 'UNWIND':
                return await this.executeUnwind(queryPlan);
            case 'LOAD':
                return await this.executeLoad(queryPlan);
            default:
                throw new Error(`Unsupported query type: ${queryPlan.type}`);
        }
    }

    /**
     * Executes MATCH query
     * @param {Object} queryPlan - MATCH query plan
     * @returns {Promise<Object>} Match results
     * @private
     */
    async executeMatch(queryPlan) {
        if (!queryPlan.pattern) {
            throw new Error('MATCH query requires pattern');
        }

        const results = {
            graph: [],
            table: [],
            metadata: {
                nodesCreated: 0,
                relationshipsCreated: 0,
                nodesDeleted: 0,
                relationshipsDeleted: 0
            }
        };

        // Find matching nodes and relationships
        const matches = await this.findPatternMatches(queryPlan.pattern);
        
        // Apply WHERE clause if present
        const filteredMatches = queryPlan.where ? 
            this.applyWhereClause(matches, queryPlan.where) : matches;

        // Process return items
        if (queryPlan.returns.length > 0) {
            results.table = await this.processReturnItems(filteredMatches, queryPlan.returns);
        } else {
            // Default return: return the full graph pattern
            results.graph = this.formatGraphData(filteredMatches, queryPlan.pattern);
        }

        // Apply LIMIT and SKIP
        const limitedResults = this.applyLimitAndSkip(results, queryPlan);

        return limitedResults;
    }

    /**
     * Executes CREATE query
     * @param {Object} queryPlan - CREATE query plan
     * @returns {Promise<Object>} Create results
     * @private
     */
    async executeCreate(queryPlan) {
        if (!queryPlan.pattern) {
            throw new Error('CREATE query requires pattern');
        }

        const batch = [];
        let nodesCreated = 0;
        let relationshipsCreated = 0;

        // Convert pattern to graph elements
        for (const node of queryPlan.pattern.nodes) {
            const graphNode = {
                type: 'node',
                labels: node.labels || [],
                properties: node.properties || {},
                id: this.generateNodeId()
            };
            batch.push(graphNode);
            nodesCreated++;
        }

        for (const relationship of queryPlan.pattern.relationships) {
            const graphRel = {
                type: 'relationship',
                relType: relationship.type,
                from: relationship.from,
                to: relationship.to,
                properties: relationship.properties || {},
                id: this.generateRelationshipId()
            };
            batch.push(graphRel);
            relationshipsCreated++;
        }

        // Write to data adapter
        await this.dataAdapter.batchWrite(batch);

        return {
            graph: [],
            table: [],
            metadata: {
                nodesCreated,
                relationshipsCreated,
                nodesDeleted: 0,
                relationshipsDeleted: 0
            }
        };
    }

    /**
     * Executes MERGE query
     * @param {Object} queryPlan - MERGE query plan
     * @returns {Promise<Object>} Merge results
     * @private
     */
    async executeMerge(queryPlan) {
        if (!queryPlan.pattern) {
            throw new Error('MERGE query requires pattern');
        }

        // First try to find existing matches
        const existing = await this.findPatternMatches(queryPlan.pattern);
        
        if (existing.length > 0) {
            // Pattern exists, return existing
            return {
                graph: this.formatGraphData(existing, queryPlan.pattern),
                table: [],
                metadata: {
                    nodesCreated: 0,
                    relationshipsCreated: 0,
                    nodesDeleted: 0,
                    relationshipsDeleted: 0
                }
            };
        } else {
            // Pattern doesn't exist, create it
            return await this.executeCreate(queryPlan);
        }
    }

    /**
     * Executes DELETE query
     * @param {Object} queryPlan - DELETE query plan
     * @returns {Promise<Object>} Delete results
     * @private
     */
    async executeDelete(queryPlan) {
        // Find nodes/relationships to delete
        const toDelete = await this.findPatternMatches(queryPlan.pattern);
        
        let nodesDeleted = 0;
        let relationshipsDeleted = 0;

        for (const match of toDelete) {
            for (const node of match.nodes) {
                await this.dataAdapter.delete({ type: 'node', id: node.id });
                nodesDeleted++;
            }
            for (const relationship of match.relationships) {
                await this.dataAdapter.delete({ type: 'relationship', id: relationship.id });
                relationshipsDeleted++;
            }
        }

        return {
            graph: [],
            table: [],
            metadata: {
                nodesCreated: 0,
                relationshipsCreated: 0,
                nodesDeleted,
                relationshipsDeleted
            }
        };
    }

    /**
     * Executes SET query
     * @param {Object} queryPlan - SET query plan
     * @returns {Promise<Object>} Set results
     * @private
     */
    async executeSet(queryPlan) {
        const batch = [];
        
        // For each set operation, update the graph elements
        for (const setOp of queryPlan.setOperations) {
            const element = setOp.target;
            
            // Read current element
            const current = await this.findElement(element);
            if (!current) {
                throw new Error(`Element not found: ${JSON.stringify(element)}`);
            }

            // Update properties
            Object.assign(current.properties, setOp.properties);
            batch.push(current);
        }

        await this.dataAdapter.batchWrite(batch);

        return {
            graph: [],
            table: [],
            metadata: {
                nodesCreated: 0,
                relationshipsCreated: 0,
                nodesDeleted: 0,
                relationshipsDeleted: 0
            }
        };
    }

    /**
     * Executes UNWIND query
     * @param {Object} queryPlan - UNWIND query plan
     * @returns {Promise<Object>} Unwind results
     * @private
     */
    async executeUnwind(queryPlan) {
        const input = await this.evaluateExpression(queryPlan.unwind.input);
        const variable = queryPlan.unwind.variable;
        
        if (!Array.isArray(input)) {
            throw new Error('UNWIND input must be an array');
        }

        const results = {
            table: [],
            graph: [],
            metadata: {
                nodesCreated: 0,
                relationshipsCreated: 0,
                nodesDeleted: 0,
                relationshipsDeleted: 0
            }
        };

        // Create row for each unwound item
        for (const item of input) {
            const row = { [variable]: item };
            
            // Evaluate return expressions for each row
            for (const returnItem of queryPlan.returns) {
                const value = await this.evaluateExpression(returnItem.expression, row);
                row[returnItem.alias || returnItem.expression.name] = value;
            }
            
            results.table.push(row);
        }

        return results;
    }

    /**
     * Executes RETURN query
     * @param {Object} queryPlan - RETURN query plan
     * @returns {Promise<Object>} Return results
     * @private
     */
    async executeReturn(queryPlan) {
        return {
            table: await this.processReturnItems([], queryPlan.returns),
            graph: [],
            metadata: {
                nodesCreated: 0,
                relationshipsCreated: 0,
                nodesDeleted: 0,
                relationshipsDeleted: 0
            }
        };
    }

    /**
     * Executes LOAD CSV query
     * @param {Object} queryPlan - LOAD CSV query plan
     * @returns {Promise<Object>} Load results
     * @private
     */
    async executeLoad(queryPlan) {
        // Simplified implementation - in reality this would handle HTTP requests
        // For now, assume CSV is already loaded and available
        const csvData = queryPlan.csvData || [];
        
        return {
            table: csvData,
            graph: [],
            metadata: {
                nodesCreated: 0,
                relationshipsCreated: 0,
                nodesDeleted: 0,
                relationshipsDeleted: 0
            }
        };
    }

    /**
     * Finds pattern matches in the graph
     * @param {Object} pattern - Pattern to match
     * @returns {Promise<Array>} Array of matches
     * @private
     */
    async findPatternMatches(pattern) {
        const matches = [];
        
        // For each node in the pattern, find matching nodes
        let nodeMatches = [{}]; // Start with empty match context
        
        for (const nodePattern of pattern.nodes) {
            const newMatches = [];
            
            for (const context of nodeMatches) {
                const nodeQuery = this.buildNodeQuery(nodePattern, context);
                const matchingNodes = await this.streamGraphElements(nodeQuery);
                
                for await (const node of matchingNodes) {
                    const newContext = { ...context, [nodePattern.variable]: node };
                    newMatches.push(newContext);
                }
            }
            
            nodeMatches = newMatches;
        }
        
        // Find relationships matching the pattern
        for (let i = 0; i < pattern.relationships.length; i++) {
            const relPattern = pattern.relationships[i];
            const filteredMatches = [];
            
            for (const context of nodeMatches) {
                const fromNode = context[pattern.nodes[i].variable];
                const toNode = context[pattern.nodes[i + 1].variable];
                
                if (fromNode && toNode) {
                    const relQuery = this.buildRelationshipQuery(relPattern, fromNode.id, toNode.id);
                    const matchingRels = await this.streamGraphElements(relQuery);
                    
                    for await (const rel of matchingRels) {
                        const newContext = { 
                            ...context, 
                            [relPattern.variable]: rel 
                        };
                        filteredMatches.push(newContext);
                    }
                }
            }
            
            nodeMatches = filteredMatches;
        }
        
        // Convert contexts to structured matches
        for (const context of nodeMatches) {
            const match = {
                nodes: [],
                relationships: [],
                context
            };
            
            for (const nodePattern of pattern.nodes) {
                if (context[nodePattern.variable]) {
                    match.nodes.push(context[nodePattern.variable]);
                }
            }
            
            for (const relPattern of pattern.relationships) {
                if (context[relPattern.variable]) {
                    match.relationships.push(context[relPattern.variable]);
                }
            }
            
            matches.push(match);
        }
        
        return matches;
    }

    /**
     * Builds node query for searching
     * @param {Object} nodePattern - Node pattern
     * @param {Object} context - Current match context
     * @returns {Object} Query object
     * @private
     */
    buildNodeQuery(nodePattern, context) {
        const query = { type: 'node' };
        
        if (nodePattern.labels && nodePattern.labels.length > 0) {
            query.labels = nodePattern.labels;
        }
        
        if (nodePattern.properties && Object.keys(nodePattern.properties).length > 0) {
            query.properties = nodePattern.properties;
        }
        
        return query;
    }

    /**
     * Builds relationship query for searching
     * @param {Object} relPattern - Relationship pattern
     * @param {number} fromId - Source node ID
     * @param {number} toId - Target node ID
     * @returns {Object} Query object
     * @private
     */
    buildRelationshipQuery(relPattern, fromId, toId) {
        const query = { 
            type: 'relationship',
            from: fromId,
            to: toId
        };
        
        if (relPattern.type) {
            query.relType = relPattern.type;
        }
        
        if (relPattern.properties && Object.keys(relPattern.properties).length > 0) {
            query.properties = relPattern.properties;
        }
        
        return query;
    }

    /**
     * Streams graph elements from data adapter
     * @param {Object} query - Query object
     * @returns {AsyncGenerator} Stream of elements
     * @private
     */
    async *streamGraphElements(query) {
        for await (const element of this.dataAdapter.stream(query)) {
            yield element;
        }
    }

    /**
     * Evaluates expression in given context
     * @param {Object} expression - Expression to evaluate
     * @param {Object} context - Variable context
     * @returns {*} Expression value
     * @private
     */
    async evaluateExpression(expression, context = {}) {
        // Simplified expression evaluation
        if (expression.type === 'literal') {
            return expression.value;
        }
        
        if (expression.type === 'identifier') {
            return context[expression.value] || expression.value;
        }
        
        // Add more expression types as needed
        return null;
    }

    /**
     * Processes return items and formats table results
     * @param {Array} matches - Matched graph elements
     * @param {Array} returnItems - Return item specifications
     * @returns {Promise<Array>} Table results
     * @private
     */
    async processReturnItems(matches, returnItems) {
        const table = [];
        
        for (const match of matches) {
            const row = {};
            
            for (const item of returnItems) {
                let value;
                
                if (item.expression.type === 'identifier') {
                    const identifier = item.expression.value;
                    
                    // Look up identifier in match context
                    if (match.context && match.context[identifier]) {
                        value = match.context[identifier];
                    } else {
                        // Might be a literal like "count(*)"
                        value = this.evaluateAggregateFunction(item.expression, match);
                    }
                } else {
                    value = await this.evaluateExpression(item.expression, match.context);
                }
                
                row[item.alias || identifier] = value;
            }
            
            table.push(row);
        }
        
        return table;
    }

    /**
     * Evaluates aggregate functions
     * @param {Object} expression - Expression containing aggregate function
     * @param {Object} match - Match context
     * @returns {*} Aggregate function result
     * @private
     */
    evaluateAggregateFunction(expression, match) {
        // Simplified aggregate function evaluation
        if (expression.value === 'count(*)') {
            return 1; // Count per row, aggregation handled elsewhere
        }
        
        return null;
    }

    /**
     * Applies WHERE clause to filter matches
     * @param {Array} matches - Input matches
     * @param {Object} whereClause - WHERE condition
     * @returns {Array} Filtered matches
     * @private
     */
    applyWhereClause(matches, whereClause) {
        // Simplified WHERE clause evaluation
        return matches.filter(match => {
            return this.evaluateCondition(whereClause, match.context);
        });
    }

    /**
     * Evaluates condition expression
     * @param {Object} condition - Condition to evaluate
     * @param {Object} context - Variable context
     * @returns {boolean} Condition result
     * @private
     */
    evaluateCondition(condition, context) {
        // Simplified condition evaluation
        // In reality, this would handle complex boolean expressions
        return true; // Placeholder
    }

    /**
     * Formats graph data for results
     * @param {Array} matches - Matched graph elements
     * @param {Object} pattern - Original pattern
     * @returns {Array} Formatted graph data
     * @private
     */
    formatGraphData(matches, pattern) {
        const graph = [];
        
        for (const match of matches) {
            for (const node of match.nodes) {
                graph.push({
                    type: 'node',
                    data: node
                });
            }
            
            for (const relationship of match.relationships) {
                graph.push({
                    type: 'relationship',
                    data: relationship
                });
            }
        }
        
        return graph;
    }

    /**
     * Applies LIMIT and SKIP to results
     * @param {Object} results - Query results
     * @param {Object} queryPlan - Query plan with limit/skip
     * @returns {Object} Limited results
     * @private
     */
    applyLimitAndSkip(results, queryPlan) {
        const limited = { ...results };
        
        if (queryPlan.skip && typeof queryPlan.skip === 'number') {
            limited.table = results.table.slice(queryPlan.skip);
        }
        
        if (queryPlan.limit && typeof queryPlan.limit === 'number') {
            limited.table = limited.table.slice(0, queryPlan.limit);
        }
        
        return limited;
    }

    /**
     * Finds specific graph element
     * @param {Object} elementSpec - Element specification
     * @returns {Promise<Object>} Found element or null
     * @private
     */
    async findElement(elementSpec) {
        const query = {
            type: elementSpec.type
        };
        
        if (elementSpec.id) {
            query.id = elementSpec.id;
        }
        
        for await (const element of this.dataAdapter.stream(query)) {
            return element;
        }
        
        return null;
    }

    /**
     * Generates unique node ID
     * @returns {number} Node ID
     * @private
     */
    generateNodeId() {
        return Date.now() + Math.random();
    }

    /**
     * Generates unique relationship ID
     * @returns {number} Relationship ID
     * @private
     */
    generateRelationshipId() {
        return Date.now() + Math.random();
    }
}

module.exports = { GraphProcessor };
