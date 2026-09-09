import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the actual TypeScript actions/loaders against an authenticated local
// client. Only Next's request factory/cache invalidation are test adapters.
// Permissions, ownership, validation, audit writes and database RLS are real.
export function coreSource(client, providerFixture = null) {
  const root = process.cwd();
  const nativeRequire = createRequire(import.meta.url);
  const modules = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!file.startsWith(path.join(root, 'src') + path.sep)) throw new Error('Core test source outside repository');
    if (!path.extname(file)) file += '.ts';
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Core test source must not be a symlink');
    if (modules.has(file)) return modules.get(file).exports;
    const loaded = { exports: {} };
    modules.set(file, loaded);
    const require = specifier => {
      if (specifier === 'server-only') return {};
      if (specifier === 'next/cache') return { revalidatePath() {} };
      if (specifier === '@/lib/supabase/server') return { createClient: async () => client };
      if (providerFixture && specifier === '@/lib/ai/contracts/extract') return { extractContractFromPdf: async () => providerFixture };
      if (providerFixture && specifier === '@/lib/ai/contracts/client') return { isContractAiConfigured: () => true };
      // Uploads belong to later phases; fail if core CRUD ever invokes one.
      if (specifier === '@/lib/documents/actions') return { uploadDocument() { throw new Error('Core CRUD unexpectedly uploaded a document'); } };
      if (specifier.startsWith('@/')) return load(path.join(root, 'src', specifier.slice(2)));
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(file), specifier));
      if (['zod', 'react', 'crypto', 'node:crypto', 'node:zlib', 'pizzip', 'docxtemplater'].includes(specifier)) return nativeRequire(specifier);
      throw new Error(`Unreviewed core test dependency: ${specifier}`);
    };
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require, console, Date, URL, Buffer, File, Blob, FormData, DOMException, AbortSignal, setTimeout }, { filename: file });
    return loaded.exports;
  }
  return load;
}
