// Job 73: docs/api/openapi.yaml is a valid OpenAPI 3.1 document and describes exactly the routes
// the api function serves (supabase/functions/api/routes.ts): the same paths and methods, the
// scope each needs, and Idempotency-Key on the routes that take it.
import { assert, assertEquals } from '@std/assert';
import { parse } from '@std/yaml';
import { Validator } from '@seriousme/openapi-schema-validator';
import { routes } from '../functions/api/routes.ts';

const SPEC = new URL('../../docs/api/openapi.yaml', import.meta.url);

type Operation = {
  operationId?: string;
  description?: string;
  parameters?: { $ref?: string }[];
};

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

async function spec(): Promise<{ paths: Record<string, Record<string, Operation>> }> {
  return parse(await Deno.readTextFile(SPEC)) as {
    paths: Record<string, Record<string, Operation>>;
  };
}

Deno.test('openapi.yaml is a valid OpenAPI 3.1 document', async () => {
  const validator = new Validator();
  const result = await validator.validate(await spec());
  assert(result.valid, JSON.stringify(result.errors, null, 2));
  assertEquals(validator.version, '3.1');
});

Deno.test('openapi.yaml lists exactly the routes the api function serves', async () => {
  const { paths } = await spec();
  const documented = Object.entries(paths).flatMap(([path, item]) =>
    METHODS.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${path}`)
  ).sort();
  const served = routes.map((r) => `${r.method} ${r.path}`).sort();
  assertEquals(documented, served);
});

Deno.test('each documented route has its operationId, scope and Idempotency-Key', async () => {
  const { paths } = await spec();
  for (const route of routes) {
    const name = `${route.method} ${route.path}`;
    const op = paths[route.path]?.[route.method.toLowerCase()];
    if (op === undefined) throw new Error(`${name}: not in openapi.yaml`);
    assertEquals(op.operationId, route.operation, `${name}: operationId`);
    assert(
      op.description?.includes(`Requires the ${route.scope} scope.`),
      `${name}: description should say "Requires the ${route.scope} scope."`,
    );
    const takesKey = (op.parameters ?? []).some((p) =>
      p.$ref === '#/components/parameters/IdempotencyKey'
    );
    assertEquals(takesKey, route.idempotent, `${name}: Idempotency-Key parameter`);
  }
});
