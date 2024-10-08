import { done, Item, Iterator } from "joshkaposh-iterator";
import { Direction, Incoming } from "../graph/shared";
import { IntoEdgesDirected, IntoNeighborsDirected, EdgeRef, Visitable, VisitMap, IntoNodeReferences, NodeCount, EdgeCount, NodeRef } from ".";
import { Option } from "joshkaposh-option";

export class Reversed<
    G extends IntoNeighborsDirected & IntoEdgesDirected & IntoNodeReferences & NodeCount & EdgeCount & Visitable,
    NodeId extends G['NodeId'],
    EdgeId extends G['EdgeId'],
    N extends G['NodeWeight'],
    E extends G['EdgeWeight'],
> implements Visitable<NodeId>, IntoEdgesDirected<NodeId, EdgeId, N, E>, IntoNeighborsDirected<NodeId, EdgeId>, IntoNodeReferences<NodeId, EdgeId, N, E> {
    NodeId!: NodeId;
    EdgeId!: EdgeId;
    NodeWeight!: N;
    EdgeWeight!: E;

    constructor(public graph: G) { }

    to_node_index(n: NodeId) {
        return this.graph.to_node_index(n);
    }

    from_node_index(n: NodeId) {
        return this.graph.from_node_index(n);
    }


    to_edge_index(n: NodeId) {
        return this.graph.to_edge_index(n);
    }

    from_edge_index(n: NodeId) {
        return this.graph.from_edge_index(n);
    }


    is_directed(): boolean {
        return this.graph.is_directed();
    }

    node_count(): number {
        return this.graph.node_count()
    }

    edge_count() {
        return this.graph.edge_count();
    }

    node_bound(): number {
        return this.graph.node_bound()
    }

    edge_bound() {
        return this.graph.edge_bound();
    }

    node_references(): Iterator<NodeRef<NodeId, N>> {
        // @ts-expect-error
        return this.graph.node_references().rev()
    }

    node_identifiers(): Iterator<NodeId> {
        // @ts-expect-error
        return this.graph.node_identifiers().rev()
    }

    neighbors(n: NodeId): Iterator<NodeId> {
        return this.graph.neighbors_directed(n, Incoming)
    }

    neighbors_directed(n: NodeId, dir: Direction): Iterator<NodeId> {
        return this.graph.neighbors_directed(n, dir.opposite())
    }

    edge_references(): Iterator<EdgeRef<NodeId, EdgeId, E>> {
        return new ReversedEdges(this.graph.edge_references())
    }

    edges(a: NodeId): Iterator<EdgeRef<NodeId, EdgeId, E>> {
        return new ReversedEdges(this.graph.edges_directed(a, Incoming))
    }

    edges_directed(a: NodeId, dir: Direction): Iterator<EdgeRef<NodeId, EdgeId, E>> {
        return new ReversedEdges(this.graph.edges_directed(a, dir.opposite()))
    }

    visit_map(): VisitMap<NodeId> {
        return this.graph.visit_map()
    }

    reset_map(map: VisitMap<NodeId>): void {
        this.graph.reset_map(map);
    }
}


export class ReversedEdgeRef<Ed extends EdgeRef<any, any>> {
    #edge: Ed
    constructor(edge: Ed) {
        this.#edge = edge;
    }

    as_unreversed() {
        return this.#edge;
    }

    source() {
        return this.#edge.target()
    }


    target() {
        return this.#edge.source()
    }

    weight() {
        return this.#edge.weight()
    }

    id() {
        return this.#edge.id();
    }
}

export class ReversedEdges<I extends Iterator<EdgeRef<any, any>>> extends Iterator<Item<I>> {
    #iter: I;
    constructor(it: I) {
        super()
        this.#iter = it;
    }
    into_iter(): Iterator<Item<I>> {
        return this
    }

    next(): IteratorResult<Item<I>, any> {
        const n = this.#iter.next();
        return n.done ? done() : {
            done: false,
            value: new ReversedEdgeRef(n.value) as Item<I>
        }
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }
}
