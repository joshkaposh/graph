import { assert, test } from 'vitest';
import { Graph, Dot, GraphMap, StableGraph } from '../src'

function test_dot(ctor: any) {
    const g = ctor.directed();
    let a = g.add_node('A')
    let b = g.add_node('B')
    let c = g.add_node('C')
    g.remove_node(a);
    a = g.add_node('A')

    g.add_edge(a, b, 'himom');
    g.add_edge(b, c, 'heydad');

    return new Dot(g).render();
}

test('graphmap', () => {
    const g = GraphMap.directed<string, string>()
    let a = g.add_node('A')
    let b = g.add_node('B')
    let c = g.add_node('C')

    g.add_edge(a, b, 'himom')
    g.add_edge(b, c, 'heydad')

    let dot

    dot = new Dot(g)

    dot = Dot.with_attr_getters(g, {}, (g, edge) => {
        let color = 'color = '
        color += edge.weight() === 'himom' ? 'black' : 'blue'
        return color
    }, (g, node) => '')


    // console.log('graphmap');
    // console.log(dot.render());

})

test('dot', () => {
    let g = test_dot(Graph);
    let sg = test_dot(StableGraph);

    // console.log(g, sg);

    // assert(g === sg)

})