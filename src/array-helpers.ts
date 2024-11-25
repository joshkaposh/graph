import { Iterator } from "joshkaposh-iterator";
import type { Option } from "joshkaposh-option";

export function extend<T>(array: T[], iter: Iterator<T>) {
    iter.for_each(v => array.push(v))
}

// @ts-ignore
export function reserve(array: any[], additional: number) {

}

export function capacity(len: number): number {
    if (len <= 4) {
        return 4
    }
    const cap = 1 << 31 - Math.clz32(len);
    if (cap <= len) {
        return cap << 1;
    }

    return cap
}

export function swap<T>(array: T[], from_index: number, to_index: number): T[] {
    const temp = array[to_index];
    array[to_index] = array[from_index];
    array[from_index] = temp;
    return array
}

export function swap_remove<T>(array: T[], i: number): Option<T> {
    if (i < array.length - 1) {
        swap(array, i, array.length - 1)
        return array.pop()
    } else {
        return array.pop();
    }
}

export function swap_remove_unchecked<T>(array: T[], i: number): Option<T> {
    swap(array, i, array.length - 1)
    return array.pop()

}