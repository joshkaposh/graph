import { assert } from "joshkaposh-iterator/src/util";
import { IntoNeighbors, Visitable, VisitMap } from ".";

type DfsEventType = {
    [K in keyof typeof DfsEvent]: ReturnType<typeof DfsEvent[K]>;
}[keyof typeof DfsEvent]
const DfsEvent = {
    Discover<N>(u: N, time: Time) {
        return { type: 'Discover', data: [u, time] } as const
    },
    TreeEdge<N>(u: N, v: N) {
        return { type: 'TreeEdge', data: [u, v] } as const
    },

    BackEdge<N>(u: N, v: N) {
        return { type: 'BackEdge', data: [u, v] } as const
    },

    CrossForwardEdge<N>(u: N, v: N) {
        return { type: 'CrossForwardEdge', data: [u, v] } as const
    },

    Finish<N>(u: N, time: Time) {
        return { type: 'Finish', data: [u, time] } as const
    },
}

export const Control = {
    Continue: Symbol('continue'),
    Prune: Symbol('prune'),
    Break<B>(value: B) { return value }
}

class Time {
    constructor(public delta: number) { }
}

export function depth_first_search<N, G extends IntoNeighbors & Visitable<N>, C extends typeof Control[keyof typeof Control]>(graph: G, starts: Iterable<any>, visitor: (event: DfsEventType) => C) {
    const time = new Time(0);
    const discovered = graph.visit_map();
    const finished = graph.visit_map();

    for (const start of starts) {
        try_control(
            dfs_visitor(graph, start, visitor, discovered, finished, time),
            undefined
        )
    }
}

function try_control(ctrl: any, what: any, third?: () => any) {
    if (third) {

    }
}

function dfs_visitor<N extends any, C extends typeof Control[keyof typeof Control], G extends IntoNeighbors & Visitable<any>>(
    graph: G,
    u: N, // G::NodeId,
    visitor: (event: DfsEventType) => N,
    discovered: VisitMap<N>,
    finished: VisitMap<N>,
    time: Time,
): C {

    if (!discovered.visit(u)) {
        return Control.Continue as C
    }

    try_control(
        visitor(DfsEvent.Discover(u, time_post_inc(time))),
        undefined,
        () => {
            for (const v of graph.neighbors(u as number)) {
                if (!discovered.is_visited(v as N)) {
                    try_control(visitor(DfsEvent.TreeEdge(u, v as N)), 'continue')
                    try_control(dfs_visitor(graph, v, visitor as any, discovered as any, finished as any, time), undefined)
                } else if (!finished.is_visited(v as N)) {
                    try_control(visitor(DfsEvent.BackEdge(u, v as N)), 'continue')
                } else {
                    try_control(visitor(DfsEvent.CrossForwardEdge(u, v as N)), 'continue')
                }
            }
        }
    )
    const first_finish = finished.visit(u);
    assert(first_finish)
    try_control(visitor(DfsEvent.Finish(u, time_post_inc(time))), 'error')

    return Control.Continue as C
}

function time_post_inc(time: Time) {
    time.delta += 1;
    return time
}