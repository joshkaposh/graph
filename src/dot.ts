import { EdgeRef, GraphRef, IntoEdgeReferences, IntoNodeReferences, NodeRef } from "./visit";



interface Config {
    NodeIndexLabel?: true;
    EdgeIndexLabel?: true;
    EdgeNoLabel?: true
    NodeNoLabel?: true;
}

export class Dot<G extends IntoEdgeReferences & IntoNodeReferences & GraphRef<any, any>> {
    #g: G
    #config: Config;
    #get_node_attributes: (graph: G, node: NodeRef<number, any>) => string
    #get_edge_attributes: (graph: G, edge: EdgeRef<number, number, any>) => string
    #get_graph_attributes: (graph: G) => string

    constructor(
        graph: G,
        options: Config = {},
        get_edge_attributes: (graph: G, node: EdgeRef<number, number, any>) => string = () => '',
        get_node_attributes: (graph: G, node: NodeRef<number, any>) => string = () => '',
        get_graph_attributes: (graph: G) => string = () => ''
    ) {
        this.#g = graph;
        this.#config = options;
        this.#get_edge_attributes = get_edge_attributes;
        this.#get_node_attributes = get_node_attributes;
        this.#get_graph_attributes = get_graph_attributes;
    }

    static with_attr_getters<G extends IntoEdgeReferences & IntoNodeReferences & GraphRef<any, any>>(
        graph: G,
        config: Config = {},
        get_edge_attributes: (graph: G, edge: EdgeRef<number, number, any>) => string,
        get_node_attributes: (graph: G, node: NodeRef<number, any>) => string,
        get_graph_attributes: (graph: G) => string = () => ''

    ): Dot<G> {
        return new Dot(graph, config, get_edge_attributes, get_node_attributes, get_graph_attributes)
    }

    #format() {
        const g = this.#g;
        const ns: string[] = []
        const es: string[] = []

        for (const node of g.node_references()) {
            let n = `${node.id()} [`;
            if (!this.#config.NodeNoLabel) {
                n += ' label = '

                if (this.#config.NodeIndexLabel) {
                    n += `${node.id()}`
                } else {
                    n += `${node.weight()}`
                }
            }

            n += ` ${this.#get_node_attributes(g, node)}]`
            ns.push(n)
        }

        const connect = g.is_directed() ? '->' : '--'

        for (const [i, edge] of g.edge_references().enumerate()) {
            let e = `${edge.source()} ${connect} ${edge.target()} [`;

            if (!this.#config.EdgeNoLabel) {
                e += ' label = '

                if (this.#config.EdgeIndexLabel) {
                    e += i
                } else {
                    e += edge.weight();
                }
            }

            e += ` ${this.#get_edge_attributes(g, edge)}]`
            es.push(e)
        }

        return [ns.reduce((acc, x) => acc += `  ${x}\n`, ''), es.reduce((acc, x) => acc += `  ${x}\n`, '')]
    }

    render() {
        const [ns, es] = this.#format();
        const ty = this.#g.is_directed()
        const type = ty ? 'digraph' : 'graph';
        let output = `${type} {\n`
        output += ns
        output += es
        output += '}'
        return output
    }
}