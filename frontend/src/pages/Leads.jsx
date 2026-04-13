import { useState, useEffect, useCallback } from 'react'
import {
  getLeads, uploadLeadsPreview, confirmUpload, updateFeedback,
  getTimeline, deleteLeads, mergeLeads, getProjects, triggerDownload, downloadLeads
} from '../api/axios.js'
import toast from 'react-hot-toast'
import {
  Search, Upload, Download, X, ChevronLeft, ChevronRight,
  Trash2, GitMerge, Globe, Eye, FileText, CheckSquare, Square, AlertTriangle, RefreshCw
} from 'lucide-react'

const STATUSES = ['New','Assigned','Called','Interested','Follow Up','Site Visit','Booked','Not Interested','Wrong Number']
const PAGE_SIZES = [50, 100, 200, 500, 1000]

function StatusBadge({ status }) {
  const map = {
    'New':'badge-new','Assigned':'badge-assigned','Called':'badge-called',
    'Interested':'badge-interested','Follow Up':'badge-follow-up','Site Visit':'badge-site-visit',
    'Booked':'badge-booked','Not Interested':'badge-not-interested','Wrong Number':'badge-wrong-number'
  }
  return <span className={`badge ${map[status] || 'badge-new'}`}>{status}</span>
}

export default function Leads() {
  const user    = JSON.parse(localStorage.getItem('lead8x_user') || '{}')
  const isAdmin = ['Admin','Manager'].includes(user.role)

  // --- State ---
  const [leads, setLeads]           = useState([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [limit, setLimit]           = useState(50)
  const [loading, setLoading]       = useState(false)

  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [project, setProject]       = useState('')
  const [isNri, setIsNri]           = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showDeleted, setShowDeleted]       = useState(false)

  const [projects, setProjects]     = useState([])
  const [selected, setSelected]     = useState([])

  // Upload
  const [previewData, setPreviewData] = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [confirming, setConfirming]   = useState(false)
  const [projName, setProjName]       = useState('')
  const [referUrl, setReferUrl]       = useState('')

  // Timeline
  const [timelineModal, setTimelineModal] = useState(null)
  const [timeline, setTimeline]           = useState([])

  // Feedback
  const [feedbackModal, setFeedbackModal] = useState(null)
  const [feedbackForm, setFeedbackForm]   = useState({ status: '', remark: '' })

  // Merge / Delete
  const [merging, setMerging]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // --- Load ---
  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit, search, status, project }
      if (isNri)          params.is_nri = 1
      if (showDuplicates) params.is_duplicate = 1
      if (showDeleted)    params.show_deleted = 1
      const res = await getLeads(params)
      setLeads(res.data.data.leads)
      setTotal(res.data.data.total)
      setTotalPages(res.data.data.total_pages)
      setSelected([])
    } catch { toast.error('Failed to load leads.') }
    setLoading(false)
  }, [page, limit, search, status, project, isNri, showDuplicates, showDeleted])

  useEffect(() => { loadLeads() }, [loadLeads])
  useEffect(() => {
    getProjects().then(r => setProjects(r.data.data.projects || [])).catch(() => {})
  }, [])

  // --- Upload Step 1 ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadLeadsPreview(fd)
      const d   = res.data.data
      setPreviewData(d)
      setProjName(d.hidden_values?.[0] || '')
      setReferUrl('')
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed.') }
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
      setPreviewData(null)
      loadLeads()
    } catch (err) { toast.error(err.response?.data?.message || 'Confirm failed.') }
    setConfirming(false)
  }

  // --- Download ---
  const handleDownload = async () => {
    try {
      const res = await downloadLeads({ search, status, project, ...(isNri ? { is_nri: 1 } : {}) })
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

  // --- Delete / Purge confirm ---
  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteLeads(deleteConfirm)
      const msg = deleteConfirm.mode === 'purge' || deleteConfirm.mode === 'purge_all'
        ? 'Permanently deleted.' : 'Moved to trash.'
      toast.success(msg)
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
    } catch (err) { toast.error(err.response?.data?.message || 'Merge failed.') }
    setMerging(false)
  }

  const fmt = (v) => v || '—'
  const fmtTime = (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—'

  return (
    <div className="page">
      {/* ---- Header ---- */}
      <div className="topbar" style={{ marginBottom: 20 }}>
        <h1>Leads <span style={{ fontSize:'0.85rem', color:'var(--text-muted)', fontWeight:400 }}>({total.toLocaleString()})</span></h1>
        <div className="topbar-actions">
          {isAdmin && (
            <>
              <label className="btn btn-primary" style={{ cursor:'pointer' }}>
                <Upload size={16} /> {uploading ? 'Parsing…' : 'Upload'}
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFileChange} disabled={uploading} />
              </label>
              <button className="btn btn-secondary" onClick={handleDownload}><Download size={16} /> Export</button>
            </>
          )}
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="filters-bar" style={{ flexWrap:'wrap', gap:8, marginBottom:12 }}>
        <div className="search-box">
          <Search size={15} />
          <input className="form-input" placeholder="Search phone, name…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ width:145 }} value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ width:145 }} value={project}
          onChange={e => { setProject(e.target.value); setPage(1) }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <button className={`btn btn-sm ${isNri ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setIsNri(v => !v); setPage(1) }}>
          <Globe size={14} /> NRI {isNri ? '✓' : ''}
        </button>
        <button className={`btn btn-sm ${showDuplicates ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setShowDuplicates(v => !v); setPage(1) }}>
          <RefreshCw size={14} /> Duplicates
        </button>
        {isAdmin && (
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => { setShowDeleted(v => !v); setPage(1) }}>
            <Trash2 size={14} /> {showDeleted ? '🗑 Trash View' : 'Trash'}
          </button>
        )}
        {/* Per-page selector */}
        <select className="form-select" style={{ width:110 }} value={limit}
          onChange={e => { setLimit(parseInt(e.target.value)); setPage(1) }}>
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {/* ---- Bulk Action Bar ---- */}
      {selected.length > 0 && isAdmin && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:14,
          padding:'10px 16px', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
          <span style={{ fontWeight:600, color:'var(--accent)' }}>{selected.length} selected</span>
          {!showDeleted && (
            <button className="btn btn-danger btn-sm"
              onClick={() => setDeleteConfirm({ mode:'bulk', ids: selected })}>
              <Trash2 size={13} /> Move to Trash
            </button>
          )}
          {showDeleted && (
            <button className="btn btn-danger btn-sm"
              onClick={() => setDeleteConfirm({ mode:'purge', ids: selected })}>
              <Trash2 size={13} /> Permanently Delete
            </button>
          )}
          {showDuplicates && (
            <button className="btn btn-sm" style={{ background:'var(--primary-light)', color:'var(--accent)' }}
              onClick={handleMerge} disabled={merging}>
              <GitMerge size={13} /> {merging ? 'Merging…' : 'Power Merge'}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected([])}><X size={13} /> Clear</button>
        </div>
      )}

      {/* ---- Toolbar: Delete by Project / Purge All Trash ---- */}
      {isAdmin && (
        <div style={{ marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          {!showDeleted && (
            <>
              <select className="form-select" style={{ width:200 }} id="del-project-select" defaultValue="">
                <option value="">Delete by Project…</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <button className="btn btn-danger btn-sm" onClick={() => {
                const sel = document.getElementById('del-project-select').value
                if (!sel) { toast.error('Select a project first.'); return }
                setDeleteConfirm({ mode:'project', project: sel })
              }}><Trash2 size={13} /> Delete All</button>
            </>
          )}
          {showDeleted && (
            <button className="btn btn-danger btn-sm"
              onClick={() => setDeleteConfirm({ mode:'purge_all' })}>
              <Trash2 size={13} /> Purge Entire Trash
            </button>
          )}
        </div>
      )}

      {/* ---- Table ---- */}
      <div className="table-wrapper" style={{ overflowX:'auto' }}>
        <table style={{ minWidth:1200 }}>
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
              <th>URL</th>
              <th>Country</th>
              <th>IP Address</th>
              <th>Device</th>
              <th>Created Time</th>
              <th>Assigned To</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 13 : 12} style={{ textAlign:'center', padding:40 }}>
                <div className="loading-overlay"><div className="spinner" /></div>
              </td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={isAdmin ? 13 : 12}>
                <div className="empty-state"><FileText size={40} /><h3>No leads found</h3></div>
              </td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className={lead.is_duplicate ? 'is-duplicate' : ''}>
                {isAdmin && (
                  <td>
                    <button style={{ background:'none', border:'none', cursor:'pointer',
                      color: selected.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)' }}
                      onClick={() => toggleSelect(lead.id)}>
                      {selected.includes(lead.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </td>
                )}
                <td><strong>{fmt(lead.phone)}</strong></td>
                <td>{fmt(lead.name)}</td>
                <td>{fmt(lead.project)}</td>
                <td><StatusBadge status={lead.status} /></td>
                <td style={{ maxWidth:160 }}>
                  {lead.refer_url
                    ? <a href={lead.refer_url} target="_blank" rel="noreferrer"
                        style={{ color:'var(--primary)', fontSize:'0.78rem' }}
                        title={lead.refer_url} className="truncate" >
                        {lead.refer_url.replace(/^https?:\/\//, '').slice(0, 30)}…
                      </a>
                    : '—'}
                </td>
                <td>{fmt(lead.country)}</td>
                <td style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{fmt(lead.ip_address)}</td>
                <td style={{ fontSize:'0.78rem' }}>{fmt(lead.device)}</td>
                <td style={{ fontSize:'0.78rem', whiteSpace:'nowrap' }}>{fmtTime(lead.created_at)}</td>
                <td>{fmt(lead.assigned_to_name)}</td>
                <td style={{ maxWidth:130 }} className="truncate" title={lead.remark || ''}>{fmt(lead.remark)}</td>
                <td>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn btn-secondary btn-sm" title="Timeline" onClick={() => openTimeline(lead)}><Eye size={13} /></button>
                    {!showDeleted && <button className="btn btn-secondary btn-sm" title="Update" onClick={() => { setFeedbackModal(lead); setFeedbackForm({ status: lead.status || 'New', remark: lead.remark || '' }) }}>✏️</button>}
                    {isAdmin && !showDeleted && <button className="btn btn-danger btn-sm" title="Move to Trash" onClick={() => setDeleteConfirm({ mode:'single', ids:[lead.id] })}><Trash2 size={13} /></button>}
                    {isAdmin && showDeleted && <button className="btn btn-danger btn-sm" title="Permanently Delete" onClick={() => setDeleteConfirm({ mode:'purge', ids:[lead.id] })}><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Pagination ---- */}
      <div className="pagination" style={{ marginTop:16, gap:6 }}>
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3
          if (p < 1 || p > totalPages) return null
          return <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
        })}
        <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
        <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginLeft:8 }}>
          Page {page} of {totalPages} · {total.toLocaleString()} total
        </span>
      </div>

      {/* ================================================================
          MODAL: Upload Preview
      ================================================================ */}
      {previewData && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📤 Upload Preview — {previewData.total_rows} rows</h3>
              <button className="modal-close" onClick={() => setPreviewData(null)}><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Project Name <span style={{ color:'var(--danger)' }}>*</span></label>
                <input className="form-input" list="proj-list" placeholder="Type or select…"
                  value={projName} onChange={e => setProjName(e.target.value)} />
                <datalist id="proj-list">
                  {(previewData.hidden_values || []).map(v => <option key={v} value={v} />)}
                  {projects.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                <p className="form-hint">Auto-detected from Hidden Field. Override if needed.</p>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Refer URL <span style={{ color:'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input"
                  placeholder={previewData.refer_detected ? 'Auto-detected in file' : 'Type URL or leave blank…'}
                  value={referUrl} onChange={e => setReferUrl(e.target.value)} />
                <p className="form-hint">{previewData.refer_detected ? 'File has URL column. Manual entry overrides all rows.' : 'No URL found in file.'}</p>
              </div>
            </div>
            <div style={{ overflowX:'auto', maxHeight:260, border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>
              <table>
                <thead><tr><th>#</th><th>Phone</th><th>Name</th><th>Project (Hidden Field)</th><th>Country</th><th>URL</th></tr></thead>
                <tbody>
                  {(previewData.preview || []).map((row, i) => (
                    <tr key={i}>
                      <td>{i+1}</td><td>{row.phone || '—'}</td><td>{row.name || '—'}</td>
                      <td>{row.hidden_field || row.project || '—'}</td>
                      <td>{row.country || '—'}</td>
                      <td className="truncate" style={{ maxWidth:120 }}>{row.refer_url || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.total_rows > 20 && (
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:6 }}>
                Showing 20 of {previewData.total_rows} rows. All rows will be imported.
              </p>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewData(null)}>Cancel</button>
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
              {timelineModal.refer_url && <div style={{ marginTop:4, fontSize:'0.78rem', color:'var(--text-muted)' }}>🔗 {timelineModal.refer_url}</div>}
              {timelineModal.country && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>🌐 {timelineModal.country} · {timelineModal.ip_address} · {timelineModal.device}</div>}
            </div>
            {timeline.length === 0
              ? <div className="empty-state"><p>No timeline events yet.</p></div>
              : <div className="timeline">
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
            }
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTimelineModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Feedback
      ================================================================ */}
      {feedbackModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>✏️ Update — {feedbackModal.phone}</h3>
              <button className="modal-close" onClick={() => setFeedbackModal(null)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={feedbackForm.status}
                onChange={e => setFeedbackForm(f => ({ ...f, status: e.target.value }))}>
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
          MODAL: Delete Confirm
      ================================================================ */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ color:'var(--danger)' }}><AlertTriangle size={18} style={{ marginRight:8 }} />Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
            </div>
            <p style={{ color:'var(--text-secondary)', marginBottom:20 }}>
              {deleteConfirm.mode === 'purge_all'   ? 'Permanently delete ALL leads in trash? This cannot be undone.' :
               deleteConfirm.mode === 'purge'       ? `Permanently delete ${deleteConfirm.ids?.length || 1} lead(s)? Cannot be undone.` :
               deleteConfirm.mode === 'project'     ? `Move all leads under project "${deleteConfirm.project}" to trash?` :
               deleteConfirm.mode === 'bulk'        ? `Move ${deleteConfirm.ids?.length} selected leads to trash?` :
               'Move this lead to trash?'}
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                {['purge','purge_all'].includes(deleteConfirm.mode) ? 'Permanently Delete' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
