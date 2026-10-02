const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const identity = s => `${s.dev}:${s.ino}`;
const stamp = s => s ? `${identity(s)}:${s.size}:${s.mtimeNs}:${s.ctimeNs}` : 'missing';
const missing = async fn => { try { return await fn(); } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; } };
const normalized = p => process.platform === 'win32' ? p.toLowerCase() : p;

class ProtectedInputs {
  paths = new Set();
  identities = new Set();
  async add(paths) {
    if (!Array.isArray(paths) || paths.length > 64 || this.paths.size + paths.length > 4096 || paths.some(p => typeof p !== 'string' || !path.isAbsolute(p) || p.length > 32768)) throw new Error('Invalid source registration.');
    const files = await Promise.all(paths.map(async p => {
      const resolved = await fs.realpath(p), stat = await fs.stat(resolved, { bigint: true });
      if (!stat.isFile()) throw new Error('Only regular source files can be protected.');
      return { path: p, resolved, stat };
    }));
    for (const f of files) { this.paths.add(f.path); this.paths.add(f.resolved); this.identities.add(identity(f.stat)); }
  }
  async snapshot() {
    const names = new Set([...this.paths].map(normalized)), ids = new Set(this.identities);
    for (const p of this.paths) {
      const resolved = await missing(() => fs.realpath(p));
      if (resolved) {
        names.add(normalized(resolved));
        const stat = await fs.stat(resolved, { bigint: true }); ids.add(identity(stat));
      }
    }
    return { names, ids };
  }
}

function safePath(value) {
  return typeof value === 'string' && value.length <= 1024 && value.split('/').every(p => p && !['.', '..', '__proto__'].includes(p) && Buffer.from(p).toString() === p && Buffer.byteLength(p) <= 255 && !/[\\:\u0000-\u001f\u007f<>"|?*]/.test(p) && !/[. ]$/.test(p) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(p));
}
function validateOutput(output) {
  if (!output || !Array.isArray(output.files) || !output.files.length || output.files.length > 64 || !output.files.some(f => f?.path === output.entry)) throw new Error('Invalid export output.');
  let size = 0;
  const names = new Map(), leaves = new Set();
  for (const f of output.files) {
    if (!f || !safePath(f.path) || !(f.bytes instanceof Uint8Array) || f.bytes.length > 20_000_000 || (size += f.bytes.length) > 40_000_000) throw new Error('Invalid or oversized export file.');
    const parts = f.path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join('/'), key = name.normalize('NFC').toLowerCase();
      if (leaves.has(key) || names.has(key) && (names.get(key) !== name || i === parts.length)) throw new Error('Conflicting output paths.');
      names.set(key, name); if (i === parts.length) leaves.add(key);
    }
  }
}
async function checkTarget(target, protectedInputs) {
  const source = await protectedInputs.snapshot();
  const stat = await missing(() => fs.lstat(target, { bigint: true }));
  if (stat && !stat.isFile()) throw new Error('The output must not be a symlink, directory or special file.');
  if (source.names.has(normalized(target)) || stat && source.ids.has(identity(stat))) throw new Error('This destination is a source file or an alias of one. Choose a separate output file.');
  return stat;
}

/** Replace only a non-source regular output, staging completely before the final rename. */
async function saveFile(destination, bytes, protectedInputs, guard = async () => {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 20_000_000) throw new Error('Invalid or oversized output.');
  if (typeof destination !== 'string' || !path.isAbsolute(destination) || !safePath(path.basename(destination))) throw new Error('Choose a portable output filename.');
  const requestedParent = path.dirname(destination);
  const parent = await fs.realpath(requestedParent);
  const target = path.join(parent, path.basename(destination));
  const initialParent = await fs.stat(parent, { bigint: true });
  async function check() {
    await guard();
    if (await fs.realpath(requestedParent) !== parent || identity(await fs.stat(parent, { bigint: true })) !== identity(initialParent)) throw new Error('The destination folder changed. Choose it again.');
    return checkTarget(target, protectedInputs);
  }
  const original = await check();
  const temporary = path.join(parent, `.specrefit-${randomUUID()}.tmp`);
  let handle, staged = false;
  try {
    handle = await fs.open(temporary, 'wx', 0o600); staged = true;
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = undefined;
    if (stamp(await check()) !== stamp(original)) throw new Error('The destination changed while saving. No output was replaced; try again.');
    await fs.rename(temporary, target); staged = false;
  } finally {
    await handle?.close();
    if (staged) await fs.unlink(temporary).catch(() => {});
  }
}
async function saveDirectory(directory, output, protectedInputs) {
  validateOutput(output);
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('Choose an output folder.');
  const root = await fs.realpath(directory), rootStat = await fs.stat(root, { bigint: true });
  if (!rootStat.isDirectory()) throw new Error('Choose an output folder.');
  async function parents(relative, create = false) {
    if (await fs.realpath(directory) !== root || identity(await fs.stat(root, { bigint: true })) !== identity(rootStat)) throw new Error('The output folder changed.');
    let current = root;
    for (const segment of relative.split('/').slice(0, -1)) {
      current = path.join(current, segment);
      let stat = await missing(() => fs.lstat(current));
      if (!stat && create) { await fs.mkdir(current); stat = await fs.lstat(current); }
      if (stat && !stat.isDirectory()) throw new Error('Output folders must not be links or files.');
    }
  }
  // Inspect every destination before writing any file, including later source aliases.
  for (const f of output.files) { await parents(f.path); await checkTarget(path.join(root, f.path), protectedInputs); }
  let saved = 0;
  try {
    for (const f of output.files) {
      await parents(f.path, true);
      await saveFile(path.join(root, f.path), f.bytes, protectedInputs, () => parents(f.path));
      saved++;
    }
  } catch (error) {
    throw new Error(`${error.message} ${saved} of ${output.files.length} files saved; export is incomplete. Review the output folder before retrying.`);
  }
}
module.exports = { ProtectedInputs, saveFile, saveDirectory, validateOutput, safePath };
