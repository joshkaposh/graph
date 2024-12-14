import { DoubleEndedIterator, Iterator, done, iter, range } from 'joshkaposh-iterator';
import { is_some, type Option } from 'joshkaposh-option'
import { type EdgeType, type Node, type Edge, type GraphIx, DIRECTIONS, Direction, Incoming, Outgoing, Directed, Undirected, createNode, createEdge, index_twice } from './shared';
import { assert_some } from 'joshkaposh-iterator/src/util';
import { capacity, extend, reserve, swap, swap_remove } from '../array-helpers';
import { enumerate } from '../util';
import { type EdgeId, type EdgeWeight, type GraphBase, type NodeId, type GraphImpl, type Visitable, type VisitMap, EdgeRef, NodeRef } from '../visit';
import type { FixedBitSet } from 'fixed-bit-set';
import { VisitorFbs } from '../visit/visitor';
import { umax } from '../util'

export type DiGraph<N, E, Ix extends GraphIx = 32> = Graph<N, E, Directed, Ix>;
export function DiGraph<N, E>() {
    return Graph.directed<N, E>()
}

export type UnGraph<N, E, Ix extends GraphIx = 32> = Graph<N, E, Undirected, Ix>;
export function UnGraph<N, E>() {
    return Graph.undirected<N, E>()
}

export class Graph<N, E, Ty extends EdgeType, Ix extends GraphIx = 32> implements GraphImpl<number, number, N, E>, Visitable<number> {
    //! typescript types, never added to graph
    readonly NodeId!: number;
    readonly EdgeId!: number;
    readonly NodeWeight!: N;
    readonly EdgeWeight!: E;

    readonly NodeEnd: number;
    readonly EdgeEnd: number;

    //internal data
    #ty: Ty;
    #ix: Ix;
    __nodes: Node<N>[];
    __edges: Edge<E>[];

    constructor(ty: Ty = Directed as Ty, ix: Ix = 32 as Ix, nodes: Node<N>[] = [], edges: Edge<E>[] = []) {
        this.__nodes = nodes;
        this.__edges = edges;
        this.#ty = ty;
        this.#ix = ix;
        const max = umax(ix)
        this.NodeEnd = max;
        this.EdgeEnd = max;
    }

    static undirected<N, E, Ix extends GraphIx = 32>(size: Ix = 32 as Ix): Graph<N, E, Undirected, Ix> {
        return new Graph(Undirected, size, [], [])
    }

    static directed<N, E, Ix extends GraphIx = 32>(size: Ix = 32 as Ix): Graph<N, E, Directed, Ix> {
        return new Graph(Directed, size, [], [])
    }

    static with_capacity<N, E, Ty extends EdgeType, Ix extends GraphIx = 32>(ty: Ty = Directed as Ty, ix: Ix = 32 as Ix, _nodes: number, _edges: number): Graph<N, E, Ty, Ix> {
        return new Graph(ty, ix, [], [])
    }

    to_node_index(n: NodeId<this>): number {
        return n as number;
    }

    from_node_index(n: NodeId<this>): number {
        return n as number;
    }

    to_edge_index(id: number): number {
        return id
    }

    from_edge_index(ix: number): number {
        return ix;
    }

    ty(): Ty {
        return this.#ty;
    }

    visit_map(): VisitMap<number> {
        return new VisitorFbs(this.node_count()) as VisitMap<number>
    }

    reset_map(map: VisitMap<number> & FixedBitSet): void {
        map.clear();
        map.grow(this.node_count());
    }

    clone(): Graph<N, E, Ty, Ix> {
        return new Graph<N, E, Ty, Ix>(this.#ty, this.#ix, structuredClone(this.__nodes), structuredClone(this.__edges))
    }

    node_count(): number {
        return this.__nodes.length;
    }

    edge_count(): number {
        return this.__edges.length;
    }

    is_directed(): boolean {
        return this.#ty.is_directed();
    }

    add_node(weight: N): number {
        const max = this.NodeEnd;
        const node = createNode(weight, [max, max]);
        const node_idx = this.__nodes.length;

        if (node_idx >= max) {
            throw new Error(`Graph nodes length ${node_idx} cannot exceed ${max}`)
        }

        this.__nodes.push(node);
        return node_idx
    }

    node_bound(): number {
        return this.node_count();
    }

    edge_bound(): number {
        return this.edge_count();
    }

    node_weight(a: number): Option<N> {
        return this.__nodes[a].weight;
    }

    set_node_weight(a: number, w: N) {
        this.__nodes[a].weight = w;
    }

    add_edge(a: number, b: number, weight: E): number {
        const edge_idx = this.__edges.length;
        const max = this.EdgeEnd;

        if (edge_idx >= max) {
            throw new Error(`Graph edges length ${edge_idx} cannot exceed ${max}`)
        }

        const pair = index_twice(this.__nodes, a, b);

        const edge = createEdge(weight, [max, max], [a, b])

        if (!is_some(pair)) {
            // none
            throw new Error('Graph::add_edge: node indices out of bounds')
        } else if (!Array.isArray(pair.value)) {
            // one
            const an = pair.value!;
            edge.__next = structuredClone(an.__next);
            an.__next[0] = edge_idx;
            an.__next[1] = edge_idx;

        } else {
            // both
            const [an, bn] = pair.value;

            edge.__next = [an.__next[0], bn.__next[1]];

            an.__next[0] = edge_idx;
            bn.__next[1] = edge_idx;
        }

        this.__edges.push(edge);
        return edge_idx;
    }

    update_edge(a: number, b: number, weight: E): number {
        const ix = this.find_edge(a, b);
        if (is_some(ix)) {
            this.__edges[ix].weight = weight;
            return ix;
        }
        // since no edges exists, add it
        return this.add_edge(a, b, weight)
    }

    edge_ref(e: number): Option<EdgeReference<E>> {
        if (!this.__edges[e]) {
            return null
        }
        const ed = this.__edges[e];
        return new EdgeReference(e, ed.node, ed.weight)
    }

    edge_weight(e: number): Option<E> {
        return this.__edges[e].weight;
    }

    set_edge_weight(e: number, w: E) {
        this.__edges[e].weight = w;
    }

    edge_endpoints(e: number): Option<[number, number]> {
        const ed = this.__edges[e];
        return is_some(ed) ? [ed.source(), ed.target()] : null;
    }

    remove_node(a: number): Option<N> {
        if (!this.__nodes[a]) {
            return
        }

        for (const d of DIRECTIONS) {
            // remove all edges from and to this node
            const k = d.index();
            let count = 0;
            while (true) {
                let next = this.__nodes[a].__next[k];
                count++;

                if (next === this.EdgeEnd) {
                    break
                }

                const ret = this.remove_edge(next);

                if (!is_some(ret)) {
                    console.warn('Expected remove_edge return to be some edge weight', ret)
                    break
                }
            }
        }

        // Use swap_remove -- only the swapped-in node is going to change
        // number<number>, so we only have to walk its edges and update them.


        const node = swap_remove(this.__nodes, a)
        const n = this.__nodes[a];
        if (!n) {
            return node!.weight
        }

        const swap_edges = n.__next;

        // swapped element old index
        // const old_index = this.__nodes.length;
        const new_index = a;

        // Adjust the starts of the out edges, and ends of the in edges.
        for (const d of DIRECTIONS) {
            const k = d.index();
            const edges = edges_walker_mut(this.__edges, swap_edges[k], d);
            let curr_edge;
            while (is_some(curr_edge = edges.next_edge())) {
                curr_edge.node[k] = new_index
            }
        }

        return node!.weight;
    }

    // For edge 'e' with endpoints 'edge_node', replace links to it
    // with links to 'edge_next'
    __change_edge_links(edge_node: [number, number], e: number, edge_next: [number, number]) {
        for (const d of DIRECTIONS) {
            const k = d.index();
            const node = this.__nodes[edge_node[k]]
            if (!node) {
                console.warn("Edge's endpoint dir=%d, index=%d not found", d.value, edge_node[k])
                return;
            }

            const fst = node.__next[k];
            if (fst === e) {
                node.__next[k] = edge_next[k];
            } else {
                const edges = edges_walker_mut(this.__edges, fst, d)
                let curedge
                while (is_some(curedge = edges.next_edge())) {
                    if (curedge.__next[k] === e) {
                        curedge.__next[k] = edge_next[k];
                        break; // the edge can only be present once in the list.
                    }
                }
            }
        }
    }

    remove_edge(e: number): Option<E> {
        // every edge is part of two lists,
        // outgoing and incoming edges.
        // Remove it from both

        const ed = this.__edges[e];
        if (!ed) {
            return
        }

        const edge_node = ed.node;
        const edge_next = ed.__next;

        // Remove the edge from its in and out lists by replacing it with
        // a link to the next in the list.
        this.__change_edge_links(edge_node, e, edge_next);
        const r = this.#remove_edge_adjust_indices(e)
        return r

    }

    #remove_edge_adjust_indices(e: number): Option<E> {
        // swap_remove the edge -- only the removed edge
        // and the edge swapped into place are affected and need updating
        // indices.

        const edge = swap_remove(this.__edges, e)!

        const ed = this.__edges[e];

        if (!ed) {
            return edge!.weight
        }

        const swap = ed.node
        const swapped_e = this.__edges.length;
        this.__change_edge_links(swap as [number, number], swapped_e, [e, e])
        return edge!.weight
    }

    /// Return an iterator of all nodes with an edge starting from `a`.
    ///
    /// - `Directed`: Outgoing edges from `a`.
    /// - `Undirected`: All edges from or to `a`.
    ///
    /// Produces an empty iterator if the node doesn't exist.<br>
    /// Iterator element type is `number<number>`.
    ///
    /// Use [`.neighbors(a).detach()`][1] to get a neighbor walker that does
    /// not borrow from the graph.
    ///
    /// [1]: struct.Neighbors.html#method.detach
    neighbors(a: number) {
        return this.neighbors_directed(a, Outgoing)
    }

    /// Return an iterator of all neighbors that have an edge between them and
    /// `a`, in the specified direction.
    /// If the graph's edges are undirected, this is equivalent to *.neighbors(a)*.
    ///
    /// - `Directed`, `Outgoing`: All edges from `a`.
    /// - `Directed`, `Incoming`: All edges to `a`.
    /// - `Undirected`: All edges from or to `a`.
    ///
    /// Produces an empty iterator if the node doesn't exist.<br>
    /// Iterator element type is `number<number>`.
    ///
    /// For a `Directed` graph, neighbors are listed in reverse order of their
    /// addition to the graph, so the most recently added edge's neighbor is
    /// listed first. The order in an `Undirected` graph is arbitrary.
    ///
    /// Use [`.neighbors_directed(a, dir).detach()`][1] to get a neighbor walker that does
    /// not borrow from the graph.
    ///
    /// [1]: struct.Neighbors.html#method.detach
    neighbors_directed(a: number, dir: Direction) {
        const it = this.neighbors_undirected(a);
        if (this.is_directed()) {
            const k = dir.index();
            it.__next[1 - k] = this.NodeEnd; // number::end()
            it.skip_start = this.NodeEnd // number::end()
        }

        return it;
    }
    /// Return an iterator of all neighbors that have an edge between them and
    /// `a`, in either direction.
    /// If the graph's edges are undirected, this is equivalent to *.neighbors(a)*.
    ///
    /// - `Directed` and `Undirected`: All edges from or to `a`.
    ///
    /// Produces an empty iterator if the node doesn't exist.<br>
    /// Iterator element type is `number<number>`.
    ///
    /// Use [`.neighbors_undirected(a).detach()`][1] to get a neighbor walker that does
    /// not borrow from the graph.
    ///
    /// [1]: struct.Neighbors.html#method.detach
    ///
    neighbors_undirected(a: number) {
        const n = this.__nodes[a];

        const next = !n ? [this.NodeEnd, this.NodeEnd] : structuredClone(n.__next)

        return new Neighbors(a, this.__edges, next as [number, number])
    }

    /// Return an iterator of all edges of `a`.
    ///
    /// - `Directed`: Outgoing edges from `a`.
    /// - `Undirected`: All edges connected to `a`.
    ///
    /// Produces an empty iterator if the node doesn't exist.<br>
    /// Iterator element type is `EdgeReference<E>`.
    edges(a: number): Edges<E, Ty> {
        return this.edges_directed(a, Outgoing)
    }

    /// Return an iterator of all edges of `a`, in the specified direction.
    ///
    /// - `Directed`, `Outgoing`: All edges from `a`.
    /// - `Directed`, `Incoming`: All edges to `a`.
    /// - `Undirected`, `Outgoing`: All edges connected to `a`, with `a` being the source of each
    ///   edge.
    /// - `Undirected`, `Incoming`: All edges connected to `a`, with `a` being the target of each
    ///   edge.
    ///
    /// Produces an empty iterator if the node `a` doesn't exist.<br>
    /// Iterator element type is `EdgeReference<E>`.
    edges_directed(a: number, dir: Direction): Edges<E, Ty> {
        const n = this.__nodes[a];
        const next = !n ? [this.NodeEnd, this.NodeEnd] : n.__next
        return new Edges(a, this.__edges, dir, next as [number, number], this.#ty)
    }

    /// Return an iterator over all the edges connecting `a` and `b`.
    ///
    /// - `Directed`: Outgoing edges from `a`.
    /// - `Undirected`: All edges connected to `a`.
    ///
    /// Iterator element type is `EdgeReference<E>`
    edges_connecting(a: number, b: number): EdgesConnecting<E, Ty> {
        return new EdgesConnecting(b, this.edges_directed(a, Direction.Outgoing()))
    }

    /// Lookup if there is an edge from `a` to `b`.
    ///
    /// Computes in **O(e')** time, where **e'** is the number of edges
    /// connected to `a` (and `b`, if the graph edges are undirected).
    contains_edge(a: number, b: number): boolean {
        return is_some(this.find_edge(a, b))
    }

    /**
     * 
     * @param a number
     * @param b number
     * @returns number if one was found
     */
    find_edge(a: number, b: number): Option<number> {
        if (!this.is_directed()) {
            const ed = this.find_edge_undirected(a, b);
            return is_some(ed) ? ed[0] : null;
        } else {
            const node = this.__nodes[a];
            const ret = !node ? null : this.__find_edge_directed_from_node(node, b);
            return ret;
        }
    }

    __find_edge_directed_from_node(node: Node<N>, b: number): Option<number> {
        let edix = node.__next[0];

        let edge;
        while (is_some(edge = this.__edges[edix])) {
            if (edge.node[1] === b) {
                return edix;
            }
            edix = edge.__next[0];
        }

        return
    }

    find_edge_undirected(a: number, b: number): Option<[number, Direction]> {
        const node = this.__nodes[a];
        return !node ?
            null :
            this.__find_edge_undirected_from_node(node, b);
    }

    __find_edge_undirected_from_node(node: Node<N>, b: number): Option<[number, Direction]> {
        for (const d of DIRECTIONS) {
            const k = d.index();
            let edix = node.__next[k];
            let edge;

            while (is_some(edge = this.__edges[edix])) {
                if (edge.node[1 - k] === b
                ) {
                    return [edix, d];
                }

                edix = edge.__next[k];
            }
        }

        return
    }

    /// Return an iterator over either the nodes without edges to them
    /// (`Incoming`) or from them (`Outgoing`).
    ///
    /// An *internal* node has both incoming and outgoing edges.
    /// The nodes in `.externals(Incoming)` are the source nodes and
    /// `.externals(Outgoing)` are the sinks of the graph.
    ///
    /// For a graph with undirected edges, both the sinks and the sources are
    /// just the nodes without edges.
    ///
    /// The whole iteration computes in **O(|V|)** time.
    externals(dir: Direction): Externals<N, Ty> {
        return new Externals(iter(this.__nodes).enumerate(), dir, this.EdgeEnd, this.#ty)
    }

    node_indices(): DoubleEndedIterator<number> {
        return range(0, this.node_count())
    }

    node_weights(): DoubleEndedIterator<N> {
        return iter(this.__nodes).map(node => node.weight)
    }

    node_identifiers(): DoubleEndedIterator<number> {
        return this.node_indices();
    }

    node_references(): Iterator<NodeRef<this['NodeId'], N>> {
        return new NodeReferences(iter(this.__nodes).enumerate()).map(([i, w]) => NodeRef(i, w))
    }

    edge_indices(): DoubleEndedIterator<number> {
        return range(0, this.edge_count())
    }

    edge_references(): Iterator<EdgeRef<this['NodeId'], this['EdgeId'], E>> {
        return new EdgeReferences(iter(this.__edges).enumerate())
    }

    edge_weights(): DoubleEndedIterator<E> {
        return iter(this.__edges).map(edge => edge.weight)
    }

    raw_nodes(): Node<N>[] {
        return this.__nodes;
    }

    raw_edges(): Edge<E>[] {
        return this.__edges
    }

    into_nodes_edges(): [Node<N>[], Edge<E>[]] {
        return [this.__nodes, this.__edges];
    }

    first_edge(a: number, dir: Direction): Option<number> {
        const node = this.__nodes[a];
        if (!node) {
            return
        }
        const edix = node.__next[dir.index()];
        return edix === this.NodeEnd ? null : edix;
    }

    next_edge(e: number, dir: Direction): Option<number> {
        const node = this.__edges[e];
        if (!node) {
            return
        }

        const edix = node.__next[dir.index()];
        return edix === this.NodeEnd ? null : edix
    }

    /// Index the `Graph` by two indices, any combination of
    /// node or edge indices is fine.
    ///
    /// **Panics** if the indices are equal or if they are out of bounds.
    ///

    // index_twice_mut(i: number, j: number) {
    //     // T = i
    //     // U = j
    //     // assert!(T::is_node_index() != U::is_node_index() || i.index() != j.index());
    //     return 
    // }

    // Reverse the direction of all edges
    reverse() {
        for (const edge of this.__edges) {
            swap(edge.node, 0, 1)
            swap(edge.__next, 0, 1)
        }

        for (const node of this.__nodes) {
            swap(node.__next, 0, 1)
        }
    }

    // Remove all nodes and edges
    clear() {
        this.__nodes.length = 0;
        this.__edges.length = 0;
    }

    // Remove all edges
    clear_edges() {
        this.__edges.length = 0;
        for (const node of this.__nodes) {
            node.__next = [this.NodeEnd, this.NodeEnd]
        }
    }

    capacity(): [number, number] {
        return [capacity(this.__nodes.length), capacity(this.__edges.length)]
    }

    reserve_nodes(additional: number) {
        reserve(this.__nodes, additional)
    }

    reserve_edges(additional: number) {
        reserve(this.__edges, additional)
    }

    /// Keep all nodes that return `true` from the `visit` closure,
    /// remove the others.
    ///
    /// `visit` is provided a proxy reference to the graph, so that
    /// the graph can be walked and associated data modified.
    ///
    /// The order nodes are visited is not specified.
    retain_nodes(visit: (graph: this, node_index: number) => boolean) {
        for (const index of this.node_indices().rev()) {
            if (!visit(this, index)) {
                const ret = this.remove_node(index);
                assert_some(ret);
            }
        }
    }

    /// Keep all edges that return `true` from the `visit` closure,
    /// remove the others.
    ///
    /// `visit` is provided a proxy reference to the graph, so that
    /// the graph can be walked and associated data modified.
    ///
    /// The order edges are visited is not specified.
    retain_edges(visit: (graph: this, edge_index: number) => boolean) {
        for (const index of this.edge_indices().rev()) {
            if (!visit(this, index)) {
                const ret = this.remove_edge(index);
                assert_some(ret);
            }
        }
    }
    static from_edges<N, E, Ty extends EdgeType, Ix extends GraphIx = 32>(ty: Ty, ix: Ix, default_node_weight: () => N, iterable: Iterable<[N, N, E]>): Graph<N, E, Ty, Ix> {
        const g = Graph.with_capacity(ty, ix, 0, 0) as Graph<N, E, Ty, Ix>;
        g.extend_with_edges(iterable, default_node_weight);
        return g;
    }

    /// Extend the graph from an iterable of edges.
    ///
    /// Node weights `N` are set to default values.
    /// Edge weights `E` may either be specified in the list,
    /// or they are filled with default values.
    ///
    /// Nodes are inserted automatically to match the edges.
    extend_with_edges<I extends Iterable<[N, N, E]>>(iterable: I, default_node_weight: () => N) {
        const it = iter(iterable);
        const [low] = it.size_hint();
        reserve(this.__edges, low);

        for (const elt of it) {
            const [source, target, weight] = elt
            const nx = Math.max(source as number, target as number);
            while (nx >= this.node_count()) {
                // ! make user who creates graph provide functions for default N/E weights
                // this.add_node(N::default())
                this.add_node(default_node_weight())
            }
            this.add_edge(source as number, target as number, weight as E);
        }
    }

    map<N2, E2>(node_map: (node_index: number, weight: N) => N2, edge_map: (edge_index: number, weight: E) => E2): Graph<N2, E2, Ty, Ix> {
        const g = Graph.with_capacity(this.#ty, this.#ix, this.node_count(), this.edge_count()) as Graph<N2, E2, Ty, Ix>;

        extend(g.__nodes, enumerate(iter(this.__nodes)).map(([i, node]) => createNode(
            node_map(i, node.weight,),
            node.__next
        )))

        extend(g.__edges, enumerate(iter(this.__edges)).map(([i, edge]) => createEdge(
            edge_map(i, edge.weight),
            edge.__next,
            edge.node
        )))

        return g
    }

    /// Create a new `Graph` by mapping nodes and edges.
    /// A node or edge may be mapped to `None` to exclude it from
    /// the resulting graph.
    ///
    /// Nodes are mapped first with the `node_map` closure, then
    /// `edge_map` is called for the edges that have not had any endpoint
    /// removed.
    ///
    /// The resulting graph has the structure of a subgraph of the original graph.
    /// If no nodes are removed, the resulting graph has compatible node
    /// indices; if neither nodes nor edges are removed, the result has
    /// the same graph indices as `self`.
    filter_map<N2, E2>(node_map: (node_index: number, weight: N) => Option<N2>, edge_map: (node_index: number, weight: E) => Option<E2>): Graph<N2, E2, Ty> {
        const g = Graph.with_capacity(this.#ty, this.#ix, 0, 0) as unknown as Graph<N2, E2, Ty>

        // mapping from old node index to new node index, end represents removed.
        const max = this.NodeEnd;
        const node_index_map = Array.from({ length: this.node_count() }, () => max);
        for (const [i, node] of enumerate(iter(this.__nodes))) {
            const nw = node_map(i, node.weight);
            if (is_some(nw)) {
                node_index_map[i] = g.add_node(nw);
            }
        }

        for (const [i, edge] of enumerate(iter(this.__edges))) {
            const source = node_index_map[edge.source()];
            const target = node_index_map[edge.target()];

            // source !== number::end() && target !== number::end()
            if (source !== max && target !== max) {
                const ew = edge_map(i, edge.weight);
                g.add_edge(source, target, ew as E2)
            }
        }

        return g
    }

    into_edge_type<NewTy extends EdgeType>(ty: NewTy): Graph<N, E, NewTy, Ix> {
        return new Graph(ty, this.#ix, this.__nodes, this.__edges)
    }

}

class Externals<N, Ty extends EdgeType> extends Iterator<number> {
    #EdgeEnd: number;
    #iter: Iterator<[number, Node<N>]>;
    #dir: Direction;
    #ty: Ty;
    constructor(iter: Iterator<[number, Node<N>]>, dir: Direction, edge_end: number, ty: Ty) {
        super()
        this.#iter = iter;
        this.#dir = dir;
        this.#ty = ty;
        this.#EdgeEnd = edge_end;
    }

    into_iter(): Iterator<number> {
        this.#iter.into_iter();
        return this;
    }

    next(): IteratorResult<number> {
        const k = this.#dir.index();
        while (true) {
            const n = this.#iter.next();
            if (n.done) {
                return done();
            } else {
                const [index, node] = n.value;
                // node.next[k] == number::end()
                //  && (Ty::is_directed() || node.next[1 - k] == number::end())
                if (
                    node.__next[k] === this.#EdgeEnd
                    && (this.#ty.is_directed() || node.__next[1 - k] === this.#EdgeEnd)
                ) {
                    return {
                        done: false,
                        value: index
                    };
                } else {
                    continue
                }
            }
        }
    }

    size_hint(): [number, Option<number>] {
        const [_, upper] = this.#iter.size_hint();
        return [0, upper];
    }
}

class Neighbors<E> extends Iterator<number> {
    skip_start: number;
    __edges: Edge<E>[];
    __next: [number, number];
    #start: [number, number];

    constructor(skip_start: number, edges: Edge<E>[], next: [number, number]) {
        super();
        this.skip_start = skip_start;
        this.__edges = edges;
        this.__next = next;
        this.#start = structuredClone(next);
    }

    into_iter(): Iterator<number> {
        this.__next = this.#start;
        return this;
    }

    next(): IteratorResult<number> {
        let edge = this.__edges[this.__next[0]]
        if (edge) {

            this.__next[0] = edge.__next[0];
            return { done: false, value: edge.node[1] }
        }

        while (is_some(edge = this.__edges[this.__next[1]])) {
            this.__next[1] = edge.__next[1];

            if (edge.node[0] !== this.skip_start) {
                return { done: false, value: edge.node[0] }

            }
        }

        return done()
    }

    /// Return a “walker” object that can be used to step through the
    /// neighbors and edges from the origin node.
    ///
    /// Note: The walker does not borrow from the graph, this is to allow mixing
    /// edge walking with mutating the graph's weights.
    detach(): WalkNeighbors {
        return new WalkNeighbors(this.skip_start, this.__next);
    }
}

class EdgesWalkerMut<E> {
    #edges: Edge<E>[];
    #next: number;
    __dir: Direction;

    constructor(edges: Edge<E>[], next: number, dir: Direction) {
        this.#edges = edges;
        this.#next = next;
        this.__dir = dir;
    }

    next_edge(): Option<Edge<E>> {
        const e = this.next();
        return is_some(e) ? e[1] : null
    }

    next(): Option<[number, Edge<E>]> {
        const this_index = this.#next;
        const k = this.__dir.index();
        const edge = this.#edges[this.#next];
        if (edge) {
            this.#next = edge.__next[k];
            return [this_index, edge];
        }

        return null
    }
}

function edges_walker_mut<E>(edges: Edge<E>[], next: number, dir: Direction) {
    return new EdgesWalkerMut(edges, next, dir)
}

/// Iterator over the edges of from or to a node
class Edges<E, Ty extends EdgeType> extends Iterator<EdgeReference<E>> {
    // starting 
    skip_start: number;
    #edges: Edge<E>[];
    #next: [number, number];
    #direction: Direction
    #ty: Ty;
    constructor(skip_start: number, edges: Edge<E>[], direction: Direction, next: [number, number], ty: Ty) {
        super();
        this.skip_start = skip_start;
        this.#edges = edges
        this.#next = next;
        this.#direction = direction;
        this.#ty = ty;
    }

    into_iter(): Iterator<EdgeReference<E>> {
        return this;
    }

    next(): IteratorResult<EdgeReference<E>> {
        //      type        direction    |    iterate over    reverse
        //                               |
        //    Directed      Outgoing     |      outgoing        no
        //    Directed      Incoming     |      incoming        no
        //   Undirected     Outgoing     |        both       incoming
        //   Undirected     Incoming     |        both       outgoing

        // For iterate_over, "both" is represented as None.
        // For reverse, "no" is represented as None.
        const [iterate_over, reverse] = this.#ty.is_directed() ? [this.#direction, null] : [null, this.#direction.opposite()]

        if (!iterate_over || iterate_over?.value === Outgoing.value) {
            const i = this.#next[0];
            const e = this.#edges[i];
            if (e) {
                const { node: node, weight, __next: next } = e;
                this.#next[0] = next[0];
                return {
                    done: false, value: new EdgeReference(
                        i,
                        reverse?.value === Outgoing.value ? swap_pair(node) : node,
                        weight
                    )
                }
            }
        }

        if (!iterate_over || iterate_over?.value === Incoming.value) {
            let edge
            while (is_some(edge = this.#edges[this.#next[1]])) {
                const { node: node, weight, __next: next } = edge;
                const edge_index = this.#next[1];
                this.#next[1] = next[1];
                if (!iterate_over && node[0] === this.skip_start) {
                    continue;
                }

                return {
                    done: false, value: new EdgeReference(
                        edge_index,
                        reverse?.value === Incoming.value ? swap_pair(node) : node,
                        weight
                    )
                }
            }
        }

        return done();
    }

    clone(): Edges<E, Ty> {
        return new Edges(this.skip_start, this.#edges, this.#direction, this.#next, this.#ty)
    }
}

export class EdgesConnecting<E, Ty extends EdgeType> extends Iterator<EdgeReference<E>> {
    #target_node: number;
    #edges: Edges<E, Ty>;

    constructor(target_node: number, edges: Edges<E, Ty>) {
        super()
        this.#target_node = target_node;
        this.#edges = edges;
    }

    into_iter(): Iterator<EdgeReference<E>> {
        return this;
    }

    next(): IteratorResult<EdgeReference<E>> {
        const target_node = this.#target_node;
        const res = this.#edges.find(ed => ed.node[1] === target_node);
        return res ? { done: false, value: res } : done()
    }

    size_hint(): [number, Option<number>] {
        const [_, upper] = this.#edges.size_hint();
        return [0, upper]
    }
}

export function swap_pair<T>(x: [T, T]) {
    swap(x, 0, 1);
    return x;
}

export class WalkNeighbors {
    skip_start: number;
    #next: [number, number]
    constructor(skip_start: number, next: [number, number]) {
        this.skip_start = skip_start;
        this.#next = next;
    }

    clone() {
        return new WalkNeighbors(this.skip_start, structuredClone(this.#next));
    }

    next<N, E, Ty extends EdgeType>(g: Graph<N, E, Ty>): IteratorResult<[number, number]> {
        // first any outgoing edges
        let edge = g.__edges[this.#next[0]];
        if (edge) {
            const ed = this.#next[0];
            this.#next[0] = edge.__next[0];
            return { done: false, value: [ed, edge.node[1]] }
        }

        // then incoming edges
        // For an "undirected" iterator (traverse both incoming
        // and outgoing edge lists), make sure we don't double
        // count selfloops by skipping them in the incoming list.

        while (is_some(edge = g.__edges[this.#next[1]])) {
            const ed = this.#next[1];
            this.#next[1] = edge.__next[1];
            if (edge.node[0] !== this.skip_start) {
                return { done: false, value: [ed, edge.node[0]] }
            }
        }
        return done()
    }

    next_node<N, E, Ty extends EdgeType>(g: Graph<N, E, Ty>) {
        const n = this.next(g);
        return n.done ? done() : n.value[1];
    }
    next_edge<N, E, Ty extends EdgeType>(g: Graph<N, E, Ty>) {
        const n = this.next(g);
        return n.done ? done() : n.value[0];
    }

}

export class EdgeReference<E> {
    #index: number;
    #weight: E;
    node: [number, number];

    constructor(index: number, node: [number, number], weight: E) {
        this.#index = index
        this.node = node;
        this.#weight = weight;
    }

    eq(rhs: EdgeReference<E>): boolean {
        return this.#index === rhs.#index && this.#weight === rhs.weight;
    }

    weight(): E {
        return this.#weight;
    }

    source(): number {
        return this.node[0]
    }
    target(): number {
        return this.node[1]
    }

    id(): number {
        return this.#index;
    }

    clone(): EdgeReference<E> {
        return new EdgeReference(this.#index, this.node, this.#weight)
    }
}

class EdgeReferences<G extends GraphBase<any, any>> extends DoubleEndedIterator<EdgeRef<NodeId<G>, EdgeId<G>, EdgeWeight<G>>> {

    #iter: ReturnType<DoubleEndedIterator<Edge<EdgeWeight<G>>>['enumerate']>

    constructor(iter: ReturnType<DoubleEndedIterator<Edge<EdgeWeight<G>>>['enumerate']>) {
        super();
        this.#iter = iter;
    }

    into_iter(): DoubleEndedIterator<EdgeRef<NodeId<G>, EdgeId<G>, EdgeWeight<G>>> {
        return this;
    }

    next(): IteratorResult<EdgeRef<NodeId<G>, EdgeId<G>, EdgeWeight<G>>> {
        const n = this.#iter.next();
        if (n.done) {
            return done()
        } else {
            const [i, edge] = n.value
            return { done: false, value: EdgeRef(i, edge.source(), edge.target(), edge.weight) }
        }
    }

    next_back(): IteratorResult<EdgeRef<NodeId<G>, EdgeId<G>, EdgeWeight<G>>> {
        const n = this.#iter.next_back();
        if (n.done) {
            return done()
        } else {
            const [i, edge] = n.value
            return { done: false, value: EdgeRef(i, edge.source(), edge.target(), edge.weight) }
        }
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }
}

class NodeReferences<N> extends DoubleEndedIterator<[number, N]> {
    #iter: DoubleEndedIterator<[number, Node<N>]>;
    constructor(iter: DoubleEndedIterator<[number, Node<N>]>) {
        super()
        this.#iter = iter;
    }

    into_iter(): DoubleEndedIterator<[number, N]> {
        return this
    }

    next(): IteratorResult<[number, N]> {
        const n = this.#iter.next();
        if (n.done) {
            return done();
        } else {
            const [i, node] = n.value;
            return {
                done: false,
                value: [i as number, node.weight]
            }
        }
    }

    next_back(): IteratorResult<[number, N]> {
        const n = this.#iter.next_back();
        if (n.done) {
            return done();
        } else {
            const [i, node] = n.value;
            return {
                done: false,
                value: [i as number, node.weight]
            }
        }
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint()
    }
}
