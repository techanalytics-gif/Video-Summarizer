import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const Topics = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchTopics = async () => {
        setLoading(true);
        setError('');
        try {
            const userId = user?.id || '';
            const resp = await fetch(`${API_BASE}/api/topics?user_id=${userId}`);
            if (!resp.ok) throw new Error('Failed to fetch topics');
            const data = await resp.json();
            setTopics(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchTopics();
    }, [user]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#22c55e';
            case 'processing': return '#f59e0b';
            case 'failed': return '#ef4444';
            default: return '#6b7280';
        }
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
                        Topics
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                        Your playlist-based learning collections
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="nav-btn" onClick={() => navigate('/')}>← Home</button>
                    <button className="nav-btn" onClick={() => navigate('/reports')}>Reports</button>
                </div>
            </div>

            {error && (
                <div className="error" style={{ marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '13px' }}>
                    Loading topics...
                </div>
            ) : topics.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>📚</div>
                    <h3 style={{ color: '#f1f5f9', marginBottom: '6px', fontSize: '16px' }}>No topics yet</h3>
                    <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '13px' }}>
                        Process a YouTube playlist to create your first topic
                    </p>
                    <button onClick={() => navigate('/')}>
                        Process a Playlist
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '14px'
                }}>
                    {topics.map((topic) => (
                        <div
                            key={topic.topic_id}
                            onClick={() => navigate(`/topics/${topic.topic_id}`)}
                            className="card"
                            style={{
                                cursor: 'pointer',
                                transition: 'border-color 0.2s ease, transform 0.2s ease',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                <span className="pill" style={{
                                    background: `${getStatusColor(topic.status)}15`,
                                    color: getStatusColor(topic.status),
                                    borderColor: `${getStatusColor(topic.status)}30`
                                }}>
                                    {topic.status === 'processing' ? 'Processing...' : topic.status}
                                </span>
                                <span style={{ fontSize: '11px', color: '#475569' }}>
                                    {formatDate(topic.created_at)}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 style={{
                                fontSize: '15px',
                                fontWeight: '600',
                                color: '#f1f5f9',
                                margin: '0 0 4px 0',
                                lineHeight: '1.3'
                            }}>
                                {topic.title}
                            </h3>

                            {topic.channel && (
                                <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 14px 0' }}>
                                    {topic.channel}
                                </p>
                            )}

                            {/* Progress */}
                            <div style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '5px' }}>
                                    <span>{topic.completed_count || 0} of {topic.video_count} videos</span>
                                    <span>{Math.round((topic.progress || 0) * 100)}%</span>
                                </div>
                                <div style={{
                                    height: '3px',
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    borderRadius: '999px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${(topic.progress || 0) * 100}%`,
                                        background: topic.status === 'completed' ? '#22c55e' : '#6366f1',
                                        borderRadius: '999px',
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#475569' }}>
                                <span>{topic.video_count} videos</span>
                                {topic.difficulty_level && (
                                    <>
                                        <span>·</span>
                                        <span style={{ textTransform: 'capitalize' }}>{topic.difficulty_level}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Topics;
