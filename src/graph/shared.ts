import { Option } from "joshkaposh-option";

type UnsignedIntPower = 8 | 16 | 32;

export function umax(int_size: UnsignedIntPower) {
    return Math.pow(2, int_size) - 1
}




export type EdgeType = {
    is_directed(): boolean;
}

export type Directed = typeof Directed;
export const Directed = {
    is_directed() {
        return true as const;
    },
}

export type Undirected = typeof Undirected;
export const Undirected = {
    is_directed() {
        return false as const
    },
}

export class Direction {
    private constructor(public value: 0 | 1) { }

    static Incoming() {
        return new Direction(1)
    }

    static Outgoing() {
        return new Direction(0);
    }

    opposite() {
        return new Direction(this.value === 0 ? 1 : 0);
    }

    index() {
        return this.value & 0x1;
    }
}

export const Incoming = Direction.Incoming();
export const Outgoing = Direction.Outgoing();

export const DIRECTIONS = [Outgoing, Incoming] as const



export interface Node<N> {
    weight: N;
    __next: [number, number];
}

export interface Edge<E> {
    weight: E;
    node: [number, number];
    __next: [number, number]; // next edge

    source(): number;
    target(): number;
}

export function createNode<N>(weight: N, next: [number, number]): Node<N> {
    return {
        weight,
        __next: next,
    }
}

export function createEdge<E>(weight: E, next: [number, number], node: [number, number]): Edge<E> {
    return {
        weight,
        node,
        __next: next,

        source(): number {
            return node[0]
        },

        target(): number {
            return node[1]
        }
    }
}

export class Pair<T> {
    constructor(public value: T | [T, T]) {
        if (Array.isArray(value)) {
            this.type = 'Both'
        } else {
            this.type = 'One';
        }
    }

    readonly type: 'One' | 'Both';

    static One<T>(x: T) {
        return new Pair(x)
    }

    static Both<T>(a: T, b: T) {
        return new Pair([a, b] as const)
    }
}

export function index_twice<T>(slc: T[], a: number, b: number): Option<Pair<T>> {
    if (Math.max(a, b) >= slc.length) {
        return null;
    } else if (a === b) {
        return Pair.One(slc[Math.max(a, b)]);
    } else {
        const ar = slc[a];
        const br = slc[b];

        return Pair.Both(ar, br);
    }
}