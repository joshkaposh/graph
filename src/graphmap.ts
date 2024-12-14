import { assert } from "joshkaposh-iterator/src/util";
import { type EdgeType, Directed, Direction, Outgoing, Undirected } from "./graph/shared";
import { DoubleEndedIterator, ExactSizeDoubleEndedIterator, Iterator, done, iter, range } from "joshkaposh-iterator";
import { type Option, is_some } from 'joshkaposh-option'
import { Graph } from "./graph/graph";
import { IndexMap } from "joshkaposh-index-map";
import { type VisitMap, type GraphBase, type NodeId, EdgeRef, NodeRef, VisitorSet } from './visit'
import type { Ord } from "./util";
import { swap_remove } from "./array-helpers";

export type DiGraphMap<N extends NodeTrait, E> = GraphMap<N, E, Directed>
export function DiGraphMap<N extends NodeTrait, E>(): GraphMap<N, E, Directed> {
    return GraphMap.directed()
}

export type UnGraphMap<N extends NodeTrait, E> = GraphMap<N, E, Undirected>
export function UnGraphMap<N extends NodeTrait, E>(): GraphMap<N, E, Undirected> {
    return GraphMap.undirected()
}

export type NodeTrait<T = {}> = T & Ord

function hash<N>(a: N, b: N) {
    return `${a}//${b}`
}

class Cache<N> {
    #cache: Map<string, [N, N]>;
    constructor() {
        this.#cache = new Map();
    }

    get(a: N, b: N): [N, N] & Ord {
        const h = hash(a, b)
        if (!this.#cache.has(h)) {
            const tup = [a, b] as [N, N] & Ord;
            this.#cache.set(h, tup);
            return tup;
        }
        return this.#cache.get(h) as [N, N] & Ord
    }

    remove(a: N, b: N) {
        const h = hash(a, b);
        this.#cache.delete(h);
    }
}

function edge_key<N extends NodeTrait>(cache: Cache<N>, a: N, b: N, directed: boolean): [N, N] & Ord {
    // cache this so lookups will be deterministic
    return directed || a <= b ?
        cache.get(a, b) : cache.get(b, a);
}

export class GraphMap<N extends NodeTrait = any, E = any, Ty extends EdgeType = any> implements GraphBase<N, E, N, E> {
    readonly NodeId!: N;
    readonly EdgeId!: E;
    readonly NodeWeight!: N;
    readonly EdgeWeight!: E;

    #cache: Cache<N> // caches key tuple lookups;
    #nodes: IndexMap<N, [N, Direction][]>;
    #edges: IndexMap<([N, N]) & Ord, E>;
    #ty: Ty;

    constructor(nodes: IndexMap<N, [N, Direction][]> = new IndexMap(), edges: IndexMap<([N, N]) & Ord, E> = new IndexMap(), ty: Ty = Directed as Ty) {
        this.#nodes = nodes;
        this.#edges = edges;
        this.#ty = ty;
        this.#cache = new Cache();
    }

    static directed<N extends NodeTrait, E>(): GraphMap<N, E, Directed> {
        return new GraphMap(new IndexMap(), new IndexMap() as any, Directed)
    }

    static undirected<N extends NodeTrait, E>(): GraphMap<N, E, Undirected> {
        return new GraphMap(new IndexMap(), new IndexMap() as any, Undirected)
    }

    static with_capacity<N extends NodeTrait, E, Ty extends EdgeType>(ty: Ty, nodes: number, edges: number): GraphMap<N, E, Ty> {
        return new GraphMap<N, E, Ty>(
            IndexMap.with_capacity(nodes),
            IndexMap.with_capacity(edges),
            ty,
        )
    }

    static from_edges<N extends NodeTrait, E, Ty extends EdgeType>(ty: Ty, iterable: Iterable<[N, N, E]>): GraphMap<N, E, Ty> {
        const it = iter(iterable)
        const g = ty.is_directed() ? GraphMap.directed<N, E>() : GraphMap.undirected<N, E>();

        for (const [src, target, weight] of it) {
            g.add_edge(src, target, weight);
        }
        return g as GraphMap<N, E, Ty>;
    }

    static from_graph<N extends NodeTrait, E, Ty extends EdgeType>(graph: Graph<N, E, Ty>): GraphMap<N, E, Ty> {
        const new_graph = GraphMap.with_capacity<N, E, Ty>(graph.ty(), graph.node_count(), graph.edge_count())

        for (const node of graph.raw_nodes()) {
            new_graph.add_node(node.weight);
        }

        for (const edge of graph.edge_indices()) {
            const [a, b] = graph.edge_endpoints(edge)!;
            new_graph.add_edge(
                graph.node_weight(a)!,
                graph.node_weight(b)!,
                graph.edge_weight(structuredClone(edge))!
            )
        }

        return new_graph;
    }

    clone(): GraphMap<N, E, Ty> {
        return GraphMap.from_edges(this.#ty, this.#edges.iter().map(([[a, b], w]) => [structuredClone(a), structuredClone(b), structuredClone(w)] as [N, N, E]))
    }

    to_node_index(n: NodeId<this>): number {
        return this.#nodes.get_index_of(n)!;
    }

    from_node_index(ix: number): N {
        assert(ix < this.#nodes.len(), `The requested index ${ix} is out of bounds`)
        const [key] = this.#nodes.get_index_entry(ix)!
        return key;
    }

    to_edge_index(a: NodeId<this>, b: NodeId<this>): number {
        return this.#edges.get_index_of(edge_key(this.#cache, a, b, this.is_directed()))!;
    }

    from_edge_index(ix: number): E {
        assert(ix < this.#edges.len(), `The requested index ${ix} is out of bounds`)
        const [_, w] = this.#edges.get_index_entry(ix)!
        return w;
    }

    node_indices() {
        return range(0, this.node_count())
    }

    edge_indices() {
        return range(0, this.edge_count())
    }

    visit_map(): VisitMap<N> {
        return new VisitorSet<N>();
    }

    reset_map(map: VisitMap<N> & VisitorSet<N>) {
        map.clear();
    }

    capacity(): [number, number] {
        return [this.#nodes.len(), this.#edges.len()]
    }

    contains_node(n: N): boolean {
        return this.#nodes.contains_key(n)
    }

    contains_edge(a: N, b: N): boolean {
        return this.#edges.contains_key(edge_key(this.#cache, a, b, this.#ty.is_directed()))
    }

    is_directed(): boolean {
        return this.#ty.is_directed();
    }

    node_count(): number {
        return this.#nodes.len();
    }

    node_bound(): number {
        return this.node_count()
    }

    node_identifiers(): DoubleEndedIterator<N> {
        return this.#nodes.iter().map(v => v[0])
    }

    node_references(): DoubleEndedIterator<NodeRef<N, N>> {
        return new NodeReferences(this.#nodes.iter())
    }

    edge_references(): DoubleEndedIterator<EdgeRef<N, E, E>> {
        return new EdgeReferences(this.#edges.iter())
    }

    edge_count(): number {
        return this.#edges.len();
    }

    edge_bound(): number {
        return this.edge_count()
    }

    clear(): void {
        this.#nodes.clear();
        this.#edges.clear();
    }

    add_node(n: N): N {
        this.#nodes.insert(n, [])
        return n
    }

    remove_node(n: N): boolean {
        const _links = this.#nodes.swap_remove(n);
        if (!is_some(_links)) {
            return false
        }
        const links = _links;

        for (const [succ, dir] of links) {
            const edge = dir.value === Direction.Outgoing().value ?
                edge_key(this.#cache, n, succ, this.#ty.is_directed()) :
                edge_key(this.#cache, succ, n, this.#ty.is_directed())

            this.#remove_single_edge(succ, n, dir.opposite());
            this.#edges.swap_remove(edge);
        }
        return true;
    }

    add_edge(a: N, b: N, weight: E): Option<E> {
        const old = this.#edges.insert(edge_key(this.#cache, a, b, this.#ty.is_directed()), weight);

        if (is_some(old)) {
            return old;
        } else {
            // insert in the adjacency list if it's a new edge
            // update

            if (!this.#nodes.contains_key(a)) {
                this.#nodes.insert(a, [])
            }

            if (!this.#nodes.contains_key(b)) {
                this.#nodes.insert(b, [])
            }

            this.#nodes.get(a)!.push([b, Direction.Outgoing()])

            if (a !== b) {
                // self loops don't have the Incoming entry
                this.#nodes.get(b)!.push([a, Direction.Incoming()])
            }

            return null;
        }
    }

    update_edge(a: this['NodeId'], b: this['NodeId'], weight: this['EdgeWeight']): this['EdgeId'] {
        this.add_edge(a, b, weight);
        return weight
    }

    remove_edge(a: N, b: N): Option<E> {
        const exist1 = this.#remove_single_edge(a, b, Direction.Outgoing());
        // @ts-expect-error
        const exist2 = a !== b ?
            this.#remove_single_edge(b, a, Direction.Incoming()) :
            exist1;


        const edkey = edge_key(this.#cache, a, b, this.#ty.is_directed());

        const weight = this.#edges.shift_remove(edkey);
        return weight;
    }

    nodes(): ExactSizeDoubleEndedIterator<N> {
        return new Nodes(this.#nodes.keys());
    }

    neighbors(a: N): Iterator<N> {
        const iterable = this.#nodes.get(a) ?? [];
        return new Neighbors(iter(iterable), this.#ty)
    }

    neighbors_directed(a: N, dir: Direction): Iterator<N> {
        const iterable = this.#nodes.get(a) ?? [];
        return new NeighborsDirected(
            iter(iterable),
            a,
            dir,
            this.#ty,
        )
    }

    edges(a: N): Iterator<[N, N, E]> {
        return new Edges(
            this.#cache,
            a,
            this.#edges,
            this.neighbors(a),
            this.#ty
        )
    }

    edges_directed(a: N, dir: Direction): Iterator<[N, N, E]> {
        return new EdgesDirected(
            this.#cache,
            a,
            dir,
            this.#edges,
            this.neighbors_directed(a, dir),
            this.#ty
        )
    }

    edge_weight(a: N, b: N): Option<E> {
        return this.#edges.get(edge_key(this.#cache, a, b, this.#ty.is_directed()))
    }

    set_edge_weight(a: N, b: N, w: E) {
        this.#edges.insert(edge_key(this.#cache, a, b, this.#ty.is_directed()), w)
    }

    /**
     * Return an iterator over all edges of the graph with their weight in arbitrary order.
     */
    all_edges(): DoubleEndedIterator<[N, N, E]> {
        return new AllEdges(iter(this.#edges as any) as any)
    }

    /**
     * Turns a `GraphMap<N, N, E>` into its equivalent Graph 
     */
    into_graph(): Graph<N, E, Ty> {
        // TODO: add ix to graphmap to pass here instead of hardcoded
        const gr = Graph.with_capacity<N, E, Ty, 32>(this.#ty, 32, this.node_count(), this.edge_count());
        for (const [node] of this.#nodes) {
            gr.add_node(node)
        }
        for (const [[a, b], edge_weight] of this.#edges) {
            const ai = this.#nodes.get_index_of(a)!;
            const bi = this.#nodes.get_index_of(b)!;
            gr.add_edge(ai, bi, edge_weight)
        }

        return gr;
    }

    extend(iterable: Iterable<[N, N, E]>) {
        for (const elt of iterable) {
            const [source, target, weight] = elt
            this.add_edge(source, target, weight);
        }
    }

    // Remove edge relation from a to b
    // 
    // Returns `true` if it did exist.
    #remove_single_edge(a: N, b: N, dir: Direction) {
        const node = this.#nodes.get(a);
        if (!is_some(node)) {
            return false;
        }

        if (this.#ty.is_directed()) {
            const index = node.findIndex(elt => elt[0] === b && elt[1].value === dir.value)
            if (index >= 0) {
                swap_remove(node, index);
                return true;
            }

            return false;
        } else {
            const index = node.findIndex(elt => elt[0] === b)
            if (is_some(index)) {
                swap_remove(node, index);
                return true
            }
            return false;
        }
    }
}

class Neighbors<N, Ty extends EdgeType> extends Iterator<N> {
    #iter: Iterator<[N, Direction]>;
    #ty: Ty;

    constructor(iter: Iterator<[N, Direction]>, ty: Ty) {
        super()
        this.#iter = iter;
        this.#ty = ty;
    }

    into_iter(): Iterator<N> {
        this.#iter.into_iter()
        return this;
    }

    next(): IteratorResult<N> {
        if (this.#ty.is_directed()) {
            return this.#iter
                .filter_map(([n, dir]: [N, Direction]) => dir.value === Outgoing.value ? n : undefined)
                .next();
        } else {
            const n = this.#iter.next();
            return n.done ? done() : {
                done: false,
                value: n.value[0]
            };
        }
    }

    size_hint(): [number, Option<number>] {
        const [lower, upper] = this.#iter.size_hint();
        return this.#ty.is_directed() ?
            [0, upper] :
            [lower, upper]
    }
}

class NeighborsDirected<N extends NodeTrait, Ty extends EdgeType> extends Iterator<N> {
    #iter: Iterator<[N, Direction]>;
    #dir: Direction;
    #start_node: N;
    #ty: Ty;

    constructor(iter: Iterator<[N, Direction]>, start_node: N, dir: Direction, ty: Ty) {
        super()
        this.#iter = iter;
        this.#start_node = start_node;
        this.#dir = dir;
        this.#ty = ty;
    }

    into_iter(): Iterator<N> {
        this.#iter.into_iter()
        return this
    }

    next(): IteratorResult<N> {
        if (this.#ty.is_directed()) {
            const self_dir = this.#dir;
            const start_node = this.#start_node;
            // @ts-expect-error
            return this.#iter.filter_map(([n, dir]: [N, Direction]) => {
                if (dir.value === self_dir.value || n === start_node) {
                    return n
                }
            }).next();
        } else {
            const n = this.#iter.next();
            return n.done ? done() : { done: false, value: n.value[0] };
        }
    }

    size_hint(): [number, Option<number>] {
        const [lower, upper] = this.#iter.size_hint()
        return this.#ty.is_directed() ?
            [0, upper] :
            [lower, upper]
    }
}

class NodeReferences<N = any> extends DoubleEndedIterator<NodeRef<N, N>> {
    #iter: DoubleEndedIterator<[N, [N, Direction][]]>;
    constructor(it: DoubleEndedIterator<[N, [N, Direction][]]>) {
        super()
        this.#iter = it;
    }

    into_iter(): DoubleEndedIterator<NodeRef<N, N>> {
        this.#iter.into_iter();
        return this
    }

    next(): IteratorResult<NodeRef<N, N>> {
        const n = this.#iter.next();
        if (!n.done) {
            const [w] = n.value;
            return { done: false, value: NodeRef(w, w) }
        }

        return done()
    }

    next_back(): IteratorResult<NodeRef<N, N>> {
        const n = this.#iter.next_back();
        if (!n.done) {
            const [w] = n.value;
            return { done: false, value: NodeRef(w, w) }
        }

        return done()
    }
}

class EdgeReferences<N, E> extends DoubleEndedIterator<EdgeRef<N, E, E>> {
    #iter: DoubleEndedIterator<[[N, N], E]>;
    constructor(it: DoubleEndedIterator<[[N, N], E]>) {
        super()
        this.#iter = it;
    }

    into_iter(): DoubleEndedIterator<EdgeRef<N, E, E>> {
        this.#iter.into_iter();
        return this
    }
    next(): IteratorResult<EdgeRef<N, E, E>> {
        const n = this.#iter.next();
        if (!n.done) {
            const [[source, target], weight] = n.value
            return { done: false, value: EdgeRef(weight, source, target, weight) };
        }
        return done()
    }

    next_back(): IteratorResult<EdgeRef<N, E, E>> {
        const n = this.#iter.next_back();
        if (!n.done) {
            const [[source, target], weight] = n.value
            return { done: false, value: EdgeRef(weight, source, target, weight) };
        }
        return done()

    }
}

class Nodes<N> extends ExactSizeDoubleEndedIterator<N> {
    #iter: ExactSizeDoubleEndedIterator<N>
    constructor(it: ExactSizeDoubleEndedIterator<N>) {
        super()
        this.#iter = it;
    }

    into_iter(): ExactSizeDoubleEndedIterator<N> {
        return this
    }

    next() {
        return this.#iter.next();
    }

    next_back() {
        return this.#iter.next_back()
    }
}

class Edges<N extends NodeTrait, E, Ty extends EdgeType> extends Iterator<[N, N, E]> {
    #from: N;
    #edges: IndexMap<([N, N]) & Ord, E>;
    #iter: Iterator<N>;
    #ty: Ty;
    #cache: Cache<N>;
    constructor(cache: Cache<N>, from: N, edges: IndexMap<([N, N]) & Ord, E>, iter: Iterator<N>, ty: Ty) {
        super()
        this.#from = from;
        this.#edges = edges;
        this.#iter = iter;
        this.#ty = ty;
        this.#cache = cache
    }

    into_iter(): Iterator<[N, N, E]> {
        this.#iter.into_iter();
        return this
    }

    next(): IteratorResult<[N, N, E]> {
        const n = this.#iter.next();
        if (!n.done) {
            const a = this.#from;
            const b = n.value
            const edge = this.#edges.get(edge_key(this.#cache, a, b, this.#ty.is_directed()));
            assert(is_some(edge));
            return { done: false, value: [a, b, edge!] }
        }

        return done()
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }
}

class EdgesDirected<N extends NodeTrait, E, Ty extends EdgeType> extends Iterator<[N, N, E]> {
    #from: N;
    #dir: Direction;
    #edges: IndexMap<([N, N]) & Ord, E>;
    #iter: Iterator<N>
    #ty: Ty;
    #cache: Cache<N>
    constructor(cache: Cache<N>, from: N, dir: Direction, edges: IndexMap<([N, N]) & Ord, E>, iter: Iterator<N>, ty: Ty) {
        super()
        this.#cache = cache
        this.#from = from;
        this.#dir = dir;
        this.#edges = edges;
        this.#iter = iter;
        this.#ty = ty;
    }

    into_iter(): Iterator<[N, N, E]> {
        this.#iter.into_iter();
        return this
    }

    next(): IteratorResult<[N, N, E]> {
        const n = this.#iter.next();
        if (!n.done) {
            let a = this.#from;
            let b = n.value;
            if (this.#dir.value === Direction.Incoming().value) {
                const temp = a
                a = b;
                b = temp;
            }

            const edge = this.#edges.get(edge_key(this.#cache, a, b, this.#ty.is_directed()))!
            assert(is_some(edge));
            return { done: false, value: [a, b, edge] }
        }
        return done()
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }
}

class AllEdges<N extends NodeTrait, E> extends DoubleEndedIterator<[N, N, E]> {
    #inner: DoubleEndedIterator<[[N, N], E]>
    constructor(inner: DoubleEndedIterator<[[N, N], E]>) {
        super();
        this.#inner = inner;
    }

    into_iter(): DoubleEndedIterator<[N, N, E]> {
        this.#inner.into_iter();
        return this
    }

    next(): IteratorResult<[N, N, E]> {
        const n = this.#inner.next();
        if (!n.done) {
            const [[a, b], weight] = n.value
            return { done: false, value: [a, b, weight] };
        }
        return done()
    }

    next_back(): IteratorResult<[N, N, E]> {
        const n = this.#inner.next_back();
        if (!n.done) {
            const [[a, b], weight] = n.value
            return {
                done: false,
                value: [a, b, weight]
            }
        }
        return done()
    }

    count(): number {
        return this.#inner.count();
    }

    nth(n: number): IteratorResult<[N, N, E]> {
        const next = this.#inner.nth(n);
        if (!next.done) {
            const [[a, b], weight] = next.value
            return {
                done: false,
                value: [a, b, weight]
            }
        }

        return done();
    }

    last(): Option<[N, N, E]> {
        const l = this.#inner.last();
        if (l) {
            const [[a, b], weight] = l;
            return [a, b, weight];
        }
        return null;
    }
}