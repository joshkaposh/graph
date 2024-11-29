import { iter, Iterator } from "joshkaposh-iterator";
import type { None, Option } from "joshkaposh-option";
import type { GraphIx } from "./graph";

export type Orderable<T> = T extends Ord ? T : never

export type Ord = Option<(string) & string | (boolean) & boolean | (number) & number | {
    [Symbol.toPrimitive](): string;
}> & {}

export function umax(int_size: GraphIx) {
    return Math.pow(2, int_size) - 1
}

export function next_power_of_2(n: number) {
    if (n <= 1) {
        return 1
    }

    return Math.abs(Math.clz32(n - 1) - 32)
}

export type Some<T> = T extends None ? never : T;

export function enumerate<T>(iterable: Iterable<T>): Iterator<[number, T]> {
    return iter(iterable).enumerate()
}

export function zip<K, V>(i: Iterable<K>, j: Iterable<V>): Iterator<[K, V]> {
    return iter(i).zip(j);
}