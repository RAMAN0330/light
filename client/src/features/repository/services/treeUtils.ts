import type { FlatTreeNode } from '../../../shared/types/repo';

function fileCounts(root: any): Map<any, number> {
    const counts = new Map<any, number>();
    const stack: Array<[any, boolean]> = [[root, false]];
    while (stack.length) {
        const [node, visited] = stack.pop()!;
        if (!visited) {
            stack.push([node, true]);
            Object.values(node.children || {}).forEach(child => stack.push([child, false]));
            continue;
        }
        let count = node.files?.length || 0;
        Object.values(node.children || {}).forEach(child => { count += counts.get(child) || 0; });
        counts.set(node, count);
    }
    return counts;
}

export function flattenTree(node: any, expandedPaths: Set<string>): FlatTreeNode[] {
    const result: FlatTreeNode[] = [];
    const counts = fileCounts(node);
    const stack: Array<{ node: any; depth: number; parentPath: string | null; isFile?: boolean }> = [
        { node, depth: 0, parentPath: null },
    ];

    while (stack.length) {
        const item = stack.pop()!;
        const current = item.node;
        if (item.isFile) {
            result.push({ path: current.path, name: current.name, depth: item.depth, isDir: false, isOpen: false, parentPath: item.parentPath });
            continue;
        }

        const isRoot = current.path === '';
        if (!isRoot) {
            result.push({
                path: current.path, name: current.name, depth: item.depth, isDir: true,
                isOpen: expandedPaths.has(current.path), parentPath: item.parentPath, count: counts.get(current) || 0,
            });
        }
        if (!isRoot && !expandedPaths.has(current.path)) continue;

        const childDepth = isRoot ? 0 : item.depth + 1;
        const files = [...(current.files || [])].sort((a: any, b: any) => a.name.localeCompare(b.name));
        for (let index = files.length - 1; index >= 0; index -= 1) {
            stack.push({ node: files[index], depth: childDepth, parentPath: current.path, isFile: true });
        }
        const folders = Object.values(current.children || {}).sort((a: any, b: any) => a.name.localeCompare(b.name));
        for (let index = folders.length - 1; index >= 0; index -= 1) {
            stack.push({ node: folders[index], depth: childDepth, parentPath: current.path });
        }
    }
    return result;
}
