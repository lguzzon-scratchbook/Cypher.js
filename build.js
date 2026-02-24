import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const distEsm = join(__dirname, 'dist', 'esm');
const distCjs = join(__dirname, 'dist', 'cjs');

async function build() {
  console.log('Building CypherNG...');

  // Ensure directories exist
  await mkdir(distEsm, { recursive: true });
  await mkdir(distCjs, { recursive: true });

  // ESM build (copy source files with correct extension handling)
  const srcIndex = await import('./src/index.js');
  const exportNames = Object.keys(srcIndex);

  // Create ESM entry point
  let esmContent = `// CypherNG ESM Build\n`;
  for (const name of exportNames) {
    if (name === 'default') continue;
    esmContent += `export { ${name} } from '../src/${getExportPath(name)}';\n`;
  }

  await writeFile(join(distEsm, 'CypherNG.js'), esmContent);

  // Create CJS entry point
  let cjsContent = `// CypherNG CommonJS Build\n`;
  cjsContent += `const CypherNG = require('../src/CypherNG.js');\n`;
  cjsContent += `module.exports = CypherNG.exports;\n`;
  cjsContent += `module.exports.CypherNG = CypherNG.CypherNG;\n`;
  cjsContent += `module.exports.createCypherNG = CypherNG.createCypherNG;\n`;

  await writeFile(join(distCjs, 'CypherNG.js'), cjsContent);

  console.log('Build complete!');
  console.log('  - ESM: dist/esm/CypherNG.js');
  console.log('  - CJS: dist/cjs/CypherNG.js');
}

function getExportPath(name) {
  const paths = {
    'CypherNG': 'CypherNG.js',
    'createCypherNG': 'CypherNG.js',
    'GraphEngine': 'core/GraphEngine.js',
    'QueryExecutor': 'core/QueryExecutor.js',
    'QueryParser': 'core/QueryParser.js',
    'ExpressionEvaluator': 'core/ExpressionEvaluator.js',
    'Node': 'data/Node.js',
    'Relationship': 'data/Relationship.js',
    'Graph': 'data/Graph.js',
    'QueryResult': 'data/QueryResult.js',
    'StringRecoder': 'utils/StringRecoder.js',
    'IDFactory': 'utils/IDFactory.js',
    'StorageAdapter': 'storage/Adapter.js',
    'Registry': 'storage/Registry.js'
  };
  return paths[name] || 'index.js';
}

build().catch(console.error);