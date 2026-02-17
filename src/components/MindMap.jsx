import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, X, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const Node = ({ node, index, onDrag, onToggle, isFolded }) => {
    const nodeRef = useRef(null);

    useEffect(() => {
        if (!nodeRef.current) return;

        const drag = d3.drag()
            .on('start', (e) => {
                // optional: set active state
            })
            .on('drag', (e) => {
                onDrag(node.data.id, e.dx, e.dy);
            });

        d3.select(nodeRef.current).call(drag);
    }, [onDrag, node.data.id]);

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
                cursor: 'grab'
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, cursor: 'grabbing' }}
        >
            <div
                className="node-content"
                style={{
                    background: node.data.style?.backgroundColor || '#ffffff',
                    color: node.data.style?.color || '#1e293b',
                    border: `1px solid ${node.depth === 0 ? '#3b82f6' : '#e2e8f0'}`,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '14px',
                    fontWeight: node.depth === 0 ? '600' : '400',
                    whiteSpace: 'nowrap',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    userSelect: 'none' // Prevent text selection while dragging
                }}
            >
                {hasChildren && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                        onClick={(e) => { e.stopPropagation(); onToggle(node.data.id); }}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 0,
                            marginRight: 4,
                            fontSize: '10px',
                            color: '#64748b'
                        }}
                    >
                        {isFolded ? '➕' : '➖'}
                    </button>
                )}

                {node.data.icon && <span className="icon">🔹</span>}

                {node.data.link ? (
                    <a
                        href={node.data.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'none' }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {node.data.text}
                        <span style={{ fontSize: '0.8em', marginLeft: 4 }}>🔗</span>
                    </a>
                ) : (
                    <span>{node.data.text}</span>
                )}
            </div>
        </motion.div>
    );
};

const MindMap = ({ data, onClose }) => {
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [foldedIds, setFoldedIds] = useState(new Set());
    // Store drag overrides as { id: { x: 0, y: 0 } }
    // x corresponds to vertical shift (d3 tree x), y to horizontal (d3 tree y)
    const [dragOverrides, setDragOverrides] = useState({});

    const containerRef = useRef(null);
    const wrapperRef = useRef(null);

    // Initialize folded state from data
    useEffect(() => {
        if (!data) return;
        const initialFolded = new Set();
        const traverse = (node) => {
            if (node.folded) initialFolded.add(node.id);
            if (node.children) node.children.forEach(traverse);
        };
        traverse(data);
        setFoldedIds(initialFolded);
    }, [data]);

    // Setup Zoom behavior
    useEffect(() => {
        if (!containerRef.current || !wrapperRef.current) return;

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                setTransform(event.transform);
            });

        const selection = d3.select(containerRef.current);
        selection.call(zoom)
            .call(zoom.transform, d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(0.8));

    }, []);

    const toggleFold = (id) => {
        setFoldedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Callback to update node position
    // dx, dy are screen pixels. We must divide by transform.k to get world pixels.
    const handleNodeDrag = (id, dx, dy) => {
        setDragOverrides(prev => {
            const current = prev[id] || { x: 0, y: 0 };
            // d3 tree: x is vertical, y is horizontal
            // event dy -> affects node.x
            // event dx -> affects node.y
            // transform.k is zoom level
            const scale = transform.k || 1;

            return {
                ...prev,
                [id]: {
                    x: current.x + (dy / scale),
                    y: current.y + (dx / scale)
                }
            };
        });
    };

    const { nodes, links } = useMemo(() => {
        if (!data) return { nodes: [], links: [] };

        // Hierarchy with custom children accessor based on folded state
        const hierarchy = d3.hierarchy(data, d => {
            if (foldedIds.has(d.id)) return null;
            return d.children;
        });

        // Layout
        const treeLayout = d3.tree().nodeSize([50, 250]);
        treeLayout(hierarchy);

        const nodesList = hierarchy.descendants();

        // Apply overrides
        nodesList.forEach(node => {
            const override = dragOverrides[node.data.id];
            if (override) {
                node.x += override.x;
                node.y += override.y;
            }
        });

        return {
            nodes: nodesList,
            links: hierarchy.links()
        };
    }, [data, foldedIds, dragOverrides]); // We depend on overrides to re-calc links

    // Helper for generating link path
    const linkPath = d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x);

    return (
        <div
            ref={containerRef}
            className="mindmap-container"
            style={{
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden',
                background: '#f8fafc',
                cursor: 'grab' // Cursor for panning canvas
            }}
        >
            {/* UI Controls - Fixed Overlay */}
            <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
                    <X size={20} color="#333" />
                </button>
            </div>

            <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100, display: 'flex', gap: 8 }}>
                <button className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
                    <ZoomIn size={20} color="#333" onClick={() => {
                        d3.select(containerRef.current).transition().call(d3.zoom().scaleBy, 1.2);
                    }} />
                </button>
                <button className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
                    <ZoomOut size={20} color="#333" onClick={() => {
                        d3.select(containerRef.current).transition().call(d3.zoom().scaleBy, 0.8);
                    }} />
                </button>
                <button className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
                    <RefreshCw size={20} color="#333" onClick={() => {
                        setDragOverrides({}); // Reset drags on reset? Maybe better UX.
                        d3.select(containerRef.current).transition().call(d3.zoom().transform, d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(0.8));
                    }} />
                </button>
            </div>

            {/* content wrapper with transform */}
            <div
                ref={wrapperRef}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none' // Let clicks pass through to container for pan, unless on nodes
                }}
            >
                {/* SVG Layer for Links */}
                <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                    <g>
                        {links.map((link, i) => (
                            <path
                                key={i}
                                d={linkPath(link)}
                                fill="none"
                                stroke="#cbd5e1"
                                strokeWidth="2"
                                strokeLinecap="round" // Smooth ends
                            />
                        ))}
                    </g>
                </svg>

                {/* HTML Layer for Nodes */}
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
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MindMap;
