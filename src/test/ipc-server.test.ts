import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { MethodRouter } from '../extension/ipc/server.js';
import { METHOD_NOT_FOUND, PARSE_ERROR, INVALID_PARAMS } from '../shared/protocol.js';

describe('MethodRouter', () => {
  it('routes to registered handler', async () => {
    const router = new MethodRouter();
    router.register('test.echo', async (params) => params);

    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test.echo', params: { msg: 'hello' } });
    const response = JSON.parse(await router.handleRaw(raw));

    assert.equal(response.id, 1);
    assert.deepEqual(response.result, { msg: 'hello' });
    assert.equal(response.error, undefined);
  });

  it('returns METHOD_NOT_FOUND for unknown method', async () => {
    const router = new MethodRouter();
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'unknown' });
    const response = JSON.parse(await router.handleRaw(raw));

    assert.equal(response.error.code, METHOD_NOT_FOUND);
    assert.ok(response.error.message.includes('unknown'));
  });

  it('returns PARSE_ERROR for invalid JSON', async () => {
    const router = new MethodRouter();
    const response = JSON.parse(await router.handleRaw('not json'));

    assert.equal(response.error.code, PARSE_ERROR);
  });

  it('returns INVALID_PARAMS when handler throws validation error', async () => {
    const router = new MethodRouter();
    router.register('test.validate', async () => {
      throw new Error('Invalid params: name is required');
    });

    const raw = JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'test.validate' });
    const response = JSON.parse(await router.handleRaw(raw));

    assert.equal(response.error.code, INVALID_PARAMS);
  });

  it('handles handler that returns null', async () => {
    const router = new MethodRouter();
    router.register('test.null', async () => null);

    const raw = JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'test.null' });
    const response = JSON.parse(await router.handleRaw(raw));

    assert.equal(response.result, null);
    assert.equal(response.error, undefined);
  });
});
