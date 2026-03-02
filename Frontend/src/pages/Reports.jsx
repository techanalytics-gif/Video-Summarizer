import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const Reports = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState('');
  const [totalReports, setTotalReports] = useState(0);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'public'
  const [togglingVisibility, setTogglingVisibility] = useState(null); // job_id being toggled

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      query.append('page', page);
      query.append('limit', limit);
      query.append('mode', activeTab);
      if (status) query.append('status', status);
      if (user?.id) query.append('user_id', user.id);

      const response = await fetch(`${API_BASE}/api/videos/reports?${query}`);

      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      // Filter out playlist-linked videos (view those from Topics page)
      const standaloneReports = data.filter(r => !r.topic_id);
      setReports(standaloneReports);
      setTotalReports(standaloneReports.length);
    } catch (err) {
      setError(err.message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchReports();
    }
  }, [page, status, user?.id, activeTab]);

  const handleViewReport = (jobId) => {
    navigate(`/?jobId=${jobId}`);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      completed: { bg: '#10b981', text: '✓ Completed' },
      processing: { bg: '#f59e0b', text: '⟳ Processing' },
      pending: { bg: '#6b7280', text: '○ Pending' },
      failed: { bg: '#ef4444', text: '✕ Failed' }
    };

    const style = statusStyles[status] || statusStyles.pending;
    return (
      <span style={{
        display: 'inline-block',
        backgroundColor: style.bg,
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500'
      }}>
        {style.text}
      </span>
    );
  };

  const getVideoLinks = (report) => {
    // Prefer explicit YouTube id/url
    if (report.youtube_video_id) {
      return {
        embed: `https://www.youtube.com/embed/${report.youtube_video_id}`,
        link: report.youtube_url || `https://youtu.be/${report.youtube_video_id}`
      };
    }
    // Handle Drive file id or URL
    if (report.drive_file_id) {
      return {
        embed: `https://drive.google.com/file/d/${report.drive_file_id}/preview`,
        link: `https://drive.google.com/file/d/${report.drive_file_id}/view?usp=sharing`
      };
    }
    if (report.drive_video_url) {
      // Derive id if possible
      const match = report.drive_video_url.match(/file\/d\/([^/]+)/);
      const fileId = match ? match[1] : null;
      return {
        embed: fileId
          ? `https://drive.google.com/file/d/${fileId}/preview`
          : report.drive_video_url,
        link: report.drive_video_url
      };
    }
    return { embed: null, link: null };
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setReports([]);
  };

  const toggleVisibility = async (e, jobId, currentVisibility) => {
    e.stopPropagation();
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
    setTogglingVisibility(jobId);
    try {
      const response = await fetch(`${API_BASE}/api/videos/${jobId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility, user_id: user.id })
      });
      if (!response.ok) throw new Error('Failed to update visibility');
      // Update local state
      setReports(prev => prev.map(r =>
        r.job_id === jobId ? { ...r, visibility: newVisibility } : r
      ));
    } catch (err) {
      console.error('Toggle visibility error:', err);
    } finally {
      setTogglingVisibility(null);
    }
  };

  return (
    <div className="page">
      <header style={{ paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Reports</h1>
          <button className="nav-btn" onClick={() => navigate('/')}>← Home</button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginTop: '16px' }}>
          <button
            onClick={() => handleTabChange('personal')}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              color: activeTab === 'personal' ? '#a5b4fc' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'personal' ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === 'personal' ? '600' : '400',
              transition: 'all 0.15s ease'
            }}
          >
            Your Reports
          </button>
          <button
            onClick={() => handleTabChange('public')}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              color: activeTab === 'public' ? '#a5b4fc' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'public' ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === 'public' ? '600' : '400',
              transition: 'all 0.15s ease'
            }}
          >
            Public Library
          </button>
        </div>
      </header>

      <div style={{ padding: '16px 0' }}>
        {/* Filters */}
        <div style={{ marginBottom: '16px' }}>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="field"
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'inherit'
            }}
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
            Loading reports...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Reports Grid */}
        {!loading && reports.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px'
          }}>
            {reports.map((report) => (
              <div
                key={report.job_id}
                className="card"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                onClick={() => handleViewReport(report.job_id)}
              >
                {/* Video Embed */}
                {(() => {
                  const links = getVideoLinks(report);
                  return (
                    <div style={{
                      position: 'relative',
                      height: '0',
                      paddingBottom: '56.25%',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                      {links.embed ? (
                        <iframe
                          src={links.embed}
                          title={report.video_name || 'Video'}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0,
                            width: '100%', height: '100%',
                            border: '0'
                          }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#475569',
                          fontSize: '28px'
                        }}>
                          🎬
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                        {getStatusBadge(report.status)}
                      </div>
                      {links.link && (
                        <a
                          href={links.link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            left: '8px',
                            bottom: '8px',
                            padding: '5px 10px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '11px',
                            textDecoration: 'none',
                          }}
                        >
                          Open ↗
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* Header */}
                <div>
                  <h3 style={{
                    margin: '0 0 4px 0',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#f1f5f9',
                    wordBreak: 'break-word',
                    lineHeight: '1.3'
                  }}>
                    {report.video_name || 'Untitled Video'}
                  </h3>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    {report.job_id.substring(0, 12)}...
                  </div>
                  {report.video_genre && report.video_genre !== 'unknown' && (
                    <span className="pill" style={{ marginTop: '6px', textTransform: 'capitalize' }}>
                      {report.video_genre.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {/* Summary */}
                {report.executive_summary && (
                  <p style={{
                    margin: '0',
                    fontSize: '12px',
                    color: '#94a3b8',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {report.executive_summary}
                  </p>
                )}

                {/* Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Topics</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#a5b4fc' }}>
                      {report.topics_count || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#22c55e' }}>
                      {formatDuration(report.duration)}
                    </div>
                  </div>
                </div>

                {/* Date & Credits */}
                <div style={{
                  fontSize: '11px',
                  color: '#475569',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div>
                    {formatDate(report.created_at)}
                  </div>
                  {report.credits_charged != null && (
                    <span className="credits-badge" style={{ fontSize: '11px', padding: '2px 8px', marginRight: 0 }}>
                      💎 {Math.round(report.credits_charged)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  {/* Visibility Toggle — real toggle switch */}
                  {activeTab === 'personal' && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {(report.visibility || 'private') === 'public' ? 'Public' : 'Private'}
                      </span>
                      <label className="toggle-switch" style={{ gap: '0' }}>
                        <input
                          type="checkbox"
                          checked={(report.visibility || 'private') === 'public'}
                          disabled={togglingVisibility === report.job_id}
                          onChange={() => toggleVisibility(
                            { stopPropagation: () => {} },
                            report.job_id,
                            report.visibility || 'private'
                          )}
                        />
                        <span className="toggle-track toggle-track--green" />
                      </label>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewReport(report.job_id);
                    }}
                    style={{
                      padding: '8px',
                      background: '#6366f1',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                  >
                    View Report →
                  </button>

                  {/* Download Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`${API_BASE}/api/videos/${report.job_id}/download/transcript?format=txt`, '_blank');
                      }}
                      className="nav-btn"
                      style={{ flex: 1, padding: '7px', fontSize: '11px', textAlign: 'center' }}
                    >
                      Transcript
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`${API_BASE}/api/videos/${report.job_id}/download/audio`, '_blank');
                      }}
                      className="nav-btn"
                      style={{ flex: 1, padding: '7px', fontSize: '11px', textAlign: 'center' }}
                    >
                      Audio
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !loading && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>
                {activeTab === 'public' ? '🌐' : '📭'}
              </div>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                {activeTab === 'public'
                  ? 'No public reports from other users yet'
                  : 'No reports found'}
              </div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>
                {activeTab === 'public'
                  ? 'Public reports from other users will appear here.'
                  : (
                    <>
                      {status ? 'Try changing the filter or ' : ''}
                      <span
                        onClick={() => navigate('/')}
                        style={{
                          color: '#6366f1',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        process a new video
                      </span>
                    </>
                  )}
              </div>
            </div>
          )
        )}

        {/* Pagination */}
        {reports.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            marginTop: '32px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}>
            <button
              className="nav-btn"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              ← Prev
            </button>
            <span style={{ color: '#64748b', fontSize: '12px' }}>
              Page {page}
            </span>
            <button
              className="nav-btn"
              onClick={() => setPage(page + 1)}
              disabled={reports.length < limit}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
