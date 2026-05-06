import { useState, useEffect, useRef } from 'react';
import { parseFreemind, exportFreemind } from '../lib/freemindParser';
import MindMap from './MindMap';
import { motion } from 'framer-motion';
import { 
    isFirebaseConfigured, 
    saveMapToDB, 
    loadMapFromDB, 
    saveRevisionToDB, 
    subscribeToMapChanges, 
    subscribeToRevisions 
} from '../lib/firebase';
import { Download, Upload, Clock, Plus, Trash2, Edit2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

export default function Viewer() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState('');
    const [revisions, setRevisions] = useState([]);
    const [showRevisions, setShowRevisions] = useState(false);
    const [fileName, setFileName] = useState('map.mm');
    const [isLoading, setIsLoading] = useState(false);
    
    // Commands to send to the MindMap component
    const [externalCommand, setExternalCommand] = useState(null);

    // To prevent an infinite loop where incoming DB changes re-trigger a DB save
    const ignoreNextChangeRef = useRef(false);

    useEffect(() => {
        const savedUsername = localStorage.getItem('mindmap_username');
        if (savedUsername) setUsername(savedUsername);

        const params = new URLSearchParams(window.location.search);
        const mapIdParam = params.get('id');

        if (mapIdParam && isFirebaseConfigured) {
            setIsLoading(true);
            loadMapFromDB(mapIdParam)
                .then(mapData => {
                    if (mapData) {
                        setData(mapData);
                        setFileName(`${mapIdParam}.mm`);
                    } else {
                        setError(`Map with ID ${mapIdParam} not found in database.`);
                    }
                })
                .catch(err => setError("Failed to fetch map from DB: " + err.message))
                .finally(() => setIsLoading(false));
        } else {
            const textUrl = params.get('url');
            if (textUrl) {
                setFileName(textUrl.split('/').pop() || 'map.mm');
                setIsLoading(true);
                fetch(textUrl)
                    .then(res => res.text())
                    .then(text => {
                        try {
                            const parsed = parseFreemind(text);
                            loadInitialData(parsed);
                        } catch (e) {
                            setError("Failed to parse from URL: " + e.message);
                        }
                    })
                    .catch(err => setError("Failed to fetch map: " + err.message))
                    .finally(() => setIsLoading(false));
            }
        }
    }, []);

    useEffect(() => {
        if (!data || !isFirebaseConfigured) return;

        const unsubscribeMap = subscribeToMapChanges(data.id, (updatedMapData) => {
            if (updatedMapData) {
                ignoreNextChangeRef.current = true;
                setData(updatedMapData);
            }
        });

        const unsubscribeRevisions = subscribeToRevisions(data.id, (updatedRevisions) => {
            setRevisions(updatedRevisions);
        });

        return () => {
            unsubscribeMap();
            unsubscribeRevisions();
        };
    }, [data?.id]);

    const loadInitialData = async (parsedData) => {
        setData(parsedData);
        
        if (isFirebaseConfigured) {
            const existing = await loadMapFromDB(parsedData.id);
            if (!existing) {
                await saveMapToDB(parsedData.id, parsedData);
                const initialRevision = {
                    timestamp: new Date().toISOString(),
                    user: 'System (Initial Load)',
                    action: 'Imported map',
                    data: parsedData
                };
                await saveRevisionToDB(parsedData.id, initialRevision);
            }
            
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('id', parsedData.id);
            newUrl.searchParams.delete('url');
            window.history.pushState({}, '', newUrl);

        } else {
            const storedRevisions = localStorage.getItem(`revisions_${parsedData.id}`);
            if (storedRevisions) {
                setRevisions(JSON.parse(storedRevisions));
            } else {
                const initialRevision = {
                    timestamp: new Date().toISOString(),
                    user: 'System (Initial Load)',
                    action: 'Imported map',
                    data: parsedData
                };
                setRevisions([initialRevision]);
                localStorage.setItem(`revisions_${parsedData.id}`, JSON.stringify([initialRevision]));
            }
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const parsed = parseFreemind(text);
                await loadInitialData(parsed);
                setError(null);
            } catch (err) {
                setError("Error parsing file: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    const loadDefaultMap = () => {
        setFileName('Callistay_Sonrasi.mm');
        fetch('Callistay_Sonrasi.mm')
            .then(res => res.text())
            .then(text => {
                const parsed = parseFreemind(text);
                loadInitialData(parsed);
            })
            .catch(err => setError("Failed to load default map: " + err.message));
    };

    const handleDataChange = async (newData, actionDescription) => {
        if (ignoreNextChangeRef.current) {
            ignoreNextChangeRef.current = false;
            return;
        }

        setData(newData);
        const currentUser = username || 'Anonymous';
        
        const newRevision = {
            timestamp: new Date().toISOString(),
            user: currentUser,
            action: actionDescription || 'Edited map',
            data: newData
        };

        if (isFirebaseConfigured) {
            try {
                await saveMapToDB(newData.id, newData);
                await saveRevisionToDB(newData.id, newRevision);
            } catch (err) {
                console.error("Error saving to DB:", err);
                alert("Could not save changes to cloud. Check console for details.");
            }
        } else {
            const updatedRevisions = [...revisions, newRevision];
            setRevisions(updatedRevisions);
            localStorage.setItem(`revisions_${newData.id}`, JSON.stringify(updatedRevisions));
        }
    };

    const restoreRevision = (revisionIndex) => {
        const rev = revisions[revisionIndex];
        if (rev) {
            handleDataChange(rev.data, `Restored to revision from ${new Date(rev.timestamp).toLocaleString()}`);
        }
    };

    const handleExport = () => {
        if (!data) return;
        try {
            const xmlString = exportFreemind(data);
            const blob = new Blob([xmlString], { type: 'text/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace('.mm', '') + '_edited.mm';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Export failed: ' + err.message);
        }
    };

    // Toolbar Command Sender
    const triggerCommand = (cmd) => {
        setExternalCommand({ type: cmd, timestamp: Date.now() });
    };

    return (
        <div className="viewer-container" style={{ position: 'relative', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
            {/* MindMup Style Toolbar */}
            {data && !isLoading && (
                <div style={{
                    height: '48px',
                    background: '#ffffff',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    zIndex: 100,
                    gap: '12px'
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#333', marginRight: '16px' }}>MindMupish</div>
                    
                    <div style={{ height: '24px', width: '1px', background: '#e0e0e0', margin: '0 8px' }}></div>

                    <button className="toolbar-btn" onClick={() => triggerCommand('ADD_CHILD')} title="Add Child Node (Tab)">
                        <Plus size={18} />
                    </button>
                    <button className="toolbar-btn" onClick={() => triggerCommand('EDIT_NODE')} title="Edit Node (Space)">
                        <Edit2 size={18} />
                    </button>
                    <button className="toolbar-btn" onClick={() => triggerCommand('DELETE_NODE')} title="Delete Node (Backspace)">
                        <Trash2 size={18} />
                    </button>

                    <div style={{ height: '24px', width: '1px', background: '#e0e0e0', margin: '0 8px' }}></div>

                    <button className="toolbar-btn" onClick={() => triggerCommand('ZOOM_IN')} title="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                    <button className="toolbar-btn" onClick={() => triggerCommand('ZOOM_OUT')} title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                    <button className="toolbar-btn" onClick={() => triggerCommand('FIT_MAP')} title="Center Map">
                        <Maximize size={18} />
                    </button>

                    <div style={{ flex: 1 }}></div> {/* Spacer */}

                    <button className="toolbar-btn" onClick={() => setShowRevisions(!showRevisions)} title="History">
                        <Clock size={18} /> History
                    </button>
                    <button className="toolbar-btn" onClick={handleExport} title="Download .mm">
                        <Download size={18} /> Export
                    </button>
                    
                    <label className="toolbar-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} title="Open .mm">
                        <Upload size={18} /> Import
                        <input type="file" accept=".mm,.xml" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>

                    <style>{`
                        .toolbar-btn {
                            background: transparent;
                            border: 1px solid transparent;
                            border-radius: 4px;
                            padding: 6px 10px;
                            cursor: pointer;
                            display: flex;
                            alignItems: center;
                            gap: 6px;
                            color: #444;
                            font-size: 13px;
                            transition: all 0.1s;
                        }
                        .toolbar-btn:hover {
                            background: #f0f0f0;
                            border-color: #dcdcdc;
                        }
                    `}</style>
                </div>
            )}

            {isLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <h2>Loading Map from Cloud...</h2>
                </div>
            )}

            {!data && !isLoading && (
                <div className="upload-screen" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
                    >
                        <h1 style={{ color: '#222' }}>MindMupish Editor</h1>
                        <p style={{ color: '#555' }}>Visualize and collaborate on your .mm files with a clean interface.</p>
                        
                        {!isFirebaseConfigured && (
                            <div style={{ padding: '10px', background: '#fff3cd', color: '#856404', borderRadius: '6px', fontSize: '0.9em', maxWidth: 400, textAlign: 'center' }}>
                                <strong>Cloud sync is disabled.</strong><br/>
                                Changes will only be saved locally to your browser. Configure Firebase to enable real-time collaboration.
                            </div>
                        )}

                        <input 
                            type="text" 
                            placeholder="Your Username (for revisions)" 
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                localStorage.setItem('mindmap_username', e.target.value);
                            }}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', color: '#000', width: '250px' }}
                        />

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: '10px' }}>
                            <label style={{
                                background: '#3b82f6',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                Open File (.mm)
                                <input type="file" accept=".mm,.xml" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>

                            <button onClick={loadDefaultMap} style={{
                                background: 'white',
                                border: '1px solid #ccc',
                                color: '#333',
                                padding: '10px 20px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                Work on Default File (Çalıştay Sonrası)
                            </button>
                        </div>

                        {error && <div className="error" style={{ marginTop: 20, background: '#fee2e2', color: '#b91c1c', padding: '10px 20px', borderRadius: 6, border: '1px solid #fca5a5' }}>{error}</div>}
                    </motion.div>
                </div>
            )}

            {data && !isLoading && (
                <div className="mindmap-wrapper" style={{ flex: 1, position: 'relative' }}>
                    <MindMap 
                        data={data} 
                        onChange={handleDataChange}
                        externalCommand={externalCommand}
                    />
                    
                    {/* Share Link Toast */}
                    {isFirebaseConfigured && (
                        <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'white', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, color: 'black', border: '1px solid #e5e7eb' }}>
                            <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 6, fontWeight: '500' }}>Share this map:</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input readOnly value={window.location.href} style={{ border: '1px solid #ccc', padding: '6px', borderRadius: 4, width: 220, fontSize: '0.85em', background: '#f9fafb' }} />
                                <button onClick={() => { navigator.clipboard.writeText(window.location.href); }} style={{ padding: '6px 12px', cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85em', fontWeight: '500' }}>Copy</button>
                            </div>
                        </div>
                    )}

                    {showRevisions && (
                        <div style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            width: 300,
                            maxHeight: 'calc(100vh - 100px)',
                            overflowY: 'auto',
                            background: 'white',
                            color: 'black',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            padding: '16px',
                            zIndex: 200,
                            border: '1px solid #e5e7eb'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                                <h3 style={{ margin: 0, fontSize: '16px', color: '#111' }}>Revision History</h3>
                                <button onClick={() => setShowRevisions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#666' }}>&times;</button>
                            </div>
                            
                            {revisions.map((rev, idx) => (
                                <div key={idx} style={{ marginBottom: 12, fontSize: '0.9em', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                                    <div style={{ fontWeight: '600', color: '#374151' }}>{rev.user}</div>
                                    <div style={{ color: '#9ca3af', fontSize: '0.8em', marginBottom: 4 }}>{new Date(rev.timestamp).toLocaleString()}</div>
                                    <div style={{ color: '#4b5563' }}>{rev.action}</div>
                                    {idx !== revisions.length - 1 && (
                                        <button 
                                            onClick={() => restoreRevision(idx)}
                                            style={{ marginTop: 6, padding: '4px 8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: '0.85em', fontWeight: '500' }}
                                        >
                                            Restore this version
                                        </button>
                                    )}
                                </div>
                            ))}
                            {revisions.length === 0 && <div style={{ color: '#666' }}>No revisions yet.</div>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}