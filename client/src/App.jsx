import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import FolderPage from './pages/FolderPage';
import NoteViewer from './pages/NoteViewer';
import SearchPage from './pages/SearchPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/folder/:folderId"
                element={
                  <ProtectedRoute>
                    <FolderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/note/:id"
                element={
                  <ProtectedRoute>
                    <NoteViewer />
                  </ProtectedRoute>
                }
              />
              <Route path="/search" element={<SearchPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;