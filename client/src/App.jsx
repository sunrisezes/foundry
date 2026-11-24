import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownUp, ArrowRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, Clock3, FileText, Filter,
  KeyRound, LayoutGrid, LogOut, Mail, MapPin, MessageCircle, Package, Pencil, Plus, Search, Send, ShieldCheck,
  Sparkles, Upload, UserRound, X
} from 'lucide-react';
import { api, imageUrl } from './api.js';

const categories = ['Electronics', 'ID & Cards', 'Bags & Wallets', 'Keys', 'Bottles & Accessories', 'Books & Notes', 'Other'];
const zones = ['Library', 'Student Center', 'Science Building', 'Engineering Building', 'Arts Building', 'Administration', 'Sports Complex', 'Residence Hall', 'Dining Hall', 'Other'];

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('campus-user') || 'null'); } catch { return null; }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const pendingAction = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('campus-token')) return;
    api('/auth/me').then(({ user: current }) => {
      setUser(current);
      localStorage.setItem('campus-user', JSON.stringify(current));
    }).catch(() => {
      localStorage.removeItem('campus-token');
      localStorage.removeItem('campus-user');
      setUser(null);
    });
  }, []);

  useEffect(() => {
    if (location.state?.notice) {
      setToast(location.state.notice);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const signOut = () => {
    localStorage.removeItem('campus-token');
    localStorage.removeItem('campus-user');
    setUser(null);
    setToast('You have signed out.');
  };
  const onAuth = (session) => {
    localStorage.setItem('campus-token', session.token);
    localStorage.setItem('campus-user', JSON.stringify(session.user));
    setUser(session.user);
    setAuthOpen(false);
    setToast(`Welcome, ${session.user.name.split(' ')[0]}.`);
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };
  const requireAuth = (action) => {
    if (!user) {
      pendingAction.current = action || null;
      setAuthOpen(true);
      return;
    }
    action?.();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span className="brand-mark"><Package size={19} strokeWidth={2.2} /></span>
            <span>foundry<span className="brand-period">.</span></span>
          </Link>
          <nav id="main-navigation" className="main-nav" aria-label="Main navigation">
            <NavLink end to="/">Discover</NavLink>
            <NavLink to="/matches">My matches</NavLink>
            <NavLink to="/claims">Claims</NavLink>
            <NavLink to="/my-items">My reports</NavLink>
            <div className="mobile-nav-extra">
              <span>ABOUT & SUPPORT</span>
              <NavLink to="/about">About us</NavLink>
              <NavLink to="/how-it-works">How it works</NavLink>
              <NavLink to="/contact">Contact us</NavLink>
              <NavLink to="/privacy">Privacy policy</NavLink>
              <NavLink to="/terms">Terms & conditions</NavLink>
              {user?.role === 'admin' && <><NavLink to="/admin/reports">Manage reports</NavLink><NavLink to="/admin/contact">Contact inbox</NavLink></>}
            </div>
          </nav>
          <div className="top-actions">
            {user ? (
              <>
                <button className="icon-button notification-button" aria-label="Open claims" title="Open claims" onClick={() => navigate('/claims')}>
                  <Bell size={18} />
                </button>
                <div className="user-chip"><span className="avatar">{initials(user.name)}</span><span>{user.name.split(' ')[0]}</span></div>
                <button className="signout-button" onClick={signOut} title="Sign out"><LogOut size={17} /></button>
              </>
            ) : <button className="button button-outline login-button" onClick={() => setAuthOpen(true)}>Log in</button>}
            <button className="button button-primary top-report" onClick={() => requireAuth(() => setReportOpen(true))}>
              <Plus size={16} /> Report an item
            </button>
          </div>
        </div>
      </header>

      <main className="page-container">
        <Routes>
          <Route path="/" element={<Discover user={user} onRequireAuth={requireAuth} onReport={() => requireAuth(() => setReportOpen(true))} setToast={setToast} />} />
          <Route path="/matches" element={<Matches user={user} onRequireAuth={requireAuth} setToast={setToast} />} />
          <Route path="/claims" element={<Claims user={user} onRequireAuth={requireAuth} setToast={setToast} />} />
          <Route path="/my-items" element={<MyItems user={user} onRequireAuth={requireAuth} setToast={setToast} />} />
          <Route path="/admin/reports" element={<AdminReports user={user} onRequireAuth={requireAuth} setToast={setToast} />} />
          <Route path="/about" element={<InfoPage page="about" />} />
          <Route path="/how-it-works" element={<InfoPage page="how-it-works" />} />
          <Route path="/privacy" element={<InfoPage page="privacy" />} />
          <Route path="/terms" element={<InfoPage page="terms" />} />
          <Route path="/contact" element={<ContactPage user={user} />} />
          <Route path="/admin/contact" element={<ContactInbox user={user} onRequireAuth={requireAuth} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Link className="brand" to="/"><span className="brand-mark"><Package size={17} /></span><span>foundry<span className="brand-period">.</span></span></Link>
            <p>A campus community helping lost things find their way back.</p>
          </div>
          <nav className="footer-nav" aria-label="Explore">
            <h2>Explore</h2>
            <NavLink end to="/">Discover reports</NavLink>
            <NavLink to="/matches">My matches</NavLink>
            <NavLink to="/claims">Claims & messages</NavLink>
            <NavLink to="/my-items">My reports</NavLink>
          </nav>
          <nav className="footer-nav" aria-label="About and support">
            <h2>About & support</h2>
            <NavLink to="/about">About us</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/contact">Contact us</NavLink>
            {user?.role === 'admin' && <><NavLink to="/admin/reports">Manage reports</NavLink><NavLink to="/admin/contact">Contact inbox</NavLink></>}
          </nav>
          <nav className="footer-nav" aria-label="Policies">
            <h2>Policies</h2>
            <NavLink to="/privacy">Privacy policy</NavLink>
            <NavLink to="/terms">Terms & conditions</NavLink>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Foundry Campus Lost & Found</span>
          <span><ShieldCheck size={14} /> A safer way to find your way back to it.</span>
        </div>
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuth={onAuth} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} onCreated={(matches) => {
        setReportOpen(false);
        setToast(matches.length ? `${matches.length} potential ${matches.length === 1 ? 'match' : 'matches'} found.` : 'Your report is live. We’ll keep looking for a match.');
      }} />}
      {toast && <div role="status" className="toast"><Check size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function Discover({ user, onRequireAuth, onReport, setToast }) {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: '', type: '', category: '', locationTag: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [claimItem, setClaimItem] = useState(null);
  const [sortNewest, setSortNewest] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    api(`/items?${query.toString()}`).then(({ items: found }) => {
      if (active) setItems(found);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, refresh]);

  const displayed = useMemo(() => [...items].sort((a, b) => sortNewest
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : new Date(a.createdAt) - new Date(b.createdAt)), [items, sortNewest]);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> THE CAMPUS COMMUNITY LOST & FOUND</div>
          <h1>Lost something?<br /><em>Let’s find it.</em></h1>
          <p>One photo can bring it back. Browse what’s been found or post a report — our visual matcher looks for the connection.</p>
          <div className="hero-buttons">
            <button className="button button-primary" onClick={onReport}><Plus size={17} /> Post a report</button>
            <a className="text-link" href="#browse">Browse items <ArrowRight size={16} /></a>
          </div>
          <div className="hero-proof"><span className="proof-avatars"><i>J</i><i>M</i><i>A</i></span><span><strong>Community powered</strong><small>Every report brings us closer.</small></span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of a found backpack">
          <div className="art-sun" />
          <div className="art-card art-card-back"><span>FOUND</span><div className="art-lines"><i /><i /><i /></div></div>
          <div className="art-bag"><div className="bag-handle" /><div className="bag-flap"><span /></div><div className="bag-pocket" /><div className="bag-side" /></div>
          <div className="art-sparkle sparkle-one"><Sparkles size={18} /></div>
          <div className="art-sparkle sparkle-two"><Sparkles size={13} /></div>
          <div className="art-caption"><span className="caption-pin"><MapPin size={15} /></span><span><b>Found near the Library</b><small>Yesterday · 3:42 PM</small></span><span className="caption-arrow"><ArrowRight size={16} /></span></div>
          <div className="art-small-tag">a little help goes a long way</div>
        </div>
      </section>

      <section className="stats-strip">
        <div><span className="stat-icon mint"><Package size={17} /></span><span><b>Community finds</b><small>Shared by students, for students</small></span></div>
        <div><span className="stat-icon lavender"><Sparkles size={17} /></span><span><b>Visual matching</b><small>Photos help make the connection</small></span></div>
        <div><span className="stat-icon peach"><ShieldCheck size={17} /></span><span><b>Safer handovers</b><small>Verified claims, on your terms</small></span></div>
      </section>

      <section id="browse" className="browse-section">
        <div className="section-heading">
          <div><div className="eyebrow eyebrow-dark">THE COMMUNITY BOARD</div><h2>Recently reported</h2><p>A little something might be yours.</p></div>
          <button className="button button-outline browse-report" onClick={onReport}><Plus size={16} /> Add a report</button>
        </div>
        <div className="filter-bar">
          <label className="search-field"><Search size={17} /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search items..." aria-label="Search items" /></label>
          <div className="filter-select"><Filter size={15} /><select aria-label="Filter by item type" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All reports</option><option value="lost">Lost items</option><option value="found">Found items</option></select><ChevronDown size={14} /></div>
          <div className="filter-select"><select aria-label="Filter by category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">Any category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={14} /></div>
          <div className="filter-select"><MapPin size={15} /><select aria-label="Filter by campus zone" value={filters.locationTag} onChange={(event) => setFilters({ ...filters, locationTag: event.target.value })}><option value="">Any location</option>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select><ChevronDown size={14} /></div>
          <button className="sort-button" onClick={() => setSortNewest(!sortNewest)} title="Change date order"><ArrowDownUp size={16} /><span>{sortNewest ? 'Newest' : 'Oldest'}</span></button>
        </div>
        {error ? <div className="empty-state error-empty-state"><span className="empty-illustration"><CircleHelp size={24} /></span><h3>Couldn’t load reports</h3><p>{error}</p><button className="button button-outline" onClick={() => setRefresh((value) => value + 1)}>Try again <ArrowRight size={15} /></button></div> :
          loading ? <div className="loading-grid">{[1, 2, 3, 4].map((x) => <div className="skeleton-card" key={x}><div /><span /><span /></div>)}</div> :
          displayed.length ? <div className="item-grid">{displayed.map((item) => <ItemCard key={item._id} item={item} onClick={() => setSelected(item)} />)}</div> :
          <div className="empty-state"><span className="empty-illustration"><Search size={25} /></span><h3>No reports found</h3><p>Try a different search, or post a report to get the community looking.</p><button className="button button-primary" onClick={onReport}><Plus size={16} /> Post a report</button></div>}
        {!loading && displayed.length > 0 && <div className="board-foot"><span>Showing {displayed.length} recent {displayed.length === 1 ? 'report' : 'reports'}</span><button className="text-link" onClick={() => setRefresh(refresh + 1)}>Refresh list <ArrowRight size={15} /></button></div>}
      </section>
      <section className="bottom-cta"><div className="cta-icon"><CircleHelp size={21} /></div><div><h3>Can’t find what you’re looking for?</h3><p>Post a lost item and let the campus community keep an eye out.</p></div><button className="button button-light" onClick={onReport}>Report a lost item <ArrowRight size={16} /></button></section>
      {selected && <ItemModal item={selected} user={user} onClose={() => setSelected(null)} onClaim={() => { setSelected(null); onRequireAuth(() => setClaimItem(selected)); }} />}
      {claimItem && <ClaimModal item={claimItem} onClose={() => setClaimItem(null)} onSubmitted={() => { setClaimItem(null); setToast('Your claim was sent to the reporter.'); }} />}
    </>
  );
}

function ItemCard({ item, onClick }) {
  const isFound = item.type === 'found';
  return (
    <button className="item-card" onClick={onClick}>
      <div className="item-image-wrap">
        <img src={imageUrl(item.imageUrl)} alt={item.title} loading="lazy" />
        <span className={`item-type ${isFound ? 'type-found' : 'type-lost'}`}><span />{isFound ? 'Found' : 'Lost'}</span>
        {item.status === 'resolved' && <span className="item-status status-pill status-resolved">Resolved</span>}
        <span className="image-open"><ArrowRight size={15} /></span>
      </div>
      <div className="item-card-content">
        <div className="item-meta"><span>{item.category}</span><span className="meta-dot" />{formatDate(item.itemDate)}</div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="item-card-footer"><span className="item-location"><MapPin size={14} />{item.locationTag}</span><span className="item-posted">{item.postedBy?.name ? `by ${item.postedBy.name.split(' ')[0]}` : 'Community'}</span></div>
      </div>
    </button>
  );
}

function ItemModal({ item, user, onClose, onClaim }) {
  const isOwner = user && item.postedBy?._id === user.id;
  return (
    <Modal onClose={onClose}>
      <div className="item-detail">
        <div className="detail-image"><img src={imageUrl(item.imageUrl)} alt={item.title} /><span className={`item-type ${item.type === 'found' ? 'type-found' : 'type-lost'}`}><span />{item.type}</span>{item.status === 'resolved' && <span className="item-status status-pill status-resolved">Resolved</span>}</div>
        <div className="detail-content">
          <div className="item-meta"><span>{item.category}</span><span className="meta-dot" />{formatDate(item.itemDate)}</div>
          <h2>{item.title}</h2><p className="detail-description">{item.description}</p>
          <div className="detail-info"><span><MapPin size={16} /><b>{item.locationTag}</b>{item.specificSpot && <small>{item.specificSpot}</small>}</span><span><UserRound size={16} /><b>{item.postedBy?.name || 'Campus community'}</b><small>Reported {formatDate(item.createdAt)}</small></span></div>
          {item.verificationQuestion && <div className="verification-hint"><ShieldCheck size={16} /><span><b>Verification question</b><small>{item.verificationQuestion}</small></span></div>}
          <div className="detail-actions">
            {item.status === 'resolved' && <p className="claim-note"><Check size={15} /> This report has been marked resolved.</p>}
            {item.status !== 'resolved' && item.type === 'found' && !isOwner && <button className="button button-primary button-full" onClick={onClaim}><ShieldCheck size={16} /> This might be mine</button>}
            {item.status !== 'resolved' && item.type === 'lost' && <p className="claim-note"><Sparkles size={15} /> Similar found reports may appear in My matches.</p>}
            {item.status !== 'resolved' && isOwner && <p className="claim-note"><Check size={15} /> This is your report.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ClaimModal({ item, onClose, onSubmitted }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/claims', { method: 'POST', body: JSON.stringify({ itemId: item._id, verificationAnswer: answer }) });
      onSubmitted();
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose}><form className="form-panel claim-form" onSubmit={submit}>
    <div className="modal-heading"><div className="modal-icon"><ShieldCheck size={19} /></div><div><div className="eyebrow eyebrow-dark">CLAIM AN ITEM</div><h2>Is this yours?</h2></div></div>
    <div className="claim-item-summary"><img src={imageUrl(item.imageUrl)} alt="" /><span><b>{item.title}</b><small>{item.locationTag} · {formatDate(item.itemDate)}</small></span></div>
    <p className="form-intro">Tell the reporter something that helps verify you’re the owner. Your answer is only shared with them.</p>
    <label className="field-label">{item.verificationQuestion || 'What details can help verify this item belongs to you?'}<textarea required minLength="3" maxLength="1000" rows="4" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Share a specific detail only the owner would know..." /></label>
    {error && <InlineError>{error}</InlineError>}
    <button className="button button-primary button-full" disabled={busy}>{busy ? 'Sending claim…' : 'Send claim request'} <ArrowRight size={16} /></button>
  </form></Modal>;
}

function Matches({ user, onRequireAuth, setToast }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api('/matches').then(({ matches: rows }) => { if (active) setMatches(rows); })
      .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, reload]);

  const updateMatch = async (match, status) => {
    try {
      await api(`/matches/${match._id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setToast(status === 'confirmed' ? 'Match confirmed — you can now coordinate a claim.' : 'Match dismissed.');
      setReload((value) => value + 1);
    } catch (e) { setError(e.message); }
  };
  if (!user) return <SignInPrompt title="Your matches, all in one place." detail="Sign in to see reports that look like the things you’ve lost or found." onClick={() => onRequireAuth()} />;
  return <div className="subpage">
    <PageHeader eyebrow="THE CONNECTIONS" title="Your matches" description="A visual clue could be the missing piece." icon={<Sparkles size={20} />} />
    {error && <ErrorBanner message={error} onRetry={() => setReload(reload + 1)} />}
    {loading ? <Loader /> : matches.length ? <div className="match-list">{matches.map((match) => {
      const mine = match.lostItem?.postedBy?._id === user.id ? match.lostItem : match.foundItem;
      const other = mine?._id === match.lostItem?._id ? match.foundItem : match.lostItem;
      if (!mine || !other) return null;
      return <article className="match-card" key={match._id}>
        <div className="match-images"><img src={imageUrl(mine.imageUrl)} alt={mine.title} /><span className="match-link-icon"><Sparkles size={15} /></span><img src={imageUrl(other.imageUrl)} alt={other.title} /></div>
        <div className="match-card-main"><div className="match-topline"><span className={`status-pill status-${match.status}`}>{match.status}</span><span className="match-date">{formatDate(match.createdAt)}</span></div><h3>{other.title}</h3><p>Looks similar to your <b>{mine.type}</b> report, “{mine.title}”.</p><div className="match-tags"><span><MapPin size={13} />{other.locationTag}</span><span><Sparkles size={13} />{other.category}</span></div></div>
        <div className="match-score"><b>{Math.round(match.totalScore * 100)}<small>%</small></b><span>match score</span><div className="score-progress"><i style={{ width: `${Math.round(match.totalScore * 100)}%` }} /></div></div>
        {match.status === 'pending' && <div className="match-actions"><button className="button button-outline button-small" onClick={() => updateMatch(match, 'dismissed')}>Not a match</button><button className="button button-primary button-small" onClick={() => updateMatch(match, 'confirmed')}>This could be it <ArrowRight size={14} /></button></div>}
      </article>;
    })}</div> : <div className="empty-state"><span className="empty-illustration"><Sparkles size={24} /></span><h3>No matches yet</h3><p>When your reports look like an item someone else posted, we’ll show the connection here.</p><Link className="button button-primary" to="/my-items">View my reports <ArrowRight size={15} /></Link></div>}
  </div>;
}

function Claims({ user, onRequireAuth, setToast }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api('/claims').then(({ claims: rows }) => { if (active) setClaims(rows); })
      .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, reload]);
  const mutate = async (claim, action, body) => {
    try {
      await api(`/claims/${claim._id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
      setToast(action === 'complete' ? 'Handover complete — the item is resolved.' : 'Message sent.');
      setReload((value) => value + 1);
    } catch (e) { setError(e.message); }
  };
  const decide = async (claim, status) => {
    try {
      await api(`/claims/${claim._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setToast(status === 'approved' ? 'Claim approved. Share the handover code with the claimant.' : 'Claim declined.');
      setReload((value) => value + 1);
    } catch (e) { setError(e.message); }
  };
  if (!user) return <SignInPrompt title="Keep the conversation going." detail="Sign in to manage claims, talk with reporters, and arrange a safe handover." onClick={() => onRequireAuth()} />;
  return <div className="subpage">
    <PageHeader eyebrow="SAFE HANDOVERS" title="Claims & messages" description="Review requests and coordinate the next step." icon={<MessageCircle size={20} />} />
    {error && <ErrorBanner message={error} onRetry={() => setReload(reload + 1)} />}
    {loading ? <Loader /> : claims.length ? <div className="claims-list">{claims.map((claim) => <ClaimCard key={claim._id} claim={claim} user={user} onDecide={decide} onAction={mutate} />)}</div> :
      <div className="empty-state"><span className="empty-illustration"><ShieldCheck size={24} /></span><h3>No active claims</h3><p>When someone claims an item you found — or you reach out about something that may be yours — it’ll show up here.</p><Link className="button button-outline" to="/">Explore the board <ArrowRight size={15} /></Link></div>}
  </div>;
}

function ClaimCard({ claim, user, onDecide, onAction }) {
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const isReporter = claim.ownerOrFinder?._id === user.id;
  const otherPerson = isReporter ? claim.claimant : claim.ownerOrFinder;
  const closed = ['rejected', 'completed'].includes(claim.status);
  const sendMessage = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    onAction(claim, 'messages', { text: message }).then(() => setMessage(''));
  };
  return <article className="claim-card">
    <div className="claim-card-top"><div className="claim-item-title"><img src={imageUrl(claim.item?.imageUrl)} alt="" /><span><b>{claim.item?.title || 'Item report'}</b><small>{isReporter ? 'Claim request received' : 'Your claim request'} · {formatDate(claim.createdAt)}</small></span></div><span className={`status-pill status-${claim.status}`}>{claim.status}</span></div>
    {isReporter && <div className="claim-answer"><b>{claim.claimant?.name} says:</b><p>{claim.verificationAnswer}</p></div>}
    {claim.status === 'pending' && isReporter && <div className="claim-decision"><button className="button button-outline button-small danger-outline" onClick={() => onDecide(claim, 'rejected')}>Decline</button><button className="button button-primary button-small" onClick={() => onDecide(claim, 'approved')}><Check size={14} /> Approve claim</button></div>}
    {claim.status === 'approved' && <div className="handover-box"><div><b><KeyRound size={15} /> Handover approved</b><p>{isReporter ? 'Share this one-time code with the claimant at handover.' : 'Enter the code shared by the reporter when you meet.'}</p>{isReporter && claim.handoverCode && <div className="handover-code">{claim.handoverCode}</div>}</div><form onSubmit={(event) => { event.preventDefault(); onAction(claim, 'complete', { handoverCode: code }); }}><label className="sr-only" htmlFor={`code-${claim._id}`}>Six-digit handover code</label><input id={`code-${claim._id}`} inputMode="numeric" pattern="\d{6}" maxLength="6" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit code" /><button className="button button-primary button-small">Complete handover</button></form></div>}
    <div className="conversation">
      <div className="conversation-heading"><MessageCircle size={15} /> Conversation with {otherPerson?.name || 'the reporter'}</div>
      {claim.messages?.length > 0 ? <div className="message-list">{claim.messages.map((entry, index) => <div className={`message ${String(entry.sender) === user.id ? 'message-own' : ''}`} key={`${entry.createdAt}-${index}`}><b>{entry.senderName}</b><p>{entry.text}</p><small>{formatDate(entry.createdAt)}</small></div>)}</div> : <p className="no-messages">No messages yet. Keep personal contact details private until you’re comfortable.</p>}
      {!closed && <form className="message-form" onSubmit={sendMessage}><input maxLength="1000" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" aria-label="Write a message" /><button className="icon-button send-button" aria-label="Send message" disabled={!message.trim()}><ArrowRight size={17} /></button></form>}
    </div>
  </article>;
}

function MyItems({ user, onRequireAuth, setToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editingItem, setEditingItem] = useState(null);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api('/items/mine').then(({ items: rows }) => { if (active) setItems(rows); })
      .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, refresh]);
  const updateStatus = async (item, status) => {
    try {
      await api(`/items/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setToast(status === 'resolved' ? 'Report marked as resolved.' : 'Report reopened.');
      setRefresh((value) => value + 1);
    } catch (e) { setError(e.message); }
  };
  const removeItem = async (item) => {
    if (!window.confirm(`Remove "${item.title}" from the public board? The report and deletion record will remain in the database.`)) return;
    try {
      await api(`/items/${item._id}`, { method: 'DELETE' });
      setToast('Report removed from the board. Its deletion is recorded.');
      setRefresh((value) => value + 1);
    } catch (e) { setError(e.message); }
  };
  const restoreItem = async (item) => {
    try {
      await api(`/items/${item._id}/restore`, { method: 'PATCH' });
      setToast('Report restored to your reports.');
      setRefresh((value) => value + 1);
    } catch (e) { setError(e.message); }
  };
  if (!user) return <SignInPrompt title="Your reports, right here." detail="Sign in to track your posts and see what the community found." onClick={() => onRequireAuth()} />;
  return <>
  <div className="subpage">
    <PageHeader eyebrow="YOUR CONTRIBUTIONS" title="My reports" description="Keep an eye on the items you’ve shared with campus." icon={<Package size={20} />} />
    {error && <ErrorBanner message={error} onRetry={() => setRefresh(refresh + 1)} />}
    {loading ? <Loader /> : items.length ? <div className="my-items-list">{items.map((item) => <article className="my-item-row" key={item._id}>
      <img src={imageUrl(item.imageUrl)} alt={item.title} /><div className="my-item-main"><div className="item-meta"><span>{item.type}</span><span className="meta-dot" />{item.category}</div><h3>{item.title}</h3><p><MapPin size={14} />{item.locationTag} · Reported {formatDate(item.createdAt)}</p></div>
      <span className={`status-pill ${item.deletedAt ? 'status-deleted' : `status-${item.status}`}`}>{item.deletedAt ? 'Deleted' : item.status}</span>
      {item.deletedAt && <small className="deleted-record-note">Removed {formatDate(item.deletedAt)} · retained in database</small>}
      <div className="my-item-actions">{item.deletedAt ? <button className="button button-outline button-small" onClick={() => restoreItem(item)}>Restore</button> : <><Link className="button button-outline button-small" to="/matches"><Sparkles size={14} /> Matches</Link>{['open', 'matched'].includes(item.status) && <button className="button button-outline button-small" onClick={() => setEditingItem(item)}><Pencil size={13} /> Edit</button>}{user.role === 'admin' && (item.status === 'resolved' ? <button className="button button-outline button-small" onClick={() => updateStatus(item, 'open')}>Reopen</button> : <button className="button button-outline button-small" onClick={() => updateStatus(item, 'resolved')}>Resolve</button>)}<button className="icon-button delete-button" onClick={() => removeItem(item)} aria-label={`Remove ${item.title}`}><X size={17} /></button></>}</div>
    </article>)}</div> : <div className="empty-state"><span className="empty-illustration"><BookOpen size={24} /></span><h3>You haven’t posted yet</h3><p>Tell the campus community what’s missing or what you found.</p><Link className="button button-primary" to="/" state={{ notice: 'Use “Report an item” to add your first report.' }}>Explore the board <ArrowRight size={15} /></Link></div>}
  </div>
  {editingItem && <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} onSaved={() => {
    setEditingItem(null);
    setToast('Your report has been updated and matches refreshed.');
    setRefresh((value) => value + 1);
  }} />}
  </>;
}

function AdminReports({ user, onRequireAuth, setToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    api(`/items/admin?page=${page}&limit=24`)
      .then(({ items: rows, pages: pageCount, total: count }) => {
        if (!active) return;
        setItems(rows);
        setPages(pageCount);
        setTotal(count);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, page, refresh]);

  const updateStatus = async (item, status) => {
    setBusyId(item._id);
    setError('');
    try {
      const { item: updated } = await api(`/items/${item._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setItems((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
      setToast(status === 'resolved' ? 'Report marked as resolved.' : 'Report reopened.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  if (!user) return <SignInPrompt title="Administrator sign in required." detail="Sign in with an administrator account to manage reports." onClick={() => onRequireAuth()} />;
  if (user.role !== 'admin') return <div className="subpage"><div className="empty-state"><span className="empty-illustration"><ShieldCheck size={24} /></span><h3>Administrator access required</h3><p>Only administrators can manage report statuses.</p><Link className="button button-outline" to="/">Back to discover</Link></div></div>;

  return <div className="subpage admin-reports-page">
    <PageHeader eyebrow="ADMINISTRATION" title="Manage reports" description="Review campus reports and update their status." icon={<Package size={20} />} />
    <p className="admin-report-count">{total} {total === 1 ? 'report' : 'reports'}</p>
    {error && <ErrorBanner message={error} onRetry={() => setRefresh((current) => current + 1)} />}
    {loading ? <Loader /> : items.length ? <>
      <div className="admin-report-list">{items.map((item) => <article className="admin-report-row" key={item._id}>
        <img src={imageUrl(item.imageUrl)} alt="" />
        <div className="admin-report-main">
          <div className="admin-report-meta"><span className={`report-kind report-kind-${item.type}`}>{item.type}</span><span className={`status-pill status-${item.status}`}>{item.status}</span><span>{formatDate(item.itemDate)}</span></div>
          <h2>{item.title}</h2>
          <p>{item.category} · {item.locationTag} · Reported by {item.postedBy?.name || 'Unknown'}</p>
        </div>
        <button className={`button button-small ${item.status === 'resolved' ? 'button-outline' : 'button-primary'}`} disabled={busyId === item._id} onClick={() => updateStatus(item, item.status === 'resolved' ? 'open' : 'resolved')}>
          {busyId === item._id ? 'Updating…' : item.status === 'resolved' ? 'Reopen' : 'Resolve'}
        </button>
      </article>)}</div>
      {pages > 1 && <div className="admin-pagination"><button className="button button-outline button-small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button button-outline button-small" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </> : <div className="empty-state"><span className="empty-illustration"><Package size={24} /></span><h3>No reports yet</h3><p>Campus reports will appear here when they are posted.</p></div>}
  </div>;
}

function EditItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: item.type,
    title: item.title,
    description: item.description,
    category: item.category,
    locationTag: item.locationTag,
    specificSpot: item.specificSpot || '',
    itemDate: new Date(item.itemDate).toISOString().slice(0, 10),
    verificationQuestion: item.verificationQuestion || ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(imageUrl(item.imageUrl));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (file) data.append('image', file);
    try {
      await api(`/items/${item._id}`, { method: 'PATCH', body: data });
      onSaved();
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose}><form className="form-panel report-form" onSubmit={submit}>
    <div className="modal-heading"><div className="modal-icon"><Pencil size={18} /></div><div><div className="eyebrow eyebrow-dark">UPDATE YOUR REPORT</div><h2>Edit item details</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <div className="segmented-control"><button type="button" className={form.type === 'lost' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'lost' })}>I lost something</button><button type="button" className={form.type === 'found' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'found' })}>I found something</button></div>
    <label className="upload-area" htmlFor="edit-item-image"><img className="upload-preview" src={preview} alt="Current item" /><input id="edit-item-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="change-photo">{file ? 'Change photo' : 'Replace photo'}</span></label>
    <div className="form-grid">
      <label className="field-label field-span">What is it called?<input required maxLength="120" value={form.title} onChange={change('title')} /></label>
      <label className="field-label">Category<select required value={form.category} onChange={change('category')}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field-label">Campus zone<select required value={form.locationTag} onChange={change('locationTag')}>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></label>
      <label className="field-label">Where exactly?<input maxLength="160" value={form.specificSpot} onChange={change('specificSpot')} placeholder="Specific spot" /></label>
      <label className="field-label">When was it {form.type === 'lost' ? 'lost' : 'found'}?<input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.itemDate} onChange={change('itemDate')} /></label>
      <label className="field-label field-span">A few more details<textarea required maxLength="2000" rows="3" value={form.description} onChange={change('description')} /></label>
      {form.type === 'found' && <label className="field-label field-span">A question only the owner can answer <span className="optional">Optional</span><input maxLength="300" value={form.verificationQuestion} onChange={change('verificationQuestion')} placeholder="e.g. What sticker is on the back?" /></label>}
    </div>
    {error && <InlineError>{error}</InlineError>}
    <div className="form-submit-row"><span><ShieldCheck size={15} /> Matches are recalculated after edits.</span><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={15} /></button></div>
  </form></Modal>;
}

function ReportModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ type: 'lost', title: '', description: '', category: '', locationTag: '', specificSpot: '', itemDate: new Date().toISOString().slice(0, 10), verificationQuestion: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!file) { setError('Choose an item photo to continue.'); return; }
    setBusy(true); setError('');
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => { if (value) data.append(key, value); });
    data.append('image', file);
    try {
      const result = await api('/items', { method: 'POST', body: data });
      setMatches(result.matches || []);
      onCreated(result.matches || []);
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose}><form className="form-panel report-form" onSubmit={submit}>
    <div className="modal-heading"><div className="modal-icon"><Upload size={19} /></div><div><div className="eyebrow eyebrow-dark">HELP THE COMMUNITY</div><h2>Report an item</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <div className="segmented-control"><button type="button" className={form.type === 'lost' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'lost' })}>I lost something</button><button type="button" className={form.type === 'found' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'found' })}>I found something</button></div>
    <label className="upload-area" htmlFor="item-image">
      {preview ? <img className="upload-preview" src={preview} alt="Selected item preview" /> : <><span className="upload-icon"><Upload size={20} /></span><b>Add a clear photo</b><small>JPG, PNG or WebP · up to 8 MB</small></>}
      <input id="item-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      {preview && <span className="change-photo">Change photo</span>}
    </label>
    <div className="form-grid">
      <label className="field-label field-span">What is it called?<input required maxLength="120" value={form.title} onChange={change('title')} placeholder="e.g. Blue canvas backpack" /></label>
      <label className="field-label">Category<select required value={form.category} onChange={change('category')}><option value="">Choose one</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field-label">Campus zone<select required value={form.locationTag} onChange={change('locationTag')}><option value="">Choose a zone</option>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></label>
      <label className="field-label">Where exactly?<input maxLength="160" value={form.specificSpot} onChange={change('specificSpot')} placeholder="e.g. 2nd floor study area" /></label>
      <label className="field-label">When was it {form.type === 'lost' ? 'lost' : 'found'}?<input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.itemDate} onChange={change('itemDate')} /></label>
      <label className="field-label field-span">A few more details<textarea required maxLength="2000" rows="3" value={form.description} onChange={change('description')} placeholder="Color, brand, distinguishing details..." /></label>
      {form.type === 'found' && <label className="field-label field-span">A question only the owner can answer <span className="optional">Optional</span><input maxLength="300" value={form.verificationQuestion} onChange={change('verificationQuestion')} placeholder="e.g. What sticker is on the back?" /></label>}
    </div>
    {error && <InlineError>{error}</InlineError>}
    <div className="form-submit-row"><span><ShieldCheck size={15} /> Your contact details stay private.</span><button className="button button-primary" disabled={busy}>{busy ? 'Finding matches…' : 'Post report'} <ArrowRight size={16} /></button></div>
  </form></Modal>;
}

function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '', department: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(form) });
      onAuth(result);
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose}><form className="form-panel auth-form" onSubmit={submit}>
    <div className="modal-heading"><div className="modal-icon"><UserRound size={19} /></div><div><div className="eyebrow eyebrow-dark">CAMPUS COMMUNITY</div><h2>{mode === 'login' ? 'Welcome back' : 'Join the community'}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <p className="form-intro">{mode === 'login' ? 'Sign in to manage your reports and claims.' : 'Create an account to post and claim items.'}</p>
    {mode === 'register' && <>
      <label className="field-label">Full name<input required maxLength="100" autoComplete="name" value={form.name} onChange={change('name')} placeholder="Your name" /></label>
      <div className="form-grid"><label className="field-label">Student ID<input required maxLength="40" value={form.studentId} onChange={change('studentId')} placeholder="e.g. 24A1234" /></label><label className="field-label">Department <span className="optional">Optional</span><input maxLength="100" value={form.department} onChange={change('department')} placeholder="e.g. Computer Science" /></label></div>
    </>}
    <label className="field-label">Email address<input required type="email" autoComplete="email" value={form.email} onChange={change('email')} placeholder="you@campus.edu" /></label>
    {mode === 'register' && <label className="field-label">Phone <span className="optional">Optional</span><input type="tel" maxLength="30" value={form.phone} onChange={change('phone')} placeholder="For arranging a handover" /></label>}
    <label className="field-label">Password<input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" value={form.password} onChange={change('password')} placeholder="At least 8 characters" /></label>
    {error && <InlineError>{error}</InlineError>}
    <button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={16} /></button>
    <p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Log in'}</button></p>
  </form></Modal>;
}

const infoPages = {
  about: {
    eyebrow: 'OUR COMMUNITY',
    title: 'About Foundry',
    description: 'A campus lost-and-found that helps people and their belongings reconnect.',
    icon: <Package size={20} />,
    sections: [
      { title: 'Made for campus life', body: 'Foundry gives students one place to report something lost or found, browse campus reports, and coordinate a claim.' },
      { title: 'A useful visual clue', body: 'When a report is posted, the app compares its image with open reports of the opposite type, then ranks potential matches using image, location, category, and date signals.' },
      { title: 'People make the final call', body: 'A match is a suggestion, not proof of ownership. Reporters review claims and should verify identifying details before arranging a handover.' }
    ]
  },
  'how-it-works': {
    eyebrow: 'A SIMPLE PROCESS',
    title: 'How it works',
    description: 'From the first report to a safe handover, here are the steps.',
    icon: <BookOpen size={20} />,
    sections: [
      { title: '01 · Post a report', body: 'Sign in, choose Lost or Found, add a clear photo, and include the date and campus zone. Avoid sharing sensitive personal information in the public description.' },
      { title: '02 · Review possible matches', body: 'Foundry compares the photo and report details with open reports of the opposite type. Potential matches appear in My matches for the people who posted them.' },
      { title: '03 · Verify a claim', body: 'If a found item may be yours, submit a claim with a detail that helps identify it. The reporter can review the answer and message you through the claims page.' },
      { title: '04 · Complete the handover', body: 'If the reporter approves the claim, coordinate a public campus handover. Use the one-time handover code to mark the item resolved.' }
    ]
  },
  privacy: {
    eyebrow: 'YOUR INFORMATION',
    title: 'Privacy policy',
    description: 'What Foundry stores and who can see it.',
    icon: <ShieldCheck size={20} />,
    sections: [
      { title: 'Account information', body: 'The service stores your name, student ID, email, and any department or phone number you provide to create and manage your account.' },
      { title: 'Reports and images', body: 'Report titles, descriptions, item dates, campus zones, and photos are shown to people using the public board. Image feature vectors are stored with reports to calculate visual matches.' },
      { title: 'Claims and conversations', body: 'Claim answers and claim messages are available to the people involved in that claim and administrators. Keep sensitive information out of messages unless it is needed to verify ownership.' },
      { title: 'Contact messages', body: 'Messages submitted through Contact us are stored in the database and visible to administrators. Administrators may use the email address you provide to reply outside the app.' },
      { title: 'Report removal', body: 'Removing a report hides it from public listings. The report, its uploaded image, and its deletion timestamp and user are retained in the database; the owner can restore it from My reports.' }
    ],
    note: 'This page describes the current app behavior. The institution operating Foundry should review it and publish any additional campus-specific privacy requirements.'
  },
  terms: {
    eyebrow: 'USING FOUNDRY',
    title: 'Terms & conditions',
    description: 'Guidelines for using the campus lost-and-found.',
    icon: <FileText size={20} />,
    sections: [
      { title: 'Use the service responsibly', body: 'Use Foundry for genuine campus lost-and-found reports. Submit accurate information and only upload images you are allowed to share.' },
      { title: 'Respect other people’s privacy', body: 'Do not post passwords, payment information, private contact details, or unnecessary identifying information in public reports. Do not use reports or messages to harass, impersonate, or mislead others.' },
      { title: 'Claims and handovers', body: 'Only claim an item if you believe it is yours. Similarity scores are suggestions and do not establish ownership. Verify details and arrange handovers in a safe, public campus location.' },
      { title: 'Service limits', body: 'Foundry cannot guarantee that an item will be found, that a match is correct, or that another user will respond. Follow your institution’s rules and contact campus staff for urgent safety concerns.' },
      { title: 'Report management', body: 'You may edit, resolve, remove, or restore your own reports. Removed reports are hidden publicly but retained with deletion audit information. Administrators may restrict accounts or reports that misuse the service.' }
    ],
    note: 'These terms are a general starting point for this app, not legal advice. The institution operating Foundry should review them before public deployment.'
  }
};

function InfoPage({ page }) {
  const content = infoPages[page];
  return <div className="subpage info-page">
    <PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} icon={content.icon} />
    <div className="info-content">
      {content.sections.map((section) => <section className="info-section" key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
      {content.note && <p className="policy-note"><ShieldCheck size={16} />{content.note}</p>}
      {page !== 'privacy' && page !== 'terms' && <Link className="button button-outline" to="/contact"><Mail size={15} /> Contact the team</Link>}
    </div>
  </div>;
}

function ContactPage({ user }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', topic: 'General question', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }));
  }, [user]);
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/contact', { method: 'POST', body: JSON.stringify(form) });
      setSent(true);
      setForm((current) => ({ ...current, message: '' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  return <div className="subpage contact-page">
    <PageHeader eyebrow="WE’RE HERE TO HELP" title="Contact us" description="Send a question or let us know about an issue with Foundry." icon={<Mail size={20} />} />
    <div className="contact-layout">
      <div className="contact-aside">
        <h2>How can we help?</h2>
        <p>Messages are saved to the campus support inbox. An administrator can review your message and contact you using the email address you provide.</p>
        <div className="contact-aside-note"><ShieldCheck size={17} /><span>Your message is only visible to administrators.</span></div>
        <Link className="text-link" to="/how-it-works">See how Foundry works <ArrowRight size={15} /></Link>
      </div>
      <div className="contact-form-card">
        {sent ? <div className="contact-success" role="status"><span className="empty-illustration"><Check size={24} /></span><h2>Message received</h2><p>Your message is saved in the campus support inbox. Thank you for getting in touch.</p><button className="button button-outline" onClick={() => setSent(false)}>Send another message</button></div> :
          <form onSubmit={submit}>
            <label className="field-label">Your name<input required minLength="2" maxLength="100" autoComplete="name" value={form.name} onChange={change('name')} /></label>
            <label className="field-label">Email address<input required type="email" maxLength="254" autoComplete="email" value={form.email} onChange={change('email')} /></label>
            <label className="field-label">What is this about?<select value={form.topic} onChange={change('topic')}><option>General question</option><option>Technical help</option><option>Report concern</option><option>Privacy request</option><option>Other</option></select></label>
            <label className="field-label">Your message<textarea required minLength="10" maxLength="5000" rows="6" value={form.message} onChange={change('message')} placeholder="Tell us how we can help..." /></label>
            {error && <InlineError>{error}</InlineError>}
            <button className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send message'} <Send size={15} /></button>
          </form>}
      </div>
    </div>
  </div>;
}

function ContactInbox({ user, onRequireAuth }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    let active = true;
    api('/contact').then(({ messages: rows }) => { if (active) setMessages(rows); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, refresh]);
  const updateStatus = async (message, status) => {
    try {
      await api(`/contact/${message._id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessages((current) => current.map((entry) => entry._id === message._id ? { ...entry, status } : entry));
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  if (!user) return <SignInPrompt title="Administrator sign in required." detail="Sign in with an administrator account to open the support inbox." onClick={() => onRequireAuth()} />;
  if (user.role !== 'admin') return <div className="subpage"><div className="empty-state"><span className="empty-illustration"><ShieldCheck size={24} /></span><h3>Administrator access required</h3><p>This inbox is only available to administrators.</p><Link className="button button-outline" to="/">Back to discover</Link></div></div>;
  return <div className="subpage">
    <PageHeader eyebrow="ADMINISTRATION" title="Contact inbox" description="Review messages submitted through the Contact us page." icon={<Mail size={20} />} />
    {error && <ErrorBanner message={error} onRetry={() => setRefresh((value) => value + 1)} />}
    {loading ? <Loader /> : messages.length ? <div className="contact-inbox-list">{messages.map((message) => <article className="contact-message-card" key={message._id}>
      <div className="contact-message-top"><span className={`status-pill status-${message.status}`}>{message.status}</span><time>{formatDate(message.createdAt)}</time></div>
      <h2>{message.topic}</h2>
      <p className="contact-message-text">{message.message}</p>
      <div className="contact-message-sender"><b>{message.name}</b><a href={`mailto:${encodeURIComponent(message.email)}`}>{message.email}</a></div>
      <div className="contact-message-actions">{message.status !== 'reviewed' && <button className="button button-outline button-small" onClick={() => updateStatus(message, 'reviewed')}>Mark reviewed</button>}{message.status !== 'resolved' && <button className="button button-primary button-small" onClick={() => updateStatus(message, 'resolved')}>Resolve</button>}</div>
    </article>)}</div> : <div className="empty-state"><span className="empty-illustration"><Mail size={24} /></span><h3>No messages yet</h3><p>New contact form submissions will appear here.</p></div>}
  </div>;
}

function PageHeader({ eyebrow, title, description, icon }) {
  return <div className="page-header"><div className="page-header-icon">{icon}</div><div><div className="eyebrow eyebrow-dark">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>;
}

function SignInPrompt({ title, detail, onClick }) {
  return <div className="signin-prompt"><span className="prompt-icon"><UserRound size={24} /></span><div className="eyebrow eyebrow-dark">YOUR CAMPUS ACCOUNT</div><h1>{title}</h1><p>{detail}</p><button className="button button-primary" onClick={onClick}>Log in or create account <ArrowRight size={15} /></button></div>;
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('modal-open');
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.classList.remove('modal-open'); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card" role="dialog" aria-modal="true">{children}</div></div>;
}

function ErrorBanner({ message, onRetry }) {
  return <div className="error-banner"><CircleHelp size={17} /><span>{message}</span>{onRetry && <button onClick={onRetry}>Try again</button>}</div>;
}

function InlineError({ children }) { return <div className="inline-error" role="alert">{children}</div>; }

function Loader() { return <div className="page-loader"><span className="spinner" /> Loading…</div>; }

function NotFound() { return <div className="empty-state not-found"><span className="empty-illustration"><Search size={25} /></span><h3>This page wandered off</h3><p>Let’s get you back to the community board.</p><Link className="button button-primary" to="/">Back to discover</Link></div>; }

function initials(name = '') { return name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase(); }
function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const delta = Math.round((todayDay - day) / 86_400_000);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export default App;
