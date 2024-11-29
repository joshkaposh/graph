import { is_none, type Option } from "joshkaposh-option";
import { type EdgeType, type GraphIx, type DefaultIx, Directed, Direction, Outgoing, Undirected } from "./graph";
import { IndexSet } from "joshkaposh-index-map";
import { done, item, Iterator, Range } from "joshkaposh-iterator";
import { is_some } from "joshkaposh-option";
import { assert } from "joshkaposh-iterator/src/util";
import { Default } from "./default";
import { next_power_of_2 } from "./util";
import { replace, swap } from "./array-helpers";
import { VisitMap, VisitorFbs } from "./visit";
import { FixedBitSet } from "fixed-bit-set";

export class MatrixGraph<N extends Default, E extends Default, Ty extends EdgeType = Directed, Ix extends GraphIx = DefaultIx> {
    #node_adjacencies: Option<E>[];
    #node_capacity: number;
    #nodes: IdStorage<N>;
    #nb_edges: number;
    #ty: Ty;
    #ix: Ix;

    constructor(node_adjacencies: Option<E>[] = [], node_capacity = 0, nodes: IdStorage<N> = IdStorage.with_capacity(0), nb_edges = 0, ty: Ty = Directed as Ty, ix: Ix = 16 as Ix) {
        this.#node_adjacencies = node_adjacencies;
        this.#node_capacity = node_capacity
        this.#nodes = nodes;
        this.#nb_edges = nb_edges;
        this.#ty = ty;
        this.#ix = ix;
    }

    static with_capacity<N extends Default, E extends Default, Ty extends EdgeType = Directed, Ix extends 8 | 16 = 16>(node_capacity: number, ty: Ty = Directed as Ty, ix: Ix = 16 as Ix): MatrixGraph<N, E, Ty, Ix> {
        const g = new MatrixGraph<N, E, Ty, Ix>(
            [],
            0,
            IdStorage.with_capacity(node_capacity),
            0,
            ty,
            ix
        );

        if (node_capacity > 0) {
            g.#extend_capacity_for_node(node_capacity - 1, true);
        }

        return g;
    }

    static directed<N extends Default, E extends Default>(): MatrixGraph<N, E, Directed> {
        return new MatrixGraph();
    }

    static undirected<N extends Default, E extends Default>(): MatrixGraph<N, E, Undirected> {
        return new MatrixGraph([], 0, new IdStorage(), 0, Undirected)
    }

    static from_edges<N extends Default, E extends Default, Ty extends EdgeType>(iterable: Iterable<any>, default_node_weight: () => N) {
        const g = new MatrixGraph<N, E, Ty>()
        g.extend_with_edges(iterable, default_node_weight);
        return g;
    }

    clear() {
        for (let i = 0; i < this.#node_adjacencies.length; i++) {
            this.#node_adjacencies[i] = undefined
        }
        this.#nodes.clear();
        this.#nb_edges = 0;
    }

    get node_capacity() {
        return this.#node_capacity;
    }

    node_count(): number {
        return this.#nodes.len();
    }

    node_bound(): number {
        return this.#nodes.upper_bound();
    }

    edge_count(): number {
        return this.#nb_edges;
    }

    to_node_index(ix: number) {
        return ix
    }

    to_edge_index(ix: number) {
        return ix
    }

    from_node_index(ix: number) {
        return ix
    }

    from_edge_index(ix: number) {
        return ix
    }

    is_directed(): boolean {
        return this.#ty.is_directed();
    }

    add_node(weight: N): number {
        return this.#nodes.add(weight)
    }

    remove_node(a: number): Option<N> {
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

        return this.#nodes.remove(a);
    }

    update_edge(a: number, b: number, weight: E): Option<E> {
        this.#extend_capacity_for_edge(a, b);
        const p = this.#to_edge_position_unchecked(a, b);
        const old_weight = replace(this.#node_adjacencies, p, weight)
        if (old_weight === undefined) {
            this.#nb_edges += 1;
        }
        return old_weight
    }

    add_edge(a: number, b: number, weight: E) {
        const old_edge_id = this.update_edge(a, b, weight)
        assert(old_edge_id === undefined)
    }

    remove_edge(a: number, b: number): Option<E> {
        const p = this.#to_edge_position(a, b);
        // TODO: check if exists
        if (is_none(p)) {
            return
        }
        const old_weight = this.#node_adjacencies[p]
        this.#node_adjacencies[p] = undefined;
        this.#nb_edges -= 1;
        return old_weight!;
    }

    has_edge(a: number, b: number): boolean {
        const p = this.#to_edge_position(a, b);

        if (is_some(p)) {
            const e = this.#node_adjacencies[p]
            return is_some(e);
        }
        return false
    }

    is_adjacent(a: number, b: number): boolean {
        return this.has_edge(a, b);
    }

    node_weight(a: number): N {
        return this.#nodes.get(a)!
    }

    edge_weight(a: number, b: number): E {
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

    visit_map(): VisitMap<N> {
        return new VisitorFbs(this.node_bound()) as VisitMap<N>;
    }

    reset_map(map: VisitMap<N> & FixedBitSet) {
        map.clear();
        map.grow(this.node_bound());
    }

    node_identifiers(): Iterator<number> {
        return new NodeIdentifiers(this.#nodes.iter_ids());
    }

    node_references(): Iterator<[number, N]> {
        return new NodeReferences(this.#nodes, this.#ix)
    }

    edge_references(): Iterator<[number, number, E]> {
        return new EdgeReferences(this.#node_adjacencies, this.#node_capacity, this.#ty, this.#ix)
    }

    neighbors(a: number): Iterator<number> {
        return new Neighbors(Edges.on_columns(
            a,
            this.#node_adjacencies,
            this.#node_capacity,
            this.#ty,
            this.#ix
        ))
    }

    neighbors_directed(a: number, d: Direction): Iterator<number> {
        if (d.value === Outgoing.value) {
            return this.neighbors(a)
        } else {
            return new Neighbors(Edges.on_rows(
                a,
                this.#node_adjacencies,
                this.#node_capacity,
                this.#ty,
                this.#ix
            ))
        }
    }

    edges(a: number): Iterator<[number, number, E]> {
        return Edges.on_columns(a, this.#node_adjacencies, this.#node_capacity, this.#ty, this.#ix)
    }

    edges_directed(a: number, d: Direction): Iterator<[number, number, E]> {
        if (d.value === Outgoing.value) {
            return this.edges(a)
        } else {
            return Edges.on_rows(a, this.#node_adjacencies, this.#node_capacity, this.#ty, this.#ix)
        }
    }

    extend_with_edges(iterable: Iterable<any>, default_node_weight: () => N) {
        for (const [source, target, weight] of iterable) {
            const nx = Math.max(source, target)
            while (nx >= this.node_count()) {
                this.add_node(default_node_weight());
            }

            this.add_edge(source, target, weight);
        }
    }

    #extend_capacity_for_node(min_node: number, exact: boolean) {
        this.#node_capacity = extend_linearized_matrix(
            this.is_directed(),
            this.#node_adjacencies,
            this.#node_capacity,
            min_node + 1,
            exact
        )
    }

    #extend_capacity_for_edge(a: number, b: number) {
        const min_node = Math.max(a, b);
        if (min_node >= this.#node_capacity) {
            this.#extend_capacity_for_node(min_node, false);
        }
    }

    #to_edge_position(a: number, b: number): Option<number> {
        if (Math.max(a, b) > this.#node_capacity) {
            return
        }
        return this.#to_edge_position_unchecked(a, b)
    }

    #to_edge_position_unchecked(a: number, b: number): number {
        return to_linearized_matrix_position(this.is_directed(), a, b, this.#node_capacity);
    }
}

export class IdStorage<T> {
    #elements: Option<T>[];
    #upper_bound: number;
    #removed_ids: IndexSet<number>;

    constructor(elements: Option<T>[] = [], upper_bound = 0, removed_ids: IndexSet<number> = new IndexSet()) {
        this.#elements = elements;
        this.#upper_bound = upper_bound;
        this.#removed_ids = removed_ids;
    }

    static with_capacity<T>(capacity: number): IdStorage<T> {
        return new IdStorage<T>(
            Array.from({ length: capacity }, () => undefined),
            0,
            new IndexSet()
        )
    }

    upper_bound() {
        return this.#upper_bound;
    }

    get(index: number): Option<T> {
        return this.#elements[index]
    }

    add(element: T): number {
        let id = this.#removed_ids.pop();
        if (typeof id !== 'number') {
            id = this.#upper_bound;
            this.#upper_bound += 1;

            ensure_len(this.#elements, id + 1, () => undefined)
        }
        this.#elements[id] = element
        return id;
    }

    remove(id: number): Option<T> {
        const data = this.#elements[id];
        assert(is_some(data))
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

    len(): number {
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

        while (this.#removed_ids.contains(this.#current) && this.#current < this.#upper_bound) {
            this.#current += 1
        }
        return this.#current < this.#upper_bound ? item(this.#current) : done();
    }
}

class NodeReferences<N, Ix extends GraphIx> extends Iterator<[number, N]> {
    #nodes: IdStorage<N>;
    #iter: IdIterator;
    #ix: Ix;

    constructor(nodes: IdStorage<N>, ix: Ix) {
        super();
        this.#nodes = nodes;
        this.#iter = nodes.iter_ids();
        this.#ix = ix;
    }

    next(): IteratorResult<[number, N], any> {
        const i = this.#iter.next();
        return i.done ? done() : item<[number, N]>([i.value, this.#nodes.get(i.value)!]);
    }

    into_iter(): Iterator<[number, N]> {
        this.#iter.into_iter();
        return this;
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }
}

class EdgeReferences<E, Ty extends EdgeType, Ix extends GraphIx> extends Iterator<[number, number, E]> {
    #row: number;
    #column: number;
    #node_adjacencies: any[];
    #node_capacity: number;
    #ty: Ty;
    #ix: Ix;

    constructor(node_adjacencies: any[], node_capacity: number, ty: Ty, ix: Ix) {
        super()
        this.#row = 0;
        this.#column = 0;
        this.#node_adjacencies = node_adjacencies;
        this.#node_capacity = node_capacity;
        this.#ty = ty;
        this.#ix = ix;
    }

    next(): IteratorResult<[number, number, E], any> {
        while (true) {
            const row = this.#row, column = this.#column;

            if (row >= this.#node_capacity) {
                return done()
            }

            this.#column += 1;
            const max_column_len = !this.#ty.is_directed() ? row + 1 : this.#node_capacity

            if (this.#column >= max_column_len) {
                this.#column = 0;
                this.#row += 1;
            }

            const p = to_linearized_matrix_position(this.#ty.is_directed(), row, column, this.#node_capacity)
            const e = this.#node_adjacencies[p];
            if (is_some(e)) {
                return item<[number, number, E]>([row, column, e])
            }
        }
    }

    into_iter(): Iterator<[number, number, E]> {
        return this
    }

}

class NodeIdentifiers extends Iterator<number> {
    #iter: IdIterator
    constructor(iterable: IdIterator) {
        super()
        this.#iter = iterable
    }

    next(): IteratorResult<number, any> {
        return this.#iter.next()
    }

    into_iter(): Iterator<number> {
        this.#iter.into_iter()
        return this
    }
}

class Neighbors extends Iterator<number> {
    #iter: Iterator<[number, number, any]>
    constructor(iterable: Iterator<[number, number, any]>) {
        super()
        this.#iter = iterable
    }

    into_iter(): Iterator<number> {
        this.#iter.into_iter();
        return this
    }

    next(): IteratorResult<number, any> {
        const n = this.#iter.next();
        return n.done ? done() : item(n.value[1])
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint()
    }
}

type NeighborIterDirection = 0 | 1;
const NeighborIterDirection = {
    Rows: 0,
    Columns: 1
} as const;

class Edges<E> extends Iterator<[number, number, E]> {
    #iter_direction: NeighborIterDirection;
    #node_adjacencies: any[];
    #node_capacity: number;
    #row: number;
    #column: number;
    #ty: EdgeType;
    #ix: GraphIx;
    constructor(column: number, row: number, iter_direction: NeighborIterDirection, node_adjacencies: any[], node_capacity: number, ty: EdgeType, ix: GraphIx) {
        super()
        this.#column = column;
        this.#row = row;
        this.#iter_direction = iter_direction;
        this.#node_adjacencies = node_adjacencies;
        this.#node_capacity = node_capacity;
        this.#ty = ty;
        this.#ix = ix;
    }

    static on_columns<E>(row: number, node_adjacencies: any[], node_capacity: number, ty: EdgeType, ix: GraphIx): Edges<E> {
        return new Edges<E>(
            0,
            row,
            NeighborIterDirection.Columns,
            node_adjacencies,
            node_capacity,
            ty,
            ix
        )
    }

    static on_rows<E>(column: number, node_adjacencies: any[], node_capacity: number, ty: EdgeType, ix: GraphIx): Edges<E> {
        return new Edges<E>(
            column,
            0,
            NeighborIterDirection.Rows,
            node_adjacencies,
            node_capacity,
            ty,
            ix
        )
    }

    next(): IteratorResult<[number, number, E], any> {
        while (true) {
            const row = this.#row, column = this.#column;
            // console.log('next', column, row);

            if (row >= this.#node_capacity || column >= this.#node_capacity) {
                return done()
            }

            if (this.#iter_direction === NeighborIterDirection.Rows) {
                this.#row += 1
            } else {
                this.#column += 1
            }

            const p = to_linearized_matrix_position(this.#ty.is_directed(), row, column, this.#node_capacity)
            const e = this.#node_adjacencies[p]

            if (e !== undefined) {
                const [a, b] = this.#iter_direction === NeighborIterDirection.Rows ?
                    [column, row] :
                    [row, column];

                return item<[number, number, E]>([a, b, e])
            }
        }
    }

    into_iter(): Iterator<[number, number, E]> {
        return this;
    }
}

function to_flat_square_matrix_position(row: number, column: number, width: number) {
    return row * width + column;
}

function to_lower_triangular_matrix_position(row: number, column: number): number {
    const [r, c] = row > column ? [row, column] : [column, row]
    return (r * (r + 1)) / 2 + c;
}

function to_linearized_matrix_position(directed: boolean, row: number, column: number, width: number): number {
    return directed ? to_flat_square_matrix_position(row, column, width) :
        to_lower_triangular_matrix_position(row, column);

}

function extend_linearized_matrix<T>(directed: boolean, node_adjacencies: T[], old_node_capacity: number, new_capacity: number, exact: boolean): number {
    if (old_node_capacity >= new_capacity) {
        return old_node_capacity
    }

    if (directed) {
        return extend_flat_square_matrix(node_adjacencies, old_node_capacity, new_capacity, exact)
    } else {
        return extend_lower_triangular_matrix(node_adjacencies, new_capacity)
    }
}

function extend_flat_square_matrix<T>(node_adjacencies: T[], old_node_capacity: number, new_node_capacity: number, exact: boolean) {
    if (!exact) {
        const MIN_CAPACITY = 4
        new_node_capacity = Math.max(next_power_of_2(new_node_capacity), MIN_CAPACITY)
    }

    // Optimization: when resizing the matrix this way we skip the first few grows to make
    // small matrices a bit faster to work with.
    ensure_len(node_adjacencies, Math.pow(new_node_capacity, 2), () => undefined)

    for (const c of new Range(1, old_node_capacity).rev()) {
        const pos = c * old_node_capacity;
        const new_pos = c * new_node_capacity;
        // move the slices directly if they do not overlap with their new position
        if (pos + old_node_capacity <= new_pos) {
            assert(pos + old_node_capacity < node_adjacencies.length)
            assert(new_pos + old_node_capacity < node_adjacencies.length)
            swap(node_adjacencies, pos, new_pos)
        } else {
            for (const i of new Range(0, old_node_capacity).rev()) {
                swap(node_adjacencies, pos + i, new_pos + i)
            }
        }
    }
    return new_node_capacity;
}

function extend_lower_triangular_matrix<T>(node_adjacencies: T[], new_capacity: number) {
    const max_node = new_capacity - 1;
    const max_pos = to_lower_triangular_matrix_position(max_node, max_node);
    ensure_len(node_adjacencies, max_pos + 1, () => undefined)
    return new_capacity;
}

function ensure_len<T>(v: T[], size: number, d: () => T) {
    if (v.length < size) {
        for (let i = v.length - 1; i < size; i++) {
            v.push(d())
        }
    }
}