import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// ---- Attach JWT on every request ----
api.interceptors.request.use(config => {
  const token = localStorage.getItem('lead8x_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}, Promise.reject)

// ---- Handle 401 globally (session expired) ----
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lead8x_token')
      localStorage.removeItem('lead8x_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---- Auth ----
export const login = (email, password) =>
  api.post('/auth/login.php', { email, password })

// ---- Leads ----
export const getLeads = (params) =>
  api.get('/leads/list.php', { params })

export const downloadLeads = (params) =>
  api.get('/leads/download.php', { params, responseType: 'blob' })

// Step 1: upload file → preview
export const uploadLeadsPreview = (formData) =>
  api.post('/leads/upload.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

// Step 2: confirm upload with project name + refer_url
export const confirmUpload = (data) =>
  api.post('/leads/upload-confirm.php', data)

export const updateFeedback = (data) =>
  api.post('/leads/feedback.php', data)

export const bulkFeedback = (formData) =>
  api.post('/leads/feedback.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const getTimeline = (lead_id) =>
  api.get('/leads/timeline.php', { params: { lead_id } })

export const deleteLeads = (data) =>
  api.post('/leads/delete.php', data)

export const mergeLeads = (ids) =>
  api.post('/leads/merge.php', { ids })

// ---- Projects ----
export const getProjects = () =>
  api.get('/projects/list.php')

export const saveProject = (data) =>
  api.post('/projects/save.php', data)

// ---- Distribution ----
export const distribute = (data) =>
  api.post('/distribution/distribute.php', data)

// ---- Users ----
export const getUsers    = ()     => api.get('/users/list.php')
export const createUser  = (data) => api.post('/users/create.php', data)
export const updateUser  = (data) => api.put('/users/update.php', data)
export const deleteUser  = (id)   => api.delete('/users/delete.php', { data: { id } })

// ---- Admin ----
export const getStats       = ()     => api.get('/admin/stats.php')
export const getActivityLog = (p)    => api.get('/admin/activity-log.php', { params: p })
export const downloadBackup = ()     => api.post('/admin/backup.php', {}, { responseType: 'blob' })

// ---- Helpers ----
export const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  window.URL.revokeObjectURL(url)
}

export default api
