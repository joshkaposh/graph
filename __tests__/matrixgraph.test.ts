import { test } from 'vitest'
import { MatrixGraph, next_power_of_2 } from '../src'
import { u32 } from 'fixed-bit-set/src/Intrinsics';

test('matrix', () => {
    const m = new MatrixGraph();

    let a = m.add_node('A');
    let b = m.add_node('B');
    let e = m.add_edge(a, b, 420);

    console.log(m.edge_weight(a, b));



    let mask = 0;



    // for (let i = 0; i < 100; i++) {
    //     console.log(next_power_of_2(i));

    // }




    console.log(a, b, e);
})