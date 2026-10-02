import { isMap, isNode, isScalar, parseDocument } from 'yaml';
import { child, inspect, object, valueAt, type Inspection, type Source, type Value } from './index.ts';

export interface Output { bundle: boolean; format: 'yaml' | 'json' }
export interface BundleResult { files: Source[]; diagnostics: string[]; warnings: string[] }
const keys = (p: string) => p ? p.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~')) : [];
const under = (p: string, parent: string) => !parent || p === parent || p.startsWith(parent + '/');
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const storage = 'x-specrefit-bundled';

/** Bundle resolved OpenAPI references without expanding cycles or interpreting example data. */
export function bundle(report: Inspection, format: Output['format']): BundleResult {
  const result: BundleResult = { files: [], diagnostics: [], warnings: [] };
  const docs = new Map(report.documents.map(d => [d.id, d]));
  const entry = docs.get(report.entry)!;
  const targets = new Map<string, { document: string; pointer: string; destination: string }>();
  for (const edge of report.references) {
    if (!edge.target) { result.diagnostics.push('Resolve every reference before bundling.'); return result; }
    if (edge.target.document !== report.entry) targets.set(JSON.stringify([edge.target.document, edge.target.pointer]), { ...edge.target, destination: '' });
  }
  // Prefer one copy of an ancestor over overlapping copies of its children.
  const ordered = [...targets.values()].sort((a, b) => compare(a.document, b.document) || compare(a.pointer, b.pointer));
  const roots: typeof ordered = [];
  for (const target of ordered) if (!roots.some(other => other.document === target.document && under(target.pointer, other.pointer))) roots.push(target);
  if (roots.length > 2048) { result.diagnostics.push('Bundling is limited to 2048 external definitions. Split the project into smaller entry contracts.'); return result; }
  const moved = (document: string, pointer: string) => roots.find(t => t.document === document && under(pointer, t.pointer));
  const identity = (document: string, pointer: string) => JSON.stringify([document, pointer]);
  const contexts = new Map(report.contexts.map(c => [identity(c.location.document, c.location.pointer), c.role]));
  const references = new Set(report.references.map(r => identity(r.from.document, r.from.pointer)));
  function audit(v: Value | undefined, document: string, pointer: string) {
    if (!v || typeof v !== 'object' || result.diagnostics.length >= 100) return;
    const role = contexts.get(identity(document, pointer));
    if (object(v) && typeof v.$ref === 'string' && !references.has(identity(document, child(pointer, '$ref'))))
      result.diagnostics.push(`An unrecognized $ref at ${pointer} cannot be safely bundled. Use a supported OpenAPI reference position.`);
    for (const [key, value] of Object.entries(v)) {
      if (role && key.startsWith('x-')) continue;
      if (role === 'schema' && ['default', 'const', 'enum', 'examples', 'example'].includes(key)) continue;
      if (['media', 'parameter', 'header'].includes(role ?? '') && key === 'example' || role === 'example' && key === 'value') continue;
      audit(value, document, child(pointer, key));
    }
  }
  audit(entry.value, report.entry, '');
  for (const root of roots) audit(valueAt(docs.get(root.document)?.value, root.pointer), root.document, root.pointer);
  // These constructs carry meaning beyond a static JSON Pointer relocation.
  const schemas = new Set(report.schemaLocations.map(s => JSON.stringify([s.document, s.pointer])));
  for (const loc of report.locations) {
    const v = valueAt(docs.get(loc.document)?.value, loc.pointer);
    if (!object(v)) continue;
    if (schemas.has(JSON.stringify([loc.document, loc.pointer])) && Object.hasOwn(v, 'discriminator'))
      result.diagnostics.push('Bundling with discriminator names or mappings is not supported yet. Keep separate files until discriminator relocation is supported.');
    if (schemas.has(JSON.stringify([loc.document, loc.pointer])) && ['$anchor', '$dynamicAnchor'].some(k => Object.hasOwn(v, k)))
      result.diagnostics.push('Bundling named schema anchors is not supported yet. Use JSON Pointer references before bundling.');
    if (Object.hasOwn(v, 'operationRef')) result.diagnostics.push('Bundling operationRef links is not supported yet. Keep separate files until link relocation is supported.');
    if (moved(loc.document, loc.pointer)) {
      const sourceRoot = docs.get(loc.document)?.value;
      const role = contexts.get(identity(loc.document, loc.pointer));
      if (['path', 'operation'].includes(role ?? '') && object(sourceRoot) && typeof sourceRoot.openapi === 'string' && (Object.hasOwn(sourceRoot, 'servers') || Object.hasOwn(sourceRoot, 'security')))
        result.diagnostics.push('An external OpenAPI operation inherits server or security context. Make that context explicit before bundling; cross-document inheritance is not relocated yet.');
      const flows = object(v.flows) ? Object.values(v.flows).flatMap(flow => object(flow) ? [flow.authorizationUrl, flow.tokenUrl, flow.refreshUrl] : []) : [];
      const urls = [object(v.externalDocs) ? v.externalDocs.url : undefined, v.externalValue, object(v.server) ? v.server.url : undefined,
        v.openIdConnectUrl, ...flows,
        ...(Array.isArray(v.servers) ? v.servers.map(s => object(s) ? s.url : undefined) : [])];
      if (urls.some(url => typeof url === 'string' && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url)))
        result.diagnostics.push('A moved definition contains a relative server, external example or documentation URL. Make it absolute before bundling to preserve its base.');
    }
  }
  if (result.diagnostics.length) { result.diagnostics = [...new Set(result.diagnostics)]; return result; }
  const containers: Record<string, string> = { schema: 'schemas', parameter: 'parameters', body: 'requestBodies', response: 'responses', header: 'headers', callback: 'callbacks', example: 'examples', security: 'securitySchemes', link: 'links', path: 'pathItems', media: 'mediaTypes' };
  const reserved = new Set<string>();
  for (const root of roots) {
    const roles = new Set(report.references.filter(r => r.target?.document === root.document && r.target.pointer === root.pointer).map(r => r.role));
    if (roles.size !== 1) { result.diagnostics.push('One external definition is used as different OpenAPI object types. Resolve this ambiguity before bundling.'); return result; }
    const role = [...roles][0]!;
    const group = role === 'path' && report.version.startsWith('3.0.') ? undefined : containers[role];
    const parent = group ? '/components/' + group : '/' + storage;
    const existing = valueAt(entry.value, parent);
    if (existing !== undefined && !object(existing)) { result.diagnostics.push(`Bundle destination ${parent} must be an object.`); return result; }
    const rawName = keys(root.pointer).at(-1) || new URL(root.document).pathname.split('/').at(-1)!.replace(/\.[^.]+$/, '');
    const stem = rawName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'Resource';
    let name = stem, suffix = 2;
    while (valueAt(entry.value, child(parent, name)) !== undefined || reserved.has(child(parent, name))) name = `${stem}_${suffix++}`;
    root.destination = child(parent, name); reserved.add(root.destination);
  }
  const asts = new Map(report.documents.map(d => [d.id, parseDocument(d.text, { keepSourceTokens: true })]));
  const ast = asts.get(report.entry)!;
  const relocate = (document: string, pointer: string): string => {
    if (document === report.entry) return pointer;
    const root = moved(document, pointer);
    if (!root) throw new Error('A required reference target could not be relocated.');
    return root.destination + pointer.slice(root.pointer.length);
  };
  try {
    for (const root of roots) {
      const source = asts.get(root.document)!;
      const node = root.pointer ? source.getIn(keys(root.pointer), true) : source.contents;
      if (!isNode(node)) throw new Error('A referenced definition cannot be copied safely.');
      const copy = node.clone();
      ast.setIn(keys(root.destination), copy);
      // Comments on a mapping key describe that definition and move to its new key.
      const parent = source.getIn(keys(root.pointer).slice(0, -1), true);
      const sourceKey = isMap(parent) ? parent.items.find(p => isScalar(p.key) && p.key.value === keys(root.pointer).at(-1))?.key : undefined;
      const dest = ast.getIn(keys(root.destination).slice(0, -1), true);
      const destKey = isMap(dest) ? dest.items.find(p => isScalar(p.key) && p.key.value === keys(root.destination).at(-1))?.key : undefined;
      if (isScalar(sourceKey) && isScalar(destKey)) { destKey.comment = sourceKey.comment; destKey.commentBefore = sourceKey.commentBefore; }
      if (!root.pointer && source.comment) copy.comment = [copy.comment, source.comment].filter(Boolean).join('\n');
    }
    for (const edge of report.references) {
      const from = relocate(edge.from.document, edge.from.pointer);
      const to = relocate(edge.target!.document, edge.target!.pointer);
      // A fragment is a URI as well as a JSON Pointer (spaces, %, # and Unicode need encoding).
      const ref = '#' + to.split('/').map(encodeURIComponent).join('/');
      const node = ast.getIn(keys(from), true);
      if (!isScalar(node)) throw new Error('A reference is not a scalar string.');
      node.value = ref;
    }
    if (format === 'json' && report.documents.some(d => !/^\s*[\[{]/.test(d.text)))
      result.warnings.push('JSON cannot retain YAML comments. Choose YAML to preserve comments on retained and bundled definitions.');
    if (roots.length) result.warnings.push('Bundled definitions retain their node and key comments. Comments outside a selected definition remain only in the original source; review their association.');
    const text = format === 'json' ? JSON.stringify(ast.toJS({ maxAliasCount: 0 }), null, 2) + '\n' : ast.toString({ lineWidth: 0 });
    const file = { id: new URL(`specrefit-bundled.${format}`, report.entry).href, text };
    const checked = inspect({ entry: file.id, sources: [file] });
    if (checked.diagnostics.length || checked.references.some(r => r.target?.document !== file.id)) throw new Error('The bundled result could not be verified as self-contained. Review the input diagnostics.');
    result.files = [file];
  } catch (error) { result.diagnostics.push(error instanceof Error ? error.message : 'Bundling failed safely.'); }
  return result;
}
