import { iter, Iterator } from "joshkaposh-iterator";
import { None } from "joshkaposh-option";

export type Some<T> = T extends None ? never : T;

export function enumerate<T>(iterable: Iterable<T>): Iterator<[number, T]> {
    return iter(iterable).enumerate()
}

export function zip<K, V>(i: Iterable<K>, j: Iterable<V>): Iterator<[K, V]> {
    return iter(i).zip(j);
}

// export function ord<T, R>(lhs: T, rhs: T, cases: {
//     eq?: () => R;
//     lt?: () => R;
//     gt?: () => R;
// }) {
//     if (lhs === rhs) {
//         cases.eq?.call(null)
//     } else if (lhs < rhs) {
//         cases.lt?.call(null)
//     } else {
//         cases.gt?.call(null)
//     }
// }