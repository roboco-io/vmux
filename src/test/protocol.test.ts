import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  createRequest,
  createResponse,
  createError,
  parseMessage,
  PARSE_ERROR,
  METHOD_NOT_FOUND,
} from '../shared/protocol.js';

describe('JSON-RPC protocol utilities', () => {
  it('createRequest generates valid JSON-RPC 2.0', () => {
    const req = createRequest('test.method', { foo: 'bar' });
    assert.equal(req.jsonrpc, '2.0');
    assert.equal(req.method, 'test.method');
    assert.deepEqual(req.params, { foo: 'bar' });
    assert.ok(typeof req.id === 'number');
  });

  it('createResponse generates valid response', () => {
    const res = createResponse(1, { ok: true });
    assert.equal(res.jsonrpc, '2.0');
    assert.equal(res.id, 1);
    assert.deepEqual(res.result, { ok: true });
    assert.equal(res.error, undefined);
  });

  it('createError generates valid error response', () => {
    const res = createError(1, METHOD_NOT_FOUND, 'Not found');
    assert.equal(res.jsonrpc, '2.0');
    assert.equal(res.id, 1);
    assert.equal(res.error?.code, METHOD_NOT_FOUND);
    assert.equal(res.error?.message, 'Not found');
  });

  it('parseMessage parses valid request', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test', params: {} });
    const req = parseMessage(raw);
    assert.equal(req.method, 'test');
    assert.equal(req.id, 1);
  });

  it('parseMessage throws on invalid JSON', () => {
    assert.throws(() => parseMessage('not json'), /Unexpected token/);
  });

  it('parseMessage throws on non-JSON-RPC message', () => {
    assert.throws(() => parseMessage('{"foo":"bar"}'), /Invalid JSON-RPC/);
  });

  it('createError with PARSE_ERROR code', () => {
    const res = createError(null, PARSE_ERROR, 'Parse error');
    assert.equal(res.id, null);
    assert.equal(res.error?.code, PARSE_ERROR);
  });
});
