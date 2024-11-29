import { assert, test } from 'vitest'
import { all_simple_paths, Directed, Graph } from '../src'

test('all_simple_paths', () => {
    const graph = Graph.from_edges(Directed, 32, () => null, [
        [0, 1, 1.5],
        [0, 2, 1.5],
        [0, 3, 1.5],
        [1, 2, 1.5],
        [1, 3, 1.5],
        [2, 3, 1.5],
        [2, 4, 1.5],
        [3, 2, 1.5],
        [3, 4, 1.5],
        [4, 2, 1.5],
        [4, 5, 1.5],
        [5, 2, 1.5],
        [5, 3, 1.5],
    ])

    let expected_simple_paths_0_to_5 = [
        [0, 1, 2, 3, 4, 5],
        [0, 1, 2, 4, 5],
        [0, 1, 3, 2, 4, 5],
        [0, 1, 3, 4, 5],
        [0, 2, 3, 4, 5],
        [0, 2, 4, 5],
        [0, 3, 2, 4, 5],
        [0, 3, 4, 5],
    ];

    let actual_simple_path_0_to_5 = all_simple_paths(graph, 0, 5, 0, null, Set).collect(Set);
})

test('one_simple_path', () => {
    const graph = Graph.from_edges(Directed, 32, () => 1.5, [
        [0, 1, 1.5],
        [2, 1, 1.5],
    ])

    const expected_0_to_1 = [[0, 1]];

    const actual_0_to_1 = all_simple_paths(graph, 0, 1, 0, undefined).collect();

})