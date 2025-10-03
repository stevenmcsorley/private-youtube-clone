import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      // In a real app, you'd decode the token or fetch user info from backend
      // For now, we'll just assume a user is logged in if a token exists
      // and fetch user details from /users/me endpoint
      const fetchUser = async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token might be invalid or expired
            logout();
          }
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          logout();
        }
      };
      fetchUser();
    } else {
      setUser(null);
    }
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
