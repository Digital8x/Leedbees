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

const STATUSES   = ['New','Assigned','Called','Interested','Follow Up','Site Visit','Booked','Not Interested','Wrong Number']
const PAGE_SIZES = [50, 100, 200, 500, 1000]
const DEVICES    = [{ label:'All Devices', val:'' }, { label:'Safari | iPhone', val:'Safari' }, { label:'Chrome | Windows', val:'Chrome' }]

/* ── Sortable header ─────────────────────────────────── */
function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ArrowUpDown size={11} style={{ opacity:0.3, marginLeft:2 }} />
  return sortDir === 'ASC'
    ? <ArrowUp   size={11} style={{ marginLeft:2, color:'var(--primary)' }} />
    : <ArrowDown size={11} style={{ marginLeft:2, color:'var(--primary)' }} />
}
function Th({ label, col, width, sortBy, setSortBy, sortDir, setSortDir, style={} }) {
  const toggle = () => {
    if (sortBy === col) setSortDir(d => d === 'DESC' ? 'ASC' : 'DESC')
    else { setSortBy(col); setSortDir('DESC') }
  }
  return (
    <th onClick={toggle} style={{ cursor:'pointer', userSelect:'none', width, ...style }}>
      {label}<SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
    </th>
  )
}

/* ── Status badge ────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    'New':'badge-new','Assigned':'badge-assigned','Called':'badge-called',
    'Interested':'badge-interested','Follow Up':'badge-follow-up','Site Visit':'badge-site-visit',
    'Booked':'badge-booked','Not Interested':'badge-not-interested','Wrong Number':'badge-wrong-number'
  }
  return <span className={`badge ${map[status] || 'badge-new'}`} style={{ fontSize:'0.68rem', padding:'2px 6px' }}>{status}</span>
}

/* ── cell style helpers ──────────────────────────────── */
const tdStyle = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.76rem', padding:'6px 8px' }
const thStyle = { fontSize:'0.74rem', padding:'8px 8px', whiteSpace:'nowrap' }

export default function Leads() {
  const user    = JSON.parse(localStorage.getItem('lead8x_user') || '{}')
  const isAdmin = ['Admin','Manager'].includes(user.role)

  // Table state
  const [leads, setLeads]           = useState([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [limit, setLimit]           = useState(50)
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState([])

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

  /* ── Load leads ──────────────────────────────────── */
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

  /* ── Upload step 1 ───────────────────────────────── */
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

  /* ── Upload step 2 ───────────────────────────────── */
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

  /* ── Feedback sync upload ────────────────────────── */
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

  /* ── Download helpers ────────────────────────────── */
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

  /* ── Timeline ────────────────────────────────────── */
  const openTimeline = async (lead) => {
    setTimelineModal(lead)
    try { const res = await getTimeline(lead.id); setTimeline(res.data.data.timeline || []) }
    catch { setTimeline([]) }
  }

  /* ── Feedback modal save ─────────────────────────── */
  const submitFeedback = async () => {
    try {
      await updateFeedback({ lead_id: feedbackModal.id, ...feedbackForm })
      toast.success('Feedback saved.'); setFeedbackModal(null); loadLeads()
    } catch { toast.error('Failed to save feedback.') }
  }

  /* ── In-row quick status ─────────────────────────── */
  const quickStatus = async (leadId, newStatus) => {
    try {
      await updateFeedback({ lead_id: leadId, status: newStatus })
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    } catch { toast.error('Update failed.'); loadLeads() }
  }

  /* ── In-row assign ───────────────────────────────── */
  const quickAssign = async (leadId, uid) => {
    try {
      const assignedTo = uid ? parseInt(uid) : null
      await updateFeedback({ lead_id: leadId, assigned_to: assignedTo })
      setLeads(ls => ls.map(l => {
        if (l.id !== leadId) return l
        const u = users.find(u => u.id === assignedTo)
        return { ...l, assigned_to: assignedTo, assigned_to_name: u?.name || '' }
      }))
      toast.success('Assigned.')
    } catch { toast.error('Assignment failed.') }
  }

  /* ── Selection ───────────────────────────────────── */
  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () =>
    setSelected(s => s.length === leads.length ? [] : leads.map(l => l.id))

  /* ── Delete / purge ──────────────────────────────── */
  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteLeads(deleteConfirm)
      toast.success(['purge','purge_all'].includes(deleteConfirm.mode) ? 'Permanently deleted.' : 'Moved to trash.')
      setDeleteConfirm(null); setSelected([]); loadLeads()
    } catch { toast.error('Delete failed.') }
  }

  /* ── Merge ───────────────────────────────────────── */
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

  const fmt     = (v) => v || '—'
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) : '—'
  const resetFilters = () => {
    setSearch(''); setStatus(''); setProject(''); setDevice('');
    setDateFrom(''); setDateTo(''); setIsNri(false);
    setShowDuplicates(false); setShowDeleted(false); setPage(1)
  }

  /* ── COMPACT SELECT STYLE ────────────────────────── */
  const cs = { padding:'2px 4px', fontSize:'0.72rem', width:'100%', border:'1px solid var(--border)', borderRadius:4, background:'var(--bg-elevated)', color:'var(--text-primary)' }

  return (
    <div className="page" style={{ padding:'16px 16px 32px' }}>

      {/* ── HEADER ── */}
      <div className="topbar" style={{ marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <h1 style={{ fontSize:'1.2rem' }}>Leads <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:400 }}>({total.toLocaleString()})</span></h1>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {isAdmin && (
            <>
              <label className="btn btn-primary btn-sm" style={{ cursor:'pointer', fontSize:'0.78rem' }}>
                <Upload size={13} /> {uploading ? 'Parsing…' : 'Upload'}
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFileChange} disabled={uploading} />
              </label>
              <label className="btn btn-secondary btn-sm" style={{ cursor:'pointer', fontSize:'0.78rem' }} title="Re-upload exported sheet with ID+Status+Remarks">
                <RefreshCcw size={13} /> Feedback Sync
                <input type="file" ref={fbInputRef} accept=".xlsx,.xls,.csv" hidden onChange={handleFeedbackSync} />
              </label>
              <button className="btn btn-secondary btn-sm" style={{ fontSize:'0.78rem' }} onClick={handleDownloadSelection}><Download size={13} /> Selection</button>
              <button className="btn btn-secondary btn-sm" style={{ fontSize:'0.78rem' }} onClick={handleDownloadAll}><Download size={13} /> Export All</button>
            </>
          )}
        </div>
      </div>

      {/* ── FILTER BAR (2 compact rows) ── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
        {/* Row 1 */}
        <div className="search-box" style={{ flex:'1 1 160px', minWidth:140 }}>
          <Search size={13} />
          <input className="form-input" style={{ fontSize:'0.8rem', padding:'5px 8px' }}
            placeholder="ID, phone, name…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ flex:'0 0 120px', fontSize:'0.78rem', padding:'4px 6px' }} value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {isAdmin && (
          <select className="form-select" style={{ flex:'0 0 120px', fontSize:'0.78rem', padding:'4px 6px' }} value={project}
            onChange={e => { setProject(e.target.value); setPage(1) }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}
        <select className="form-select" style={{ flex:'0 0 118px', fontSize:'0.78rem', padding:'4px 6px' }} value={device}
          onChange={e => { setDevice(e.target.value); setPage(1) }}>
          {DEVICES.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
        </select>
        <input type="date" className="form-input" style={{ flex:'0 0 120px', fontSize:'0.78rem', padding:'4px 6px' }}
          value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} title="From date" />
        <input type="date" className="form-input" style={{ flex:'0 0 120px', fontSize:'0.78rem', padding:'4px 6px' }}
          value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} title="To date" />
        {/* Flag buttons */}
        <button className={`btn btn-sm ${isNri ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize:'0.75rem' }}
          onClick={() => { setIsNri(v => !v); setPage(1) }}><Globe size={12} /> NRI</button>
        <button className={`btn btn-sm ${showDuplicates ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize:'0.75rem' }}
          onClick={() => { setShowDuplicates(v => !v); setPage(1) }}><RefreshCw size={12} /> Dups</button>
        {isAdmin && (
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-secondary'}`} style={{ fontSize:'0.75rem' }}
            onClick={() => { setShowDeleted(v => !v); setPage(1) }}>
            <Trash2 size={12} /> {showDeleted ? 'Trash View' : 'Trash'}
          </button>
        )}
        <select className="form-select" style={{ flex:'0 0 90px', fontSize:'0.78rem', padding:'4px 6px' }} value={limit}
          onChange={e => { setLimit(parseInt(e.target.value)); setPage(1) }}>
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n}/pg</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" style={{ fontSize:'0.75rem' }} onClick={resetFilters} title="Reset filters">↺ Reset</button>
      </div>

      {/* ── BULK / ADMIN TOOLS ── */}
      {isAdmin && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:10 }}>
          {selected.length > 0 && (
            <>
              <span style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--accent)' }}>{selected.length} sel.</span>
              {!showDeleted && <button className="btn btn-danger btn-sm" style={{ fontSize:'0.75rem' }} onClick={() => setDeleteConfirm({ mode:'bulk', ids:selected })}><Trash2 size={12}/> Trash</button>}
              {showDeleted  && <button className="btn btn-danger btn-sm" style={{ fontSize:'0.75rem' }} onClick={() => setDeleteConfirm({ mode:'purge', ids:selected })}><Trash2 size={12}/> Purge</button>}
              {showDuplicates && <button className="btn btn-sm" style={{ fontSize:'0.75rem', background:'var(--primary-light)', color:'var(--accent)' }} onClick={handleMerge} disabled={merging}><GitMerge size={12}/> Merge</button>}
              <button className="btn btn-secondary btn-sm" style={{ fontSize:'0.75rem' }} onClick={() => setSelected([])}><X size={12}/></button>
              <span style={{ borderLeft:'1px solid var(--border)', height:20, margin:'0 4px' }}/>
            </>
          )}
          {!showDeleted && (
            <>
              <select className="form-select" style={{ fontSize:'0.78rem', padding:'3px 6px', width:160 }} id="del-proj-sel" defaultValue="">
                <option value="">Delete by Project…</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <button className="btn btn-danger btn-sm" style={{ fontSize:'0.75rem' }} onClick={() => {
                const s = document.getElementById('del-proj-sel').value
                if (!s) { toast.error('Select a project.'); return }
                setDeleteConfirm({ mode:'project', project: s })
              }}><Trash2 size={12}/> Del All</button>
            </>
          )}
          {showDeleted && (
            <button className="btn btn-danger btn-sm" style={{ fontSize:'0.75rem' }} onClick={() => setDeleteConfirm({ mode:'purge_all' })}>
              <Trash2 size={12}/> Purge Entire Trash
            </button>
          )}
        </div>
      )}

      {/* ── TABLE ── */}
      <div style={{ width:'100%', overflowX:'auto' }}>
        <table style={{ tableLayout:'fixed', width:'100%', borderCollapse:'collapse' }}>
          <colgroup>
            {isAdmin && <col style={{ width:30 }} />}
            <col style={{ width:40 }} />
            <col style={{ width:95 }} />
            <col style={{ width:95 }} />
            {isAdmin && <col style={{ width:120 }} />}
            <col style={{ width:72 }} />
            <col style={{ width:115 }} />
            <col style={{ width:90 }} />
            <col style={{ width:60 }} />
            <col style={{ width:85 }} />
            <col style={{ width:90 }} />
            <col style={{ width:90 }} />
            <col style={{ width:76 }} />
          </colgroup>
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ ...thStyle, width:30 }}>
                  <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0 }} onClick={toggleAll}>
                    {selected.length === leads.length && leads.length > 0 ? <CheckSquare size={14}/> : <Square size={14}/>}
                  </button>
                </th>
              )}
              <Th label="ID"   col="id"   width={40}  sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} style={thStyle}/>
              <Th label="Name" col="name" width={95}  sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} style={thStyle}/>
              <th style={{ ...thStyle, width:95 }}>Phone</th>
              {isAdmin && <Th label="Assigned" col="assigned" width={120} sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} style={thStyle}/>}
              <Th label="Date" col="date" width={72}  sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} style={thStyle}/>
              <th style={{ ...thStyle, width:115 }}>Status</th>
              <th style={{ ...thStyle, width:90 }}>Device</th>
              <th style={{ ...thStyle, width:60 }}>Country</th>
              <th style={{ ...thStyle, width:85 }}>IP</th>
              <th style={{ ...thStyle, width:90 }}>URL</th>
              <th style={{ ...thStyle, width:90 }}>Remarks</th>
              <th style={{ ...thStyle, width:76 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 13 : 10} style={{ textAlign:'center', padding:32 }}>
                <div className="spinner" style={{ margin:'0 auto' }} />
              </td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={isAdmin ? 13 : 10}>
                <div className="empty-state" style={{ padding:32 }}>
                  <FileText size={32} /><h3>No leads found</h3>
                  <button className="btn btn-secondary btn-sm" onClick={resetFilters}>Clear Filters</button>
                </div>
              </td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id} className={lead.is_duplicate ? 'is-duplicate' : ''}>
                {isAdmin && (
                  <td style={{ padding:'6px 4px', textAlign:'center' }}>
                    <button style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                      color: selected.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)' }}
                      onClick={() => toggleSelect(lead.id)}>
                      {selected.includes(lead.id) ? <CheckSquare size={14}/> : <Square size={14}/>}
                    </button>
                  </td>
                )}
                <td style={{ ...tdStyle, color:'var(--text-muted)', fontSize:'0.7rem' }}>#{lead.id}</td>
                <td style={{ ...tdStyle }} title={lead.name || ''}><strong style={{ fontSize:'0.76rem' }}>{fmt(lead.name)}</strong></td>
                <td style={{ ...tdStyle }}>
                  {lead.phone
                    ? <a href={`tel:${lead.phone}`} style={{ color:'var(--primary)', fontWeight:600, fontSize:'0.76rem', textDecoration:'none' }}>{lead.phone}</a>
                    : '—'}
                </td>
                {isAdmin && (
                  <td style={{ padding:'4px 6px' }}>
                    <select style={cs} value={lead.assigned_to || ''} onChange={e => quickAssign(lead.id, e.target.value)}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                )}
                <td style={{ ...tdStyle, fontSize:'0.7rem' }}>{fmtDate(lead.created_at)}</td>
                <td style={{ padding:'4px 6px' }}>
                  <select style={cs} value={lead.status || 'New'} onChange={e => quickStatus(lead.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ ...tdStyle, fontSize:'0.7rem' }} title={lead.device || ''}>{fmt(lead.device)}</td>
                <td style={{ ...tdStyle, fontSize:'0.7rem' }} title={lead.country || ''}>{fmt(lead.country)}</td>
                <td style={{ ...tdStyle, fontSize:'0.68rem', color:'var(--text-muted)' }} title={lead.ip_address || ''}>{fmt(lead.ip_address)}</td>
                <td style={{ ...tdStyle, fontSize:'0.7rem' }}>
                  {lead.refer_url
                    ? <a href={lead.refer_url} target="_blank" rel="noreferrer" style={{ color:'var(--primary)', fontSize:'0.7rem' }} title={lead.refer_url}>
                        {lead.refer_url.replace(/^https?:\/\//, '').slice(0, 22)}…
                      </a>
                    : '—'}
                </td>
                <td style={{ ...tdStyle }} title={lead.remark || ''}>{fmt(lead.remark)}</td>
                <td style={{ padding:'4px 6px' }}>
                  <div style={{ display:'flex', gap:3 }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding:'3px 5px' }} title="Timeline" onClick={() => openTimeline(lead)}><Eye size={11}/></button>
                    {!showDeleted && <button className="btn btn-secondary btn-sm" style={{ padding:'3px 5px' }} title="Edit" onClick={() => { setFeedbackModal(lead); setFeedbackForm({ status: lead.status||'New', remark: lead.remark||'' }) }}>✏️</button>}
                    {isAdmin && !showDeleted && <button className="btn btn-danger btn-sm" style={{ padding:'3px 5px' }} title="Trash" onClick={() => setDeleteConfirm({ mode:'single', ids:[lead.id] })}><Trash2 size={11}/></button>}
                    {isAdmin && showDeleted  && <button className="btn btn-danger btn-sm" style={{ padding:'3px 5px' }} title="Purge" onClick={() => setDeleteConfirm({ mode:'purge', ids:[lead.id] })}><Trash2 size={11}/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PAGINATION ── */}
      <div className="pagination" style={{ marginTop:12, gap:4 }}>
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}><ChevronLeft size={14}/></button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = totalPages <= 7 ? i+1 : page <= 4 ? i+1 : page+i-3
          if (p < 1 || p > totalPages) return null
          return <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} style={{ fontSize:'0.78rem' }} onClick={() => setPage(p)}>{p}</button>
        })}
        <button className="page-btn" disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p+1)}><ChevronRight size={14}/></button>
        <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginLeft:8 }}>
          {page}/{totalPages} · {total.toLocaleString()}
        </span>
      </div>

      {/* ══ MODAL: Upload Preview ══════════════════════════════════ */}
      {previewData && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📤 Upload Preview — {previewData.total_rows} rows</h3>
              <button className="modal-close" onClick={() => setPreviewData(null)}><X size={18}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Project Name <span style={{ color:'var(--danger)' }}>*</span></label>
                <input className="form-input" list="proj-list-ul" placeholder="Type or select…" value={projName} onChange={e => setProjName(e.target.value)} />
                <datalist id="proj-list-ul">
                  {(previewData.hidden_values || []).map(v => <option key={v} value={v}/>)}
                  {projects.map(p => <option key={p.id} value={p.name}/>)}
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
                <thead><tr><th>#</th><th>Phone</th><th>Name</th><th>Hidden Field</th><th>Country</th><th>Device</th><th>IP</th><th>URL</th></tr></thead>
                <tbody>
                  {(previewData.preview || []).map((row, i) => (
                    <tr key={i}>
                      <td>{i+1}</td><td>{row.phone||'—'}</td><td>{row.name||'—'}</td>
                      <td>{row.hidden_field||row.project||'—'}</td>
                      <td>{row.country||'—'}</td><td>{row.device||'—'}</td>
                      <td style={{ fontSize:'0.72rem' }}>{row.ip_address||'—'}</td>
                      <td className="truncate" style={{ maxWidth:100 }}>{row.refer_url||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.total_rows > 20 && <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', marginTop:6 }}>Showing 20 of {previewData.total_rows}. All imported on confirm.</p>}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewData(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmUpload} disabled={confirming}>
                {confirming ? 'Saving…' : `✅ Confirm (${previewData.total_rows} rows)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Timeline ══════════════════════════════════════ */}
      {timelineModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>📋 Timeline — {timelineModal.phone}</h3>
              <button className="modal-close" onClick={() => setTimelineModal(null)}><X size={18}/></button>
            </div>
            <div style={{ marginBottom:10, fontSize:'0.82rem' }}>
              <strong>{timelineModal.name}</strong>
              {timelineModal.project   && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· {timelineModal.project}</span>}
              {timelineModal.country   && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· 🌐 {timelineModal.country}</span>}
              {timelineModal.device    && <span style={{ marginLeft:8, color:'var(--text-muted)' }}>· 📱 {timelineModal.device}</span>}
              {timelineModal.ip_address && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>IP: {timelineModal.ip_address}</div>}
              {timelineModal.refer_url  && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>🔗 {timelineModal.refer_url}</div>}
            </div>
            {timeline.length === 0
              ? <div className="empty-state" style={{ padding:20 }}><p>No timeline events yet.</p></div>
              : <div className="timeline">
                  {timeline.map(ev => (
                    <div key={ev.id} className="timeline-item">
                      <div className="timeline-dot"/>
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

      {/* ══ MODAL: Feedback ══════════════════════════════════════ */}
      {feedbackModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>✏️ Update — {feedbackModal.phone}</h3>
              <button className="modal-close" onClick={() => setFeedbackModal(null)}><X size={18}/></button>
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
                onChange={e => setFeedbackForm(f => ({ ...f, remark: e.target.value }))}/>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setFeedbackModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitFeedback}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Delete Confirm ════════════════════════════════ */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ color:'var(--danger)' }}><AlertTriangle size={16} style={{ marginRight:6 }}/>Confirm</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18}/></button>
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
