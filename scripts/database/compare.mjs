export function splitSelect(value) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (depth < 0) throw new Error(`Malformed select: ${value}`);
    if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  if (depth) throw new Error(`Malformed select: ${value}`);
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

export function compareContract(contract, catalog) {
  const errors = [];
  const tables = new Map();
  for (const column of catalog.columns) {
    if (!tables.has(column.table_name)) tables.set(column.table_name, new Map());
    tables.get(column.table_name).set(column.column_name, column);
  }
  const error = (kind, message, at) => errors.push({ kind, message, at });
  function column(table, name, at) {
    name = name.split('->')[0].split('::')[0];
    if (!tables.get(table)?.has(name)) error('column', `${table}.${name}`, at);
  }
  function selection(table, value, at) {
    for (const part of splitSelect(value)) {
      if (part === '*') continue;
      const open = part.indexOf('(');
      if (open === -1) { column(table, part.split(':').at(-1), at); continue; }
      const relation = part.slice(0, open).trim().split(':').at(-1);
      const [name, ...hints] = relation.split('!');
      const hint = hints.find(h => h !== 'inner' && h !== 'left');
      const candidates = catalog.foreignKeys.flatMap(f => {
        if (!f.validated) return [];
        if (hint && hint !== f.name && !f.columns.includes(hint)) return [];
        if (f.source === table && (f.target === name || f.name === name || f.columns.includes(name))) return [{ fk: f, target: f.target }];
        if (f.target === table && f.source === name) return [{ fk: f, target: f.source }];
        return [];
      });
      if (candidates.length !== 1) error('relationship', `${table} -> ${relation}: ${candidates.length} matching foreign keys`, at);
      else selection(candidates[0].target, part.slice(open + 1, -1), at);
    }
  }
  for (const table of contract.tables) if (!tables.has(table)) error('table', table);
  for (const item of contract.columns) column(item.table, item.column, item.at);
  for (const item of contract.selects) selection(item.table, item.select, item.at);
  for (const rpc of contract.rpcs) {
    const matches = catalog.functions.filter(f => f.name === rpc.name && rpc.args.every(a => f.args.includes(a)) && f.args.slice(0, f.required).every(a => rpc.args.includes(a)));
    if (matches.length !== 1) error('rpc', `${rpc.name}(${rpc.args.join(',')}): ${matches.length} matching signatures`, rpc.at);
  }
  for (const bucket of contract.buckets) if (!catalog.buckets.includes(bucket)) error('bucket', bucket);
  for (const write of contract.writes) {
    for (const c of tables.get(write.table)?.values() ?? []) {
      // This insert trigger is separately exercised by schema-smoke.sql.
      if (write.table === 'business_cases' && c.column_name === 'number' && write.keys.includes('case_number')) continue;
      if (!c.nullable && c.default_value === null && !write.keys.includes(c.column_name)) error('required insert column', `${write.table}.${c.column_name}`, write.at);
    }
  }
  for (const item of contract.unresolved) error('unresolved source', item.kind, item.at);
  return [...new Map(errors.map(e => [`${e.kind}:${e.message}:${e.at}`, e])).values()];
}
