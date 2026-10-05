import type { Download, ExportOutput } from '../engine/export.ts';
import type { Source, Diagnostic } from '../engine/index.ts';
export interface DesktopExport {
  importLocalReferences(files: File[], ids: string[], input: { entry: string; sources: Source[] }): Promise<{ sources: Source[]; diagnostics: Diagnostic[] }>;
  protectInputs(files: File[]): Promise<void>;
  saveOutput(output: ExportOutput, name: string): Promise<{ saved: boolean; error?: string }>;
}
declare global { interface Window { specRefitDesktop?: DesktopExport } }

export async function saveReviewedOutput(output: ExportOutput, download: Download): Promise<string> {
  if (window.specRefitDesktop) {
    const result = await window.specRefitDesktop.saveOutput(output, download.name);
    if (result.error) throw new Error(result.error);
    return result.saved ? 'Reviewed output saved. Original files are unchanged.' : 'Export cancelled. No output was saved.';
  }
  // The browser owns download placement; there is no source-file write handle.
  const url = URL.createObjectURL(new Blob([new Uint8Array(download.bytes)], { type: download.type }));
  const link = document.createElement('a'); link.href = url; link.download = download.name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return output.files.length > 1 ? 'Download requested. The ZIP contains the exact reviewed files; extract it into a separate output folder.' : 'Download requested. The file contains the exact reviewed output.';
}
