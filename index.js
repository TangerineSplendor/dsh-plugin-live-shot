import { OverlayHelper } from './helper.js';
export const inject = ['connection'];
export function apply(ctx) {
  const helper = new OverlayHelper();
  // Register even when Electron is unavailable: failures are JSON, never 404.
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/dsh-shot/control', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        const result = await helper.request(await request.json());
        return Response.json(result.body, { status: result.status });
      } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
    },
  }), 'dsh-shot: control');
  ctx.effect(() => {
    void helper.start().catch(error => console.error('[dsh-shot]', error.message));
    return () => helper.stop();
  });
}
