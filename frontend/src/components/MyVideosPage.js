import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EditVideoModal from './EditVideoModal';

function formatDuration(seconds) {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function MyVideosPage() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const pageSize = 20;

  const fetchMyVideos = async () => {
    if (!token) {
      setError('Please log in to view your videos.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/my-videos?page=${currentPage}&page_size=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data);
      setLoading(false);

      // Fetch progress for processing videos
      data.forEach(video => {
        if (video.processing_status === 'processing') {
          fetchProgress(video.id);
        }
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchProgress = async (videoId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/progress`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProcessingProgress(prev => ({
          ...prev,
          [videoId]: data.progress || 0
        }));
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  };

  useEffect(() => {
    fetchMyVideos();

    // Poll for progress updates every 3 seconds
    const interval = setInterval(() => {
      videos.forEach(video => {
        if (video.processing_status === 'processing') {
          fetchProgress(video.id);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [token, currentPage]);

  useEffect(() => {
    const fetchTotalCount = async () => {
      if (!token) return;

      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/my-videos/count`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTotalVideos(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch video count:', err);
      }
    };

    fetchTotalCount();
  }, [token, videos]);

  // Refresh videos list when processing status might have changed
  useEffect(() => {
    const hasProcessing = videos.some(v => v.processing_status === 'processing');
    if (hasProcessing) {
      const refreshInterval = setInterval(fetchMyVideos, 10000);
      return () => clearInterval(refreshInterval);
    }
  }, [videos]);

  const handleEdit = (video) => {
    setEditingVideo(video);
  };

  const handleUpdate = () => {
    fetchMyVideos();
  };

  const handleDelete = async (videoId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      setVideos(videos.filter(v => v.id !== videoId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRetry = async (videoId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/retry-processing`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        // Refresh videos to show updated status
        fetchMyVideos();
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to retry processing');
      }
    } catch (err) {
      alert('Failed to retry processing');
    }
  };

  return (
    <div>
      <h1 style={{padding: '24px', fontSize: '24px'}}>My Videos</h1>
      {error && <p className="error-message">{error}</p>}
      {videos.length === 0 && !error && (
        <p style={{textAlign: 'center', color: '#aaa', marginTop: '40px'}}>
          You haven't uploaded any videos yet. <Link to="/upload" style={{color: '#3ea6ff'}}>Upload your first video!</Link>
        </p>
      )}
      <div style={{padding: '0 24px'}}>
        {videos.map((video) => (
          <div
            key={video.id}
            style={{
              display: 'flex',
              gap: '16px',
              padding: '16px',
              marginBottom: '16px',
              backgroundColor: '#181818',
              borderRadius: '8px',
              border: '1px solid #303030'
            }}
          >
            <div style={{position: 'relative', flexShrink: 0}}>
              {video.thumbnail_path ? (
                <img
                  src={`${process.env.REACT_APP_BACKEND_URL}${video.thumbnail_path}`}
                  alt={video.title}
                  style={{
                    width: '168px',
                    height: '94px',
                    objectFit: 'cover',
                    borderRadius: '4px'
                  }}
                />
              ) : (
                <div style={{
                  width: '168px',
                  height: '94px',
                  backgroundColor: '#272727',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  📹
                </div>
              )}
              {video.duration && video.processing_status === 'completed' && (
                <span style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '2px 4px',
                  borderRadius: '2px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {formatDuration(video.duration)}
                </span>
              )}
            </div>

            <div style={{flex: 1}}>
              <h3 style={{margin: '0 0 8px 0', fontSize: '16px'}}>{video.title}</h3>
              <div style={{color: '#aaa', fontSize: '13px', marginBottom: '8px'}}>
                <div>{video.views || 0} views • {new Date(video.upload_date).toLocaleDateString()}</div>
                {video.tags && video.tags.length > 0 && (
                  <div style={{marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                    {video.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          backgroundColor: '#272727',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '11px'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {video.processing_status === 'processing' && (
                <div style={{marginTop: '8px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                    <span style={{color: '#3ea6ff', fontSize: '13px'}}>⏳ Processing...</span>
                    <span style={{color: '#aaa', fontSize: '12px'}}>
                      {processingProgress[video.id] || 0}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#272727',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${processingProgress[video.id] || 0}%`,
                      height: '100%',
                      backgroundColor: '#3ea6ff',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              )}

              {video.processing_status === 'failed' && (
                <div style={{
                  color: '#ff4444',
                  fontSize: '13px',
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: 'rgba(255, 68, 68, 0.1)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>❌ Processing failed</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleRetry(video.id)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#3ea6ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${video.title}"? This cannot be undone.`)) {
                          handleDelete(video.id);
                        }
                      }}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#cc0000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {video.processing_status === 'completed' && (
                <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                  <Link
                    to={`/videos/${video.id}`}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3ea6ff',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '2px',
                      fontSize: '13px'
                    }}
                  >
                    Watch
                  </Link>
                  <button
                    onClick={() => handleEdit(video)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#272727',
                      color: '#f1f1f1',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <EditVideoModal
        isOpen={editingVideo !== null}
        onClose={() => setEditingVideo(null)}
        video={editingVideo}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {totalVideos > pageSize && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginTop: '40px',
          paddingBottom: '40px'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage === 1 ? '#272727' : '#3ea6ff',
              color: currentPage === 1 ? '#666' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Previous
          </button>

          <span style={{ color: '#aaa', fontSize: '14px' }}>
            Page {currentPage} of {Math.ceil(totalVideos / pageSize)} ({totalVideos} videos)
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalVideos / pageSize), prev + 1))}
            disabled={currentPage >= Math.ceil(totalVideos / pageSize)}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage >= Math.ceil(totalVideos / pageSize) ? '#272727' : '#3ea6ff',
              color: currentPage >= Math.ceil(totalVideos / pageSize) ? '#666' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage >= Math.ceil(totalVideos / pageSize) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Next
          </button>
        </div>
      )}

      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#aaa'
        }}>
          Loading...
        </div>
      )}
    </div>
  );
}

export default MyVideosPage;
