// Reproducible developer asset generation from the existing vector mark. Not part of packaging.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const svg=(await readFile('apps/web/mark.svg','utf8')).replace('viewBox="0 0 240 280"','viewBox="-40 -20 320 320"');
const directory='apps/desktop/icons';await mkdir(directory,{recursive:true});
const browser=await chromium.launch();
try {
  const page=await browser.newPage({deviceScaleFactor:1});
  const pngs=new Map();
  for(const size of [16,32,48,64,128,256,512,1024]) {
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    pngs.set(size,await page.screenshot({omitBackground:true}));
  }
  await writeFile(directory+'/icon.png',pngs.get(512));
  const sizes=[16,32,48,64,128,256],header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  sizes.forEach((size,index)=>{const p=6+index*16,bytes=pngs.get(size);header[p]=header[p+1]=size===256?0:size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(bytes.length,p+8);header.writeUInt32LE(offset,p+12);offset+=bytes.length;});
  await writeFile(directory+'/icon.ico',Buffer.concat([header,...sizes.map(size=>pngs.get(size))]));
  const chunks=[[128,'ic07'],[256,'ic08'],[512,'ic09'],[1024,'ic10']].map(([size,type])=>{const png=pngs.get(size),head=Buffer.alloc(8);head.write(type);head.writeUInt32BE(png.length+8,4);return Buffer.concat([head,png]);});
  const icns=Buffer.alloc(8);icns.write('icns');icns.writeUInt32BE(8+chunks.reduce((n,b)=>n+b.length,0),4);
  await writeFile(directory+'/icon.icns',Buffer.concat([icns,...chunks]));
} finally {await browser.close();}
