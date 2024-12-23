import { is_some, Option } from "joshkaposh-option";
import { GraphBase, IntoNeighborsDirected, NodeCount } from "../visit";
import { done, from_fn, item, iter, Iterator, once } from "joshkaposh-iterator";
import { IndexSet } from "joshkaposh-index-map";
import { Outgoing } from "../graph";

export function all_simple_paths<
    TargetColl extends new (it: Iterable<G["NodeId"]>) => any,
    G extends GraphBase<any, any> & NodeCount & IntoNeighborsDirected
>(
    graph: G,
    from: G['NodeId'],
    to: G['NodeId'],
    min_intermediate_nodes: number,
    max_intermediate_nodes: Option<number>,
    target_coll?: TargetColl
): Iterator<InstanceType<TargetColl>> {
    const max_length = is_some(max_intermediate_nodes) ? max_intermediate_nodes + 1 : graph.node_count() - 1;
    const min_length = min_intermediate_nodes + 1;

    const visited = new IndexSet(iter.of(from));

    const stack = [graph.neighbors_directed(from, Outgoing)];

    // @ts-expect-error
    return from_fn(() => {
        let children: Iterator<any>;
        while (is_some(stack[stack.length - 1])) {
            children = stack[stack.length - 1];

            const child = children.next();
            if (!child.done) {
                if (visited.len() < max_length) {
                    if (child === to) {
                        if (visited.len() >= min_length) {

                            const path = visited
                                .iter()
                                .chain(once(to))
                                // @ts-expect-error
                                .collect(target_coll)
                            return item(path)
                        }
                    } else if (!visited.contains(child.value)) {
                        visited.insert(child.value);
                        stack.push(graph.neighbors_directed(child, Outgoing))
                    }
                } else {
                    if ((child === to || children.any(v => v === to)) && visited.len() >= min_length) {
                        // @ts-expect-error
                        const path = visited.iter().chain(once(to)).collect(target_coll);
                        return item(path);
                    }
                    stack.pop();
                    visited.pop();
                }
            } else {
                stack.pop();
                visited.pop();
            }
        }
        return done();
    })
}