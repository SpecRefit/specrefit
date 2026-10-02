import { canonical, child, displayId, limits, object, string, valueAt, type Inspection, type Item, type Location, type Operation, type Source, type Value } from '../engine/index.ts';
import { suggestSchemaName, type Rule, type Preview } from '../engine/transform.ts';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node;
};
const button = (label: string, action: () => void, cls = '') => { const b = el('button', label, cls); b.type = 'button'; b.addEventListener('click', action); return b; };
const label = (text: string, control: HTMLElement) => { const n = el('label', text); n.append(control); return n; };
const text = (v: Value | undefined): string => typeof v === 'string' ? v : JSON.stringify(v) ?? 'Not specified';
const at = (location: Location, key: string | number): Location => ({ ...location, pointer: child(location.pointer, key) });

export function mount(host: HTMLElement, sample: Source[]) {
  let sources: Source[] = [], entry = '', report: Inspection | undefined;
  let view: 'operations' | 'schemas' | 'files' | 'diagnostics' | 'refit' = 'operations';
  let rules: Rule[] = [], preview: Preview | undefined;
  let configDraft: string | undefined;
  let ruleSequence = 0;
  let selected = 0, search = '', method = '', activeTag = '';
  let worker: Worker | undefined, generation = 0;
  let pane: HTMLElement;
  const history: (() => void)[] = [];
  let currentPage: () => void = () => showSelected();
  const status = document.querySelector<HTMLElement>('#status')!;
  const feedback = document.querySelector<HTMLElement>('#feedback')!;
  const clearFeedback = () => { feedback.hidden = true; feedback.textContent = ''; };
  const fail = (message: string) => { status.textContent = ''; feedback.textContent = message; feedback.hidden = false; feedback.scrollIntoView({ block: 'nearest' }); };
  const announce = (message: string) => { status.textContent = message; };
  const focusPane = () => {
    pane.scrollTop = 0; pane.tabIndex = -1; pane.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 580px)').matches) pane.scrollIntoView({ block: 'start' });
  };
  function process() {
    preview = undefined;
    host.querySelector('.preview-result')?.remove(); host.inert = true;
    clearFeedback();
    worker?.terminate(); const run = ++generation;
    announce('Reading your contract locally…');
    const current = worker = new Worker(new URL('./worker.js', document.baseURI), { type: 'module' });
    const timer = window.setTimeout(() => {
      current.terminate(); if (run === generation) { host.inert = false; fail('Inspection exceeded 10 seconds and was stopped. Try fewer or smaller files.'); }
    }, 10_000);
    current.onmessage = event => {
      clearTimeout(timer); current.terminate(); if (run !== generation) return;
      host.inert = false;
      if (event.data.error) { fail(event.data.error); return; }
      report = event.data.report; selected = Math.min(selected, Math.max(0, report!.operations.length - 1));
      history.length = 0; render(); announce(`${report!.operations.length} operations. ${report!.diagnostics.length} diagnostics. Inspection is not a full specification validation.`);
    };
    current.onerror = () => { clearTimeout(timer); current.terminate(); if (run === generation) { host.inert = false; fail('The inspection worker could not start. Reload the app and try again.'); } };
    current.postMessage({ entry, sources });
  }
  async function importFiles(files: FileList | null, target?: string) {
    if (!files?.length) return;
    const list = [...files];
    if (list.length + sources.length > limits.files || list.some(f => f.size > limits.fileBytes) || list.reduce((n, f) => n + f.size, sources.reduce((n, s) => n + new TextEncoder().encode(s.text).length, 0)) > limits.totalBytes) {
      fail(`Open at most ${limits.files} files, ${limits.fileBytes / 1_000_000} MB per file and ${limits.totalBytes / 1_000_000} MB in total. Your selection is ${list.reduce((n, f) => n + f.size, 0).toLocaleString('en-US')} bytes. No files were added.`); return;
    }
    try {
      const added = await Promise.all(list.map(async f => ({ id: target ?? canonical((f.webkitRelativePath || f.name).split('/').map(encodeURIComponent).join('/')), text: await f.text() })));
      if (new Set([...sources, ...added].map(s => canonical(s.id))).size !== sources.length + added.length) { fail('A file with this location is already open. Use a folder to retain distinct paths, or start a new project. No files were replaced.'); return; }
      sources.push(...added);
      if (!entry) entry = added.find(s => /(?:^|\/)(?:openapi|swagger|api)\.(?:ya?ml|json)$/i.test(s.id))?.id ?? added[0].id;
      process();
    } catch { fail('The selected file could not be read. No contract is uploaded to a server.'); }
  }
  function picker(title: string, folder = false, target?: string) {
    const input = el('input'); input.type = 'file'; input.multiple = !target; input.accept = '.json,.yaml,.yml';
    if (folder) input.setAttribute('webkitdirectory', '');
    input.addEventListener('change', () => { void importFiles(input.files, target); input.value = ''; });
    const wrap = label(title, input); wrap.className = 'file-button'; return wrap;
  }
  function sourceLink(loc: Location) {
    const actual = report?.locations.find(l => l.document === loc.document && l.pointer === loc.pointer) ?? loc;
    return button(`${displayId(actual.document)} · ${actual.line}:${actual.column}`, () => showSource(actual), 'source-link');
  }
  function showSource(loc: Location, remember = true) {
    if (!report) return;
    const doc = report.documents.find(d => d.id === loc.document); if (!doc) return;
    if (remember) history.push(currentPage);
    currentPage = () => showSource(loc, false);
    pane.replaceChildren(back(), el('p', 'SOURCE DOCUMENT', 'eyebrow'), el('h1', displayId(loc.document)), el('p', `Line ${loc.line}, column ${loc.column} · ${loc.pointer || '/'}`, 'muted'));
    const lines = doc.text.split('\n'); const excerpt = lines.slice(Math.max(0, loc.line - 4), loc.line + 6).map((l, i) => `${Math.max(1, loc.line - 3) + i}  ${l}`).join('\n');
    pane.append(el('pre', excerpt, 'source-excerpt'));
    const full = el('details'); full.append(el('summary', 'Complete original source'), el('pre', doc.text)); pane.append(full); focusPane();
  }
  function back() { return button('← Back to inspection', () => { const previous = history.pop(); if (previous) previous(); else showSelected(); focusPane(); }, 'back'); }
  function tree(value: Value, loc: Location, name = 'Details', open = false): HTMLElement {
    if (value === null || typeof value !== 'object') return el('div', `${name}: ${text(value)}`, 'scalar');
    const details = el('details', '', 'tree'); details.open = open;
    const entries = Object.entries(value);
    const summary = el('summary'); summary.append(el('span', name), el('span', Array.isArray(value) ? `${entries.length} items` : object(value) && value.type ? text(value.type) : `${entries.length} fields`, 'type'));
    details.append(summary);
    let rendered = false;
    const populate = () => {
      if (rendered || !details.open) return; rendered = true;
      let offset = 0;
      const more = button('Show more fields', add);
      function add() {
        more.remove();
        for (const [key, val] of entries.slice(offset, offset + 100)) {
          const next = at(loc, key);
          const edge = key === '$ref' ? report?.references.find(r => r.from.document === next.document && r.from.pointer === next.pointer) : undefined;
          if (edge?.target) {
            const target = edge.target;
            const link = button(`↗ ${string(val)}`, () => showNode({ location: target, value: valueAt(report?.documents.find(d => d.id === target.document)?.value, target.pointer) ?? null, schema: edge.schema }, 'Referenced definition'), 'reference');
            const row = el('div', '', 'ref-row'); row.append(el('span', '$ref'), link); details.append(row);
          } else if (edge) details.append(el('p', `$ref: ${text(val)} · ${edge.missing ? 'Document missing — see Diagnostics' : 'Unresolved — see Diagnostics or source'}`, 'warning'));
          else {
            if (object(val) && !Object.hasOwn(val, '$ref') && report?.schemaLocations.some(l => l.document === next.document && l.pointer === next.pointer))
              details.append(button(`Explore ${key} schema →`, () => showNode({ value: val, location: next, schema: true }, `${key} schema`), 'text-button'));
            details.append(tree(val, next, key));
          }
        }
        offset += 100; if (offset < entries.length) details.append(more);
      }
      add();
    };
    details.addEventListener('toggle', populate); populate(); return details;
  }
  function showNode(item: Item, title: string, remember = true) {
    if (remember) history.push(currentPage);
    currentPage = () => showNode(item, title, false);
    pane.replaceChildren(back(), el('p', 'DEFINITION', 'eyebrow'), el('h1', title), sourceLink(item.location));
    if (item.schema && typeof item.value === 'boolean') pane.append(el('p', report?.version.startsWith('3.0.') ? 'Boolean schemas are not supported by OpenAPI 3.0.' : item.value ? 'Any value is allowed by this schema.' : 'No value is allowed by this schema.'));
    if (object(item.value)) {
      if (item.value.description) pane.append(el('p', string(item.value.description), 'description'));
      if (Array.isArray(item.value.required)) pane.append(el('p', `Required properties: ${item.value.required.map(text).join(', ')}`, 'notice'));
      if (item.schema && item.value.$ref && report?.version.startsWith('3.0.')) pane.append(el('p', 'In OpenAPI 3.0, schema $ref siblings do not add constraints. They remain visible below.', 'notice'));
      if (item.schema && item.value.$ref && !report?.version.startsWith('3.0.')) pane.append(el('p', 'A schema $ref and its sibling constraints apply together. Follow the reference to inspect its constraints.', 'notice'));
    }
    if (item.schema) pane.append(extractionControls(item));
    pane.append(tree(item.value, item.location, 'All fields', true)); focusPane();
  }
  function section(title: string, id: string): HTMLElement { const s = el('section', '', 'detail-section'); s.id = id; s.append(el('h2', title)); return s; }
  function mediaTypes(item: Item): HTMLElement {
    const group = el('div', '', 'media-types');
    if (!object(item.value) || !object(item.value.content)) return group;
    const op = report?.operations[selected];
    if (op && item.location.document === op.location.document && item.location.pointer.startsWith(op.location.pointer + '/')) {
      const choices = el('fieldset'); choices.append(el('legend', 'Media types to keep'));
      const inputs = Object.keys(item.value.content).filter(k => !k.startsWith('x-')).map(name => {
        const input = el('input'); input.type = 'checkbox'; input.checked = true;
        choices.append(label(name, input)); return { name, input };
      });
      choices.append(button('Add media selection rule', () => {
        const keep = inputs.filter(i => i.input.checked).map(i => i.name);
        if (!keep.length) { fail('Choose at least one media type to keep.'); return; }
        addRule({ id: `rule-${++ruleSequence}`, kind: 'select-media', target: { document: item.location.document, pointer: child(item.location.pointer, 'content') }, onMissing: 'error', keep, expectedTypes: inputs.map(i => i.name) });
      })); group.append(choices);
    } else group.append(el('p', 'Shared definition: media selection here would affect other uses. This preview only edits inline operation content.', 'muted'));
    for (const [name, media] of Object.entries(item.value.content)) {
      if (name.startsWith('x-')) continue;
      const loc = at(at(item.location, 'content'), name);
      const row = el('div', '', 'media-type'); row.append(el('code', name));
      if (object(media) && media.schema !== undefined) row.append(button('Explore schema →', () => showNode({ value: media.schema, location: at(loc, 'schema'), schema: true }, `${name} schema`), 'text-button'));
      row.append(tree(media, loc, 'Media type details')); group.append(row);
    }
    return group;
  }
  function operationDetails(op: Operation) {
    pane.replaceChildren(el('p', `${op.kind.toUpperCase()} / ${op.tags.join(' · ')}`, 'eyebrow'));
    const heading = el('h1', '', 'operation-heading'); heading.append(el('span', op.method, 'method'), el('code', op.path)); pane.append(heading);
    if (op.summary) pane.append(el('h2', op.summary, 'operation-summary'));
    if (op.description) pane.append(el('p', op.description, 'description'));
    if (op.deprecated) pane.append(el('p', 'Deprecated — this operation is being phased out.', 'warning'));
    pane.append(sourceLink(op.location));
    const jump = el('nav', '', 'jump'); jump.setAttribute('aria-label', 'Operation sections');
    for (const name of ['Parameters', 'Request body', 'Responses', 'Security']) { const a = el('a', name); a.href = `#${name.replace(' ', '-')}`; jump.append(a); } pane.append(jump);
    const params = section('Parameters', 'Parameters');
    if (!op.parameters.length) params.append(el('p', 'No parameters declared.', 'muted'));
    for (const p of op.parameters) {
      const v = object(p.value) ? p.value : {};
      const box = el('article', '', 'definition-card');
      const h = el('h3', string(v.name) || 'Unresolved parameter'); h.append(el('span', string(v.in) || 'unknown location', 'type'));
      box.append(h, el('p', v.$ref ? 'Unresolved reference — required status unknown' : v.required === true ? 'Required' : v.required === undefined || v.required === false ? 'Optional' : 'Invalid required flag', v.required === true ? 'required' : 'muted'));
      if (v.description) box.append(el('p', string(v.description)));
      box.append(tree(p.value, p.location, 'Schema and all parameter fields'), sourceLink(p.location)); params.append(box);
    }
    pane.append(params);
    const body = section('Request body', 'Request-body');
    if (!op.requestBody) body.append(el('p', 'No request body declared.', 'muted'));
    else {
      const v = op.requestBody.value;
      if (object(v)) { body.append(el('p', v.$ref ? 'Unresolved reference — required status unknown' : v.required === true ? 'Required body' : v.required === undefined || v.required === false ? 'Optional body' : 'Invalid required flag', 'muted')); if (v.description) body.append(el('p', string(v.description))); }
      body.append(mediaTypes(op.requestBody), tree(v, op.requestBody.location, 'All request body fields'));
    }
    pane.append(body);
    const responses = section('Responses', 'Responses');
    if (!op.responses.length) responses.append(el('p', 'No response definitions available. See Diagnostics.', 'warning'));
    for (const response of op.responses) {
      const box = el('article', '', 'definition-card');
      box.append(el('h3', response.status), el('p', object(response.item.value) ? string(response.item.value.description) : ''), mediaTypes(response.item), tree(response.item.value, response.item.location, 'All response fields, headers and links')); responses.append(box);
    }
    pane.append(responses);
    const security = section('Security', 'Security');
    if (Array.isArray(op.security)) {
      if (!op.security.length) security.append(el('p', 'No authentication required by this operation.'));
      else {
        security.append(el('p', 'Satisfy any one alternative below. Within an alternative, all listed schemes are required.', 'muted'));
        op.security.forEach((requirement, i) => {
          const box = el('article', '', 'definition-card'); box.append(el('h3', `Alternative ${i + 1}`));
          if (object(requirement)) {
            if (!Object.keys(requirement).length) box.append(el('p', 'Anonymous access allowed.'));
            for (const [name, scopes] of Object.entries(requirement)) {
              box.append(el('p', `${name}${Array.isArray(scopes) && scopes.length ? ` · scopes: ${scopes.join(', ')}` : ''}`));
              const definition = object(op.securitySchemes.value) ? op.securitySchemes.value[name] : undefined;
              if (definition !== undefined) box.append(tree(definition, at(op.securitySchemes.location, name), `${name} definition`));
              else box.append(el('p', 'Scheme definition unavailable. Inspect the source before assuming authentication behavior.', 'warning'));
            }
          } else box.append(el('p', 'Invalid requirement. See Diagnostics.', 'warning'));
          security.append(box);
        });
      }
    } else security.append(el('p', 'Invalid security declaration. See Diagnostics.', 'warning'));
    pane.append(security);
    const extra = section('More about this operation', 'more');
    extra.append(tree(op.servers, op.location, 'Effective servers'), tree(op.raw, op.location, 'All original operation fields'));
    pane.append(extra);
  }
  function showSelected() {
    if (!report) return;
    currentPage = () => showSelected();
    if (view === 'operations') {
      const op = report.operations[selected]; if (op) operationDetails(op); else pane.replaceChildren(el('h1', 'No operations available'), el('p', 'Check the selected entry file and diagnostics. The original source remains available.'));
    } else if (view === 'schemas') {
      pane.replaceChildren(el('p', 'DATA MODELS', 'eyebrow'), el('h1', 'Schemas'), el('p', 'Explore named models and follow references. Recursive models remain links, so you can navigate without expanding them forever.', 'description'));
      if (!report.schemas.length) pane.append(el('p', 'No named component schemas. Inline schemas are available within operation details.', 'muted'));
      for (const schema of report.schemas) pane.append(button(`${schema.name} →`, () => showNode(schema.item, schema.name), 'schema-button'));
    } else if (view === 'files') {
      pane.replaceChildren(el('p', 'LOCAL SOURCES', 'eyebrow'), el('h1', 'Files'), el('p', 'Original text is retained, including comments and unknown fields. This viewer never writes to your files.', 'description'));
      for (const doc of report.documents) {
        const card = el('article', '', 'definition-card'); card.append(el('h2', displayId(doc.id)), button('Read original source', () => showSource({ document: doc.id, pointer: '', line: 1, column: 1 })));
        if (doc.value !== undefined) card.append(tree(doc.value, { document: doc.id, pointer: '', line: 1, column: 1 }, 'Inspect all document fields')); pane.append(card);
      }
    } else if (view === 'refit') showRefit();
    else diagnostics();
  }
  function addRule(rule: Rule) {
    while (rules.some(r => r.id === rule.id)) rule.id = `rule-${++ruleSequence}`;
    configDraft = undefined;
    rules.push(rule); preview = undefined; worker?.terminate(); generation++;
    clearFeedback(); view = 'refit'; render(); focusPane();
  }
  function extractionControls(item: Item) {
    const group = el('div', '', 'refit-controls');
    const op = report?.operations[selected];
    if (!op || !object(item.value) || Object.hasOwn(item.value, '$ref') || item.location.document !== op.location.document || !item.location.pointer.startsWith(op.location.pointer + '/')) return group;
    const name = el('input'); name.value = suggestSchemaName(op, item.location.pointer);
    group.append(label('Shared model name', name), button('Add extraction rule', () => {
      addRule({ id: `rule-${++ruleSequence}`, kind: 'extract-schema', target: { document: item.location.document, pointer: item.location.pointer }, onMissing: 'error', name: name.value, expected: structuredClone(item.value) });
    }), el('p', 'The proposed name is saved with the rule. Existing models are never overwritten or silently merged.', 'muted'));
    return group;
  }
  function runPreview(config: unknown) {
    preview = undefined; clearFeedback(); worker?.terminate(); const run = ++generation;
    announce('Computing transformation preview locally…');
    const current = worker = new Worker(new URL('./worker.js', document.baseURI), { type: 'module' });
    const timer = window.setTimeout(() => { current.terminate(); if (run === generation) fail('Transformation exceeded 10 seconds. Reduce the inputs or rules.'); }, 10_000);
    current.onmessage = event => {
      clearTimeout(timer); current.terminate(); if (run !== generation) return;
      if (event.data.error) { fail(event.data.error); return; }
      preview = event.data.preview;
      if (preview?.configuration) { rules = preview.configuration.rules; configDraft = undefined; }
      view = 'refit'; render(); focusPane(); announce('Transformation preview ready. Original files are unchanged.');
    };
    current.onerror = () => { clearTimeout(timer); current.terminate(); if (run === generation) fail('Transformation worker failed. No output is available.'); };
    current.postMessage({ action: 'transform', input: { entry, sources }, config });
    showRefit();
  }
  function showRefit() {
    pane.replaceChildren(el('p', 'REPRODUCIBLE CHANGES', 'eyebrow'), el('h1', 'Rules and preview'), el('p', 'Rules run in the listed order on the original files. Remove a rule to exclude that target. Preview only: contract export and bundling are not available yet.', 'description'));
    rules.forEach((rule, i) => {
      const card = el('article', '', 'definition-card');
      card.append(el('h2', `${i + 1}. ${rule.kind === 'select-media' ? 'Keep ' + rule.keep.join(', ') : 'Extract ' + rule.name}`), el('p', `${displayId(rule.target.document)} · ${rule.target.pointer}`));
      const edit = (action: () => void) => { action(); configDraft = undefined; preview = undefined; worker?.terminate(); generation++; showRefit(); };
      const up = button('Move up', () => edit(() => { [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]]; })); up.disabled = i === 0;
      const down = button('Move down', () => edit(() => { [rules[i + 1], rules[i]] = [rules[i], rules[i + 1]]; })); down.disabled = i === rules.length - 1;
      const missing = el('select');
      for (const value of ['error', 'warning'] as const) { const option = el('option', value); option.value = value; option.selected = value === rule.onMissing; missing.append(option); }
      missing.addEventListener('change', () => edit(() => { rule.onMissing = missing.value as 'error' | 'warning'; }));
      card.append(up, down, button('Remove rule', () => edit(() => { rules.splice(i, 1); })), label('Missing target', missing)); pane.append(card);
    });
    if (!rules.length) pane.append(el('p', 'Add media selection rules from a request or response, or explore an inline schema to extract a shared model.', 'notice'));
    const config = el('textarea'); config.rows = 8; config.spellcheck = false; config.value = configDraft ?? JSON.stringify({ version: 1, rules }, null, 2);
    config.addEventListener('input', () => { configDraft = config.value; preview = undefined; worker?.terminate(); generation++; pane.querySelector('.preview-result')?.remove(); });
    pane.append(label('Rules JSON (copy to save, paste to replay)', config), button('Preview these rules', () => {
      try {
        if (config.value.length > 4_000_000) throw new Error();
        const parsed: unknown = JSON.parse(config.value);
        runPreview(parsed);
      } catch { fail('Rules must be valid JSON, at most 4 MB.'); }
    }));
    if (!preview) return;
    const output = el('section', '', 'preview-result'); output.append(el('h2', preview.files.length ? 'Transformation preview' : 'Preview blocked'));
    for (const message of preview.diagnostics) output.append(el('p', message, 'warning'));
    for (const change of preview.changes) output.append(el('p', `${change.rule} · ${change.status}: ${change.message}`, change.status === 'error' || change.status === 'warning' ? 'warning' : 'notice'));
    for (const file of preview.files) {
      const original = sources.find(s => canonical(s.id) === file.id)?.text ?? '';
      const details = el('details'); details.append(el('summary', `${displayId(file.id)} · ${file.text === original ? 'unchanged' : 'changed'}`));
      if (file.text !== original) {
        const before = original.split('\n'), after = file.text.split('\n');
        let start = 0, end = 0;
        while (start < before.length && start < after.length && before[start] === after[start]) start++;
        while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
        const diff = [...before.slice(start, before.length - end).map(l => '- ' + l), ...after.slice(start, after.length - end).map(l => '+ ' + l)].join('\n');
        details.append(el('h3', 'Changed lines'), el('pre', diff));
      }
      details.append(el('h3', 'Exact resulting file'), el('pre', file.text)); output.append(details);
    }
    pane.append(output);
  }

  function diagnostics() {
    if (!report) return;
    pane.replaceChildren(el('p', 'INPUT REVIEW', 'eyebrow'), el('h1', 'Diagnostics'), el('p', 'This is a bounded inspection, not a complete OpenAPI or JSON Schema validation. Unsupported constructs remain in the source.', 'description'));
    const missing = [...new Set(report.references.flatMap(r => r.missing ? [r.missing] : []))];
    for (const uri of missing) {
      const card = el('article', '', 'definition-card'); card.append(el('h2', 'Supply a missing document'), el('p', displayId(uri)), picker(`Choose file for ${displayId(uri)}`, false, uri)); pane.append(card);
    }
    if (!report.diagnostics.length) pane.append(el('p', 'No issues found by the available inspection checks.', 'notice'));
    for (const d of report.diagnostics) {
      const card = el('article', '', `diagnostic ${d.severity}`); card.append(el('h2', `${d.severity === 'error' ? 'Needs attention' : 'Inspection limitation'} · ${d.code}`), el('p', d.message), sourceLink(d.location)); pane.append(card);
    }
  }
  function render() {
    const sidebarScroll = host.querySelector('.sidebar')?.scrollTop ?? 0;
    document.body.classList.toggle('inspecting', !!report);
    host.replaceChildren();
    if (!report) {
      const main = el('main', '', 'welcome'); main.id = 'content';
      main.append(el('p', 'OPENAPI · LOCAL BY DESIGN', 'eyebrow'), el('h1', 'Make sense of\nyour API contract.'), el('p', 'Explore endpoints, trace models and understand what goes in and comes out. Start with your YAML or JSON files.', 'intro'));
      const actions = el('div', '', 'actions'); actions.append(picker('Open contract files'), picker('Open a folder', true), button('Explore an example →', () => { sources = sample.map(s => ({ ...s })); entry = sample[0].id; process(); }, 'text-button')); main.append(actions);
      main.append(el('p', 'OpenAPI 3.0 · 3.1 · 3.2   /   Transformation preview', 'muted'), el('p', 'Your files stay on this device. No uploads, account or automatic reference downloads.', 'privacy-note'));
      const guide = el('div', '', 'guide');
      for (const [number, title, content] of [['01', 'See the operations', 'Browse by tag, method or search.'], ['02', 'Follow the models', 'Navigate schemas and recursive references.'], ['03', 'Fill in the gaps', 'Supply missing files exactly where they belong.']]) {
        const card = el('article'); card.append(el('p', number, 'eyebrow'), el('h2', title), el('p', content)); guide.append(card);
      }
      main.append(guide); host.append(main); return;
    }
    const toolbar = el('div', '', 'toolbar'); const title = el('div'); title.append(el('strong', report.title), el('span', `OpenAPI ${report.version || 'unknown'} · ${sources.length} files`, 'muted'));
    const actions = el('div', '', 'actions'); actions.append(picker('Add files'), picker('Add folder', true), button('New project', () => { worker?.terminate(); generation++; clearFeedback(); sources = []; entry = ''; report = undefined; rules = []; preview = undefined; configDraft = undefined; ruleSequence = 0; search = ''; method = ''; activeTag = ''; view = 'operations'; render(); announce('Ready to open a new project.'); })); toolbar.append(title, actions); host.append(toolbar);
    const tabs = el('nav', '', 'tabs'); tabs.setAttribute('aria-label', 'Contract views');
    for (const [id, title] of [['operations', 'Operations'], ['schemas', 'Schemas'], ['files', 'Files'], ['refit', 'Rules and preview'], ['diagnostics', `Diagnostics${report.diagnostics.length ? ` (${report.diagnostics.length})` : ''}`]] as const) {
      const b = button(title, () => { view = id; history.length = 0; render(); focusPane(); }); if (id === view) b.setAttribute('aria-current', 'page'); tabs.append(b);
    }
    host.append(tabs);
    const layout = el('div', '', 'workspace'); const sidebar = el('aside', '', 'sidebar');
    const select = el('select'); select.setAttribute('aria-label', 'Entry document');
    for (const s of sources) { const o = el('option', displayId(canonical(s.id))); o.value = s.id; o.selected = s.id === entry; select.append(o); }
    select.addEventListener('change', () => { entry = select.value; selected = 0; process(); }); sidebar.append(label('Entry document', select));
    const input = el('input'); input.type = 'search'; input.placeholder = 'Find an operation…'; input.value = search; input.setAttribute('aria-label', 'Search operations'); sidebar.append(label('Search', input));
    const filter = el('select'); filter.setAttribute('aria-label', 'HTTP method');
    for (const m of ['', ...new Set(report.operations.map(o => o.method))]) { const o = el('option', m || 'All methods'); o.value = m; o.selected = m === method; filter.append(o); } sidebar.append(label('Method', filter));
    const tags = el('select'); tags.setAttribute('aria-label', 'Tag');
    for (const t of ['', ...new Set(report.operations.flatMap(o => o.tags))]) { const o = el('option', t || 'All tags'); o.value = t; o.selected = t === activeTag; tags.append(o); } sidebar.append(label('Tag', tags));
    const list = el('nav', '', 'operation-list'); list.setAttribute('aria-label', 'Operations by tag'); sidebar.append(list);
    function updateList() {
      list.replaceChildren();
      const matches = report!.operations.map((op, i) => ({ op, i })).filter(({ op }) => (!method || op.method === method) && (!activeTag || op.tags.includes(activeTag)) && `${op.method} ${op.path} ${op.summary} ${op.description} ${op.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
      list.append(el('p', `${matches.length} operations`, 'muted'));
      for (const tag of [...new Set(matches.flatMap(m => m.op.tags))]) {
        if (activeTag && tag !== activeTag) continue;
        list.append(el('h2', tag));
        for (const { op, i } of matches.filter(m => m.op.tags.includes(tag))) {
          const b = button('', () => { selected = i; view = 'operations'; render(); focusPane(); }, 'operation-button');
          b.append(el('span', op.method, `method method-${op.method.toLowerCase()}`), el('code', op.path), el('span', op.summary, 'operation-label'));
          b.setAttribute('aria-label', `${op.method} ${op.path} ${op.summary}`); if (i === selected && view === 'operations') b.setAttribute('aria-current', 'true'); list.append(b);
        }
      }
      if (!matches.length) list.append(el('p', 'No matching operations. Try another search or clear the filters.'));
    }
    input.addEventListener('input', () => { search = input.value; updateList(); }); filter.addEventListener('change', () => { method = filter.value; updateList(); }); tags.addEventListener('change', () => { activeTag = tags.value; updateList(); }); updateList();
    pane = el('main', '', 'content'); pane.id = 'content'; layout.append(sidebar, pane); host.append(layout); showSelected();
    sidebar.scrollTop = sidebarScroll;
  }
  render();
}
