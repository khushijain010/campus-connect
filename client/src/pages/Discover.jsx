import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, X, Sparkles, BookOpen, Hammer, Trophy, Users2, CalendarDays, UserRoundSearch } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Empty, Spinner, useApi } from '../components/ui.jsx';
import { ActivityCard, CommunityTile, PersonCard } from '../components/cards.jsx';
import Row from '../components/Row.jsx';
import AddEventModal from '../components/AddEventModal.jsx';

const FILTER_KEYS = [
  ['time', 'Time', 'timeSlots'], ['date', 'Date', 'dateFilters'], ['location', 'Location', 'locations'],
  ['size', 'Group Size', 'groupSizes'], ['level', 'Level', 'levels'],
];

const patchIn = (setData, key) => (item) => setData((d) => ({ ...d, [key]: d[key].map((x) => (x.id === item.id ? { ...x, ...item } : x)) }));

function useActivities(kind, reloadKey) {
  return useApi(() => api.get(`/activities${qs({ kind, sort: 'recommended' })}`), [kind, reloadKey]);
}

/** A sliding row of activity posters for one kind. */
function ActivityRowSection({ h, title, sub, icon, action, empty = 'Nothing open right now — add one!' }) {
  if (h.loading) return <Row title={title} sub={sub} icon={icon} action={action} empty={<Spinner />} />;
  const list = h.data?.activities || [];
  return (
    <Row title={title} sub={sub} icon={icon} action={action} empty={list.length ? null : empty}>
      {list.map((a) => <ActivityCard key={a.id} activity={a} onChange={patchIn(h.setData, 'activities')} />)}
    </Row>
  );
}

export default function Discover() {
  const { options } = useAuth();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [commCat, setCommCat] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebounced(term.trim()), 250); return () => clearTimeout(t); }, [term]);
  useEffect(() => { if (params.get('tab') === 'communities') setTimeout(() => document.getElementById('communities')?.scrollIntoView({ behavior: 'smooth' }), 300); }, [params]);

  const activeFilters = Object.values(filters).reduce((n, v) => n + v.length, 0);
  const searching = !!(debounced || category || activeFilters);
  const query = useMemo(() => ({ q: debounced, category, ...filters }), [debounced, category, filters]);
  const results = useApi(() => (searching ? api.get(`/activities${qs({ ...query, sort: 'recommended' })}`) : Promise.resolve(null)), [JSON.stringify(query), searching, reloadKey]);
  const peopleRes = useApi(() => (debounced ? api.get(`/search${qs({ q: debounced, type: 'people' })}`) : Promise.resolve(null)), [debounced]);

  const rec = useApi(() => api.get('/recommendations'));
  const study = useActivities('study', reloadKey);
  const projects = useActivities('project', reloadKey);
  const sports = useActivities('sports', reloadKey);
  const events = useActivities('event', reloadKey);
  const comms = useApi(() => api.get(`/communities${qs({ category: commCat })}`), [commCat]);

  const toggleFilter = (key, v) => setFilters((f) => {
    const cur = f[key] || [];
    return { ...f, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  });
  const clearAll = () => { setFilters({}); setCategory(''); setTerm(''); setParams({}); };
  const recPicks = rec.data ? [...(rec.data.events || []).slice(0, 5), ...(rec.data.teams || []).slice(0, 3)] : [];
  const patchRec = (n) => rec.setData((d) => ({ ...d, events: d.events.map((x) => (x.id === n.id ? n : x)), teams: d.teams.map((x) => (x.id === n.id ? n : x)) }));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Discover</h1><p className="page-sub">Find people, teams, groups and activities on campus.</p></div>
        <button className="btn btn-primary btn-lg" onClick={() => setAdding(true)}><Plus size={18} />Add Event</button>
      </div>

      <div className="card card-pad stack" style={{ gap: 14, marginBottom: 26 }}>
        <div className="row">
          <div className="input-icon grow"><Search size={18} />
            <input className="input" style={{ height: 46, borderRadius: 999, background: 'var(--surface-2)', borderColor: 'transparent' }}
              placeholder="Search study groups, teams, sports, events, people…" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <button className={`btn btn-lg ${showFilters || activeFilters ? 'btn-soft' : 'btn-outline'}`} style={{ borderRadius: 999 }} onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal size={17} /><span>Filters</span>{activeFilters ? <span className="badge">{activeFilters}</span> : null}
          </button>
        </div>
        <div className="chips">
          {(options?.discoverCategories || []).map((c) => <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(category === c ? '' : c)}>{c}</button>)}
          {searching ? <button className="chip" onClick={clearAll}><X size={14} />Clear</button> : null}
        </div>
        {showFilters ? (
          <div className="grid-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            {FILTER_KEYS.map(([key, label, optKey]) => (
              <div key={key} className="filter-group">
                <span className="label">{label}</span>
                <div className="chips">
                  {(options?.[optKey] || []).map((v) => (
                    <button key={v} className={`chip ${filters[key]?.includes(v) ? 'soft-on' : ''}`} style={{ height: 30 }} onClick={() => toggleFilter(key, v)}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="filter-group">
              <span className="label">Department</span>
              <select className="select" value={filters.department?.[0] || ''} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value ? [e.target.value] : [] }))}>
                <option value="">Any department</option>
                {(options?.departmentInfo || []).map((d) => <option key={d.value} value={d.value}>{d.name}</option>)}
              </select>
            </div>
          </div>
        ) : null}
      </div>

      {searching ? (
        <div className="stack" style={{ gap: 8 }}>
          {peopleRes.data?.people?.length ? (
            <Row title="People" icon={UserRoundSearch} size="lg">
              {peopleRes.data.people.map((u) => <PersonCard key={u.id} match={{ user: u, reasons: [`${u.department} · ${u.year} year`] }} />)}
            </Row>
          ) : null}
          <section className="slide-row">
            <div className="slide-head">
              <div><h2 className="slide-title">Matching activities</h2>{results.data ? <div className="card-sub">{results.data.activities.length} found · sorted by how well they fit you</div> : null}</div>
            </div>
            {results.loading ? <Spinner /> : results.data?.activities.length ? (
              <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', paddingTop: 14 }}>
                {results.data.activities.map((a) => <ActivityCard key={a.id} activity={a} onChange={patchIn(results.setData, 'activities')} />)}
              </div>
            ) : <div className="card"><Empty title="No activities match">Try removing a filter, or add your own event.</Empty></div>}
          </section>
        </div>
      ) : (
        <div>
          {rec.loading ? <Row title="Recommended For You" icon={Sparkles} empty={<Spinner />} /> : (
            <Row title="Recommended For You" icon={Sparkles} sub="Based on your interests, courses, skills, hobbies, availability and past activities">
              {recPicks.map((a) => <ActivityCard key={a.id} activity={a} onChange={patchRec} />)}
            </Row>
          )}
          {rec.data?.people?.length ? (
            <Row title="People you'd connect with" icon={UserRoundSearch} sub="Common interests, compatible preferences, different backgrounds" size="lg">
              {rec.data.people.map((m) => <PersonCard key={m.user.id} match={m} />)}
            </Row>
          ) : null}
          <ActivityRowSection h={study} title="Study Partner" icon={BookOpen} sub="Find people to study or prepare with: DSP, DSA, OS, DBMS, ML, Mathematics" />
          {rec.data?.studyPartners?.length ? (
            <Row title="Study partners for your courses" icon={UserRoundSearch} size="lg">
              {rec.data.studyPartners.map((m) => <PersonCard key={m.user.id} match={m} />)}
            </Row>
          ) : null}
          <ActivityRowSection h={projects} title="Project / Team Formation" icon={Hammer} sub="Create or join project teams"
            action={<button className="btn btn-soft btn-sm" onClick={() => setAdding('Project')}><Plus size={15} />Start a project</button>} />
          <ActivityRowSection h={sports} title="Sports / Activity Groups" icon={Trophy} sub="Football, cricket, basketball, badminton, cycling, running" />
          <ActivityRowSection h={events} title="Events & Hobbies" icon={CalendarDays} sub="Photowalks, game nights, workshops and more" />
          <Row id="communities" title="General Communities" icon={Users2} sub="Permanent communities based on interests and activities" size="sm"
            action={(
              <select className="select" style={{ height: 36, width: 'auto', borderRadius: 999 }} value={commCat} onChange={(e) => setCommCat(e.target.value)} aria-label="Community category">
                <option value="">All categories</option>
                {(options?.communityCategories || []).map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            empty={comms.loading ? <Spinner /> : comms.data?.communities.length ? null : 'No communities in this category yet.'}>
            {(comms.data?.communities || []).map((c) => <CommunityTile key={c.id} community={c} onChange={patchIn(comms.setData, 'communities')} />)}
          </Row>
        </div>
      )}
      {adding ? <AddEventModal preset={typeof adding === 'string' ? { type: adding } : {}} onClose={() => setAdding(false)} onCreated={() => setReloadKey((k) => k + 1)} /> : null}
    </div>
  );
}
