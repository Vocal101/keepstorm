'use strict';
// Online 1v1 over WebRTC (PeerJS). One player hosts and runs the simulation; the other mirrors it.
// Quick Match uses a handful of well-known lobby IDs so two strangers can find each other without a server of our own.

const Net = (() => {
  const PREFIX = 'keepstorm-v' + NET_VER + '-';
  const QM_SLOTS = 5;
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const N = { mode: 'off', peer: null, conn: null, code: '', onMsg: null, onClose: null, busy: false };

  function available() { return typeof Peer !== 'undefined'; }
  function genCode() { let s = ''; for (let i = 0; i < 5; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }
  function errText(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return 'No room with that code. Check it and try again.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the matchmaking server. Check your internet connection.';
    if (t === 'browser-incompatible') return 'This browser does not support online play.';
    return 'Connection error' + (t ? ' (' + t + ')' : '') + '.';
  }

  function close() {
    try { if (N.conn) N.conn.close(); } catch (e) { /* ignore */ }
    try { if (N.peer) N.peer.destroy(); } catch (e) { /* ignore */ }
    N.peer = null; N.conn = null; N.mode = 'off'; N.code = ''; N.busy = false;
  }

  function wireConn(conn) {
    N.conn = conn;
    conn.on('data', d => { if (d && typeof d === 'object' && N.onMsg) N.onMsg(d); });
    conn.on('close', () => { if (N.conn === conn && N.onClose) N.onClose('Your opponent disconnected.'); });
    conn.on('error', () => { /* close handles it */ });
  }

  // ---------------------------------------------------------------- hosting
  // onGuest(profile) is called once a compatible player joins; it must return the start config to send.
  function host(profile, opt, cb) {
    if (!available()) { cb('Online play needs the PeerJS library, which did not load.'); return; }
    close();
    const code = opt.id || genCode();
    N.mode = 'host'; N.code = code;
    const peer = new Peer(PREFIX + code, { debug: 0 });
    N.peer = peer;
    let opened = false;
    peer.on('open', () => { opened = true; cb(null, code); });
    peer.on('connection', conn => {
      conn.on('open', () => {
        if (N.busy) { conn.send({ t: 'deny', why: 'busy' }); setTimeout(() => conn.close(), 300); return; }
        conn.once('data', d => {
          if (!d || d.t !== 'hello') return;
          if (d.ver !== NET_VER) { conn.send({ t: 'deny', why: 'Your game version does not match. Refresh the page.' }); return; }
          if (N.busy) { conn.send({ t: 'deny', why: 'busy' }); return; }
          N.busy = true;
          wireConn(conn);
          const startCfg = opt.onGuest(sanitizeProfile(d.profile));
          conn.send({ t: 'start', cfg: startCfg });
          if (opt.onStarted) opt.onStarted(startCfg);
        });
      });
    });
    peer.on('error', e => {
      if (!opened && e.type === 'unavailable-id') { if (opt.onTaken) { close(); opt.onTaken(); return; } close(); host(profile, Object.assign({}, opt, { id: null }), cb); return; }
      if (!opened) cb(errText(e)); else if (!N.conn && opt.onError) opt.onError(errText(e));
    });
    peer.on('disconnected', () => { try { if (!N.conn) peer.reconnect(); } catch (e) { /* ignore */ } });
  }

  // ---------------------------------------------------------------- joining
  function join(code, profile, cb, opt = {}) {
    if (!available()) { cb('Online play needs the PeerJS library, which did not load.'); return; }
    if (!opt.keepPeer) close();
    code = String(code).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const run = peer => {
      N.mode = 'client'; N.code = code;
      let done = false;
      const fail = msg => { if (done) return; done = true; clearTimeout(timer); cb(msg); };
      const timer = setTimeout(() => fail('timeout'), opt.timeout || 12000);
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const onPeerErr = e => { if (e.type === 'peer-unavailable') fail('unavailable'); else fail(errText(e)); };
      peer.once('error', onPeerErr);
      conn.on('open', () => conn.send({ t: 'hello', ver: NET_VER, profile }));
      conn.on('data', d => {
        if (done) return;
        if (d.t === 'deny') { fail(d.why || 'denied'); try { conn.close(); } catch (e) { /* ignore */ } return; }
        if (d.t === 'start') { done = true; clearTimeout(timer); peer.off && peer.off('error', onPeerErr); wireConn(conn); cb(null, d.cfg); }
      });
    };
    if (opt.keepPeer && N.peer && N.peer.open) run(N.peer);
    else {
      const peer = new Peer({ debug: 0 });
      N.peer = peer;
      peer.on('open', () => run(peer));
      peer.on('error', e => { if (!peer.open) cb(errText(e)); });
    }
  }

  // ---------------------------------------------------------------- quick match
  let qmCancel = null;
  function quickMatch(profile, opt) {
    // opt: { onStatus(text), onGuest(profile) -> cfg, onStart(cfg, role) , onFail(msg) }
    if (!available()) { opt.onFail('Online play needs the PeerJS library, which did not load.'); return; }
    close();
    let cancelled = false;
    qmCancel = () => { cancelled = true; close(); };
    const slots = []; for (let i = 0; i < QM_SLOTS; i++) slots.push(i);
    const peer = new Peer({ debug: 0 });
    N.peer = peer;
    let freeSlot = -1;
    const tryHost = () => {
      if (cancelled) return;
      const slot = freeSlot >= 0 ? freeSlot : Math.floor(Math.random() * QM_SLOTS);
      opt.onStatus('Waiting for an opponent...');
      try { peer.destroy(); } catch (e) { /* ignore */ }
      host(profile, {
        id: 'QM-' + slot,
        onGuest: p => opt.onGuest(p),
        onStarted: cfg => { if (!cancelled) opt.onStart(cfg, 'host'); },
        onTaken: () => { if (cancelled) return; opt.onStatus('Found a lobby, joining...'); join('QM-' + slot, profile, (err, cfg) => { if (cancelled) return; if (err) { opt.onFail(err === 'busy' ? 'That lobby filled up. Try again.' : err); return; } opt.onStart(cfg, 'client'); }); },
        onError: msg => opt.onFail(msg),
      }, (err) => { if (cancelled) return; if (err) opt.onFail(err); });
    };
    const probe = i => {
      if (cancelled) return;
      if (i >= slots.length) { tryHost(); return; }
      opt.onStatus('Searching for opponents (' + (i + 1) + '/' + slots.length + ')...');
      join('QM-' + slots[i], profile, (err, cfg) => {
        if (cancelled) return;
        if (!err) { opt.onStart(cfg, 'client'); return; }
        if (err === 'unavailable' && freeSlot < 0) freeSlot = slots[i];
        probe(i + 1);
      }, { keepPeer: true, timeout: 4000 });
    };
    peer.on('open', () => probe(0));
    peer.on('error', e => { if (!peer.open && !cancelled) opt.onFail(errText(e)); });
  }
  function cancelQuick() { if (qmCancel) qmCancel(); qmCancel = null; }

  function sanitizeProfile(p) {
    p = p || {};
    const deck = Array.isArray(p.deck) ? p.deck.filter(id => CARD[id]).slice(0, 8) : [];
    while (deck.length < 8) { const c = CARDS.find(x => !deck.includes(x.id) && x.rarity === 'common'); deck.push(c.id); }
    return {
      name: String(p.name || 'Player').slice(0, 16), lvl: clamp(p.lvl | 0, 1, 15), deck,
      asc: (Array.isArray(p.asc) ? p.asc : []).filter(id => CARD[id] && CARD[id].asc && deck.includes(id)).slice(0, 2),
      defender: DEFENDERS[p.defender] ? p.defender : 'bow_sisters', skin: TOWER_SKINS[p.skin] ? p.skin : 'stone',
    };
  }

  function send(msg) { if (N.conn && N.conn.open) N.conn.send(msg); }
  function toHost(msg) { send(msg); }

  return Object.assign(N, { host, join, quickMatch, cancelQuick, close, send, toHost, available, sanitizeProfile });
})();
