import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreatePlaylistModal from './CreatePlaylistModal';

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { token } = useAuth();

  const fetchPlaylists = async () => {
    if (!token) {
      setError('Please log in to view your playlists.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/playlists/my-playlists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch playlists');
      }

      const data = await response.json();
      setPlaylists(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [token]);

  const handlePlaylistCreated = () => {
    fetchPlaylists();
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete playlist');
      }

      setPlaylists(playlists.filter(p => p.id !== playlistId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>My Playlists</h1>
        {token && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3ea6ff',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Create Playlist
          </button>
        )}
      </div>

      {error && <p className="error-message" style={{ padding: '0 24px', color: '#ff4444' }}>{error}</p>}

      {playlists.length === 0 && !error && token && (
        <p style={{ textAlign: 'center', color: '#aaa', marginTop: '40px' }}>
          You haven't created any playlists yet. Click "Create Playlist" to get started!
        </p>
      )}

      {!token && (
        <p style={{ textAlign: 'center', color: '#aaa', marginTop: '40px' }}>
          Please <Link to="/login" style={{ color: '#3ea6ff' }}>log in</Link> to view your playlists.
        </p>
      )}

      <div style={{
        padding: '0 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '24px'
      }}>
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            style={{
              backgroundColor: '#181818',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #303030'
            }}
          >
            <Link
              to={`/playlists/${playlist.id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '140px',
                  backgroundColor: '#272727',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  position: 'relative'
                }}
              >
                📋
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {playlist.video_count || 0} videos
                </div>
              </div>

              <div style={{ padding: '12px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{playlist.name}</h3>
                {playlist.description && (
                  <p style={{
                    color: '#aaa',
                    fontSize: '13px',
                    margin: '0 0 8px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {playlist.description}
                  </p>
                )}
                <div style={{ color: '#aaa', fontSize: '12px' }}>
                  {playlist.is_public ? '🌐 Public' : '🔒 Private'}
                </div>
              </div>
            </Link>

            <div style={{
              padding: '0 12px 12px 12px',
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDeletePlaylist(playlist.id);
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: '#cc0000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlaylistCreated={handlePlaylistCreated}
      />
    </div>
  );
}

export default PlaylistsPage;
