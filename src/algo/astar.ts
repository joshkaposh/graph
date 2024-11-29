import { is_some, Option } from "joshkaposh-option";
import { Heap } from "joshkaposh-heap";
import { MinScored } from "../scored";
import { Visitable, IntoEdges, EdgeRef } from "../visit";

export function astar<N, E, K extends number>(
    graph: IntoEdges<E> & Visitable<N>,
    start: number,
    is_goal: (node_index: number) => boolean,
    edge_cost: (edge_ref: EdgeRef<N, E>) => K,
    estimate_cost: (edge_index: number) => K
): Option<[K, number[]]> {
    const visit_next = Heap.Min<MinScored<number, number>>();
    const g = new Map<number, K>(); // g costs
    const f = new Map(); // f costs
    const path_tracker = new PathTracker();

    g.set(start, 0 as K);
    let fcost = estimate_cost(start)
    visit_next.push(new MinScored(fcost, start))

    let next
    while (next = visit_next.pop()) {
        const { k: estimate_score, t: node } = next

        if (is_goal(node)) {
            const path = path_tracker.reconstruct_path_to(node);
            const cost = g.get(node)!;

            return [cost, path]
        }

        let node_score = g.get(node)!
        if (f.has(node)) {
            if (f.get(node) <= estimate_score) {
                continue
            }
            f.set(node, estimate_score)
        } else {
            f.set(node, estimate_score)
        }

        for (const edge of graph.edges(node as E)) {
            let next = edge.target() as number;
            let next_score = node_score + edge_cost(edge as unknown as EdgeRef<N, E>) as K;

            if (g.has(next)) {
                if (g.get(next)! <= next_score) {
                    continue
                }
                g.set(next, next_score)
            } else {
                g.set(next, next_score)

            }

            path_tracker.set_predecessor(next, node);
            const next_estimate_score = next_score + estimate_cost(next);
            visit_next.push(new MinScored(next_estimate_score, next));
        }
    }

    return null

}

class PathTracker {
    #came_from: Map<number, number>
    constructor() {
        this.#came_from = new Map();
    }

    set_predecessor(node: number, previous: number) {
        this.#came_from.set(node, previous);
    }

    reconstruct_path_to(last: number) {
        const path = [last];
        let current = last;
        let previous
        while (is_some(previous = this.#came_from.get(current))) {

            path.push(previous)
            current = previous;

        }
        path.reverse();
        return path;
    }
}