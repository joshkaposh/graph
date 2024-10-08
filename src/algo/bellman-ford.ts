import { Option } from "joshkaposh-option";
import { IntoEdges, IntoNodeIdentifiers, NodeCount, Visitable } from "../visit";

export interface Paths<NodeId, EdgeWeight> {
    distances: EdgeWeight[];
    predecessors: Option<NodeId>[];
}

export default function bellman_ford<G extends IntoNodeIdentifiers & IntoEdges & NodeCount, NodeId>(graph: G, source: NodeId) {
    const [distances, predecessors] = bellman_ford_initialize_relax(graph, source);
}

export function find_negative_cycle<G extends NodeCount & IntoNodeIdentifiers & IntoEdges & Visitable<any>, NodeId>(graph: G, source: NodeId) {

}

function bellman_ford_initialize_relax<G extends NodeCount & IntoNodeIdentifiers & IntoEdges, NodeId>(g: G, source: NodeId) {
    const predecessor = Array.from({ length: g.node_bound() }, () => null)
    const distance = Array.from({ length: g.node_bound() }, () => Infinity)



    return [] as any[]
}

