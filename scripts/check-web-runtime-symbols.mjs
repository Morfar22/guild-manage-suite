import fs from 'node:fs';
import ts from 'typescript';

const files = [
  'src/pages/Index.tsx',
  'src/pages/Auth.tsx',
  'src/pages/GuildSelect.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/PublicFeatures.tsx',
  'src/pages/Security.tsx',
  'src/pages/BotSettings.tsx',
  'src/components/dashboard/SetupProgress.tsx',
  'src/components/dashboard/DashboardSidebarContent.tsx',
];

function addBindingName(name, bindings) {
  if (!name) return;
  if (ts.isIdentifier(name)) {
    bindings.add(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBindingName(element.name, bindings);
    }
  }
}

function collectBindings(sourceFile) {
  const bindings = new Set();

  function visit(node) {
    if (ts.isImportDeclaration(node) && node.importClause) {
      if (node.importClause.name) bindings.add(node.importClause.name.text);
      const named = node.importClause.namedBindings;
      if (named) {
        if (ts.isNamespaceImport(named)) {
          bindings.add(named.name.text);
        } else if (ts.isNamedImports(named)) {
          for (const element of named.elements) bindings.add(element.name.text);
        }
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      bindings.add(node.name.text);
    } else if (ts.isClassDeclaration(node) && node.name) {
      bindings.add(node.name.text);
    } else if (ts.isVariableDeclaration(node)) {
      addBindingName(node.name, bindings);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return bindings;
}

function collectJsxRoots(sourceFile) {
  const roots = new Set();

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const text = node.tagName.getText(sourceFile);
      const root = text.split('.')[0];
      if (/^[A-Z]/.test(root)) roots.add(root);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return roots;
}

const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const bindings = collectBindings(sourceFile);
  const jsxRoots = collectJsxRoots(sourceFile);

  for (const identifier of jsxRoots) {
    if (!bindings.has(identifier)) {
      failures.push(
        `${file}: JSX component ${identifier} is used but no import/local declaration was found`
      );
    }
  }
}

if (failures.length) {
  console.error('Web runtime symbol check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Web runtime symbol check OK');
