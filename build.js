import { mkdir, writeFile, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const distEsm = join(__dirname, 'dist', 'esm');
const distCjs = join(__dirname, 'dist', 'cjs');

const srcFiles = [
  'CypherNG.js',
  'index.js',
  'core/GraphEngine.js',
  'core/QueryExecutor.js',
  'core/QueryParser.js',
  'core/ExpressionEvaluator.js',
  'data/Node.js',
  'data/Relationship.js',
  'data/Graph.js',
  'data/QueryResult.js',
  'storage/Adapter.js',
  'storage/Registry.js',
  'utils/IDFactory.js',
  'utils/StringRecoder.js'
];

async function build() {
  console.log('Building CypherNG...');

  await mkdir(distEsm, { recursive: true });
  await mkdir(distCjs, { recursive: true });

  // Build ESM - copy source files as-is
  for (const file of srcFiles) {
    const srcPath = join(srcDir, file);
    try {
      const content = await readFile(srcPath, 'utf-8');
      const targetDir = join(distEsm, file).replace(/[^/\\]+$/, '');
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(distEsm, file), content);
    } catch {
      // Skip missing files
    }
  }

  // Build CJS - convert ESM to CJS
  for (const file of srcFiles) {
    const srcPath = join(srcDir, file);
    try {
      const content = await readFile(srcPath, 'utf-8');
      const targetDir = join(distCjs, file).replace(/[^/\\]+$/, '');
      await mkdir(targetDir, { recursive: true });
      const cjsContent = convertToCjs(content, file);
      const cjsFile = file.replace(/\.js$/, '.cjs');
      await writeFile(join(distCjs, cjsFile), cjsContent);
    } catch {
      // Skip missing files
    }
  }

  console.log('Build complete!');
  console.log('  - ESM: dist/esm/');
  console.log('  - CJS: dist/cjs/');
}

function convertToCjs(content, filePath) {
  // For index.js, handle re-exports specially
  if (filePath === 'index.js') {
    let cjs = '';
    const lines = content.split('\n');
    let modCounter = 0;

    for (const line of lines) {
      const match = line.match(/export\s+\{\s*([^}]+)\s*\}\s+from\s+['"]\.\/([^'"]+)['"];?/);
      if (match) {
        const exports = match[1].split(',').map(s => s.trim());
        const file = match[2].replace('.js', '');
        const modName = `__m${modCounter++}`;
        cjs += `const ${modName} = require('./${file}.cjs');\n`;
        for (const exp of exports) {
          cjs += `module.exports.${exp} = ${modName}.${exp};\n`;
        }
      } else if (line.trim() && !line.trim().startsWith('//')) {
        // Keep comments and other content as-is for now (will be processed by other regexes)
        cjs += line + '\n';
      }
    }

    // Now convert the rest
    content = cjs;
  }

  // Simple conversion
  let cjs = content
    // Remove import statements
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n/g, '\n')
    .replace(/import\s+['"][^'"]+['"];?\n/g, '\n')
    // Convert export class/function
    .replace(/export\s+class\s+(\w+)/g, 'class $1')
    .replace(/export\s+function\s+(\w+)/g, 'function $1')
    // Handle named exports
    .replace(/export\s+\{\s*([^}]+?)\s*\}\s*;?/g, (_, exports) => {
      const names = exports.split(',').map(s => s.trim());
      return names.map(name => `module.exports.${name} = ${name};`).join('\n');
    })
    .replace(/export\s+default\s+(\w+)/g, 'module.exports = $1');

  // Add module.exports for classes at the end
  const classMatches = cjs.match(/^class\s+(\w+)/gm) || [];
  const funcMatches = cjs.match(/^function\s+(\w+)/gm) || [];
  const allMatches = [...classMatches, ...funcMatches];

  for (const match of allMatches) {
    const name = match.replace(/^(class|function)\s+/, '').trim();
    if (!cjs.includes(`module.exports.${name}`) && !name.startsWith('__')) {
      cjs += `\nmodule.exports.${name} = ${name};`;
    }
  }

  return cjs;
}

build().catch(console.error);