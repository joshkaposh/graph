export class MinScored<K, T> {
    constructor(public k: K, public t: T) { }
    [Symbol.toPrimitive]() {
        return this.k
    }

    [Symbol.iterator]() {
        return [this.k, this.t][Symbol.iterator]();
    }
}