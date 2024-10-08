import { done, iter, Iterator, range } from "joshkaposh-iterator";
import { Option } from "joshkaposh-option";
import { DfsPostOrder, GraphBase, IntoNeighbors, Visitable } from "../visit";
import { assert } from "joshkaposh-iterator/src/util";

export class Dominators<N> {
    #root: N;
    #dominators: Map<N, N>;
    constructor(root: N, dominators: Map<N, N>) {
        this.#root = root;
        this.#dominators = dominators
    }

    root(): N {
        return this.#root;
    }

    immediate_dominator(node: N): Option<N> {
        if (node === this.#root) {
            return
        }
        return this.#dominators.get(node)!
    }

    strict_dominators(node: N): Option<DominatorsIter<N>> {
        if (this.#dominators.has(node)) {
            return new DominatorsIter(this, this.immediate_dominator(node)!)
        }
        return
    }

    dominators(node: N) {
        if (this.#dominators.has(node)) {
            return new DominatorsIter(this, node)
        }
        return
    }

    immediately_dominated_by(node: N): DominatedByIter<N> {
        return new DominatedByIter(iter(this.#dominators), node)
    }
}

export class DominatorsIter<N> extends Iterator<N> {
    #dominators: Dominators<N>;
    #node: Option<N>;
    constructor(dominators: Dominators<N>, node: N) {
        super()
        this.#dominators = dominators;
        this.#node = node;
    }

    into_iter() {
        return this;
    }

    #take(): Option<N> {
        const n = this.#node;
        this.#node = undefined;
        return n;
    }

    next(): IteratorResult<N> {
        const next = this.#take()
        if (next !== undefined) {
            this.#node = this.#dominators.immediate_dominator(next!);
            return { done: false, value: next as N }
        }
        return done();
    }
}

export class DominatedByIter<N> extends Iterator<N> {
    #iter: Iterator<[N, N]>;
    #node: N
    constructor(iter: Iterator<[N, N]>, node: N) {
        super()
        this.#iter = iter;
        this.#node = node;
    }

    into_iter() {
        return this;
    }

    next(): IteratorResult<N> {
        for (const next of this.#iter) {
            if (next[1] === this.#node) {
                return { done: false, value: next[0] }
            }
        }

        return done()
    }
    size_hint(): [number, Option<number>] {
        const [_, upper] = this.#iter.size_hint();
        return [0, upper];
    }
}

const UNDEFINED = Number.MAX_SAFE_INTEGER;

export function simple_fast<G extends GraphBase<any, any> & IntoNeighbors & Visitable>(graph: G, root: G['NodeId']): Dominators<G['NodeId']> {
    const [post_order, predecessor_sets] = simple_fast_post_order(graph, root);
    const length = post_order.length;
    assert(length > 0);
    assert(post_order[length - 1] === root);

    const node_to_post_order_idx = iter(post_order)
        .enumerate()
        .map(([idx, node]) => [node, idx])
        .collect(Map) as Map<G['NodeId'], number>;

    const idx_to_predecessor_arr = predecessors_sets_to_idx_arrs(post_order, node_to_post_order_idx, predecessor_sets);

    const dominators = Array.from({ length }, () => UNDEFINED);
    dominators[length - 1] = length - 1;

    let changed = true;
    while (changed) {
        changed = false;

        for (const idx of range(0, length - 1).rev()) {
            assert(post_order[idx] !== root)

            let new_idom_idx;

            const predecessors = iter(idx_to_predecessor_arr[idx]).filter(p => dominators[p] !== UNDEFINED)
            const n = predecessors.next()
            if (n.done) {
                throw new Error("Because the root is initialized to dominate itself, and is the \
                     first node in every path, there must exist a predecessor to this \
                     node that also has a dominator")
            }
            new_idom_idx = n.value;

            new_idom_idx = predecessors.fold(new_idom_idx, (new_idx, predecessor_idx) => intersect(dominators, new_idx, predecessor_idx))
            assert(new_idom_idx < length);

            if (new_idom_idx !== dominators[idx]) {
                dominators[idx] = new_idom_idx;
                changed = true;
            }
        }
    }

    // All done! Translate the indices to G["NodeId"]

    assert(!iter(dominators).any(dom => dom === UNDEFINED));

    return new Dominators(
        root,
        iter(dominators)
            .enumerate()
            .map(([idx, dom_idx]) => [post_order[idx], post_order[dom_idx]])
            .collect(Map)
    )
}

function intersect(dominators: number[], finger1: number, finger2: number): number {
    while (true) {
        if (finger1 < finger2) {
            finger1 = dominators[finger1]
        } else if (finger1 > finger2) {
            finger2 = dominators[finger2];
        } else {
            return finger1
        }
    }
}

function predecessors_sets_to_idx_arrs<N>(post_order: N[], node_to_post_order_idx: Map<N, number>, predecessor_sets: Map<N, Set<N>>): Array<number[]> {
    return iter(post_order)
        .map(node => {
            const predecessors = predecessor_sets.get(node)!
            predecessor_sets.delete(node);
            if (predecessors) {
                return iter(predecessor_sets.keys()).map(p => node_to_post_order_idx.get(p)!)
            }
            return iter([])
        }).collect() as unknown as Array<number[]>
}

type PredecessorSets<NodeId> = Map<NodeId, Set<NodeId>>

function simple_fast_post_order<G extends GraphBase<any, any> & IntoNeighbors & Visitable>(graph: G, root: G['NodeId']): [G['NodeId'][], PredecessorSets<G['NodeId']>] {
    const post_order = [];
    const predecessor_sets = new Map();

    for (const node of new DfsPostOrder(graph, root).iter(graph)) {
        post_order.push(node);

        for (const successor of graph.neighbors(node)) {
            if (!predecessor_sets.has(successor)) {
                predecessor_sets.set(successor, new Set([node]))
            } else {
                predecessor_sets.get(successor)!.add(node)
            }
        }
    }

    return [post_order, predecessor_sets]
}
