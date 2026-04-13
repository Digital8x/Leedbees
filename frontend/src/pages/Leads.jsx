import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getLeads, uploadLeadsPreview, confirmUpload, updateFeedback, uploadFeedback,
  getTimeline, deleteLeads, mergeLeads, getProjects, getUsers,
  triggerDownload, downloadLeads
} from '../api/axios.js'
import toast from 'react-hot-toast'
import {
  Search, Upload, Download, X, ChevronLeft, ChevronRight,
  Trash2, GitMerge, Globe, Eye, FileText, CheckSquare, Square,
  AlertTriangle, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, RefreshCcw
} from 'lucide-react'

const STATUSES  = ['New','Assigned','Called','Interested','Follow Up','Site Visit','Booked','Not Interested','Wrong Number']
const PAGE_SIZES = [50, 100, 200, 500, 1000]
const DEVICES   = [{ label:'All Devices', val:'' }, { label:'Safari | iPhone', val:'Safari' }, { label:'Chrome | Windows', val:'Chrome' }]

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ArrowUpDown size={13} style={{ opacity:0.3, marginLeft:3 }} />
  return sortDir === 'ASC'
    ? <ArrowUp size={13} style={{ marginLeft:3, color:'var(--primary)' }} />
    : <ArrowDown size={13} style={{ marginLeft:3, color:'var(--primary)' }} />
}

function Th({ label, col, sortBy, setSortBy, sortDir, setSortDir }) {
  const toggle = () => {
    if (sortBy === col) setSortDir(d => d === 'DESC' ? 'ASC' : 'DESC')
    else { setSortBy(col); setSortDir('DESC') }
  }
  return (
    <th onClick={toggle} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
      {label}<SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
    </th>
  )
}

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

  // Table state
  const [leads, setLeads]         = useState([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]           = useState(1)
  const [limit, setLimit]         = useState(50)
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState([])

  // Filters
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [project, setProject]       = useState('')
  const [device, setDevice]         = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [isNri, setIsNri]           = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showDeleted, setShowDeleted]       = useState(false)

  // Sort
  const [sortBy, setSortBy]   = useState('date')
  const [sortDir, setSortDir] = useState('DESC')

  // Reference data
  const [projects, setProjects] = useState([])
  const [users, setUsers]       = useState([])

  // Upload
  const [previewData, setPreviewData] = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [confirming, setConfirming]   = useState(false)
  const [projName, setProjName]       = useState('')
  const [referUrl, setReferUrl]       = useState('')
  const fbInputRef = useRef(null)

  // Modals
  const [timelineModal, setTimelineModal] = useState(null)
  const [timeline, setTimeline]           = useState([])
  const [feedbackModal, setFeedbackModal] = useState(null)
  const [feedbackForm, setFeedbackForm]   = useState({ status:'', remark:'' })
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [merging, setMerging]             = useState(false)

  // Load leads
  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit, search, status, project, device,
        sort_by: sortBy, sort_dir: sortDir }
      if (isNri)          params.is_nri = 1
      if (showDuplicates) params.is_duplicate = 1
      if (showDeleted)    params.show_deleted = 1
      if (dateFrom)       params.date_from = dateFrom
      if (dateTo)         params.date_to   = dateTo
      const res = await getLeads(params)
      setLeads(res.data.data.leads)
      setTotal(res.data.data.total)
      setTotalPages(res.data.data.total_pages)
      setSelected([])
    } catch { toast.error('Failed to load leads.') }
    setLoading(false)
  }, [page, limit, search, status, project, device, isNri, showDuplicates, showDeleted, dateFrom, dateTo, sortBy, sortDir])

  useEffect(() => { loadLeads() }, [loadLeads])
  useEffect(() => {
    getProjects().then(r => setProjects(r.data.data.projects || [])).catch(() => {})
    if (isAdmin) getUsers().then(r => setUsers(r.data.data.users || [])).catch(() => {})
  }, [isAdmin])

  // Upload step 1
  const handleFileChange = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await uploadLeadsPreview(fd)
      const d   = res.data.data
      setPreviewData(d); setProjName(d.hidden_values?.[0] || ''); setReferUrl('')
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed.') }
    setUploading(false); e.target.value = ''
  }

  // Upload step 2
  const handleConfirmUpload = async () => {
    if (!projName.trim()) { toast.error('Project Name is required.'); return }
    setConfirming(true)
    try {
      const res = await confirmUpload({ parse_id: previewData.parse_id, project_name: projName.trim(), refer_url: referUrl.trim() })
      const d = res.data.data
      toast.success(`✅ ${d.new} new leads saved! ${d.duplicates} duplicates.`)
      setPreviewData(null); loadLeads()
    } catch (err) { toast.error(err.response?.data?.message || 'Confirm failed.') }
    setConfirming(false)
  }

  // Feedback sync upload
  const handleFeedbackSync = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    const t = toast.loading('Syncing feedback…')
    try {
      const res = await uploadFeedback(fd)
      const d = res.data.data
      toast.success(`✅ ${d.updated} leads updated from ${d.processed} rows.`, { id: t })
      loadLeads()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed.', { id: t })
    }
    e.target.value = ''
  }

  // Download helpers
  const handleDownloadSelection = async () => {
    if (selected.length === 0) { toast.error('Select leads first.'); return }
    try {
      const res = await downloadLeads({ export_ids: selected.join(',') })
      triggerDownload(res.data, 'leads_selection.xlsx')
    } catch { toast.error('Export failed.') }
  }
  const handleDownloadAll = async () => {
    try {
      const params = { search, status, project, ...(isNri ? { is_nri: 1 } : {}) }
      const res = await downloadLeads(params)
      triggerDownload(res.data, 'leads_export.xlsx')
    } catch { toast.error('Export failed.') }
  }

  // Timeline
  const openTimeline = async (lead) => {
    setTimelineModal(lead)
    try { const res = await getTimeline(lead.id); setTimeline(res.data.data.timeline || []) }
    catch { setTimeline([]) }
  }

  // Feedback modal
  const submitFeedback = async () => {
    try {
      await updateFeedback({ lead_id: feedbackModal.id, ...feedbackForm })
      toast.success('Feedback saved.'); setFeedbackModal(null); loadLeads()
    } catch { toast.error('Failed to save feedback.') }
  }

  // In-row status update (caller)
  const quickStatus = async (leadId, newStatus) => {
    try {
      await updateFeedback({ lead_id: leadId, status: newStatus })
      // Optimistic update
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
      toast.success('Status updated.')
    } catch { toast.error('Update failed.'); loadLeads() }
  }

  // Selection
  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () =>
    setSelected(s => s.length === leads.length ? [] : leads.map(l => l.id))

  // Delete / purge
  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteLeads(deleteConfirm)
      toast.success(['purge','purge_all'].includes(deleteConfirm.mode) ? 'Permanently deleted.' : 'Moved to trash.')
      setDeleteConfirm(null); setSelected([]); loadLeads()
    } catch { toast.error('Delete failed.') }
  }

  // Merge
  const handleMerge = async () => {
    if (selected.length < 2) { toast.error('Select at least 2 leads.'); return }
    setMerging(true)
    try {
      const res = await mergeLeads(selected)
      toast.success(`✅ Merged into lead #${res.data.data.master_id}`)
      setSelected([]); loadLeads()
    } catch (err) { toast.error(err.response?.data?.message || 'Merge failed.') }
    setMerging(false)
  }

  const fmt = (v) => v || '—'
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—'
  const resetFilters = () => {
    setSearch(''); setStatus(''); setProject(''); setDevice('');
    setDateFrom(''); setDateTo(''); setIsNri(false);
    setShowDuplicates(false); setShowDeleted(false); setPage(1)
  }

  return (
    <div className="page">
      {/* ─── HEADER ─── */}
      <div className="topbar" style={{ marginBottom:16 }}>
        <h1>Leads <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:400 }}>({total.toLocaleString()})</span></h1>
        <div className="topbar-actions" style={{ flexWrap:'wrap', gap:8 }}>
          {isAdmin && (
            <>
              <label className="btn btn-primary btn-sm" style={{ cursor:'pointer' }}>
                <Upload size={14} /> {uploading ? 'Parsing…' : 'Upload'}
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFileChange} disabled={uploading} />
              </label>
              <label className="btn btn-secondary btn-sm" style={{ cursor:'pointer' }} title="Re-upload exported sheet with ID+Status+Remarks to bulk-update">
                <RefreshCcw size={14} /> Feedback Sync
                <input type="file" ref={fbInputRef} accept=".xlsx,.xls,.csv" hidden onChange={handleFeedbackSync} />
              </label>
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadSelection} title="Export selected rows">
                <Download size={14} /> Export Selection
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadAll} title="Export all filtered rows">
                <Download size={14} /> Export All
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
        {/* Search */}
        <div className="search-box" style={{ flexGrow:1, minWidth:160 }}>
          <Search size={14} />
          <input className="form-input" placeholder="Search ID, phone, name…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        {/* Status */}
        <select className="form-select" style={{ width:140 }} value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {/* Project (admin only) */}
        {isAdmin && (
          <select className="form-select" style={{ width:140 }} value={project}
            onChange={e => { setProject(e.target.value); setPage(1) }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}
        {/* Device */}
        <select className="form-select" style={{ width:145 }} value={device}
          onChange={e => { setDevice(e.target.value); setPage(1) }}>
          {DEVICES.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
        </select>
        {/* Date range */}
        <input type="date" className="form-input" style={{ width:135 }} value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }} title="From date" />
        <input type="date" className="form-input" style={{ width:135 }} value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1) }} title="To date" />
        {/* Flags */}
        <button className={`btn btn-sm ${isNri ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setIsNri(v => !v); setPage(1) }}>
          <Globe size={13} /> NRI
        </button>
        <button className={`btn btn-sm ${showDuplicates ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setShowDuplicates(v => !v); setPage(1) }}>
          <RefreshCw size={13} /> Dups
        </button>
        {isAdmin && (
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => { setShowDeleted(v => !v); setPage(1) }}>
            <Trash2 size={13} /> Trash
          </button>
        )}
        <select className="form-select" style={{ width:105 }} value={limit}
          onChange={e => { setLimit(parseInt(e.target.value)); setPage(1) }}>
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n}/page</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={resetFilters} title="Reset filters">↺</button>
      </div>

      {/* ─── BULK ACTION BAR ─── */}
      {selected.length > 0 && isAdmin && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10,
          padding:'9px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
          <span style={{ fontWeight:600, color:'var(--accent)', fontSize:'0.85rem' }}>{selected.length} selected</span>
          {!showDeleted && (
            <button className="btn btn-danger btn-sm"
              onClick={() => setDeleteConfirm({ mode:'bulk', ids: selected })}>
              <Trash2 size={13} /> Trash
            </button>
          )}
          {showDeleted && (
            <button className="btn btn-danger btn-sm"
              onClick={() => setDeleteConfirm({ mode:'purge', ids: selected })}>
              <Trash2 size={13} /> Purge
            </button>
          )}
          {showDuplicates && (
            <button className="btn btn-sm" style={{ background:'var(--primary-light)', color:'var(--accent)' }}
              onClick={handleMerge} disabled={merging}>
              <GitMerge size={13} /> {merging ? '…' : 'Merge'}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected([])}><X size={13} /></button>
        </div>
      )}

      {/* ─── ADMIN TOOLS ROW ─── */}
      {isAdmin && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
          {!showDeleted && (
            <>
              <select className="form-select" style={{ width:185 }} id="del-proj-select" defaultValue="">
                <option value="">Delete by Project…</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <button className="btn btn-danger btn-sm" onClick={() => {
                const s = document.getElementById('del-proj-select').value
                if (!s) { toast.error('Select a project.'); return }
                setDeleteConfirm({ mode:'project', project: s })
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

      {/* ─── TABLE ─── */}
      <div className="table-wrapper" style={{ overflowX:'auto' }}>
        <table style={{ minWidth:1280, tableLayout:'auto' }}>
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width:34 }}>
                  <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }} onClick={toggleAll}>
                    {selected.length === leads.length && leads.length > 0 ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                </th>
              )}
              <Th label="ID"    col="id"       sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} />
              <Th label="Name"  col="name"     sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} />
              <th>Phone</th>
              {isAdmin && <th>Assigned To</th>}
              <Th label="Date"  col="date"     sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} />
              <th>Status</th>
              <th>Device</th>
              <th>Country</th>
              <th>IP Address</th>
              <th>URL</th>
              <th>Remarks</th>
              <th style={{ position:'sticky', right:0, background:'var(--bg-surface)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 13 : 10} style={{ textAlign:'center', padding:40 }}>
                <div className="loading-overlay"><div className="spinner" /></div>
              </td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={isAdmin ? 13 : 10}>
                <div className="empty-state"><FileText size={36} /><h3>No leads found</h3>
                  <button className="btn btn-secondary btn-sm" onClick={resetFilters}>Clear Filters</button>
                </div>
              </td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className={lead.is_duplicate ? 'is-duplicate' : ''}>
                {isAdmin && (
                  <td>
                    <button style={{ background:'none', border:'none', cursor:'pointer',
                      color: selected.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)' }}
                      onClick={() => toggleSelect(lead.id)}>
                      {selected.includes(lead.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  </td>
                )}
                <td style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>#{lead.id}</td>
                <td><strong>{fmt(lead.name)}</strong></td>
                <td>
                  {lead.phone
                    ? <a href={`tel:${lead.phone}`} style={{ color:'var(--primary)', fontWeight:600, textDecoration:'none' }}>
                        {lead.phone}
                      </a>
                    : '—'}
                </td>
                {isAdmin && (
                  <td>
                    <select className="form-select" style={{ padding:'3px 6px', fontSize:'0.78rem', minWidth:110 }}
                      value={lead.assigned_to || ''}
                      onChange={async e => {
                        const uid = e.target.value ? parseInt(e.target.value) : null
                        try {
                          await updateFeedback({ lead_id: lead.id, assigned_to: uid })
                          setLeads(ls => ls.map(l => {
                            if (l.id !== lead.id) return l
                            const u = users.find(u => u.id === uid)
                            return { ...l, assigned_to: uid, assigned_to_name: u?.name || '' }
                          }))
                          toast.success('Assigned.')
                        } catch { toast.error('Assignment failed.') }
                      }}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                )}
                <td style={{ fontSize:'0.78rem', whiteSpace:'nowrap' }}>{fmtDate(lead.created_at)}</td>
                <td>
                  <select className="form-select" style={{ padding:'2px 5px', fontSize:'0.75rem', minWidth:120 }}
                    value={lead.status || 'New'}
                    onChange={e => quickStatus(lead.id, e.target.value)}
                    disabled={!isAdmin && lead.status === 'Not Interested'}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ fontSize:'0.78rem' }}>{fmt(lead.device)}</td>
                <td style={{ fontSize:'0.78rem' }}>{fmt(lead.country)}</td>
                <td style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{fmt(lead.ip_address)}</td>
                <td style={{ maxWidth:130 }}>
                  {lead.refer_url
                    ? <a href={lead.refer_url} target="_blank" rel="noreferrer"
                        style={{ color:'var(--primary)', fontSize:'0.75rem' }}
                        title={lead.refer_url} className="truncate">
                        {lead.refer_url.replace(/^https?:\/\//, '').slice(0, 28)}…
                      </a>
                    : '—'}
                </td>
                <td style={{ maxWidth:140, fontSize:'0.78rem' }} className="truncate" title={lead.remark || ''}>
                  {fmt(lead.remark)}
                </td>
                <td style={{ position:'sticky', right:0, background:'var(--bg-surface)' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-secondary btn-sm" title="Timeline" onClick={() => openTimeline(lead)}>
                      <Eye size={12} />
                    </button>
                    {!showDeleted && (
                      <button className="btn btn-secondary btn-sm" title="Edit / Note" onClick={() => {
                        setFeedbackModal(lead)
                        setFeedbackForm({ status: lead.status || 'New', remark: lead.remark || '' })
                      }}>✏️</button>
                    )}
                    {isAdmin && !showDeleted && (
                      <button className="btn btn-danger btn-sm" title="Trash" onClick={() => setDeleteConfirm({ mode:'single', ids:[lead.id] })}>
                        <Trash2 size={12} />
                      </button>
                    )}
                    {isAdmin && showDeleted && (
                      <button className="btn btn-danger btn-sm" title="Purge" onClick={() => setDeleteConfirm({ mode:'purge', ids:[lead.id] })}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── PAGINATION ─── */}
      <div className="pagination" style={{ marginTop:14, gap:5 }}>
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}><ChevronLeft size={15} /></button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = totalPages <= 7 ? i+1 : page <= 4 ? i+1 : page+i-3
          if (p < 1 || p > totalPages) return null
          return <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
        })}
        <button className="page-btn" disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p+1)}><ChevronRight size={15} /></button>
        <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginLeft:8 }}>
          Page {page}/{totalPages} · {total.toLocaleString()} leads
        </span>
      </div>

      {/* ──────────────────────────────────────────────────────────────
          MODAL: Upload Preview
      ────────────────────────────────────────────────────────────── */}
      {previewData && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📤 Upload Preview — {previewData.total_rows} rows</h3>
              <button className="modal-close" onClick={() => setPreviewData(null)}><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Project Name <span style={{ color:'var(--danger)' }}>*</span></label>
                <input className="form-input" list="proj-list-ul"
                  placeholder="Type or select…" value={projName} onChange={e => setProjName(e.target.value)} />
                <datalist id="proj-list-ul">
                  {(previewData.hidden_values || []).map(v => <option key={v} value={v} />)}
                  {projects.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                <p className="form-hint">Auto-detected from Hidden Field. Override if needed.</p>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Refer URL <span style={{ color:'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input"
                  placeholder={previewData.refer_detected ? 'Auto-detected in file' : 'Type URL or leave blank'}
                  value={referUrl} onChange={e => setReferUrl(e.target.value)} />
                <p className="form-hint">{previewData.refer_detected ? 'File has URL column. Manual entry overrides all.' : 'No URL found in file.'}</p>
              </div>
            </div>
            <div style={{ overflowX:'auto', maxHeight:240, border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>
              <table>
                <thead><tr><th>#</th><th>Phone</th><th>Name</th><th>Hidden Field / Project</th><th>Country</th><th>Device</th><th>IP</th><th>URL</th></tr></thead>
                <tbody>
                  {(previewData.preview || []).map((row, i) => (
                    <tr key={i}>
                      <td>{i+1}</td><td>{row.phone||'—'}</td><td>{row.name||'—'}</td>
                      <td>{row.hidden_field||row.project||'—'}</td>
                      <td>{row.country||'—'}</td>
                      <td>{row.device||'—'}</td>
                      <td style={{ fontSize:'0.75rem' }}>{row.ip_address||'—'}</td>
                      <td className="truncate" style={{ maxWidth:100 }}>{row.refer_url||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.total_rows > 20 &&
              <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', marginTop:6 }}>
                Showing 20 of {previewData.total_rows}. All imported on confirm.
              </p>}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewData(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmUpload} disabled={confirming}>
                {confirming ? 'Saving…' : `✅ Confirm (${previewData.total_rows} rows)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          MODAL: Timeline
      ────────────────────────────────────────────────────────────── */}
      {timelineModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📋 Timeline — {timelineModal.phone}</h3>
              <button className="modal-close" onClick={() => setTimelineModal(null)}><X size={18} /></button>
            </div>
            <div style={{ marginBottom:10, fontSize:'0.85rem' }}>
              <strong>{timelineModal.name}</strong>
              {timelineModal.project && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· {timelineModal.project}</span>}
              {timelineModal.country && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· 🌐 {timelineModal.country}</span>}
              {timelineModal.device  && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· 📱 {timelineModal.device}</span>}
              {timelineModal.ip_address && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:2 }}>IP: {timelineModal.ip_address}</div>}
              {timelineModal.refer_url  && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>🔗 {timelineModal.refer_url}</div>}
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
                </div>}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTimelineModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          MODAL: Feedback / Edit
      ────────────────────────────────────────────────────────────── */}
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

      {/* ──────────────────────────────────────────────────────────────
          MODAL: Delete Confirm
      ────────────────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ color:'var(--danger)' }}><AlertTriangle size={17} style={{ marginRight:7 }} />Confirm</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
            </div>
            <p style={{ color:'var(--text-secondary)', marginBottom:20 }}>
              {deleteConfirm.mode === 'purge_all' ? 'Permanently delete ALL trash leads? Cannot be undone.' :
               deleteConfirm.mode === 'purge'     ? `Permanently delete ${deleteConfirm.ids?.length || 1} lead(s)?` :
               deleteConfirm.mode === 'project'   ? `Move all leads in "${deleteConfirm.project}" to trash?` :
               deleteConfirm.mode === 'bulk'      ? `Move ${deleteConfirm.ids?.length} leads to trash?` :
               'Move this lead to trash?'}
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                {['purge','purge_all'].includes(deleteConfirm.mode) ? '🗑 Delete Forever' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
