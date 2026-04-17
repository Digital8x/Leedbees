import { useEffect, useState } from 'react'
import { getStats } from '../api/axios.js'
import { Users, Upload, GitBranch, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, MapPin } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  'New':'#06b6d4','Assigned':'#7c3aed','Called':'#a855f7',
  'Interested':'#10b981','Follow Up':'#f59e0b','Site Visit':'#8b5cf6',
  'Booked':'#34d399','Not Interested':'#ef4444','Wrong Number':'#6b7280'
}
const PIE_COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#a855f7','#8b5cf6','#34d399','#6b7280','#f97316']

export default function Dashboard() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('lead8x_user') || '{}')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getStats()
      setStats(res.data.data)
    } catch { toast.error('Failed to load dashboard stats.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div>
      <div className="topbar"><h1>Dashboard</h1></div>
      <div className="loading-overlay"><div className="spinner"/><span>Loading stats…</span></div>
    </div>
  )

  const ov = stats?.overview || {}

  return (
    <div>
      <div className="topbar">
        <h1>Dashboard</h1>
        <div className="topbar-actions">
          <span style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Welcome, <strong>{user.name}</strong> · {user.role}</span>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14}/> Refresh</button>
        </div>
      </div>

      <div className="page">
        {/* KPI cards */}
        <div className="grid grid-4 mb-6">
          {[
            { label:'Total Leads',    value: ov.total_leads?.toLocaleString(),     icon: Upload,        color:'#7c3aed', sub: `${ov.duplicate_leads || 0} duplicates` },
            { label:'Assigned',       value: ov.assigned_leads?.toLocaleString(),  icon: GitBranch,     color:'#10b981', sub: `${ov.unassigned_leads || 0} unassigned` },
            { label:'Active Users',   value: ov.total_users?.toLocaleString(),     icon: Users,         color:'#06b6d4', sub: 'Online team' },
            { label:'Duplicates',     value: ov.duplicate_leads?.toLocaleString(), icon: AlertTriangle, color:'#f59e0b', sub: 'Re-uploaded leads' },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div className="stat-card" key={i}>
                <div className="stat-icon" style={{ background: item.color + '22' }}>
                  <Icon size={22} color={item.color}/>
                </div>
                <div className="stat-content">
                  <div className="stat-value" style={{ color: item.color }}>{item.value ?? '–'}</div>
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-sub">{item.sub}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-2 mb-6">
          {/* Status Breakdown Chart */}
          <div className="card">
            <div className="section-title"><TrendingUp size={18} color="var(--accent)"/> Status Breakdown</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.status_breakdown || []} barSize={30}>
                <XAxis dataKey="status" tick={{fill:'var(--text-muted)',fontSize:11}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fill:'var(--text-muted)',fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip
                  contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:12 }}
                  cursor={{ fill:'rgba(124,58,237,0.08)' }}
                />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {(stats?.status_breakdown || []).map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || '#7c3aed'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Location Distribution Pie Chart */}
          <div className="card">
            <div className="section-title"><MapPin size={18} color="var(--accent)"/> Location Distribution</div>
            {(stats?.location_breakdown || []).length === 0
              ? <div className="empty-state"><p>No location data yet.</p></div>
              : <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={stats.location_breakdown}
                      dataKey="count"
                      nameKey="location"
                      cx="50%" cy="50%"
                      outerRadius={75}
                      label={({ location, percent }) => `${location} ${(percent*100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {stats.location_breakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:12 }}
                      formatter={(val) => [val + ' leads']}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.73rem', color: 'var(--text-muted)' }} />
                  </PieChart>
                </ResponsiveContainer>
            }
          </div>

          {/* Recent Batches */}
          <div className="card">
            <div className="section-title"><Upload size={18} color="var(--accent)"/> Recent Uploads</div>
            {(stats?.recent_batches || []).length === 0
              ? <div className="empty-state"><p>No batches yet.</p></div>
              : <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Batch ID</th><th>Source</th><th>Total</th><th>Dups</th><th>Date</th></tr></thead>
                    <tbody>
                      {stats.recent_batches.map((b,i) => (
                        <tr key={i}>
                          <td style={{fontFamily:'monospace',fontSize:'0.78rem'}}>{b.batch_id}</td>
                          <td>{b.source || '–'}</td>
                          <td><strong>{b.total}</strong></td>
                          <td style={{color:'var(--warning)'}}>{b.duplicates}</td>
                          <td className="text-muted text-xs">{new Date(b.uploaded_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>

        {/* Team Performance */}
        <div className="card">
          <div className="section-title"><CheckCircle size={18} color="var(--accent)"/> Team Performance</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>#</th><th>Name</th><th>Role</th><th>Total Leads</th><th>Interested</th><th>Booked</th><th>Conversion</th></tr>
              </thead>
              <tbody>
                {(stats?.user_stats || []).map((u, i) => {
                  const conv = u.total_leads > 0 ? ((u.booked / u.total_leads) * 100).toFixed(1) : 0
                  return (
                    <tr key={u.id}>
                      <td className="text-muted text-xs">{i+1}</td>
                      <td><strong>{u.name}</strong></td>
                      <td><span className={`role-badge role-${u.role.replace(' ','')}`}>{u.role}</span></td>
                      <td>{u.total_leads}</td>
                      <td style={{color:'var(--success)'}}>{u.interested}</td>
                      <td style={{color:'var(--accent)',fontWeight:700}}>{u.booked}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div className="progress-bar" style={{width:80}}>
                            <div className="progress-fill" style={{width:`${conv}%`}}/>
                          </div>
                          <span className="text-xs text-muted">{conv}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
