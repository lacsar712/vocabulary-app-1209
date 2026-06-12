import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WordListProvider } from './context/WordListContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VocabularyTest from './pages/VocabularyTest';
import AchievementsPage from './pages/AchievementsPage';
import WordListsPage from './pages/WordListsPage';
import WordListDetailPage from './pages/WordListDetailPage';
import ReadingPracticePage from './pages/ReadingPracticePage';
import DailyChallengePage from './pages/DailyChallengePage';
import EtymologyPage from './pages/EtymologyPage';
import EtymologyDetailPage from './pages/EtymologyDetailPage';
import CrosswordPage from './pages/CrosswordPage';
import NoPermissionPage from './pages/NoPermissionPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminWordsPage from './pages/AdminWordsPage';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/no-permission" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <WordListProvider>
        <Router>
          <div className="min-h-screen bg-background text-slate-100 font-sans">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/no-permission" element={<NoPermissionPage />} />
              <Route path="/test" element={
                <ProtectedRoute>
                  <VocabularyTest />
                </ProtectedRoute>
              } />
              <Route path="/achievements" element={
                <ProtectedRoute>
                  <AchievementsPage />
                </ProtectedRoute>
              } />
              <Route path="/word-lists" element={
                <ProtectedRoute>
                  <WordListsPage />
                </ProtectedRoute>
              } />
              <Route path="/word-lists/:id" element={
                <ProtectedRoute>
                  <WordListDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/reading-practice" element={
                <ProtectedRoute>
                  <ReadingPracticePage />
                </ProtectedRoute>
              } />
              <Route path="/daily-challenge" element={
                <ProtectedRoute>
                  <DailyChallengePage />
                </ProtectedRoute>
              } />
              <Route path="/etymology" element={
                <ProtectedRoute>
                  <EtymologyPage />
                </ProtectedRoute>
              } />
              <Route path="/etymology/:id" element={
                <ProtectedRoute>
                  <EtymologyDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/etymology/word/:wordId" element={
                <ProtectedRoute>
                  <EtymologyDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/crossword" element={
                <ProtectedRoute>
                  <CrosswordPage />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } />
              <Route path="/admin/words" element={
                <AdminRoute>
                  <AdminWordsPage />
                </AdminRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </WordListProvider>
    </AuthProvider>
  );
}

export default App;
