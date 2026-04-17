import { useState, useEffect, useCallback } from 'react'
import { getProjects, saveProject, getLocations, saveLocation, deleteLocation, bulkUpdateUrl } from '../api/axios.js'
import toast from 'react-hot-toast'
import { FolderKanban, Plus, Trash2, Link, ChevronRight, X, MapPin, Edit3, Save } from 'lucide-react'

export default function ProjectManager() {
  const [projects, setProjects]               = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentLocation, setCurrentLocation] = useState(null)  // { id, location } | null
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingLoc, setLoadingLoc]           = useState(false)

  // New project form
  const [showNewProj, setShowNewProj] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [savingProj, setSavingProj]   = useState(false)

  // Location edit form
  const [editLocation, setEditLocation] = useState('')
  const [savingLoc, setSavingLoc]       = useState(false)

  // Bulk URL form
  const [bulkUrl, setBulkUrl]     = useState('')
  const [savingUrl, setSavingUrl] = useState(false)

  /* ── Load master projects list ─────────────── */
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      // 'combined' mode: union of master table + active leads + project_locations
      // Shows every project that exists anywhere, regardless of how it was created.
      const res = await getProjects({ mode: 'combined' })
      setProjects(res.data.data.projects || [])
    } catch { toast.error('Failed to load projects.') }
    setLoadingProjects(false)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  /* ── Load single location for selected project ── */
  const loadProjectLocation = useCallback(async (projectName) => {
    if (!projectName) { setCurrentLocation(null); setEditLocation(''); return }
    setLoadingLoc(true)
    try {
      const res = await getLocations({ project_name: projectName })
      const locs = res.data.data.locations || []
      if (locs.length > 0) {
        setCurrentLocation(locs[0])
        setEditLocation(locs[0].location)
      } else {
        setCurrentLocation(null)
        setEditLocation('')
      }
    } catch { toast.error('Failed to load location.') }
    setLoadingLoc(false)
  }, [])

  const selectProject = (p) => {
    setSelectedProject(p)
    setBulkUrl('')
    loadProjectLocation(p.name)
  }

  /* ── Create new project ─────────────────────── */
  const handleCreateProject = async () => {
    if (!newProjName.trim()) { toast.error('Project name is required.'); return }
    setSavingProj(true)
    try {
      await saveProject({ name: newProjName.trim() })
      toast.success(`Project "${newProjName.trim()}" created.`)
      setNewProjName(''); setShowNewProj(false)
      loadProjects()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create project.') }
    setSavingProj(false)
  }

  /* ── Save / update location ─────────────────── */
  const handleSaveLocation = async () => {
    if (!editLocation.trim()) { toast.error('Location name is required.'); return }
    if (!selectedProject) { toast.error('No project selected.'); return }
    setSavingLoc(true)
    try {
      await saveLocation({ project_name: selectedProject.name, location: editLocation.trim() })
      toast.success('Location saved.')
      loadProjectLocation(selectedProject.name)
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save location.') }
    setSavingLoc(false)
  }

  /* ── Remove location mapping ─────────────────── */
  const handleRemoveLocation = async () => {
    if (!selectedProject) { toast.error('No project selected.'); return }
    if (!currentLocation) return
    if (!window.confirm(`Remove location mapping for "${selectedProject.name}"?`)) return
    try {
      await deleteLocation(currentLocation.id)
      toast.success('Location removed.')
      setCurrentLocation(null); setEditLocation('')
    } catch { toast.error('Failed to remove location.') }
  }

  /* ── Bulk URL update ────────────────────────── */
  const handleBulkUrl = async () => {
    if (!selectedProject) return
    if (!window.confirm(`Update refer URL for ALL active leads in "${selectedProject.name}"?`)) return
    setSavingUrl(true)
    try {
      const res = await bulkUpdateUrl({ project_name: selectedProject.name, refer_url: bulkUrl.trim() })
      toast.success(res.data.message || 'URLs updated.')
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update URLs.') }
    setSavingUrl(false)
  }

  const cardStyle  = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'20px' }
  const inputStyle = { padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'0.85rem', outline:'none' }

  return (
    <div className="page" style={{ padding:'16px 16px 32px' }}>
      {/* Header */}
      <div className="topbar" style={{ marginBottom:16 }}>
        <h1 style={{ display:'flex', alignItems:'center', gap:8 }}>
          <FolderKanban size={22} color="var(--primary)" /> Project Manager
        </h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewProj(true)}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* New Project Modal */}
      {showNewProj && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>➕ New Project</h3>
              <button className="modal-close" onClick={() => setShowNewProj(false)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Project Name <span style={{ color:'var(--danger)' }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. Henry Office"
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewProj(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateProject} disabled={savingProj}>
                {savingProj ? 'Saving…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start' }}>

        {/* Left: Projects List */}
        <div style={cardStyle}>
          <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            Projects ({projects.length})
          </div>
          {loadingProjects
            ? <div style={{ textAlign:'center', padding:24 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
            : projects.length === 0
              ? <div className="empty-state" style={{ padding:24 }}><p>No projects yet. Create one!</p></div>
              : projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProject(p)}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'10px 12px', border:'none', borderRadius:'var(--radius-sm)',
                      cursor:'pointer', marginBottom:4, textAlign:'left', fontSize:'0.85rem',
                      background: selectedProject?.name === p.name ? 'var(--primary-light)' : 'transparent',
                      color: selectedProject?.name === p.name ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: selectedProject?.name === p.name ? 600 : 400,
                    }}
                  >
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <FolderKanban size={14} /> {p.name}
                    </span>
                    <ChevronRight size={13} style={{ opacity:0.4 }} />
                  </button>
                ))
          }
        </div>

        {/* Right: Project Details */}
        {selectedProject ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Project header */}
            <div style={{ ...cardStyle, display:'flex', alignItems:'center', gap:12 }}>
              <FolderKanban size={20} color="var(--primary)" />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'1rem' }}>{selectedProject.name}</div>
                {currentLocation
                  ? <div style={{ fontSize:'0.78rem', color:'var(--accent)', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                      <MapPin size={12} /> {currentLocation.location}
                    </div>
                  : <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:2 }}>No location set</div>
                }
              </div>
            </div>

            {/* ── Location Panel (ONE location per project) ── */}
            <div style={cardStyle}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontWeight:600, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:6 }}>
                  <MapPin size={15} color="var(--accent)" /> Location
                </div>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', background:'var(--bg-elevated)',
                  padding:'2px 8px', borderRadius:8 }}>
                  One location per project
                </span>
              </div>

              {loadingLoc
                ? <div style={{ textAlign:'center', padding:16 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
                : (
                  <>
                    {/* Current location display */}
                    {currentLocation && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12,
                        background:'var(--bg-elevated)', border:'1px solid var(--border)',
                        borderRadius:'var(--radius-sm)', padding:'8px 12px' }}>
                        <MapPin size={13} color="var(--accent)" />
                        <span style={{ flex:1, fontSize:'0.85rem', fontWeight:600 }}>{currentLocation.location}</span>
                        <button
                          onClick={handleRemoveLocation}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', padding:0, display:'flex' }}
                          title="Remove location"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Set / Change location */}
                    <div style={{ display:'flex', gap:8 }}>
                      <input
                        style={{ ...inputStyle, flex:1 }}
                        placeholder={currentLocation ? 'Change location…' : 'Set location name…'}
                        value={editLocation}
                        onChange={e => setEditLocation(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveLocation()}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleSaveLocation} disabled={savingLoc}>
                        <Save size={13} /> {savingLoc ? 'Saving…' : currentLocation ? 'Update' : 'Set Location'}
                      </button>
                    </div>
                    <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:8 }}>
                      Each project can have only one location. Updating will replace the existing one.
                    </p>
                  </>
                )
              }
            </div>

            {/* Bulk URL Update */}
            <div style={cardStyle}>
              <div style={{ fontWeight:600, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                <Link size={15} color="var(--accent)" /> Bulk Update Refer URL
              </div>
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:12 }}>
                Set a single <strong>Refer URL</strong> for <em>all active leads</em> under <strong>{selectedProject.name}</strong>.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  style={{ ...inputStyle, flex:1 }}
                  placeholder="https://example.com/campaign (leave blank to clear)"
                  value={bulkUrl}
                  onChange={e => setBulkUrl(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" onClick={handleBulkUrl} disabled={savingUrl}>
                  <Edit3 size={13} /> {savingUrl ? 'Updating…' : 'Update All Leads'}
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ ...cardStyle, textAlign:'center', padding:48 }}>
            <FolderKanban size={36} style={{ opacity:0.2, margin:'0 auto 12px' }} />
            <p style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>Select a project from the left to manage its location and lead URLs.</p>
          </div>
        )}
      </div>
    </div>
  )
}
