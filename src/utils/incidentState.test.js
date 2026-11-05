import { reconcileReport, reconcileSnapshot } from './incidentState';

test('cluster response removes its optimistic draft and replaces the canonical incident once', () => {
  const unrelated = { id: 'other' };
  const next = reconcileReport([{ id: 'canonical', verificationCount: 1 }, { id: 'draft', _isLocalPending: true }, unrelated], 'draft', { id: 'canonical', verificationCount: 2 });
  expect(next.map(item => item.id)).toEqual(['canonical', 'other']);
  expect(next[0].verificationCount).toBe(2);
  expect(next[1]).toBe(unrelated);
});

test('rejected offline vote refresh preserves pending drafts even with an empty server', () => {
  const pending = { id: 'pending', _isLocalPending: true };
  expect(reconcileSnapshot([{ id: 'removed' }, pending], [])).toEqual([pending]);
  expect(reconcileSnapshot([pending], [{ id: 'pending' }])).toEqual([{ id: 'pending' }]);
});
