const test = require('node:test');
const assert = require('node:assert/strict');
const { createIncidentRepository } = require('../services/firebaseStore');

test('Firestore commits are atomic, retry failures, and delete removed incidents', async () => {
  let persisted = new Map([['old', { id: 'old' }]]);
  let fail = false;
  let commits = 0;
  const db = {
    collection: () => ({
      get: async () => ({ docs: [...persisted.values()].map(item => ({ data: () => item })) }),
      doc: id => id,
    }),
    batch: () => {
      const edits = [];
      return {
        set: (id, value) => edits.push([id, value]),
        delete: id => edits.push([id, null]),
        commit: async () => {
          commits++;
          if (fail) throw new Error('unavailable');
          const next = new Map(persisted);
          for (const [id, value] of edits) value ? next.set(id, value) : next.delete(id);
          persisted = next;
        },
      };
    },
  };
  const repo = createIncidentRepository(db);
  assert.deepEqual(await repo.load(), [{ id: 'old' }]);
  fail = true;
  await assert.rejects(repo.save([{ id: 'new' }]), /unavailable/);
  assert.ok(persisted.has('old'));
  fail = false;
  await repo.save([{ id: 'new' }]);
  assert.deepEqual([...persisted.keys()], ['new']);
  await repo.save([{ id: 'new' }]);
  assert.equal(commits, 2, 'unchanged snapshots do not incur writes');
  await assert.rejects(repo.save([{ id: 'nested/path' }]), /Invalid Firestore/);
  await assert.rejects(repo.save(Array.from({ length: 501 }, (_, i) => ({ id: String(i) }))), /atomic write limit/);
  assert.equal(commits, 2, 'invalid writes never reach Firestore');
});
