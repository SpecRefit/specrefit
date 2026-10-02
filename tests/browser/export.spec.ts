import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDownload } from '../../packages/engine/export.ts';
import { transform } from '../../packages/engine/transform.ts';
import { inspect } from '../../packages/engine/index.ts';
import { unzipSync, strFromU8 } from 'fflate';

test('download retains exact preview bytes and references in both output modes', async ({page}) => {
  const sources=await Promise.all(['petstore.yaml','schemas/pet.yaml'].map(async id=>({id,text:await readFile('tests/fixtures/'+id,'utf8')})));
  await page.goto('/');
  await page.getByRole('button',{name:'Explore an example'}).click();
  await page.getByRole('button',{name:'Rules and preview',exact:true}).click();
  await expect(page.getByRole('button',{name:'Export reviewed output'})).toHaveCount(0);
  for (const bundle of [false,true]) {
    await page.getByRole('checkbox',{name:'Bundle external references into one file'}).setChecked(bundle);
    await page.getByRole('button',{name:'Preview these rules'}).click();
    const button=page.getByRole('button',{name:'Export reviewed output'});
    await expect(button).toBeVisible();
    const downloaded=page.waitForEvent('download');
    await button.focus(); await page.keyboard.press('Enter');
    const download=await downloaded;
    expect(download.suggestedFilename()).toBe(bundle ? 'specrefit-bundled.yaml' : 'specrefit-output.zip');
    const bytes=await readFile((await download.path())!);
    const preview=transform({entry:'petstore.yaml',sources},{version:1,rules:[],output:{bundle,format:'yaml'}});
    expect([...bytes]).toEqual([...createDownload(preview.exportPlan).bytes]);
    const unpacked=bundle ? {[preview.exportPlan!.entry]:bytes} : unzipSync(bytes);
    expect(Object.keys(unpacked)).toHaveLength(bundle?1:2);
    for(const f of preview.exportPlan!.files)expect(strFromU8(unpacked[f.path])).toBe(f.text);
    expect(inspect({entry:preview.exportPlan!.entry,sources:Object.entries(unpacked).map(([id,data])=>({id,text:strFromU8(data)}))}).diagnostics).toEqual([]);
    await expect(page.getByRole('status')).toContainText('Download requested');
  }
  await page.getByLabel('Bundle format').selectOption('json');
  await expect(page.getByRole('button',{name:'Export reviewed output'})).toHaveCount(0);
  await page.getByRole('button',{name:'Preview these rules'}).click();
  await expect(page.getByRole('button',{name:'Export reviewed output'})).toBeVisible();
  const jsonDownloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export reviewed output'}).click();
  const jsonDownload=await jsonDownloaded;
  expect(jsonDownload.suggestedFilename()).toBe('specrefit-bundled.json');
  expect(await readFile((await jsonDownload.path())!,'utf8')).toBe(transform({entry:'petstore.yaml',sources},{version:1,rules:[],output:{bundle:true,format:'json'}}).files[0].text);
  await page.getByLabel('Rules JSON (copy to save, paste to replay)').fill('{bad');
  await expect(page.getByRole('button',{name:'Export reviewed output'})).toHaveCount(0);
});

test('blocked transformation has no export action', async({page})=>{
  await page.goto('/');
  await page.getByLabel('Open contract files',{exact:true}).setInputFiles({name:'api.yaml',mimeType:'text/yaml',buffer:Buffer.from('openapi: 3.1.2\ninfo: {title: Missing, version: "1"}\npaths: {}\ncomponents:\n  schemas:\n    Pet: {$ref: missing.yaml}\n')});
  await page.getByRole('button',{name:'Rules and preview',exact:true}).click();
  await page.getByRole('button',{name:'Preview these rules'}).click();
  await expect(page.getByRole('heading',{name:'Preview blocked',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Export reviewed output'})).toHaveCount(0);
});

test('download contains transformed bytes, never the original rule target',async({page})=>{
  const text=await readFile('tests/fixtures/transform.yaml','utf8');
  const config={version:1,rules:[{id:'media',kind:'select-media',target:{document:'api.yaml',pointer:'/paths/~1pets/post/requestBody/content'},onMissing:'error',keep:['application/json'],expectedTypes:['application/json','application/problem+json','application/xml']}]};
  await page.goto('/');
  await page.getByLabel('Open contract files',{exact:true}).setInputFiles({name:'api.yaml',mimeType:'text/yaml',buffer:Buffer.from(text)});
  await page.getByRole('button',{name:'Rules and preview',exact:true}).click();
  await page.getByLabel('Rules JSON (copy to save, paste to replay)').fill(JSON.stringify(config));
  await page.getByRole('button',{name:'Preview these rules'}).click();
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export reviewed output'}).click();
  const download=await downloaded;
  expect(download.suggestedFilename()).toBe('api.yaml');
  const bytes=await readFile((await download.path())!);
  const expected=transform({entry:'api.yaml',sources:[{id:'api.yaml',text}]},config);
  expect(strFromU8(bytes)).toBe(expected.files[0].text);
  expect(expected.files[0].text).not.toBe(text);
});
