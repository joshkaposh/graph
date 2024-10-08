import { done, Iterator } from "joshkaposh-iterator";
import { is_some } from "joshkaposh-option";
import { Incoming } from "../graph/shared";
import { Reversed } from "./reversed";
import { IntoNeighbors } from ".";

export interface VisitMap<N = any> {
    // Mark `a` as visited.
    // Return **true** if this is the first visit, false otherwise.
    visit(a: N): boolean;

    // Return whether `a` has been visited before.
    is_visited(a: N): boolean;
}

export interface Visitable<N = any> {
    visit_map(): VisitMap<N>;
    reset_map(map: VisitMap<N>): void;
}

interface Traversal<G, N> {
    next(graph: G): IteratorResult<N>
}

class Walker<G, N> extends Iterator<N> {
    #graph: G;
    #traversal: Traversal<G, N>;
    constructor(graph: G, traversal: Traversal<G, N>) {
        super()
        this.#graph = graph;
        this.#traversal = traversal;
    }

    into_iter(): Iterator<N> {
        return this;
    }

    next(): IteratorResult<N> {
        return this.#traversal.next(this.#graph)
    }
}

export class Dfs<N, VM extends VisitMap<N>> {
    stack: N[];
    discovered!: VM;
    constructor(graph?: Visitable<N>, start?: N, stack: N[] = []) {
        this.stack = stack;
        if (graph) {
            this.discovered = graph.visit_map() as VM;
        }
        if (arguments.length >= 2) {
            this.move_to(start!)
        }
    }

    static from_parts<N, VM extends VisitMap<N>>(stack: N[], discovered: VM): Dfs<N, VM> {
        const dfs = new Dfs<N, VM>();
        dfs.stack = stack;
        dfs.discovered = discovered;
        return dfs
    }

    static empty<N, VM extends VisitMap<N>>(graph: Visitable<N>): Dfs<N, VM> {
        return new Dfs(graph);
    }

    move_to(start: N) {
        this.stack.length = 0;
        this.stack.push(start);
    }

    reset(graph: Visitable<N>) {
        graph.reset_map(this.discovered);
        this.stack.length = 0;
    }

    next(graph: Visitable<N> & IntoNeighbors<any>): IteratorResult<N> {
        let node;
        while (is_some(node = this.stack.pop())) {
            if (this.discovered.visit(node)) {
                for (const succ of graph.neighbors(node)) {
                    if (!this.discovered.is_visited(succ)) {
                        this.stack.push(succ as N);
                    }
                }
                return {
                    done: false,
                    value: node
                }
            }
        }
        return {
            done: true,
            value: undefined
        }
    }

    iter(graph: any) {
        return new Walker(graph, this)
    }
}

export class DfsPostOrder<N, VM extends VisitMap<N>> {
    stack: N[];
    discovered: VM;
    finished: VM;
    constructor(graph: Visitable<N>, start?: N) {
        this.stack = [];
        this.discovered = graph.visit_map() as VM;
        this.finished = graph.visit_map() as VM;
        if (arguments.length === 2) {
            this.move_to(start!)
        }
    }

    static empty<N, VM extends VisitMap<N>>(graph: Visitable<N>): DfsPostOrder<N, VM> {
        return new DfsPostOrder(graph);
    }

    move_to(start: N) {
        this.stack.length = 0;
        this.stack.push(start);
    }

    next<G extends IntoNeighbors>(graph: G) {
        let nx

        while (is_some(nx = this.stack[this.stack.length - 1])) {
            if (this.discovered.visit(nx)) {
                for (const succ of graph.neighbors(nx as number)) {
                    if (!this.discovered.is_visited(succ as N)) {
                        this.stack.push(succ as N);
                    }
                }
            } else {
                this.stack.pop();
                if (this.finished.visit(nx)) {
                    return { done: false, value: nx }
                }
            }
        }

        return done()
    }

    reset<G extends Visitable<N>>(graph: G) {
        graph.reset_map(this.discovered);
        graph.reset_map(this.finished);
        this.stack.length = 0;
    }

    iter<G extends Visitable<N>>(graph: G): Walker<G, N> {
        return new Walker(graph, this as Traversal<G, N>)
    }
}

export class Bfs<N, VM extends VisitMap<N>> {
    stack: N[];
    discovered: VM;
    constructor(graph: Visitable<N>, start: N) {
        const disc = graph.visit_map() as VM;
        disc.visit(start);

        const stack = [start];
        this.stack = stack;
        this.discovered = disc;
    }

    move_to(start: N) {
        this.stack.length = 0;
        this.stack.push(start);
    }

    reset(graph: Visitable<N>) {
        graph.reset_map(this.discovered);
        this.stack.length = 0;
    }

    next(graph: any) {
        let node = this.stack.shift()

        if (is_some(node)) {
            for (const succ of graph.neighbors(node)) {
                if (this.discovered.visit(succ)) {
                    this.stack.push(succ)
                }
            }
            return {
                done: false,
                value: node
            }
        }
        return done()
    }

    iter(graph: any) {
        return new Walker(graph, this);
    }
}

export class Topo<N, VM extends VisitMap<N>> {
    #tovisit: N[];
    #ordered: VM;
    constructor(graph: Visitable<N>) {
        this.#tovisit = [];
        this.#ordered = graph.visit_map() as VM;
        this.extend_with_initials(graph);
    }

    extend_with_initials(graph: any) {
        console.log('ext running');

        const ext = graph.node_indices().filter((a: number) => {
            return graph.neighbors_directed(a, Incoming).next().done
        }).collect()
        console.log('Ext', ext);

    }

    reset(graph: Visitable<N>) {
        graph.reset_map(this.#ordered)
        this.#tovisit.length = 0;
        this.extend_with_initials(graph)
    }

    next(g: any) {
        let nix;
        while (is_some(nix = this.#tovisit.pop())) {
            if (this.#ordered.is_visited(nix)) {
                continue
            }
            this.#ordered.visit(nix);
            for (const neigh of g.neighbors(nix)) {
                if (new Reversed(g)
                    .neighbors(neigh)
                    .all((b) => this.#ordered.is_visited(b as N))) {
                    this.#tovisit.push(neigh)
                }
            }
            return { done: false, value: nix }
        }
        return { done: true, value: undefined }
    }
}