import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function CreatePlaylistModal({ isOpen, onClose, onPlaylistCreated }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          is_public: isPublic
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create playlist');
      }

      const data = await response.json();
      if (onPlaylistCreated) {
        onPlaylistCreated(data);
      }
      setName('');
      setDescription('');
      setIsPublic(true);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        maxWidth: '500px',
        width: '90%'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Create New Playlist</h2>

        {error && <p style={{ color: '#ff4444', marginBottom: '16px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
              Playlist Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My awesome playlist"
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#272727',
                border: '1px solid #303030',
                borderRadius: '2px',
                color: '#f1f1f1'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this playlist about?"
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#272727',
                border: '1px solid #303030',
                borderRadius: '2px',
                color: '#f1f1f1',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: '#f1f1f1' }}>Make playlist public</span>
            </label>
            <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px', marginLeft: '24px' }}>
              Public playlists can be viewed by anyone
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#272727',
                color: '#f1f1f1',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#3ea6ff',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Creating...' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePlaylistModal;
