import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Public pages
import LandingPage from './pages/public/LandingPage';
import BlogPage from './pages/public/BlogPage';
import PostDetailPage from './pages/public/PostDetailPage';
import SearchPage from './pages/public/SearchPage';
import AboutPage from './pages/public/AboutPage';
import ProjectsPage from './pages/public/ProjectsPage';
import ProjectDetailPage from './pages/public/ProjectDetailPage';
import FunPage from './pages/public/FunPage';
import FunDetailPage from './pages/public/FunDetailPage';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin pages
import DashboardPage from './pages/admin/DashboardPage';
import CreatePostPage from './pages/admin/CreatePostPage';
import EditPostPage from './pages/admin/EditPostPage';
import UsersAdminPage from './pages/admin/UsersAdminPage';
import CommentsAdminPage from './pages/admin/CommentsAdminPage';
import AboutAdminPage from './pages/admin/AboutAdminPage';
import ProjectsAdminPage from './pages/admin/ProjectsAdminPage';
import ProjectEditorPage from './pages/admin/ProjectEditorPage';
import FunAdminPage from './pages/admin/FunAdminPage';
import FunEditorPage from './pages/admin/FunEditorPage';

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
                  <LandingPage />
                </Layout>
              }
            />
            <Route
              path="/blog"
              element={
                <Layout>
                  <BlogPage />
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
            <Route
              path="/about"
              element={
                <Layout>
                  <AboutPage />
                </Layout>
              }
            />
            <Route
              path="/projects"
              element={
                <Layout>
                  <ProjectsPage />
                </Layout>
              }
            />
            <Route
              path="/projects/:slug"
              element={
                <Layout>
                  <ProjectDetailPage />
                </Layout>
              }
            />
            <Route
              path="/fun"
              element={
                <Layout>
                  <FunPage />
                </Layout>
              }
            />
            <Route
              path="/fun/:slug"
              element={
                <Layout>
                  <FunDetailPage />
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
              <Route
                path="/admin/about"
                element={
                  <Layout>
                    <AboutAdminPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/projects"
                element={
                  <Layout>
                    <ProjectsAdminPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/projects/new"
                element={
                  <Layout>
                    <ProjectEditorPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/projects/:id/edit"
                element={
                  <Layout>
                    <ProjectEditorPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/fun"
                element={
                  <Layout>
                    <FunAdminPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/fun/new"
                element={
                  <Layout>
                    <FunEditorPage />
                  </Layout>
                }
              />
              <Route
                path="/admin/fun/:id/edit"
                element={
                  <Layout>
                    <FunEditorPage />
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
