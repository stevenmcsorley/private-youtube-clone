import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AddLiveStreamForm from './AddLiveStreamForm';
import AddYouTubeForm from './AddYouTubeForm';

function UploadForm() {
  const [activeTab, setActiveTab] = useState('video'); // 'video', 'stream', or 'youtube'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);

    if (selectedFile) {
      // Immediately set filename as title
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }

      // Extract metadata in background (non-blocking)
      setExtracting(true);

      const formData = new FormData();
      formData.append('file', selectedFile);

      fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/extract-metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to extract metadata');
        })
        .then(metadata => {
          // Only update if fields are still empty
          if (metadata.title && title === selectedFile.name.replace(/\.[^/.]+$/, '')) {
            setTitle(metadata.title);
          }
          if (metadata.description && !description) {
            setDescription(metadata.description);
          }
        })
        .catch(err => {
          console.error('Error extracting metadata:', err);
        })
        .finally(() => {
          setExtracting(false);
        });
    }
  };

  const handleThumbnailChange = (event) => {
    const selectedThumbnail = event.target.files[0];
    setThumbnail(selectedThumbnail);

    // Create preview
    if (selectedThumbnail) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(selectedThumbnail);
    } else {
      setThumbnailPreview(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('file', file);
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          setMessage(`Video "${data.title}" uploaded successfully! Processing...`);

          // Redirect to home page after 2 seconds to see the video processing
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setError(errorData.detail || 'Video upload failed');
          setIsUploading(false);
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        setError('Network error during upload');
        setIsUploading(false);
      });

      // Send request
      xhr.open('POST', `${process.env.REACT_APP_BACKEND_URL}/videos/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (err) {
      setError(err.message);
      setIsUploading(false);
    }
  };

  if (isUploading) {
    return (
      <div className="upload-form-container">
        <h2>Uploading Video</h2>
        <div style={{textAlign: 'center', padding: '40px 0'}}>
          <div style={{fontSize: '48px', marginBottom: '20px'}}>📤</div>
          <h3 style={{marginBottom: '20px', color: '#f1f1f1'}}>{title}</h3>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#272727',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '12px'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: '#3ea6ff',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          <p style={{color: '#aaa', fontSize: '14px'}}>
            {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Upload complete! Redirecting...'}
          </p>
          {message && <p className="success-message" style={{marginTop: '20px'}}>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="upload-form-container">
      <h2 style={{ marginBottom: '20px' }}>Add Content</h2>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #303030'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('video')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'video' ? '#3ea6ff' : 'transparent',
            color: activeTab === 'video' ? 'white' : '#f1f1f1',
            border: 'none',
            borderBottom: activeTab === 'video' ? '2px solid #3ea6ff' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          📹 Upload Video
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stream')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'stream' ? '#3ea6ff' : 'transparent',
            color: activeTab === 'stream' ? 'white' : '#f1f1f1',
            border: 'none',
            borderBottom: activeTab === 'stream' ? '2px solid #3ea6ff' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          📡 Add Live Stream
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('youtube')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'youtube' ? '#3ea6ff' : 'transparent',
            color: activeTab === 'youtube' ? 'white' : '#f1f1f1',
            border: 'none',
            borderBottom: activeTab === 'youtube' ? '2px solid #3ea6ff' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          📺 Add YouTube Video
        </button>
      </div>

      {activeTab === 'stream' ? (
        <AddLiveStreamForm />
      ) : activeTab === 'youtube' ? (
        <AddYouTubeForm />
      ) : (
        <>
          {error && <p className="error-message">{error}</p>}
          {extracting && <p className="info-message">📝 Extracting metadata in background...</p>}
          <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="file">Select Video File</label>
          <input
            type="file"
            id="file"
            accept="video/*"
            onChange={handleFileChange}
            required
          />
        </div>
        <div>
          <label htmlFor="title">
            Title {extracting && <span style={{color: '#74c0fc', fontSize: '12px'}}>(updating...)</span>}
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title"
            required
          />
        </div>
        <div>
          <label htmlFor="description">
            Description {extracting && <span style={{color: '#74c0fc', fontSize: '12px'}}>(updating...)</span>}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell viewers about your video"
          />
        </div>
        <div>
          <label htmlFor="tags">
            Tags <span style={{color: '#aaa', fontSize: '12px'}}>(comma-separated)</span>
          </label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="gaming, tutorial, funny, etc."
          />
          {tags && tags.trim() && (
            <div style={{marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
              {tags.split(',').filter(tag => tag.trim()).map((tag, index) => (
                <span
                  key={index}
                  style={{
                    backgroundColor: '#3ea6ff',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    display: 'inline-block'
                  }}
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
          <p style={{color: '#aaa', fontSize: '12px', marginTop: '4px'}}>
            Add tags to help people find your video
          </p>
        </div>
        <div>
          <label htmlFor="thumbnail">
            Custom Thumbnail <span style={{color: '#aaa', fontSize: '12px'}}>(optional)</span>
          </label>
          <input
            type="file"
            id="thumbnail"
            accept="image/*"
            onChange={handleThumbnailChange}
          />
          {thumbnailPreview && (
            <div style={{marginTop: '12px'}}>
              <p style={{color: '#aaa', fontSize: '12px', marginBottom: '8px'}}>Thumbnail Preview:</p>
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                style={{
                  maxWidth: '320px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '2px solid #3ea6ff'
                }}
              />
            </div>
          )}
          <p style={{color: '#aaa', fontSize: '12px', marginTop: '4px'}}>
            Upload a custom thumbnail or we'll generate one automatically
          </p>
        </div>
        <button type="submit">
          Publish Video
        </button>
      </form>
        </>
      )}
    </div>
  );
}

export default UploadForm;
