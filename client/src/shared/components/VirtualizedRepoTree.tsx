import { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Icon } from './Icon';
import { flattenTree } from '../../features/repository/services/treeUtils';
import type { FlatTreeNode } from '../types/repo';

interface Props {
    tree: any;
    selected: any;
    onSelect: (path: string) => void;
    expanded: Set<string>;
    toggle: (path: string) => void;
    filterFolder: (path: string | null) => void;
    activeFilter: string | null;
}

export function VirtualizedRepoTree({
    tree,
    selected,
    onSelect,
    expanded,
    toggle,
    filterFolder,
    activeFilter
}: Props) {
    const flatNodes = useMemo(() => {
        if (!tree) return [];
        return flattenTree(tree, expanded);
    }, [tree, expanded]);

    const Row = (_index: number, node: FlatTreeNode) => {
        const isFiltered = activeFilter === node.path;
        const isSelected = selected && selected.path === node.path;

        if (node.isDir) {
            return (
                <div 
                    className={`tree-folder ${isFiltered ? 'filtered' : ''}`}
                    style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
                    onClick={() => {
                        if (node.path === '') filterFolder(null);
                        else filterFolder(node.path);
                    }}
                >
                    <span 
                        className={`tree-toggle ${node.isOpen ? 'open' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggle(node.path);
                        }}
                    >
                        ▶
                    </span>
                    <Icon name={node.isOpen ? 'folder-open' : 'folder'} size="m" className="tree-entry-icon" />
                    <span className="tree-name">{node.name}</span>
                    <span className="tree-count">{node.count}</span>
                </div>
            );
        }

        return (
            <div 
                className={`tree-file ${isSelected ? 'active' : ''}`}
                style={{ paddingLeft: `${node.depth * 16 + 18}px` }}
                onClick={() => onSelect(node.path)}
            >
                <Icon name="file" size="s" className="tree-entry-icon" />
                <span className="tree-name">{node.name}</span>
            </div>
        );
    };

    return (
        <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={flatNodes}
            itemContent={Row}
            increaseViewportBy={200}
        />
    );
}
