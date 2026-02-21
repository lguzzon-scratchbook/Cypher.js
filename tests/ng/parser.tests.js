/**
 * Parser Tests
 * 
 * Comprehensive tests for the Cypher query parser.
 */

const { 
  Parser, 
  KeyWord, 
  Operator, 
  _Function, 
  AggregateFunction, 
  PredicateFunctionLookup,
  Constant,
  FString,
  Trie,
  VariableReference,
  ExpressionElement,
  AggregateExpressionElement
} = require('../../js/CypherNG/query/Parser.js');

// Mock engine for testing
function createMockEngine() {
  const operations = [];
  const variables = {};
  let lastNode = null;
  let lastRel = null;
  let context = null;
  
  const mockNode = () => {
    const node = { 
      setLabel: () => {},
      setType: () => {},
      setProperty: () => {},
      setReferredNode: () => {},
      hasKey: () => false,
      isNode: () => true,
      isRelationship: () => false,
      type: () => 'Node',
      getPattern: () => ({ shortestpath: () => {} })
    };
    lastNode = node;
    return node;
  };
  
  const mockRel = () => {
    const rel = {
      setReferredRelationship: () => {},
      setHasVariablePathLength: () => {},
      setPathLengthFrom: () => {},
      setPathLengthTo: () => {},
      isNode: () => false,
      isRelationship: () => true,
      type: () => 'Relationship'
    };
    lastRel = rel;
    return rel;
  };
  
  return {
    create: () => { operations.push('create'); },
    match: () => { operations.push('match'); },
    merge: () => { operations.push('merge'); },
    _with: () => { operations.push('with'); },
    _return: () => { operations.push('return'); },
    unwind: () => { operations.push('unwind'); },
    load: () => { operations.push('load'); },
    csv: () => { operations.push('csv'); },
    json: () => { operations.push('json'); },
    text: () => { operations.push('text'); },
    post: () => { operations.push('post'); },
    into: () => { operations.push('into'); },
    pattern: () => { operations.push('pattern'); },
    node: () => { 
      operations.push('node');
      return mockNode();
    },
    relationship: () => { 
      operations.push('relationship');
      return mockRel();
    },
    label: (name) => { operations.push(`label:${name}`); },
    type: (name) => { operations.push(`type:${name}`); },
    variable: (key) => { 
      operations.push(`variable:${key}`);
      variables[key] = { 
        getObject: () => ({ 
          isNode: () => true,
          isRelationship: () => false,
          type: () => 'Node'
        }),
        value: () => ({ id: () => 1 })
      };
    },
    expression: () => { operations.push('expression'); },
    where: (expr) => { operations.push('where'); },
    limit: (expr) => { operations.push('limit'); },
    as: (alias) => { operations.push(`as:${alias}`); },
    setter: () => { operations.push('setter'); },
    insertInto: (table) => { operations.push(`insertInto:${table}`); },
    leftDirection: () => { operations.push('leftDirection'); },
    rightDirection: () => { operations.push('rightDirection'); },
    relStart: () => {},
    relMiddle: () => {},
    relEnd: () => {},
    context: () => ({
      headers: () => {},
      setFieldTerminator: () => {},
      setHTTPHeaders: () => {},
      getPattern: () => ({ shortestpath: () => {} }),
      setHasVariablePathLength: () => {},
      setPathLengthFrom: () => {},
      setPathLengthTo: () => {},
      addReduceExpression: () => {},
      getGroupBy: () => ({
        addReducer: () => ({}),
        map: () => {}
      })
    }),
    operationContext: () => ({
      addSetter: () => {},
      addLabelSetter: () => {},
      addTypeSetter: () => {},
      addMapSetter: () => {}
    }),
    operation: () => 'Match',
    lastObject: () => lastNode || lastRel || { hasKey: () => false },
    variableExists: (key) => variables.hasOwnProperty(key),
    getVariable: (key) => variables[key],
    statement: () => ({
      context: () => ({
        variables: () => Object.values(variables),
        headers: () => {},
        setFieldTerminator: () => {},
        setHTTPHeaders: () => {},
        getPattern: () => ({ shortestpath: () => {} }),
        getLast: () => ({ getPattern: () => ({}) }),
        addReduceExpression: () => {},
        getGroupBy: () => ({
          addReducer: () => ({}),
          map: () => {}
        })
      }),
      addVariable: (key, obj) => { variables[key] = obj; },
      getVariable: (key) => variables[key]
    }),
    propertyKey: (key) => { operations.push(`propertyKey:${key}`); },
    propertyValue: (expr) => { operations.push('propertyValue'); },
    _operations: operations,
    _variables: variables
  };
}

describe('Parser - Trie', () => {
  test('should build trie from functions', () => {
    const f = {
      TEST: { displayValue: () => 'TEST' },
      HELLO: { displayValue: () => 'HELLO' }
    };
    const trie = Trie.buildTrie(f);
    expect(trie.T).toBeDefined();
    expect(trie.T.E).toBeDefined();
    expect(trie.T.E.S).toBeDefined();
    expect(trie.T.E.S.T).toBeDefined();
    expect(trie.T.E.S.T.isF).toBe(true);
  });

  test('should match keywords in trie', () => {
    const f = {
      CREATE: { displayValue: () => 'CREATE' },
      MATCH: { displayValue: () => 'MATCH' }
    };
    const trie = Trie.buildTrie(f);
    const what = { latestParsed: null };
    const result = Trie.isF(what, trie, 'CREATE (n)', 0);
    expect(result).toBe(6);
    expect(what.latestParsed).toBe(f.CREATE);
  });

  test('should not match partial keywords', () => {
    const f = {
      CREATE: { displayValue: () => 'CREATE' }
    };
    const trie = Trie.buildTrie(f);
    const what = { latestParsed: null };
    const result = Trie.isF(what, trie, 'CREAT (n)', 0);
    expect(result).toBe(0);
  });
});

describe('Parser - Keywords', () => {
  test('should have all required keywords', () => {
    expect(KeyWord.f.CREATE).toBeDefined();
    expect(KeyWord.f.MATCH).toBeDefined();
    expect(KeyWord.f.MERGE).toBeDefined();
    expect(KeyWord.f.RETURN).toBeDefined();
    expect(KeyWord.f.WITH).toBeDefined();
    expect(KeyWord.f.WHERE).toBeDefined();
    expect(KeyWord.f.LIMIT).toBeDefined();
    expect(KeyWord.f.UNWIND).toBeDefined();
    expect(KeyWord.f.LOAD).toBeDefined();
    expect(KeyWord.f.CSV).toBeDefined();
    expect(KeyWord.f.JSON).toBeDefined();
  });

  test('keywords should have actions', () => {
    const engine = createMockEngine();
    KeyWord.f.CREATE.action(engine);
    expect(engine._operations).toContain('create');
    
    KeyWord.f.MATCH.action(engine);
    expect(engine._operations).toContain('match');
    
    KeyWord.f.RETURN.action(engine);
    expect(engine._operations).toContain('return');
  });

  test('should detect keywords in text', () => {
    const result = KeyWord.isKeyWord('CREATE (n:Test)', 0);
    expect(result).toBe(6);
    expect(KeyWord.latestParsed).toBe(KeyWord.f.CREATE);
  });

  test('should be case insensitive', () => {
    const result = KeyWord.isKeyWord('create (n:Test)', 0);
    expect(result).toBe(6);
    expect(KeyWord.latestParsed).toBe(KeyWord.f.CREATE);
  });
});

describe('Parser - Operators', () => {
  test('should have all required operators', () => {
    expect(Operator.f.PLUS).toBeDefined();
    expect(Operator.f.MINUS).toBeDefined();
    expect(Operator.f.MULTIPLY).toBeDefined();
    expect(Operator.f.DIVIDE).toBeDefined();
    expect(Operator.f.EQUALS).toBeDefined();
    expect(Operator.f.NOT_EQUALS).toBeDefined();
    expect(Operator.f.GREATER_THAN).toBeDefined();
    expect(Operator.f.LESS_THAN).toBeDefined();
    expect(Operator.f.AND).toBeDefined();
    expect(Operator.f.OR).toBeDefined();
  });

  test('operators should have correct precedence', () => {
    expect(Operator.f.POWER.precedence()).toBe(11);
    expect(Operator.f.MULTIPLY.precedence()).toBe(10);
    expect(Operator.f.PLUS.precedence()).toBe(9);
    expect(Operator.f.EQUALS.precedence()).toBe(7);
    expect(Operator.f.AND.precedence()).toBe(6);
    expect(Operator.f.OR.precedence()).toBe(5);
  });

  test('operators should compute values correctly', () => {
    const plus = Operator.f.PLUS;
    plus.lhs = { value: () => 5 };
    plus.rhs = { value: () => 3 };
    expect(plus.value()).toBe(8);

    const equals = Operator.f.EQUALS;
    equals.lhs = { value: () => 'test' };
    equals.rhs = { value: () => 'test' };
    expect(equals.value()).toBe(true);

    const and = Operator.f.AND;
    and.lhs = { value: () => true };
    and.rhs = { value: () => false };
    expect(and.value()).toBe(false);
  });
});

describe('Parser - Functions', () => {
  test('should have all required functions', () => {
    expect(_Function.f.sqrt).toBeDefined();
    expect(_Function.f.sin).toBeDefined();
    expect(_Function.f.cos).toBeDefined();
    expect(_Function.f.range).toBeDefined();
    expect(_Function.f.head).toBeDefined();
    expect(_Function.f.last).toBeDefined();
    expect(_Function.f.size).toBeDefined();
    expect(_Function.f.split).toBeDefined();
    expect(_Function.f.join).toBeDefined();
    expect(_Function.f.trim).toBeDefined();
    expect(_Function.f.lower).toBeDefined();
    expect(_Function.f.upper).toBeDefined();
    expect(_Function.f.replace).toBeDefined();
    expect(_Function.f.toint).toBeDefined();
    expect(_Function.f.tofloat).toBeDefined();
    expect(_Function.f.tostring).toBeDefined();
    expect(_Function.f.coalesce).toBeDefined();
    expect(_Function.f.round).toBeDefined();
    expect(_Function.f.rand).toBeDefined();
    expect(_Function.f.not).toBeDefined();
  });

  test('functions should compute values correctly', () => {
    const sqrt = _Function.f.sqrt;
    sqrt.p = [{ value: () => 16 }];
    expect(sqrt.value()).toBe(4);

    const size = _Function.f.size;
    size.p = [{ value: () => [1, 2, 3, 4, 5] }];
    expect(size.value()).toBe(5);

    const toint = _Function.f.toint;
    toint.p = [{ value: () => '42' }];
    expect(toint.value()).toBe(42);

    const not = _Function.f.not;
    not.p = [{ value: () => false }];
    expect(not.value()).toBe(true);
  });

  test('should verify parameter counts', () => {
    expect(() => _Function.f.sqrt.verifyParsedParameterCount(0)).toThrow();
    expect(() => _Function.f.sqrt.verifyParsedParameterCount(1)).not.toThrow();
    expect(() => _Function.f.sqrt.verifyParsedParameterCount(2)).toThrow();
  });
});

describe('Parser - Aggregate Functions', () => {
  test('should have all required aggregate functions', () => {
    expect(AggregateFunction.f.sum).toBeDefined();
    expect(AggregateFunction.f.min).toBeDefined();
    expect(AggregateFunction.f.max).toBeDefined();
    expect(AggregateFunction.f.count).toBeDefined();
    expect(AggregateFunction.f.collect).toBeDefined();
  });

  test('aggregate functions should have correct structure', () => {
    const sum = AggregateFunction.f.sum;
    expect(sum.initialize).toBeDefined();
    expect(sum.value).toBeDefined();
    expect(sum.aggregate).toBeDefined();
  });
});

describe('Parser - Constant', () => {
  test('should wrap values', () => {
    const c = new Constant(42);
    expect(c.get()).toBe(42);
    expect(c.value()).toBe(42);
    expect(c.type()).toBe('Constant');
  });

  test('should handle different types', () => {
    const stringConst = new Constant('hello');
    expect(stringConst.value()).toBe('hello');

    const boolConst = new Constant(true);
    expect(boolConst.value()).toBe(true);

    const nullConst = new Constant(null);
    expect(nullConst.value()).toBe(null);
  });
});

describe('Parser - FString', () => {
  test('should build formatted strings', () => {
    const fs = new FString();
    fs.string('Hello, ');
    fs.expression({ value: () => 'World' });
    fs.string('!');
    expect(fs.value()).toBe('Hello, World!');
  });

  test('should handle multiple expressions', () => {
    const fs = new FString();
    fs.string('Value: ');
    fs.expression({ value: () => 42 });
    fs.string(', Text: ');
    fs.expression({ value: () => 'test' });
    expect(fs.value()).toBe('Value: 42, Text: test');
  });
});

describe('Parser - ExpressionElement', () => {
  test('should wrap elements', () => {
    const constant = new Constant(42);
    const elem = new ExpressionElement(constant);
    expect(elem.element()).toBe(constant);
    expect(elem.value()).toBe(42);
  });

  test('should track mappability', () => {
    const constant = new Constant(42);
    const elem = new ExpressionElement(constant);
    expect(elem.mappable()).toBe(true);
  });
});

describe('Parser - AggregateExpressionElement', () => {
  test('should extend ExpressionElement', () => {
    const agg = AggregateFunction.f.sum;
    const elem = new AggregateExpressionElement(agg);
    expect(elem.element()).toBe(agg);
    expect(elem.mappable()).toBe(false);
  });

  test('should track distinct flag', () => {
    const agg = AggregateFunction.f.count;
    const elem = new AggregateExpressionElement(agg);
    expect(elem.isDistinct()).toBe(false);
    elem.setDistinct();
    expect(elem.isDistinct()).toBe(true);
  });
});

describe('Parser - Main Parser Class', () => {
  test('should create parser instance', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    expect(parser).toBeDefined();
    expect(parser.position()).toBe(0);
  });

  test('should parse CREATE statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('CREATE (n:Test)');
    expect(engine._operations).toContain('create');
    expect(engine._operations).toContain('pattern');
    expect(engine._operations).toContain('node');
    expect(engine._operations).toContain('label:Test');
  });

  test('should parse MATCH statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MATCH (n:Person)');
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('pattern');
    expect(engine._operations).toContain('node');
    expect(engine._operations).toContain('label:Person');
  });

  test('should parse MERGE statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MERGE (n:Test {name: "value"})');
    expect(engine._operations).toContain('merge');
  });

  test('should parse RETURN statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('RETURN 1+2');
    expect(engine._operations).toContain('return');
  });

  test('should parse WITH statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('WITH 1 AS x');
    expect(engine._operations).toContain('with');
  });

  test('should parse UNWIND statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('UNWIND [1,2,3] AS x');
    expect(engine._operations).toContain('unwind');
  });

  test('should parse LOAD CSV statement', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('LOAD CSV FROM "file.csv" AS row');
    expect(engine._operations).toContain('load');
    expect(engine._operations).toContain('csv');
  });

  test('should parse complete query', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MATCH (n:Person) WHERE n.age > 18 RETURN n.name');
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('where');
    expect(engine._operations).toContain('return');
  });

  test('should throw on invalid syntax', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    expect(() => parser.parse('INVALID')).toThrow();
  });

  test('should throw on unclosed parenthesis', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    expect(() => parser.parse('CREATE (n:Test')).toThrow();
  });

  test('should handle comments', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse(`
      // This is a comment
      MATCH (n:Test)
      RETURN n
    `);
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('return');
  });

  test('should parse expressions with operators', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('RETURN 1 + 2 * 3');
    expect(engine._operations).toContain('return');
  });

  test('should parse CASE expressions', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('RETURN CASE WHEN 1=1 THEN "yes" ELSE "no" END');
    expect(engine._operations).toContain('return');
  });

  test('should parse list expressions', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('RETURN [1, 2, 3]');
    expect(engine._operations).toContain('return');
  });

  test('should parse map expressions', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('RETURN {a: 1, b: 2}');
    expect(engine._operations).toContain('return');
  });

  test('should parse LIMIT clause', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MATCH (n) RETURN n LIMIT 10');
    expect(engine._operations).toContain('limit');
  });

  test('should parse relationship patterns', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MATCH (a)-[:KNOWS]->(b) RETURN a, b');
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('relationship');
  });

  test('should parse variable path length', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MATCH (a)-[*1..3]->(b) RETURN a, b');
    expect(engine._operations).toContain('match');
  });

  test('should parse SET clause', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('MATCH (n) SET n.name = "test"');
    expect(engine._operations).toContain('setter');
  });

  test('should track position correctly', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse('CREATE (n)');
    expect(parser.position()).toBeGreaterThan(0);
  });
});

describe('Parser - Predicate Functions', () => {
  test('should have predicate functions', () => {
    expect(PredicateFunctionLookup.f.all).toBeDefined();
    expect(PredicateFunctionLookup.f.any).toBeDefined();
    expect(PredicateFunctionLookup.f.sum).toBeDefined();
  });

  test('should detect predicate functions', () => {
    const result = PredicateFunctionLookup.isPredicateFunction('all(x IN list WHERE x > 0)', 0);
    expect(result).toBeGreaterThan(0);
    expect(PredicateFunctionLookup.latestParsed).toBe(PredicateFunctionLookup.f.all);
  });
});

describe('Parser - Complex Queries', () => {
  test('should parse complex multi-clause query', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse(`
      MATCH (p:Person)-[:KNOWS]->(friend:Person)
      WHERE p.age > 21
      WITH p AS person, 1 AS dummy
      RETURN person
      LIMIT 10
    `);
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('with');
    expect(engine._operations).toContain('return');
  });

  test('should parse query with multiple patterns', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse(`
      MATCH (a:Person), (b:Company)
      CREATE (a)-[:WORKS_AT]->(b)
    `);
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('create');
  });

  test('should parse query with properties', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse(`
      CREATE (n:Person {name: "Alice", age: 30, active: true})
    `);
    expect(engine._operations).toContain('create');
    expect(engine._operations).toContain('label:Person');
  });

  test('should parse query with functions', () => {
    const engine = createMockEngine();
    const parser = new Parser(engine);
    parser.parse(`
      MATCH (n)
      RETURN count(n) AS total, collect(n.name) AS names
    `);
    expect(engine._operations).toContain('match');
    expect(engine._operations).toContain('return');
  });
});
