import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CreatePlaylistModal from './CreatePlaylistModal';

function AddToPlaylistModal({ isOpen, onClose, videoId }) {
  const { token } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchPlaylists();
    }
  }, [isOpen, token]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/playlists/my-playlists`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      }
    } catch (err) {
      setError('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/playlists/${playlistId}/videos/${videoId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to add video to playlist');
      }
    } catch (err) {
      setError('Failed to add video to playlist');
    }
  };

  const handlePlaylistCreated = () => {
    fetchPlaylists();
    setShowCreateModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#181818',
          padding: '24px',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <h2 style={{ marginBottom: '20px' }}>Save to Playlist</h2>

          {error && <p style={{ color: '#ff4444', marginBottom: '16px' }}>{error}</p>}

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#272727',
              color: '#f1f1f1',
              border: '1px solid #3ea6ff',
              borderRadius: '2px',
              cursor: 'pointer',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            <span>Create New Playlist</span>
          </button>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#aaa' }}>Loading playlists...</p>
          ) : playlists.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa' }}>
              You don't have any playlists yet. Create one!
            </p>
          ) : (
            <div>
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  style={{
                    padding: '12px',
                    backgroundColor: '#272727',
                    marginBottom: '8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid #303030',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#3a3a3a'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#272727'}
                >
                  <div style={{ fontWeight: '500' }}>{playlist.name}</div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                    {playlist.video_count} videos • {playlist.is_public ? 'Public' : 'Private'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#181818',
              color: '#f1f1f1',
              border: '1px solid #303030',
              borderRadius: '2px',
              cursor: 'pointer',
              marginTop: '16px'
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlaylistCreated={handlePlaylistCreated}
      />
    </>
  );
}

export default AddToPlaylistModal;
