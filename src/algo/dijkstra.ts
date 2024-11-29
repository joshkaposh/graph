import { Option } from "joshkaposh-option";
import { EdgeRef, IntoEdges, Visitable } from "../visit";
import { Heap } from "joshkaposh-heap";
import { MinScored } from "../scored";

export default function dijkstra<NodeId, K, G extends IntoEdges & Visitable<NodeId>>(
    graph: G,
    start: NodeId,
    goal: Option<NodeId>,
    edge_cost: (ref: EdgeRef<any, any>) => K,
    default_weight: K,
): Map<NodeId, K> {
    const visited = graph.visit_map();
    const scores = new Map();
    const visit_next = Heap.Min();
    let zero_score = default_weight;
    scores.set(start, zero_score);
    visit_next.push(new MinScored(zero_score, start))
    let next;
    while (next = visit_next.pop()) {
        const [node_score, node] = next as [K, NodeId];
        if (visited.is_visited(node)) {
            continue
        }

        if (goal === node) {
            break
        }

        for (const edge of graph.edges(node as number)) {
            let next = edge.target();
            if (visited.is_visited(next as any)) {
                continue
            }
            // @ts-expect-error
            let next_score = node_score + edge_cost(edge);
            if (scores.has(next)) {
                if (next_score < scores.get(next)) {
                    scores.set(next, next_score);
                    visit_next.push(new MinScored(next_score, next));
                }
            } else {
                scores.set(next, next_score)
                visit_next.push(new MinScored(next_score, next))
            }
        }

        visited.visit(node);
    }
    return scores;
}