import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankOf, tree, weekStart, monthStart, nextMonthStart, activityOf, dmId } from '../src/lib/logic.ts';

test('status ladder thresholds', () => {
  assert.equal(rankOf(0), 0);
  assert.equal(rankOf(99), 0);
  assert.equal(rankOf(100), 1);
  assert.equal(rankOf(499), 1);
  assert.equal(rankOf(500), 2);
  assert.equal(rankOf(1000), 3);
  assert.equal(rankOf(1999), 3);
  assert.equal(rankOf(2000), 4);
  assert.equal(rankOf(4000), 5);
  assert.equal(rankOf(99999), 5); // Emerald Director is only set by a sponsor
});

test('team counts follow the brief example (C→A→B, D under C, T under D)', () => {
  const T = tree([
    { id: 'C', sponsor_id: null }, { id: 'A', sponsor_id: 'C' }, { id: 'B', sponsor_id: 'A' },
    { id: 'D', sponsor_id: 'C' }, { id: 'T', sponsor_id: 'D' }
  ]);
  const size = (id: string) => 1 + T.desc(id).length;
  assert.equal(size('A'), 2);
  assert.equal(size('D'), 2);
  assert.equal(size('C'), 5);
  assert.deepEqual(T.ups('T'), ['D', 'C']);
});

test('tree survives a sponsor loop without hanging', () => {
  const T = tree([{ id: 'x', sponsor_id: 'y' }, { id: 'y', sponsor_id: 'x' }]);
  assert.deepEqual(T.ups('x'), ['y']);
  assert.deepEqual(T.desc('x'), ['y']);
});

test('dates', () => {
  assert.equal(weekStart('2026-10-22'), '2026-10-19'); // Thursday → Monday
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.equal(weekStart('2026-10-25'), '2026-10-19'); // Sunday
  assert.equal(monthStart('2026-10-22'), '2026-10-01');
  assert.equal(nextMonthStart('2026-12-05'), '2027-01-01');
});

test('activity buckets', () => {
  assert.equal(activityOf('2026-10-20T10:00:00Z', '2026-10-22'), 'Active');
  assert.equal(activityOf('2026-10-15T10:00:00Z', '2026-10-22'), 'Idle');
  assert.equal(activityOf('2026-10-01T10:00:00Z', '2026-10-22'), 'Inactive');
});

test('dm ids are order independent', () => {
  assert.equal(dmId('b', 'a'), dmId('a', 'b'));
});
