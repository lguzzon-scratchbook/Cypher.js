/**
 * CypherNG.js - Next-generation Cypher graph query engine
 * 
 * A refactored, modular implementation of the Cypher graph database
 * with improved maintainability and extension points for persistence.
 * 
 * @version 2.0.0
 * @author Based on original work by Niclas Kjäll-Ohlsson
 * @license GPL-3.0-or-later
 */

// Core modules
const { StringRecoder } = require('./CypherNG/core/StringRecoder.js');
const { IDFactory } = require('./CypherNG/core/IDFactory.js');
const { Node } = require('./CypherNG/core/Node.js');
const { NodeReference } = require('./CypherNG/core/NodeReference.js');
const { Relationship } = require('./CypherNG/core/Relationship.js');
const { RelationshipReference } = require('./CypherNG/core/RelationshipReference.js');
const { Pattern } = require('./CypherNG/core/Pattern.js');
const { DB } = require('./CypherNG/core/DB.js');

// Type modules
const { List } = require('./CypherNG/types/List.js');
const { AssociativeArray } = require('./CypherNG/types/AssociativeArray.js');
const { Case } = require('./CypherNG/types/Case.js');
const { Predicate } = require('./CypherNG/types/Predicate.js');
const { Table } = require('./CypherNG/types/Table.js');
const { TableColumn } = require('./CypherNG/types/TableColumn.js');

// Network module
const { HTTP } = require('./CypherNG/network/HTTP.js');

// Persistence extension points
const { StorageAdapter } = require('./CypherNG/persistence/adapters/StorageAdapter.js');
const { GraphSerializer } = require('./CypherNG/persistence/serializers/GraphSerializer.js');

// Query modules
const { Parser } = require('./CypherNG/query/Parser.js');
const { Expression } = require('./CypherNG/query/Expression.js');

/**
 * CypherJS - Core query engine implementation
 * @private
 */
function CypherJS() {
  // Data section
  const Data = {
    StringRecoder,
    IDFactory,
    DB,
    Node,
    NodeReference,
    Relationship,
    RelationshipReference,
    Pattern,
    AssociativeArray,
    List,
    Case,
    Predicate,
    Table,
    TableColumn
  };

  // Network section
  const Network = {
    HTTP
  };

  // Query operation classes
  // Expression is imported from query/Expression.js
  
  // Create a wrapper that extends the imported Expression with additional methods needed by query operations
  function ExpressionWrapper(root, alias, aggregationFunctions, context, variableReferences, nonDeterministic) {
    // Call parent constructor
    const Expression = require('./CypherNG/query/Expression.js').Expression;
    Expression.call(this, root, alias, aggregationFunctions, context, variableReferences, nonDeterministic);
    
    // Additional properties for query operations
    this._localVariables = {};
    
    // Additional methods
    this.rootObject = function() {
      const r = this.root();
      if (r && r.element && r.element().getObject) {
        return r.element().getObject();
      }
      return r && r.element ? r.element() : r;
    };
    
    this.isReduceExpression = function() { 
      return this.hasAggregateFunctions(); 
    };
    
    this.aggregate = function() {
      const funcs = this.getAggregateFunctions();
      if (funcs) {
        for (let i = 0; i < funcs.length; i++) {
          if (funcs[i].aggregate) {
            funcs[i].aggregate();
          }
        }
        return;
      }
      const ctx = this._context || this.getGroupBy && this.getGroupBy();
      if (ctx && ctx.map) {
        ctx.map(this.root());
      }
    };
    
    this.isArray = function() { 
      const r = this.root();
      return r && r.element && r.element().constructor === List; 
    };
    
    this.isAssociativeArray = function() { 
      const r = this.root();
      return r && r.element && r.element().constructor === AssociativeArray; 
    };
    
    this.setLocalVariable = function(key, value) { 
      this._localVariables[key] = value; 
    };
    
    this.getLocalVariable = function(key) { 
      return this._localVariables[key]; 
    };
  }
  
  // Inherit from Expression
  const Expression = require('./CypherNG/query/Expression.js').Expression;
  ExpressionWrapper.prototype = Object.create(Expression.prototype);
  ExpressionWrapper.prototype.constructor = ExpressionWrapper;
  
  // Use the wrapper as our Expression
  const ExpressionImpl = ExpressionWrapper;

  // Query section - uses imported Expression and local implementations
  const Query = {
    Expression: ExpressionImpl,
    Variable,
    Statement,
    Where,
    Inserter,
    Setter,
    Create,
    Match,
    Merge,
    Return,
    With,
    Load,
    Unwind,
    Order,
    GroupBy,
    Limit,
    Skip,
    Delete,
    Remove,
    Foreach,
    ReturnItem,
    AggregationFunction,
    Distinct
  };

  function Variable(object, key) {
    this._object = object;
    this._objectKey = key;
    this._overriddenValue = null;

    this.getObjectKey = function() { return this._objectKey; };
    this.getObject = function() {
      if (this._overriddenValue) return this._overriddenValue;
      if (this._object && this._object.constructor && this._object.constructor.name === 'Constant') {
        return this._object.getObject();
      }
      return this._object;
    };
    this.value = function(asKey) {
      if (this._overriddenValue) return this._overriddenValue;
      try {
        if (this._object && this._object.getData) {
          const data = this._object.getData();
          if (data && data.get) {
            return data.get(asKey);
          }
          // If getData returns null (e.g., for newly created nodes), use the object directly
          if (this._object.get) {
            return this._object.get(asKey);
          }
        }
      } catch (e) {
        // Ignore
      }
      return null;
    };
    this.setOverriddenValue = function(value) { this._overriddenValue = value; };
    this.type = function() { return this.constructor.name; };
  }

  function Statement(engine) {
    this._engine = engine;
    this._operations = [];
    this._variables = {};
    this._lastVariable = null;
    this._lastPropertyKey = null;
    this._output = [];
    this._graph = { nodes: {}, relationships: {} };
    this._nodesAdded = 0;
    this._relationshipsAdded = 0;
    this._overriddenContextStack = [];
    this._overriddenContext = undefined;
    this._successCallback = null;

    this.addOperation = function(operation) {
      if (this.context() && this.context().type && this.context().type() === 'Return') {
        throw new Error('There can only be one return statement and it must be last in the query.');
      }
      if (this.context()) {
        this.context().setNextOperation(operation);
      }
      this._operations.push(operation);
    };

    this.operations = function() { return this._operations; };
    this.context = function() { return this._overriddenContext || this._operations[this._operations.length - 1]; };
    this.setContext = function(context) {
      if (this._overriddenContext) {
        this._overriddenContextStack.push(this._overriddenContext);
      }
      this._overriddenContext = context;
    };
    this.resetContext = function() {
      this._overriddenContext = this._overriddenContextStack.pop();
    };
    this.addVariable = function(key, object) {
      this._lastVariable = new Variable(object, key);
      if (this._variables[key]) {
        throw new Error(`Variable \`${key}\` already declared.`);
      }
      this._variables[key] = this._lastVariable;
    };
    this.variables = function() { return Object.values(this._variables); };
    this.getVariable = function(key) {
      if (this._variables[key] === undefined) {
        throw new Error(`Variable \`${key}\` has not been declared.`);
      }
      return this._variables[key];
    };
    this.hasVariable = function(key) { return this._variables[key] !== undefined; };
    this.getLastVariable = function() { return this._lastVariable; };
    this.setPropertyKey = function(key) { this._lastPropertyKey = key; };
    this.getPropertyKey = function() { return this._lastPropertyKey; };
    this.clear = function() {
      this._operations = [];
      this._variables = {};
      this._lastVariable = undefined;
      this._lastPropertyKey = undefined;
      this._output = [];
      this._nodesAdded = 0;
      this._relationshipsAdded = 0;
      this._graph = { nodes: {}, relationships: {} };
    };
    this.engine = function() { return this._engine; };
    this.results = function() {
      this._checkGraphConsistency();
      return {
        output: this._output,
        graph: {
          nodes: Object.values(this._graph.nodes),
          links: Object.values(this._graph.relationships)
        },
        stats: {
          nodesAdded: this._nodesAdded,
          relationshipsAdded: this._relationshipsAdded
        }
      };
    };
    this.addOutputRecord = function() { this._output.push({}); };
    this.addOutputEntry = function(key, value, id) {
      let finalKey = key;
      if (this._output[this._output.length - 1][finalKey] !== undefined) {
        finalKey += id;
      }
      this._addOutputEntryToGraph(value);
      this._output[this._output.length - 1][finalKey] = this._clean(value);
    };
    this._addOutputEntryToGraph = function(entry) {
      if (entry && entry.constructor === NodeReference) {
        if (this._graph.nodes[entry.id()] === undefined) {
          this._graph.nodes[entry.id()] = this._clean(entry);
        }
      } else if (entry && entry.constructor === RelationshipReference) {
        if (this._graph.relationships[entry.id()] === undefined) {
          const e = entry.getObject().toObject();
          e.source = e.fromNode.id();
          e.target = e.toNode.id();
          this._graph.relationships[entry.id()] = this._clean(e);
        }
      } else if (entry && entry.constructor === Array) {
        for (let i = 0; i < entry.length; i++) {
          this._addOutputEntryToGraph(entry[i]);
        }
      }
    };
    this._checkGraphConsistency = function() {
      const relIdsToDelete = [];
      for (const relationshipId in this._graph.relationships) {
        const rel = this._graph.relationships[relationshipId];
        if (!this._graph.nodes[rel.source] || !this._graph.nodes[rel.target]) {
          relIdsToDelete.push(relationshipId);
        }
      }
      for (let i = 0; i < relIdsToDelete.length; i++) {
        delete this._graph.relationships[relIdsToDelete[i]];
      }
    };
    this._clean = function(o) {
      if (o === null || o === undefined) return o;
      if (o.constructor === NodeReference || o.constructor === RelationshipReference) {
        return o.value();
      }
      if (o.constructor === Array) {
        return o.map(item => this._clean(item));
      }
      if (typeof o === 'object') {
        const cleaned = {};
        for (const p in o) {
          if (typeof o[p] !== 'function') {
            cleaned[p] = this._clean(o[p]);
          }
        }
        return cleaned;
      }
      return o;
    };
    this.setNodesAdded = function(value) { this._nodesAdded = value; };
    this.setRelationshipsAdded = function(value) { this._relationshipsAdded = value; };
    this.getNodesAdded = function() { return this._nodesAdded; };
    this.getRelationshipsAdded = function() { return this._relationshipsAdded; };
    this.setSuccessCallback = function(callback) { this._successCallback = callback; };
    this.success = function() {
      if (this._successCallback) {
        this._successCallback(this.results());
      }
    };
  }

  // Stub implementations for other query operations
  function Where(expression) {
    this._expression = expression;
    this.evaluate = function() { return this._expression.value() === true; };
    this.type = function() { return this.constructor.name; };
  }

  function Inserter(db, tableName) {
    this._db = db;
    this._tableName = tableName;
    this._tableColumns = [];
    this._previousOperation = null;
    this._nextOperation = null;

    this.setPreviousOperation = function(op) {
      this._previousOperation = op;
      if (op && op.variables) {
        const variables = op.variables();
        for (let i = 0; i < variables.length; i++) {
          const variable = variables[i];
          this._tableColumns.push(this._table.addColumn(variable.getObjectKey()));
        }
      }
    };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.variables = function() { return this._previousOperation ? this._previousOperation.variables() : []; };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.run = function() { throw new Error('Into-operation cannot be first in statement.'); };
    this.type = function() { return this.constructor.name; };

    // Initialize table
    this._table = new Table(db, tableName);
  }

  function Setter() {
    this._setters = [];
    this._previousOperation = null;
    this._nextOperation = null;

    this.addSetter = function(variable, propertyKey, expression) {
      if (!this._setters) this._setters = [];
      this._setters.push({ variable, propertyKey, expression });
    };
    this.addLabelSetter = function(variable, labelExpression) {
      if (!this._setters) this._setters = [];
      this._setters.push({ type: 'label', variable, labelExpression });
    };
    this.addMapSetter = function(variable, mapExpression) {
      if (!this._setters) this._setters = [];
      this._setters.push({ type: 'map', variable, mapExpression });
    };
    this.addTypeSetter = function(variable, typeExpression) {
      if (!this._setters) this._setters = [];
      this._setters.push({ type: 'type', variable, typeExpression });
    };
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.variables = function() { return this._previousOperation ? this._previousOperation.variables() : []; };
    this.doIt = function() {
      for (let i = 0; i < this._setters.length; i++) {
        const setter = this._setters[i];
        // Get the actual matched object from the variable
        let templateObj = setter.variable.getObject();
        let obj = templateObj;
        
        // If the object has getData(), it's a pattern node/rel - get the actual DB object
        if (templateObj && templateObj.getData) {
          obj = templateObj.getData();
        }
        
        if (setter.type === 'label') {
          // Set label on node
          if (obj && setter.labelExpression && setter.labelExpression.value) {
            const label = setter.labelExpression.value();
            if (obj.setLabel) obj.setLabel(label, obj.id());
          }
        } else if (setter.type === 'type') {
          // Set type on relationship
          if (obj && setter.typeExpression && setter.typeExpression.value) {
            const type = setter.typeExpression.value();
            if (obj.setType) obj.setType(type);
          }
        } else if (setter.type === 'map') {
          // Set multiple properties from map
          if (obj && setter.mapExpression && setter.mapExpression.value) {
            const map = setter.mapExpression.value();
            if (map && obj.setProperties) obj.setProperties(map);
          }
        } else {
          // Set single property
          if (obj && setter.propertyKey && setter.expression && setter.expression.value) {
            const value = setter.expression.value();
            if (obj._properties) {
              obj._properties[setter.propertyKey] = value;
            }
          }
        }
      }
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.run = function() {
      this.doIt();
      this.finish();
    };
    this.type = function() { return this.constructor.name; };
  }

  function Create(statement) {
    this._statement = statement;
    this._patterns = [];
    this._previousOperation = null;
    this._nextOperation = null;
    this._whereCondition = null;

    this.where = function(expression) { this._whereCondition = new Where(expression); };
    this.addPattern = function() { this._patterns.push(new Pattern()); };
    this.getPattern = function() { return this._patterns[this._patterns.length - 1]; };
    this.addNode = function(node) { this.getPattern().addNode(node); };
    this.addRelationship = function(rel) { this.getPattern().addRelationship(rel); };
    this.variable = function(key) { this._statement.addVariable(key, this.getLast()); };
    this.getLast = function() { return this.getPattern().lastObject(); };
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.previousOperation = function() { return this._previousOperation; };
    this.doIt = function() {
      for (let i = 0; i < this._patterns.length; i++) {
        this._patterns[i].create();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.run = function() {
      for (let i = 0; i < this._patterns.length; i++) {
        this._patterns[i].create();
      }
      if (this._nextOperation && this._nextOperation.run) {
        this._nextOperation.run();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.type = function() { return this.constructor.name; };
    this.variables = function() { return this._statement ? this._statement.variables() : []; };
  }

  function Match(statement) {
    this._statement = statement;
    this._patterns = [];
    this._previousOperation = null;
    this._nextOperation = null;
    this._whereCondition = null;

    this.where = function(expression) { this._whereCondition = new Where(expression); };
    this.addPattern = function() { this._patterns.push(new Pattern()); };
    this.getPattern = function() { return this._patterns[this._patterns.length - 1]; };
    this.addNode = function(node) { this.getPattern().addNode(node); };
    this.addRelationship = function(rel) { this.getPattern().addRelationship(rel); };
    this.variable = function(key) { this._statement.addVariable(key, this.getLast()); };
    this.getLast = function() { return this.getPattern().lastObject(); };
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.previousOperation = function() { return this._previousOperation; };
    this.doIt = function() {
      for (let i = 0; i < this._patterns.length; i++) {
        this._patterns[i].match();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.run = function() {
      for (let i = 0; i < this._patterns.length; i++) {
        this._patterns[i].match();
      }
      if (this._nextOperation && this._nextOperation.run) {
        this._nextOperation.run();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.type = function() { return this.constructor.name; };
    this.variables = function() { return this._statement ? this._statement.variables() : []; };
  }

  function Merge(statement) {
    this._statement = statement;
    this._patterns = [];
    this._previousOperation = null;
    this._nextOperation = null;
    this._whereCondition = null;

    this.where = function(expression) { this._whereCondition = new Where(expression); };
    this.addPattern = function() { this._patterns.push(new Pattern()); };
    this.getPattern = function() { return this._patterns[this._patterns.length - 1]; };
    this.addNode = function(node) { this.getPattern().addNode(node); };
    this.addRelationship = function(rel) { this.getPattern().addRelationship(rel); };
    this.variable = function(key) { this._statement.addVariable(key, this.getLast()); };
    this.getLast = function() { return this.getPattern().lastObject(); };
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.doIt = function() {
      for (let i = 0; i < this._patterns.length; i++) {
        this._patterns[i].merge();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.run = function() {
      for (let i = 0; i < this._patterns.length; i++) {
        this._patterns[i].merge();
      }
      if (this._nextOperation && this._nextOperation.run) {
        this._nextOperation.run();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.type = function() { return this.constructor.name; };
    this.variables = function() { return this._statement ? this._statement.variables() : []; };
  }

  function Return(statement) {
    this._statement = statement;
    this._returnItems = [];
    this._previousOperation = null;
    this._nextOperation = null;
    this._order = null;
    this._skip = null;
    this._limit = null;
    this._groupBy = null;
    this._reduceExpressions = [];
    this._isDistinct = false;

    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.addReturnItem = function(item) { this._returnItems.push(item); };
    this.setOrder = function(order) { this._order = order; };
    this.setSkip = function(skip) { this._skip = skip; };
    this.setLimit = function(limit) { this._limit = limit; };
    this.getGroupBy = function() {
      if (!this._groupBy) {
        this._groupBy = new GroupBy();
      }
      return this._groupBy;
    };
    this.addReduceExpression = function(expr) { this._reduceExpressions.push(expr); };
    this.setDistinct = function() { this._isDistinct = true; };
    this.variables = function() { return this._previousOperation ? this._previousOperation.variables() : []; };
    this.doIt = function() {
      // Process return items and add to output
      if (this._returnItems.length > 0) {
        // Aggregation is already done during pattern matching
        // Just output the final values
        
        this._statement.addOutputRecord();
        for (let i = 0; i < this._returnItems.length; i++) {
          const item = this._returnItems[i];
          const expr = item._expression;
          const alias = item._alias || ('column_' + i);
          if (expr && expr.value) {
            const value = expr.value();
            this._statement.addOutputEntry(alias, value, i);
          }
        }
      }
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      } else if (this._statement && this._statement.success) {
        this._statement.success();
      }
    };
    this.run = function() {
      this.doIt();
      this.finish();
    };
    this.type = function() { return this.constructor.name; };
  }

  function With(statement) {
    this._statement = statement;
    this._returnItems = [];
    this._previousOperation = null;
    this._nextOperation = null;
    this._where = null;
    this._order = null;
    this._skip = null;
    this._limit = null;

    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.addReturnItem = function(item) { this._returnItems.push(item); };
    this.where = function(expression) { this._where = new Where(expression); };
    this.setOrder = function(order) { this._order = order; };
    this.setSkip = function(skip) { this._skip = skip; };
    this.setLimit = function(limit) { this._limit = limit; };
    this.variables = function() { return this._previousOperation ? this._previousOperation.variables() : []; };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.run = function() {
      this.doIt();
      this.finish();
    };
    this.type = function() { return this.constructor.name; };
  }

  function Load(statement) {
    this._statement = statement;
    this._previousOperation = null;
    this._nextOperation = null;

    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.variables = function() { return this._previousOperation ? this._previousOperation.variables() : []; };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.run = function() {
      this.doIt();
      this.finish();
    };
    this.type = function() { return this.constructor.name; };
  }

  function Unwind(statement) {
    this._statement = statement;
    this._expression = null;
    this._variableKey = null;
    this._previousOperation = null;
    this._nextOperation = null;

    this.setExpression = function(expr) { this._expression = expr; };
    this.setVariableKey = function(key) { this._variableKey = key; };
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.variables = function() { return this._previousOperation ? this._previousOperation.variables() : []; };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.run = function() {
      this.doIt();
      this.finish();
    };
    this.type = function() { return this.constructor.name; };
  }

  function Order() {
    this._orderItems = [];
    this.addOrderItem = function(item) { this._orderItems.push(item); };
    this.type = function() { return this.constructor.name; };
  }

  function GroupBy() {
    this._reducers = [];
    this.addReducer = function() {
      const reducer = { map: [], reduce: function() {}, result: undefined };
      this._reducers.push(reducer);
      return reducer;
    };
    this.getReducer = function(id) {
      return this._reducers[id];
    };
    this.map = function(root) {
      // Implementation
    };
    this.type = function() { return this.constructor.name; };
  }

  function Limit() {
    this._expression = null;
    this.setExpression = function(expr) { this._expression = expr; };
    this.type = function() { return this.constructor.name; };
  }

  function Skip() {
    this._expression = null;
    this.setExpression = function(expr) { this._expression = expr; };
    this.type = function() { return this.constructor.name; };
  }

  function Delete() {
    this._previousOperation = null;
    this._nextOperation = null;
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.type = function() { return this.constructor.name; };
  }

  function Remove() {
    this._previousOperation = null;
    this._nextOperation = null;
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.type = function() { return this.constructor.name; };
  }

  function Foreach() {
    this._previousOperation = null;
    this._nextOperation = null;
    this.setPreviousOperation = function(op) { this._previousOperation = op; };
    this.setNextOperation = function(op) {
      this._nextOperation = op;
      if (op && op.setPreviousOperation) {
        op.setPreviousOperation(this);
      }
    };
    this.doIt = function() {
      if (this._nextOperation && this._nextOperation.doIt) {
        this._nextOperation.doIt();
      }
    };
    this.finish = function() {
      if (this._nextOperation && this._nextOperation.finish) {
        this._nextOperation.finish();
      }
    };
    this.type = function() { return this.constructor.name; };
  }

  function ReturnItem(expression, alias) {
    this._expression = expression;
    this._alias = alias;
    this.type = function() { return this.constructor.name; };
  }

  function AggregationFunction(name) {
    this._name = name;
    this._groupBy = null;
    this._reducer = null;
    this.setGroupBy = function(groupBy) { this._groupBy = groupBy; };
    this.setReducer = function(reducer) { this._reducer = reducer; };
    this.initialize = function() {};
    this.aggregate = function() {};
    this.type = function() { return this.constructor.name; };
  }

  function Distinct() {
    this.type = function() { return this.constructor.name; };
  }

  // Main engine instance
  const self = this;
  const db = new DB(this);
  const statement = new Statement(this);
  const parser = new Parser(this);
  let dataDownloadProxy = null;

  // Make parser accessible for expression retrieval
  this.parser = function() { return parser; };

  // Public API methods
  this.execute = function(statementText, successCallback, errorCallback) {
    statement.clear();
    try {
      parser.parse(statementText);
      statement.setSuccessCallback(successCallback);
      this.run();
    } catch (e) {
      if (errorCallback) {
        errorCallback(e.toString());
      }
    }
  };

  this.addGraph = function(nodes, edges) {
    db.addGraph(nodes, edges);
  };

  this.resetDataBase = function() {
    // Create new DB instance
    // Note: In full implementation, this would properly reset state
  };

  this.setDataDownloadProxy = function(proxy) {
    dataDownloadProxy = proxy;
  };

  this.getDataDownloadProxy = function() {
    return dataDownloadProxy;
  };

  this.db = function() {
    return db;
  };

  this.statement = function() {
    return statement;
  };

  this.optional = function() {
    return this;
  };

  this.create = function() {
    statement.addOperation(new Create(statement));
    return this;
  };

  this.match = function() {
    statement.addOperation(new Match(statement));
    return this;
  };

  this.pattern = function() {
    if (statement.context() && statement.context().addPattern) {
      statement.context().addPattern();
    }
    return this;
  };

  this.node = function() {
    if (statement.context() && statement.context().addNode) {
      statement.context().addNode(new Node(db));
    }
    return this;
  };

  this.relationship = function() {
    if (statement.context() && statement.context().addRelationship) {
      statement.context().addRelationship(new Relationship(db));
    }
    return this;
  };

  this.expression = function(expr) {
    if (statement.context() && statement.context().addReturnItem) {
      // Get expression from parser if not provided
      const expression = expr || parser.getExpression();
      if (expression) {
        const alias = expression.getAlias ? expression.getAlias() : null;
        statement.context().addReturnItem(new ReturnItem(expression, alias));
      }
    }
    return this;
  };

  this.variable = function(key) {
    if (statement.context() && statement.context().variable) {
      statement.context().variable(key);
    }
    return this;
  };

  this.variableExists = function(key) {
    return statement.hasVariable(key);
  };

  this.getVariable = function(key) {
    return statement.getVariable(key);
  };

  this.lastObject = function() {
    if (statement.context() && statement.context().getLast) {
      return statement.context().getLast();
    }
    return null;
  };

  this.label = function(labelName) {
    const last = this.lastObject();
    if (last && last.setLabel) {
      last.setLabel(labelName);
    }
    return this;
  };

  this.type = function(typeName) {
    const last = this.lastObject();
    if (last && last.setType) {
      last.setType(typeName);
    }
    return this;
  };

  this.readProperty = function(key) {
    const last = this.lastObject();
    if (last && last.readProperty) {
      last.readProperty(key);
    }
    return this;
  };

  this.propertyValue = function(expression) {
    const last = this.lastObject();
    if (last && last.setProperty && statement.getPropertyKey) {
      last.setProperty(statement.getPropertyKey(), expression);
    }
    return this;
  };

  this.propertyKey = function(key) {
    statement.setPropertyKey(key);
    return this;
  };

  this.as = function(alias) {
    // Update the alias of the last return item if in a Return/With context
    const ctx = statement.context();
    if (ctx && ctx._returnItems && ctx._returnItems.length > 0) {
      const lastItem = ctx._returnItems[ctx._returnItems.length - 1];
      if (lastItem) {
        lastItem._alias = alias;
      }
    }
    // Also try to set on last object if it supports it
    const last = this.lastObject();
    if (last && last.setAlias) {
      last.setAlias(alias);
    }
    return this;
  };

  this.leftDirection = function() {
    const last = this.lastObject();
    if (last && last.setLeftDirection) {
      last.setLeftDirection(true);
    }
    return this;
  };

  this.setter = function() {
    statement.addOperation(new Setter());
    return this;
  };

  this.relStart = function() {
    return this;
  };

  this.relMiddle = function() {
    return this;
  };

  this.relEnd = function() {
    return this;
  };

  this.rightDirection = function() {
    const last = this.lastObject();
    if (last && last.setRightDirection) {
      last.setRightDirection(true);
    }
    return this;
  };

  this.variableProperty = function(key) {
    return this;
  };

  this.equals = function() {
    return this;
  };

  this.constant = function(value) {
    if (statement.context() && statement.context().constant) {
      statement.context().constant(value);
    }
    return this;
  };

  this.load = function() {
    statement.addOperation(new Load(statement));
    return this;
  };

  this.csv = function() {
    if (statement.context() && statement.context().csv) {
      statement.context().csv();
    }
    return this;
  };

  this.json = function() {
    if (statement.context() && statement.context().json) {
      statement.context().json();
    }
    return this;
  };

  this.text = function() {
    if (statement.context() && statement.context().text) {
      statement.context().text();
    }
    return this;
  };

  this.post = function() {
    if (statement.context() && statement.context().post) {
      statement.context().post();
    }
    return this;
  };

  this._with = function() {
    statement.addOperation(new With(statement));
    return this;
  };

  this._return = function() {
    statement.addOperation(new Return(statement));
    return this;
  };

  this.into = function() {
    return this;
  };

  this.insertInto = function(tableName) {
    statement.addOperation(new Inserter(db, tableName));
  };

  this.merge = function() {
    statement.addOperation(new Merge(statement));
    return this;
  };

  this.unwind = function() {
    statement.addOperation(new Unwind(statement));
    return this;
  };

  this.limit = function(expression) {
    if (statement.context() && statement.context().setLimit) {
      statement.context().setLimit(expression);
    }
    return this;
  };

  this.where = function(expression) {
    if (statement.context() && statement.context().where) {
      statement.context().where(expression);
    }
    return this;
  };

  this.operation = function() {
    if (statement.context() && statement.context().type) {
      return statement.context().type();
    }
    return null;
  };

  this.context = function() {
    const last = this.lastObject();
    if (last && last.getObject) {
      return last.getObject();
    }
    return last;
  };

  this.operationContext = function() {
    return statement.context();
  };

  this.run = function() {
    const ctx = statement.context();
    if (ctx && ctx.type) {
      const type = ctx.type();
      if (type === 'Match' || type === 'With') {
        throw new Error(`A ${type}-statement cannot conclude the query.`);
      }
    }
    const ops = statement.operations();
    if (ops.length > 0 && ops[0].run) {
      ops[0].run();
    }
  };
}

// Environment detection
const Cypher_context_is_worker = (typeof document === 'undefined');
let isStandaloneJSEngine = false;

// Detect Node.js environment
try {
  if (typeof module !== 'undefined' && module.exports) {
    isStandaloneJSEngine = true;
  }
} catch (e) {
  isStandaloneJSEngine = false;
}

// Get script path (browser only)
let Cypher_script_path = '';
if (!Cypher_context_is_worker && typeof document !== 'undefined') {
  try {
    const scripts = document.getElementsByTagName('script');
    Cypher_script_path = scripts[scripts.length - 1].src;
  } catch (e) {
    Cypher_script_path = '';
  }
}

/**
 * Cypher - Main entry point for the Cypher query engine
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.runInWebWorker - Whether to run in a Web Worker (browser only)
 * @param {string} options.dataDownloadProxy - Proxy URL for data downloads (to avoid CORS)
 */
function Cypher(options) {
  options = options || {};
  const singleThreaded = !options.runInWebWorker;

  // Web Worker context
  if (Cypher_context_is_worker && !isStandaloneJSEngine) {
    try {
      const db = new CypherJS();

      if (options.dataDownloadProxy) {
        db.setDataDownloadProxy(options.dataDownloadProxy);
      }

      self.onmessage = function(e) {
        const request = e.data;
        const action = request.action;

        switch (action) {
          case 'query':
            db.execute(
              request.statementText,
              function(results) {
                self.postMessage({
                  action: action,
                  success: true,
                  results: results
                });
              },
              function(error) {
                self.postMessage({
                  action: action,
                  error: true,
                  message: error
                });
              }
            );
            return;

          case 'addGraph':
            try {
              db.addGraph(request.nodes, request.edges);
              self.postMessage({ action: action, success: true });
            } catch (e) {
              self.postMessage({ action: action, error: true, message: e.toString() });
            }
            return;

          case 'resetDataBase':
            db.resetDataBase();
            self.postMessage({ action: action });
            return;
        }
      };
    } catch (e) {
      // Worker initialization error
    }
  }
  // Main thread with Web Worker (browser only)
  else if (!Cypher_context_is_worker && !singleThreaded && !isStandaloneJSEngine) {
    let successCallback, errorCallback;
    const worker = new Worker(Cypher_script_path);

    worker.onmessage = function(e) {
      const response = e.data;
      const action = response.action;

      switch (action) {
        case 'query':
          if (response.success && successCallback) {
            successCallback(response.results);
          } else if (response.error && errorCallback) {
            errorCallback(response.message);
          }
          return;

        case 'addGraph':
          if (response.success && successCallback) {
            successCallback(response.results);
          } else if (response.error && errorCallback) {
            errorCallback(response.message);
          }
          return;

        case 'resetDataBase':
          if (successCallback) {
            successCallback();
          }
          return;
      }
    };

    this.execute = function(statementText, _successCallback, _errorCallback) {
      successCallback = _successCallback;
      errorCallback = _errorCallback;
      worker.postMessage({
        action: 'query',
        statementText: statementText
      });
    };

    this.addGraph = function(nodes, edges, _successCallback, _errorCallback) {
      successCallback = _successCallback;
      errorCallback = _errorCallback;
      worker.postMessage({
        action: 'addGraph',
        nodes: nodes,
        edges: edges
      });
    };

    this.resetDataBase = function(_successCallback) {
      successCallback = _successCallback || function() {};
      worker.postMessage({ action: 'resetDataBase' });
    };
  }
  // Single-threaded mode (Node.js or browser without worker)
  else {
    const db = new CypherJS();

    if (options.dataDownloadProxy) {
      db.setDataDownloadProxy(options.dataDownloadProxy);
    }

    this.execute = function(statementText, successCallback, errorCallback) {
      db.execute(statementText, successCallback, errorCallback);
    };

    this.addGraph = function(nodes, edges) {
      db.addGraph(nodes, edges);
    };

    this.resetDataBase = function() {
      db.resetDataBase();
    };

    this.setDataDownloadProxy = function(proxy) {
      db.setDataDownloadProxy(proxy);
    };

    this.getDataDownloadProxy = function() {
      return db.getDataDownloadProxy();
    };
  }
}

// Polyfills for older environments
if (typeof Object.values === 'undefined') {
  Object.values = function(object) {
    const values = [];
    for (const key in object) {
      if (object.hasOwnProperty(key)) {
        values.push(object[key]);
      }
    }
    return values;
  };
}

if (typeof Object.keys === 'undefined') {
  Object.keys = function(object) {
    const keys = [];
    for (const key in object) {
      if (object.hasOwnProperty(key)) {
        keys.push(key);
      }
    }
    return keys;
  };
}

if (typeof Array.prototype.fill === 'undefined') {
  Array.prototype.fill = function(value) {
    for (let i = 0; i < this.length; i++) {
      this[i] = value;
    }
    return this;
  };
}

if (typeof Number.MAX_SAFE_INTEGER === 'undefined') {
  Number.MAX_SAFE_INTEGER = 9007199254740991;
}

// Auto-initialize in worker context
if (Cypher_context_is_worker) {
  new Cypher();
}

// Export for Node.js
if (isStandaloneJSEngine) {
  module.exports = Cypher;
}
