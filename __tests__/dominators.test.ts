import { test, expect, assert } from 'vitest'
import { Dominators } from '../src'

test('iter_dominators', () => {
    const doms = new Dominators(0, new Map([[2, 1], [1, 0], [0, 0]]))
    const all_doms = doms.dominators(2)?.collect();

    expect(all_doms).toEqual([2, 1, 0])

    assert(!doms.dominators(99)?.map(v => v));

    const strict_doms = doms.strict_dominators(2)?.collect();

    expect(strict_doms).toEqual([1, 0])

    assert(!doms.strict_dominators(99)?.map(v => v));

    const dom_by = doms.immediately_dominated_by(1).collect();

    expect(dom_by).toEqual([2]);
    assert(doms.immediately_dominated_by(99).next().done)
})