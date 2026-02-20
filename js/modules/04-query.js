/**
 * @fileoverview Query Layer Module for CypherNG
 * Contains Expression, Variable, Statement, Operations (Create, Match, Merge, etc.)
 * @module query
 * 
 * This module handles query execution including:
 * - Expression evaluation and variable resolution
 * - Graph operations (CREATE, MATCH, MERGE)
 * - Result handling (RETURN, WITH, UNWIND)
 * - Data loading from external sources (LOAD CSV/JSON/TEXT)
 */

// Lazy imports to avoid circular dependencies
let addArrayFunctions, addAssociativeArrayFunctions;
let StoredNode, StoredRelationship, PatternNode, PatternRelationship, Pattern, Matcher;
let StringRecoder, List, AssociativeArray, Case, Predicate, FString, Constant, Table, TableColumn;
let Where;

/**
 * Initialize dependencies from other modules
 * @param {Object} deps - Module dependencies
 */
export function initializeQueryLayer(deps) {
    addArrayFunctions = deps.addArrayFunctions;
    addAssociativeArrayFunctions = deps.addAssociativeArrayFunctions;
    StoredNode = deps.StoredNode;
    StoredRelationship = deps.StoredRelationship;
    PatternNode = deps.PatternNode;
    PatternRelationship = deps.PatternRelationship;
    Pattern = deps.Pattern;
    Matcher = deps.Matcher;
    StringRecoder = deps.StringRecoder;
    List = deps.List;
    AssociativeArray = deps.AssociativeArray;
    Case = deps.Case;
    Predicate = deps.Predicate;
    FString = deps.FString;
    Constant = deps.Constant;
    Table = deps.Table;
    TableColumn = deps.TableColumn;
    Where = deps.Where;
}

/**
 * Expression - evaluates to a value during query execution
 * @constructor
 * @param {Object} _root - Root expression element
 * @param {string} _alias - Expression alias
 * @param {Array} _aggregationFunctions - Aggregation functions
 * @param {Object} _context - Execution context
 * @param {Array} _variableReferences - Referenced variables
 * @param {boolean} _non_deterministic - Whether expression is non-deterministic
 */
function Expression(_root, _alias, _aggregationFunctions, _context, _variableReferences, _non_deterministic) {
    const root = _root;
    let alias = (root.element ? (root.element().getKey ? root.element().getKey() : _alias) : _alias);
    const aggregationFunctions = _aggregationFunctions;
    const context = _context;
    const variableReferences = _variableReferences;
    let childrenHasVariableReferences = false;
    const localVariables = {};
    const me = this;

    if(aggregationFunctions) {
        context.addReduceExpression(this);
        for(let i=0; i<aggregationFunctions.length; i++) {
            aggregationFunctions[i].setGroupBy(context.getGroupBy());
            aggregationFunctions[i].setReducer(context.getGroupBy().addReducer());
            aggregationFunctions[i].initialize();
        }
    }

    const _childrenHasVariableReferences = function(children) {
        if(!children) return false;
        for(let i=0; i<children.length; i++) {
            if(children[i].element().hasReferredVariables && children[i].element().hasReferredVariables()) return true;
            else return _childrenHasVariableReferences(children[i].p);
        }
        return false;
    };
    childrenHasVariableReferences = _childrenHasVariableReferences(root.p);

    this.root = function() { return root; };
    this.rootObject = function() {
        if(root.element().getObject) return root.element().getObject();
        return root.element();
    };
    this.value = function() { return root.value(); };
    this.getData = function() { return this.value(); };
    this.getAlias = function() { return alias; };
    this.variableReferences = function() { return variableReferences; };
    this.hasReferredVariables = function() {
        return (variableReferences && (variableReferences.length > 0)) || childrenHasVariableReferences;
    };
    this.setAlias = function(a) { alias = a; };
    this.hasKey = function() { return root.hasKey && root.hasKey(); };
    this.isReduceExpression = function() { return (aggregationFunctions != undefined); };
    this.aggregate = function() {
        if(aggregationFunctions) {
            for(let i=0; i<aggregationFunctions.length; i++) { aggregationFunctions[i].aggregate(); }
            return;
        }
        context.getGroupBy().map(root);
    };
    this.hasAggregateFunctions = function() { return aggregationFunctions != undefined; };
    this.isArray = function() { return root.element().constructor == List; };
    this.isAssociativeArray = function() { return root.element().constructor == AssociativeArray; };
    this.getAggregateFunctions = function() { return aggregationFunctions; };
    this.type = function() { return this.constructor.name; };

    if(root.element().constructor == List) {
        const elements = root.element().getElements();
        for(let i=0; i<elements.length; i++) {
            if(elements[i].hasAggregateFunctions) {
                me.hasAggregateFunctions = function() { return true; };
            }
            return;
        }
    }

    root.non_deterministic = function() { return _non_deterministic; };

    this.mappable = function() { return root.mappable(); };

    this.setLocalVariable = function(key, value) { localVariables[key] = value; };
    this.getLocalVariable = function(key) { return localVariables[key]; };
}

/**
 * Variable - represents a named value in the query
 * @constructor
 * @param {Object} _object - Backing object
 * @param {string} key - Variable key/name
 */
function Variable(_object, key) {
    const object = _object;
    const objectKey = key;
    let overriddenValue = null;
    
    this.getObjectKey = function() { return objectKey; };
    this.getObject = function() {
        if(overriddenValue) return overriddenValue;
        if(object && object.constructor == Constant) return object.getObject();
        return object;
    };
    this.value = function(asKey) {
        if(overriddenValue) return overriddenValue;
        try { return object.getData().get(asKey); } catch(e) { /* intentionally empty */ }
        return null;
    };
    this.setOverriddenValue = function(_overriddenValue) { overriddenValue = _overriddenValue; };
    this.type = function() { return this.constructor.name; };
}

/**
 * Statement - represents a complete Cypher statement
 * @constructor
 * @param {Object} _engine - Query engine reference
 */
function Statement(_engine) {
    const engine = _engine;
    let operations = [];
    let variables = {};
    let lastVariable;
    let lastPropertyKey;
    let output = [];
    let graph = { nodes: {}, relationships: {} };
    let nodesAdded = 0;
    let relationshipsAdded = 0;
    let overriddenContextStack = [];
    let overriddenContext = undefined;

    this.addOperation = function(operation) {
        if(this.context() && this.context().type() == 'Return') {
            throw "There can only be one return statement and it must be last in the query.";
        }
        if(this.context()) this.context().setNextOperation(operation);
        operations.push(operation);
    };
    this.operations = function() { return operations; };
    this.context = function() { return overriddenContext || operations[operations.length-1]; };
    this.setContext = function(context) {
        if(overriddenContext) overriddenContextStack.push(overriddenContext);
        overriddenContext = context;
    };
    this.resetContext = function() { overriddenContext = overriddenContextStack.pop(); };
    this.addVariable = function(key, object) {
        lastVariable = new Variable(object, key);
        if(variables[key]) throw "Variable `" + key + "` already declared.";
        variables[key] = lastVariable;
    };
    this.debugVariables = function() {
        for(const key in variables) {
            console.log("Variable \"" + key + "\":");
            console.log(JSON.stringify(variables[key].value()));
        }
    };
    this.variables = function() { return Object.values(variables); };
    this.getVariable = function(key) {
        if(variables[key] == undefined) {
            try {
                if(window != undefined && key in window) {
                    return {value: function() { return window[key]; }};
                }
            } catch(e) { /* intentionally empty */ }
            throw "Variable `" + key + "` has not been declared.";
        }
        return variables[key];
    };
    this.hasVariable = function(key) { return variables[key] != undefined; };
    this.getLastVariable = function() { return lastVariable; };
    this.setPropertyKey = function(key) { lastPropertyKey = key; };
    this.getPropertyKey = function() { return lastPropertyKey; };
    
    const clean = function(o) {
        if(o && o.constructor == String) {
            return o.replace(/\0/g, '');
        }
        if(o && (o.constructor.name == 'NodeReference' || o.constructor.name == 'RelationshipReference')) {
            return clean(o.value());
        }
        if(o) {
            for(let p in o) {
                if(typeof o[p] === "function") {
                    delete o[p];
                    continue;
                }
                if(o[p]) {
                    o[p] = clean(o[p]);
                }
            }
            o.fromNode && (o.fromNode = clean(o.fromNode));
            o.toNode && (o.toNode = clean(o.toNode));
        }
        return o;
    };
    
    this.clear = function() {
        operations = [];
        variables = {};
        lastVariable = undefined;
        lastPropertyKey = undefined;
        output = [];
        nodesAdded = 0;
        relationshipsAdded = 0;
        graph = { nodes: {}, relationships: {} };
    };
    this.engine = function() { return engine; };
    this.results = function() {
        checkGraphConsistency();
        return {
            output: output,
            graph: {
                nodes: Object.values(graph.nodes),
                links: Object.values(graph.relationships)
            },
            stats: { nodesAdded: nodesAdded, relationshipsAdded: relationshipsAdded }
        };
    };
    this.addOutputRecord = function() { output.push({}); };
    this.addOutputEntry = function(key, value, id) {
        let _key = key;
        if(output[output.length-1][_key] != undefined) _key += id;
        this.addOutputEntryToGraph(value);
        output[output.length-1][_key] = clean(value);
    };
    
    const checkGraphConsistency = function() {
        const rel_ids_to_delete = [];
        for(const relationshipId in graph.relationships) {
            const rel = graph.relationships[relationshipId];
            if(!graph.nodes[rel.source] || !graph.nodes[rel.target]) {
                rel_ids_to_delete.push(relationshipId);
            }
        }
        for(let i=0; i<rel_ids_to_delete.length; i++) {
            delete graph.relationships[rel_ids_to_delete[i]];
        }
    };
    
    this.addOutputEntryToGraph = function(entry) {
        if(entry && entry.constructor.name == 'NodeReference') {
            if(graph.nodes[entry.id()] == undefined) graph.nodes[entry.id()] = clean(entry);
        } else if(entry && entry.constructor.name == 'RelationshipReference') {
            if(graph.relationships[entry.id()] == undefined) {
                const e = entry.getObject().toObject();
                e.source = e.fromNode.id();
                e.target = e.toNode.id();
                graph.relationships[entry.id()] = clean(e);
            }
        } else if(entry && entry.constructor == Array) {
            for(let i=0; i<entry.length; i++) { this.addOutputEntryToGraph(entry[i]); }
        }
    };
    this.setNodesAdded = function(value) { nodesAdded = value; };
    this.setRelationshipsAdded = function(value) { relationshipsAdded = value; };
    this.getNodesAdded = function() { return nodesAdded; };
    this.getRelationshipsAdded = function() { return relationshipsAdded; };
    this.setSuccessCallback = function(_successCallback) { successCallback = _successCallback; };
    let successCallback;
    this.success = function() { successCallback(this.results()); };
}

/**
 * Where - WHERE clause evaluation
 * @constructor
 * @param {Object} _expression - Expression to evaluate
 */
function Where(_expression) {
    const expression = _expression;
    this.evaluate = function() { return expression.value() == true; };
    this.type = function() { return this.constructor.name; };
}

/**
 * Inserter - INTO table operation
 * @constructor
 * @param {Object} _db - Database reference
 * @param {string} _tableName - Table name
 */
function Inserter(_db, _tableName) {
    const db = _db;
    const tableName = _tableName;
    const tableColumns = [];
    const table = new Table(db, tableName);
    let previousOperation;
    let nextOperation;

    this.setPreviousOperation = function(_previousOperation) {
        previousOperation = _previousOperation;
        let variable;
        for(let i=0; i<previousOperation.variables().length; i++) {
            variable = previousOperation.variables()[i];
            tableColumns.push(table.addColumn(variable.getObjectKey()));
        }
    };
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };
    this.variables = function() { return previousOperation.variables(); };
    this.doIt = function() {
        let variable;
        for(let i=0; i<previousOperation.variables().length; i++) {
            variable = previousOperation.variables()[i];
            tableColumns[i].addValue(tableColumns[i].name(), variable.value());
        }
        if(nextOperation) {
            const result = nextOperation.doIt();
            if(result instanceof Promise) result.then();
        }
    };
    this.finish = function() { if(nextOperation) nextOperation.finish(); };
    this.run = function() { throw "Into-operation cannot be first in statement."; };
    this.type = function() { return this.constructor.name; };
}

/**
 * Setter - SET clause for property/label/type assignments
 * @constructor
 */
function Setter() {
    let setters;
    let previousOperation;
    let nextOperation;

    /**
     * SetterEntry - handles property assignments
     * @constructor
     */
    function SetterEntry(_variable, _propertyKey, _expression) {
        const variable = _variable;
        const propertyKey = _propertyKey;
        const expression = _expression;
        this.set = function() {
            let o = variable.getObject();
            let assignee;
            if(o.constructor.name == 'Unwind') o = o.value();
            if(o.constructor.name == 'NodeReference') {
                assignee = o.getObject();
            } else if(o.constructor.name == 'PatternNode') {
                assignee = o.getData();
            } else if(o.constructor.name == 'RelationshipReference') {
                assignee = o.getObject();
            } else if(o.constructor.name == 'PatternRelationship') {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            try {
                assignee.setProperty(propertyKey, expression);
                assignee.bindProperty(propertyKey);
            } catch(e) { /* intentionally empty */ }
        };
    }

    /**
     * MapSetterEntry - handles map assignments (+=)
     * @constructor
     */
    function MapSetterEntry(_variable, _mapExpression) {
        const variable = _variable;
        const mapExpression = _mapExpression;
        this.set = function() {
            let o = variable.getObject();
            let assignee;
            if(o.constructor.name == 'Unwind') o = o.value();
            if(o.constructor.name == 'NodeReference' || o.constructor.name == 'RelationshipReference') {
                assignee = o.getObject();
            } else if(o.constructor.name == 'PatternNode' || o.constructor.name == 'PatternRelationship') {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            assignee.setProperties(mapExpression.value());
        };
    }

    /**
     * LabelSetterEntry - handles label assignments
     * @constructor
     */
    function LabelSetterEntry(_variable, _labelExpression) {
        const variable = _variable;
        const labelExpression = _labelExpression;
        this.set = function() {
            let o = variable.getObject();
            let assignee;
            if(o.constructor.name == 'Unwind') o = o.value();
            if(o.constructor.name == 'NodeReference') {
                assignee = o.getObject();
            } else if(o.constructor.name == 'PatternNode') {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            assignee.setLabel(labelExpression.value());
        };
    }

    /**
     * TypeSetterEntry - handles relationship type assignments
     * @constructor
     */
    function TypeSetterEntry(_variable, _typeExpression) {
        const variable = _variable;
        const typeExpression = _typeExpression;
        this.set = function() {
            let o = variable.getObject();
            let assignee;
            if(o.constructor.name == 'Unwind') o = o.value();
            if(o.constructor.name == 'RelationshipReference') {
                assignee = o.getObject();
            } else if(o.constructor.name == 'PatternRelationship') {
                assignee = o.getData();
            } else {
                throw "Cannot assign to object of type \"" + o.constructor.name + "\".";
            }
            try {
                assignee.setType(typeExpression.value(), assignee.id());
            } catch(e) { /* intentionally empty */ }
        };
    }

    this.addSetter = function(variable, propertyKey, expression) {
        if(!setters) setters = [];
        setters.push(new SetterEntry(variable, propertyKey, expression));
    };
    this.addLabelSetter = function(variable, labelExpression) {
        if(!setters) setters = [];
        setters.push(new LabelSetterEntry(variable, labelExpression));
    };
    this.addMapSetter = function(variable, mapExpression) {
        if(!setters) setters = [];
        setters.push(new MapSetterEntry(variable, mapExpression));
    };
    this.addTypeSetter = function(variable, typeExpression) {
        if(!setters) setters = [];
        setters.push(new TypeSetterEntry(variable, typeExpression));
    };
    this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };
    this.variables = function() { return previousOperation.variables(); };
    this.doIt = function() {
        for(let i=0; i<setters.length; i++) { setters[i].set(); }
        if(nextOperation) {
            const result = nextOperation.doIt();
            if(result instanceof Promise) result.then();
        }
    };
    this.finish = function() { if(nextOperation) nextOperation.finish(); };
    this.run = function() { throw "Set-operation cannot be first in statement."; };
    this.type = function() { return this.constructor.name; };
}

/**
 * GraphOperation - shared base for Create, Match, Merge
 * @constructor
 * @param {Statement} statement - Parent statement
 */
function GraphOperation(statement) {
    const patterns = [];
    let previousOperation;
    let nextOperation;
    let whereCondition;

    this.where = function(expression) { whereCondition = new Where(expression); };
    this.addPattern = function() { patterns.push(new Pattern()); };
    const lastPattern = function() { return patterns[patterns.length-1]; };
    this.getPattern = function() { return lastPattern(); };
    this.addNode = function(node) { lastPattern().addNode(node); };
    this.addRelationship = function(relationship) { lastPattern().addRelationship(relationship); };
    this.getLast = function() { return lastPattern().lastObject(); };
    this.variable = function(key) { statement.addVariable(key, this.getLast()); };
    this.setPreviousOperation = function(op) { previousOperation = op; };
    this.setNextOperation = function(op) {
        nextOperation = op;
        op.setPreviousOperation(this);
    };
    this.previousOperation = function() { return previousOperation; };
    this.nextOperation = function() { return nextOperation; };
    this.patterns = function() { return patterns; };
    this.whereCondition = function() { return whereCondition; };
    this.variables = function() { return statement.variables(); };

    this.initialiseConveyorBelt = function() {
        if(nextOperation) {
            lastPattern().setNextAction(function() {
                if(!whereCondition || whereCondition.evaluate()) {
                    const result = nextOperation.doIt();
                    if(result instanceof Promise) result.then();
                }
            });
        }
    };

    this.defaultFinish = function() {
        if(nextOperation) nextOperation.finish();
        else statement.success();
    };
}

/**
 * Create - CREATE operation
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function Create(_statement) {
    const statement = _statement;
    GraphOperation.call(this, statement);
    const base = this;

    this.doIt = function() {
        if(base.previousOperation() && base.previousOperation().constructor.name == 'Merge') {
            throw "WITH is required between MERGE and CREATE";
        }
        base.initialiseConveyorBelt();
        this.doIt = function() {
            const patterns = base.patterns();
            for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                patterns[patternIdx].create();
            }
        };
        this.doIt();
    };
    this.finish = base.defaultFinish.bind(this);
    this.run = function() {
        base.initialiseConveyorBelt();
        const patterns = base.patterns();
        for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
            patterns[patternIdx].create();
        }
        if(base.nextOperation()) base.nextOperation().finish();
    };
    this.type = function() { return 'Create'; };
}

/**
 * Match - MATCH operation
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function Match(_statement) {
    const statement = _statement;
    GraphOperation.call(this, statement);
    const base = this;

    this.doIt = function() {
        if(base.previousOperation() && base.previousOperation().constructor.name == 'Merge') {
            throw "WITH is required between MERGE and MATCH";
        }
        base.initialiseConveyorBelt();
        this.doIt = function() {
            const patterns = base.patterns();
            for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                patterns[patternIdx].match();
            }
        };
        this.doIt();
    };
    this.finish = function() {
        const patterns = base.patterns();
        const next = base.nextOperation();
        if(next) {
            for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                patterns[patternIdx].finish();
            }
            next.finish();
        } else {
            statement.success();
        }
    };
    this.run = function() {
        base.initialiseConveyorBelt();
        const patterns = base.patterns();
        for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
            patterns[patternIdx].match();
        }
        const next = base.nextOperation();
        if(next) {
            for(let patternIdx=0; patternIdx<patterns.length; patternIdx++) {
                patterns[patternIdx].finish();
            }
            next.finish();
        }
    };
    this.type = function() { return 'Match'; };
}

/**
 * Merge - MERGE operation
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function Merge(_statement) {
    const statement = _statement;
    GraphOperation.call(this, statement);
    const base = this;

    // Override variable to also set variableKey on the pattern object
    const baseVariable = this.variable.bind(this);
    this.variable = function(key) {
        this.getLast().setVariableKey(key);
        baseVariable(key);
    };

    this.doIt = function() {
        base.initialiseConveyorBelt();
        this.doIt = function() {
            base.patterns()[base.patterns().length-1].merge();
        };
        this.doIt();
    };
    this.finish = base.defaultFinish.bind(this);
    this.run = function() {
        base.initialiseConveyorBelt();
        base.patterns()[base.patterns().length-1].merge();
        if(base.nextOperation()) base.nextOperation().finish();
    };
    this.type = function() { return 'Merge'; };
}

/**
 * GroupBy - handles GROUP BY aggregation
 * @constructor
 * @param {Object} context - Return context
 */
function GroupBy(context) {
    const ctx = context;
    let trieRoot = null;
    let currentTrieNode;
    let reducersCount = 0;
    const stringRecoder = new StringRecoder();

    const newNode = function(value) { return { value: value, map: {} }; };
    const recode = function(val) {
        if(val == undefined || val == null) return val;
        if(val.constructor.name == 'NodeReference' || val.constructor.name == 'RelationshipReference') return val.id();
        else if(val.constructor == Array || val.constructor == Object) return JSON.stringify(val);
        return stringRecoder.recode(val);
    };
    this.getTrieRoot = function() { return trieRoot; };
    this.beginMap = function() {
        if(trieRoot == null) trieRoot = newNode();
        currentTrieNode = trieRoot;
    };
    this.beginMap();
    this.map = function(element) {
        if(element.non_deterministic()) element.precalculate();
        const groupByKey = recode(element.groupByKey());
        const groupByValue = element.groupByValue();
        if(!currentTrieNode.map[groupByKey]) currentTrieNode.map[groupByKey] = newNode(groupByValue);
        currentTrieNode = currentTrieNode.map[groupByKey];
    };
    this.getReducer = function(reducerIdx) {
        if(!currentTrieNode.reducers) currentTrieNode.reducers = new Array(reducersCount);
        if(!currentTrieNode.reducers[reducerIdx]) currentTrieNode.reducers[reducerIdx] = {};
        return currentTrieNode.reducers[reducerIdx];
    };
    this.addReducer = function() { return reducersCount++; };
    this.print = function() { printTrie(trieRoot); };
    
    const printTrie = function(trieNode) {
        let key;
        for(key in trieNode.map) {
            ctx.setNextMapValue(trieNode.map[key].value);
            printTrie(trieNode.map[key]);
            ctx.moveToPreviousMapValue();
        }
        if(!key) {
            currentTrieNode = trieNode;
            ctx.addAggregateOutputRecord();
        }
    };
}

/**
 * ReturnValue - value returned from query
 * @constructor
 * @param {Object} _expression - Expression to return
 * @param {Statement} _statement - Parent statement
 * @param {Object} _parent - Parent return/with
 * @param {boolean} isHidden - Whether hidden from output
 */
function ReturnValue(_expression, _statement, _parent, isHidden) {
    const expression = _expression;
    const statement = _statement;
    let alias = expression.getAlias();
    let id = 0;
    let groupByValue;
    const me = this;
    const hidden = isHidden;
    const parent = _parent;

    this.getAlias = function() { return alias; };
    this.setAlias = function(_alias) {
        alias = _alias;
        statement.addVariable(alias, this);
    };
    this.hasKey = function() { return expression.hasKey(); };
    this.setId = function(_id) { id = _id; };
    this.getId = function() { return id; };
    this.value = function() {
        if(groupByValue != undefined) return groupByValue;
        return expression.value();
    };
    this.groupByKey = function() { return this.value(); };
    this.groupByValue = function() { return this.value(); };
    this.get = function() { return me.value(); };
    this.getData = function() { return me; };
    this.getExpression = function() { return expression; };
    this.setGroupByValue = function(_groupByValue) {
        if(expression.isArray() && expression.hasAggregateFunctions()) return;
        groupByValue = _groupByValue;
    };
    this.nextAction = function() { /* intentionally empty */ };
    this.setNextAction = function(f) { this.nextAction = f; };
    this.hidden = function() { return hidden; };
    this.parent = function() { return parent; };
    this.type = function() { return this.constructor.name; };
}

/**
 * Return - RETURN clause
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function Return(_statement) {
    const statement = _statement;
    const returnValues = [];
    let groupBy;
    let mapReturnValues;
    let mapReturnValuesIterator = 0;
    let reduceExpressions;
    let previousOperation;
    let nextOperation;
    let isIntermediary = false, hasReferredVariables = false, hasConstants = false;
    const me = this;
    let whereCondition;
    let limitExpression;
    let recordCount = 0;
    let doItCount = 0;

    this.where = function(expression) { whereCondition = new Where(expression); };
    this.limit = function(expression) { limitExpression = expression; };
    this.expression = function(expression) { addReturnValue(expression); };
    this.getLast = function() { return returnValues[lastIndex()]; };
    this.getGroupBy = function() {
        if(groupBy == undefined) groupBy = new GroupBy(this);
        return groupBy;
    };
    this.hasGroupBy = function() { return groupBy != undefined; };
    this.hasMapKeys = function() { return mapReturnValues && (mapReturnValues.length > 0); };
    this.doItCount = function() { return doItCount; };

    const hasLimit = function() { return limitExpression != undefined; };
    const limitReached = function() { return (hasLimit() && recordCount >= limitExpression.value()); };
    const whereConditionMet = function() { return !whereCondition || whereCondition.evaluate(); };

    this.addReduceExpression = function(reduceExpression) {
        if(!reduceExpressions) reduceExpressions = [];
        reduceExpressions.push(reduceExpression);
    };
    this.setNextMapValue = function(mapValue) {
        mapReturnValues[mapReturnValuesIterator++].setGroupByValue(mapValue);
    };
    this.moveToPreviousMapValue = function() { mapReturnValuesIterator--; };
    this.addAggregateOutputRecord = function() {
        if(!whereConditionMet()) return;
        if(this.doItCount() == 0 && this.hasMapKeys()) return;
        if(limitReached()) return;
        for(let i=0; i<returnValues.length; i++) { returnValues[i].nextAction(); }
        recordCount++;
        if(nextOperation) nextOperation.doIt();
    };

    this.setReturnValueNextAction = function(returnValue) {
        returnValue.setNextAction(function() {
            if(returnValue.getId() == 0) statement.addOutputRecord();
            if(returnValue.hidden()) return;
            statement.addOutputEntry(returnValue.getAlias(), returnValue.value(), returnValue.getId());
        });
    };

    const addReturnValue = function(expression, isHidden) {
        let hasHiddenReturnValues = false;
        if(expression.isArray()) {
            const array = expression.root().element();
            for(let i=0; i<array.getElements().length; i++) {
                const hiddenReturnValue = addReturnValue(array.getElements()[i], true);
                array.setElement(i, hiddenReturnValue);
                hasHiddenReturnValues = true;
            }
        } else if(expression.isAssociativeArray()) {
            const associativeArray = expression.root().element();
            const values = associativeArray.getValues();
            for(let i=0; i<values.length; i++) {
                const hiddenReturnValue = addReturnValue(values[i], true);
                associativeArray.setValue(i, hiddenReturnValue);
                hasHiddenReturnValues = true;
            }
        }
        const returnValue = new ReturnValue(expression, statement, me, isHidden);
        returnValues.push(returnValue);
        returnValues[lastIndex()].setId(lastIndex());
        if(!returnValue.getExpression().isReduceExpression() &&
            !hasHiddenReturnValues && returnValue.getExpression().mappable()) {
            if(!mapReturnValues) mapReturnValues = [];
            mapReturnValues.push(returnValue);
        }
        me.setReturnValueNextAction(returnValue);
        hasReferredVariables = hasReferredVariables || expression.hasReferredVariables();
        hasConstants = !hasReferredVariables;
        return returnValue;
    };

    this.setIsIntermediary = function() { isIntermediary = true; };
    this.conveyorBeltEnd = function() {
        return !hasReferredVariables && isIntermediary && !reduceExpressions && !hasConstants;
    };
    const lastIndex = function() { return returnValues.length-1; };

    this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };
    this.previousOperation = function() { return previousOperation; };
    this.nextOperation = function() { return nextOperation; };

    this.variables = function() {
        if(!nextOperation && previousOperation) return previousOperation.variables();
        const variableList = [];
        for(let i=0; i<returnValues.length; i++) {
            if(returnValues[i].hidden()) continue;
            variableList.push(statement.getVariable(returnValues[i].getAlias()));
        }
        return variableList;
    };
    this.type = function() { return this.constructor.name; };

    const internalDoIt = function() {
        doItCount++;
        if(!me.hasGroupBy()) {
            if(!whereConditionMet()) return;
            if(limitReached()) return;
            for(let i=0; i<returnValues.length; i++) { returnValues[i].nextAction(); }
            recordCount++;
            if(nextOperation) {
                const result = nextOperation.doIt();
                if(result instanceof Promise) result.then();
            }
        } else {
            groupBy.beginMap();
            if(mapReturnValues) {
                for(let i=0; i<mapReturnValues.length; i++) {
                    mapReturnValues[i].getExpression().aggregate();
                }
            }
            for(let i=0; i<reduceExpressions.length; i++) { reduceExpressions[i].aggregate(); }
        }
    };

    this.doIt = function() { if(!this.conveyorBeltEnd()) internalDoIt(); };
    this.finish = function() {
        if(this.conveyorBeltEnd()) internalDoIt();
        if(this.hasGroupBy()) groupBy.print();
        if(nextOperation) nextOperation.finish();
        else statement.success();
    };
    this.run = function() {
        internalDoIt();
        if(nextOperation) nextOperation.finish();
        else this.finish();
    };
}

/**
 * With - WITH clause (extends Return)
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function With(_statement) {
    const extendedObject = new Return(_statement);
    const descendentClassName = "With";

    extendedObject.setReturnValueNextAction = function(returnValue) {
        if(returnValue.hidden()) return;
        returnValue.setNextAction(function() {
            if(extendedObject.hasGroupBy()) {
                _statement.getVariable(returnValue.getAlias()).setOverriddenValue(returnValue.value());
            }
        });
    };
    extendedObject.type = function() { return descendentClassName; };
    extendedObject.setIsIntermediary();
    return extendedObject;
}

/**
 * Unwind - UNWIND clause
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function Unwind(_statement) {
    const statement = _statement;
    let previousOperation;
    let nextOperation;
    let expressionToUnwind;
    let collectionToUnwind;
    let unwindedVariableKey;
    let index = 0;

    this.doIt = function() {
        if(nextOperation) {
            collectionToUnwind = expressionToUnwind.value();
            if(!collectionToUnwind) return;
            if(!Array.isArray(collectionToUnwind)) throw "Unwind expects list expression.";
            for(index=0; index<collectionToUnwind.length; index++) {
                const result = nextOperation.doIt();
                if(result instanceof Promise) result.then();
            }
        }
    };
    this.finish = function() { if(nextOperation) nextOperation.finish(); };
    this.run = function() {
        this.doIt();
        if(nextOperation) nextOperation.finish();
    };
    this.variable = function(key) {
        unwindedVariableKey = key;
        statement.addVariable(key, this);
    };
    this.variables = function() { return [statement.getVariable(unwindedVariableKey)]; };
    this.expression = function(expression) { expressionToUnwind = expression; };
    this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };
    this.previousOperation = function() { return previousOperation; };
    this.nextOperation = function() { return nextOperation; };
    this.value = function() { return collectionToUnwind[index]; };
    this.groupByKey = this.value;
    this.groupByValue = this.value;
    this.get = function() { return this.value(); };
    this.getData = function() { return this; };
    this.type = function() { return this.constructor.name; };
    this.id = function() { return this.value().id(); };
    this.collection = function() { return collectionToUnwind; };
    this.index = function() { return index; };
}

/**
 * Load - LOAD operation for external data
 * @constructor
 * @param {Statement} _statement - Parent statement
 */
function Load(_statement) {
    const statement = _statement;
    let loadType = null;
    let requestType = "GET";
    let payload = null;
    let withHeaders = false;
    let httpHeaders = null;
    let fieldTerminator = ",";
    let from = null;
    let csvData = null;
    let data;
    let previousOperation;
    let nextOperation = null;
    const intermediateVariables = new Map();

    this.csv = function() { loadType = "CSV"; };
    this.json = function() { loadType = "JSON"; };
    this.text = function() { loadType = "TEXT"; };
    this.post = function() { requestType = "POST"; };
    this.loadType = function() { return loadType; };
    this.getRequestType = function() { return requestType; };
    this.getPayload = function() { return payload ? payload.value() : null; };
    this.headers = function() { withHeaders = true; };
    this.setHTTPHeaders = function(_httpHeaders) { httpHeaders = _httpHeaders; };
    this.getHTTPHeaders = function() { return httpHeaders; };
    this.setFieldTerminator = function(_fieldTerminator) {
        if(_fieldTerminator.length > 1 || _fieldTerminator.length == 0) throw "Field terminator must be one char.";
        fieldTerminator = _fieldTerminator;
    };
    this.fieldTerminator = function() { return fieldTerminator; };
    this.expression = function(expression) {
        if(from == null) from = expression;
        else if(payload == null) payload = expression;
    };
    this.getLast = function() { return from; };
    this.variable = function(key) { statement.addVariable(key, this); };
    this.getProperty = function(key) { return data[key]; };
    this.from = function() { return from.value(); };
    this.get = function() { return data; };
    this.value = function() { return this.get(); };
    this.groupByKey = function() { return data; };
    this.groupByValue = function() { return this.get(); };
    this.getData = function() { return this; };
    this.statement = function() { return statement; };
    this.setPreviousOperation = function(_previousOperation) { previousOperation = _previousOperation; };
    this.setNextOperation = function(_nextOperation) {
        nextOperation = _nextOperation;
        nextOperation.setPreviousOperation(this);
    };
    this.previousOperation = function() { return previousOperation; };
    this.variables = function() { return statement.variables(); };

    // CSV parsing
    const parseCSV = function(_fieldSeparator, nextOperationCb) {
        const fieldNames = [];
        let fieldNumber = 0;
        let record = {};
        let lineNumber = 0;
        let c = '', i = 0, pc = '';
        let inDoubleQuotes = false;
        const fieldSeparator = _fieldSeparator || ',';

        const next = function() {
            pc = c;
            c = csvData.charAt(i++);
            if(doubleQuote()) { inDoubleQuotes = !inDoubleQuotes; next(); }
        };
        const consume = function() {
            if(isQuoteInQuote()) { c = csvData.charAt(++i); return '""'; }
            return c;
        };
        const nextChar = function() { return eof() ? '\0' : csvData.charAt(i); };
        const isQuoteInQuote = function() {
            if(doubleQuoted()) { if(c == '"' && nextChar() == '"') return true; }
            return false;
        };
        const doubleQuote = function() { return !isQuoteInQuote() && c == '"'; };
        const doubleQuoted = function() { return inDoubleQuotes; };
        const isFieldSeparator = function() { return c == fieldSeparator; };
        const newLine = function() {
            if(c == '\r' && nextChar() == '\n') next();
            return c == '\n';
        };
        const eof = function() { return i >= csvData.length; };
        const more = function() { return !(isFieldSeparator() || newLine() || eof()); };

        const addRecord = function() {
            if(lineNumber++ > 0) {
                data = record;
                record = {};
                fieldNumber = 0;
                const result = nextOperationCb();
                if(result instanceof Promise) result.then();
            }
        };
        const field = function() {
            let f = "";
            while(more() || doubleQuoted()) { f += consume(); next(); }
            if(lineNumber == 0) {
                if(withHeaders) fieldNames.push(f);
                else fieldNames.push(fieldNames.length);
            }
            if((lineNumber > 0 && withHeaders) || !withHeaders) {
                record[fieldNames[fieldNumber++]] = f;
            }
            if(isFieldSeparator()) next();
        };
        while(!eof()) {
            while(!newLine() && !eof()) { field(); }
            addRecord();
            next();
        }
    };

    // JSON processing
    const processJSON = function(jsonData, nextOperationCb) {
        if(jsonData.constructor == Array) {
            for(let i=0; i<jsonData.length; i++) {
                data = addAssociativeArrayFunctions(jsonData[i]);
                nextOperationCb();
            }
        } else if(jsonData.constructor == Object) {
            data = addAssociativeArrayFunctions(jsonData);
            nextOperationCb();
        }
    };

    this.doIt = function() { return this.run(); };
    this.finish = function() { /* intentionally empty */ };

    this.saveVariables = function() {
        const vars = Object.fromEntries(
            statement.variables().map(function(v) { return [v.getObjectKey(), v.value()]; })
        );
        const key = intermediateVariables.size;
        intermediateVariables.set(key, vars);
        return key;
    };
    this.setVariables = function(key) {
        const vars = intermediateVariables.get(key);
        for(const variableKey in vars) {
            const variable = statement.getVariable(variableKey);
            if(variable) variable.setOverriddenValue(vars[variableKey]);
        }
    };
    this.removeVariables = function(key) {
        const vars = intermediateVariables.get(key);
        for(const variableKey in vars) {
            const variable = statement.getVariable(variableKey);
            if(variable) variable.setOverriddenValue(null);
        }
        intermediateVariables.delete(key);
    };
    this.isVariablesEmpty = function() { return intermediateVariables.size == 0; };

    // Import HTTP lazily to avoid issues in browser
    let http;
    const getHttp = function() {
        if (!http) {
            // Will be injected from engine
            http = httpModule;
        }
        return http;
    };
    let httpModule;
    this.setHttpModule = function(mod) { httpModule = mod; };

    this.run = function() {
        const me = this;
        const fromVal = me.from();
        const variablesKey = me.saveVariables();
        
        const handleResponse = function(responseText) {
            me.setVariables(variablesKey);
            if(me.loadType() == "CSV") {
                csvData = responseText;
                parseCSV(me.fieldTerminator(), function() { nextOperation.doIt(); });
            } else if(me.loadType() == "JSON") {
                processJSON(JSON.parse(responseText), function() { nextOperation.doIt(); });
            } else if(me.loadType() == "TEXT") {
                data = responseText;
                nextOperation.doIt();
            }
            me.removeVariables(variablesKey);
            if(me.isVariablesEmpty()) nextOperation.finish();
        };
        
        const handleError = function(statusText) {
            const error = "Error loading data from " + fromVal + ": " + statusText;
            try { throw error; } catch(e) { throw error; }
        };
        
        if(fromVal.constructor == String) {
            const h = getHttp();
            if(me.getRequestType() == "GET") {
                try {
                    h.get(fromVal, me.getHTTPHeaders() ? me.getHTTPHeaders().value(false) : null, handleResponse, handleError);
                } catch(e) { handleError(e); }
            } else if(me.getRequestType() == "POST") {
                try {
                    h.post(me.from(), me.getPayload(), me.getHTTPHeaders() ? me.getHTTPHeaders().value(false) : null, handleResponse, handleError);
                } catch(e) { handleError(e); }
            }
        } else if(fromVal.constructor != String) {
            if(me.loadType() == "JSON") {
                processJSON(fromVal, function() { nextOperation.doIt(); });
            }
        }
    };
    this.type = function() { return this.constructor.name; };
}

// Export all query layer components
export { 
    Expression, 
    Variable, 
    Statement, 
    Where, 
    Inserter, 
    Setter, 
    GraphOperation, 
    Create, 
    Match, 
    Merge, 
    GroupBy, 
    ReturnValue, 
    Return, 
    With, 
    Unwind, 
    Load 
};