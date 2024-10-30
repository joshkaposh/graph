import { is_some, Option } from "joshkaposh-option";
import { EdgeReference, Graph, GraphIx, swap_pair } from ".";
import { Node, Edge, createEdge, Directed, DIRECTIONS, EdgeType, index_twice, Direction, Outgoing, Incoming, Undirected } from "./shared";
import { swap } from "../array-helpers";
import { enumerate } from "../util";
import { done, DoubleEndedIterator, iter, Iterator } from "joshkaposh-iterator";
import { EdgeId, EdgeRef, GraphBase, NodeId, NodeRef, VisitMap, VisitorFbs } from "../visit";
import { FixedBitSet } from "fixed-bit-set";
import { assert } from "joshkaposh-iterator/src/util";

export class StableGraph<N, E, Ty extends EdgeType, Ix = GraphIx> implements GraphBase<number, number, N, E> {

    readonly NodeEnd: number;
    readonly EdgeEnd: number;

    NodeId!: number;
    EdgeId!: number;
    NodeWeight!: N;
    EdgeWeight!: E;

    #g: Graph<Option<N>, Option<E>, Ty, Ix>;
    #ty: Ty;
    #ix: Ix;
    #node_count: number;
    #edge_count: number;

    #free_node: number;
    #free_edge: number;

    get __inner() {
        return this.#g;
    }

    constructor(ty: Ty = Directed as Ty, ix: Ix = 32 as Ix, graph: Graph<Option<N>, Option<E>, Ty, Ix> = Graph.with_capacity(ty, ix, 0, 0) as Graph<Option<N>, Option<E>, Ty, Ix>) {
        this.NodeEnd = graph.NodeEnd;
        this.EdgeEnd = graph.EdgeEnd;

        this.#g = graph
        this.#ty = ty;
        this.#ix = ix;

        this.#node_count = 0;
        this.#edge_count = 0;
        this.#free_node = graph.NodeEnd;
        this.#free_edge = graph.EdgeEnd;
    }

    static directed<N, E, Ix = GraphIx>(size: Ix = 32 as Ix): StableGraph<N, E, Directed, Ix> {
        return new StableGraph(Directed, size)
    }

    static undirected<N, E, Ix = GraphIx>(size: Ix = 32 as Ix): StableGraph<N, E, Undirected, Ix> {
        return new StableGraph(Undirected, size)
    }

    static from_edges<N, E, Ty extends EdgeType, Ix = GraphIx>(ty: Ty, ix: Ix, iterable: Iterable<[number, number, E]>): StableGraph<N, E, Ty, Ix> {
        const g: StableGraph<N, E, Ty, Ix> = StableGraph.with_capacity(ty, ix, 0, 0);
        g.extend_with_edges(iterable);
        return g;
    }

    static with_capacity<N, E, Ty extends EdgeType, Ix = GraphIx>(ty: Ty, ix: Ix, nodes: number, edges: number): StableGraph<N, E, Ty, Ix> {
        const sg: StableGraph<N, E, Ty, Ix> = new StableGraph();
        sg.#g = Graph.with_capacity(ty, ix, nodes, edges);
        return sg;
    }

    clone(): StableGraph<N, E, Ty, Ix> {
        return new StableGraph(this.#ty, this.#ix, this.#g.clone())
    }

    to_node_index(n: NodeId<this>): number {
        return n as number;
    }

    from_node_index(n: number): NodeId<this> {
        return n as number;
    }

    to_edge_index(e: EdgeId<this>): number {
        return e as number;
    }

    from_edge_index(e: number): EdgeId<this> {
        return e as number;
    }

    visit_map(): VisitMap<NodeId<this>> {
        return new VisitorFbs(this.node_bound())
    }

    reset_map(map: VisitMap<NodeId<this>> & FixedBitSet): void {
        map.clear();
        map.grow(this.node_bound())
    }

    extend_with_edges(iterable: Iterable<[number, number, E]>) {
        for (const [source, target, weight] of iterable) {
            this.#ensure_node_exists(source);
            this.#ensure_node_exists(target);
            this.add_edge(source, target, weight)

        }
    }

    raw_nodes(): Node<Option<N>>[] {
        return this.#g.raw_nodes()

    }

    raw_edges(): Edge<Option<E>>[] {
        return this.#g.raw_edges()
    }

    capacity(): [number, number] {
        return this.#g.capacity();
    }

    reverse() {
        for (const edge of this.#g.__edges) {
            swap(edge.node, 0, 1);
            swap(edge.__next, 0, 1);
        }

        for (const node of this.#g.__nodes) {
            swap(node.__next, 0, 1);
        }
    }

    clear() {
        this.#node_count = 0;
        this.#edge_count = 0;
        this.#free_node = this.NodeEnd;
        this.#free_edge = this.EdgeEnd;
        this.#g.clear();
    }

    clear_edges() {
        this.#edge_count = 0;
        this.#free_edge = this.EdgeEnd;
        this.#g.__edges.length = 0;
        for (const node of this.#g.__nodes) {
            if (is_some(node.weight)) {
                node.__next = [this.EdgeEnd, this.EdgeEnd];
            }
        }
    }

    node_count(): number {
        return this.#node_count
    }

    edge_count(): number {
        return this.#edge_count
    }

    node_bound(): number {
        return this.node_count()
    }

    edge_bound(): number {
        return this.edge_count()
    }

    node_weight(a: number): Option<N> {
        return this.#g.__nodes[a].weight;
    }

    set_node_weight(a: number, w: N) {
        return this.#g.__nodes[a].weight = w;
    }

    edge_weight(e: number) {
        return this.#g.__edges[e].weight;
    }

    set_edge_weight(e: number, w: E) {
        return this.#g.__edges[e].weight = w;
    }

    is_directed(): boolean {
        return this.#ty.is_directed();
    }

    contains_node(a: number): boolean {
        return is_some(this.get_node(a))
    }

    contains_edge(a: number, b: number): boolean {
        return is_some(this.find_edge(a, b))
    }

    get_node(a: number): Option<Node<Option<N>>> {
        const node = this.#g.__nodes[a];
        return node.weight !== undefined ? node : null
    }

    add_node(weight: N): number {
        if (this.#free_node !== this.NodeEnd) {
            const node_idx = this.#free_node;
            this.#occupy_vacant_node(node_idx, weight);
            return node_idx
        } else {
            this.#node_count++;
            return this.#g.add_node(weight)
        }
    }

    add_edge(a: number, b: number, weight: E): number {
        let edge_idx: number;
        let new_edge: Option<Edge<Option<E>>>;
        let edge: Edge<Option<E>>;
        if (this.#free_edge !== this.EdgeEnd) {
            edge_idx = this.#free_edge;
            edge = this.#g.__edges[edge_idx];
            let old = edge.weight;
            edge.weight = weight;
            if (old !== undefined) {
                console.error('old edge weight should be undefined. Edge Index = ' + edge_idx)
            }
            this.#free_edge = edge.__next[0];
            edge.node = [a, b];
        } else {
            edge_idx = this.#g.__edges.length;
            new_edge = createEdge(
                weight,
                [this.EdgeEnd, this.EdgeEnd],
                [a, b]
            )
            edge = new_edge;
        }

        let wrong_index;
        const pair = index_twice(this.#g.__nodes, a, b)
        if (!pair) {
            wrong_index = Math.max(a, b);
        } else if (pair.type === 'One') {
            const an = pair.value as Edge<E>;
            if (an.weight === undefined) {
                wrong_index = a;
            } else {
                edge.__next = structuredClone(an.__next);
                an.__next[0] = edge_idx;
                an.__next[1] = edge_idx;
                wrong_index = undefined
            }
        } else {
            const [an, bn] = pair.value as [Node<Option<N>>, Node<Option<N>>];
            if (an.weight === undefined) {
                wrong_index = a
            } else if (bn.weight === undefined) {
                wrong_index = b;
            } else {
                edge.__next = [an.__next[0], bn.__next[1]];
                an.__next[0] = edge_idx;
                bn.__next[1] = edge_idx;
                wrong_index = undefined;
            }
        }

        if (is_some(wrong_index)) {
            throw new Error(`StableGraph::add_edge node index ${wrong_index} is not a node in the graph`)
        }

        this.#edge_count += 1;

        if (new_edge) {
            this.#g.__edges.push(new_edge);
        }

        return edge_idx;
    }

    update_edge(a: number, b: number, weight: E) {
        const ix = this.find_edge(a, b);
        if (is_some(ix)) {
            this.set_edge_weight(ix, weight);
            return ix
        }
        return this.add_edge(a, b, weight)
    }

    remove_node(a: number): Option<N> {
        const n = this.#g.__nodes[a];
        if (!n) {
            return
        }

        const nweight = n.weight;
        n.weight = undefined

        if (nweight === undefined) {
            return
        }

        for (const d of DIRECTIONS) {
            const k = d.index();

            while (true) {
                let next = this.#g.__nodes[a].__next[k];
                if (next === this.EdgeEnd) {
                    break;
                }
                this.remove_edge(next);
            }
        }

        const nslot = this.#g.__nodes[a];
        nslot.__next = [this.#free_node, this.EdgeEnd];

        if (this.#free_node !== this.NodeEnd) {
            this.#g.__nodes[this.#free_node].__next[1] = a;
        }

        this.#free_node = a;
        this.#node_count -= 1;

        return nweight;
    }

    remove_edge(e: number) {
        const ed = this.#g.__edges[e];
        const is_edge = is_some(ed?.weight);
        const edge_node = ed.node
        const edge_next = ed.__next

        if (!is_edge) {
            return
        }

        this.#g.__change_edge_links(edge_node, e, edge_next);

        const edge = this.#g.__edges[e];
        edge.__next = [this.#free_edge, this.EdgeEnd];
        edge.node[this.NodeEnd, this.NodeEnd];
        this.#free_edge = e;
        this.#edge_count -= 1;

        let w = edge.weight;
        edge.weight = undefined;
        return w;
    }

    find_edge(a: number, b: number): Option<number> {
        let edge_idx: Option<number>;
        if (!this.is_directed()) {
            const ed = this.find_edge_undirected(a, b);
            edge_idx = ed ? ed[0] : undefined;
        } else {
            const node = this.get_node(a);
            if (node) {
                const n = this.#g.__find_edge_undirected_from_node(node, b);
                edge_idx = n ? n[0] : undefined
            }
        }
        return edge_idx
    }

    find_edge_undirected(a: number, b: number): Option<[number, Direction]> {
        const node = this.get_node(a);
        return node ? this.#g.__find_edge_undirected_from_node(node, b) : undefined
    }

    node_weights(): Iterator<N> {
        return this.#g.node_weights().filter_map(maybe => maybe)
    }

    edge_weights(): Iterator<E> {
        return this.#g.edge_weights().filter_map(maybe => maybe)
    }

    node_indices(): Indices {
        return new Indices(enumerate(this.raw_nodes() as any) as any)
    }

    edge_indices(): Indices {
        return new Indices(enumerate(this.raw_edges() as any) as any)
    }

    edge_endpoints(e: number): Option<[number, number]> {
        const ed = this.#g.__edges[e];
        return ed.weight !== undefined ? [ed.source(), ed.target()] : undefined
    }

    edges(a: number): Edges<E> {
        return this.edges_directed(a, Outgoing);
    }

    edges_directed(a: number, dir: Direction): Edges<E> {
        const _next = this.get_node(a);
        const next: [number, number] = _next ? _next.__next : [this.EdgeEnd, this.EdgeEnd];

        return new Edges(a, this.#g.__edges, dir, next, this.#ty) as Edges<E>
    }

    edges_connecting(a: number, b: number): EdgesConnecting<E> {
        return new EdgesConnecting<E>(b, this.edges_directed(a, Direction.Outgoing()))
    }

    neighbors(a: number): Neighbors<E> {
        return this.neighbors_directed(a, Outgoing);
    }

    neighbors_directed(a: number, dir: Direction): Neighbors<E> {
        const it = this.neighbors_undirected(a);
        if (this.is_directed()) {
            const k = dir.index();
            it.__next[1 - k] = this.EdgeEnd;
            it.skip_start = this.NodeEnd;
        }
        return it;
    }

    neighbors_undirected(a: number): Neighbors<E> {
        const _next = this.get_node(a);
        const next = is_some(_next) ? structuredClone(_next.__next) : [this.EdgeEnd, this.EdgeEnd] as [number, number];
        return new Neighbors(a, this.#g.__edges, next);
    }

    node_identifiers(): Iterator<number> {
        return this.node_indices()
    }

    node_references(): Iterator<NodeRef<number, N>> {
        return new NodeReferences(enumerate(this.__inner.__nodes) as DoubleEndedIterator<[number, Node<N>]>);
    }

    edge_references(): Iterator<EdgeRef<number, number, E>> {
        return new EdgeReferences(enumerate(this.__inner.__edges) as DoubleEndedIterator<[number, Edge<E>]>)
    }

    externals(dir: Direction): Externals<E> {
        return new Externals(
            this.#ty,
            iter(this.raw_nodes()).enumerate(),
            dir,
        ) as any
    }

    map<N2, E2>(node_map: (index: number, weight: N) => N2, edge_map: (index: number, weight: E) => E2): StableGraph<N2, E2, Ty, Ix> {
        const g = this.#g.map(
            (i, w) => w === undefined ? undefined : node_map(i, w!),
            (i, w) => w === undefined ? undefined : edge_map(i, w!)
        )

        const sg: StableGraph<N2, E2, Ty, Ix> = new StableGraph(this.#ty, this.#ix, g);
        sg.#node_count = this.#node_count;
        sg.#edge_count = this.#edge_count;
        sg.#free_node = this.#free_node;
        sg.#free_edge = this.#free_edge;
        return sg;
    }

    filter_map<N2, E2>(node_map: (index: number, weight: N) => N2, edge_map: (index: number, weight: E) => E2): StableGraph<N2, E2, Ty, Ix> {
        const nbound = this.node_bound();
        const ebound = this.edge_bound();
        const result_g = StableGraph.with_capacity(this.#ty, this.#ix, nbound, ebound);

        let free_node = this.NodeEnd;
        let free_edge = this.EdgeEnd;

        for (const [i, node] of enumerate(iter(this.raw_nodes()))) {
            if (i >= nbound) {
                break;
            }

            if (node.weight !== undefined) {
                const new_weight = node_map(i, node.weight!);
                if (new_weight !== undefined) {
                    result_g.add_node(new_weight);
                    continue
                }
            }
            free_node = result_g.#add_vacant_node(free_node)
        }

        for (const [i, edge] of enumerate(iter(this.raw_edges()))) {
            if (i >= ebound) {
                break
            }

            const source = edge.source();
            const target = edge.target();
            if (edge.weight !== undefined) {
                if (result_g.contains_node(source) && result_g.contains_node(target)) {
                    const new_weight = edge_map(i, edge.weight!);
                    if (new_weight !== undefined) {
                        result_g.add_edge(source, target, new_weight);
                        continue;
                    }
                }
                free_edge = result_g.#add_vacant_edge(free_edge)
            }
        }
        result_g.#free_node = free_node
        result_g.#free_edge = free_edge
        result_g.#check_free_lists();
        return result_g as StableGraph<N2, E2, Ty, Ix>;
    }

    #add_vacant_node(free_node: number) {
        const nidx = this.#g.add_node(undefined);
        const nslot = this.#g.__nodes[nidx];
        nslot.__next = [free_node, this.EdgeEnd];
        if (free_node !== this.NodeEnd) {
            this.#g.__nodes[free_node].__next[1] = nidx;
        }

        return nidx;
    }

    #add_vacant_edge(free_edge: number): number {
        let edge_idx = this.#g.__edges.length;
        const edge = createEdge(
            undefined,
            [this.EdgeEnd, this.EdgeEnd],
            [this.NodeEnd, this.NodeEnd]
        )

        edge.__next[0] = free_edge;
        this.#g.__edges.push(edge);
        return edge_idx;
    }

    #occupy_vacant_node(node_idx: number, weight: N) {
        const nslot = this.#g.__nodes[node_idx];
        const old = nslot.weight;
        nslot.weight = weight;
        if (old !== undefined) {
            console.error(`node weight should be undefined at index ${node_idx}`)
            return
        }
        const prevnode = nslot.__next[1]
        const nextnode = nslot.__next[0]
        nslot.__next = [this.EdgeEnd, this.EdgeEnd];
        if (prevnode !== this.EdgeEnd) {
            this.#g.__nodes[prevnode].__next[0] = nextnode
        }

        if (nextnode !== this.EdgeEnd) {
            this.#g.__nodes[nextnode].__next[1] = prevnode
        }

        if (this.#free_node === node_idx) {
            this.#free_node = nextnode //! .into_node() ???
        }

        this.#node_count += 1
    }

    #ensure_node_exists(node_ix: number) {
        if (this.#g.node_weight(node_ix) !== undefined) {
            return
        }

        while (node_ix >= this.#g.node_count()) {
            let free_node = this.#free_node;
            free_node = this.#add_vacant_node(free_node)
            this.#free_node = free_node;
        }

        this.#occupy_vacant_node(node_ix, null as N) //! N::default()
    }

    #check_free_lists() {
        const NodeEnd = this.NodeEnd
        const EdgeEnd = this.EdgeEnd

        let free_node = this.#free_node;
        // let prev_free_node = NodeEnd;
        let free_node_len = 0;
        while (free_node !== NodeEnd) {
            const n = this.#g.__nodes[free_node];
            if (n.weight === undefined) {
                // prev_free_node = free_node;
                free_node = n.__next[0];
                free_node_len += 1;
                continue;
            }
        }

        let free_edge_len = 0;
        let free_edge = this.#free_edge;
        while (free_edge !== EdgeEnd) {
            const e = this.#g.__edges[free_edge];
            if (e.weight === undefined) {
                free_edge = e.__next[0];
                free_edge_len += 1;
                continue
            }
        }
    }
}

class Edges<E> extends Iterator<EdgeReference<E>> {
    // starting 
    skip_start: number;
    #edges: Edge<E>[];
    #next: [number, number];
    #direction: Direction
    #ty: EdgeType;
    constructor(skip_start: number, edges: Edge<E>[], direction: Direction, next: [number, number], ty: EdgeType) {
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

        if (!iterate_over || iterate_over.value === Outgoing.value) {
            const i = this.#next[0];
            const e = this.#edges[i];
            if (e && e.weight !== undefined) {
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

        if (!iterate_over || iterate_over.value === Incoming.value) {
            let edge
            while (is_some(edge = this.#edges[this.#next[1]])) {
                const { node: node, weight, __next: next } = edge;
                if (weight === undefined) throw new Error('expected weight to be defined')
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

    clone(): Edges<E> {
        return new Edges(this.skip_start, structuredClone(this.#edges), this.#direction, this.#next, this.#ty)
    }
}

class EdgesConnecting<E> extends Iterator<EdgeReference<E>> {
    #target_node: number;
    #edges: Edges<E>;
    constructor(target_node: number, edges: Edges<E>) {
        super()
        this.#target_node = target_node;
        this.#edges = edges;
    }

    into_iter(): Iterator<EdgeReference<E>> {
        return this
    }

    next(): IteratorResult<EdgeReference<E>> {
        const target_node = this.#target_node;
        const n = this.#edges.find(edge => edge.node[1] === target_node);
        return n ? { done: false, value: n } : done()
    }
}

class NodeReferences<N> extends DoubleEndedIterator<NodeRef<number, N>> {
    #iter: DoubleEndedIterator<[number, Node<N>]>;
    constructor(it: DoubleEndedIterator<[number, Node<N>]>) {
        super()
        this.#iter = it;
    }

    into_iter(): DoubleEndedIterator<NodeRef<number, N>> {
        this.#iter.into_iter();
        return this
    }

    next(): IteratorResult<NodeRef<number, N>> {
        const n = this.#iter.find_map(([i, node]) => node.weight !== undefined ? NodeRef(i, node.weight as N) : undefined)
        return n ? { done: false, value: n } : done()
    }

    next_back(): IteratorResult<NodeRef<number, N>> {
        const n = this.#iter.rfind_map(([i, node]) => node.weight !== undefined ? NodeRef(i, node.weight as N) : undefined)
        return n ? { done: false, value: n } : done()

    }
}

class EdgeReferences<E> extends DoubleEndedIterator<EdgeRef<number, number, E>> {
    #iter: DoubleEndedIterator<[number, Edge<Option<E>>]>
    constructor(it: DoubleEndedIterator<[number, Edge<Option<E>>]>) {
        super();
        this.#iter = it;
    }
    into_iter(): DoubleEndedIterator<EdgeRef<number, number, E>> {
        this.#iter.into_iter()
        return this;
    }

    next(): IteratorResult<EdgeRef<number, number, E>> {
        const n = this.#iter.find_map(([i, e]) => e.weight === undefined ? undefined : EdgeRef(i, e.source(), e.target(), e.weight as E));
        return n ? { done: false, value: n } : done();
    }

    next_back(): IteratorResult<EdgeRef<number, number, E>, any> {
        const n = this.#iter.rfind_map(([i, e]) => e.weight === undefined ? undefined : EdgeRef(i, e.source(), e.target(), e.weight as E));
        return n ? { done: false, value: n } : done();
    }
}

class Externals<E> extends Iterator<any> {
    #iter: Iterator<[number, E]>;
    #dir: Direction
    #ty: EdgeType;

    constructor(ty: EdgeType, it: Iterator<[number, E]>, dir: Direction) {
        super()
        this.#iter = it;
        this.#dir = dir;
        this.#ty = ty;
        console.log(this.#dir, this.#ty);
    }

    into_iter(): Iterator<any> {
        this.#iter.into_iter();
        return this;
    }

    next(): IteratorResult<any> {
        return done()
    }

}

class Neighbors<E> extends Iterator<number> {
    skip_start: number;
    __next: [number, number];
    #edges: Edge<Option<E>>[]
    constructor(skip_start: number, edges: Edge<Option<E>>[], next: [number, number]) {
        super()
        this.skip_start = skip_start;
        this.__next = next;
        this.#edges = edges;
    }

    into_iter(): Iterator<number> {
        return this;
    }

    next(): IteratorResult<number, any> {

        // first, any outgoing edges

        const e = this.#edges[this.__next[0]];
        if (e) {
            assert(e.weight !== undefined);
            this.__next[0] = e.__next[0];
            return { done: false, value: e.node[1] }
        }

        // next, incoming edges
        // for an undirected graph (traversing both incoming/outoing lists),
        // make sure to not double count selfloops by skipping them
        let edge;
        while (is_some(edge = this.#edges[this.__next[1]])) {
            assert(edge.weight !== undefined);
            this.__next[1] = edge.__next[1];
            if (edge.node[0] !== this.skip_start) {
                return { done: false, value: edge.node[0] }
            }
        }

        return done()
    }
}

class Indices extends DoubleEndedIterator<number> {
    #iter: DoubleEndedIterator<[number, Node<any>]> | DoubleEndedIterator<[number, Edge<any>]>;
    constructor(it: DoubleEndedIterator<[number, Node<any>]> | DoubleEndedIterator<[number, Edge<any>]>) {
        super()
        this.#iter = it;
    }

    into_iter(): DoubleEndedIterator<number> {
        this.#iter.into_iter();
        return this;
    }

    next(): IteratorResult<number, any> {
        const n = this.#iter.find_map(([i, node]) => node.weight !== undefined ? i : undefined)
        return n !== undefined ? { done: false, value: n! } : done()
    }

    next_back(): IteratorResult<number, any> {
        const n = this.#iter.rfind_map(([i, node]) => node.weight !== undefined ? i : undefined)
        return n !== undefined ? { done: false, value: n! } : done()
    }

    size_hint(): [number, Option<number>] {
        const [_, hi] = this.#iter.size_hint()
        return [0, hi];
    }
}