import { UnionFind } from "../unionfind";
import dijkstra from "./dijkstra";
import bellman_ford from "./bellman-ford";
// import tarjan_scc, { TarjanScc, NodeData } from "./tarjan_scc";
import { Dfs, DfsPostOrder, EdgeCount, EdgeRef, GraphBase, NodeIndexable, IntoEdgeReferences, IntoEdges, IntoEdgesDirected, IntoNeighbors, IntoNeighborsDirected, IntoNodeIdentifiers, IntoNodeReferences, NodeCount, Reversed, Visitable, VisitMap } from "../visit";
import { ErrorExt, is_none, is_some, Option, Result } from "joshkaposh-option";
import { assert } from "joshkaposh-iterator/src/util";
import { iter } from "joshkaposh-iterator";
import { u32 } from "fixed-bit-set/src/Intrinsics";
import { Heap } from "joshkaposh-heap";
import { MinScored } from "../scored";

export * from './astar';
export * from './dominators';
export * from './simple_paths';
export { dijkstra, bellman_ford }

export interface NodeData {
    rootindex: Option<number>;
}

export class TarjanScc<N> {
    #index: number;
    #component_count: number;
    #nodes: NodeData[];
    #stack: N[];
    constructor() {
        this.#index = 1;
        this.#component_count = Number.MAX_SAFE_INTEGER;
        this.#nodes = [];
        this.#stack = [];
    }

    run<G extends IntoNodeIdentifiers<N> & IntoNeighbors<N> & NodeCount<N>>(g: G, f: (scc: N[]) => void) {
        this.#nodes.length = 0;

        for (let i = 0; i < g.node_bound(); i++) {
            this.#nodes[i] = { rootindex: null }
        }

        for (const n of g.node_identifiers()) {
            const visited = this.#nodes[g.to_node_index(n)].rootindex !== null;
            if (!visited) {
                this.visit(n, g, f);
            }
        }

        assert(this.#stack.length === 0);
    }

    visit<NodeId extends N, G extends IntoNeighbors<NodeId> & NodeIndexable<NodeId>>(v: NodeId, g: G, f: (scc: NodeId[]) => void) {

        const node = (n: NodeId) => this.#nodes[g.to_node_index(n)]

        let node_v = node(v);
        assert(is_none(node_v.rootindex))

        let v_is_local_root = true;
        let v_index = this.#index;
        node_v.rootindex = v_index;
        this.#index += 1;

        for (const w of g.neighbors(v)) {

            if (is_none(node(w).rootindex)) {
                this.visit(w, g, f)
            }
            if ((node(w).rootindex!) < (node(v).rootindex!)) {
                node(v).rootindex = node(w).rootindex;
                v_is_local_root = false;
            }
        }

        if (v_is_local_root) {
            // Pop the stack and generate an SCC
            let indexadjustment = 1;
            let c = this.#component_count;
            const nodes = this.#nodes;

            const _start = iter(this.#stack).rposition(w => {
                if ((nodes[g.to_node_index(v)].rootindex!) > (nodes[g.to_node_index(w as NodeId)]!.rootindex!)) {
                    return true
                } else {
                    nodes[g.to_node_index(w as NodeId)].rootindex = c;
                    indexadjustment += 1;
                    return false;
                }
            })
            const start = is_some(_start) ? _start + 1 : 0;
            nodes[g.to_node_index(v)].rootindex = c;

            this.#stack.push(v); // Pushing the component root to the back right before getting rid of it is somewhat ugly but f get access to it
            const view = this.#stack.slice(start) as NodeId[];
            f(view);
            this.#stack.length = start;
            this.#index -= indexadjustment;
            this.#component_count -= 1;
        } else {
            this.#stack.push(v) // Stack is filled up when backtracing, unlike in Tarjan's original algorithm
        }
    }

    node_component_index<G extends IntoNeighbors<N> & NodeCount<N>>(graph: G, v: N): number {
        const rindex = this.#nodes[graph.to_node_index(v)].rootindex ?? 0;
        if (rindex === 0) {
            console.warn('Tried to get the component index of an unvisited node')
        }
        if (!(rindex > this.#component_count)) {
            console.warn('Given node has been visited but not yet assigned to a component.')
        }
        return u32.MAX - rindex;
    }
}

export function tarjan_scc<G extends IntoNodeIdentifiers & IntoNeighbors & NodeCount & GraphBase<any, any>, NodeId extends G['NodeId']>(graph: G): Array<NodeId[]> {
    const sccs: Array<NodeId[]> = [];
    const tarjan_scc = new TarjanScc();
    tarjan_scc.run(graph, scc => sccs.push([...scc] as NodeId[]))
    return sccs;
}

export function kosaraju_scc<G extends GraphBase<any, any> & IntoNodeReferences<NodeId> & IntoNeighborsDirected<NodeId> & IntoEdgesDirected & IntoEdgeReferences & NodeCount & EdgeCount & Visitable<NodeId>, NodeId extends G['NodeId'], N extends G['NodeWeight']>(graph: G): Array<NodeId[]> {
    let dfs: DfsPostOrder<N, VisitMap<N>> | Dfs<N, VisitMap<N>> = DfsPostOrder.empty(graph);
    const finish_order: N[] = [];
    // First phase, reverse dfs pass - compute finishing times
    for (const i of graph.node_identifiers()) {
        if (dfs.discovered.is_visited(i)) {
            continue
        }

        dfs.move_to(i)

        let nx
        while (!(nx = dfs.next(new Reversed(graph) as any)).done) {
            finish_order.push(nx.value as N)
        }
    }

    // Second phase
    // Process in decreasing finishing time order

    dfs = Dfs.from_parts(dfs.stack, dfs.discovered);
    dfs.reset(graph);
    const sccs = [];

    for (const i of iter(finish_order).rev()) {
        if (dfs.discovered.is_visited(i)) {
            continue;
        }
        dfs.move_to(i);
        const scc = [];
        let nx
        while (!(nx = dfs.next(graph as any)).done) {
            scc.push(nx.value)
        }
        sccs.push(scc);
    }
    return sccs as unknown as Array<NodeId[]>;
}


function topo_visit<G extends GraphBase<any, any> & IntoNeighbors>(g: G, list: any[], permanent: any, temporary: any, node: G['NodeId']): Result<G['NodeId'], ErrorExt<G['NodeId']>> {
    if (permanent.is_visited(node)) {
        return
    }
    if (temporary.is_visited(node)) {
        return new ErrorExt(node);
    }

    temporary.visit(node);

    let err
    for (const m of g.neighbors(node)) {
        err = topo_visit(g, list, permanent, temporary, m);
        if (err) {
            return err
        }
    }

    permanent.visit(node);
    list.push(node);

    return
}

export function toposort<G extends GraphBase<any, any> & IntoNeighborsDirected & IntoNodeIdentifiers & Visitable>(g: G): Result<G['NodeId'][], ErrorExt<G['NodeId']>> {
    const permanent = g.visit_map();
    const temporary = g.visit_map();
    const list: G['NodeId'] = [];
    const node_ids = g.node_identifiers();

    for (const n of node_ids) {
        if (permanent.is_visited(n)) {
            continue
        }

        const err = topo_visit(g, list, permanent, temporary, n);
        if (err) {
            return err
        }
    }

    return list.toReversed();
}

export function is_cyclic_undirected<G extends IntoEdgeReferences & NodeCount>(graph: G) {
    const edge_sets = new UnionFind(graph.node_bound());
    for (const edge of graph.edge_references()) {
        const [a, b] = [edge.source(), edge.target()]
        if (!edge_sets.union(a, b)) {
            return true
        }
    }
    return false
}

export function is_cyclic_directed<G extends GraphBase<any, any> & IntoNeighborsDirected & IntoNodeIdentifiers & Visitable>(graph: G) {
    return !Array.isArray(toposort(graph))
}

export function has_path_connecting<G extends GraphBase<any, any> & IntoNeighbors & Visitable>(graph: G, from: G['NodeId'], to: G['NodeId']) {
    const dfs = new Dfs(graph);
    dfs.reset(graph);
    dfs.move_to(from);
    return dfs.iter(graph).any(v => v === to);
}

export function k_shortest_path<G extends GraphBase<any, any> & IntoEdges & Visitable & NodeCount, K>(graph: G, start: G['NodeId'], goal: Option<G['NodeId']>, k: number, edge_cost: (ref: EdgeRef<G['NodeId'], G['EdgeId']>) => K, default_k: () => K): Map<G['NodeId'], K> {
    const counter = new Array(graph.node_count()).fill(0);
    const scores = new Map();
    const visit_next = Heap.Min<MinScored<K, G['NodeId']>>();
    let zero_score = default_k();
    visit_next.push(new MinScored(zero_score, start));

    let next;
    while (next = visit_next.pop()) {
        const [node_score, node] = next as unknown as [K, G['NodeId']];
        counter[graph.to_node_index(node)] += 1;
        let current_counter = counter[graph.to_node_index(node)];

        if (current_counter > k) {
            continue
        }

        if (current_counter === k) {
            scores.set(node, node_score);
        }

        if (goal === node) {
            break;
        }

        for (const edge of graph.edges(node)) {
            // @ts-expect-error
            visit_next.push(new MinScored(node_score + edge_cost(edge), edge.target()))
        }

    }
    return scores;
}