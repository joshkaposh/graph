import { Primitive } from "joshkaposh-iterator"
import { is_primitive } from "joshkaposh-iterator/src/util"

export type Class<Args extends any[] = any[], Inst = any> = new (...args: Args) => Inst

type NativeClass<T = any, V = any> = Array<T> |
    Set<T> |
    Map<T, V> |
    WeakSet<T extends WeakKey ? T : never> |
    WeakMap<T extends WeakKey ? T : never, V>


type NativeContructor = ArrayConstructor |
    SetConstructor |
    MapConstructor |
    WeakSetConstructor |
    WeakMapConstructor

export type DefaultImpl<T extends Class> = T & { default(): InstanceType<T> }

export type DefaultTrait<T extends Primitive | Class> = T extends Primitive ? T :
    T extends NativeContructor ? T :
    DefaultImpl<T extends Class ? T : never>

export type Default<T extends Primitive | Class = Primitive | Class> = DefaultTrait<T>

type DefaultType<T> = T extends Primitive ? T :
    T extends NativeContructor ? NativeClass<T> :
    T extends DefaultImpl<Class> ? T['default'] : never;


const cases = Object.freeze({
    string() { return '' },
    number() {
        return 0
    },
    boolean() { return false },
    undefined(): undefined { },
    null(): null { return null },
    object(ty: DefaultImpl<Class>): object & {} { return ty.default() },
    function() { },

})

function is_native_ctor(ty: unknown): ty is NativeContructor {
    return ty === Set || ty === Map || ty === WeakMap || ty === WeakSet
}

// @ts-expect-error
export function create_default<T extends Default>(value: T): DefaultType<T> {
    if (is_primitive(value)) {
        // @ts-expect-error;
        return cases[`${String(value)}`]()
    }
    if (is_native_ctor(value)) {
        // @ts-expect-error
        return new value()
    }
    if (value && 'default' in value) {
        // @ts-expect-error
        return value.default()
    }
}
