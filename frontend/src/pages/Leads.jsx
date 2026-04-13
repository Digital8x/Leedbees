import { useState, useEffect, useCallback } from 'react'
import {
  getLeads, uploadLeadsPreview, confirmUpload, updateFeedback, bulkFeedback,
  getTimeline, deleteLeads, mergeLeads, getProjects, triggerDownload, downloadLeads
} from '../api/axios.js'
import toast from 'react-hot-toast'
import {
  Search, Upload, Download, Filter, X, ChevronLeft, ChevronRight,
  Trash2, GitMerge, Globe, Eye, FileText, CheckSquare, Square, AlertTriangle
} from 'lucide-react'

const STATUSES = ['New','Assigned','Called','Interested','Follow Up','Site Visit','Booked','Not Interested','Wrong Number']

function StatusBadge({ status }) {
  const map = {
    'New':'badge-new','Assigned':'badge-assigned','Called':'badge-called',
    'Interested':'badge-interested','Follow Up':'badge-follow-up','Site Visit':'badge-site-visit',
    'Booked':'badge-booked','Not Interested':'badge-not-interested','Wrong Number':'badge-wrong-number'
  }
  return <span className={`badge ${map[status] || 'badge-new'}`}>{status}</span>
}

export default function Leads() {
  const user = JSON.parse(localStorage.getItem('lead8x_user') || '{}')
  const isAdmin = ['Admin','Manager'].includes(user.role)

  // --- State ---
  const [leads, setLeads]             = useState([])
  const [total, setTotal]             = useState(0)
  const [totalPages, setTotalPages]   = useState(1)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)

  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState('')
  const [project, setProject]         = useState('')
  const [isNri, setIsNri]             = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  const [projects, setProjects]       = useState([])
  const [selected, setSelected]       = useState([])

  // Upload states
  const [uploadModal, setUploadModal]   = useState(false)
  const [previewData, setPreviewData]   = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [confirming, setConfirming]     = useState(false)
  const [projName, setProjName]         = useState('')
  const [referUrl, setReferUrl]         = useState('')

  // Timeline
  const [timelineModal, setTimelineModal] = useState(null)
  const [timeline, setTimeline]           = useState([])

  // Feedback
  const [feedbackModal, setFeedbackModal] = useState(null)
  const [feedbackForm, setFeedbackForm]   = useState({ status: '', remark: '' })

  // Merge
  const [merging, setMerging] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { mode, ids?, project? }

  // --- Load ---
  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 50, search, status, project }
      if (isNri)           params.is_nri = 1
      if (showDuplicates)  params.is_duplicate = 1
      if (showDeleted)     params.show_deleted = 1
      const res = await getLeads(params)
      setLeads(res.data.data.leads)
      setTotal(res.data.data.total)
      setTotalPages(res.data.data.total_pages)
      setSelected([])
    } catch { toast.error('Failed to load leads.') }
    setLoading(false)
  }, [page, search, status, project, isNri, showDuplicates, showDeleted])

  useEffect(() => { loadLeads() }, [loadLeads])
  useEffect(() => { getProjects().then(r => setProjects(r.data.data.projects || [])).catch(() => {}) }, [])

  // --- Upload Step 1 ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadLeadsPreview(fd)
      const d = res.data.data
      setPreviewData(d)
      setProjName(d.hidden_values?.[0] || '')
      setReferUrl('')
      setUploadModal(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.')
    }
    setUploading(false)
    e.target.value = ''
  }

  // --- Upload Step 2 ---
  const handleConfirmUpload = async () => {
    if (!projName.trim()) { toast.error('Project Name is required.'); return }
    setConfirming(true)
    try {
      const res = await confirmUpload({
        parse_id: previewData.parse_id,
        project_name: projName.trim(),
        refer_url: referUrl.trim(),
      })
      const d = res.data.data
      toast.success(`✅ ${d.new} new leads saved! ${d.duplicates} duplicates detected.`)
      setUploadModal(false)
      setPreviewData(null)
      loadLeads()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Confirm failed.')
    }
    setConfirming(false)
  }

  // --- Download ---
  const handleDownload = async () => {
    try {
      const params = { search, status, project }
      if (isNri) params.is_nri = 1
      const res = await downloadLeads(params)
      triggerDownload(res.data, 'leads_export.xlsx')
    } catch { toast.error('Download failed.') }
  }

  // --- Timeline ---
  const openTimeline = async (lead) => {
    setTimelineModal(lead)
    try {
      const res = await getTimeline(lead.id)
      setTimeline(res.data.data.timeline || [])
    } catch { setTimeline([]) }
  }

  // --- Feedback ---
  const submitFeedback = async () => {
    try {
      await updateFeedback({ lead_id: feedbackModal.id, ...feedbackForm })
      toast.success('Feedback saved.')
      setFeedbackModal(null)
      loadLeads()
    } catch { toast.error('Failed to save feedback.') }
  }

  // --- Selection ---
  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () =>
    setSelected(s => s.length === leads.length ? [] : leads.map(l => l.id))

  // --- Delete ---
  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteLeads(deleteConfirm)
      toast.success('Leads deleted.')
      setDeleteConfirm(null)
      setSelected([])
      loadLeads()
    } catch { toast.error('Delete failed.') }
  }

  // --- Power Merge ---
  const handleMerge = async () => {
    if (selected.length < 2) { toast.error('Select at least 2 leads to merge.'); return }
    setMerging(true)
    try {
      const res = await mergeLeads(selected)
      toast.success(`✅ Merged into lead #${res.data.data.master_id}`)
      setSelected([])
      loadLeads()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Merge failed.')
    }
    setMerging(false)
  }

  return (
    <div className="page">
      {/* ---- Header ---- */}
      <div className="topbar" style={{ position: 'sticky', top: 0, zIndex: 50, marginBottom: 24 }}>
        <h1>Leads <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({total.toLocaleString()})</span></h1>
        <div className="topbar-actions">
          {isAdmin && (
            <>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                <Upload size={16} /> {uploading ? 'Parsing…' : 'Upload'}
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFileChange} disabled={uploading} />
              </label>
              <button className="btn btn-secondary" onClick={handleDownload}><Download size={16} /> Export</button>
            </>
          )}
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={15} />
          <input className="form-input" placeholder="Search phone, name, email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ width: 150 }} value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ width: 150 }} value={project}
          onChange={e => { setProject(e.target.value); setPage(1) }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <button className={`btn ${isNri ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setIsNri(v => !v); setPage(1) }}>
          <Globe size={15} /> NRI
        </button>
        <button className={`btn ${showDuplicates ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setShowDuplicates(v => !v); setPage(1) }}>
          <Filter size={15} /> Duplicates
        </button>
        {isAdmin && (
          <button className={`btn ${showDeleted ? 'btn-danger' : 'btn-secondary'}`} onClick={() => { setShowDeleted(v => !v); setPage(1) }}>
            <Trash2 size={15} /> Deleted
          </button>
        )}
      </div>

      {/* ---- Bulk Action Bar ---- */}
      {selected.length > 0 && isAdmin && (
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, padding:'12px 16px', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
          <span style={{ fontWeight:600, color:'var(--accent)' }}>{selected.length} selected</span>
          <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm({ mode:'bulk', ids: selected })}>
            <Trash2 size={14} /> Delete Selected
          </button>
          {showDuplicates && (
            <button className="btn btn-sm" style={{ background:'var(--primary-light)', color:'var(--accent)' }}
              onClick={handleMerge} disabled={merging}>
              <GitMerge size={14} /> {merging ? 'Merging…' : 'Power Merge'}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected([])}>
            <X size={14} /> Clear
          </button>
        </div>
      )}

      {/* ---- Delete by Project ---- */}
      {isAdmin && (
        <div style={{ marginBottom: 16, display:'flex', gap:10, alignItems:'center' }}>
          <select className="form-select" style={{ width:200 }} id="del-project-select"
            defaultValue="">
            <option value="">Delete by Project…</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <button className="btn btn-danger btn-sm" onClick={() => {
            const sel = document.getElementById('del-project-select').value
            if (!sel) { toast.error('Select a project first.'); return }
            setDeleteConfirm({ mode:'project', project: sel })
          }}>
            <Trash2 size={14} /> Delete All
          </button>
        </div>
      )}

      {/* ---- Table ---- */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width:36 }}>
                  <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }} onClick={toggleAll}>
                    {selected.length === leads.length && leads.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
              )}
              <th>Phone</th>
              <th>Name</th>
              <th>Project Name</th>
              <th>Status</th>
              <th>Country</th>
              <th>NRI</th>
              <th>Assigned To</th>
              <th>Remark</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 10 : 9} style={{ textAlign:'center', padding:40 }}>
                <div className="loading-overlay"><div className="spinner" /></div>
              </td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={isAdmin ? 10 : 9}>
                <div className="empty-state"><FileText size={40} /><h3>No leads found</h3><p>Adjust filters or upload a file</p></div>
              </td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className={lead.is_duplicate ? 'is-duplicate' : ''}>
                {isAdmin && (
                  <td>
                    <button style={{ background:'none', border:'none', cursor:'pointer', color: selected.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)' }}
                      onClick={() => toggleSelect(lead.id)}>
                      {selected.includes(lead.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </td>
                )}
                <td><strong>{lead.phone}</strong></td>
                <td>{lead.name || '—'}</td>
                <td>{lead.project || '—'}</td>
                <td><StatusBadge status={lead.status} /></td>
                <td>{lead.country || '—'}</td>
                <td>{lead.is_nri ? <span className="badge" style={{ background:'rgba(6,182,212,0.12)', color:'var(--accent-2)' }}>🌍 NRI</span> : '—'}</td>
                <td>{lead.assigned_to_name || '—'}</td>
                <td style={{ maxWidth:150 }} className="truncate">{lead.remark || '—'}</td>
                <td>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-secondary btn-sm" title="View Timeline" onClick={() => openTimeline(lead)}><Eye size={13} /></button>
                    {!showDeleted && <button className="btn btn-secondary btn-sm" title="Edit / Feedback" onClick={() => { setFeedbackModal(lead); setFeedbackForm({ status: lead.status || 'New', remark: lead.remark || '' }) }}>✏️</button>}
                    {isAdmin && !showDeleted && <button className="btn btn-danger btn-sm" title="Delete" onClick={() => setDeleteConfirm({ mode:'single', ids:[lead.id] })}><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Pagination ---- */}
      <div className="pagination">
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3
          if (p < 1 || p > totalPages) return null
          return <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
        })}
        <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
      </div>

      {/* ================================================================
          MODAL: Upload Preview (Step 2)
      ================================================================ */}
      {uploadModal && previewData && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📤 Upload Preview — {previewData.total_rows} rows</h3>
              <button className="modal-close" onClick={() => { setUploadModal(false); setPreviewData(null) }}><X size={18} /></button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              {/* Project Name */}
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Project Name <span style={{ color:'var(--danger)' }}>*</span></label>
                <input className="form-input" list="project-suggestions" placeholder="Type or select project…"
                  value={projName} onChange={e => setProjName(e.target.value)} />
                <datalist id="project-suggestions">
                  {(previewData.hidden_values || []).map(v => <option key={v} value={v} />)}
                  {projects.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                <p className="form-hint">Auto-detected from "Hidden Field" column. Override if needed.</p>
              </div>

              {/* Refer URL */}
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Refer URL <span style={{ color:'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" placeholder={previewData.refer_detected ? 'Auto-detected from file' : 'Type URL or leave blank…'}
                  value={referUrl} onChange={e => setReferUrl(e.target.value)} />
                <p className="form-hint">{previewData.refer_detected ? 'File has Refer URL column — manual entry overrides all rows.' : 'No Refer URL found in file. Enter manually or leave blank.'}</p>
              </div>
            </div>

            {/* Preview Table */}
            <div style={{ overflowX:'auto', maxHeight:280, border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Phone</th><th>Name</th><th>Project Name (Hidden Field)</th><th>Country</th><th>Refer URL</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewData.preview || []).map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.name || '—'}</td>
                      <td>{row.hidden_field || row.project || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                      <td>{row.country || '—'}</td>
                      <td style={{ maxWidth:120 }} className="truncate">{row.refer_url || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.total_rows > 20 && (
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:8 }}>
                Showing first 20 of {previewData.total_rows} rows. All rows will be imported on confirm.
              </p>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setUploadModal(false); setPreviewData(null) }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmUpload} disabled={confirming}>
                {confirming ? 'Saving…' : `✅ Confirm Import (${previewData.total_rows} rows)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Timeline
      ================================================================ */}
      {timelineModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📋 Timeline — {timelineModal.phone}</h3>
              <button className="modal-close" onClick={() => setTimelineModal(null)}><X size={18} /></button>
            </div>
            <div style={{ marginBottom:12 }}>
              <strong>{timelineModal.name}</strong>
              {timelineModal.project && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· {timelineModal.project}</span>}
              {timelineModal.is_nri ? <span className="badge" style={{ marginLeft:8, background:'rgba(6,182,212,0.12)', color:'var(--accent-2)' }}>🌍 NRI</span> : null}
              {timelineModal.refer_url && <div style={{ marginTop:6, fontSize:'0.78rem', color:'var(--text-muted)' }}>🔗 {timelineModal.refer_url}</div>}
            </div>
            {timeline.length === 0 ? (
              <div className="empty-state"><p>No timeline events yet.</p></div>
            ) : (
              <div className="timeline">
                {timeline.map(ev => (
                  <div key={ev.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-event">{ev.event_type}</div>
                      <div className="timeline-desc">{ev.description}</div>
                      <div className="timeline-meta">{ev.actor_name} · {new Date(ev.created_at).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTimelineModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Feedback / Edit
      ================================================================ */}
      {feedbackModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>✏️ Update Lead — {feedbackModal.phone}</h3>
              <button className="modal-close" onClick={() => setFeedbackModal(null)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={feedbackForm.status} onChange={e => setFeedbackForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Remark</label>
              <textarea className="form-textarea" rows={3} value={feedbackForm.remark}
                onChange={e => setFeedbackForm(f => ({ ...f, remark: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setFeedbackModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitFeedback}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Delete Confirmation
      ================================================================ */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ color:'var(--danger)' }}><AlertTriangle size={18} style={{ marginRight:8 }} />Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
            </div>
            <p style={{ color:'var(--text-secondary)', marginBottom:20 }}>
              {deleteConfirm.mode === 'project'
                ? `Delete ALL leads under project "${deleteConfirm.project}"? This cannot be undone.`
                : deleteConfirm.mode === 'bulk'
                ? `Delete ${deleteConfirm.ids.length} selected leads?`
                : `Delete this lead?`
              }
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
