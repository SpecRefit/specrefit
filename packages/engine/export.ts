import { zipSync, strToU8, type Zippable } from 'fflate';
import { canonical, inspect, limits, object, type Source } from './index.ts';

export interface ExportFile { path: string; text: string }
export interface ExportPlan { entry: string; files: ExportFile[] }
export interface ExportResult { plan?: ExportPlan; diagnostics: string[] }
export interface ExportOutput { entry: string; files: { path: string; bytes: Uint8Array }[] }
export interface Download { name: string; type: string; bytes: Uint8Array }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function safeArchivePath(path: unknown): path is string {
  return typeof path === 'string' && path.length <= 1024 && path.split('/').every(part =>
    !!part && part !== '.' && part !== '..' && part !== '__proto__' && new TextDecoder().decode(new TextEncoder().encode(part)) === part && !/[\\:\u0000-\u001f\u007f<>"|?*]/.test(part) &&
    !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part) && new TextEncoder().encode(part).length <= 255);
}

function validateFiles(files: unknown): files is ExportFile[] {
  if (!Array.isArray(files) || !files.length || files.length > limits.files) return false;
  const paths = new Map<string, string>(), filePaths = new Set<string>();
  let bytes = 0;
  for (const f of files) {
    if (!object(f) || !safeArchivePath(f.path) || typeof f.text !== 'string' || Object.keys(f).some(k => !['path', 'text'].includes(k))) return false;
    const size = strToU8(f.text).length;
    if (size > limits.fileBytes || (bytes += size) > limits.totalBytes) return false;
    const parts = f.path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join('/'), key = path.normalize('NFC').toLowerCase();
      if (paths.has(key) && paths.get(key) !== path || filePaths.has(key)) return false;
      if (i === parts.length && paths.has(key)) return false; // Duplicate file or file/directory collision.
      paths.set(key, path);
      if (i === parts.length) filePaths.add(key);
    }
  }
  return true;
}

/** Plan a portable retained tree without changing any reviewed contract bytes. */
export function prepareExport(entry: string, sources: Source[]): ExportResult {
  const report = inspect({ entry, sources });
  const diagnostics: string[] = [];
  if (report.diagnostics.length) return { diagnostics: ['Resolve inspection diagnostics before exporting. No partial output can be saved.'] };
  const origin = new URL(report.entry).origin;
  const paths = new Map<string, string>();
  try {
    for (const doc of report.documents) {
      const url = new URL(doc.id);
      if (url.origin !== origin) throw new Error('Documents use different URI origins. Select Bundle external references into one file to export them together.');
      const parts = url.pathname.slice(1).split('/').map(decodeURIComponent);
      if (parts.some(p => p.includes('/'))) throw new Error('An encoded path separator is not a portable filename. Select bundling before exporting.');
      paths.set(doc.id, parts.join('/'));
    }
    const files = report.documents.map(d => ({ path: paths.get(d.id)!, text: d.text })).sort((a, b) => compare(a.path, b.path));
    if (!validateFiles(files)) throw new Error('Output paths collide or are not portable filenames. Use bundling, or rename unsafe input files and their references.');
    for (const ref of report.references) {
      const pathPart = ref.uri.split('#')[0];
      if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/)/.test(pathPart)) throw new Error('Absolute reference locations are not portable in a file archive. Select Bundle external references into one file.');
      if (!pathPart) continue;
      if (files.length === 1) throw new Error('A filename-based self-reference could break when saving the single file under another name. Select bundling to make its references internal.');
      const resolved = paths.get(ref.from.document)!.split('/').slice(0, -1);
      for (const part of pathPart.split('/').map(decodeURIComponent)) {
        if (!part || part === '.') continue;
        if (part === '..') { if (!resolved.length) throw new Error('A relative reference would escape the exported folder. Select bundling before exporting.'); resolved.pop(); }
        else resolved.push(part);
      }
      if (!ref.target || resolved.join('/') !== paths.get(ref.target.document)) throw new Error('A reference cannot retain its target in the exported folder. Select bundling before exporting.');
    }
    return { plan: { entry: paths.get(canonical(entry))!, files }, diagnostics };
  } catch (error) { return { diagnostics: [error instanceof Error ? error.message : 'Output could not be planned safely.'] }; }
}

/** Archive already-reviewed bytes, with no transformation or filesystem access. */
function validatePlan(input: unknown): asserts input is ExportPlan {
  if (!object(input) || typeof input.entry !== 'string' || !validateFiles(input.files) || !input.files.some(f => f.path === input.entry) || Object.keys(input).some(k => !['entry', 'files'].includes(k)))
    throw new Error('Invalid or unsafe export plan. Generate a new preview.');
}

export function createOutput(input: unknown): ExportOutput {
  validatePlan(input);
  return { entry: input.entry, files: input.files.map(f => ({ path: f.path, bytes: strToU8(f.text) })) };
}

export function createDownload(input: unknown): Download {
  validatePlan(input);
  if (input.files.length > 1) return { name: 'specrefit-output.zip', type: 'application/zip', bytes: createArchive(input) };
  const file = input.files[0];
  let name = file.path.split('/').at(-1)!;
  if (!/\.(?:json|ya?ml)$/i.test(name)) {
    let extension = 'yaml';
    try { JSON.parse(file.text); extension = 'json'; } catch { /* Validated YAML input. */ }
    name += '.' + extension;
  }
  return { name, type: /\.json$/i.test(name) ? 'application/json' : 'application/yaml', bytes: strToU8(file.text) };
}

export function createArchive(input: unknown): Uint8Array {
  validatePlan(input);
  const files: Zippable = Object.create(null);
  for (const f of [...input.files].sort((a, b) => compare(a.path, b.path))) files[f.path] = strToU8(f.text);
  // fflate writes local calendar fields to DOS timestamps; the fixed fields are timezone-independent.
  return zipSync(files, { level: 6, mtime: new Date(1980, 0, 1, 0, 0, 0), os: 0, attrs: 0 });
}
