import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { inspect, valueAt } from '../../packages/engine/index.ts';
import { transform, type Rule } from '../../packages/engine/transform.ts';
const fixture = readFileSync('tests/fixtures/transform.yaml','utf8');
const pointer = '/paths/~1pets/post/requestBody/content/application~1json/schema';

test('select media, extract a named schema, replay saved rules and invalidate preview', async ({page}, info) => {
  await page.goto('/');
  await page.getByLabel('Open contract files',{exact:true}).setInputFiles({name:'api.yaml',mimeType:'text/yaml',buffer:Buffer.from(fixture)});
  const request = page.locator('#Request-body');
  await request.getByRole('checkbox',{name:'application/xml',exact:true}).uncheck();
  await request.getByRole('button',{name:'Add media selection rule'}).click();
  await expect(page.getByRole('heading',{name:'Rules and preview',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'POST /pets createPet',exact:true}).click();
  await page.locator('#Request-body .media-type').filter({has:page.locator('code').getByText('application/json',{exact:true})}).getByRole('button',{name:'Explore schema →',exact:true}).click();
  await expect(page.getByLabel('Shared model name')).toHaveValue('CreatePetRequest');
  await page.getByLabel('Shared model name').fill('PetInput');
  await page.getByRole('button',{name:'Add extraction rule'}).click();
  const saved = await page.getByLabel('Rules JSON (copy to save, paste to replay)').inputValue();
  await page.getByRole('button',{name:'Preview these rules'}).click();
  await expect(page.getByRole('heading',{name:'Transformation preview',exact:true})).toBeVisible();
  await expect(page.locator('.preview-result')).toContainText('Extract as PetInput');
  await page.locator('.preview-result summary').click();
  await expect(page.locator('.preview-result')).toContainText('#/components/schemas/PetInput');
  await page.screenshot({path:`artifacts/${info.project.name}-transformation.png`,fullPage:true});
  await page.getByLabel('Rules JSON (copy to save, paste to replay)').fill('{bad');
  await expect(page.locator('.preview-result')).toHaveCount(0);
  await page.getByRole('button',{name:'Preview these rules'}).click();
  await expect(page.getByRole('alert')).toContainText('valid JSON');
  await page.getByLabel('Rules JSON (copy to save, paste to replay)').fill(saved);
  await page.getByRole('button',{name:'Preview these rules'}).click();
  await expect(page.getByRole('heading',{name:'Transformation preview',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remove rule'}).first().click();
  await expect(page.locator('.preview-result')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Preview these rules'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('transformed file names and bytes match Node for three OpenAPI families and both formats', async ({page}) => {
  await page.goto('/');
  for (const version of ['3.0.4','3.1.2','3.2.0']) for (const format of ['json','yaml']) {
    const text=fixture.replace('3.1.2',version);
    const input={entry:`api.${format}`,sources:[{id:`api.${format}`,text:format==='yaml'?text:JSON.stringify(parse(text))}]};
    const report=inspect(input);
    const rules:Rule[]=[{id:'extract',kind:'extract-schema',target:{document:report.entry,pointer},name:'CreatePetRequest',expected:valueAt(report.documents[0].value,pointer)!,onMissing:'error'},{id:'media',kind:'select-media',target:{document:report.entry,pointer:pointer.slice(0,pointer.indexOf('/application'))},keep:['application/json'],expectedTypes:['application/json','application/problem+json','application/xml'],onMissing:'error'}];
    const config={version:1,rules};
    const expected=transform(input,config);
    const actual=await page.evaluate(({input,config})=>new Promise((resolve,reject)=>{const w=new Worker('./worker.js',{type:'module'});w.onmessage=e=>{w.terminate();resolve(e.data.preview)};w.onerror=reject;w.postMessage({action:'transform',input,config});}),{input,config});
    expect(actual).toEqual(expected);
    expect(expected.files).toHaveLength(1);
  }
});
