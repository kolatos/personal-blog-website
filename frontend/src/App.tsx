import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Public pages
import HomePage from './pages/public/HomePage';
import PostDetailPage from './pages/public/PostDetailPage';
import SearchPage from './pages/public/SearchPage';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin pages
import DashboardPage from './pages/admin/DashboardPage';
import CreatePostPage from './pages/admin/CreatePostPage';
import EditPostPage from './pages/admin/EditPostPage';
import UsersAdminPage from './pages/admin/UsersAdminPage';
import CommentsAdminPage from './pages/admin/CommentsAdminPage';

// User pages
import ProfilePage from './pages/user/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route
              path="/"
              element={
                <Layout>
                  <HomePage />
                </Layout>
              }
            />
            <Route
              path="/posts/:slug"
              element={
                <Layout>
                  <PostDetailPage />
                </Layout>
              }
            />
            <Route
              path="/search"
              element={
                <Layout>
                  <SearchPage />
                </Layout>
              }
            />

            {/* Auth routes — standalone (no shared header/footer) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Admin routes — protected, role=admin */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route
                path="/admin"
                element={
                  <Layout>
                    <DashboardPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/posts/new"
                element={
                  <Layout>
                    <CreatePostPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/posts/:id/edit"
                element={
                  <Layout>
                    <EditPostPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <Layout>
                    <UsersAdminPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/comments"
                element={
                  <Layout>
                    <CommentsAdminPage />
                  </Layout>
                }
              />
            </Route>

            {/* User routes — protected, any authenticated user */}
            <Route element={<ProtectedRoute />}>
              <Route
                path="/profile"
                element={
                  <Layout>
                    <ProfilePage />
                  </Layout>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
