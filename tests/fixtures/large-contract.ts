/** Generated local fixture: realistic operation/schema counts without third-party contract data. */
export function largeContract(): string {
  return JSON.stringify({
    openapi: '3.0.4', info: { title: 'Large contract', version: '1' },
    paths: Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`/items/${i}`, { get: {
      summary: `Read item ${i}`, tags: [`Group ${i % 30}`], description: 'Operation documentation. '.repeat(320),
      responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/Model${i % 1000}` } } } } },
    } }])),
    components: { schemas: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`Model${i}`, {
      type: 'object', properties: Object.fromEntries(Array.from({ length: 32 }, (_, p) => [`field${p}`, { type: 'string', description: `Description for field ${p}`, maxLength: 200 }])),
    }])) },
  }, null, 2);
}
