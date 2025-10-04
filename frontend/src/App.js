import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import './App.css';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import UploadForm from './components/UploadForm';
import VideoList from './components/VideoList';
import VideoPlayer from './components/VideoPlayer';
import ChannelPage from './components/ChannelPage';
import TrendingPage from './components/TrendingPage';
import SubscriptionsPage from './components/SubscriptionsPage';
import MyVideosPage from './components/MyVideosPage';
import PlaylistsPage from './components/PlaylistsPage';
import PlaylistViewPage from './components/PlaylistViewPage';
import { useAuth } from './context/AuthContext';

function Home() {
  return <VideoList />;
}

function VideoPlayerWrapper() {
  const { videoId } = useParams();
  return <VideoPlayer key={videoId} />;
}

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  return token ? children : null;
}

function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const isVideoPlayerPage = location.pathname.startsWith('/videos/');

  return (
    <div className="App">
      {/* YouTube-style Header */}
      <header className="yt-header">
        <div className="yt-header-left">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <Link to="/" className="yt-logo">
            <span className="logo-icon">▶</span>
            <span className="logo-text">VidStream</span>
          </Link>
        </div>

        <div className="yt-header-center">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">
              🔍
            </button>
          </form>
        </div>

        <div className="yt-header-right">
          {user ? (
            <>
              <Link to="/upload" className="upload-btn">
                📹 Upload
              </Link>
              <div className="user-menu">
                {user.avatar_url ? (
                  <img
                    src={`${process.env.REACT_APP_BACKEND_URL}${user.avatar_url}`}
                    alt={user.username}
                    className="user-avatar"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
                )}
                <div className="user-dropdown">
                  <p>{user.username}</p>
                  <button onClick={logout} className="logout-btn">Logout</button>
                </div>
              </div>
            </>
          ) : (
            <Link to="/login" className="sign-in-btn">
              👤 Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Layout Container */}
      <div className="yt-layout">
        {/* Mobile sidebar backdrop - only on mobile when open */}
        {sidebarOpen && !isVideoPlayerPage && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>
        )}

        {/* Sidebar */}
        {sidebarOpen && !isVideoPlayerPage && (
          <aside className="yt-sidebar mobile-open">
            <Link to="/" className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`}>
              <span className="sidebar-icon">🏠</span>
              <span>Home</span>
            </Link>
            <Link to="/trending" className={`sidebar-item ${location.pathname === '/trending' ? 'active' : ''}`}>
              <span className="sidebar-icon">🔥</span>
              <span>Trending</span>
            </Link>
            {user && (
              <>
                <Link to="/subscriptions" className={`sidebar-item ${location.pathname === '/subscriptions' ? 'active' : ''}`}>
                  <span className="sidebar-icon">📺</span>
                  <span>Subscriptions</span>
                </Link>
                <div className="sidebar-divider"></div>
                <Link to="/upload" className={`sidebar-item ${location.pathname === '/upload' ? 'active' : ''}`}>
                  <span className="sidebar-icon">📹</span>
                  <span>Upload Video</span>
                </Link>
                <div className="sidebar-divider"></div>
                <div className="sidebar-section-title">Library</div>
                <Link to="/my-videos" className={`sidebar-item ${location.pathname === '/my-videos' ? 'active' : ''}`}>
                  <span className="sidebar-icon">🎬</span>
                  <span>My Videos</span>
                </Link>
                <Link to="/playlists" className={`sidebar-item ${location.pathname === '/playlists' ? 'active' : ''}`}>
                  <span className="sidebar-icon">📋</span>
                  <span>Playlists</span>
                </Link>
                <Link to={`/channel/${user.id}`} className={`sidebar-item ${location.pathname === `/channel/${user.id}` ? 'active' : ''}`}>
                  <span className="sidebar-icon">👤</span>
                  <span>Your Channel</span>
                </Link>
              </>
            )}
          </aside>
        )}

        {/* Main Content */}
        <main className={`yt-main ${sidebarOpen && !isVideoPlayerPage ? '' : 'full-width'}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <UploadForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-videos"
              element={
                <ProtectedRoute>
                  <MyVideosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/playlists"
              element={
                <ProtectedRoute>
                  <PlaylistsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/playlists/:playlistId" element={<PlaylistViewPage />} />
            <Route path="/videos/:videoId" element={<VideoPlayerWrapper />} />
            <Route path="/channel/:userId" element={<ChannelPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;