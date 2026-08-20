export interface FlatTreeNode {
    path: string;
    name: string;
    depth: number;
    isDir: boolean;
    isOpen: boolean;
    parentPath: string | null;
    count?: number;
}
