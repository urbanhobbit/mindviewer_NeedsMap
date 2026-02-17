import { useState, useEffect } from 'react';
import { parseFreemind } from '../lib/freemindParser';
import MindMap from './MindMap';
import { motion } from 'framer-motion';

export default function Viewer() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    // Load from URL query param if present
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const textUrl = params.get('url');
        if (textUrl) {
            fetch(textUrl)
                .then(res => res.text())
                .then(text => {
                    try {
                        const parsed = parseFreemind(text);
                        setData(parsed);
                    } catch (e) {
                        setError("Failed to parse from URL: " + e.message);
                    }
                })
                .catch(err => setError("Failed to fetch map: " + err.message));
        }
    }, []);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const parsed = parseFreemind(text);
                setData(parsed);
                setError(null);
            } catch (err) {
                setError("Error parsing file: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    const loadDemo = () => {
        fetch('/demo.mm')
            .then(res => res.text())
            .then(text => {
                const parsed = parseFreemind(text);
                setData(parsed);
            })
            .catch(err => setError("Failed to load demo: " + err.message));
    };

    return (
        <div className="viewer-container">
            {!data && (
                <div className="upload-screen">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
                    >
                        <h1>Freemind Viewer</h1>
                        <p>Visualize your .mm files with a modern, interactive interface.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                            <label className="file-upload-btn" style={{
                                background: 'rgba(255,255,255,0.2)',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                border: '1px solid rgba(255,255,255,0.4)',
                                transition: '0.2s'
                            }}>
                                Open File (.mm)
                                <input type="file" accepts=".mm" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>

                            <button onClick={loadDemo} style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.8)',
                                textDecoration: 'underline',
                                cursor: 'pointer'
                            }}>
                                Or try a demo map
                            </button>
                        </div>

                        {error && <div className="error" style={{ marginTop: 20, background: 'rgba(220, 38, 38, 0.8)', padding: '10px 20px', borderRadius: 6 }}>{error}</div>}
                    </motion.div>
                </div>
            )}

            {data && (
                <div className="mindmap-wrapper">
                    <MindMap data={data} onClose={() => setData(null)} />
                </div>
            )}
        </div>
    );
}
