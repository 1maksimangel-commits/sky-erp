import path from 'node:path';
import ts from 'typescript';

const methods = new Set(['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'overlaps', 'order', 'or', 'not', 'filter', 'match']);
const unwrap = (node) => {
  while (node && (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
};

// Uses the compiler to follow imported constants and typed payloads. No app code
// is executed, no env files are loaded, and no database connection is opened.
export function collectSourceContract(root = process.cwd()) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error('Cannot read tsconfig.json');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, incremental: false, noEmit: true });
  const checker = program.getTypeChecker();
  const result = { tables: [], selects: [], columns: [], writes: [], rpcs: [], buckets: [], unresolved: [] };
  const declaration = (node) => {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  };
  function strings(input, seen = new Set()) {
    const node = unwrap(input);
    if (!node || seen.has(node)) return null;
    seen = new Set(seen).add(node);
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join') {
      const array = unwrap(node.expression.expression);
      if (ts.isArrayLiteralExpression(array)) {
        const values = array.elements.map(n => strings(n, seen));
        const separator = strings(node.arguments[0], seen);
        if (values.every(v => v?.length === 1) && separator?.length === 1) return [values.map(v => v[0]).join(separator[0])];
      }
    }
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) value += `__value__${span.literal.text}`;
      return [value];
    }
    if (ts.isConditionalExpression(node)) {
      const a = strings(node.whenTrue, seen), b = strings(node.whenFalse, seen);
      return a && b ? [...a, ...b] : null;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = strings(node.left, seen), b = strings(node.right, seen);
      return a && b ? a.flatMap(x => b.map(y => x + y)) : null;
    }
    const decl = declaration(node);
    if (decl?.initializer) {
      const values = strings(decl.initializer, seen);
      if (values) return values;
    }
    const type = checker.getTypeAtLocation(node);
    const types = type.isUnion() ? type.types : [type];
    return types.every(t => t.isStringLiteral()) ? types.map(t => t.value) : null;
  }
  function returns(node) {
    const output = [];
    if (!node?.body) return output;
    if (!ts.isBlock(node.body)) return [node.body];
    function walk(child) {
      if (ts.isReturnStatement(child) && child.expression) output.push(child.expression);
      else if (!ts.isFunctionLike(child)) ts.forEachChild(child, walk);
    }
    ts.forEachChild(node.body, walk);
    return output;
  }
  function tableOf(input, seen = new Set()) {
    const node = unwrap(input);
    if (!node || seen.has(node)) return null;
    seen = new Set(seen).add(node);
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression;
        if (node.expression.name.text === 'from') {
          if (/\bstorage\b/.test(receiver.getText()) || /^(Buffer|Array|Uint8Array)$/.test(receiver.getText())) return null;
          return strings(node.arguments[0]);
        }
        return tableOf(receiver, seen);
      }
      let decl = declaration(node.expression);
      if (decl?.initializer) decl = unwrap(decl.initializer);
      const found = returns(decl).flatMap(n => tableOf(n, seen) ?? []);
      return found.length ? [...new Set(found)] : null;
    }
    const decl = declaration(node);
    return decl?.initializer ? tableOf(decl.initializer, seen) : null;
  }
  function payloadKeys(input) {
    const node = unwrap(input);
    if (!node) return null;
    if (ts.isObjectLiteralExpression(node)) {
      const keys = [];
      for (const prop of node.properties) {
        if (ts.isSpreadAssignment(prop)) {
          const spread = payloadKeys(prop.expression);
          if (!spread) return null;
          keys.push(...spread);
        } else if (prop.name && ts.isComputedPropertyName(prop.name)) {
          const values = strings(prop.name.expression);
          if (!values) return null;
          keys.push(...values);
        } else if (prop.name) keys.push(prop.name.text);
      }
      return [...new Set(keys)];
    }
    let type = checker.getTypeAtLocation(node);
    if (checker.isArrayType(type) || checker.isTupleType(type)) type = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    if (!type) return null;
    const types = type.isUnion() ? type.types : [type];
    if (types.some(t => t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never) || checker.getIndexTypeOfType(t, ts.IndexKind.String))) {
      const decl = declaration(node);
      return decl?.initializer && decl.initializer !== input ? payloadKeys(decl.initializer) : null;
    }
    const keys = [...new Set(types.flatMap(t => checker.getPropertiesOfType(t).map(p => p.name)))];
    return keys.length ? keys : null;
  }
  for (const source of program.getSourceFiles()) {
    const file = path.relative(root, source.fileName).replaceAll(path.sep, '/');
    if (!file.startsWith('src/') || /\.test\./.test(file)) continue;
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const receiver = node.expression.expression;
        const at = `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        const unresolved = (kind) => result.unresolved.push({ at, kind, expression: node.getText() });
        if (method === 'from' && !/^(Buffer|Array|Uint8Array)$/.test(receiver.getText())) {
          const names = strings(node.arguments[0]);
          if (!names) unresolved('table or bucket');
          else if (/\bstorage\b/.test(receiver.getText())) result.buckets.push(...names);
          else result.tables.push(...names);
        } else if (method === 'rpc') {
          const names = strings(node.arguments[0]), args = payloadKeys(node.arguments[1]);
          if (!names || (node.arguments[1] && !args)) unresolved('RPC');
          else for (const name of names) result.rpcs.push({ name, args: args ?? [], at });
        } else if (methods.has(method)) {
          const tables = tableOf(receiver);
          if (!tables) {
            // Array.match/filter and filesystem APIs are not PostgREST queries.
            if (['select', 'insert', 'upsert', 'eq', 'neq', 'order', 'or', 'is', 'in', 'ilike'].includes(method)) unresolved('query receiver');
          } else for (const table of tables) {
            if (method === 'delete') continue;
            if (['insert', 'upsert', 'update', 'match'].includes(method)) {
              const keys = payloadKeys(node.arguments[0]);
              if (!keys) unresolved(`${table}.${method} payload`);
              else {
                result.columns.push(...keys.map(column => ({ table, column, at })));
                if (method === 'insert' || method === 'upsert') result.writes.push({ table, keys, at });
              }
            } else {
              let values = strings(node.arguments[0]);
              // These three legacy dynamic query paths were manually reviewed.
              // history-lock.json pins their entire source files: changes fail the
              // gate until reviewed. Constants still resolve from current source.
              if (!values && method === 'select') {
                const names = file === 'src/lib/logistics/db.ts' && node.arguments[0]?.getText() === 'columns'
                  ? ['shipmentColumns', 'shipmentColumnsLegacy']
                  : file === 'src/lib/documents/db.ts' && node.arguments[0]?.getText() === 'attempt.columns'
                    ? ['DOCUMENT_DMS_COLUMNS', 'DOCUMENT_COMPAT_COLUMNS', 'DOCUMENT_MINIMAL_COLUMNS'] : [];
                const symbols = checker.getSymbolsInScope(node, ts.SymbolFlags.Value | ts.SymbolFlags.Alias);
                if (names.length) {
                  const resolved = names.map(name => {
                    let symbol = symbols.find(s => s.name === name);
                    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
                    let initializer = symbol?.valueDeclaration?.initializer;
                    if (!initializer) {
                      for (const statement of source.statements) {
                        if (ts.isVariableStatement(statement)) initializer ??= statement.declarationList.declarations.find(d => d.name.getText() === name)?.initializer;
                      }
                    }
                    return strings(initializer);
                  });
                  if (resolved.every(Boolean)) values = resolved.flat();
                }
              }
              if (!values && method === 'or' && file === 'src/lib/documents/db.ts' && node.arguments[0]?.getText() === 'attempt.or ?? orFilter') {
                values = ['entity_type.eq.__value__,entity_id.eq.__value__,business_case_id.eq.__value__,contract_id.eq.__value__,shipment_id.eq.__value__,invoice_id.eq.__value__,company_id.eq.__value__,counterparty_id.eq.__value__,payment_id.eq.__value__,product_id.eq.__value__'];
              }
              if (!values && method === 'or' && file === 'src/lib/platform/ai.ts') values = ['buyer_id.eq.__value__,supplier_id.eq.__value__'];
              if (method === 'select' && !node.arguments.length) result.selects.push({ table, select: '*', at });
              else if (!values || (method === 'select' && values.some(v => v.includes('__value__')))) unresolved(`${table}.${method} columns`);
              else if (method === 'select') result.selects.push(...values.map(select => ({ table, select, at })));
              else if (method === 'or') {
                for (const value of values) {
                  const cols = [...value.matchAll(/(?:^|[, (])([a-z_][a-z_0-9]*)\.(?:not\.)?(?:eq|neq|is|ilike|like|in|gt|gte|lt|lte)\./g)].map(m => m[1]);
                  if (!cols.length) unresolved(`${table}.or filter`);
                  result.columns.push(...cols.map(column => ({ table, column, at })));
                }
              } else result.columns.push(...values.map(column => ({ table, column, at })));
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  result.tables = [...new Set(result.tables)].sort();
  result.buckets = [...new Set(result.buckets)].sort();
  return result;
}
