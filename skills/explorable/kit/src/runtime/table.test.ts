// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDataTable } from './table.ts';

describe('createDataTable', () => {
  it('sets the caption, its note and the cells through the math formatter (no raw d_k)', () => {
    const t = createDataTable('fig-data', 'Data for: Wider vectors, unless you divide by √d_k', ['key', 'weight'], 0, new Set(['k']));
    expect(t.table.caption?.innerHTML).toBe('Data for: Wider vectors, unless you divide by √<i>d</i><span class="xsub">k</span>');
    t.setNote('d_k = 4 <b>');
    expect(t.table.caption?.textContent).toBe('Data for: Wider vectors, unless you divide by √dk — dk = 4 <b>');
    expect(t.table.caption?.querySelector('b')).toBeNull();
    t.setRows([['k₁', '0.16'], ['x_t', '0.03']]);
    const cells = [...t.table.tBodies[0]!.querySelectorAll('th, td')].map((c) => c.innerHTML);
    expect(cells).toEqual(['<i>k</i>₁', '0.16', '<i>x</i><span class="xsub">t</span>', '0.03']);
  });
});
