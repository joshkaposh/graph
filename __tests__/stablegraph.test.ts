import { assert, test } from 'vitest'
import { Bfs, Dfs, Directed, Reversed, StableGraph } from '../src'
import { range } from 'joshkaposh-iterator'

test('node_indices', () => {
    const g = StableGraph.directed<number, number>()
    const a = g.add_node(0)
    const b = g.add_node(1)
    const c = g.add_node(2)
    g.remove_node(b);
    const it = g.node_indices();
    assert(it.next().value === a)
    assert(it.next().value === c)
    assert(it.next().done)
})

test('node_bound', () => {
    const g = StableGraph.directed<number, number>()

    range(0, 10).for_each(i => {
        g.add_node(i);
        assert(g.node_count() === g.node_bound())
    })

    const full_count = g.node_count();
    // console.log(full_count);
    g.remove_node(0);
    g.remove_node(2)
    // console.log(g.node_bound(), g.node_count());

    // assert(g.node_bound() === full_count)
    g.clear();
    assert(g.node_bound() === 0)
})

test('null weights', () => {
    const sg = StableGraph.directed<null, null>();
    const a = sg.add_node(null);
    const b = sg.add_node(null);
    const c = sg.add_node(null);

    assert(a === 0 && b === 1 && c === 2);

    sg.remove_node(b);

    assert(!sg.get_node(b))

    const d = sg.add_node(null);

    assert(b === d);
})

test('stablegraph', () => {
    const sg = StableGraph.directed<string, number>();
    const a = sg.add_node('A');
    const b = sg.add_node('B');
    const c = sg.add_node('C');

    assert(a === 0 && b === 1 && c === 2);

    sg.remove_node(b);

    assert(!sg.get_node(b))

    const d = sg.add_node('D');

    assert(b === d);

    sg.add_edge(a, b, 1);
    sg.add_edge(a, b, 2);

})

test('dfs', () => {
    const gr = StableGraph.directed<string, number>()
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
    assert(new Dfs(gr, h).iter(new Reversed(gr)).count() === 1);

    assert(new Dfs(gr, k).iter(new Reversed(gr)).count() === 3);
    assert(new Dfs(gr, i).iter(gr).count() === 3);
})

test('dfs order', () => {
    const gr = new StableGraph<string, null, Directed>()
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
    const gr = new StableGraph<string, number, Directed>();
    const h = gr.add_node('H');
    const i = gr.add_node('I');
    const j = gr.add_node('J');
    const k = gr.add_node('K');

    gr.add_edge(h, i, 1.)
    gr.add_edge(h, j, 3.)
    gr.add_edge(i, j, 1.)
    gr.add_edge(i, k, 2.)

    assert(new Bfs(gr, h).iter(gr).count() === 4);
    assert(new Bfs(gr, h).iter(new Reversed(gr)).count() === 1);


    assert(new Bfs(gr, k).iter(new Reversed(gr)).count() === 3);

    assert(new Bfs(gr, i).iter(gr).count() === 3);

    const bfs = new Bfs(gr, h);
    let nx = bfs.next(gr);
    assert(nx.value === h);

    let nx1 = bfs.next(gr).value;


    assert(nx1 === i || nx1 === j);

    let nx2 = bfs.next(gr);
    assert(nx2.value === i || nx2.value === j);
    assert(nx1.value !== nx2.value);

    nx = bfs.next(gr);
    assert(nx.value === k);
    assert(bfs.next(gr).done)
})

function panics(fn: () => void) {
    let res = false;
    try {
        fn()
    } catch (e) {
        res = true
    }
    return res
}

test('add_edge_vacant', () => {
    let g = new StableGraph<number, number, Directed>()
    let a = g.add_node(0);
    let b = g.add_node(1);
    g.add_node(2);
    g.remove_node(b);
    assert(panics(() => g.add_edge(a, b, 1)))
})

test('add_edge_oob', () => {
    let g = new StableGraph<number, number, Directed>()
    let a = g.add_node(0);
    g.add_node(1);
    g.add_node(2);

    assert(panics(() => g.add_edge(a, 4, 1)))
})

test('iter_multi_edges', () => {
    const gr = new StableGraph<string, null, Directed>();
    let a = gr.add_node('a')
    let b = gr.add_node('b')
    let c = gr.add_node('c')

    let connecting_edges = new Set();

    gr.add_edge(a, a, null)
    connecting_edges.add(gr.add_edge(a, b, null));
    gr.add_edge(a, c, null);
    gr.add_edge(c, b, null);
    connecting_edges.add(gr.add_edge(a, b, null))

    let it = gr.edges_connecting(a, b);

    let edge_id = it.next().value.id();
    assert(connecting_edges.has(edge_id));
    connecting_edges.delete(edge_id);

    edge_id = it.next().value.id();
    assert(connecting_edges.has(edge_id));
    connecting_edges.delete(edge_id);
    assert(connecting_edges.size === 0)
})

test('iter_multi_undirected_edges', () => {
    const gr = StableGraph.undirected<string, null>();
    let a = gr.add_node("a");
    let b = gr.add_node("b");
    let c = gr.add_node("c");

    const connecting_edges = new Set();

    gr.add_edge(a, a, null);
    connecting_edges.add(gr.add_edge(a, b, null));
    gr.add_edge(a, c, null);
    gr.add_edge(c, b, null);
    connecting_edges.add(gr.add_edge(a, b, null));
    connecting_edges.add(gr.add_edge(b, a, null));

    let it = gr.edges_connecting(a, b);

    let edge_id = it.next().value.id();
    assert(connecting_edges.has(edge_id));
    connecting_edges.delete(edge_id);

    edge_id = it.next().value.id();

    assert(connecting_edges.has(edge_id));
    connecting_edges.delete(edge_id);

    edge_id = it.next().value.id();

    assert(connecting_edges.has(edge_id));
    connecting_edges.delete(edge_id);

    assert(it.next().done)
    assert(connecting_edges.size === 0)
})
