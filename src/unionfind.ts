import { range } from "joshkaposh-iterator";

export class UnionFind {
    #parent: number[];
    #rank: number[] // u8

    constructor(size: number) {
        this.#rank = Array.from({ length: size }, () => 0);
        this.#parent = range(0, size).collect();
    }

    find_mut(x: number): number {
        return this.#find_mut_recursive(x)
    }

    #find_mut_recursive(x: number): number {
        let parent = this.#parent[x];
        while (parent !== x) {
            let grandparent = this.#parent[parent];
            this.#parent[x] = grandparent;
            x = parent;
            parent = grandparent;
        }
        return x;
    }

    find(x: number): number {
        while (true) {
            let xparent = this.#parent[x];

            if (xparent === x) {
                break
            }
            x = xparent;
        }
        return x
    }

    equiv(x: number, y: number) {
        return this.find(x) === this.find(y);
    }

    union(x: number, y: number): boolean {
        if (x === y) {
            return false;
        }

        let xrep = this.find_mut(x);
        let yrep = this.find_mut(y);

        if (xrep === yrep) {
            return false
        }

        let xrank = this.#rank[xrep];
        let yrank = this.#rank[yrep];

        if (xrank < yrank) {
            this.#parent[xrep] = yrep;
        } else if (xrank === yrank) {
            this.#parent[yrep] = xrep;
        } else {
            this.#parent[yrep] = xrep;
            this.#rank[xrep] += 1;
        }

        return true;
    }
}