// ---------- O'yin qoidalari (rus shashkasi) ----------
const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const side = (p) => (p || "").toLowerCase();
const other = (t) => (t === "w" ? "b" : "w");
const isKing = (p) => !!p && p < "a";
let B, turn, hist, sel, quiet, over;

function init() {
  B = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) =>
      (r + c) % 2 ? (r < 3 ? "b" : r > 4 ? "w" : "") : "",
    ),
  );
  turn = "w";
  hist = [];
  sel = [];
  quiet = 0;
  over = null;
}

// Urib olish ketma-ketliklari (damka uzoqdan uradi, dona orqaga ham uradi)
function jumps(r, c, p, caps, path, out) {
  const k = isKing(p),
    t = side(p),
    en = t === "w" ? "b" : "w";
  let found = false;
  for (const [dr, dc] of DIRS) {
    let y = r + dr,
      x = c + dc;
    if (k)
      while (on(y, x) && !B[y][x]) {
        y += dr;
        x += dc;
      }
    if (
      !on(y, x) ||
      side(B[y][x]) !== en ||
      caps.some((q) => q[0] === y && q[1] === x)
    )
      continue;
    const cy = y,
      cx = x;
    y += dr;
    x += dc;
    const opts = [];
    while (on(y, x) && !B[y][x]) {
      const promote = !k && (t === "w" ? y === 0 : y === 7);
      const np = promote ? p.toUpperCase() : p;
      const nc = [...caps, [cy, cx]],
        npath = [...path, [y, x]],
        sub = [];
      const cont = jumps(y, x, np, nc, npath, sub);
      opts.push({ cont, sub, term: { path: npath, caps: nc } });
      if (!k) break;
      y += dr;
      x += dc;
    }
    const anyCont = opts.some((o) => o.cont);
    for (const o of opts) {
      if (anyCont && !o.cont) continue; // davom ettirish mumkin bo'lsa, davom ettirish shart
      found = true;
      if (o.cont) out.push(...o.sub);
      else out.push(o.term);
    }
  }
  return found;
}

function legal(t) {
  const caps = [],
    simple = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = B[r][c];
      if (side(p) !== t) continue;
      B[r][c] = "";
      jumps(r, c, p, [], [[r, c]], caps);
      B[r][c] = p;
      if (isKing(p)) {
        for (const [dr, dc] of DIRS) {
          let y = r + dr,
            x = c + dc;
          while (on(y, x) && !B[y][x]) {
            simple.push({
              path: [
                [r, c],
                [y, x],
              ],
              caps: [],
            });
            y += dr;
            x += dc;
          }
        }
      } else {
        const dr = t === "w" ? -1 : 1;
        for (const dc of [-1, 1])
          if (on(r + dr, c + dc) && !B[r + dr][c + dc])
            simple.push({
              path: [
                [r, c],
                [r + dr, c + dc],
              ],
              caps: [],
            });
      }
    }
  return caps.length ? caps : simple;
}

function apply(m) {
  const [r, c] = m.path[0],
    p = B[r][c];
  B[r][c] = "";
  m.caps.forEach(([y, x]) => (B[y][x] = ""));
  const [dy, dx] = m.path[m.path.length - 1];
  const last = side(p) === "w" ? 0 : 7;
  const crowned = !isKing(p) && m.path.some((s) => s[0] === last);
  B[dy][dx] = crowned ? p.toUpperCase() : p;
  quiet = m.caps.length || !isKing(p) ? 0 : quiet + 1;
  const mover = turn;
  turn = turn === "w" ? "b" : "w";
  if (!legal(turn).length) {
    over = mover;
    if (me) score[over === me ? "me" : "fr"]++; // g'olib o'yinchiga ochko
  } else if (quiet >= 30) over = "draw";
}

function play(m, send) {
  hist.push({ B: JSON.stringify(B), turn, quiet });
  apply(m);
  sel = [];
  if (send && conn && conn.open) conn.send({ t: "m", path: m.path });
  render();
}

// Oxirgi n ta yurishni qaytaradi
function undoN(n) {
  let h;
  while (n-- > 0 && hist.length) h = hist.pop();
  if (!h) return;
  B = JSON.parse(h.B);
  turn = h.turn;
  quiet = h.quiet;
  over = null;
  sel = [];
}

// O'z yurishimni qaytarish uchun nechta yurish kerak (do'st yurgan bo'lsa, 2 ta)
function undoCount() {
  for (let i = hist.length - 1; i >= 0; i--)
    if (hist[i].turn === me) return hist.length - i;
  return 0;
}

// ---------- Interfeys ----------
let score = { me: 0, fr: 0 }; // online: kim necha marta yutgani
let me = null; // null = bitta qurilma, 'w' yoki 'b' = online
const $ = (id) => document.getElementById(id);
const boardEl = $("board"),
  statusEl = $("status"),
  barEl = $("bar"),
  askEl = $("ask"),
  bUndo = $("bUndo"),
  bNew = $("bNew"),
  bDraw = $("bDraw"),
  bResign = $("bResign"),
  bCopy = $("bCopy"),
  scoreEl = $("score"),
  pickEl = $("pick");

function same(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function click(r, c) {
  if (locked()) return;
  const ms = legal(turn),
    n = sel.length;
  const cand = n
    ? ms.filter(
        (m) =>
          sel.every((s, i) => same(m.path[i], s)) &&
          m.path[n] &&
          same(m.path[n], [r, c]),
      )
    : [];
  if (cand.length) {
    sel.push([r, c]);
    const done = cand.find((m) => m.path.length === sel.length);
    if (done) play(done, true);
    else render();
    return;
  }
  sel = ms.some((m) => same(m.path[0], [r, c])) ? [[r, c]] : [];
  render();
}

function render() {
  const flip = me === "b";
  const ms = locked() ? [] : legal(turn);
  const n = sel.length;
  const next = n
    ? ms
        .filter((m) => sel.every((s, i) => same(m.path[i], s)) && m.path[n])
        .map((m) => m.path[n])
    : [];
  boardEl.innerHTML = "";
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const r = flip ? 7 - i : i,
        c = flip ? 7 - j : j;
      const el = document.createElement("div");
      el.className = "sq " + ((r + c) % 2 ? "d" : "l");
      if (!n && ms.some((m) => same(m.path[0], [r, c]))) el.classList.add("m");
      if (sel.some((s) => same(s, [r, c]))) el.classList.add("s");
      if (next.some((s) => same(s, [r, c]))) el.classList.add("t");
      const p = B[r][c];
      if (p) {
        const d = document.createElement("div");
        d.className = "p " + side(p) + (isKing(p) ? " k" : "");
        el.appendChild(d);
      }
      el.onclick = () => click(r, c);
      boardEl.appendChild(el);
    }
  const name = (t) => (t === "w" ? "Oq" : "Qora");
  let s;
  if (over === "draw") s = "Durang";
  else if (over)
    s = me
      ? over === me
        ? "Siz yutdingiz!"
        : "Do'stingiz yutdi"
      : name(over) + " yutdi!";
  else if (me)
    s =
      turn === me
        ? "Sizning yurishingiz (" + name(me).toLowerCase() + ")"
        : "Do'stingiz yurmoqda";
  else s = name(turn) + " yuradi";
  if (extra && !over) s = extra;
  if (pending) s = "Do'stingizning javobi kutilmoqda...";
  if (note) s = note;
  if (picking) s = "Qaysi rangda o'ynaysiz?";
  if (incoming)
    s =
      incoming.k === "u"
        ? "Do'stingiz yurishini qaytarmoqchi" +
          (incoming.n > 1 ? ", sizning oxirgi yurishingiz ham qaytadi" : "") +
          ". Ruxsat berasizmi?"
        : incoming.k === "d"
          ? "Do'stingiz durang taklif qilmoqda. Rozimisiz?"
          : "Do'stingiz yangi o'yin boshlamoqchi. Rozimisiz?";
  statusEl.textContent = s;
  barEl.style.display = incoming || picking ? "none" : "flex";
  askEl.style.display = incoming ? "flex" : "none";
  pickEl.style.display = picking ? "flex" : "none";
  const live = me && conn && conn.open;
  scoreEl.style.display = live ? "block" : "none";
  if (live)
    scoreEl.textContent =
      "Siz (" +
      name(me).toLowerCase() +
      ") " +
      score.me +
      " : " +
      score.fr +
      " Do'stingiz (" +
      name(other(me)).toLowerCase() +
      ")";
  const gone = me && !(conn && conn.open);
  bUndo.disabled =
    busy() || !!over || gone || (me ? !undoCount() : !hist.length);
  bNew.disabled = busy() || !hist.length || gone;
  bDraw.disabled = busy() || !!over || !hist.length || gone;
  bResign.disabled = busy() || !!over || !hist.length || gone;
}

// ---------- Online (PeerJS, server shart emas) ----------
let peer = null,
  conn = null,
  extra = "",
  pending = null,
  incoming = null,
  note = "";
let picking = false, // host hozir rang tanlayapti
  myColor = null; // host tanlagan rang
const busy = () => !!(pending || incoming || picking);
const locked = () => over || busy() || (peer && !me) || (me && turn !== me);
const linkBox = document.getElementById("linkbox"),
  linkInp = document.getElementById("link");

function flash(t) {
  note = t;
  render();
  setTimeout(() => {
    if (note === t) {
      note = "";
      render();
    }
  }, 3000);
}

// Do'stdan ruxsat so'rash (yurishni qaytarish, yangi o'yin yoki durang)
function request(q) {
  conn.send({ t: "q", s: hist.length, ...q });
  const p = (pending = { k: q.k, n: q.n });
  render();
  setTimeout(() => {
    if (pending !== p) return;
    pending = null;
    if (conn.open) conn.send({ t: "x" });
    flash("Javob kelmadi");
  }, 30000);
}

// Rozilikdan keyin: u = yurishni qaytarish, n = yangi o'yin, d = durang
function accept(k, n) {
  if (k === "u") undoN(n);
  else if (k === "n") init();
  else {
    over = "draw";
    sel = [];
  }
}

// loser taslim bo'ldi: g'olib boshqa tomon
function resign(loser) {
  if (over) return;
  over = other(loser);
  sel = [];
  if (me) score[over === me ? "me" : "fr"]++;
}

function answer(ok) {
  const q = incoming;
  if (!q) return;
  incoming = null;
  conn.send({ t: "a", ok });
  if (ok) accept(q.k, q.n);
  render();
}

function wire(c) {
  conn = c;
  const start = () => {
    extra = "";
    score = { me: 0, fr: 0 };
    init();
    // host rangni tanlagan: do'stiga qolgan rangni yuboradi
    if (me) c.send({ t: "n", c: other(me) });
    render();
  };
  if (c.open) start();
  else c.on("open", start);
  c.on("data", (d) => {
    if (d.t === "m") {
      const m = legal(turn).find(
        (m) =>
          m.path.length === d.path.length &&
          m.path.every((s, i) => same(s, d.path[i])),
      );
      if (m) play(m, false);
    } else if (d.t === "n") {
      me = d.c;
      init();
      render();
    } else if (d.t === "q") {
      if (over || pending || incoming || d.s !== hist.length)
        c.send({ t: "a", ok: false, st: 1 });
      else {
        incoming = d;
        render();
      }
    } else if (d.t === "a") {
      const p = pending;
      if (!p) return;
      pending = null;
      if (d.ok) {
        accept(p.k, p.n);
        render();
      } else
        flash(
          d.st ? "Hozir bo'lmadi, qayta urinib ko'ring" : "Do'stingiz rad etdi",
        );
    } else if (d.t === "r") {
      pending = incoming = null;
      resign(other(me));
      render();
    } else if (d.t === "x") {
      incoming = null;
      render();
    }
  });
  c.on("close", () => {
    pending = incoming = null;
    extra = "Do'st uzildi";
    render();
  });
}

const PEER_OPTS = {
  config: {
    iceServers: [
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "4ce13290350ff1541331c829",
        credential: "Rkyd9yklycYIeVxV",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "4ce13290350ff1541331c829",
        credential: "Rkyd9yklycYIeVxV",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "4ce13290350ff1541331c829",
        credential: "Rkyd9yklycYIeVxV",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "4ce13290350ff1541331c829",
        credential: "Rkyd9yklycYIeVxV",
      },
    ],
  },
};

function peerError(e, text) {
  console.log("PEER ERROR:", e.type, e);
  extra =
    e.type === "peer-unavailable"
      ? "Havola eskirgan. Do'stingizdan yangi havola so'rang"
      : text + " (" + e.type + ")";
  render();
}

function startHost() {
  if (peer) return;
  extra = "Havola tayyorlanmoqda...";
  render();
  peer = new Peer(PEER_OPTS);
  peer.on("open", (id) => {
    linkInp.value = location.href.split("#")[0] + "#" + id;
    linkBox.style.display = "flex";
    $("bOnline").style.display = "none";
    extra =
      "Siz " +
      (myColor === "w" ? "oq" : "qora") +
      " donalarda o'ynaysiz. Havolani do'stingizga yuboring";
    render();
    copyLink();
  });
  peer.on("connection", (c) => {
    if (conn && conn.open) {
      c.close();
      return;
    }
    me = myColor;
    wire(c);
  });
  peer.on("error", (e) =>
    peerError(e, "Ulanishda xato. Sahifani yangilab qayta urinib ko'ring"),
  );
}

function join(id) {
  extra = "Ulanmoqda...";
  render();
  peer = new Peer(PEER_OPTS);
  peer.on("open", () => {
    const c = peer.connect(id, { reliable: true });
    // 20 soniyada ulanmasa, foydalanuvchiga aytamiz (qotib qolmasin)
    const t = setTimeout(() => {
      if (!c.open) {
        extra =
          "Ulanib bo'lmadi. Tarmoq to'sqinlik qilmoqda yoki havola eskirgan";
        render();
      }
    }, 20000);
    c.on("open", () => clearTimeout(t));
    c.on("error", (e) => console.log("CONN ERROR:", e));
    wire(c);
  });
  peer.on("error", (e) =>
    peerError(e, "Ulanib bo'lmadi. Havola eskirgan bo'lishi mumkin"),
  );
}

function copyLink() {
  linkInp.select();
  const done = () => {
    bCopy.textContent = "Nusxalandi";
    setTimeout(() => (bCopy.textContent = "Nusxa olish"), 1500);
  };
  try {
    navigator.clipboard.writeText(linkInp.value).then(done, () => {});
  } catch (e) {}
}

bNew.onclick = () => {
  const online = me && conn && conn.open;
  if (online && !over)
    request({ k: "n" }); // o'yin o'rtasida: rozilik bilan
  else if (online) {
    // o'yin tugagan: rozilik shart emas, ranglar almashadi
    conn.send({ t: "n", c: me });
    me = other(me);
    init();
    render();
  } else {
    init();
    render();
  }
};
bUndo.onclick = () => {
  if (!me) {
    undoN(1);
    render();
  } else if (conn && conn.open) {
    const n = undoCount();
    if (n) request({ k: "u", n });
  }
};
bDraw.onclick = () => {
  if (!me) {
    accept("d");
    render();
  } else if (conn && conn.open) request({ k: "d" });
};
bResign.onclick = () => {
  if (!confirm("Taslim bo'lasizmi?")) return;
  if (!me) {
    resign(turn); // bitta qurilmada: yurayotgan tomon taslim bo'ladi
    render();
  } else if (conn && conn.open) {
    conn.send({ t: "r" });
    resign(me);
    render();
  }
};
$("bOnline").onclick = () => {
  picking = true;
  render();
};
pickEl.onclick = (e) => {
  const c = e.target.dataset.c;
  if (!c) return;
  picking = false;
  myColor = c === "r" ? (Math.random() < 0.5 ? "w" : "b") : c;
  startHost();
};
bCopy.onclick = copyLink;
$("bYes").onclick = () => answer(true);
$("bNo").onclick = () => answer(false);

init();
if (location.hash.length > 1) {
  document.getElementById("bOnline").style.display = "none";
  join(location.hash.slice(1));
}
render();
