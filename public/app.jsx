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
      /* Ads bounce the ball too: resting the logo on a unit obstructs it, which
         is both ugly and something ad networks treat as a policy problem. */
      '.ad-slot',
    ];

    function topLimit() {
      const topbar = document.querySelector('.topbar');
      return topbar ? topbar.getBoundingClientRect().bottom : 56;
    }

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
        p.x = window.innerWidth / 2 - SIZE / 2;
        p.y = Math.max(topLimit() + 4, rect.top - SIZE - 44);
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

      const topBound = topLimit();
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

/** Firebase now returns bare "Firebase: Error (auth/CODE)." strings, so the code
 *  is the only thing worth reading — the message has nothing left in it. */
const AUTH_ERRORS = {
  'auth/invalid-login-credentials': 'wrong email or password.',
  'auth/invalid-credential': 'wrong email or password.',
  'auth/wrong-password': 'wrong email or password.',
  'auth/user-not-found': 'no account with that email.',
  'auth/invalid-email': "that doesn't look like a valid email.",
  'auth/missing-password': 'enter a password.',
  'auth/missing-email': 'enter your email.',
  'auth/email-already-in-use': 'an account with that email already exists.',
  'auth/weak-password': 'password needs to be at least 6 characters.',
  'auth/too-many-requests': 'too many attempts. wait a minute, then try again.',
  'auth/network-request-failed': 'network problem — check your connection.',
  'auth/user-disabled': 'that account has been disabled.',
  'auth/operation-not-allowed': 'that sign-in method is turned off.',
};

const AuthModal = ({ onClose }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const clearErr = () => { setErr(''); setNotice(''); };

  const fmtErr = (e) => {
    if (AUTH_ERRORS[e?.code]) return AUTH_ERRORS[e.code];
    const msg = (e?.message || '')
      .replace('Firebase: ', '')
      .replace(/ \(auth\/[^)]+\)\.?$/, '')
      .trim();
    return msg && msg.toLowerCase() !== 'error' ? msg : 'something went wrong. try again.';
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setBusy(true); setErr(''); setNotice('');
    try {
      if (mode === 'reset') {
        try {
          await window.fbAuth.sendPasswordResetEmail(email.trim());
        } catch (e) {
          // answer the same way either way, so this can't be used to check
          // whether an address has an account
          if (e.code !== 'auth/user-not-found') throw e;
        }
        setNotice("if an account exists for that email, a reset link is on its way. check your spam folder.");
        return;
      }
      if (mode === 'login') {
        await window.fbAuth.signInWithEmailAndPassword(email, password);
      } else {
        const cred = await window.fbAuth.createUserWithEmailAndPassword(email, password);
        if (displayName.trim()) await cred.user.updateProfile({ displayName: displayName.trim() });
        // don't block account creation if the mail fails to send — it can be
        // resent from settings
        await cred.user.sendEmailVerification().catch(() => {});
      }
      onClose();
    } catch (e) { setErr(fmtErr(e)); }
    finally { setBusy(false); }
  };

  const TITLES = { login: 'sign in', signup: 'create account', reset: 'reset password' };
  const ACTIONS = { login: 'sign in', signup: 'sign up', reset: 'send reset link' };

  const go = (m) => { setMode(m); setErr(''); setNotice(''); };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-meta">
            <div className="kind">tinf0il</div>
            <h3>{TITLES[mode]}</h3>
          </div>
        </div>
        {mode === 'reset' && (
          <p className="auth-hint">enter your email and we'll send you a link to set a new password.</p>
        )}
        <form className="auth-fields" onSubmit={submit}>
          {mode === 'signup' && (
            <input className="auth-input" placeholder="display name (optional)" value={displayName} onChange={e => { setDisplayName(e.target.value); clearErr(); }} />
          )}
          <input className="auth-input" type="email" placeholder="email" value={email} onChange={e => { setEmail(e.target.value); clearErr(); }} required />
          {mode !== 'reset' && (
            <input className="auth-input" type="password" placeholder="password" value={password} onChange={e => { setPassword(e.target.value); clearErr(); }} required minLength={6} />
          )}
          {err && <p className="auth-err">{err}</p>}
          {notice && <p className="auth-notice">{notice}</p>}
          <button className="btn accent" type="submit" disabled={busy}>{busy ? '...' : ACTIONS[mode]}</button>
        </form>
        {mode === 'login' && (
          <p className="auth-switch">
            <button type="button" onClick={() => go('reset')}>forgot password?</button>
          </p>
        )}
        <p className="auth-switch">
          {mode === 'signup' || mode === 'reset' ? 'already have an account? ' : "don't have an account? "}
          <button type="button" onClick={() => go(mode === 'login' ? 'signup' : 'login')}>
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
          <span>tinf<em>0</em>il</span>
        </a>
        <nav className="nav-pill">
          {pages.map(p => (
            <button key={p} type="button" className={cx(page === p && 'active')} onClick={() => navigate(p)}>{PAGE_LABELS[p] || p}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        <a className="status-chip" href="https://discord.gg/rYWBs6Hezs" target="_blank" rel="noopener noreferrer">
          get more links ↗
        </a>
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
      <span className="small">tinf0il · aluminum depot</span>
      <span className="small">no logs. no leaks.</span>
      <a className="small" href="https://github.com/Aluminum-Depot" target="_blank" rel="noopener noreferrer">github ↗</a>
    </div>
  </footer>
);

/* Adsterra units.

   Two different embed mechanisms here, hence two render paths:

   - native: invoke.js hunts for `container-<id>` in the DOM at load time, so the
     container must exist before the script runs — hence the manual append order
     rather than plain JSX.

   - banner: invoke.js reads a *global* `atOptions` set by an inline script just
     above it. Two banners on one page would clobber each other's globals and race,
     so each one gets its own srcdoc iframe — a separate window, a separate
     `atOptions`. This is also what keeps the ad's own DOM out of ours.

   Both re-mount on page change, which is what Adsterra expects for a fresh
   impression. */
const AD_UNITS = {
  native: {
    type: 'native',
    id:   'c19feb71b6e6124467c76c1b353dd0d9',
    src:  'https://pl30385267.effectivecpmnetwork.com/c19feb71b6e6124467c76c1b353dd0d9/invoke.js',
  },
  banner728: { type: 'banner', key: 'b96808397c479bcdeab00c4d97c9e2f1', width: 728, height: 90  },
  banner300: { type: 'banner', key: '068fa43f3df751a09683d559c819e18f', width: 300, height: 250 },
  sky160:    { type: 'banner', key: '0b7fd6b2125a6f37356ac2638db9c719', width: 160, height: 600 },
};

const bannerSrcDoc = cfg => {
  const opts = JSON.stringify({
    key: cfg.key, format: 'iframe', height: cfg.height, width: cfg.width, params: {},
  });
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body>',
    '<script>atOptions = ' + opts + ';<\/script>',
    '<script src="https://www.highperformanceformat.com/' + cfg.key + '/invoke.js"><\/script>',
    '</body></html>',
  ].join('');
};

const AdSlot = ({ unit, className }) => {
  const hostRef = useRef(null);
  const cfg = AD_UNITS[unit];
  const isNative = cfg?.type === 'native';

  useEffect(() => {
    if (!isNative) return;
    const host = hostRef.current;
    if (!host) return;

    const container = document.createElement('div');
    container.id = `container-${cfg.id}`;
    host.appendChild(container);

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = cfg.src;
    host.appendChild(script);

    return () => { host.innerHTML = ''; };
  }, [cfg, isNative]);

  if (!cfg) return null;

  if (isNative) return <div className={cx('ad-slot', className)} ref={hostRef} />;

  return (
    <div className={cx('ad-slot', className)}>
      <iframe
        className="ad-frame"
        title="advertisement"
        srcDoc={bannerSrcDoc(cfg)}
        width={cfg.width}
        height={cfg.height}
        scrolling="no"
        loading="lazy"
      />
    </div>
  );
};

/* Media-query gate. Both ad layouts below swap on viewport width, and both have
   to do it in JS rather than CSS: a unit hidden with display:none still loads and
   books an impression nobody can see. */
const useMinWidth = px => {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = e => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};

/* 728x90 needs a ~740px shell to sit in; below that the 300x250 carries the slot. */
const ResponsiveBanner = ({ className }) => {
  const wide = useMinWidth(780);
  return <AdSlot unit={wide ? 'banner728' : 'banner300'} className={className} />;
};

/* Rails flanking the 860px shell. 1240px is the floor that fits both: the shell
   plus two 160px rails plus their gutters. Narrower than that, the page simply
   has no ads rather than cramped ones. */
const SideRails = () => {
  const room = useMinWidth(1240);
  if (!room) return null;
  return (
    <>
      <AdSlot unit="sky160" className="side-rail side-rail--left" />
      <AdSlot unit="sky160" className="side-rail side-rail--right" />
    </>
  );
};

const Home = ({ navigate, voice }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);
  const [splash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);

  const launch = async e => {
    e?.preventDefault();
    if (!query.trim()) { setStatus({ msg: 'paste something first', warn: true }); return; }
    const url = window.Tinf0il?.normalizeUrl(query.trim());
    setStatus({ msg: 'starting proxy...' });
    try {
      await window.Tinf0ilProxy.open(url);
    } catch (err) {
      setStatus({ msg: err.message || 'proxy failed.', warn: true });
    }
  };

  return (
    <main className="home">
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
          <button className="btn" onClick={() => window.Tinf0il?.openBlank()}>about:blank</button>
<a className="btn discord-btn" href="https://discord.gg/rYWBs6Hezs" target="_blank" rel="noopener noreferrer" data-tooltip="windows exploits · school unblocking · web proxy community">
            join the discord ↗
          </a>
        </div>

        {status && (
          <div className={cx('status-line', status.warn ? 'warn' : 'ok')}>
            {status.msg}
          </div>
        )}
      </section>

      <section className="shell">
        <ResponsiveBanner />
      </section>

      <Footer />
    </main>
  );
};

// NB: must not be named `Proxy`. A top-level const in a classic script creates a
// global lexical binding that shadows globalThis.Proxy for every script on the
// page — Firebase's bundled idb then called this component instead of the real
// constructor, throwing "Invalid hook call" inside sign-up.
const ProxyPanel = ({ navigate }) => {
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
    const url = window.Tinf0il?.normalizeUrl(query.trim());
    const display = query.replace(/^https?:\/\//, '').slice(0, 40);
    setHistory(h => [{ url: display, t: 'just now' }, ...h.slice(0, 4)]);
    setStatus(`routing → ${display}...`);
    setQuery('');
    try {
      await window.Tinf0ilProxy.open(url);
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
          <button className="btn" onClick={() => window.Tinf0il?.openBlank()}>about:blank</button>
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

        <ResponsiveBanner />

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

        <AdSlot unit="native" />
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

const Tinf0ilTV = ({ theme }) => {
  const [status, setStatus] = useState('loading');
  const iframeRef = useRef(null);

  // If the user navigated directly to a TV sub-path (e.g. /tv/sports),
  // start the iframe there instead of always at /tv/
  const [iframeSrc] = useState(() => {
    const p = location.pathname;
    return p.startsWith('/tv/') ? (p + location.search) : '/tv/';
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
      let style = doc.getElementById('tinf0il-accent');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'tinf0il-accent';
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
            <span className="tv-loading-label">tinf<em>0</em>il TV</span>
            <div className="tv-loading-bar"><div className="tv-loading-fill" /></div>
            <p className="tv-loading-notice">⚠ Streaming players may open popup ads upon clicking Close them and playback continues normally</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="tv-loading">
          <div className="tv-loading-inner">
            <img src="/assets/foil.png" alt="" className="tv-loading-logo" />
            <span className="tv-loading-label">tinf<em>0</em>il TV</span>
            <p className="tv-err">TV app isn't running — start the server then refresh.</p>
          </div>
        </div>
      )}
      <section
        className="tv-app-frame-wrap"
        aria-label="tinf0il TV"
        style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
        onMouseEnter={enterFrame}
        onMouseLeave={leaveFrame}
      >
        <iframe
          ref={iframeRef}
          className="tv-app-frame"
          title="tinf0il TV"
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

const VerifyNotice = ({ user }) => {
  const [state, setState] = useState('idle');

  const resend = async () => {
    setState('sending');
    try {
      await user.sendEmailVerification();
      setState('sent');
    } catch (e) {
      setState(e.code === 'auth/too-many-requests' ? 'throttled' : 'failed');
    }
  };

  // emailVerified is baked into the cached token, so it stays stale until the
  // user object is refreshed from the server
  const recheck = async () => {
    setState('checking');
    await user.reload().catch(() => {});
    setState(user.emailVerified ? 'verified' : 'still-unverified');
  };

  const MESSAGES = {
    sent: 'verification email sent. check your spam folder.',
    throttled: 'too many requests. wait a minute, then try again.',
    failed: "couldn't send that. try again in a moment.",
    verified: 'verified — refresh the page.',
    'still-unverified': 'not verified yet. click the link in your email first.',
  };

  return (
    <div className="verify-notice">
      <p className="auth-hint" style={{ margin: 0 }}>
        your email isn&apos;t verified yet.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn" type="button" onClick={resend} disabled={state === 'sending'}>
          {state === 'sending' ? '...' : 'resend email'}
        </button>
        <button className="btn" type="button" onClick={recheck} disabled={state === 'checking'}>
          {state === 'checking' ? '...' : 'i verified it'}
        </button>
      </div>
      {MESSAGES[state] && (
        <p className={state === 'failed' || state === 'throttled' || state === 'still-unverified' ? 'auth-err' : 'auth-notice'}>
          {MESSAGES[state]}
        </p>
      )}
    </div>
  );
};

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

  const [panicKey, setPanicKey] = useState(() => localStorage.getItem('tinf0ilPanicKey') || 'Escape');
  const [panicUrl, setPanicUrl] = useState(() => localStorage.getItem('tinf0ilPanicUrl') || '');
  const [listeningForKey, setListeningForKey] = useState(false);

  const savePanic = (key, url) => {
    localStorage.setItem('tinf0ilPanicKey', key);
    if (url.trim()) localStorage.setItem('tinf0ilPanicUrl', url.trim());
    else localStorage.removeItem('tinf0ilPanicUrl');
  };

  const themes = [
    { id: 'midnight', name: 'midnight', pal: ['#07090d', '#69b4cc', '#334'] },
    { id: 'daylight', name: 'daylight', pal: ['#f0ede8', '#4a8a74', '#ccc'] },
    { id: 'acid',     name: 'acid',     pal: ['#0c0c0f', '#7eb8a4', '#1a2'] },
    { id: 'bubblegum',name: 'bubblegum',pal: ['#120910', '#c47aaa', '#412'] },
  ];

  const toggles = [
    { key: 'autoBlank', val: autoBlank, set: setAutoBlank, label: 'auto about:blank', sub: 'open everything in a cloak window by default.' },
    { key: 'stealth',   val: stealth,   set: setStealth,   label: 'stealth route',    sub: 'strip referrers and telemetry on every jump.' },
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
          <DomainPanel user={user} onShowAuth={onShowAuth} />

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
                window.Tinf0ilSettings?.save({
                  title: cloakTitle,
                  icon: cloakIcon,
                  theme,
                  cloakPreset: cloakPresetId,
                  cloakHost: cloakAddressHost,
                });
                document.title = cloakTitle || 'tinf0il';
                const fav = document.querySelector("link[rel='icon']");
                if (fav && cloakIcon) fav.href = cloakIcon;
                onCloakSave?.({ title: cloakTitle, icon: cloakIcon, presetId: cloakPresetId, host: cloakAddressHost });
              }}>save</button>
              <button className="btn" onClick={() => {
                window.Tinf0ilSettings?.clear();
                const classroom = CLOAK_PRESETS.find(p => p.id === 'classroom');
                setCloakPresetId('classroom');
                setCloakTitle(classroom.title);
                setCloakIcon(classroom.icon);
                setCloakAddressHost(classroom.host);
                setImportUrl('');
                setImportErr('');
                document.title = 'tinf0il · home';
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
                {!user.emailVerified && <VerifyNotice user={user} />}
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

      <SideRails />
    </main>
  );
};

const ACM_LABELS = {
  'cert issued': { text: 'live', tone: 'ok' },
  'in-progress': { text: 'issuing certificate...', tone: 'wait' },
  pending: { text: 'waiting for dns', tone: 'wait' },
  failing: { text: 'failing — check your cname', tone: 'bad' },
  failed: { text: 'failed — check your cname', tone: 'bad' },
};

const DomainPanel = ({ user, onShowAuth }) => {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mine, setMine] = useState([]);

  const load = async host => {
    const res = await fetch(`/api/domains/${encodeURIComponent(host)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'could not check that domain');
    return data;
  };

  const userDoc = () => window.fbDb?.collection('proxy-users').doc(user.uid);

  /**
   * Heroku has no per-domain owner field, so the claim list lives on the user's
   * own document. Statuses always come from the server, never from what's stored
   * here — a domain reaped for never being pointed shows up as released.
   */
  const loadMine = async () => {
    if (!user || !window.fbDb) return;
    try {
      const snap = await userDoc().get();
      const list = (snap.exists && snap.data().domains) || [];
      const rows = await Promise.all(
        list.map(h => load(h).catch(() => ({ domain: h, status: 'released', pointed: false }))),
      );
      setMine(rows);
    } catch { /* sync unavailable — the claim form still works */ }
  };

  const remember = async host => {
    if (!user || !window.fbDb) return;
    await userDoc()
      .set({ domains: firebase.firestore.FieldValue.arrayUnion(host) }, { merge: true })
      .catch(() => {});
  };

  const forget = async host => {
    if (!user || !window.fbDb) return;
    await userDoc()
      .set({ domains: firebase.firestore.FieldValue.arrayRemove(host) }, { merge: true })
      .catch(() => {});
    setMine(m => m.filter(d => d.domain !== host));
  };

  useEffect(() => { loadMine(); }, [user?.uid]);

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      // re-claiming a domain we already hold returns its details, not an error
      if (!res.ok) throw new Error(data.error || 'something went wrong');
      setResult(data);
      await remember(data.domain);
      loadMine();
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };

  // poll until the cert lands, then stop
  useEffect(() => {
    if (!result || result.status === 'cert issued') return;
    const id = setInterval(() => {
      load(result.domain).then(setResult).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [result?.domain, result?.status]);

  const copy = () => {
    navigator.clipboard.writeText(result.target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  const state = result && (ACM_LABELS[result.status] || ACM_LABELS.pending);

  return (
    <div className="panel">
      <span className="panel-tag">// custom domain</span>
      <h3>bring your own domain</h3>
      <p className="h-sub">point a domain at tinf0il and get your own private link. https is automatic.</p>

      {!user ? (
        <>
          <p className="h-sub" style={{ marginTop: 14 }}>
            sign in first — domains are tied to your account so you can check on them later.
          </p>
          <button className="btn accent" type="button" onClick={onShowAuth} style={{ marginTop: 12 }}>
            sign in
          </button>
        </>
      ) : (
        <>
          <form className="field" onSubmit={submit} style={{ marginTop: 16 }}>
            <span className="field-label">your domain</span>
            <input
              placeholder="meals.mooo.com"
              value={domain}
              onChange={e => { setDomain(e.target.value); setErr(''); }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              required
            />
            <button className="btn accent" type="submit" disabled={busy} style={{ marginTop: 10 }}>
              {busy ? '...' : result ? 'check again' : 'claim it'}
            </button>
          </form>
          {err && <p className="auth-err">{err}</p>}
        </>
      )}

      {result && (
        <>
          <div className="field" style={{ marginTop: 18 }}>
            <span className="field-label">add a cname on {result.domain} pointing to</span>
            <input value={result.target || ''} readOnly onFocus={e => e.target.select()} />
            <button className="btn" type="button" onClick={copy} style={{ marginTop: 10 }}>
              {copied ? 'copied ✓' : 'copy'}
            </button>
          </div>
          <ul className="stack-list">
            <li>
              <span className="k">cname</span>
              <span className="v">{result.pointed ? 'detected' : 'not detected yet'}</span>
              <span className="stat">{result.pointed ? 'ok' : 'waiting'}</span>
            </li>
            <li>
              <span className="k">https</span>
              <span className="v">{state.text}</span>
              <span className="stat">{state.tone}</span>
            </li>
          </ul>
          {result.detail && (
            <p className="h-sub" style={{ fontSize: 13, marginTop: 12 }}>{result.detail}</p>
          )}
          <p className="h-sub" style={{ fontSize: 13, marginTop: 16 }}>
            {result.status === 'cert issued'
              ? <>you're live — open <a href={`https://${result.domain}`} target="_blank" rel="noreferrer">https://{result.domain}</a></>
              : 'this refreshes itself. dns can take up to an hour. keep the record in place or the domain is released after a day.'}
          </p>
        </>
      )}

      {user && mine.length > 0 && (
        <>
          <span className="field-label" style={{ display: 'block', marginTop: 22 }}>your domains</span>
          <ul className="stack-list">
            {mine.map(d => {
              const s = d.status === 'released'
                ? { text: 'released', tone: 'gone' }
                : (ACM_LABELS[d.status] || ACM_LABELS.pending);
              return (
                <li key={d.domain}>
                  <span className="k">{s.tone}</span>
                  <span className="v">
                    {d.status === 'cert issued'
                      ? <a href={`https://${d.domain}`} target="_blank" rel="noreferrer">{d.domain}</a>
                      : d.domain}
                  </span>
                  <span className="stat">
                    {d.status === 'released'
                      ? <button className="link-btn" type="button" onClick={() => forget(d.domain)}>remove</button>
                      : (d.pointed ? s.text : 'waiting for dns')}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="h-sub" style={{ fontSize: 13, marginTop: 16 }}>
        no domain yet? buying one is the better move — a domain of your own is far less
        likely to get blocked than a shared free one, and they start under $2 a year:{' '}
        <a href="https://porkbun.com/" target="_blank" rel="noreferrer">porkbun</a>,{' '}
        <a href="https://www.namecheap.com/" target="_blank" rel="noreferrer">namecheap</a>,{' '}
        <a href="https://www.ionos.com/" target="_blank" rel="noreferrer">ionos</a>, or{' '}
        <a href="https://www.godaddy.com/" target="_blank" rel="noreferrer">godaddy</a>.
      </p>
      <p className="h-sub" style={{ fontSize: 13, marginTop: 10 }}>
        want free instead? <a href="https://freedns.afraid.org/" target="_blank" rel="noreferrer">freedns</a>{' '}
        works — pick a shared domain from the{' '}
        <a href="https://publicsuffix.org/list/" target="_blank" rel="noreferrer">public suffix list</a>{' '}
        (mooo.com, crabdance.com, us.to) so you get your own certificate quota instead of
        sharing one with strangers.
      </p>
    </div>
  );
};

const About = () => (
  <main>
    <section className="shell page-hero">
      <h1>tinf<em>0</em>il</h1>
      <p className="lede">a lightweight proxy portal. browse, play, work. privately.</p>
    </section>

    <section className="shell about-grid">
      <div className="panel">
        <span className="panel-tag">// the deal</span>
        <h3>why this exists</h3>
        <p className="h-sub" style={{ fontSize: 14, lineHeight: 1.7 }}>
          ads everywhere, paywalls everywhere, your school blocking half the web. tinf0il is a clean room. route what you need, skip the noise, don't get tracked doing it. that's the whole pitch.
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

    <SideRails />
  </main>
);

const WIDGETBOT_SERVER = '1065018473459228783';
const WIDGETBOT_CHANNEL = '1095365023414616255';

const Chatroom = () => {
  return (
    <div style={{ position: 'fixed', top: 53, left: 0, right: 0, bottom: 0 }}>
      <iframe
        src={`https://e.widgetbot.io/channels/${WIDGETBOT_SERVER}/${WIDGETBOT_CHANNEL}`}
        title="tinf0il chatroom"
        allow="clipboard-write; fullscreen"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
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
    lede: 'paste a link and go. tinf0il routes it, you get there.',
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
  const [cursorStyle, setCursorStyleState] = useState(() => localStorage.getItem('tinf0ilCursor') || 'dot');
  const setCursorStyle = (v) => { setCursorStyleState(v); localStorage.setItem('tinf0ilCursor', v); };

  // ── reduce motion ──
  const [reduce, setReduceState] = useState(() => {
    const v = localStorage.getItem('tinf0ilReduce') === 'true';
    if (v) document.documentElement.setAttribute('data-reduce-motion', '');
    return v;
  });
  const setReduce = (v) => {
    setReduceState(v);
    localStorage.setItem('tinf0ilReduce', v);
    if (v) document.documentElement.setAttribute('data-reduce-motion', '');
    else document.documentElement.removeAttribute('data-reduce-motion');
  };

  // ── big text ──
  const [bigText, setBigTextState] = useState(() => {
    const v = localStorage.getItem('tinf0ilBigText') === 'true';
    if (v) document.documentElement.setAttribute('data-big-text', '');
    return v;
  });
  const setBigText = (v) => {
    setBigTextState(v);
    localStorage.setItem('tinf0ilBigText', v);
    if (v) document.documentElement.setAttribute('data-big-text', '');
    else document.documentElement.removeAttribute('data-big-text');
  };

  // ── auth ──
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const syncTimer = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;

  // ── favorites ──
  const [favorites, setFavoritesState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tinf0ilFavorites') || '{"games":[],"apps":[]}'); }
    catch { return { games: [], apps: [] }; }
  });

  const saveFavs = (updated, uid) => {
    localStorage.setItem('tinf0ilFavorites', JSON.stringify(updated));
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
    panicKey: localStorage.getItem('tinf0ilPanicKey') || 'Escape',
    panicUrl: localStorage.getItem('tinf0ilPanicUrl') || '',
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
    if (s.panicKey) localStorage.setItem('tinf0ilPanicKey', s.panicKey);
    if (s.panicUrl != null) localStorage.setItem('tinf0ilPanicUrl', s.panicUrl);
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
    // Firebase propagates auth state through these listeners, so anything that
    // stalls in here leaves sign-in and sign-up hanging. Firestore retries with
    // backoff rather than failing fast, so it must be bounded.
    const withTimeout = (p, ms = 8000) =>
      Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('sync timed out')), ms))]);

    const unsub = window.fbAuth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await withTimeout(window.fbDb.collection('proxy-users').doc(u.uid).get());
          if (snap.exists) {
            const data = snap.data();
            applyCloudSettings(data.settings);
            if (data.favorites) {
              setFavoritesState(data.favorites);
              localStorage.setItem('tinf0ilFavorites', JSON.stringify(data.favorites));
            }
            setSyncStatus('saved');
          } else {
            // offline writes stay pending until the server acks, so bound this too
            await withTimeout(window.fbDb.collection('proxy-users').doc(u.uid).set({
              email: u.email,
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              settings: cloudSettings(),
              favorites,
            }));
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
    const titles = { home: 'tinf0il · home', games: 'tinf0il · games', apps: 'tinf0il · apps', tv: 'tinf0il TV', chatroom: 'tinf0il · chatroom', settings: 'tinf0il · settings', about: 'tinf0il · about' };
    document.title = titles[page] || 'tinf0il';
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
      <CustomCursor cursorStyle={(page === 'tv' || page === 'chatroom') ? 'off' : cursorStyle} />
      <TopBar page={page} navigate={navigate} user={user} onAccountClick={handleAccountClick} />

      {page === 'home'     && <Home navigate={navigate} voice={voice} />}
      {page === 'games'    && <Catalog kind="games" items={window.GAMES} tags={window.GAME_TAGS} setActiveItem={setActiveItem} favorites={favorites} toggleFav={toggleFav} />}
      {page === 'apps'     && <Catalog kind="apps"  items={window.APPS}  tags={window.APP_TAGS}  setActiveItem={setActiveItem} favorites={favorites} toggleFav={toggleFav} />}
      {page === 'tv'       && <Tinf0ilTV theme={theme} />}
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
