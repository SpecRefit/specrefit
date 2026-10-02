import { isScalar, LineCounter, parseDocument, visit } from 'yaml';
import { visit as visitJSON, type JSONPath } from 'jsonc-parser';

export type Value = null | boolean | number | string | Value[] | { [key: string]: Value };
export type ObjectValue = { [key: string]: Value };
export interface Source { id: string; text: string }
export interface Location { document: string; pointer: string; line: number; column: number }
export interface Diagnostic { code: string; severity: 'error' | 'warning'; message: string; location: Location }
export interface Reference { from: Location; uri: string; target?: Location; missing?: string; schema?: boolean; role?: Role }
export interface Item { location: Location; value: Value; schema?: boolean }
export interface Operation {
  location: Location; method: string; path: string; kind: string; tags: string[];
  summary: string; description: string; deprecated: boolean; parameters: Item[];
  requestBody?: Item; responses: { status: string; item: Item }[];
  security: Value; securitySchemes: Item; servers: Value; raw: Value;
}
export interface Inspection {
  entry: string; version: string; title: string; description: string;
  documents: { id: string; text: string; value?: Value }[];
  operations: Operation[]; schemas: { name: string; item: Item }[];
  references: Reference[]; diagnostics: Diagnostic[];
  locations: Location[];
  schemaLocations: Location[];
  contexts: { location: Location; role: Role }[];
}
export const limits = { files: 64, fileBytes: 20_000_000, totalBytes: 40_000_000, nodes: 1_000_000, depth: 80 };
export const object = (v: unknown): v is ObjectValue => v !== null && typeof v === 'object' && !Array.isArray(v);
export const string = (v: unknown): string => typeof v === 'string' ? v : '';
const own = (v: object, key: string) => Object.hasOwn(v, key);
export const escapePointer = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
export const child = (p: string, key: string | number) => `${p}/${escapePointer(String(key))}`;
export function valueAt(value: Value | undefined, pointer: string): Value | undefined {
  if (!pointer) return value;
  if (!pointer.startsWith('/')) return undefined;
  for (const key of pointer.slice(1).split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (value === null || typeof value !== 'object' || !own(value, key)) return undefined;
    value = (value as ObjectValue)[key];
  }
  return value;
}
const base = 'https://project.invalid/';
export function canonical(id: string, relativeTo = base): string {
  if (/[\\\u0000-\u0020]/.test(id)) throw new Error('Use a URI with forward slashes and percent-encoded spaces.');
  const url = new URL(id, relativeTo);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Use a document path or HTTP(S) URI without credentials, query or fragment.');
  return url.href;
}
export function displayId(id: string): string { return id.startsWith(base) ? id.slice(base.length) : id; }

type Role = 'root' | 'path' | 'operation' | 'parameter' | 'body' | 'response' | 'media' | 'schema' | 'callback' | 'example' | 'header' | 'security' | 'link' | 'encoding';
interface Parsed { source: Source; value?: Value; ast?: ReturnType<typeof parseDocument>; lines: LineCounter; positions?: Map<string, { line: number; column: number }> }

/** Pure in-memory inspection. No filesystem, network, browser or Electron APIs. */
export function inspect(input: unknown): Inspection {
  const result: Inspection = { entry: '', version: '', title: 'Contract', description: '', documents: [], operations: [], schemas: [], references: [], diagnostics: [], locations: [], schemaLocations: [], contexts: [] };
  const docs = new Map<string, Parsed>();
  function location(document: string, pointer = ''): Location {
    const d = docs.get(document);
    if (d?.positions) {
      let parent = pointer;
      while (!d.positions.has(parent) && parent) parent = parent.slice(0, parent.lastIndexOf('/'));
      return { document, pointer, ...d.positions.get(parent) ?? { line: 1, column: 1 } };
    }
    const keys = pointer ? pointer.slice(1).split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~')) : [];
    let node = d?.ast?.getIn(keys, true) as { range?: number[] } | undefined;
    while (!node && keys.length) { keys.pop(); node = d?.ast?.getIn(keys, true) as { range?: number[] } | undefined; }
    const pos = d?.lines.linePos(node?.range?.[0] ?? 0);
    return { document, pointer, line: pos?.line ?? 1, column: pos?.col ?? 1 };
  }
  function diagnostic(code: string, message: string, document = result.entry, pointer = '', severity: 'error' | 'warning' = 'error') {
    if (result.diagnostics.length < 500) result.diagnostics.push({ code, message, severity, location: location(document, pointer) });
  }
  if (!object(input) || typeof input.entry !== 'string' || !Array.isArray(input.sources)) {
    diagnostic('INPUT', 'Supply an entry location and an array of documents.'); return result;
  }
  try { result.entry = canonical(input.entry); } catch { diagnostic('LOCATION', 'The entry document location is invalid.'); return result; }
  if (input.sources.length > limits.files) { diagnostic('LIMIT', `At most ${limits.files} documents may be opened at once.`); return result; }
  let bytes = 0;
  for (const candidate of input.sources) {
    if (!object(candidate) || typeof candidate.id !== 'string' || typeof candidate.text !== 'string') {
      diagnostic('INPUT', 'Each document needs a location and text.'); continue;
    }
    let id: string;
    try { id = canonical(candidate.id); } catch { diagnostic('LOCATION', 'A document location is invalid. Use a relative path or an HTTP(S) URI without credentials.'); continue; }
    if (docs.has(id)) { diagnostic('DUPLICATE_DOCUMENT', 'Two supplied files have the same location. Supply distinct paths; no file was substituted.', id); continue; }
    const count = new TextEncoder().encode(candidate.text).length;
    bytes += count;
    if (count > limits.fileBytes || bytes > limits.totalBytes) { diagnostic('LIMIT', 'Input exceeds the 20 MB per document or 40 MB project limit.', id); continue; }
    const d: Parsed = { source: { id, text: candidate.text }, lines: new LineCounter() };
    docs.set(id, d);
    try {
      let value: unknown;
      if (/\.json$/i.test(new URL(id).pathname)) {
        // Stream positions instead of allocating a YAML syntax tree for large JSON files.
        d.positions = new Map();
        let count = 0;
        const keys: Set<string>[] = [];
        const position = (_offset: number, _length: number, line: number, column: number, path: () => JSONPath) => {
          const parts = path();
          if (++count > limits.nodes || parts.length > limits.depth) throw new Error('limit');
          d.positions!.set(parts.length ? '/' + parts.map(p => escapePointer(String(p))).join('/') : '', { line: line + 1, column: column + 1 });
        };
        visitJSON(candidate.text, {
          onObjectBegin: (...args) => { position(...args); keys.push(new Set()); },
          onObjectEnd: () => { keys.pop(); },
          onArrayBegin: position,
          onLiteralValue: (_value, ...args) => position(...args),
          onObjectProperty: (key, _offset, _length, line, column) => {
            if (keys.at(-1)!.has(key)) {
              result.diagnostics.push({ code: 'SYNTAX', severity: 'error', message: 'Duplicate JSON property. Give each property a unique name; this file is not interpreted.', location: { document: id, pointer: '', line: line + 1, column: column + 1 } });
              throw new Error('duplicate');
            }
            keys.at(-1)!.add(key);
          },
          onError: (_error, _offset, _length, line, column) => {
            result.diagnostics.push({ code: 'SYNTAX', severity: 'error', message: 'Invalid JSON syntax. Check this source location; comments and trailing commas are not allowed.', location: { document: id, pointer: '', line: line + 1, column: column + 1 } });
            throw new Error('syntax');
          },
        }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
        value = JSON.parse(candidate.text);
      } else {
        d.ast = parseDocument(candidate.text, { lineCounter: d.lines, keepSourceTokens: true, uniqueKeys: true, strict: true });
        if (d.ast.errors.length) {
          for (const error of d.ast.errors) {
            const pos = d.lines.linePos(error.pos[0]);
            result.diagnostics.push({ code: 'SYNTAX', severity: 'error', message: 'Invalid or ambiguous document syntax. Check this source location; this file is not interpreted.', location: { document: id, pointer: '', line: pos.line, column: pos.col } });
          }
          continue;
        }
        for (const warning of d.ast.warnings) diagnostic('YAML_CONSTRUCT', `YAML construct ${warning.code} is not interpreted reliably; this file is available as source only.`, id);
        if (d.ast.warnings.length) continue;
        visit(d.ast, { Pair(_key, pair) {
          if (!isScalar(pair.key) || typeof pair.key.value !== 'string') throw new Error('Non-string mapping key');
        } });
        value = d.ast.toJS({ maxAliasCount: 0 });
      }
      let nodes = 0;
      const check = (v: unknown, depth: number): void => {
        if (++nodes > limits.nodes || depth > limits.depth) throw new Error('limit');
        if (typeof v === 'number' && (!Number.isFinite(v) || Number.isInteger(v) && !Number.isSafeInteger(v))) throw new Error('value');
        if (v !== null && typeof v === 'object') for (const value of Object.values(v)) check(value, depth + 1);
        else if (!['string', 'number', 'boolean'].includes(typeof v) && v !== null) throw new Error('value');
      };
      check(value, 0);
      d.value = value as Value;
    } catch {
      diagnostic('PARSE', 'This document could not be interpreted safely. Check syntax, aliases, nesting, non-string mapping keys and numbers outside the safe numeric range. Quote response status keys. YAML aliases are currently unsupported. Source text remains available.', id);
    }
  }
  result.documents = [...docs].map(([id, d]) => ({ id, text: d.source.text, value: d.value }));
  const root = docs.get(result.entry)?.value;
  if (!object(root)) { diagnostic('ROOT', 'Choose a supplied OpenAPI document with an object at its root.'); return result; }
  const contract: ObjectValue = root;
  result.version = string(root.openapi);
  result.title = object(root.info) ? string(root.info.title) || 'Untitled contract' : 'Untitled contract';
  result.description = object(root.info) ? string(root.info.description) : '';
  const family = /^3\.([012])\.\d+$/.exec(result.version)?.[1];
  if (family === undefined) { diagnostic('VERSION', 'Only OpenAPI 3.0, 3.1 and 3.2 can be interpreted. Source documents are still available.'); return result; }
  if (!object(root.info) || !string(root.info.title) || !string(root.info.version)) diagnostic('INFO', 'info.title and info.version must be strings. Correct the contract metadata.', result.entry, '/info');
  const get = (loc: Location) => valueAt(docs.get(loc.document)?.value, loc.pointer);
  const item = (loc: Location): Item => ({ location: loc, value: get(loc) ?? null });
  const refMap = new Map<string, Reference>();
  const key = (loc: Location) => `${loc.document}#${loc.pointer}`;
  function resolve(from: Location, uri: string): Reference {
    const cache = refMap.get(key(from)); if (cache) return cache;
    const edge: Reference = { from, uri }; refMap.set(key(from), edge); result.references.push(edge);
    try {
      const full = new URL(uri, from.document);
      const fragment = decodeURIComponent(full.hash.slice(1)); full.hash = '';
      const targetId = canonical(full.href);
      const targetRoot = docs.get(targetId)?.value;
      if (object(targetRoot) && typeof targetRoot.openapi === 'string' && !targetRoot.openapi.startsWith(`3.${family}.`)) {
        diagnostic('REFERENCE_VERSION', 'The referenced OpenAPI document declares a different version family. Cross-version interpretation is not supported; inspect its source separately.', from.document, from.pointer); return edge;
      }
      if (!docs.has(targetId)) {
        edge.missing = targetId;
        diagnostic('MISSING_REFERENCE', `Supply the referenced document at ${displayId(targetId)}. It is never fetched automatically.`, from.document, from.pointer);
      } else if (fragment && !fragment.startsWith('/')) {
        diagnostic('SCHEMA_ANCHOR', 'Named schema anchors are retained but not resolved yet. Inspect the source; no target is guessed.', from.document, from.pointer, 'warning');
      } else if (/~(?![01])/.test(fragment)) {
        diagnostic('POINTER', 'The reference contains an invalid JSON Pointer escape.', from.document, from.pointer);
      } else {
        const target = location(targetId, fragment);
        if (get(target) === undefined) diagnostic('MISSING_TARGET', 'The document is available but the reference target is missing or cannot be parsed. Check the fragment and document diagnostics.', from.document, from.pointer);
        else edge.target = target;
      }
    } catch { diagnostic('REFERENCE_URI', 'The reference URI is invalid or contains unsupported credentials, query parameters or scheme.', from.document, from.pointer); }
    return edge;
  }
  const visited = new Set<string>();
  function scan(loc: Location, role: Role, depth = 0, uncertainBase = false): void {
    const visitKey = `${key(loc)}:${role}:${uncertainBase}`;
    if (visited.has(visitKey)) return; visited.add(visitKey);
    if (depth > limits.depth || visited.size > limits.nodes) { diagnostic('LIMIT', 'Reference traversal reached its safety limit. Inspection is partial.', loc.document, loc.pointer); return; }
    result.locations.push(loc);
    result.contexts.push({ location: loc, role });
    if (role === 'schema') result.schemaLocations.push(loc);
    const v = get(loc);
    if (role === 'schema' && typeof v === 'boolean') {
      if (family === '0' && !loc.pointer.endsWith('/additionalProperties')) diagnostic('SCHEMA_VERSION', 'Boolean schemas are not part of OpenAPI 3.0.', loc.document, loc.pointer);
      return;
    }
    if (!object(v)) { diagnostic('OBJECT', `Expected a ${role} object. This value remains available in the source.`, loc.document, loc.pointer); return; }
    const at = (k: string | number) => location(loc.document, child(loc.pointer, k));
    const field = (name: string, next: Role) => { if (own(v, name)) scan(at(name), next, depth + 1, uncertainBase); };
    const map = (name: string, next: Role) => {
      if (!own(v, name)) return;
      if (!object(v[name])) { diagnostic('OBJECT', `${name} must be an object.`, loc.document, child(loc.pointer, name)); return; }
      for (const k of Object.keys(v[name])) {
        if (['paths', 'responses', 'content'].includes(name) && k.startsWith('x-')) continue;
        scan(location(loc.document, child(child(loc.pointer, name), k)), next, depth + 1, uncertainBase);
      }
    };
    const array = (name: string, next: Role) => {
      if (!own(v, name)) return;
      if (!Array.isArray(v[name])) { diagnostic('ARRAY', `${name} must be an array.`, loc.document, child(loc.pointer, name)); return; }
      v[name].forEach((_, i) => scan(location(loc.document, child(child(loc.pointer, name), i)), next, depth + 1, uncertainBase));
    };
    if (role === 'schema') {
      const tokens = loc.pointer.split('/').slice(1);
      for (let count = 0; count < tokens.length; count++) {
        const ancestor = valueAt(docs.get(loc.document)?.value, count ? `/${tokens.slice(0, count).join('/')}` : '');
        if (object(ancestor) && own(ancestor, '$id')) uncertainBase = true;
      }
      if (own(v, '$id') || own(v, '$schema')) {
        if (own(v, '$id')) uncertainBase = true;
        diagnostic('SCHEMA_DIALECT', 'Schema resource identifiers and custom dialects are retained but not evaluated. References under $id are not resolved because their base may differ.', loc.document, loc.pointer, 'warning');
      }
      for (const name of ['$dynamicRef', '$recursiveRef']) if (own(v, name)) diagnostic('DYNAMIC_REFERENCE', `${name} needs dynamic scope evaluation. Inspect the source; no static target is guessed.`, loc.document, child(loc.pointer, name), 'warning');
      if (family === '0' && (Array.isArray(v.type) || own(v, '$defs'))) diagnostic('SCHEMA_VERSION', 'This JSON Schema construct is not supported by the OpenAPI 3.0 schema dialect.', loc.document, loc.pointer);
    }
    if (own(v, '$ref')) {
      if (role === 'operation' || role === 'encoding' || role === 'media' && family !== '2') {
        diagnostic('REFERENCE_CONTEXT', `$ref is not supported in this ${role} position for OpenAPI ${result.version}. The original fields remain available.`, loc.document, child(loc.pointer, '$ref')); return;
      }
      if (typeof v.$ref !== 'string') diagnostic('REFERENCE_TYPE', '$ref must be a string.', loc.document, child(loc.pointer, '$ref'));
      else if (!uncertainBase) {
        const edge = resolve(at('$ref'), v.$ref);
        edge.schema = role === 'schema';
        edge.role = role;
        if (edge.target) scan(edge.target, role, depth + 1);
      } else diagnostic('SCHEMA_BASE', 'This reference is not resolved because an enclosing $id changes its base URI.', loc.document, child(loc.pointer, '$ref'), 'warning');
      if (role !== 'schema' && role !== 'path' || role === 'schema' && family === '0') return;
      if (role === 'path' && Object.keys(v).some(k => k !== '$ref' && !k.startsWith('x-'))) diagnostic('PATH_REFERENCE_SIBLINGS', 'Path item $ref siblings have ambiguous combination semantics. Referenced content is shown; siblings remain in the source and are not combined.', loc.document, loc.pointer, 'warning');
    }
    switch (role) {
      case 'root': {
        map('paths', 'path');
        if (family !== '0') map('webhooks', 'path');
        else if (own(v, 'webhooks')) diagnostic('VERSION_FIELD', 'webhooks requires OpenAPI 3.1 or later.', loc.document, child(loc.pointer, 'webhooks'));
        if (object(v.components)) for (const [name, next] of Object.entries({ schemas: 'schema', parameters: 'parameter', requestBodies: 'body', responses: 'response', headers: 'header', securitySchemes: 'security', callbacks: 'callback', examples: 'example', links: 'link', pathItems: 'path', mediaTypes: 'media' })) {
          const entries = v.components[name];
          if (object(entries)) for (const n of Object.keys(entries)) scan(location(loc.document, child(`/components/${name}`, n)), next as Role, depth + 1);
        }
        break;
      }
      case 'path':
        for (const method of ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', ...(family === '2' ? ['query'] : [])]) field(method, 'operation');
        if (family === '2') map('additionalOperations', 'operation');
        else for (const name of ['query', 'additionalOperations']) if (own(v, name)) diagnostic('VERSION_FIELD', `${name} requires OpenAPI 3.2.`, loc.document, child(loc.pointer, name));
        array('parameters', 'parameter'); break;
      case 'operation': array('parameters', 'parameter'); field('requestBody', 'body'); map('responses', 'response'); map('callbacks', 'callback'); break;
      case 'body': case 'response': map('content', 'media'); if (role === 'response') { map('headers', 'header'); map('links', 'link'); } break;
      case 'parameter': case 'header': field('schema', 'schema'); map('content', 'media'); map('examples', 'example'); break;
      case 'media':
        field('schema', 'schema'); field('itemSchema', 'schema'); map('examples', 'example'); map('encoding', 'encoding');
        if (family === '2') { field('itemEncoding', 'encoding'); array('prefixEncoding', 'encoding'); }
        else for (const name of ['itemEncoding', 'prefixEncoding']) if (own(v, name)) diagnostic('VERSION_FIELD', `${name} requires OpenAPI 3.2.`, loc.document, child(loc.pointer, name));
        break;
      case 'encoding':
        map('headers', 'header');
        if (family === '2') { map('encoding', 'encoding'); field('itemEncoding', 'encoding'); array('prefixEncoding', 'encoding'); }
        else for (const name of ['encoding', 'itemEncoding', 'prefixEncoding']) if (own(v, name)) diagnostic('VERSION_FIELD', `${name} requires OpenAPI 3.2.`, loc.document, child(loc.pointer, name));
        break;
      case 'schema':
        for (const name of ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']) map(name, 'schema');
        for (const name of ['items', 'additionalProperties', 'unevaluatedProperties', 'unevaluatedItems', 'contains', 'not', 'if', 'then', 'else', 'propertyNames', 'contentSchema']) field(name, 'schema');
        for (const name of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) array(name, 'schema');
        break;
      case 'callback': for (const n of Object.keys(v)) if (!n.startsWith('x-') && n !== '$ref') scan(at(n), 'path', depth + 1); break;
    }
  }
  scan(location(result.entry), 'root');
  function dereference(loc: Location, chain = new Set<string>()): Item {
    const raw = item(loc);
    if (!object(raw.value) || typeof raw.value.$ref !== 'string') return raw;
    if (chain.has(key(loc)) || chain.size > limits.depth) { diagnostic('REFERENCE_CYCLE', 'This reference chain cycles or exceeds the safe depth before reaching a concrete object. Inspect its source.', loc.document, loc.pointer); return raw; }
    chain.add(key(loc));
    const edge = refMap.get(key(location(loc.document, child(loc.pointer, '$ref'))));
    if (!edge?.target) return raw;
    const resolved = dereference(edge.target, chain);
    if (family !== '0' && object(resolved.value)) {
      const value = { ...resolved.value };
      for (const n of ['summary', 'description']) if (own(raw.value, n)) value[n] = raw.value[n];
      return { ...resolved, value };
    }
    return resolved;
  }
  function parameters(loc: Location, owner: ObjectValue): Item[] {
    if (!Array.isArray(owner.parameters)) return [];
    const seen = new Set<string>();
    return owner.parameters.map((_, i) => dereference(location(loc.document, child(child(loc.pointer, 'parameters'), i)))).filter(p => {
      const v = p.value;
      if (!object(v) || !string(v.name) || !['query', 'header', 'path', 'cookie', ...(family === '2' ? ['querystring'] : [])].includes(string(v.in))) {
        diagnostic('PARAMETER', 'Parameter name or location is missing/invalid, or its reference is unresolved.', p.location.document, p.location.pointer); return true;
      }
      const id = `${v.in}:${v.name}`;
      if (seen.has(id)) diagnostic('DUPLICATE_PARAMETER', 'Duplicate parameter name and location in this parameter list; no unambiguous value can be selected.', p.location.document, p.location.pointer);
      seen.add(id);
      if (v.in === 'path' && v.required !== true) diagnostic('PATH_PARAMETER', 'Path parameters must declare required: true.', p.location.document, p.location.pointer);
      if (own(v, 'schema') === own(v, 'content')) diagnostic('PARAMETER_SHAPE', 'Declare exactly one of schema or content for this parameter.', p.location.document, p.location.pointer);
      if (v.in === 'querystring' && !object(v.content)) diagnostic('QUERYSTRING', 'A querystring parameter requires content, not schema.', p.location.document, p.location.pointer);
      if (v.in === 'header' && ['accept', 'content-type', 'authorization'].includes(string(v.name).toLowerCase())) {
        diagnostic('IGNORED_HEADER', 'OpenAPI ignores this special header parameter. It remains in the source but is not an effective operation parameter.', p.location.document, p.location.pointer, 'warning'); return false;
      }
      return true;
    });
  }
  const operationVisits = new Set<string>();
  function pathItem(start: Location, path: string, kind: string, depth = 0) {
    if (depth > 20) { diagnostic('LIMIT', 'Nested callbacks exceeded the inspection depth.', start.document, start.pointer); return; }
    const pi = dereference(start); if (!object(pi.value)) return;
    const id = `${key(pi.location)}:${path}:${kind}`;
    if (operationVisits.has(id)) return; operationVisits.add(id);
    const p = pi.value;
    const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', ...(family === '2' ? ['query'] : [])];
    const candidates = methods.filter(m => own(p, m)).map(m => ({ method: m.toUpperCase(), loc: location(pi.location.document, child(pi.location.pointer, m)) }));
    if (family === '2' && object(p.additionalOperations)) for (const m of Object.keys(p.additionalOperations)) {
      const loc = location(pi.location.document, child(child(pi.location.pointer, 'additionalOperations'), m));
      if (methods.map(m => m.toUpperCase()).includes(m)) diagnostic('METHOD_DUPLICATE', 'This method belongs in its fixed path item field, not additionalOperations.', loc.document, loc.pointer);
      else candidates.push({ method: m, loc });
    }
    for (const { method, loc } of candidates) {
      const op = get(loc); if (!object(op)) continue;
      const inherited = parameters(pi.location, p), local = parameters(loc, op);
      const overridden = new Set(local.filter(p => object(p.value)).map(p => `${(p.value as ObjectValue).in}:${(p.value as ObjectValue).name}`));
      const effective = [...inherited.filter(p => !object(p.value) || !overridden.has(`${p.value.in}:${p.value.name}`)), ...local];
      const querystrings = effective.filter(p => object(p.value) && p.value.in === 'querystring');
      if (querystrings.length > 1 || querystrings.length && effective.some(p => object(p.value) && p.value.in === 'query')) diagnostic('QUERYSTRING_CONFLICT', 'Use one querystring parameter or individual query parameters, not both.', loc.document, child(loc.pointer, 'parameters'));
      const responses = object(op.responses) ? Object.keys(op.responses).filter(s => !s.startsWith('x-')).map(status => ({ status, item: dereference(location(loc.document, child(child(loc.pointer, 'responses'), status))) })) : [];
      if (!responses.length) diagnostic('RESPONSES', 'No response definitions are available for this operation.', loc.document, child(loc.pointer, 'responses'), 'warning');
      const security = own(op, 'security') ? op.security : contract.security ?? [];
      if (!Array.isArray(security) || security.some(s => !object(s) || Object.values(s).some(v => !Array.isArray(v) || v.some(x => typeof x !== 'string')))) diagnostic('SECURITY', 'Security must be an array of requirement objects with scope arrays. Inspect the original value.', loc.document, child(loc.pointer, 'security'));
      const securityLocation = own(op, 'security') ? location(loc.document, child(loc.pointer, 'security')) : location(result.entry, '/security');
      if (Array.isArray(security)) for (const requirement of security) if (object(requirement)) for (const scheme of Object.keys(requirement)) {
        const schemes = object(contract.components) && object(contract.components.securitySchemes) ? contract.components.securitySchemes : {};
        if (!own(schemes, scheme)) diagnostic('SECURITY_SCHEME', 'A security requirement does not match a local security scheme. URI-based scheme names are not resolved in this viewer; inspect the source.', securityLocation.document, securityLocation.pointer);
      }
      const tags = Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === 'string') : [];
      result.operations.push({
        location: loc, method, path, kind, tags: tags.length ? tags : ['Untagged'],
        summary: string(op.summary) || string(op.operationId), description: string(op.description) || string(p.description),
        deprecated: op.deprecated === true, parameters: effective,
        requestBody: own(op, 'requestBody') ? dereference(location(loc.document, child(loc.pointer, 'requestBody'))) : undefined,
        responses, security, securitySchemes: item(location(result.entry, '/components/securitySchemes')),
        servers: op.servers ?? p.servers ?? contract.servers ?? [{ url: '/' }], raw: op,
      });
      if (object(op.callbacks)) for (const callback of Object.keys(op.callbacks)) {
        const cb = dereference(location(loc.document, child(child(loc.pointer, 'callbacks'), callback)));
        if (object(cb.value)) for (const expression of Object.keys(cb.value)) if (!expression.startsWith('x-') && expression !== '$ref') pathItem(location(cb.location.document, child(cb.location.pointer, expression)), expression, `Callback: ${callback}`, depth + 1);
      }
    }
  }
  for (const section of ['paths', ...(family !== '0' ? ['webhooks'] : [])]) if (object(root[section])) {
    for (const path of Object.keys(root[section])) if (!path.startsWith('x-')) pathItem(location(result.entry, child(`/${section}`, path)), path, section === 'paths' ? 'Endpoint' : 'Webhook');
  }
  if (object(root.components) && object(root.components.schemas)) for (const name of Object.keys(root.components.schemas)) result.schemas.push({ name, item: { ...item(location(result.entry, child('/components/schemas', name))), schema: true } });
  return result;
}
