/**
 * ResultFormatter - Formats data from the adapter into the final result set
 * Extracted from Cypher.js and modularized for CypherNG
 * @author Factory Droid
 */

/**
 * @class ResultFormatter
 * @description Formats query execution results for output
 */
class ResultFormatter {
    /**
     * Creates a new ResultFormatter instance
     */
    constructor() {
        this.formatOptions = {
            includeMetadata: true,
            formatGraph: true,
            formatTable: true,
            prettyPrint: false
        };
    }

    /**
     * Formats raw execution results into final output format
     * @param {Object} rawResults - Raw results from GraphProcessor
     * @param {Object} queryPlan - Original query plan for context
     * @param {Object} options - Formatting options
     * @returns {Object} Formatted results
     */
    format(rawResults, queryPlan, options = {}) {
        const opts = { ...this.formatOptions, ...options };
        
        const formatted = {
            graph: [],
            table: [],
            metadata: this.formatMetadata(rawResults.metadata, queryPlan)
        };

        // Format graph data
        if (opts.formatGraph && rawResults.graph) {
            formatted.graph = this.formatGraphData(rawResults.graph, queryPlan);
        }

        // Format table data
        if (opts.formatTable && rawResults.table) {
            formatted.table = this.formatTableData(rawResults.table, queryPlan);
        }

        // Include execution metrics if requested
        if (opts.includeMetrics) {
            formatted.metrics = this.calculateMetrics(rawResults, queryPlan);
        }

        return formatted;
    }

    /**
     * Formats metadata section
     * @param {Object} metadata - Raw metadata
     * @param {Object} queryPlan - Query plan
     * @returns {Object} Formatted metadata
     * @private
     */
    formatMetadata(metadata, queryPlan) {
        return {
            nodesCreated: metadata.nodesCreated || 0,
            relationshipsCreated: metadata.relationshipsCreated || 0,
            nodesDeleted: metadata.nodesDeleted || 0,
            relationshipsDeleted: metadata.relationshipsDeleted || 0,
            queryType: queryPlan.type,
            executionTime: metadata.executionTime || 0,
            rowCount: metadata.rowCount || 0,
            aggregationsApplied: this.hasAggregations(queryPlan),
            hasPatterns: !!queryPlan.pattern,
            hasWhere: !!queryPlan.where,
            hasOrderBy: !!queryPlan.order,
            hasLimit: !!queryPlan.limit,
            hasSkip: !!queryPlan.skip
        };
    }

    /**
     * Formats graph data for output
     * @param {Array} graphData - Raw graph elements
     * @param {Object} queryPlan - Query plan
     * @returns {Array} Formatted graph data
     * @private
     */
    formatGraphData(graphData, queryPlan) {
        const formatted = [];
        
        for (const element of graphData) {
            if (element.type === 'node') {
                formatted.push(this.formatNode(element.data, queryPlan));
            } else if (element.type === 'relationship') {
                formatted.push(this.formatRelationship(element.data, queryPlan));
            }
        }

        return formatted;
    }

    /**
     * Formats a single node for output
     * @param {Object} node - Node data
     * @param {Object} queryPlan - Query plan
     * @returns {Object} Formatted node
     * @private
     */
    formatNode(node, queryPlan) {
        return {
            id: node.id,
            labels: node.labels || [],
            properties: this.formatProperties(node.properties || {}),
            type: 'node',
            // Add computed properties based on query
            degree: this.calculateNodeDegree(node, queryPlan),
            // Add computed labels if any
            computedLabels: this.getComputedLabels(node, queryPlan)
        };
    }

    /**
     * Formats a single relationship for output
     * @param {Object} relationship - Relationship data
     * @param {Object} queryPlan - Query plan
     * @returns {Object} Formatted relationship
     * @private
     */
    formatRelationship(relationship, queryPlan) {
        return {
            id: relationship.id,
            type: relationship.relType,
            from: relationship.from,
            to: relationship.to,
            properties: this.formatProperties(relationship.properties || {}),
            direction: this.determineDirection(relationship, queryPlan),
            type: 'relationship'
        };
    }

    /**
     * Formats table data for output
     * @param {Array} tableData - Raw table rows
     * @param {Object} queryPlan - Query plan
     * @returns {Array} Formatted table data
     * @private
     */
    formatTableData(tableData, queryPlan) {
        if (!tableData || tableData.length === 0) {
            return [];
        }

        // Process aggregations if present
        if (this.hasAggregations(queryPlan)) {
            return this.processAggregations(tableData, queryPlan);
        }

        // Apply ordering if specified
        const orderedData = queryPlan.order ? 
            this.applyOrdering(tableData, queryPlan.order) : tableData;

        return orderedData.map(row => this.formatTableRow(row, queryPlan));
    }

    /**
     * Formats a single table row
     * @param {Object} row - Row data
     * @param {Object} queryPlan - Query plan
     * @returns {Object} Formatted row
     * @private
     */
    formatTableRow(row, queryPlan) {
        const formatted = {};

        for (const [key, value] of Object.entries(row)) {
            if (value && typeof value === 'object') {
                // Format graph objects within table results
                if (value.type === 'node') {
                    formatted[key] = this.formatNode(value, queryPlan);
                } else if (value.type === 'relationship') {
                    formatted[key] = this.formatRelationship(value, queryPlan);
                } else if (Array.isArray(value)) {
                    // Handle arrays of graph elements
                    formatted[key] = value.map(item => 
                        item.type === 'node' ? this.formatNode(item, queryPlan) :
                        item.type === 'relationship' ? this.formatRelationship(item, queryPlan) :
                        item
                    );
                } else {
                    // Regular object, format properties
                    formatted[key] = this.formatProperties(value);
                }
            } else {
                formatted[key] = value;
            }
        }

        return formatted;
    }

    /**
     * Formats properties for output
     * @param {Object} properties - Raw properties object
     * @returns {Object} Formatted properties
     * @private
     */
    formatProperties(properties) {
        const formatted = {};

        for (const [key, value] of Object.entries(properties)) {
            // Handle special property formatting
            if (typeof value === 'function') {
                // Skip functions in output
                continue;
            }
            
            if (value && typeof value === 'object' && value.constructor === Object) {
                // Recursively format nested objects
                formatted[key] = this.formatProperties(value);
            } else if (Array.isArray(value)) {
                // Format arrays
                formatted[key] = value.map(item => 
                    typeof item === 'object' && item !== null ? 
                    this.formatProperties(item) : item
                );
            } else {
                formatted[key] = value;
            }
        }

        return formatted;
    }

    /**
     * Processes aggregation functions
     * @param {Array} tableData - Table data with aggregations
     * @param {Object} queryPlan - Query plan
     * @returns {Array} Processed aggregation results
     * @private
     */
    processAggregations(tableData, queryPlan) {
        // Group data for aggregation
        const groups = this.groupDataForAggregation(tableData, queryPlan);
        
        // Apply aggregation functions to each group
        const aggregatedResults = [];
        
        for (const [groupKey, groupData] of groups.entries()) {
            const aggregatedRow = this.applyAggregations(groupData, queryPlan);
            if (groupKey !== 'default') {
                // Add grouping columns
                Object.assign(aggregatedRow, this.parseGroupKey(groupKey));
            }
            aggregatedResults.push(aggregatedRow);
        }

        return aggregatedResults;
    }

    /**
     * Groups data for aggregation processing
     * @param {Array} tableData - Table data to group
     * @param {Object} queryPlan - Query plan
     * @returns {Map} Grouped data
     * @private
     */
    groupDataForAggregation(tableData, queryPlan) {
        const groups = new Map();
        
        // Determine grouping keys
        const groupByColumns = this.getGroupByColumns(queryPlan);
        
        if (groupByColumns.length === 0) {
            // No grouping, single group for all data
            groups.set('default', tableData);
        } else {
            // Group by specified columns
            for (const row of tableData) {
                const groupKey = groupByColumns.map(col => 
                    row[col] !== undefined ? String(row[col]) : 'NULL'
                ).join('||');
                
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, []);
                }
                groups.get(groupKey).push(row);
            }
        }
        
        return groups;
    }

    /**
     * Applies aggregation functions to grouped data
     * @param {Array} groupData - Data in a group
     * @param {Object} queryPlan - Query plan
     * @returns {Object} Aggregated row
     * @private
     */
    applyAggregations(groupData, queryPlan) {
        const aggregated = {};
        
        for (const returnItem of queryPlan.returns) {
            if (this.isAggregateFunction(returnItem.expression)) {
                const functionName = returnItem.expression.value;
                const alias = returnItem.alias || returnItem.expression.name;
                
                switch (functionName) {
                    case 'count':
                        aggregated[alias] = this.countAggregate(groupData, returnItem.expression);
                        break;
                    case 'sum':
                        aggregated[alias] = this.sumAggregate(groupData, returnItem.expression);
                        break;
                    case 'avg':
                        aggregated[alias] = this.avgAggregate(groupData, returnItem.expression);
                        break;
                    case 'min':
                        aggregated[alias] = this.minAggregate(groupData, returnItem.expression);
                        break;
                    case 'max':
                        aggregated[alias] = this.maxAggregate(groupData, returnItem.expression);
                        break;
                    case 'collect':
                        aggregated[alias] = this.collectAggregate(groupData, returnItem.expression);
                        break;
                    case 'distinct':
                        aggregated[alias] = this.distinctAggregate(groupData, returnItem.expression);
                        break;
                    default:
                        aggregated[alias] = null;
                }
            }
        }
        
        return aggregated;
    }

    /**
     * COUNT aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to count
     * @returns {number} Count result
     * @private
     */
    countAggregate(groupData, expression) {
        if (expression.value === '*') {
            return groupData.length;
        }
        
        // Count non-null values for specific column
        const column = this.extractColumnName(expression);
        const count = groupData.filter(row => row[column] !== undefined && row[column] !== null).length;
        return count;
    }

    /**
     * SUM aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to sum
     * @returns {number} Sum result
     * @private
     */
    sumAggregate(groupData, expression) {
        const column = this.extractColumnName(expression);
        const sum = groupData.reduce((total, row) => {
            const value = parseFloat(row[column]);
            return isNaN(value) ? total : total + value;
        }, 0);
        return sum;
    }

    /**
     * AVG aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to average
     * @returns {number} Average result
     * @private
     */
    avgAggregate(groupData, expression) {
        const sum = this.sumAggregate(groupData, expression);
        const count = this.countAggregate(groupData, expression);
        return count > 0 ? sum / count : 0;
    }

    /**
     * MIN aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to find minimum
     * @returns {number} Minimum result
     * @private
     */
    minAggregate(groupData, expression) {
        const column = this.extractColumnName(expression);
        const values = groupData.map(row => row[column]).filter(val => val !== undefined && val !== null);
        return values.length > 0 ? Math.min(...values) : null;
    }

    /**
     * MAX aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to find maximum
     * @returns {number} Maximum result
     * @private
     */
    maxAggregate(groupData, expression) {
        const column = this.extractColumnName(expression);
        const values = groupData.map(row => row[column]).filter(val => val !== undefined && val !== null);
        return values.length > 0 ? Math.max(...values) : null;
    }

    /**
     * COLLECT aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to collect
     * @returns {Array} Collected values
     * @private
     */
    collectAggregate(groupData, expression) {
        const column = this.extractColumnName(expression);
        const collected = groupData.map(row => row[column]).filter(val => val !== undefined && val !== null);
        return collected;
    }

    /**
     * DISTINCT aggregation function
     * @param {Array} groupData - Group data
     * @param {Object} expression - Expression to find distinct values
     * @returns {Array} Distinct values
     * @private
     */
    distinctAggregate(groupData, expression) {
        const column = this.extractColumnName(expression);
        const values = groupData.map(row => row[column]).filter(val => val !== undefined && val !== null);
        return [...new Set(values)];
    }

    /**
     * Applies ORDER BY to table data
     * @param {Array} tableData - Table data to sort
     * @param {Object} orderSpec - Order specification
     * @returns {Array} Sorted table data
     * @private
     */
    applyOrdering(tableData, orderSpec) {
        const sorted = [...tableData];
        
        sorted.sort((a, b) => {
            for (const item of orderSpec.items) {
                const aValue = a[item.expression.name];
                const bValue = b[item.expression.name];
                
                let comparison = 0;
                
                if (aValue < bValue) comparison = -1;
                else if (aValue > bValue) comparison = 1;
                
                // Reverse order for DESC
                if (item.direction === 'DESC') {
                    comparison = -comparison;
                }
                
                if (comparison !== 0) {
                    return comparison;
                }
            }
            return 0;
        });
        
        return sorted;
    }

    /**
     * Calculates node degree (number of connections)
     * @param {Object} node - Node data
     * @param {Object} queryPlan - Query plan
     * @returns {number} Node degree
     * @private
     */
    calculateNodeDegree(node, queryPlan) {
        // Simplified degree calculation
        // In reality, this would query relationships from the data adapter
        return 0;
    }

    /**
     * Gets computed labels for a node
     * @param {Object} node - Node data
     * @param {Object} queryPlan - Query plan
     * @returns {Array} Computed labels
     * @private
     */
    getComputedLabels(node, queryPlan) {
        // Simplified computed labels
        return [];
    }

    /**
     * Determines relationship direction
     * @param {Object} relationship - Relationship data
     * @param {Object} queryPlan - Query plan
     * @returns {string} Direction ('incoming', 'outgoing', 'both', 'none')
     * @private
     */
    determineDirection(relationship, queryPlan) {
        // Simplified direction determination
        return relationship.direction || 'none';
    }

    /**
     * Checks if query plan has aggregations
     * @param {Object} queryPlan - Query plan
     * @returns {boolean} True if has aggregations
     * @private
     */
    hasAggregations(queryPlan) {
        if (!queryPlan.returns) return false;
        
        return queryPlan.returns.some(item => 
            this.isAggregateFunction(item.expression)
        );
    }

    /**
     * Checks if expression is an aggregate function
     * @param {Object} expression - Expression to check
     * @returns {boolean} True if aggregate function
     * @private
     */
    isAggregateFunction(expression) {
        if (!expression || !expression.value) return false;
        
        const aggregateFunctions = ['count', 'sum', 'avg', 'min', 'max', 'collect', 'distinct'];
        const value = expression.value.toLowerCase();
        
        return aggregateFunctions.some(func => value.includes(func));
    }

    /**
     * Extracts column name from expression
     * @param {Object} expression - Expression
     * @returns {string} Column name
     * @private
     */
    extractColumnName(expression) {
        // Simplified column name extraction
        if (expression.name) return expression.name;
        if (expression.value && typeof expression.value === 'string') {
            // Extract from expressions like "count(n.name)" -> "n.name"
            const match = expression.value.match(/\(([^)]+)\)/);
            return match ? match[1] : expression.value;
        }
        return expression.value;
    }

    /**
     * Gets group by columns from query plan
     * @param {Object} queryPlan - Query plan
     * @returns {Array} Group by column names
     * @private
     */
    getGroupByColumns(queryPlan) {
        // Simplified group by extraction
        if (!queryPlan.returns) return [];
        
        return queryPlan.returns
            .filter(item => !this.isAggregateFunction(item.expression))
            .map(item => item.alias || this.extractColumnName(item.expression));
    }

    /**
     * Parses group key back to column values
     * @param {string} groupKey - Combined group key
     * @returns {Object} Parsed column values
     * @private
     */
    parseGroupKey(groupKey) {
        const parts = groupKey.split('||');
        // This is a simplified version - in reality you'd map back to actual column names
        return { [`group_${parts[0]}`]: parts[0] };
    }

    /**
     * Calculates execution metrics
     * @param {Object} rawResults - Raw execution results
     * @param {Object} queryPlan - Query plan
     * @returns {Object} Calculated metrics
     * @private
     */
    calculateMetrics(rawResults, queryPlan) {
        return {
            executionTime: rawResults.metadata?.executionTime || 0,
            memoryUsage: 0, // Would measure actual memory usage
            nodesProcessed: rawResults.graph?.filter(el => el.type === 'node').length || 0,
            relationshipsProcessed: rawResults.graph?.filter(el => el.type === 'relationship').length || 0,
            rowsReturned: rawResults.table?.length || 0,
            hasAggregations: this.hasAggregations(queryPlan),
            hasOrdering: !!queryPlan.order,
            hasLimiting: !!(queryPlan.limit || queryPlan.skip)
        };
    }
}

module.exports = { ResultFormatter };
