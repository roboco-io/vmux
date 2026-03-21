import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { MetadataManager } from '../extension/metadata/manager.js';

describe('MetadataManager', () => {
  it('setStatus creates and updates status pills', () => {
    const mgr = new MetadataManager();
    mgr.setStatus('t1', 'build', 'passing', 'check', '#00ff00');

    const meta = mgr.getMetadata('t1');
    assert.ok(meta);
    assert.equal(meta.statuses.length, 1);
    assert.equal(meta.statuses[0]!.key, 'build');
    assert.equal(meta.statuses[0]!.value, 'passing');
    assert.equal(meta.statuses[0]!.icon, 'check');
    assert.equal(meta.statuses[0]!.color, '#00ff00');

    // Update same key
    mgr.setStatus('t1', 'build', 'failing', 'error', '#ff0000');
    const updated = mgr.getMetadata('t1')!;
    assert.equal(updated.statuses.length, 1);
    assert.equal(updated.statuses[0]!.value, 'failing');
  });

  it('setProgress clamps to 0-1 range', () => {
    const mgr = new MetadataManager();
    mgr.setProgress('t1', 0.75, 'Building...');

    const meta = mgr.getMetadata('t1')!;
    assert.equal(meta.progress?.value, 0.75);
    assert.equal(meta.progress?.label, 'Building...');

    // Clamp above 1
    mgr.setProgress('t1', 1.5);
    assert.equal(mgr.getMetadata('t1')!.progress?.value, 1);

    // Clamp below 0
    mgr.setProgress('t1', -0.5);
    assert.equal(mgr.getMetadata('t1')!.progress?.value, 0);
  });

  it('addLog appends log entries', () => {
    const mgr = new MetadataManager();
    mgr.addLog('t1', 'Starting build', 'info');
    mgr.addLog('t1', 'Build failed', 'error');

    const meta = mgr.getMetadata('t1')!;
    assert.equal(meta.logs.length, 2);
    assert.equal(meta.logs[0]!.message, 'Starting build');
    assert.equal(meta.logs[0]!.level, 'info');
    assert.equal(meta.logs[1]!.message, 'Build failed');
    assert.equal(meta.logs[1]!.level, 'error');
    assert.ok(meta.logs[0]!.timestamp <= meta.logs[1]!.timestamp);
  });

  it('addLog defaults to info level', () => {
    const mgr = new MetadataManager();
    mgr.addLog('t1', 'test message');

    const meta = mgr.getMetadata('t1')!;
    assert.equal(meta.logs[0]!.level, 'info');
  });

  it('getMetadata returns undefined for unknown terminal', () => {
    const mgr = new MetadataManager();
    assert.equal(mgr.getMetadata('nonexistent'), undefined);
  });

  it('listAll returns all terminals with metadata', () => {
    const mgr = new MetadataManager();
    mgr.setStatus('t1', 'state', 'running');
    mgr.setProgress('t2', 0.5);
    mgr.addLog('t3', 'hello');

    const all = mgr.listAll();
    assert.equal(all.length, 3);
    const ids = all.map(e => e.terminalId).sort();
    assert.deepEqual(ids, ['t1', 't2', 't3']);
  });

  it('remove deletes terminal metadata', () => {
    const mgr = new MetadataManager();
    mgr.setStatus('t1', 'state', 'running');
    mgr.remove('t1');
    assert.equal(mgr.getMetadata('t1'), undefined);
    assert.equal(mgr.listAll().length, 0);
  });

  it('onDidChange fires on mutations', () => {
    const mgr = new MetadataManager();
    let count = 0;
    mgr.onDidChange = () => { count++; };

    mgr.setStatus('t1', 'k', 'v');
    mgr.setProgress('t1', 0.5);
    mgr.addLog('t1', 'msg');
    mgr.remove('t1');

    assert.equal(count, 4);
  });

  it('multiple status keys per terminal', () => {
    const mgr = new MetadataManager();
    mgr.setStatus('t1', 'build', 'passing');
    mgr.setStatus('t1', 'deploy', 'pending');

    const meta = mgr.getMetadata('t1')!;
    assert.equal(meta.statuses.length, 2);
    assert.equal(meta.statuses[0]!.key, 'build');
    assert.equal(meta.statuses[1]!.key, 'deploy');
  });
});
