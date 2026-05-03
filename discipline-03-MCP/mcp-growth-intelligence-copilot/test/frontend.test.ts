import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, priorityLabel } from '../src/frontend/lib/format.ts';

describe('frontend utilities', () => {
  it('formats empty dates for dashboard empty states', () => {
    assert.equal(formatDate(), 'Never');
  });

  it('formats priority labels for recommendation cards', () => {
    assert.equal(priorityLabel('high'), 'High');
  });
});
