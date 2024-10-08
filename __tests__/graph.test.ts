import { test, expect, assert } from 'vitest'
import { is_none, is_some } from 'joshkaposh-option'
import { Graph, Bfs, Dfs, Reversed, Topo, is_cyclic_undirected, astar, Outgoing, Incoming, EdgeType, dijkstra, Directed, kosaraju_scc, Undirected, TarjanScc, NodeId, tarjan_scc, GraphMap, has_path_connecting } from '../src'
import { iter } from 'joshkaposh-iterator';

test('undirected_dedges()', () => {
    const og = Graph.undirected();
    const a = og.add_node(1);
    const b = og.add_node(2);
    const c = og.add_node(3);
    const d = og.add_node(4);

    og.add_edge(a, b, 1);

    const e = og.edges(b)

})

test('undirected', () => {
    const og = Graph.undirected();
    const a = og.add_node(1);
    const b = og.add_node(2);
    const c = og.add_node(3);
    const d = og.add_node(4);

    og.add_edge(a, b, 0);
    og.add_edge(a, c, 1);

    og.add_edge(c, a, 2);
    og.add_edge(a, a, 3);
    og.add_edge(b, c, 4);
    og.add_edge(b, a, 5);
    og.add_edge(a, d, 6);

    for (const edge of og.raw_edges()) {
        assert(is_some(og.find_edge(edge.source(), edge.target())));
        assert(is_some(og.find_edge(edge.target(), edge.source())));
    }

    expect(og.neighbors(b).collect()).toEqual([a, c, a]);

    og.remove_node(a);

    expect(og.neighbors(b).collect()).toEqual([c]);

    assert(og.node_count() === 3, `Count ${og.node_count()} != 3`)
    assert(og.edge_count() === 1, `Count ${og.edge_count()} != 1`);

    assert(is_none(og.find_edge(a, b)));
    assert(is_none(og.find_edge(d, a)));
    assert(is_none(og.find_edge(a, a)));
    assert(is_some(og.find_edge(b, c)));
})

test('dfs', () => {
    const gr = new Graph()
    const h = gr.add_node("H");
    const i = gr.add_node("I");
    const j = gr.add_node("J");
    const k = gr.add_node("K");
    // Z is disconnected.
    gr.add_node("Z");
    gr.add_edge(h, i, 1.);
    gr.add_edge(h, j, 3.);
    gr.add_edge(i, j, 1.);
    gr.add_edge(i, k, 2.);

    /*
    *  H  ->   I
    *  \/  /   \/ 
    *    </    
    *  J       K
     */
    assert(new Dfs(gr, h).iter(gr).count() === 4);
    assert(new Dfs(gr, h).iter(new Reversed(gr as any)).count() === 1);

    assert(new Dfs(gr, k).iter(new Reversed(gr as any)).count() === 3);
    assert(new Dfs(gr, i).iter(gr).count() === 3);
})

test('dfs order', () => {
    const gr = new Graph()
    const h = gr.add_node('H')
    const i = gr.add_node('I');
    const j = gr.add_node('j');
    const k = gr.add_node('k');

    gr.add_edge(h, i, null)
    gr.add_edge(h, j, null)
    gr.add_edge(h, k, null)

    gr.add_edge(i, k, null)
    gr.add_edge(k, i, null)

    let seen_i = false;
    let seen_k = false;

    for (const node of new Dfs(gr, h).iter(gr)) {
        // @ts-expect-error
        seen_i |= i === node;
        // @ts-expect-error
        seen_k |= k === node;
        // @ts-expect-error
        assert(!(j === node && seen_i ^ seen_k))
    }
})

test('bfs', () => {
    const gr = new Graph<string, number, Directed>();
    const h = gr.add_node('H');
    const i = gr.add_node('I');
    const j = gr.add_node('J');
    const k = gr.add_node('K');

    gr.add_edge(h, i, 1.)
    gr.add_edge(h, j, 3.)
    gr.add_edge(i, j, 1.)
    gr.add_edge(i, k, 2.)

    assert(new Bfs(gr, h).iter(gr).count() === 4);
    assert(new Bfs(gr, h).iter(new Reversed(gr as any)).count() === 1);

    assert(new Bfs(gr, k).iter(new Reversed(gr as any)).count() === 3);

    assert(new Bfs(gr, i).iter(gr).count() === 3);

    const bfs = new Bfs(gr, h);
    let nx = bfs.next(gr);
    assert(nx.value === h);

    let nx1 = bfs.next(gr);
    assert(nx1.value === i || nx1.value === j);

    let nx2 = bfs.next(gr);
    assert(nx2.value === i || nx2.value === j);
    assert(nx1.value !== nx2.value);

    nx = bfs.next(gr);
    assert(nx.value === k);
    assert(bfs.next(gr).done)
})

test('selfloop', () => {
    const gr = new Graph();
    const a = gr.add_node('A');
    const b = gr.add_node('B');
    const c = gr.add_node('C');

    gr.add_edge(a, b, 7.)
    gr.add_edge(c, a, 6.)
    let sed = gr.add_edge(a, a, 2.);

    assert(is_some(gr.find_edge(a, b)))
    assert(is_none(gr.find_edge(b, a)))
    assert(is_some(gr.find_edge_undirected(b, a)))
    assert(is_some(gr.find_edge(a, a)))
    gr.remove_edge(sed);
    assert(is_none(gr.find_edge(a, a)))
})

test('cyclic', () => {
    let gr = new Graph();
    let a = gr.add_node('A')
    let b = gr.add_node('B')
    let c = gr.add_node('C')
    let d = gr.add_node('D');
    let e = gr.add_node('E');
    let f = gr.add_node('F');

    /*
        this works
        A - B - C
        |   |   |
        D   E - F
     */

    gr.add_edge(a, b, 0);
    gr.add_edge(b, c, 0);
    gr.add_edge(b, e, 0);
    gr.add_edge(c, f, 0);

    assert(!is_cyclic_undirected(gr));

    gr.add_edge(e, f, 0)

    gr = new Graph();
    a = gr.add_node('A');
    b = gr.add_node('B');
    c = gr.add_node('C');

    assert(!is_cyclic_undirected(gr));
    gr.add_edge(a, b, 7.)
    gr.add_edge(c, a, 6.)
    assert(!is_cyclic_undirected(gr));

    let temp = gr.add_edge(a, a, 0);
    assert(is_cyclic_undirected(gr));
    gr.remove_edge(temp);
    assert(!is_cyclic_undirected(gr));

    temp = gr.add_edge(b, c, 0);
    assert(is_cyclic_undirected(gr));
    gr.remove_edge(temp);
    assert(!is_cyclic_undirected(gr));

    d = gr.add_node('D');
    e = gr.add_node('E');
    gr.add_edge(b, d, 0);
    gr.add_edge(d, e, 0);
    assert(!is_cyclic_undirected(gr));
    gr.add_edge(c, e, 0);
    assert(is_cyclic_undirected(gr));

})

test('multi', () => {
    const gr = new Graph();
    let a = gr.add_node('a');
    let b = gr.add_node('b');

    gr.add_edge(a, b, null);
    gr.add_edge(a, b, null);
    assert(gr.edge_count() === 2)
})

test('iter_multi_edges', () => {
    const gr = new Graph();
    const a = gr.add_node('a');
    const b = gr.add_node('b');
    const c = gr.add_node('c');

    const connecting_edges = new Set();

    gr.add_edge(a, a, null);
    connecting_edges.add(gr.add_edge(a, b, null))
    gr.add_edge(a, c, null);
    gr.add_edge(c, b, null);
    connecting_edges.add(gr.add_edge(a, b, null))
    gr.add_edge(b, a, null);

    const it = gr.edges_connecting(a, b);

    let edge_id = it.next().value.id();

    assert(connecting_edges.has(edge_id))
    connecting_edges.delete(edge_id);

    edge_id = it.next().value.id()
    assert(connecting_edges.has(edge_id))
    connecting_edges.delete(edge_id)

    assert(it.next().done === true);
    assert(connecting_edges.size === 0);
})

test('iter_multi_undirected_edges', () => {
    const gr = Graph.undirected();
    const a = gr.add_node('a')
    const b = gr.add_node('b')
    const c = gr.add_node('c')

    const connecting_edges = new Set();

    gr.add_edge(a, a, null)
    connecting_edges.add(gr.add_edge(a, b, null))
    gr.add_edge(a, c, null);
    gr.add_edge(c, b, null);
    connecting_edges.add(gr.add_edge(a, b, null))
    connecting_edges.add(gr.add_edge(b, a, null))

    const it = gr.edges_connecting(a, b);

    let edge_id = it.next().value.id();
    assert(connecting_edges.has(edge_id))
    connecting_edges.delete(edge_id)

    edge_id = it.next()?.value?.id();
    // assert(connecting_edges.has(edge_id))
    // connecting_edges.delete(edge_id)

    // edge_id = it.next().value.id();
    // assert(connecting_edges.has(edge_id))
    // connecting_edges.delete(edge_id)


})

test('topo', () => {
    // const gr = new Graph()
})

test('update_edge', () => {
    let gr = new Graph();
    let a = gr.add_node('a');
    let b = gr.add_node('b');
    let e = gr.update_edge(a, b, 1);
    let f = gr.update_edge(a, b, 2);
    let _ = gr.update_edge(b, a, 3);

    assert(gr.edge_count() === 2);
    assert(e === f);
    assert(gr.edge_weight(f) === 2);

    gr = Graph.undirected();
    a = gr.add_node('a');
    b = gr.add_node('b');
    e = gr.update_edge(a, b, 1);
    f = gr.update_edge(b, a, 2);
    assert(gr.edge_count() === 1);
    assert(e === f)
    assert(gr.edge_weight(f) === 2);
})

test('dijkstra', () => {
    const g = Graph.undirected();
    let a = g.add_node('A')
    let b = g.add_node('B')
    let c = g.add_node('C')
    let d = g.add_node('D')
    let e = g.add_node('E')
    let f = g.add_node('F')

    g.add_edge(a, b, 7);
    g.add_edge(c, a, 9);
    g.add_edge(a, d, 14);
    g.add_edge(b, c, 10);
    g.add_edge(d, c, 2);
    g.add_edge(d, e, 9);
    g.add_edge(b, f, 15);
    g.add_edge(c, f, 11);
    g.add_edge(e, f, 6);

    let _scores = dijkstra(g, a, undefined, e => e.weight(), 0)
    let scores = iter(_scores).map(([n, s]) => [g.node_weight(n), s]).collect();
    scores.sort();

    expect(scores).toEqual([
        ['A', 0],
        ['B', 7],
        ['C', 9],
        ['D', 11],
        ['E', 20],
        ['F', 20],
    ])

    let scores2 = dijkstra(g, a, c, e => e.weight(), 0);

    // assert(scores2.get(c) === 9)

})

test('a_star_null_heuristic', () => {
    let g = Graph.directed<string, number>();
    let a = g.add_node('A');
    let b = g.add_node('B');
    let c = g.add_node('C');
    let d = g.add_node('D');
    let e = g.add_node('E');
    let f = g.add_node('F');

    g.add_edge(a, b, 7);
    g.add_edge(c, a, 9);
    g.add_edge(a, d, 14);
    g.add_edge(b, c, 10);
    g.add_edge(d, c, 2);
    g.add_edge(d, e, 9);
    g.add_edge(b, f, 15);
    g.add_edge(c, f, 11);
    g.add_edge(c, a, 23);

    g.add_edge(e, f, 6);

    let path = astar(g, a, finish => finish === e, e => e.weight() as number, () => 0);
    // should be [23, [a, d, e]] or [23, [0, 3, 4]]; 
    expect(path).toEqual([23, [a, d, e]])

    const dijkstra_run = dijkstra(g, a, e, e => e.weight(), 0);

    path = astar(g, e, finish => finish === b, e => e.weight(), () => 0);
    assert(is_none(path))
})

test('astar manhattan', () => {
    let g = Graph.directed<[number, number], number>();

    let a = g.add_node([0., 0.]);
    let b = g.add_node([2., 0.]);
    let c = g.add_node([1., 1.]);
    let d = g.add_node([0., 2.]);
    let e = g.add_node([3., 3.]);
    let f = g.add_node([4., 2.]);
    let _ = g.add_node([5., 5.]); // no path to node
    g.add_edge(a, b, 2.);
    g.add_edge(a, d, 4.);
    g.add_edge(b, c, 1.);
    g.add_edge(b, f, 7.);
    g.add_edge(c, e, 5.);
    g.add_edge(e, f, 1.);
    g.add_edge(d, e, 1.);

    const nodes = g.node_references().map(ref => [ref.id(), ref.weight()]).collect()
    const edges = g.edge_references().map(ref => [ref.id(), ref.weight()]).collect()


    // let _scores = dijkstra(g, a, undefined, e => e.weight(), 0);
    // let scores = iter(_scores).map(([n, s]) => [g.node_weight(n), s]).collect();
    // scores.sort();

    // expect(scores).toEqual([
    //     ['A', 0],
    //     ['B', 7],
    //     ['C', 9],
    //     ['D', 11],
    //     ['E', 20],
    //     ['F', 20],
    // ])

    function heuristic_for(f: number) {
        return (node: number) => {
            let [x1, y1] = g.node_weight(node)!;
            let [x2, y2] = g.node_weight(f)!
            return Math.abs(x2 - x1) + Math.abs(y2 - y1)
        }
    }

    const path = astar(g, a, finish => finish === f, e => e.weight(), heuristic_for(f));

    expect(path).toEqual([6, [a, d, e, f]]);
})


test('astar grid', () => {
    let g = new Graph<[number, number], number, EdgeType>();

    const cols = 5;
    const rows = 5;

    function get_index(x: number, y: number, cols: number) {
        return y * cols + x;
    }

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            g.add_node([x, y]); // add grid node
        }
    }

    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            if (y - 1 >= 0) {
                // add top
                g.add_edge(get_index(x, y, cols), get_index(x, y - 1, cols), 1)
            }
            if (x + 1 < cols) {
                // add right
                g.add_edge(get_index(x, y, cols), get_index(x + 1, y, cols), 1)

            }

            if (y + 1 < rows) {
                // add bottom
                g.add_edge(get_index(x, y, cols), get_index(x, y + 1, cols), 1)

            }

            if (x - 1 >= 0) {
                // add left
                g.add_edge(get_index(x, y, cols), get_index(x - 1, y, cols), 1)
            }

        }
    }

    function manhattan(f: number) {
        return (node: number) => {
            let [x1, y1] = g.node_weight(node)!;
            let [x2, y2] = g.node_weight(f)!
            return (Math.abs(x2 - x1)) + (Math.abs(y2 - y1))
        }
    }

    function heuristic(f: number) {
        return (node: number) => {
            let [x1, y1] = g.node_weight(node)!;
            let [x2, y2] = g.node_weight(f)!
            return Math.sqrt(x1 * x2 + y1 * y2);
        }
    }
    let start = 0;
    let end = 24;

    let path = astar(g, start, finish => finish === end, e => e.weight(), heuristic(end));

})

test('astar_runtime_optimal', () => {
    let g = Graph.directed<string, number>();
    let a = g.add_node("A");
    let b = g.add_node("B");
    let c = g.add_node("C");
    let d = g.add_node("D");
    let e = g.add_node("E");
    g.add_edge(a, b, 2);
    g.add_edge(a, c, 3);
    g.add_edge(b, d, 3);
    g.add_edge(c, d, 1);
    g.add_edge(d, e, 1);

    let times_called = 0;
    astar(g, a, n => n === e, edge => {
        times_called++;
        return edge.weight();
    },
        () => 0)

    assert(times_called === 5)
})

test('without', () => {
    let og = Graph.undirected<number, number>()

    let a = og.add_node(0);
    let b = og.add_node(1);
    let c = og.add_node(2);
    let d = og.add_node(3);
    og.add_edge(a, b, 0);
    og.add_edge(a, c, 1);

    const v = og.externals(Outgoing).collect()

    expect(v).toEqual([d])

    og = Graph.undirected();
    a = og.add_node(0);
    b = og.add_node(1);
    c = og.add_node(2);
    d = og.add_node(3);
    og.add_edge(a, b, 0);
    og.add_edge(a, c, 1);

    const init = og.externals(Incoming).collect();
    const term = og.externals(Outgoing).collect();

    // expect(init).toEqual([a, d]);
    // expect(term).toEqual([b, c, d]);
})

function assert_sccs_eq<T>(res: Array<T[]>, answer: Array<T[]>, scc_order_matter: boolean) {
    for (const scc of res) {
        scc.sort()
    }

    for (const scc of answer) {
        scc.sort()
    }

    if (!scc_order_matter) {
        res.sort();
        answer.sort();
    }

    expect(res).toEqual(answer)
}

test('kosaraju_scc', () => {
    let gr = Graph.from_edges(Directed, 32, () => 0, [
        [6, 0, 0],
        [0, 3, 0],
        [3, 6, 0],
        [8, 6, 0],
        [8, 2, 0],
        [2, 5, 0],
        [5, 8, 0],
        [7, 5, 0],
        [1, 7, 0],
        [7, 4, 0],
        [4, 1, 0],
    ])

    assert_sccs_eq(
        kosaraju_scc(gr),
        [
            [0, 3, 6],
            [2, 5, 8],
            [1, 4, 7]
        ],
        true
    )

    assert_sccs_eq(
        kosaraju_scc(new Reversed(gr)),
        [
            [1, 4, 7],
            [2, 5, 8],
            [0, 3, 6]
        ],
        true
    )

    const hr = gr.into_edge_type(Undirected);
    const ed = hr.find_edge(6, 8)!;
    assert(is_some(hr.remove_edge(ed)))

    assert_sccs_eq(
        kosaraju_scc(hr),
        [
            [0, 3, 6],
            [1, 2, 4, 5, 7, 8]
        ],
        false
    )

    gr = new Graph();
    gr.add_node(0);
    gr.add_node(1);
    gr.add_node(2);
    gr.add_node(3);
    gr.add_edge(3, 2, 0);
    gr.add_edge(3, 1, 0);
    gr.add_edge(2, 0, 0);
    gr.add_edge(1, 0, 0);

    assert_sccs_eq(kosaraju_scc(gr), [[0], [1], [2], [3]], true)

    gr = new Graph();
    gr.extend_with_edges([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 2, 0]], () => 0)
    gr.add_node(0);

    assert_sccs_eq(kosaraju_scc(gr), [[0], [1], [2], [3]], false)
})

test('tarjan_scc', () => {
    let gr = Graph.from_edges(Directed, 32, () => 0, [
        [6, 0, 0],
        [0, 3, 0],
        [3, 6, 0],
        [8, 6, 0],
        [8, 2, 0],
        [2, 5, 0],
        [5, 8, 0],
        [7, 5, 0],
        [1, 7, 0],
        [7, 4, 0],
        [4, 1, 0],
    ])

    let tarjan_scc = new TarjanScc<NodeId<typeof gr>>();
    let result: number[][] = [];

    tarjan_scc.run(gr, scc => result.push(iter(scc).rev().collect()))
    assert_sccs_eq(
        result,
        [
            [0, 3, 6],
            [2, 5, 8],
            [1, 4, 7]
        ],
        true
    )

    let hr = gr.into_edge_type(Undirected);
    let ed = hr.find_edge(6, 8)!;
    assert(is_some(hr.remove_edge(ed)));

    result = [];
    tarjan_scc.run(hr, scc => result.push(iter(scc).rev().collect()))
    assert_sccs_eq(result, [
        [1, 2, 4, 5, 7, 8],
        [0, 3, 6]
    ], false)

    // acyclic non-tree
    gr = new Graph();
    gr.add_node(0);
    gr.add_node(1)
    gr.add_node(2)
    gr.add_node(3)
    gr.add_edge(3, 2, 0)
    gr.add_edge(3, 1, 0)
    gr.add_edge(2, 0, 0)
    gr.add_edge(1, 0, 0)

    result = [];
    tarjan_scc.run(gr, scc => result.push(iter(scc).rev().collect()))
    assert_sccs_eq(result, [[0], [1], [2], [3]], true)

    // Kosaraju bug
    gr = new Graph();
    gr.extend_with_edges([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 2, 0]], () => 0);
    gr.add_node(0);
    result = []
    tarjan_scc.run(gr, scc => result.push(iter(scc).rev().collect()))
    assert_sccs_eq(result, [[0], [1], [2], [3]], false)
})

test('tarjan_scc_graphmap', () => {
    let gr = GraphMap.from_edges(Directed, [
        [6, 0, 1.5],
        [0, 3, 1.5],
        [3, 6, 1.5],
        [8, 6, 1.5],
        [8, 2, 1.5],
        [2, 5, 1.5],
        [5, 8, 1.5],
        [7, 5, 1.5],
        [1, 7, 1.5],
        [7, 4, 1.5],
        [4, 1, 1.5],
    ])
    let tarjan_scc = new TarjanScc<NodeId<typeof gr>>();
    let result: NodeId<typeof gr>[][] = [];

    tarjan_scc.run(gr, scc => result.push(iter(scc).rev().collect()))
    assert_sccs_eq(
        result,
        [
            [0, 3, 6],
            [2, 5, 8],
            [1, 4, 7]
        ],
        true
    )

    // acyclic non-tree
    gr = new GraphMap();
    let a = gr.add_node(0);
    let b = gr.add_node(1)
    let c = gr.add_node(2)
    let d = gr.add_node(3)
    gr.add_edge(d, c, 1.5)
    gr.add_edge(d, b, 1.5)
    gr.add_edge(c, a, 1.5)
    gr.add_edge(b, a, 1.5)


    result = [];
    tarjan_scc.run(gr, scc => result.push(iter(scc).rev().collect()))
    assert_sccs_eq(result, [[0], [1], [2], [3]], true)

    // Kosaraju bug
    gr = new GraphMap();
    a = gr.add_node(0)
    b = gr.add_node(1);
    c = gr.add_node(2);
    gr.add_edge(a, a, 0);
    gr.add_edge(b, a, 0);
    gr.add_edge(c, a, 0);
    gr.add_edge(c, b, 0);
    gr.add_edge(c, c, 0)
    gr.add_node(3);
    result = []
    tarjan_scc.run(gr, scc => result.push(iter(scc).rev().collect()))
    console.log(result);

    assert_sccs_eq(result, [[0], [1], [2], [3]], false)

})

test('has_path_connecting', () => {
    const gr = new Graph();
    gr.add_node(0);
    gr.add_node(1);
    gr.add_node(2);
    gr.add_node(3);

    assert(!has_path_connecting(gr, 0, 1));

    gr.add_edge(0, 1, 0);
    gr.add_edge(1, 2, 0);
    gr.add_edge(2, 3, 0);

    assert(has_path_connecting(gr, 0, 3));
    gr.remove_edge(gr.find_edge(1, 2)!);

    assert(has_path_connecting(gr, 0, 1));
    assert(has_path_connecting(gr, 2, 3));

    gr.add_edge(1, 2, 0);
    assert(has_path_connecting(gr, 0, 3));
})