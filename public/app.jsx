const { useState, useEffect, useRef, useMemo } = React;

const CustomCursor = ({ cursorStyle = 'dot' }) => {
  const ref = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    if (cursorStyle === 'off') {
      html.classList.remove('custom-cursor-active');
    } else {
      html.classList.add('custom-cursor-active');
    }
    return () => html.classList.remove('custom-cursor-active');
  }, [cursorStyle]);

  useEffect(() => {
    if (cursorStyle === 'off') return;
    const el = ref.current;
    if (!el) return;
    const onMove = e => {
      el.style.left = e.clientX + 'px';
      el.style.top  = e.clientY + 'px';
    };
    const onDown = () => el.classList.add('clicking');
    const onUp   = () => el.classList.remove('clicking');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [cursorStyle]);

  if (cursorStyle === 'off') return null;

  return (
    <div ref={ref} className={`custom-cursor style-${cursorStyle}`}>
      {cursorStyle === 'cross' && (
        <>
          <span className="cross-arm h" />
          <span className="cross-arm v" />
        </>
      )}
    </div>
  );
};

const cx = (...xs) => xs.filter(Boolean).join(' ');

const CLOAK_PRESETS = [
  { id: 'schoology', short: 'Schoology', title: 'Home | Schoology', icon: 'https://www.nicepng.com/png/full/433-4330628_schoology-icon-schoology-logo-png.png', host: 'app.schoology.com' },
  { id: 'canvas', short: 'Canvas', title: 'Dashboard', icon: 'https://www.google.com/s2/favicons?domain=canvas.instructure.com&sz=64', host: 'canvas.instructure.com' },
  { id: 'classroom', short: 'Classroom', title: 'Classroom', icon: 'https://ssl.gstatic.com/classroom/favicon.png', host: 'classroom.google.com' },
];

const BROWSER_OPTIONS = [
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com', icon: 'https://www.google.com/s2/favicons?domain=duckduckgo.com&sz=64' },
  { id: 'google', name: 'Google', url: 'https://google.com', icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' },
  { id: 'bing', name: 'Bing', url: 'https://bing.com', icon: 'https://www.google.com/s2/favicons?domain=bing.com&sz=64' },
  { id: 'startpage', name: 'StartPage', url: 'https://startpage.com', icon: 'https://www.google.com/s2/favicons?domain=startpage.com&sz=64' },
];

function readInitialCloak() {
  const title = localStorage.getItem('websiteTitle');
  const icon = localStorage.getItem('websiteIcon');
  const host = localStorage.getItem('websiteCloakHost');
  let presetId = localStorage.getItem('websiteCloakPreset');
  const valid = new Set([...CLOAK_PRESETS.map(p => p.id), 'custom']);
  if (!presetId || !valid.has(presetId)) {
    presetId = null;
    for (const p of CLOAK_PRESETS) {
      if (p.title === title && p.icon === icon) presetId = p.id;
    }
    if (!presetId) {
      presetId = title == null && icon == null && host == null ? 'classroom' : 'custom';
    }
  }
  const preset = CLOAK_PRESETS.find(p => p.id === presetId);
  const classroom = CLOAK_PRESETS.find(p => p.id === 'classroom');
  return {
    cloakPresetId: presetId,
    cloakTitle: title ?? preset?.title ?? classroom.title,
    cloakIcon: icon ?? preset?.icon ?? classroom.icon,
    cloakAddressHost: host ?? preset?.host ?? classroom.host,
  };
}

function normalizePastedUrl(raw) {
  const t = raw.trim();
  if (!t) return null;
  try {
    return new URL(t).href;
  } catch {
    try {
      return new URL(`https://${t}`).href;
    } catch {
      return null;
    }
  }
}

const FoilThumb = ({ id, title }) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const initials = title.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  return (
    <div className="thumb-fallback" style={{
      background: `linear-gradient(135deg, oklch(0.38 0.10 ${hue}), oklch(0.22 0.06 ${(hue + 50) % 360}))`,
      color: `oklch(0.85 0.12 ${hue})`,
    }}>
      {initials}
    </div>
  );
};

const FloatingLogo = () => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const SIZE = 96;
    const REST = 0.82;
    const p = {
      x: window.innerWidth / 2 - SIZE / 2,
      y: 72,
      vx: 0,
      vy: 0,
      mx: -999,
      my: -999,
    };

    const obstacleSelectors = [
      '.topbar',
      '.hero h1',
      '.hero-sub',
      '.launcher',
      '.hero-actions button.btn',
      '.hero-actions a.discord-btn',
      '.hero .status-line',
      '.footer',
    ];

    function collectObstacles() {
      const rects = [];
      for (const sel of obstacleSelectors) {
        document.querySelectorAll(sel).forEach((node) => {
          const r = node.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          rects.push({
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          });
        });
      }
      return rects;
    }

    function resolveAABB(r) {
      const L = p.x;
      const R = p.x + SIZE;
      const T = p.y;
      const B = p.y + SIZE;
      if (R <= r.left || L >= r.right || B <= r.top || T >= r.bottom) return;

      const lc = (L + R) / 2;
      const tc = (T + B) / 2;
      const oc = (r.left + r.right) / 2;
      const ot = (r.top + r.bottom) / 2;
      const nx = lc - oc;
      const ny = tc - ot;
      const halfX = SIZE / 2 + (r.right - r.left) / 2;
      const halfY = SIZE / 2 + (r.bottom - r.top) / 2;
      if (Math.abs(nx) >= halfX || Math.abs(ny) >= halfY) return;

      const penX = halfX - Math.abs(nx);
      const penY = halfY - Math.abs(ny);

      if (penX < penY) {
        p.x += nx < 0 ? -penX : penX;
        p.vx *= -REST;
      } else {
        p.y += ny < 0 ? -penY : penY;
        p.vy *= -REST;
      }
    }

    function resolveAllObstacles() {
      const rects = collectObstacles();
      for ( let pass = 0; pass < 4; pass++) {
        for ( const r of rects) {
          resolveAABB(r);
        }
      }
    }

    requestAnimationFrame(() => {
      const h1 = document.querySelector('.hero h1');
      if (h1) {
        const rect = h1.getBoundingClientRect();
        const topbar = document.querySelector('.topbar');
        const top = topbar ? topbar.getBoundingClientRect().bottom : 56;
        p.x = window.innerWidth / 2 - SIZE / 2;
        p.y = Math.max(top + 4, rect.top - SIZE - 44);
      }
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });

    const onMove = (e) => {
      p.mx = e.clientX;
      p.my = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    let raf;
    function tick() {
      const cx = p.x + SIZE / 2;
      const cy = p.y + SIZE / 2;
      const dx = cx - p.mx;
      const dy = cy - p.my;
      const dist = Math.hypot(dx, dy);

      if (dist < 55 && dist > 0) {
        const f = ((55 - dist) / 55) * 0.52;
        p.vx += (dx / dist) * f;
        p.vy += (dy / dist) * f;
      }

      p.vx *= 0.982;
      p.vy *= 0.982;
      p.x += p.vx;
      p.y += p.vy;

      resolveAllObstacles();

      const topbar = document.querySelector('.topbar');
      const topBound = topbar ? topbar.getBoundingClientRect().bottom : 56;
      const maxX = window.innerWidth - SIZE;
      const maxY = window.innerHeight - SIZE;
      if (p.x < 0) {
        p.x = 0;
        p.vx = Math.abs(p.vx) * 0.72;
      }
      if (p.x > maxX) {
        p.x = maxX;
        p.vx = -Math.abs(p.vx) * 0.72;
      }
      if (p.y < topBound) {
        p.y = topBound;
        p.vy = Math.abs(p.vy) * 0.72;
      }
      if (p.y > maxY) {
        p.y = maxY;
        p.vy = -Math.abs(p.vy) * 0.72;
      }

      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <img
      ref={ref}
      src="/assets/foil.png"
      alt=""
      className="floating-logo"
    />
  );
};

const AuthModal = ({ onClose }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const clearErr = () => setErr('');

  const fmtErr = (e) =>
    (e.message || 'something went wrong')
      .replace('Firebase: ', '')
      .replace(/ \(auth\/[^)]+\)\.?$/, '');

  const submit = async (ev) => {
    ev.preventDefault();
    setBusy(true); setErr('');
    try {
      if (mode === 'login') {
        await window.fbAuth.signInWithEmailAndPassword(email, password);
      } else {
        const cred = await window.fbAuth.createUserWithEmailAndPassword(email, password);
        if (displayName.trim()) await cred.user.updateProfile({ displayName: displayName.trim() });
      }
      onClose();
    } catch (e) { setErr(fmtErr(e)); }
    finally { setBusy(false); }
  };

  const googleSignIn = async () => {
    setBusy(true); setErr('');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await window.fbAuth.signInWithPopup(provider);
      onClose();
    } catch (e) { setErr(fmtErr(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-meta">
            <div className="kind">1MMUN3</div>
            <h3>{mode === 'login' ? 'sign in' : 'create account'}</h3>
          </div>
        </div>
        <form className="auth-fields" onSubmit={submit}>
          {mode === 'signup' && (
            <input className="auth-input" placeholder="display name (optional)" value={displayName} onChange={e => { setDisplayName(e.target.value); clearErr(); }} />
          )}
          <input className="auth-input" type="email" placeholder="email" value={email} onChange={e => { setEmail(e.target.value); clearErr(); }} required />
          <input className="auth-input" type="password" placeholder="password" value={password} onChange={e => { setPassword(e.target.value); clearErr(); }} required minLength={6} />
          {err && <p className="auth-err">{err}</p>}
          <button className="btn accent" type="submit" disabled={busy}>{busy ? '...' : mode === 'login' ? 'sign in' : 'sign up'}</button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <button className="btn google-btn" type="button" onClick={googleSignIn} disabled={busy}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
          continue with google
        </button>
        <p className="auth-switch">
          {mode === 'login' ? "don't have an account? " : 'already have an account? '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'sign up' : 'sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

const PAGE_KEYS = ['home', 'games', 'apps', 'tv', 'chatroom', 'settings', 'about'];
const PAGE_LABELS = { tv: 'tv' };

function pageFromPath() {
  const raw = location.pathname.replace(/^\//, '');
  const seg = (raw.split('/')[0] || 'home').toLowerCase();
  return PAGE_KEYS.includes(seg) ? seg : 'home';
}

const TopBar = ({ page, navigate, user, onAccountClick }) => {
  const pages = PAGE_KEYS;
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <a href="/" className="brand" onClick={e => { e.preventDefault(); navigate('home'); }}>
          <img src="/assets/foil.png" alt="" className="brand-logo" />
          <span>1<em>MMUN</em>3</span>
        </a>
        <nav className="nav-pill">
          {pages.map(p => (
            <button key={p} type="button" className={cx(page === p && 'active')} onClick={() => navigate(p)}>{PAGE_LABELS[p] || p}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        <button className="account-btn" onClick={onAccountClick}>
          {user ? (
            <>
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="acct-avatar" />
                : <span className="acct-initial">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
              }
              <span>{user.displayName || user.email?.split('@')[0]}</span>
            </>
          ) : 'sign in'}
        </button>
        </div>
      </div>
    </header>
  );
};

const Footer = () => (
  <footer className="footer">
    <div className="shell footer-inner">
      <span className="small">1MMUN3 · protection shield</span>
      <span className="small">no logs. no leaks.</span>
    </div>
  </footer>
);

const Home = ({ navigate, voice }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);
  const [splash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);

  const launch = async e => {
    e?.preventDefault();
    if (!query.trim()) { setStatus({ msg: 'paste something first', warn: true }); return; }
    const url = window.OneMMUN3?.normalizeUrl(query.trim());
    setStatus({ msg: 'starting proxy...' });
    try {
      await window.OneMMUN3Proxy.open(url);
    } catch (err) {
      setStatus({ msg: err.message || 'proxy failed.', warn: true });
    }
  };

  return (
    <main>
      <FloatingLogo />
      <section className="shell hero">
        <h1>probe the internet privately. <em>{voice.headline ? voice.headline : splash}</em></h1>
        <p className="hero-sub">{voice.lede}</p>

        <form className="launcher" onSubmit={launch}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="paste a url or search"
            autoFocus
          />
          <button type="submit">go →</button>
        </form>

        <div className="hero-actions">
          <button className="btn" onClick={() => navigate('settings')}>tab cloak</button>
          <button className="btn" onClick={() => window.OneMMUN3?.openBlank()}>about:blank</button>
        </div>

        {status && (
          <div className={cx('status-line', status.warn ? 'warn' : 'ok')}>
            {status.msg}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
};

const Proxy = ({ navigate }) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([
    { url: 'youtube.com', t: '2m ago' },
    { url: 'reddit.com/r/all', t: '14m ago' },
    { url: 'docs.google.com', t: '1h ago' },
  ]);
  const [status, setStatus] = useState(null);

  const launch = async e => {
    e?.preventDefault();
    if (!query.trim()) return;
    const url = window.OneMMUN3?.normalizeUrl(query.trim());
    const display = query.replace(/^https?:\/\//, '').slice(0, 40);
    setHistory(h => [{ url: display, t: 'just now' }, ...h.slice(0, 4)]);
    setStatus(`routing → ${display}...`);
    setQuery('');
    try {
      await window.OneMMUN3Proxy.open(url);
    } catch (err) {
      setStatus(err.message || 'proxy failed.');
    }
  };

  return (
    <main>
      <section className="shell page-hero">
        <h1>paste it. <em>send it.</em></h1>
        <p className="lede">routes through scramjet. that's it.</p>
      </section>

      <section className="shell proxy-wrap">
        <form className="launcher" onSubmit={launch}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="youtube.com, reddit, whatever"
            autoFocus
          />
          <button type="submit">go →</button>
        </form>

        {status && <div className="status-line ok">{status}</div>}

        <div className="hero-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn" onClick={() => window.OneMMUN3?.openBlank()}>about:blank</button>
          <button className="btn" onClick={() => navigate('settings')}>settings</button>
        </div>

        <div className="flow-grid">
          <div className="panel">
            <span className="panel-tag">// recents</span>
            <ul className="recents-list">
              {history.map((h, i) => (
                <li key={i}>
                  <button onClick={() => setQuery(h.url)}>→ {h.url}</button>
                  <span className="t">{h.t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <span className="panel-tag">// under the hood</span>
            <ul className="stack-list">
              <li><span className="k">routing</span><span className="v">scramjet</span><span className="stat">live</span></li>
              <li><span className="k">transport</span><span className="v">wisp + libcurl</span><span className="stat">on</span></li>
              <li><span className="k">noise</span><span className="v">stripped</span><span className="stat">low</span></li>
              <li><span className="k">mobile</span><span className="v">supported</span><span className="stat">yes</span></li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
};

const CatalogThumb = ({ id, title, image }) => {
  const [broken, setBroken] = useState(false);
  if (!image || broken) return <FoilThumb id={id} title={title} />;
  return (
    <img
      className="catalog-thumb-img"
      src={image}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
};

const Catalog = ({ kind, items, tags, setActiveItem, favorites, toggleFav }) => {
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('all');
  const [showAddOwn, setShowAddOwn] = useState(false);

  const storageKey = kind === 'games' ? 'customgames' : 'customapps';
  const defaultTag  = kind === 'games' ? 'arcade' : 'tools';
  const favIds = favorites?.[kind] || [];

  const [customItems, setCustomItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter(it => it.id && it.title && it.url) : [];
    } catch { return []; }
  });

  const allItems = useMemo(() => [...customItems, ...items], [customItems, items]);

  const filtered = useMemo(() =>
    allItems.filter(it => {
      if (tag === '★ saved') return favIds.includes(it.id);
      if (tag !== 'all' && it.tag !== tag) return false;
      if (search && !it.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [allItems, search, tag, favIds]
  );

  const allTags = useMemo(() => ['★ saved', ...tags], [tags]);

  const handleSave = ({ title, url, image }) => {
    const newItem = {
      id: 'custom-' + Date.now(),
      title,
      url,
      image: image || '',
      tag: defaultTag,
      custom: true,
    };
    const updated = [newItem, ...customItems];
    setCustomItems(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    setShowAddOwn(false);
  };

  return (
    <main>
      <section className="shell page-hero">
        <h1>{kind === 'games' ? <>games, <em>unfiltered.</em></> : <>apps, <em>untangled.</em></>}</h1>
        <p className="lede">
          {kind === 'games'
            ? 'search, filter, tap. all proxied, no ads.'
            : 'every web app you actually use, one tap away.'}
        </p>
      </section>

      <section className="shell">
        <div className="toolbar">
          <div className="toolbar-left">
            <span className="toolbar-count">{filtered.length} / {allItems.length}</span>
            <div className="chip-row">
              {allTags.map(t => (
                <button key={t} className={cx('chip', tag === t && 'active')} onClick={() => setTag(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder={`search ${kind}`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {showAddOwn && <AddOwnModal kind={kind} onSave={handleSave} onClose={() => setShowAddOwn(false)} />}
        <div className="catalog-grid">
          <button className="catalog-card add-card" onClick={() => setShowAddOwn(true)}>
            <div className="thumb" />
            <div className="meta">
              <span className="name">add your own</span>
            </div>
          </button>
          {filtered.map((it, i) => {
            const isFav = favIds.includes(it.id);
            return (
              <button key={it.id} className="catalog-card" onClick={() => {
                if (it.custom) {
                  window.location.href = `/load.html?url=${encodeURIComponent(it.url)}`;
                } else {
                  const param = kind === 'games' ? 'game' : 'app';
                  window.location.href = `/load.html?${param}=${encodeURIComponent(it.id)}`;
                }
              }}>
                <div className="thumb">
                  <CatalogThumb id={it.id} title={it.title} image={it.image} />
                </div>
                <div className="meta">
                  <span className="name">{it.title}</span>
                  <span className="id-tag">{String(i + 1).padStart(3, '0')}</span>
                </div>
                <button
                  className={cx('fav-btn', isFav && 'active')}
                  onClick={e => { e.stopPropagation(); toggleFav?.(kind, it.id); }}
                  title={isFav ? 'remove from saved' : 'save'}
                >
                  {isFav ? '♥' : '♡'}
                </button>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
};

const AddOwnModal = ({ kind, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [err, setErr] = useState('');

  const handleSave = () => {
    const trimmed = link.trim();
    if (!title.trim()) { setErr('title is required.'); return; }
    if (!trimmed) { setErr('link is required.'); return; }
    let href = trimmed;
    if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
    try { new URL(href); } catch { setErr('enter a valid URL.'); return; }
    onSave({ title: title.trim(), url: href, image: image.trim() });
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-meta">
            <div className="kind">custom {kind === 'games' ? 'game' : 'app'}</div>
            <h3>add your own</h3>
          </div>
        </div>
        <div className="add-own-fields">
          <label>
            <span>title</span>
            <input
              className="add-own-input"
              placeholder="My Site"
              value={title}
              onChange={e => { setTitle(e.target.value); setErr(''); }}
            />
          </label>
          <label>
            <span>link</span>
            <input
              className="add-own-input"
              placeholder="https://example.com"
              value={link}
              onChange={e => { setLink(e.target.value); setErr(''); }}
            />
          </label>
          <label>
            <span>image <em>(optional)</em></span>
            <input
              className="add-own-input"
              placeholder="https://example.com/icon.png"
              value={image}
              onChange={e => setImage(e.target.value)}
            />
          </label>
          {err && <p className="add-own-err">{err}</p>}
        </div>
        <div className="modal-actions">
          <button className="btn accent" onClick={handleSave}>add</button>
          <button className="btn" onClick={onClose}>cancel</button>
        </div>
      </div>
    </div>
  );
};

const LaunchModal = ({ item, onClose }) => {
  if (!item) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-thumb">
            <FoilThumb id={item.id} title={item.title} />
          </div>
          <div className="modal-meta">
            <div className="kind">{item.kind} · {item.tag}</div>
            <h3>{item.title}</h3>
          </div>
        </div>
        <p>ready to go. how do you want to open it?</p>
        <div className="modal-actions">
          <button className="btn accent">deploy</button>
          <button className="btn">new tab</button>
          <button className="btn">cloak + go</button>
          <button className="btn" onClick={onClose}>nvm</button>
        </div>
      </div>
    </div>
  );
};

const OneMMUN3TV = ({ theme }) => {
  const [status, setStatus] = useState('loading');
  const iframeRef = useRef(null);

  // If the user navigated directly to a TV sub-path (e.g. /tv/sports),
  // start the iframe there instead of always at /tv/
  const [iframeSrc] = useState(() => {
    const p = location.pathname;
    const baseUrl = (typeof window !== 'undefined' && window.TV_APP_URL) || 'http://localhost:3000';
    if (p.startsWith('/tv/')) {
      return baseUrl + (p.slice(3) + location.search);
    }
    return baseUrl;
  });

  const syncOuterUrl = () => {
    try {
      const iwin = iframeRef.current?.contentWindow;
      if (!iwin) return;
      const iframePath = iwin.location.pathname + iwin.location.search;
      const outerPath = location.pathname + location.search;
      if (outerPath !== iframePath) {
        history.replaceState({ spa: true, page: 'tv' }, '', iframePath);
      }
    } catch {}
  };

  // Keep outer URL in sync with iframe navigation (client-side and server-side)
  useEffect(() => {
    const id = setInterval(syncOuterUrl, 300);
    return () => clearInterval(id);
  }, []);

  const injectAccent = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      let style = doc.getElementById('1mmun3-accent');
      if (!style) {
        style = doc.createElement('style');
        style.id = '1mmun3-accent';
        doc.head.appendChild(style);
      }
      style.textContent = `:root { --accent: ${accent}; }`;
    } catch {}
  };

  useEffect(() => { injectAccent(); }, [theme]);

  const enterFrame = () => document.documentElement.classList.add('cursor-in-iframe');
  const leaveFrame = () => document.documentElement.classList.remove('cursor-in-iframe');

  return (
    <main className="tv-page tv-embed-page">
      {status === 'loading' && (
        <div className="tv-loading">
          <div className="tv-loading-inner">
            <img src="/assets/foil.png" alt="" className="tv-loading-logo" />
            <span className="tv-loading-label">1<em>MMUN</em>3 TV</span>
            <div className="tv-loading-bar"><div className="tv-loading-fill" /></div>
            <p className="tv-loading-notice">⚠ Streaming players may open popup ads upon clicking Close them and playback continues normally</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="tv-loading">
          <div className="tv-loading-inner">
            <img src="/assets/foil.png" alt="" className="tv-loading-logo" />
            <span className="tv-loading-label">1<em>MMUN</em>3 TV</span>
            <p className="tv-err">TV app isn't running — start the server then refresh.</p>
          </div>
        </div>
      )}
      <section
        className="tv-app-frame-wrap"
        aria-label="1MMUN3 TV"
        style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
        onMouseEnter={enterFrame}
        onMouseLeave={leaveFrame}
      >
        <iframe
          ref={iframeRef}
          className="tv-app-frame"
          title="1MMUN3 TV"
          src={iframeSrc}
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer"
          onLoad={e => {
            try {
              const ok = e.target.contentDocument !== null || e.target.contentWindow !== null;
              setStatus(ok ? 'ready' : 'error');
            } catch {
              setStatus('ready');
            }
            injectAccent();
            syncOuterUrl();
          }}
          onError={() => setStatus('error')}
        />
      </section>
    </main>
  );
};

const CURSOR_OPTIONS = [
  { id: 'dot',   label: 'dot',   preview: <div className="cp-dot" /> },
  { id: 'ring',  label: 'ring',  preview: <div className="cp-ring" /> },
  { id: 'glow',  label: 'glow',  preview: <div className="cp-glow" /> },
  { id: 'cross', label: 'cross', preview: <div className="cp-cross" /> },
  { id: 'off',   label: 'off',   preview: <div className="cp-off">↖</div> },
];

const Settings = ({ theme, setTheme, cursorStyle, setCursorStyle, reduce, setReduce, bigText, setBigText, user, onSignOut, onShowAuth, onCloakSave, syncStatus }) => {
  const initial = useMemo(() => readInitialCloak(), []);
  const [cloakPresetId, setCloakPresetId] = useState(initial.cloakPresetId);
  const [cloakTitle, setCloakTitle] = useState(initial.cloakTitle);
  const [cloakIcon, setCloakIcon] = useState(initial.cloakIcon);
  const [cloakAddressHost, setCloakAddressHost] = useState(initial.cloakAddressHost);
  const [importUrl, setImportUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState('');

  const applyImportedMeta = (data) => {
    setCloakPresetId('custom');
    setCloakTitle(data.title || 'untitled');
    setCloakIcon((prev) => data.iconUrl || data.fallbackIconUrl || prev);
    setCloakAddressHost((prev) => data.hostname || prev);
  };

  const pickPreset = (id) => {
    setImportErr('');
    if (id === 'custom') {
      setCloakPresetId('custom');
      return;
    }
    const p = CLOAK_PRESETS.find(x => x.id === id);
    if (!p) return;
    setCloakPresetId(p.id);
    setCloakTitle(p.title);
    setCloakIcon(p.icon);
    setCloakAddressHost(p.host);
  };

  const runImportFromUrl = async () => {
    const href = normalizePastedUrl(importUrl);
    if (!href) {
      setImportErr('paste a full URL or domain');
      return;
    }
    setImportErr('');
    setImportBusy(true);
    try {
      const r = await fetch(`/api/tab-meta?url=${encodeURIComponent(href)}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setImportErr(typeof data.error === 'string' ? data.error : 'could not read that page');
        return;
      }
      applyImportedMeta(data);
    } catch {
      setImportErr('network error');
    } finally {
      setImportBusy(false);
    }
  };

  const onImportPaste = (e) => {
    const text = e.clipboardData?.getData('text')?.trim();
    if (!text || text.includes('\n')) return;
    const href = normalizePastedUrl(text);
    if (!href) return;
    setImportUrl(text);
    setImportBusy(true);
    setImportErr('');
    fetch(`/api/tab-meta?url=${encodeURIComponent(href)}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setImportErr(typeof data.error === 'string' ? data.error : 'could not read that page');
          return;
        }
        applyImportedMeta(data);
      })
      .catch(() => setImportErr('network error'))
      .finally(() => setImportBusy(false));
  };

  const [autoBlank, setAutoBlank] = useState(false);
  const [stealth, setStealth] = useState(true);
  const [antiGuardian, setAntiGuardian] = useState(() => localStorage.getItem('1MMUN3AntiGuardian') === 'true');
  const [browser, setBrowser] = useState(() => localStorage.getItem('1MMUN3Browser') || 'duckduckgo');

  // Anti-guardian effect
  useEffect(() => {
    if (!antiGuardian) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'save your work?';
      return 'save your work?';
    };

    const handleScreenCapture = () => {
      try {
        if (document.hidden) {
          document.body.style.display = 'none';
          setTimeout(() => { document.body.style.display = ''; }, 100);
        }
      } catch (err) {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleScreenCapture);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleScreenCapture);
    };
  }, [antiGuardian]);

  const [panicKey, setPanicKey] = useState(() => localStorage.getItem('1MMUN3PanicKey') || 'Escape');
  const [panicUrl, setPanicUrl] = useState(() => localStorage.getItem('1MMUN3PanicUrl') || '');
  const [listeningForKey, setListeningForKey] = useState(false);

  const savePanic = (key, url) => {
    localStorage.setItem('1MMUN3PanicKey', key);
    if (url.trim()) localStorage.setItem('1MMUN3PanicUrl', url.trim());
    else localStorage.removeItem('1MMUN3PanicUrl');
  };

  const themes = [
    { id: 'midnight', name: 'midnight', pal: ['#000000', '#ffffff', '#0a0a0a'] },
    { id: 'daylight', name: 'daylight', pal: ['#ffffff', '#000000', '#f5f5f5'] },
    { id: 'bubblegum',name: 'bubblegum',pal: ['#1a0a15', '#c47aaa', '#2d1227'] },
    { id: 'ocean',    name: 'ocean',    pal: ['#0a1929', '#29b6f6', '#132f4c'] },
    { id: 'forest',   name: 'forest',   pal: ['#0b3d1a', '#4caf50', '#1b5e2c'] },
  ];

  const toggles = [
    { key: 'autoBlank', val: autoBlank, set: setAutoBlank, label: 'auto about:blank', sub: 'open everything in a cloak window by default.' },
    { key: 'stealth',   val: stealth,   set: setStealth,   label: 'stealth route',    sub: 'strip referrers and telemetry on every jump.' },
    { key: 'antiGuardian', val: antiGuardian, set: (v) => { setAntiGuardian(v); localStorage.setItem('1MMUN3AntiGuardian', v); }, label: 'anti-guardian', sub: 'prevent your teacher from closing this tab.' },
    { key: 'reduce',    val: reduce,    set: setReduce,    label: 'reduce motion',     sub: 'turn off background animations.' },
    { key: 'bigText',   val: bigText,   set: setBigText,   label: 'larger text',      sub: 'bumps up font sizes a notch.' },
  ];

  return (
    <main>
      <section className="shell page-hero">
        <h1>make it <em>yours.</em></h1>
        <p className="lede">cloak the tab, pick a theme, flip some switches.</p>
      </section>

      <section className="shell settings-wrap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <span className="panel-tag">// tab cloak</span>
            <h3>cloak</h3>
            <p className="h-sub">pick a classroom tab, or paste any site — we&apos;ll pull title and icon.</p>

            <div className="cloak-browser-mock">
              <div className="cloak-tab-strip" role="tablist" aria-label="cloak preset">
                {CLOAK_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={cloakPresetId === p.id}
                    className={cx('cloak-tab-pick', cloakPresetId === p.id && 'on')}
                    onClick={() => pickPreset(p.id)}
                  >
                    <img src={p.icon} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                    <span>{p.short}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="tab"
                  aria-selected={cloakPresetId === 'custom'}
                  className={cx('cloak-tab-pick', cloakPresetId === 'custom' && 'on')}
                  onClick={() => pickPreset('custom')}
                >
                  <span>custom</span>
                </button>
              </div>
              <div className="cloak-preview">
                <div className="cloak-bar">
                  <span>← →</span>
                  <span>{cloakAddressHost || 'example.com'}</span>
                </div>
              </div>
            </div>

            <div className="field" style={{ marginTop: 16 }}>
              <span className="field-label">import from url</span>
              <div className="cloak-import-row">
                <input
                  value={importUrl}
                  onChange={e => { setImportUrl(e.target.value); setImportErr(''); }}
                  onPaste={onImportPaste}
                  placeholder="https://… or any domain"
                  disabled={importBusy}
                />
                <button type="button" className="btn" disabled={importBusy} onClick={runImportFromUrl}>
                  {importBusy ? '…' : 'grab'}
                </button>
              </div>
              {importErr ? <p className="cloak-import-err">{importErr}</p> : null}
            </div>

            <div className="field">
              <span className="field-label">tab title</span>
              <input value={cloakTitle} onChange={e => setCloakTitle(e.target.value)} placeholder="Classroom" />
            </div>
            <div className="field">
              <span className="field-label">icon url</span>
              <input value={cloakIcon} onChange={e => setCloakIcon(e.target.value)} placeholder="https://…/favicon.png" />
            </div>
            <div className="field">
              <span className="field-label">address bar host</span>
              <input value={cloakAddressHost} onChange={e => setCloakAddressHost(e.target.value)} placeholder="classroom.google.com" />
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button className="btn accent" onClick={() => {
                window.OneMMUN3Settings?.save({
                  title: cloakTitle,
                  icon: cloakIcon,
                  theme,
                  cloakPreset: cloakPresetId,
                  cloakHost: cloakAddressHost,
                });
                document.title = cloakTitle || '1MMUN3';
                const fav = document.querySelector("link[rel='icon']");
                if (fav && cloakIcon) fav.href = cloakIcon;
                onCloakSave?.({ title: cloakTitle, icon: cloakIcon, presetId: cloakPresetId, host: cloakAddressHost });
              }}>save</button>
              <button className="btn" onClick={() => {
                window.OneMMUN3Settings?.clear();
                const classroom = CLOAK_PRESETS.find(p => p.id === 'classroom');
                setCloakPresetId('classroom');
                setCloakTitle(classroom.title);
                setCloakIcon(classroom.icon);
                setCloakAddressHost(classroom.host);
                setImportUrl('');
                setImportErr('');
                document.title = '1MMUN3 · home';
                const fav = document.querySelector("link[rel='icon']");
                if (fav) fav.href = '/assets/foil.png';
              }}>reset</button>
            </div>
          </div>

          <div className="panel">
            <span className="panel-tag">// escape</span>
            <h3>panic key</h3>
            <p className="h-sub">double-tap to instantly ditch the page.</p>
            <div className="field">
              <span className="field-label">trigger key</span>
              <button
                className={cx('btn', 'panic-key-btn', listeningForKey && 'listening')}
                onKeyDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const k = e.key === ' ' ? 'Space' : e.key;
                  setPanicKey(k);
                  savePanic(k, panicUrl);
                  setListeningForKey(false);
                }}
                onClick={() => setListeningForKey(true)}
                onBlur={() => setListeningForKey(false)}
              >
                {listeningForKey ? 'press any key…' : panicKey}
              </button>
            </div>
            <div className="field">
              <span className="field-label">decoy url <em style={{opacity:0.5}}>(default: your cloak host)</em></span>
              <input
                value={panicUrl}
                onChange={e => { setPanicUrl(e.target.value); savePanic(panicKey, e.target.value); }}
                placeholder="classroom.google.com"
              />
            </div>
          </div>

          <div className="panel">
            <span className="panel-tag">// browser</span>
            <h3>default browser</h3>
            <p className="h-sub">set your search engine.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
              {BROWSER_OPTIONS.map(b => (
                <button
                  key={b.id}
                  type="button"
                  className={cx('browser-pick', browser === b.id && 'on')}
                  onClick={() => { setBrowser(b.id); localStorage.setItem('1MMUN3Browser', b.id); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: 12,
                    borderRadius: 7,
                    border: `1px solid ${browser === b.id ? 'var(--accent)' : 'var(--line)'}`,
                    background: 'var(--bg2)',
                    cursor: 'pointer',
                    transition: 'border-color 140ms',
                    color: 'var(--text)',
                  }}
                >
                  <img src={b.icon} alt="" style={{ width: 28, height: 28, borderRadius: 4 }} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <span className="panel-tag">// theme</span>
            <h3>palette</h3>
            <p className="h-sub">pick a vibe.</p>
            <div className="theme-grid">
              {themes.map(t => (
                <button key={t.id} className={cx('theme-swatch', theme === t.id && 'on')} onClick={() => setTheme(t.id)}>
                  <div className="pal">{t.pal.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
                  <div className="name">{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <span className="panel-tag">// cursor</span>
            <h3>cursor style</h3>
            <p className="h-sub">pick your pointer vibe.</p>
            <div className="cursor-grid">
              {CURSOR_OPTIONS.map(o => (
                <button key={o.id} className={cx('cursor-swatch', cursorStyle === o.id && 'on')} onClick={() => setCursorStyle(o.id)}>
                  <div className="cursor-preview">{o.preview}</div>
                  <div className="name">{o.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <span className="panel-tag">// flags</span>
            <h3>switches</h3>
            {toggles.map(({ key, val, set, label, sub }) => (
              <div key={key} className="toggle">
                <div className="lab">
                  <strong>{label}</strong>
                  <span>{sub}</span>
                </div>
                <button className={cx('tg-switch', val && 'on')} onClick={() => set(!val)} aria-pressed={val} />
              </div>
            ))}
          </div>

          <div className="panel">
            <span className="panel-tag">// account</span>
            <h3>account</h3>
            {user ? (
              <>
                <div className="account-info">
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" className="acct-avatar-lg" />
                    : <div className="acct-initial-lg">{(user.displayName || user.email || '?')[0].toUpperCase()}</div>
                  }
                  <div>
                    <div className="acct-name">{user.displayName || user.email?.split('@')[0]}</div>
                    <div className="acct-email">{user.email}</div>
                  </div>
                </div>
                {syncStatus && <p className={cx('sync-status', syncStatus === 'saved' && 'ok')}>{syncStatus}</p>}
                <button className="btn" style={{ marginTop: 12 }} onClick={onSignOut}>sign out</button>
              </>
            ) : (
              <>
                <p className="h-sub">sign in to sync settings and favorites across devices.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn accent" onClick={onShowAuth}>sign in</button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

const About = () => (
  <main>
    <section className="shell page-hero">
      <h1>1<em>MMUN</em>3</h1>
      <p className="lede">a lightweight proxy portal. browse, play, work. privately.</p>
    </section>

    <section className="shell about-grid">
      <div className="panel">
        <span className="panel-tag">// the deal</span>
        <h3>why this exists</h3>
        <p className="h-sub" style={{ fontSize: 14, lineHeight: 1.7 }}>
          ads everywhere, paywalls everywhere, your school blocking half the web. 1MMUN3 is a clean room. route what you need, skip the noise, don't get tracked doing it. that's the whole pitch.
        </p>
        <div className="tile-row">
          <div className="tile"><div className="num">{window.GAMES?.length ?? "—"}</div><div className="lab">games</div></div>
          <div className="tile"><div className="num">{window.APPS?.length ?? "—"}</div><div className="lab">apps</div></div>
          <div className="tile"><div className="num">0</div><div className="lab">trackers</div></div>
        </div>
        <p className="h-sub" style={{ fontSize: 13, marginTop: 20 }}>
          built on scramjet by mercury workshop. shoutout to everyone keeping the open web actually open.
        </p>
      </div>

      <div className="panel">
        <span className="panel-tag">// stack</span>
        <h3>under the hood</h3>
        <ul className="stack-list">
          <li><span className="k">games</span><span className="v"><a href="https://github.com/3kh0/3kh0-lite" target="_blank" rel="noreferrer">3kh0 lite</a> links</span><span className="stat">proxied</span></li>
          <li><span className="k">proxy</span><span className="v">scramjet</span><span className="stat">live</span></li>
          <li><span className="k">transport</span><span className="v">wisp + libcurl</span><span className="stat">on</span></li>
          <li><span className="k">server</span><span className="v">express</span><span className="stat">solid</span></li>
          <li><span className="k">ui</span><span className="v">react</span><span className="stat">clean</span></li>
          <li><span className="k">hosting</span><span className="v">node + docker</span><span className="stat">portable</span></li>
          <li><span className="k">license</span><span className="v">open source · mit</span><span className="stat">free</span></li>
        </ul>
      </div>
    </section>
  </main>
);

const Chatroom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState(() => localStorage.getItem('1MMUN3ChatUsername') || '');
  const [showNameInput, setShowNameInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const nameInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (showNameInput && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showNameInput]);

  // Load messages from Firebase
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch('https://1mmun3-b75b1-default-rtdb.firebaseio.com/chatMessages.json');
        if (response.ok) {
          const data = await response.json();
          const msgArray = data ? Object.values(data).sort((a, b) => a.timestamp - b.timestamp) : [];
          setMessages(msgArray);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !username.trim() || sending) return;

    setSending(true);
    try {
      const newMessage = {
        id: Date.now().toString(),
        username: username.trim(),
        text: input.trim(),
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const response = await fetch('https://1mmun3-b75b1-default-rtdb.firebaseio.com/chatMessages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage),
      });

      if (response.ok) {
        setInput('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleNameSave = (name) => {
    if (name.trim()) {
      localStorage.setItem('1MMUN3ChatUsername', name.trim());
      setUsername(name.trim());
      setShowNameInput(false);
    }
  };

  const clearChat = () => {
    if (confirm('Clear all messages? This action cannot be undone.')) {
      fetch('https://1mmun3-b75b1-default-rtdb.firebaseio.com/chatMessages.json', { method: 'DELETE' })
        .then(() => setMessages([]))
        .catch(err => console.error('Failed to clear chat:', err));
    }
  };

  return (
    <div style={{ position: 'fixed', top: 53, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>1MMUN3 Chatroom</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{messages.length} {messages.length === 1 ? 'message' : 'messages'}</div>
          </div>
        </div>
        <button
          onClick={clearChat}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            color: 'var(--muted)',
            padding: '6px 12px',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'var(--accent-dim)';
            e.target.style.color = 'var(--accent)';
            e.target.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = 'var(--muted)';
            e.target.style.borderColor = 'var(--line)';
          }}
        >
          Clear Chat
        </button>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', scrollBehavior: 'smooth' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 'auto', marginBottom: 'auto' }}>
            <div style={{ fontSize: '14px' }}>Loading messages...</div>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 'auto', marginBottom: 'auto' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No messages yet</div>
            <div style={{ fontSize: '13px' }}>Be the first to start the conversation!</div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: '12px', fontSize: '14px', animation: 'fadeIn 0.2s ease' }}>
            <div>
              <div style={{ color: 'var(--accent)', fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>
                {msg.username}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                {msg.time}
              </div>
            </div>
            <div style={{ flex: 1, paddingTop: '2px' }}>
              <div style={{ color: 'var(--text)', wordBreak: 'break-word', lineHeight: '1.4', fontSize: '14px' }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>
        {/* Username Section */}
        <div style={{ marginBottom: '12px' }}>
          {showNameInput ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Enter your username..."
                defaultValue={username}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleNameSave(e.target.value);
                }}
                onBlur={(e) => handleNameSave(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-dim)';
                }}
              />
              <button
                onClick={() => handleNameSave(nameInputRef.current?.value || '')}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'var(--accent)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--accent)';
                  e.target.style.color = '#000';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'var(--accent-dim)';
                  e.target.style.color = 'var(--accent)';
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <div
              onClick={() => setShowNameInput(true)}
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                padding: '8px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-dim)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--muted)';
              }}
            >
              {username ? <span>Chatting as <strong style={{ color: 'var(--accent)' }}>{username}</strong> • Click to change</span> : 'Set a username to chat'}
            </div>
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={username ? 'Say something...' : 'Set a username first...'}
            disabled={!username}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
              transition: 'border-color 150ms ease',
              opacity: username ? 1 : 0.5,
            }}
            onFocus={(e) => {
              if (username) e.target.style.borderColor = 'var(--accent-dim)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--line)';
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || !username || sending}
            style={{
              padding: '10px 20px',
              background: input.trim() && username && !sending ? 'var(--accent-dim)' : 'transparent',
              border: '1px solid var(--line)',
              color: input.trim() && username && !sending ? 'var(--accent)' : 'var(--muted)',
              borderRadius: '6px',
              cursor: input.trim() && username && !sending ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 150ms ease',
              fontFamily: 'Inter, sans-serif',
              opacity: sending ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (input.trim() && username && !sending) {
                e.target.style.background = 'var(--accent)';
                e.target.style.color = 'var(--bg)';
              }
            }}
            onMouseLeave={(e) => {
              if (input.trim() && username && !sending) {
                e.target.style.background = 'var(--accent-dim)';
                e.target.style.color = 'var(--accent)';
              }
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const SPLASHES = [
  'bypassing the matrix fr',
  'filter thought it had me 💀',
  'unbanned era activated',
  'school can\'t touch this',
  'no logs, just aura',
  'mogging the firewall daily',
  'it\'s giving unrestricted',
  'we outside (the filter)',
  'skibidi proxy rizz',
  'they can\'t stop the sigma',
  'cooked the IT department',
  'delulu to unbanned pipeline',
  'touch grass? after this',
  'brainrot secured',
  'pov: you\'re actually free',
  'rent free in the firewall',
  'gyatt damn this proxy slaps',
  'mewing through the ban',
  'ohio can\'t detect us',
  'certified filter destroyer',
  'locked in, unbannable',
  'the filter is not beating the allegations',
  'main character browsing',
  'no cap, no trace',
  'we so back it\'s scary',
  'ate the restrictions',
  'stealth mode: demon time',
  'fanum tax on the firewall',
  'this proxy is so demure',
  'real ones bypass',
  'chronically online, zero restrictions',
  'he thought he could block us',
  'peak unbothered hours',
  'giving ghost in the firewall',
  'sigma proxy grindset',
  'not detected, just respected',
  'core memory: unrestricted',
  'we goated with the sauce',
  'bussin past every block',
  'the lore stays unbanned',
  'no diddy, no logs',
  'absolutely mogging IT',
  'glazing the proxy rn',
  'rizzing up the whole internet',
  'unfiltered and unhinged',
  'welcome to the good timeline',
  'built different, blocked never',
  'the filter tried, then died',
  'skibidi toilet > school wifi',
  'your principal\'s nightmare',
  'ratio + blocked on the filter',
  'this one hits different (no vpn)',
  'edge detected ❌ proxy detected ✅',
  'serving looks and freedom',
  'npc filters can\'t stop me',
  'goon sesh = safe',
  'mid filter, mid attempt',
  'he thought he could filter us 💀',
  'not me bypassing the firewall',
  'your school wifi is cooked',
  'bypassing harder than your dad left',
];

const VOICE_PRESETS = {
  punchy: {
    headline: null,
    lede: 'paste a link and go. 1MMun3 routes it, you get there.',
  },
  chill: {
    headline: <>browse privately. <em>that's it.</em></>,
    lede: 'drop a link and go. no drama, no noise.',
  },
  serious: {
    headline: <>private browsing, <em>simplified.</em></>,
    lede: 'a clean proxy portal routing through scramjet. low noise, low leaks.',
  },
};

const App = () => {
  const [tweaks, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [page, setPageState] = useState(pageFromPath);
  const [theme, setTheme] = useState(tweaks.theme);
  const [activeItem, setActiveItem] = useState(null);

  // ── cursor ──
  const [cursorStyle, setCursorStyleState] = useState(() => localStorage.getItem('1MMUN3Cursor') || 'dot');
  const setCursorStyle = (v) => { setCursorStyleState(v); localStorage.setItem('1MMUN3Cursor', v); };

  // ── reduce motion ──
  const [reduce, setReduceState] = useState(() => {
    const v = localStorage.getItem('1MMUN3Reduce') === 'true';
    if (v) document.documentElement.setAttribute('data-reduce-motion', '');
    return v;
  });
  const setReduce = (v) => {
    setReduceState(v);
    localStorage.setItem('1MMUN3Reduce', v);
    if (v) document.documentElement.setAttribute('data-reduce-motion', '');
    else document.documentElement.removeAttribute('data-reduce-motion');
  };

  // ── big text ──
  const [bigText, setBigTextState] = useState(() => {
    const v = localStorage.getItem('1MMUN3BigText') === 'true';
    if (v) document.documentElement.setAttribute('data-big-text', '');
    return v;
  });
  const setBigText = (v) => {
    setBigTextState(v);
    localStorage.setItem('1MMUN3BigText', v);
    if (v) document.documentElement.setAttribute('data-big-text', '');
    else document.documentElement.removeAttribute('data-big-text');
  };

  // ── anti-guardian (app-level) ──
  useEffect(() => {
    const antiGuardian = localStorage.getItem('1MMUN3AntiGuardian') === 'true';
    if (!antiGuardian) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'save your work?';
      return 'save your work?';
    };

    const handleVisibilityChange = () => {
      try {
        if (document.hidden) {
          document.body.style.display = 'none';
          setTimeout(() => { if (document.hidden) document.body.style.display = ''; }, 100);
        }
      } catch (err) {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── auth ──
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const syncTimer = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;

  // ── favorites ──
  const [favorites, setFavoritesState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('1MMUN3Favorites') || '{"games":[],"apps":[]}'); }
    catch { return { games: [], apps: [] }; }
  });

  const saveFavs = (updated, uid) => {
    localStorage.setItem('1MMUN3Favorites', JSON.stringify(updated));
    if (uid) window.fbDb?.collection('proxy-users').doc(uid).set({ favorites: updated }, { merge: true }).catch(() => {});
  };

  const toggleFav = (kind, id) => {
    setFavoritesState(prev => {
      const arr = prev[kind] || [];
      const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
      const updated = { ...prev, [kind]: next };
      saveFavs(updated, userRef.current?.uid);
      return updated;
    });
  };

  // ── cloud sync helpers ──
  const cloudSettings = () => ({
    theme, cursorStyle, reduce, bigText,
    panicKey: localStorage.getItem('1MMUN3PanicKey') || 'Escape',
    panicUrl: localStorage.getItem('1MMUN3PanicUrl') || '',
  });

  const pushSettings = (extra = {}) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    clearTimeout(syncTimer.current);
    setSyncStatus('saving...');
    syncTimer.current = setTimeout(() => {
      window.fbDb?.collection('proxy-users').doc(uid)
        .set({ settings: { ...cloudSettings(), ...extra } }, { merge: true })
        .then(() => setSyncStatus('saved'))
        .catch(() => setSyncStatus('sync failed'));
    }, 1200);
  };

  const applyCloudSettings = (s) => {
    if (!s) return;
    if (s.theme)       { setTheme(s.theme); document.documentElement.setAttribute('data-theme', s.theme); }
    if (s.cursorStyle) setCursorStyleState(s.cursorStyle);
    if (s.reduce  != null) setReduce(s.reduce);
    if (s.bigText != null) setBigText(s.bigText);
    if (s.panicKey) localStorage.setItem('1MMUN3PanicKey', s.panicKey);
    if (s.panicUrl != null) localStorage.setItem('1MMUN3PanicUrl', s.panicUrl);
    if (s.cloak) {
      if (s.cloak.title) localStorage.setItem('websiteTitle', s.cloak.title);
      if (s.cloak.icon)  localStorage.setItem('websiteIcon',  s.cloak.icon);
      if (s.cloak.host)  localStorage.setItem('websiteCloakHost', s.cloak.host);
      if (s.cloak.presetId) localStorage.setItem('websiteCloakPreset', s.cloak.presetId);
    }
  };

  // ── auth listener ──
  useEffect(() => {
    if (!window.fbAuth) return;
    const unsub = window.fbAuth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await window.fbDb.collection('proxy-users').doc(u.uid).get();
          if (snap.exists) {
            const data = snap.data();
            applyCloudSettings(data.settings);
            if (data.favorites) {
              setFavoritesState(data.favorites);
              localStorage.setItem('1MMUN3Favorites', JSON.stringify(data.favorites));
            }
            setSyncStatus('saved');
          } else {
            await window.fbDb.collection('proxy-users').doc(u.uid).set({
              email: u.email,
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              settings: cloudSettings(),
              favorites,
            });
            setSyncStatus('saved');
          }
        } catch { setSyncStatus('sync failed'); }
      } else {
        setSyncStatus('');
      }
    });
    return unsub;
  }, []);

  // auto-push when toggleable settings change
  useEffect(() => { if (user) pushSettings(); }, [theme, cursorStyle, reduce, bigText]);

  const navigate = (next) => {
    const p = PAGE_KEYS.includes(next) ? next : 'home';
    setPageState(p);
    const nextPath = p === 'home' ? '/' : `/${p}`;
    if (location.pathname !== nextPath) {
      history.pushState({ spa: true, page: p }, '', nextPath);
    }
  };

  useEffect(() => {
    const syncFromUrl = () => setPageState(pageFromPath());
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => { setTheme(tweaks.theme); }, [tweaks.theme]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => {
    if (localStorage.getItem('websiteTitle')) return;
    const titles = { home: '1MMUN3 · home', games: '1MMUN3 · games', apps: '1MMUN3 · apps', tv: '1MMUN3 TV', chatroom: '1MMUN3 · chatroom', settings: '1MMUN3 · settings', about: '1MMUN3 · about' };
    document.title = titles[page] || '1MMUN3';
  }, [page]);

  useEffect(() => {
    if (typeof gtag !== 'function') return;
    const path = page === 'home' ? '/' : `/${page}`;
    gtag('event', 'page_view', { page_path: path, page_title: document.title });
  }, [page]);

  const voice = VOICE_PRESETS[tweaks.voice] || VOICE_PRESETS.punchy;
  const handleSignOut = () => window.fbAuth?.signOut().catch(() => {});
  const handleAccountClick = () => user ? navigate('settings') : setShowAuth(true);

  return (
    <>
      <CustomCursor cursorStyle={cursorStyle} />
      <TopBar page={page} navigate={navigate} user={user} onAccountClick={handleAccountClick} />

      {page === 'home'     && <Home navigate={navigate} voice={voice} />}
      {page === 'games'    && <Catalog kind="games" items={window.GAMES} tags={window.GAME_TAGS} setActiveItem={setActiveItem} favorites={favorites} toggleFav={toggleFav} />}
      {page === 'apps'     && <Catalog kind="apps"  items={window.APPS}  tags={window.APP_TAGS}  setActiveItem={setActiveItem} favorites={favorites} toggleFav={toggleFav} />}
      {page === 'tv'       && <OneMMUN3TV theme={theme} />}
      {page === 'chatroom' && <Chatroom />}
      {page === 'settings' && <Settings theme={theme} setTheme={t => { setTheme(t); setTweak('theme', t); }} cursorStyle={cursorStyle} setCursorStyle={setCursorStyle} reduce={reduce} setReduce={setReduce} bigText={bigText} setBigText={setBigText} user={user} onSignOut={handleSignOut} onShowAuth={() => setShowAuth(true)} onCloakSave={c => pushSettings({ cloak: c })} syncStatus={syncStatus} />}
      {page === 'about'    && <About />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <LaunchModal item={activeItem} onClose={() => setActiveItem(null)} />

      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title="Theme">
          <TweakRadio
            label="Palette"
            value={tweaks.theme}
            options={[
              { value: 'midnight',  label: 'midnight'  },
              { value: 'daylight',  label: 'daylight'  },
              { value: 'acid',      label: 'acid'      },
              { value: 'bubblegum', label: 'bubblegum' },
            ]}
            onChange={v => setTweak('theme', v)}
          />
        </TweakSection>
        <TweakSection title="Voice">
          <TweakRadio
            label="Tone"
            value={tweaks.voice}
            options={[
              { value: 'punchy',  label: 'punchy'  },
              { value: 'chill',   label: 'chill'   },
              { value: 'serious', label: 'serious' },
            ]}
            onChange={v => setTweak('voice', v)}
          />
        </TweakSection>
        <TweakSection title="Jump to">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PAGE_KEYS.map(p => (
              <button key={p} type="button" className="chip" onClick={() => navigate(p)}>{PAGE_LABELS[p] || p}</button>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
