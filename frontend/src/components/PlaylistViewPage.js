import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

function PlaylistViewPage() {
  const { playlistId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlaylist = async () => {
    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/playlists/${playlistId}`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch playlist');
      }

      const data = await response.json();
      setPlaylist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId, token]);

  const handleRemoveVideo = async (videoId) => {
    if (!token) {
      alert('Please log in to modify playlists');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/playlists/${playlistId}/videos/${videoId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove video from playlist');
      }

      // Refresh playlist
      fetchPlaylist();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePlayAll = () => {
    if (playlist && playlist.videos && playlist.videos.length > 0) {
      navigate(`/videos/${playlist.videos[0].id}?playlist=${playlistId}`);
    }
  };

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '24px', color: '#ff4444' }}>Error: {error}</div>;
  }

  if (!playlist) {
    return <div style={{ padding: '24px' }}>Playlist not found</div>;
  }

  const isOwner = token && playlist.owner_id;

  return (
    <div>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #303030'
      }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '200px',
              height: '112px',
              backgroundColor: '#272727',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              flexShrink: 0
            }}
          >
            📋
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '28px', margin: '0 0 8px 0' }}>{playlist.name}</h1>
            {playlist.description && (
              <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 12px 0' }}>
                {playlist.description}
              </p>
            )}
            <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '16px' }}>
              {playlist.video_count || 0} videos • {playlist.is_public ? 'Public' : 'Private'}
            </div>

            {playlist.videos && playlist.videos.length > 0 && (
              <button
                onClick={handlePlayAll}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3ea6ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ▶ Play All
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {!playlist.videos || playlist.videos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#aaa', marginTop: '40px' }}>
            This playlist is empty. Add videos to get started!
          </p>
        ) : (
          <div>
            {playlist.videos.map((video, index) => (
              <div
                key={video.id}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: '#181818',
                  borderRadius: '8px',
                  border: '1px solid #303030',
                  alignItems: 'center'
                }}
              >
                <div style={{
                  color: '#aaa',
                  fontSize: '14px',
                  width: '30px',
                  textAlign: 'center',
                  flexShrink: 0
                }}>
                  {index + 1}
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Link to={`/videos/${video.id}?playlist=${playlistId}`}>
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
                    {video.duration && (
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
                  </Link>
                </div>

                <div style={{ flex: 1 }}>
                  <Link
                    to={`/videos/${video.id}?playlist=${playlistId}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>{video.title}</h3>
                  </Link>
                  <div style={{ color: '#aaa', fontSize: '12px' }}>
                    {video.owner?.username || 'Unknown'} • {video.views || 0} views
                  </div>
                </div>

                {isOwner && (
                  <button
                    onClick={() => handleRemoveVideo(video.id)}
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
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaylistViewPage;
