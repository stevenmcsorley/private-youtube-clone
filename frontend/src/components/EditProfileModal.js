import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function EditProfileModal({ isOpen, onClose, channelData, onUpdate }) {
  const { token } = useAuth();
  const [channelName, setChannelName] = useState(channelData?.channel_name || '');
  const [channelDescription, setChannelDescription] = useState(channelData?.channel_description || '');
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (channelName) formData.append('channel_name', channelName);
      if (channelDescription) formData.append('channel_description', channelDescription);
      if (avatar) formData.append('avatar', avatar);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/users/me/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      onUpdate(data);
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
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Edit Channel</h2>

        {error && <p style={{ color: '#ff4444', marginBottom: '16px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
              Channel Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
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
              Channel Description
            </label>
            <textarea
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
              rows={4}
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
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
              Avatar Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatar(e.target.files[0])}
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
