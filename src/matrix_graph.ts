import { is_none, type Option } from "joshkaposh-option";
import { type EdgeType, type GraphIx, type DefaultIx, Directed } from "./graph";
import { IndexSet } from "joshkaposh-index-map";
import { done, item, Iterator } from "joshkaposh-iterator";
import { is_some } from "joshkaposh-index-map/src/util";
import { assert } from "joshkaposh-iterator/src/util";
import { Default } from "./default";

export class MatrixGraph<N, E extends Default, Ty extends EdgeType = Directed, Ix extends GraphIx = DefaultIx> {
    #node_adjacencies: Option<E>[];
    #node_capacity: number;
    #nodes: IdStorage<N>;
    #nb_edges: number;
    #ty: Ty;
    #ix: Ix;

    constructor(node_adjacencies: Option<E>[] = [], node_capacity = 0, nodes: IdStorage<N> = IdStorage.with_capacity(0), nb_edges = 0, ty: Ty = Directed as Ty, ix: Ix = 32 as Ix) {
        this.#node_adjacencies = node_adjacencies;
        this.#node_capacity = node_capacity
        this.#nodes = nodes;
        this.#nb_edges = nb_edges;
        this.#ty = ty;
        this.#ix = ix;
    }

    static with_capacity(node_capacity: number) {
        const gr = new MatrixGraph();
        gr.#nodes = IdStorage.with_capacity(node_capacity);
        if (node_capacity > 0) {
            gr.#extend_capacity_for_node(node_capacity - 1, true);
        }
        return gr;
    }

    #to_edge_position(node_idx_a: number, node_idx_b: number) {

        // if (Math.max(node_idx_a, node_idx_b) >= this.#node_capacity) {
        //     return
        // }

        return this.#to_edge_position_unchecked(node_idx_a, node_idx_b)
    }

    #to_edge_position_unchecked(node_idx_a: number, node_idx_b: number) {
        return to_linearized_matrix_position(this.is_directed(), node_idx_a, node_idx_b, this.#node_capacity);
    }

    clear() {
        for (let i = 0; i < this.#node_adjacencies.length; i++) {
            this.#node_adjacencies[i] = undefined
        }
        this.#nodes.clear();
        this.#nb_edges = 0;
    }

    node_count() {
        return this.#nodes.len();
    }

    edge_count() {
        return this.#nb_edges;
    }

    is_directed() {
        return this.#ty.is_directed();
    }

    add_node(weight: N) {
        return this.#nodes.add(weight)
    }

    remove_node(a: number) {
        for (const id of this.#nodes.iter_ids()) {
            let position = this.#to_edge_position(a, id);
            if (is_some(position)) {
                this.#node_adjacencies[position] = undefined;
            }

            if (this.is_directed()) {
                position = this.#to_edge_position(id, a)
                if (is_some(position)) {
                    this.#node_adjacencies[position] = undefined;
                }
            }
        }

        this.#nodes.remove(a);
    }

    #extend_capacity_for_node(min_node: number, exact: boolean) {
        this.#node_capacity = extend_linearized_matrix(
            this.is_directed(),
            this.#node_adjacencies,
            this.#node_capacity,
            min_node + 1,
            exact
        )!
    }


    #extend_capacity_for_edge(a: number, b: number) {
        const min_node = Math.max(a, b);
        if (min_node >= this.#node_capacity) {
            this.#extend_capacity_for_node(min_node, false);
        }
    }

    update_edge(a: number, b: number, weight: E) {
        this.#extend_capacity_for_edge(a, b);
        const p = this.#to_edge_position_unchecked(a, b);
        const old_weight = this.#node_adjacencies[p];
        this.#node_adjacencies[p] = weight;
        if (is_none(old_weight)) {
            this.#nb_edges += 1;
        }
        return old_weight
    }

    add_edge(a: number, b: number, weight: E) {
        const old_edge_id = this.update_edge(a, b, weight)
        assert(is_none(old_edge_id))
    }

    remove_edge(a: number, b: number): E {
        const p = this.#to_edge_position(a, b);
        // TODO: check if exists
        const old_weight = this.#node_adjacencies[p]
        this.#node_adjacencies[p] = undefined;
        this.#nb_edges -= 1;
        return old_weight!;
    }

    has_edge(a: number, b: number): boolean {
        const p = this.#to_edge_position(a, b);
        if (is_some(p)) {
            return !is_none(this.#node_adjacencies[p]);
        }
        return false
    }

    node_weight(a: number) {
        return this.#nodes.get(a)
    }

    edge_weight(a: number, b: number) {
        const p = this.#to_edge_position(a, b);
        if (is_none(p)) {
            throw new Error('No edge found between the nodes.')
        }
        const w = this.#node_adjacencies[p];
        if (is_none(w)) {
            throw new Error('No edge found between the nodes.')
        }
        return w
    }



}

class IdStorage<T> {
    #elements: Option<T>[];
    #upper_bound: number;
    #removed_ids: IndexSet<number>;

    constructor(elements: Option<T>[] = [], upper_bound = 0, removed_ids: IndexSet<number> = new IndexSet()) {
        this.#elements = elements;
        this.#upper_bound = upper_bound;
        this.#removed_ids = removed_ids;
    }

    static with_capacity(capacity: number) {
        return new IdStorage(new Array(capacity), 0, new IndexSet())
    }

    get(index: number) {
        return this.#elements[index]
    }

    add(element: T): number {
        let id: number;
        const _id = this.#removed_ids.pop();
        if (is_some(_id)) {
            id = _id!
        } else {
            id = this.#upper_bound;
            this.#upper_bound += 1;

            ensure_len(this.#elements, id + 1, () => null)
        }

        this.#elements[id] = element
        return id;
    }

    remove(id: number) {
        const data = this.#elements[id];
        this.#elements[id] = undefined;
        if (this.#upper_bound - id === 1) {
            this.#upper_bound -= 1
        } else {
            this.#removed_ids.insert(id)
        }
        return data;
    }

    clear() {
        this.#upper_bound = 0;
        this.#elements.length = 0;
        this.#removed_ids.clear();
    }

    len() {
        return this.#upper_bound - this.#removed_ids.len();
    }

    iter_ids() {
        return new IdIterator(
            this.#upper_bound,
            this.#removed_ids,
            undefined
        )
    }
}

class IdIterator extends Iterator<number> {
    #upper_bound: number;
    #removed_ids: IndexSet<number>
    #current: Option<number>;

    constructor(upper_bound: number, removed_ids: IndexSet<number>, current: Option<number>) {
        super();
        this.#upper_bound = upper_bound;
        this.#removed_ids = removed_ids;
        this.#current = current;
    }

    into_iter(): Iterator<number> {
        return this;
    }

    next(): IteratorResult<number> {
        if (is_none(this.#current)) {
            this.#current = 0;
        } else {
            this.#current += 1;
        }

        let current = this.#current;
        while (this.#removed_ids.contains(current) && current < this.#upper_bound) {
            current += 1
        }
        this.#current = current;
        return current < this.#upper_bound ? item(current) : done();
    }
}

function to_flat_square_matrix_position(row: number, column: number, width: number) {
    return row * width + column;
}

function to_lower_triangular_matrix_position(row: number, column: number): number {
    const [r, c] = row > column ? [row, column] : [column, row]
    return Math.floor((r * (r + 1)) / 2) + c
}

function to_linearized_matrix_position(directed: boolean, row: number, column: number, width: number): number {
    return directed ? to_flat_square_matrix_position(row, column, width) :
        to_lower_triangular_matrix_position(row, column);

}

function extend_linearized_matrix<T>(directed: boolean, node_adjacencies: T[], old_node_capacity: number, new_capacity: number, exact: boolean) {
    if (old_node_capacity >= new_capacity) {
        return old_node_capacity
    }

    if (directed) {
        return extend_flat_square_matrix(node_adjacencies, old_node_capacity, new_capacity, exact)
    }

    return extend_lower_triangular_matrix(node_adjacencies, new_capacity)

}

export function next_power_of_2(n: number) {
    if (n <= 1) {
        return 1
    }

    return Math.abs(Math.clz32(n - 1) - 32)
    // console.log('pow inner', Math.clz32(u32.MAX + 1 >> (n - 1)) - 31);

    // return Math.clz32(u32.MAX >> (n - 1)) + 1
}

function extend_flat_square_matrix<T>(node_adjacencies: T[], old_node_capacity: number, new_capacity: number, exact: boolean) {
    let new_node_cap
    if (exact) {
        new_node_cap = new_capacity;
        // const 
    }
}

function extend_lower_triangular_matrix<T>(node_adjacencies: T[], new_capacity: number) { }


function ensure_len<T>(v: T[], size: number, d: () => T) {
    // TODO('resize given array to size with default ')
    if (v.length === size) {
        return
    }
    v.length = size;
}