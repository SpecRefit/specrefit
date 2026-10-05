declare module '*.json' { const value: import('../../packages/engine/index.ts').Source[]; export default value; }
declare const __SPECREFIT_BUILD__: { version: string; commit: string; dirty: boolean; tag: string | null };
declare const __SPECREFIT_PLAYGROUND__: import('./playground-version.ts').PlaygroundVersion;
