import { assert, expect, test } from 'vitest'
import { IdStorage, Incoming, MatrixGraph, Outgoing } from '../src'

type Unit = typeof Unit;
const Unit = Symbol('UNIT');

test('new_matrix', () => {
    const g = new MatrixGraph();
    assert(g.node_count() === 0)
    assert(g.edge_count() === 0)
})

test('with_capacity', () => {
    const g = MatrixGraph.with_capacity(10);
    assert(g.node_count() === 0);
    assert(g.edge_count() === 0);
})

test('node_indexing', () => {
    const g = new MatrixGraph();
    const a = g.add_node('a')
    const b = g.add_node('b');
    assert(g.node_count() === 2);
    assert(g.edge_count() === 0);
    assert(g.node_weight(a) === 'a');
    assert(g.node_weight(b) === 'b');
})

test('remove_node', () => {
    const g = new MatrixGraph();
    const a = g.add_node('a');
    g.remove_node(a);
    assert(g.node_count() === 0);
    assert(g.edge_count() === 0);
})

test('add_edge', () => {
    const g = new MatrixGraph();
    const a = g.add_node('a')
    const b = g.add_node('b')
    const c = g.add_node('c')

    g.add_edge(a, b, null);
    g.add_edge(b, c, null);
    assert(g.node_count() === 3);
    assert(g.edge_count() === 2);
})

test('add_edge_with_extension', () => {
    const g = new MatrixGraph();
    let _n0 = g.add_node(0)
    let n1 = g.add_node(1)
    let n2 = g.add_node(2)
    let n3 = g.add_node(3)
    let n4 = g.add_node(4)
    let _n5 = g.add_node(5)

    g.add_edge(n2, n1, 0)
    g.add_edge(n2, n3, 0)
    g.add_edge(n2, n4, 0)
    assert(g.node_count() === 6);
    assert(g.edge_count() === 3);
    assert(g.has_edge(n2, n1))
    assert(g.has_edge(n2, n3))
    assert(g.has_edge(n2, n4))
})

test('matrix_resize', () => {
    const g = MatrixGraph.with_capacity(3);
    let n0 = g.add_node(0);
    let n1 = g.add_node(1)
    let n2 = g.add_node(2)
    let n3 = g.add_node(3)

    g.add_edge(n1, n0, Unit);
    g.add_edge(n1, n1, Unit);
    // triggers a resize from capacity 3 to 4
    g.add_edge(n2, n3, Unit);
    assert(g.node_count() === 4)
    assert(g.edge_count() === 3);
    assert(g.has_edge(n1, n0));
    assert(g.has_edge(n1, n1));
    assert(g.has_edge(n2, n3));
})

test('add_edge_with_weights', () => {
    const g = new MatrixGraph();
    let a = g.add_node('a')
    let b = g.add_node('b')
    let c = g.add_node('c')
    g.add_edge(a, b, true);
    g.add_edge(b, c, false);
    assert(g.edge_weight(a, b) === true)
    assert(g.edge_weight(b, c) === false)
})

test('add_edge_with_weights_undirected', () => {
    const g = MatrixGraph.undirected<string, string>()
    let a = g.add_node('a')
    let b = g.add_node('b')
    let c = g.add_node('c')
    let d = g.add_node('d')
    g.add_edge(a, b, 'ab');
    g.add_edge(a, a, 'aa');
    g.add_edge(b, c, 'bc');
    g.add_edge(d, d, 'dd');
    assert(g.edge_weight(a, b) === 'ab')
    assert(g.edge_weight(b, c) === 'bc')
})

test('clear', () => {
    const g = new MatrixGraph();
    let a = g.add_node('a');
    let b = g.add_node('b');
    let c = g.add_node('c');
    assert(g.node_count() === 3)
    g.add_edge(a, b, Unit);
    g.add_edge(b, c, Unit);
    g.add_edge(c, a, Unit);
    assert(g.edge_count() === 3);

    g.clear();

    assert(g.node_count() === 0)
    assert(g.edge_count() === 0)

    a = g.add_node('a')
    b = g.add_node('b')
    c = g.add_node('c')
    assert(g.node_count() === 3);
    assert(g.edge_count() === 0);

    expect(g.neighbors_directed(a, Incoming).collect()).toEqual([]);
    expect(g.neighbors_directed(b, Incoming).collect()).toEqual([]);
    expect(g.neighbors_directed(c, Incoming).collect()).toEqual([]);


    expect(g.neighbors_directed(a, Outgoing).collect()).toEqual([]);
    expect(g.neighbors_directed(b, Outgoing).collect()).toEqual([]);
    expect(g.neighbors_directed(c, Outgoing).collect()).toEqual([]);
})

test('clear_undirected', () => {
    const g = MatrixGraph.undirected<string, Unit>();
    let a = g.add_node('a');
    let b = g.add_node('b');
    let c = g.add_node('c');
    assert(g.node_count() === 3);

    g.add_edge(a, b, Unit);
    g.add_edge(b, c, Unit);
    g.add_edge(c, a, Unit);
    assert(g.edge_count() === 3);

    g.clear();

    assert(g.node_count() === 0);
    assert(g.edge_count() === 0);

    a = g.add_node('a');
    b = g.add_node('b');
    c = g.add_node('c');
    assert(g.node_count() === 3);
    assert(g.edge_count() === 0);

    expect(g.neighbors(a).collect()).toEqual([]);
    expect(g.neighbors(b).collect()).toEqual([]);
    expect(g.neighbors(c).collect()).toEqual([]);
})

test('neighbors', () => {
    const g = new MatrixGraph();
    let a = g.add_node('a')
    let b = g.add_node('b')
    let c = g.add_node('c')

    g.add_edge(a, b, Unit);
    g.add_edge(a, c, Unit);

    const a_neighbors = g.neighbors(a).collect();
    expect(a_neighbors.sort()).toEqual([b, c]);


    const b_neighbors = g.neighbors(b).collect();
    expect(b_neighbors.sort()).toEqual([]);

    const c_neighbors = g.neighbors(c).collect();
    expect(c_neighbors.sort()).toEqual([]);
})

test('neighbors_undirected', () => {
    const g = MatrixGraph.undirected();
    let a = g.add_node('a')
    let b = g.add_node('b')
    let c = g.add_node('c')

    g.add_edge(a, b, Unit);
    g.add_edge(a, c, Unit);

    const a_neighbors = g.neighbors(a).collect().sort();
    const b_neighbors = g.neighbors(b).collect().sort();
    const c_neighbors = g.neighbors(c).collect().sort();

    expect(a_neighbors).toEqual([b, c])
    expect(b_neighbors).toEqual([a])
    expect(c_neighbors).toEqual([a])
})

test('remove_node_and_edges', () => {
    const g = new MatrixGraph();
    let a = g.add_node('a')
    let b = g.add_node('b')
    let c = g.add_node('c')
    g.add_edge(a, b, Unit);
    g.add_edge(b, c, Unit);
    g.add_edge(c, a, Unit);

    // removing b should unlink `a -> b` and `b -> c` edges
    g.remove_node(b);

    assert(g.node_count() === 2)

    const a_neighbors = g.neighbors(a).collect().sort();
    expect(a_neighbors).toEqual([]);

    const c_neighbors = g.neighbors(c).collect().sort();
    expect(c_neighbors).toEqual([a]);
})

test('remove_node_and_edges_undirected', () => {
    const g = MatrixGraph.undirected();
    let a = g.add_node('a');
    let b = g.add_node('b');
    let c = g.add_node('c');

    g.add_edge(a, b, Unit)
    g.add_edge(b, c, Unit)
    g.add_edge(c, a, Unit)

    // removing b should unlink `a -- b` and `b -- c` edges
    g.remove_node(a);

    assert(g.node_count() === 2);

    const b_neighbors = g.neighbors(b).collect().sort();
    expect(b_neighbors).toEqual([c]);

    const c_neighbors = g.neighbors(c).collect().sort();
    expect(c_neighbors).toEqual([b]);
})

test('node_identifiers', () => {
    const g = new MatrixGraph();

    let a = g.add_node('a');
    let b = g.add_node('b');
    let c = g.add_node('c');
    let d = g.add_node('c');
    g.add_edge(a, b, Unit);
    g.add_edge(a, c, Unit);

    const node_ids = g.node_identifiers().collect().sort();

    expect(node_ids).toEqual([a, b, c, d]);
})

test('edges_directed', () => {
    const g = MatrixGraph.directed();

    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)


    g.add_edge(0, 5, Unit)
    g.add_edge(0, 2, Unit)
    g.add_edge(0, 3, Unit)
    g.add_edge(0, 1, Unit)
    g.add_edge(1, 3, Unit)
    g.add_edge(2, 3, Unit)
    g.add_edge(2, 4, Unit)
    g.add_edge(4, 0, Unit)
    g.add_edge(6, 6, Unit)


    console.log(g.node_capacity);

    let ed = g.edges_directed(0, Outgoing);

    console.log(ed.next().value);
    console.log(ed.next().value);
    console.log(ed.next().value);
    console.log(ed.next().value);
    console.log(ed.next().value);

    // console.log(g.edges_directed(0, Outgoing).count(), 4);
    // console.log(g.edges_directed(1, Outgoing).count(), 1);
    // console.log(g.edges_directed(2, Outgoing).count(), 2);
    // console.log(g.edges_directed(3, Outgoing).count(), 0);
    // console.log(g.edges_directed(4, Outgoing).count(), 1);
    // console.log(g.edges_directed(5, Outgoing).count(), 0);
    // console.log(g.edges_directed(6, Outgoing).count(), 1);

    // assert(g.edges_directed(0, Incoming).count() === 1);
    // assert(g.edges_directed(1, Incoming).count() === 1);
    // assert(g.edges_directed(2, Incoming).count() === 1);
    // assert(g.edges_directed(3, Incoming).count() === 3);
    // assert(g.edges_directed(4, Incoming).count() === 1);
    // assert(g.edges_directed(5, Incoming).count() === 1);
    // assert(g.edges_directed(6, Incoming).count() === 1);
})

test('edges_undirected', () => {
    const g = MatrixGraph.undirected();

    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)


    g.add_edge(0, 5, Unit)
    g.add_edge(0, 2, Unit)
    g.add_edge(0, 3, Unit)
    g.add_edge(0, 1, Unit)
    g.add_edge(1, 3, Unit)
    g.add_edge(2, 3, Unit)
    g.add_edge(2, 4, Unit)
    g.add_edge(4, 0, Unit)
    g.add_edge(6, 6, Unit)

    assert(g.edges(0).count() === 5);
    assert(g.edges(1).count() === 2);
    assert(g.edges(2).count() === 3);
    assert(g.edges(3).count() === 3);
    assert(g.edges(4).count() === 2);
    assert(g.edges(5).count() === 1);
    assert(g.edges(6).count() === 1);
})

test('edges_of_absent_node_is_empty_iterator', () => {
    const g = new MatrixGraph();
    assert(g.edges(0).count() === 0);
})


test('neigbors_of_absent_node_is_empty_iterator', () => {
    const g = new MatrixGraph();
    assert(g.neighbors(0).count() === 0);
})

test('edge_references', () => {
    const g = new MatrixGraph();

    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)


    g.add_edge(0, 5, Unit)
    g.add_edge(0, 2, Unit)
    g.add_edge(0, 3, Unit)
    g.add_edge(0, 1, Unit)
    g.add_edge(1, 3, Unit)
    g.add_edge(2, 3, Unit)
    g.add_edge(2, 4, Unit)
    g.add_edge(4, 0, Unit)
    g.add_edge(6, 6, Unit)

    // assert(g.edge_references().count() === 9);
})

test('edge_references_undirected', () => {
    const g = new MatrixGraph();


    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)
    g.add_node(Unit)


    g.add_edge(0, 5, Unit)
    g.add_edge(0, 2, Unit)
    g.add_edge(0, 3, Unit)
    g.add_edge(0, 1, Unit)
    g.add_edge(1, 3, Unit)
    g.add_edge(2, 3, Unit)
    g.add_edge(2, 4, Unit)
    g.add_edge(4, 0, Unit)
    g.add_edge(6, 6, Unit)

    // assert(g.edge_references().count() === 9)
})

test('id_storage', () => {
    const storage = IdStorage.with_capacity<string>(0);

    let a = storage.add('a');
    let b = storage.add('b');
    let c = storage.add('c');

    assert(a < b && b < c);

    expect(storage.iter_ids().collect()).toEqual([a, b, c]);

    storage.remove(b);
    let bb = storage.add('B');
    console.log(b, bb);

    // assert(b === bb);

})