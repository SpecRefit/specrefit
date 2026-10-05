import { open, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { canonical, inspect, limits, type Source, type Diagnostic } from '../engine/index.ts';

interface Selection { id: string; path: string }
const contained = (root: string, file: string) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

/** Desktop input adapter. Only the shared engine discovers reference semantics. */
export async function importLocalReferences(input: { entry: string; sources: Source[] }, selections: Selection[]) {
  if (!input || !Array.isArray(input.sources) || input.sources.length > limits.files ||
      !Array.isArray(selections) || selections.length > limits.files) throw new Error('Invalid local input selection.');
  const initial = inspect(input);
  if (initial.diagnostics.some(d => ['INPUT', 'LOCATION', 'LIMIT', 'DUPLICATE_DOCUMENT'].includes(d.code)))
    throw new Error('The selected documents exceed input limits or have invalid locations.');
  const sources = input.sources.map(s => ({ id: canonical(s.id), text: s.text }));
  let bytes = sources.reduce((sum, source) => sum + Buffer.byteLength(source.text), 0);
  const locations = new Map<string, { file: string; root: string }>();
  for (const selection of selections) {
    if (!selection || typeof selection.path !== 'string' || !path.isAbsolute(selection.path) || selection.path.length > 32768 ||
        typeof selection.id !== 'string' || !sources.some(s => s.id === canonical(selection.id))) throw new Error('Invalid local input selection.');
    const file = await realpath(selection.path);
    if (!(await stat(file)).isFile()) throw new Error('Select regular input files.');
    const root = await realpath(path.dirname(selection.path));
    locations.set(canonical(selection.id), { file: path.join(root, path.basename(selection.path)), root });
  }
  const paths: string[] = [];
  const identities: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const attempted = new Set<string>();
  let report = initial;
  while (true) {
    let added = false;
    for (const reference of report.references) {
      const source = locations.get(reference.from.document);
      if (!source || !reference.missing || sources.some(s => s.id === reference.missing)) continue;
      const key = `${reference.from.document}\n${reference.missing}`;
      if (attempted.has(key)) continue;
      attempted.add(key);
      // Network, absolute paths and file: URIs never grant local filesystem access.
      if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(reference.uri)) continue;
      try {
        const segments = reference.uri.split('#')[0].split('/').map(segment => decodeURIComponent(segment));
        if (segments.some(segment => /[\\/<>:"|?*\u0000-\u001f]/.test(segment) || /[. ]$/.test(segment) && segment !== '.' && segment !== '..' || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)))
          throw new Error('The reference has an unsafe local filename.');
        const candidate = path.resolve(path.dirname(source.file), ...segments);
        if (!contained(source.root, candidate)) throw new Error('The reference is outside the selected file’s folder. Select that file explicitly in Diagnostics.');
        const resolved = await realpath(candidate);
        if (!contained(source.root, resolved)) throw new Error('The reference follows a link outside the selected file’s folder. Select that file explicitly in Diagnostics.');
        const before = await stat(resolved, { bigint: true });
        if (!before.isFile()) throw new Error('The reference is not a regular file.');
        if (sources.length >= limits.files || before.size > BigInt(limits.fileBytes) || bytes + Number(before.size) > limits.totalBytes)
          throw new Error('Local references exceed the 64-file, 20 MB per-file or 40 MB total input limit.');
        const handle = await open(resolved, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
        let content: Buffer;
        try {
          const opened = await handle.stat({ bigint: true });
          if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || await realpath(resolved) !== resolved) throw new Error('The reference changed while opening it. Open the contract again.');
          content = Buffer.alloc(Number(before.size) + 1);
          let count = 0;
          while (count < content.length) {
            const read = await handle.read(content, count, content.length - count, count);
            if (!read.bytesRead) break;
            count += read.bytesRead;
          }
          const after = await handle.stat({ bigint: true });
          if (count !== Number(before.size) || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || await realpath(candidate) !== resolved)
            throw new Error('The reference changed while reading it. Open the contract again.');
          content = content.subarray(0, count);
        } finally { await handle.close(); }
        // Match File.text() in the shared picker, including removal of a UTF-8 BOM.
        const text = new TextDecoder().decode(content);
        if (Buffer.byteLength(text) > limits.fileBytes || bytes + Buffer.byteLength(text) > limits.totalBytes) throw new Error('Decoded local references exceed the input byte limit.');
        sources.push({ id: reference.missing, text }); bytes += Buffer.byteLength(text);
        locations.set(reference.missing, { file: candidate, root: source.root });
        identities.push(`${before.dev}:${before.ino}`);
        paths.push(candidate, resolved); added = true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message = code === 'ENOENT' ? 'The local reference file was not found. Select it explicitly in Diagnostics.' :
          code ? 'The local reference could not be read. Check permissions or select it explicitly in Diagnostics.' :
          error instanceof Error ? error.message : 'The local reference could not be read.';
        if (diagnostics.length < 500) diagnostics.push({ code: 'LOCAL_REFERENCE', severity: 'warning', message, location: reference.from });
      }
    }
    if (!added) break;
    report = inspect({ entry: input.entry, sources });
  }
  return { sources, paths: [...new Set(paths)], identities, diagnostics };
}
