import { assert, expect, test } from 'vitest'
import { GraphMap, NodeTrait, } from '../src/graphmap';
import { Directed, Direction, Graph, Incoming, Outgoing, Undirected } from '../src/graph';
import { is_none, is_some } from 'joshkaposh-option';
import { Dfs, VisitorSet } from '../src';

test('simple', () => {
    const gr = GraphMap.undirected<string, number>();

    let a = gr.add_node("A");
    let b = gr.add_node("B");
    let c = gr.add_node("C");
    let d = gr.add_node("D");
    let e = gr.add_node("E");
    let f = gr.add_node("F");
    gr.add_edge(a, b, 7);
    gr.add_edge(a, c, 9);
    gr.add_edge(a, d, 14);
    gr.add_edge(b, c, 10);
    gr.add_edge(c, d, 2);
    gr.add_edge(d, e, 9);
    gr.add_edge(b, f, 15);
    gr.add_edge(c, f, 11);

    assert(!is_some(gr.add_edge(e, f, 5)))

    assert(gr.add_edge(f, b, 16) === 15);
})

test('edges_directed', () => {
    const gr = GraphMap.directed<string, number>();
    let a = gr.add_node("A");
    let b = gr.add_node("B");
    let c = gr.add_node("C");
    let d = gr.add_node("D");
    let e = gr.add_node("E");
    let f = gr.add_node("F");
    gr.add_edge(a, b, 7);
    gr.add_edge(a, c, 9);
    gr.add_edge(a, d, 14);
    gr.add_edge(b, c, 10);
    gr.add_edge(c, d, 2);
    gr.add_edge(d, e, 9);
    gr.add_edge(b, f, 15);
    gr.add_edge(c, f, 11);

    let edges_out = gr.edges_directed(c, Direction.Outgoing());

    expect(edges_out.next().value).toEqual([c, d, 2])
    expect(edges_out.next().value).toEqual([c, f, 11])
    assert(edges_out.next().done)

    edges_out = gr.edges_directed(c, Direction.Incoming())
    expect(edges_out.next().value).toEqual([a, c, 9])
    expect(edges_out.next().value).toEqual([b, c, 10])
    assert(edges_out.next().done)
})

test('remove', () => {
    const g = GraphMap.undirected<string, number>();
    g.add_node('A')
    g.add_node('B')
    g.add_edge('A', 'B', -1);

    assert(g.edge_weight('A', 'B') === -1);
    assert(g.edge_weight('B', 'A') === -1);
    assert(g.neighbors('A').count() === 1);

    let noexist = g.remove_edge('A', 'C');
    assert(is_none(noexist))

    let exist = g.remove_edge('B', 'A')
    assert(exist === -1);
    assert(g.edge_count() === 0);
    assert(is_none(g.edge_weight('A', 'B')))
    assert(is_none(g.edge_weight('B', 'A')))
    assert(g.neighbors('A').count() === 0);

})

test('remove_node', () => {
    const graph = GraphMap.directed<number, null>();
    graph.add_edge(1, 2, null);
    graph.remove_node(2);

    let neighbors = graph.neighbors(1).collect();

    expect(neighbors).toEqual([]);

    let edges = graph.all_edges().collect();
    expect(edges).toEqual([])
})

test('remove_directed', () => {
    const g = GraphMap.directed<number, number>();
    g.add_edge(1, 2, -1);


    assert(g.edge_weight(1, 2) === -1);
    assert(is_none(g.edge_weight(2, 1)));
    assert(g.neighbors(1).count() === 1);


    let noexist = g.remove_edge(2, 3);
    assert(is_none(noexist));

    let exist = g.remove_edge(2, 1);
    assert(is_none(exist));
    exist = g.remove_edge(1, 2);
    assert(exist === -1);
    assert(g.edge_count() === 0);
    assert(is_none(g.edge_weight(1, 2)));
    assert(is_none(g.edge_weight(2, 1)));
    assert(g.neighbors(1).count() === 0);
})

test('dfs', () => {
    const gr = GraphMap.undirected<string, number>();
    let h = gr.add_node("H");
    let i = gr.add_node("I");
    let j = gr.add_node("J");
    let k = gr.add_node("K");
    // Z is disconnected.
    let z = gr.add_node("Z");
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

    let count = 0;
    let dfs = new Dfs(gr, h);
    while (!dfs.next(gr).done) { count++ }

    assert(count === 4)

    assert(new Dfs(gr, h).iter(gr).count() === 4)
    assert(new Dfs(gr, i).iter(gr).count() === 4)
    assert(new Dfs(gr, z).iter(gr).count() === 1)
})

test('edge_iterator', () => {
    const gr = GraphMap.undirected<string, number>()
    let h = gr.add_node("H");
    let i = gr.add_node("I");
    let j = gr.add_node("J");
    let k = gr.add_node("K");
    gr.add_edge(h, i, 1);
    gr.add_edge(h, j, 2);
    gr.add_edge(i, j, 3);
    gr.add_edge(i, k, 4);

    const real_edges = gr.all_edges().collect(Set);
    const expected_edges = new Set([['H', 'I', 1], ["H", 'J', 2], ['I', 'J', 3], ['I', 'K', 4]])
    expect(real_edges).toEqual(expected_edges);
})

test('from_edges', () => {
    let gr = GraphMap.from_edges(Undirected, [
        ['a', 'b', 1],
        ['a', 'c', 2],
        ['c', 'd', 3],
    ])
    assert(gr.node_count() === 4);
    assert(gr.edge_count() === 3);
    assert(gr.edge_weight('a', 'c') === 2);
    // @ts-expect-error
    gr = GraphMap.from_edges(Undirected, [
        [0, 1, null],
        [0, 2, null],
        [0, 3, null],
        [1, 2, null],
        [1, 3, null],
        [2, 3, null],
    ])

    assert(gr.node_count() === 4);
    assert(gr.edge_count() === 6);
    // @ts-expect-error
    assert(gr.neighbors(0).count() === 3)
    // @ts-expect-error
    assert(gr.neighbors(1).count() === 3)
    // @ts-expect-error
    assert(gr.neighbors(2).count() === 3)
    // @ts-expect-error
    assert(gr.neighbors(3).count() === 3)
})

test('graphmap_directed', () => {
    const gr = GraphMap.with_capacity<string, 1, Directed>(Directed, 0, 0);

    let a = gr.add_node("A");
    let b = gr.add_node("B");
    let c = gr.add_node("C");
    let d = gr.add_node("D");
    let e = gr.add_node("E");
    let edges: Iterable<[string, string, 1]> = [[a, b, 1], [a, c, 1], [a, d, 1], [b, c, 1], [c, d, 1], [d, e, 1], [b, b, 1]];
    gr.extend(edges)

    assert(!is_some(gr.add_edge(e, d, 1)))
    assert(is_some(gr.add_edge(a, b, 1)))
    assert(is_some(gr.add_edge(a, b, 1)))
})

test('into_graph', () => {
    const gr = GraphMap.from_edges(Directed, [
        [6, 0, 0],
        [0, 3, 1],
        [3, 6, 2],
        [8, 6, 3],
        [8, 2, 4],
        [2, 5, 5],
        [5, 8, 6],
        [7, 5, 7],
        [1, 7, 8],
        [7, 4, 9],
        [4, 1, 10],
    ])

    let graph = gr.into_graph();

    for (const edge of graph.edge_references()) {
        let a = edge.source();
        let b = edge.target();
        let aw = graph.node_weight(a)!
        let bw = graph.node_weight(b)!

        expect(gr.edge_weight(aw, bw)).toEqual(edge.weight())
    }
})

test('from_graph', () => {
    const gr = Graph.directed<number, number>()
    let a = gr.add_node(12);
    let b = gr.add_node(13);
    let c = gr.add_node(14);

    gr.add_edge(a, b, 1000);
    gr.add_edge(b, c, 999);
    gr.add_edge(c, a, 1111);

    gr.add_node(42);

    const graph = GraphMap.from_graph(gr);

    assert(graph.edge_weight(12, 13) === 1000)
})

test('neighbors_incoming_includes_self_loops', () => {
    const graph = GraphMap.directed<0, null>();

    graph.add_node(0)
    graph.add_edge(0, 0, null);
    const n = graph.neighbors_directed(0, Incoming);
    assert(!n.next().done)
    assert(n.next().done)
})

test('undirected_neighbors_incoming_includes_self_loops', () => {
    const graph = GraphMap.undirected<0, null>();

    graph.add_node(0)
    graph.add_edge(0, 0, null);
    const n = graph.neighbors_directed(0, Incoming);
    assert(!n.next().done)
    assert(n.next().done)
})

test('self_loops_can_be_removed', () => {
    let graph = GraphMap.directed();

    graph.add_node(0);
    graph.add_edge(0, 0, null);

    graph.remove_edge(0, 0);

    assert(graph.neighbors_directed(0, Outgoing).next().done);
    assert(graph.neighbors_directed(0, Incoming).next().done);
}) 