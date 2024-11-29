import { Iterator } from 'joshkaposh-iterator';
import { Direction, EdgeType } from '../graph';
import { Visitable } from './traversal';
import { Prettify } from 'joshkaposh-iterator/src/util';

export * from './traversal';
export * from './reversed';
export * from './visitor';
export * from './dfsvisit';

export type GraphBase<NodeId, EdgeId, NodeWeight = any, EdgeWeight = any> = {
    NodeId: NodeId;
    EdgeId: EdgeId;
    NodeWeight: NodeWeight;
    EdgeWeight: EdgeWeight;
} & EdgeType

export type NodeId<G extends GraphBase<any, any>> = G['NodeId'];
export type EdgeId<G extends GraphBase<any, any>> = G['EdgeId'];
export type NodeWeight<G extends GraphBase<any, any>> = G['NodeWeight'];
export type EdgeWeight<G extends GraphBase<any, any>> = G['EdgeWeight'];

export interface NodeIndexable<Id = any> {
    to_node_index(id: Id): number;
    from_node_index(ix: number): Id
}

export interface EdgeIndexable<Id extends any = number> {
    to_edge_index(id: Id): number;
    from_edge_index(ix: number): Id;

}

export interface NodeCount<NodeId extends any = number> extends NodeIndexable<NodeId> {
    node_count(): number;
    node_bound(): number;
}

export interface EdgeCount<EdgeId = any> extends EdgeIndexable<EdgeId> {
    edge_count(): number;
    edge_bound(): number;
}

export interface EdgeRef<NodeId, EdgeId, E = any> {
    source(): NodeId;
    target(): NodeId;
    weight(): E;
    id(): EdgeId;
    toString(): string;
}

export function EdgeRef<NodeId, EdgeId, E>(id: EdgeId, source: NodeId, target: NodeId, weight: E): EdgeRef<NodeId, EdgeId, E> {
    return {
        id() { return id },
        weight() { return weight },
        source() { return source },
        target() { return target },
        toString() {
            let str = 'Edge {\n';
            str += `  id: ${id} \n`
            str += `  source: ${source} \n`
            str += `  target: ${target} \n`
            str += `  weight: ${weight} \n`
            str += '}'
            return str
        }
    }
}

export interface NodeRef<NodeId, N> {
    id(): NodeId;
    weight(): N;
    toString(): string;
}
export function NodeRef<NodeId, N>(id: NodeId, weight: N): NodeRef<NodeId, N> {
    return {
        id() { return id },
        weight() { return weight },
        toString() {
            let str = 'Node {\n';
            str += `  id: ${id} \n`
            str += `  weight: ${weight} \n`
            str += '}'
            return str
        }
    }
}

export type GraphRef<NodeId, EdgeId, NodeWeight = any, EdgeWeight = any> = GraphBase<NodeId, EdgeId, NodeWeight, EdgeWeight> & IntoNodeReferences<NodeId> & IntoNeighborsDirected<NodeId> & IntoEdgesDirected & IntoEdgeReferences & NodeCount & EdgeCount & Visitable<NodeId>

export interface IntoEdgeReferences<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends GraphBase<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    edge_references(): Iterator<EdgeRef<NodeId, EdgeId, EdgeWeight>>
}

export interface IntoEdges<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends IntoEdgeReferences<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    edges(vertex: NodeId): Iterator<EdgeRef<NodeId, EdgeId, EdgeWeight>>
}

export interface IntoEdgesDirected<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends IntoEdges<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    edges_directed(vertex: NodeId, dir: Direction): Iterator<EdgeRef<NodeId, EdgeId, EdgeWeight>>
}

export interface IntoNodeIdentifiers<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends GraphBase<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    node_identifiers(): Iterator<NodeId>
}

export interface IntoNodeReferences<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends IntoNodeIdentifiers<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    node_references(): Iterator<NodeRef<NodeId, NodeWeight>>
}

export interface IntoNeighbors<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends GraphBase<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    neighbors(vertex: NodeId): Iterator<NodeId>
}

export interface IntoNeighborsDirected<NodeId = any, EdgeId = any, NodeWeight = any, EdgeWeight = any> extends IntoNeighbors<NodeId, EdgeId, NodeWeight, EdgeWeight> {
    neighbors_directed(vertex: NodeId, dir: Direction): Iterator<NodeId>
}

export type GraphImpl<NodeId, EdgeId, NodeWeight, EdgeWeight> = Prettify<GraphBase<NodeId, EdgeId, NodeWeight, EdgeWeight> &
    IntoNeighborsDirected<NodeId, EdgeId, NodeWeight, EdgeWeight> &
    IntoEdgesDirected<NodeId, EdgeId, NodeWeight, EdgeWeight> &
    IntoNodeReferences<NodeId, EdgeId, NodeWeight, EdgeWeight> &
    IntoEdgeReferences<NodeId, EdgeId, NodeWeight, EdgeWeight>
>