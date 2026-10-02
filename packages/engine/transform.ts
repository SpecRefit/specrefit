import { isMap, isScalar, parseDocument } from 'yaml';
import { canonical, child, inspect, object, valueAt, type Operation, type Source, type Value } from './index.ts';
import { bundle, type Output } from './bundle.ts';

export interface Target { document: string; pointer: string }
interface BaseRule { id: string; target: Target; onMissing: 'error' | 'warning' }
export interface MediaRule extends BaseRule { kind: 'select-media'; keep: string[]; expectedTypes: string[] }
export interface ExtractRule extends BaseRule { kind: 'extract-schema'; name: string; expected: Value }
export type Rule = MediaRule | ExtractRule;
export interface Configuration { version: 1; rules: Rule[]; output?: Output }
export interface Change { rule: string; status: 'changed' | 'already-applied' | 'unchanged' | 'warning' | 'error'; message: string; target: Target }
export interface Preview { files: Source[]; changes: Change[]; diagnostics: string[]; configuration?: Configuration }
const tokens = (pointer: string) => pointer.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
const under = (p: string, parent: string) => p === parent || p.startsWith(parent + '/');
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};
const words = (s: string) => s.match(/[A-Za-z0-9]+/g)?.map(s => s[0].toUpperCase() + s.slice(1)).join('') || 'Model';
export function suggestSchemaName(op: Operation, pointer: string): string {
  const base = words(object(op.raw) && typeof op.raw.operationId === 'string' ? op.raw.operationId : `${op.method.toLowerCase()} ${op.path}`);
  const tail = tokens(pointer.slice(op.location.pointer.length));
  const response = tail.indexOf('responses');
  const suffix = response >= 0 ? `Response${words(tail[response + 1])}` : tail.includes('requestBody') ? 'Request' : 'Parameter';
  const nested = tail.flatMap((s, i) => s === 'properties' ? [words(tail[i + 1])] : s === 'items' ? ['Item'] : []);
  return ((/^[A-Za-z]/.test(base) ? '' : 'Model') + base + suffix + nested.join('')).slice(0, 120);
}
function validate(config: unknown): config is Configuration {
  if (!object(config) || config.version !== 1 || !Array.isArray(config.rules) || config.rules.length > 128 || Object.keys(config).some(k => !['version', 'rules', 'output'].includes(k))) return false;
  if (config.output !== undefined && (!object(config.output) || typeof config.output.bundle !== 'boolean' || typeof config.output.format !== 'string' || !['yaml', 'json'].includes(config.output.format) || Object.keys(config.output).some(k => !['bundle', 'format'].includes(k)))) return false;
  const ids = new Set<string>();
  return config.rules.every(r => {
    if (!object(r) || typeof r.id !== 'string' || !r.id || r.id.length > 160 || ids.has(r.id) || !object(r.target) ||
        typeof r.target.document !== 'string' || typeof r.target.pointer !== 'string' || !r.target.pointer.startsWith('/') || /~(?![01])/.test(r.target.pointer) ||
        r.target.pointer.length > 4096 || Object.keys(r.target).some(k => !['document', 'pointer'].includes(k)) || !['error', 'warning'].includes(String(r.onMissing))) return false;
    ids.add(r.id);
    const allowed = ['id', 'kind', 'target', 'onMissing', ...(r.kind === 'select-media' ? ['keep', 'expectedTypes'] : ['name', 'expected'])];
    if (Object.keys(r).some(k => !allowed.includes(k))) return false;
    const list = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= 256 && v.every(s => typeof s === 'string' && s.length > 0 && s.length <= 512) && new Set(v).size === v.length;
    if (r.kind === 'select-media') return list(r.keep) && list(r.expectedTypes);
    return r.kind === 'extract-schema' && typeof r.name === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,119}$/.test(r.name) && object(r.expected);
  });
}

/** Pure transformation preview; returns all bytes or no output on any blocking error. */
export function transform(input: unknown, config: unknown): Preview {
  const result: Preview = { files: [], changes: [], diagnostics: [] };
  // Bound config before recursively comparing preconditions. It is hostile input too.
  let count = 0, characters = 0;
  const bounded = (v: unknown, depth = 0): boolean => ++count <= 100_000 && depth <= 80 &&
    (v === null || typeof v === 'string' && (characters += v.length) <= 4_000_000 || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) ||
     typeof v === 'object' && Object.values(v as object).every(x => bounded(x, depth + 1)));
  if (!bounded(config) || !validate(config)) { result.diagnostics.push('Invalid version 1 transformation configuration. Check rules, targets, preconditions, output settings and limits.'); return result; }
  result.configuration = structuredClone(config);
  let report = inspect(input);
  if (report.diagnostics.length) { result.diagnostics.push('Resolve inspection diagnostics before transformation. Unsupported reference scope or incomplete inputs cannot produce a trustworthy preview.'); return result; }
  const docs = new Map(report.documents.map(d => [d.id, { value: structuredClone(d.value!), text: d.text, ast: /^[\s]*[\[{]/.test(d.text) ? undefined : parseDocument(d.text, { keepSourceTokens: true }) }]));
  const dirty = new Set<string>();
  const sources = (): Source[] => [...docs].map(([id, d]) => ({ id, text: dirty.has(id) ? d.ast ? d.ast.toString({ lineWidth: 0 }) : JSON.stringify(d.value, null, 2) + '\n' : d.text }));
  function set(doc: string, pointer: string, value: Value) {
    const d = docs.get(doc)!;
    const keys = tokens(pointer), key = keys.pop()!;
    const parent = valueAt(d.value, pointer.slice(0, pointer.lastIndexOf('/')));
    if (!parent || typeof parent !== 'object') throw new Error('Target parent is missing.');
    Object.defineProperty(parent, key, { value, enumerable: true, configurable: true, writable: true });
    if (d.ast) d.ast.setIn([...keys, key], d.ast.createNode(value)); dirty.add(doc);
  }
  for (const rule of config.rules) {
    let target: Target;
    try { target = { document: canonical(rule.target.document), pointer: rule.target.pointer }; }
    catch { result.diagnostics.push(`Rule ${rule.id}: invalid document location.`); break; }
    const note = (status: Change['status'], message: string) => result.changes.push({ rule: rule.id, status, message, target });
    const d = docs.get(target.document), current = valueAt(d?.value, target.pointer);
    if (current === undefined) { note(rule.onMissing, 'Target is missing. Check its structural location or change the missing-target policy.'); continue; }
    try {
      const op = report.operations.filter(o => o.location.document === target.document && under(target.pointer, o.location.pointer))
        .sort((a, b) => b.location.pointer.length - a.location.pointer.length)[0];
      if (!op) throw new Error('Select an inline target inside an operation. Shared or inherited definitions cannot be changed implicitly.');
      if (report.operations.filter(o => o.location.document === op.location.document && o.location.pointer === op.location.pointer).length !== 1)
        throw new Error('This operation definition is reused by multiple paths. Extract or select media only on an unshared operation.');
      if (report.references.some(r => r.target?.document === target.document && under(target.pointer, r.target.pointer) && !(r.from.document === target.document && under(r.from.pointer, target.pointer))))
        throw new Error('This target or an enclosing definition is referenced elsewhere. Shared edits need explicit scope.');
      if (rule.kind === 'select-media') {
        const owners = [op.requestBody, ...op.responses.map(r => r.item)].filter(Boolean);
        if (!owners.some(i => i!.location.document === target.document && child(i!.location.pointer, 'content') === target.pointer) || !object(current))
          throw new Error('Media selection must target an inline request or response content map.');
        const types = Object.keys(current).filter(k => !k.startsWith('x-'));
        if (!types.length || types.some(k => !rule.expectedTypes.includes(k))) throw new Error('Offered media types changed since this rule was created. Review the rule.');
        const retained = types.filter(k => rule.keep.includes(k));
        if (!retained.length) { note('unchanged', 'None of the selected media types are offered; content is unchanged.'); continue; }
        const removed = types.filter(k => !rule.keep.includes(k));
        if (!removed.length) { note('already-applied', 'Only selected media types are present.'); continue; }
        if (types.length !== rule.expectedTypes.length) throw new Error('Offered media types changed since this rule was created. Review the rule.');
        for (const key of removed) {
          const removedPointer = child(target.pointer, key);
          if (report.references.some(r => r.target?.document === target.document && under(r.target.pointer, removedPointer))) throw new Error('A removed media type is referenced elsewhere. Keep it or adjust the referring rule first.');
        }
        for (const key of removed) {
          if (d!.ast) note('warning', `Any YAML comments attached to removed media type ${key} are removed with it. Review the exact output.`);
          delete current[key]; d!.ast?.deleteIn(tokens(child(target.pointer, key)));
        }
        dirty.add(target.document); note('changed', `Keep ${retained.join(', ')}; remove ${removed.join(', ')}.`);
      } else {
        if (!report.schemaLocations.some(l => l.document === target.document && l.pointer === target.pointer) || !object(current)) throw new Error('Select an inline schema object, not an arbitrary field.');
        const destination = child('/components/schemas', rule.name);
        const ref = '#' + destination;
        const existing = valueAt(d!.value, destination);
        if (same(current, { $ref: ref }) && same(existing, rule.expected)) { note('already-applied', `Already extracted as ${rule.name}.`); continue; }
        if (Object.hasOwn(current, '$ref')) throw new Error('The selected schema already has a reference. Choose an inline definition.');
        if (!same(current, rule.expected)) throw new Error('The inline schema changed since this rule was created. Review its precondition.');
        if (existing !== undefined) throw new Error(`Model name ${rule.name} already exists. Choose another name; models are never silently merged.`);
        if (!object(d!.value) || typeof d!.value.openapi !== 'string') throw new Error('Extraction currently requires an OpenAPI root in the same document as the operation.');
        // Moving schemas can change implicit discriminator names and URI scope. Fail explicitly.
        if (report.schemaLocations.some(l => {
          const v = valueAt(docs.get(l.document)?.value, l.pointer);
          return object(v) && Object.hasOwn(v, 'discriminator');
        })) throw new Error('Extraction with discriminator mappings is not supported yet; no model was moved.');
        if (report.references.some(r => r.target?.document === target.document && under(r.target.pointer, target.pointer)))
          throw new Error('References point into this inline schema. Their relocation is not supported yet; no model was moved.');
        const node = d!.ast?.getIn(tokens(target.pointer), true);
        const parentNode = d!.ast?.getIn(tokens(target.pointer).slice(0, -1), true);
        if (parentNode && typeof parentNode === 'object' && 'commentBefore' in parentNode && parentNode.commentBefore)
          note('warning', 'Surrounding YAML comments remain at the original location. Review their association after extraction.');
        const sourceKey = isMap(parentNode) ? parentNode.items.find(p => isScalar(p.key) && p.key.value === tokens(target.pointer).at(-1))?.key : undefined;
        if (valueAt(d!.value, '/components') === undefined) set(target.document, '/components', {});
        if (valueAt(d!.value, '/components/schemas') === undefined) set(target.document, '/components/schemas', {});
        if (!object(valueAt(d!.value, '/components/schemas'))) throw new Error('components.schemas must be an object.');
        set(target.document, destination, structuredClone(current));
        if (node) d!.ast?.setIn(tokens(destination), node); // Move the syntax node with its comments.
        const models = d!.ast?.getIn(['components', 'schemas'], true);
        const destinationKey = isMap(models) ? models.items.find(p => isScalar(p.key) && p.key.value === rule.name)?.key : undefined;
        if (isScalar(sourceKey) && isScalar(destinationKey)) {
          destinationKey.commentBefore = sourceKey.commentBefore; destinationKey.comment = sourceKey.comment;
          sourceKey.commentBefore = undefined; sourceKey.comment = undefined;
        }
        set(target.document, target.pointer, { $ref: ref });
        note('changed', `Extract as ${rule.name}; replace the inline schema with ${ref}.`);
      }
      report = inspect({ entry: report.entry, sources: sources() });
      if (report.diagnostics.length) throw new Error('The transformed documents have diagnostics. No output is available.');
    } catch (error) { note('error', error instanceof Error ? error.message : 'Transformation failed safely.'); break; }
  }
  if (result.diagnostics.length || result.changes.some(c => c.status === 'error')) return result;
  result.files = sources();
  if (config.output?.bundle) {
    const bundled = bundle(inspect({ entry: report.entry, sources: result.files }), config.output.format);
    result.files = bundled.files; result.diagnostics.push(...bundled.diagnostics);
    const target = { document: report.entry, pointer: '' };
    for (const message of bundled.warnings) result.changes.push({ rule: 'output', status: 'warning', message, target });
    if (bundled.files.length) result.changes.push({ rule: 'output', status: 'changed', message: 'Bundle external references into one file; recursive relationships remain internal references.', target });
  }
  return result;
}
