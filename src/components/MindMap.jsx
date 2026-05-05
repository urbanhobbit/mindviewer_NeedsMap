import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

const Node = ({ node, index, onDrag, onToggle, isFolded, onEdit, isSelected, onSelect, isEditing, onStartEdit, onEndEdit }) => {
    const nodeRef = useRef(null);
    const [editText, setEditText] = useState(node.data.text || '');
    const lastClickRef = useRef(0);

    // Reset local edit text when editing starts
    useEffect(() => {
        if (isEditing) {
            setEditText(node.data.text || '');
        }
    }, [isEditing, node.data.text]);

    useEffect(() => {
        if (!nodeRef.current || isEditing) return;

        const drag = d3.drag()
            .filter((event) => {
                return !event.target.closest('button') && !event.target.closest('a') && !event.target.closest('input');
            })
            .on('start', () => onSelect(node.data.id))
            .on('drag', (e) => {
                onDrag(node.data.id, e.dx, e.dy);
            });

        d3.select(nodeRef.current).call(drag);
    }, [onDrag, node.data.id, isEditing, onSelect]);

    const handleClick = (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastClickRef.current < 300) {
            // Double click detected (bypassing D3's drag event block)
            onStartEdit(node.data.id);
        } else {
            onSelect(node.data.id);
        }
        lastClickRef.current = now;
    };

    const handleSaveEdit = () => {
        onEndEdit();
        if (editText !== node.data.text) {
            onEdit(node.data.id, editText);
        }
    };

    const hasChildren = node.data.children && node.data.children.length > 0;

    return (
        <motion.div
            ref={nodeRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, x: node.y, y: node.x }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'absolute',
                top: -15,
                left: 0,
                pointerEvents: 'auto',
                cursor: isEditing ? 'text' : 'pointer',
                zIndex: isSelected ? 10 : 1
            }}
            onClick={handleClick}
        >
            <div
                className="node-content"
                style={{
                    background: node.depth === 0 ? '#e0f2fe' : (isSelected ? '#f3f4f6' : 'transparent'),
                    color: '#333',
                    border: isSelected ? '2px solid #3b82f6' : (node.depth === 0 ? '2px solid #60a5fa' : '2px solid transparent'),
                    borderBottom: !isSelected && node.depth !== 0 ? '1px solid #ccc' : undefined,
                    padding: '6px 12px',
                    borderRadius: node.depth === 0 ? '8px' : '4px',
                    fontSize: node.depth === 0 ? '16px' : '14px',
                    fontWeight: node.depth === 0 ? '600' : '400',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    userSelect: isEditing ? 'text' : 'none',
                    boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none',
                    transition: 'all 0.1s ease'
                }}
            >
                {hasChildren && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggle(node.data.id); }}
                        style={{
                            border: '1px solid #ccc',
                            background: '#fff',
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 4,
                            fontSize: '12px',
                            color: '#666',
                            pointerEvents: 'auto',
                            padding: 0
                        }}
                    >
                        {isFolded ? '+' : '-'}
                    </button>
                )}

                {node.data.icon && <span className="icon">🔹</span>}

                {isEditing ? (
                    <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={e => { 
                            if (e.key === 'Enter') handleSaveEdit(); 
                            if (e.key === 'Escape') onEndEdit(); // cancel edit
                        }}
                        autoFocus
                        style={{ 
                            border: 'none', 
                            background: 'transparent',
                            padding: '0', 
                            outline: 'none',
                            fontSize: 'inherit',
                            fontWeight: 'inherit',
                            fontFamily: 'inherit',
                            color: '#333',
                            minWidth: '50px'
                        }}
                        onPointerDown={e => e.stopPropagation()}
                    />
                ) : node.data.link ? (
                    <a
                        href={node.data.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'underline' }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {node.data.text}
                    </a>
                ) : (
                    <span>{node.data.text || ' '}</span>
                )}
            </div>
        </motion.div>
    );
};

const MindMap = ({ data, onChange, externalCommand }) => {
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [foldedIds, setFoldedIds] = useState(new Set());
    const [dragOverrides, setDragOverrides] = useState({});
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [editingNodeId, setEditingNodeId] = useState(null);

    const containerRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (!data) return;
        const initialFolded = new Set();
        const traverse = (node) => {
            if (node.folded) initialFolded.add(node.id);
            if (node.children) node.children.forEach(traverse);
        };
        traverse(data);
        setFoldedIds(initialFolded);
        
        if (!selectedNodeId) {
            setSelectedNodeId(data.id);
        }
    }, [data]);

    useEffect(() => {
        if (!containerRef.current || !wrapperRef.current) return;

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                setTransform(event.transform);
            });

        d3.select(containerRef.current).call(zoom);

        const centerMap = () => {
            d3.select(containerRef.current)
              .transition().duration(500)
              .call(zoom.transform, d3.zoomIdentity.translate(window.innerWidth / 3, window.innerHeight / 2).scale(1));
        };
        
        if (transform.x === 0 && transform.y === 0) {
            centerMap();
        }

        window.fitMindMap = centerMap;
        window.zoomMindMap = (factor) => d3.select(containerRef.current).transition().call(zoom.scaleBy, factor);

    }, []);

    useEffect(() => {
        if (!externalCommand) return;
        
        switch (externalCommand.type) {
            case 'ADD_CHILD':
                if (selectedNodeId) handleAddChild(selectedNodeId);
                break;
            case 'DELETE_NODE':
                if (selectedNodeId && selectedNodeId !== data.id) handleDeleteNode(selectedNodeId);
                break;
            case 'EDIT_NODE':
                if (selectedNodeId) setEditingNodeId(selectedNodeId);
                break;
            case 'ZOOM_IN':
                if (window.zoomMindMap) window.zoomMindMap(1.2);
                break;
            case 'ZOOM_OUT':
                if (window.zoomMindMap) window.zoomMindMap(0.8);
                break;
            case 'FIT_MAP':
                if (window.fitMindMap) window.fitMindMap();
                setDragOverrides({});
                break;
        }
    }, [externalCommand]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (selectedNodeId && !editingNodeId) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    handleAddChild(selectedNodeId);
                } else if (e.key === 'Backspace' || e.key === 'Delete') {
                    if (selectedNodeId !== data.id) {
                        handleDeleteNode(selectedNodeId);
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChild(selectedNodeId);
                } else if (e.key === ' ') {
                    e.preventDefault();
                    setEditingNodeId(selectedNodeId);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId, editingNodeId, data]);

    const toggleFold = (id) => {
        setFoldedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleNodeDrag = (id, dx, dy) => {
        setDragOverrides(prev => {
            const current = prev[id] || { x: 0, y: 0 };
            const scale = transform.k || 1;
            return {
                ...prev,
                [id]: { x: current.x + (dy / scale), y: current.y + (dx / scale) }
            };
        });
    };

    const cloneData = () => JSON.parse(JSON.stringify(data));

    const traverseAndModify = (node, targetId, callback) => {
        if (node.id === targetId) return callback(node, null, null);
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                const result = traverseAndModify(node.children[i], targetId, callback);
                if (result) {
                    if (result === 'DELETE') {
                        node.children.splice(i, 1);
                        return true;
                    }
                    return result;
                }
            }
        }
        return false;
    };

    const handleEditNode = (id, newText) => {
        const newData = cloneData();
        traverseAndModify(newData, id, (node) => {
            node.text = newText;
            return true;
        });
        onChange(newData, `Edited node: "${newText}"`);
    };

    const handleAddChild = (parentId) => {
        const newData = cloneData();
        const newId = 'node_' + Math.random().toString(36).substr(2, 9);
        
        traverseAndModify(newData, parentId, (node) => {
            if (!node.children) node.children = [];
            node.children.push({
                id: newId,
                text: 'New Node',
                children: []
            });
            setFoldedIds(prev => {
                const next = new Set(prev);
                next.delete(parentId);
                return next;
            });
            return true;
        });
        
        onChange(newData, `Added child node`);
        setSelectedNodeId(newId);
        setEditingNodeId(newId); // Automatically open edit mode for new node
    };

    const handleDeleteNode = (id) => {
        const newData = cloneData();
        traverseAndModify(newData, id, () => 'DELETE');
        onChange(newData, `Deleted node`);
        setSelectedNodeId(data.id);
    };

    const { nodes, links } = useMemo(() => {
        if (!data) return { nodes: [], links: [] };

        const hierarchy = d3.hierarchy(data, d => foldedIds.has(d.id) ? null : d.children);
        
        const treeLayout = d3.tree()
            .nodeSize([40, 200])
            .separation((a, b) => a.parent === b.parent ? 1 : 1.2);

        treeLayout(hierarchy);

        const nodesList = hierarchy.descendants();
        
        nodesList.forEach(node => {
            const localOverride = dragOverrides[node.data.id] || { x: 0, y: 0 };
            const parentOverride = node.parent && node.parent.totalOverride ? node.parent.totalOverride : { x: 0, y: 0 };
            
            node.totalOverride = {
                x: localOverride.x + parentOverride.x,
                y: localOverride.y + parentOverride.y
            };

            node.x += node.totalOverride.x;
            node.y += node.totalOverride.y;
        });

        return {
            nodes: nodesList,
            links: hierarchy.links()
        };
    }, [data, foldedIds, dragOverrides]);

    const linkPath = d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x);

    return (
        <div
            ref={containerRef}
            className="mindmap-container"
            onClick={() => { setSelectedNodeId(null); setEditingNodeId(null); }}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: '#fafafa',
                cursor: 'grab'
            }}
        >
            <div
                ref={wrapperRef}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none'
                }}
            >
                <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                    <g>
                        {links.map((link, i) => {
                            const isRootLink = link.source.depth === 0;
                            return (
                                <path 
                                    key={i} 
                                    d={linkPath(link)} 
                                    fill="none" 
                                    stroke={isRootLink ? "#9ca3af" : "#d1d5db"} 
                                    strokeWidth={isRootLink ? "2" : "1.5"} 
                                    strokeLinecap="round" 
                                />
                            );
                        })}
                    </g>
                </svg>

                <div style={{ position: 'absolute', top: 0, left: 0 }}>
                    <div>
                        {nodes.map((node, i) => (
                            <Node
                                key={node.data.id || i}
                                node={node}
                                index={i}
                                onDrag={handleNodeDrag}
                                onToggle={toggleFold}
                                isFolded={foldedIds.has(node.data.id)}
                                onEdit={handleEditNode}
                                isSelected={selectedNodeId === node.data.id}
                                onSelect={setSelectedNodeId}
                                isEditing={editingNodeId === node.data.id}
                                onStartEdit={setEditingNodeId}
                                onEndEdit={() => setEditingNodeId(null)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MindMap;
