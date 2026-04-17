import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login        from './pages/Login.jsx'
import Dashboard    from './pages/Dashboard.jsx'
import Leads        from './pages/Leads.jsx'
import Distribution from './pages/Distribution.jsx'
import Users        from './pages/Users.jsx'
import Sidebar      from './components/Sidebar.jsx'
import WebhookSettings from './pages/WebhookSettings.jsx'
import WebhookLog      from './pages/WebhookLog.jsx'
import AutoLeads       from './pages/AutoLeads.jsx'

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('lead8x_user')) } catch { return null }
}

function PrivateRoute({ children, roles }) {
  const user = getUser()
  if (!user || !localStorage.getItem('lead8x_token')) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function Layout({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout><Dashboard /></Layout>
          </PrivateRoute>
        } />
        <Route path="/leads" element={
          <PrivateRoute>
            <Layout><Leads /></Layout>
          </PrivateRoute>
        } />
        <Route path="/distribution" element={
          <PrivateRoute roles={['Admin','Manager']}>
            <Layout><Distribution /></Layout>
          </PrivateRoute>
        } />
        <Route path="/users" element={
          <PrivateRoute roles={['Admin','Manager']}>
            <Layout><Users /></Layout>
          </PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute roles={['Admin']}>
            <Layout><Admin /></Layout>
          </PrivateRoute>
        } />
        <Route path="/webhooks" element={
          <PrivateRoute roles={['Admin']}>
            <Layout><WebhookSettings /></Layout>
          </PrivateRoute>
        } />
        <Route path="/webhook-logs" element={
          <PrivateRoute roles={['Admin']}>
            <Layout><WebhookLog /></Layout>
          </PrivateRoute>
        } />
        <Route path="/auto-leads" element={
          <PrivateRoute roles={['Admin', 'Manager']}>
            <Layout><AutoLeads /></Layout>
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
