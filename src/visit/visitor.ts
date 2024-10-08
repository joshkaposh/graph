import { FixedBitSet } from "fixed-bit-set";
import { VisitMap } from "./traversal";

export class VisitorSet<N> implements VisitMap<N> {
    #set: Set<N>;
    constructor() {
        this.#set = new Set()
    }
    visit(x: N): boolean {
        const has = !this.#set.has(x);
        this.#set.add(x)
        return has;
    }

    is_visited(x: N): boolean {
        return this.#set.has(x);
    }

    clear() {
        this.#set.clear();
    }
}

export class VisitorFbs<N extends number> implements VisitMap<N> {
    #fbs: FixedBitSet;
    constructor(node_count: number) {
        this.#fbs = FixedBitSet.with_capacity(node_count)
    }

    clear() {
        this.#fbs.clear();
    }

    grow(bits: number) {
        this.#fbs.grow(bits)
    }

    visit(x: N): boolean {
        return !this.#fbs.put(x);
    }

    is_visited(x: N): boolean {
        return this.#fbs.contains(x);
    }
}