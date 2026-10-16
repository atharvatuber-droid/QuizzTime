/**
 * QuizzTime – saves player accounts and quiz scores in this Google Sheet.
 *
 * Setup (once):
 *   1. In the Sheet: Extensions → Apps Script. Delete what is there, paste this whole file, click Save.
 *   2. Deploy → New deployment → gear icon → Web app.
 *        Execute as: Me        Who has access: Anyone
 *      Click Deploy, allow access, and copy the Web app URL (ends with /exec).
 *   3. Put that URL in index.html (SHEET_URL).
 *
 * The script creates two tabs by itself:
 *   Players – one row per online account (name, level, XP, quizzes, best score, last played).
 *   Results – one row for every finished quiz.
 * Deleting a row in Players removes that online account. PINs are stored only as a salted hash.
 */

var MAX_HISTORY = 500;        // quiz results kept per account (the Results tab keeps everything)
var MAX_TRIES = 5;            // wrong PINs in a row before the account is locked for a while
var LOCK_MINUTES = 15;

var PLAYER_HEAD = ['Username', 'Key', 'Level', 'XP', 'Quizzes', 'Best score', 'Last played', 'Created',
                   'PIN hash', 'Salt', 'Token', 'Wrong PINs', 'Locked until', 'History (JSON)', 'Profile (JSON)'];
var RESULT_HEAD = ['Date', 'Player', 'Subject', 'Quiz', 'Score', 'Out of'];
var C = { name: 0, key: 1, level: 2, xp: 3, quizzes: 4, best: 5, last: 6, created: 7,
          pin: 8, salt: 9, token: 10, tries: 11, locked: 12, hist: 13, prof: 14 };

function doGet() {
  return ContentService.createTextOutput('QuizzTime score server is running.');
}

function doPost(e) {
  var out, lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    out = handle(JSON.parse((e && e.postData && e.postData.contents) || '{}'));
  } catch (err) {
    out = { ok: false, error: 'server', message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle(req) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var players = tab(ss, 'Players', PLAYER_HEAD), results = tab(ss, 'Results', RESULT_HEAD);

  if (req.action === 'players') return { ok: true, players: listPlayers(players) };

  var key = cleanName(req.user || req.name).toLowerCase();
  if (!key) return { ok: false, error: 'name' };
  var rowNo = findRow(players, key);

  if (req.action === 'register') {
    if (rowNo) return { ok: false, error: 'taken' };
    var pin = String(req.pin || '');
    if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: 'pin' };
    var salt = Utilities.getUuid(), token = Utilities.getUuid();
    players.appendRow([safe(cleanName(req.name)), safe(key), 1, 0, 0, 0, '', new Date(),
                       hash(salt, pin), salt, token, 0, '', '[]', '{}']);
    rowNo = players.getLastRow();
    return save(players, results, rowNo, req);
  }

  if (!rowNo) return { ok: false, error: 'unknown' };
  var row = players.getRange(rowNo, 1, 1, PLAYER_HEAD.length).getValues()[0];

  if (req.action === 'login') {
    if (row[C.locked] && new Date(row[C.locked]) > new Date()) return { ok: false, error: 'locked' };
    if (hash(row[C.salt], String(req.pin || '')) !== row[C.pin]) {
      var tries = (Number(row[C.tries]) || 0) + 1;
      if (tries >= MAX_TRIES) {
        players.getRange(rowNo, C.tries + 1, 1, 2).setValues([[0, new Date(Date.now() + LOCK_MINUTES * 60000)]]);
        return { ok: false, error: 'locked' };
      }
      players.getRange(rowNo, C.tries + 1).setValue(tries);
      return { ok: false, error: 'pin' };
    }
    players.getRange(rowNo, C.tries + 1, 1, 2).setValues([[0, '']]);
    return { ok: true, user: key, token: row[C.token], name: plain(row[C.name]),
             history: expand(parse(row[C.hist], [])), profile: parse(row[C.prof], {}) };
  }

  if (req.action === 'save') {
    if (!req.token || req.token !== row[C.token]) return { ok: false, error: 'token' };
    return save(players, results, rowNo, req);
  }
  return { ok: false, error: 'action' };
}

// Merges the device's results into the account, logs new ones in Results, updates the stats.
function save(players, results, rowNo, req) {
  var row = players.getRange(rowNo, 1, 1, PLAYER_HEAD.length).getValues()[0];
  var stored = parse(row[C.hist], []), seen = {};
  stored.forEach(function (h) { seen[h[0] + '|' + h[2]] = true; });
  var name = cleanName(req.name) || plain(row[C.name]);
  var added = [];
  (Array.isArray(req.history) ? req.history.slice(-MAX_HISTORY) : []).forEach(function (x) {
    var h = compact(x);
    if (!h || seen[h[0] + '|' + h[2]]) return;
    seen[h[0] + '|' + h[2]] = true;
    stored.push(h); added.push(h);
  });
  stored.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  stored = stored.slice(-MAX_HISTORY);
  if (added.length) {
    added.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    results.getRange(results.getLastRow() + 1, 1, added.length, RESULT_HEAD.length).setValues(added.map(function (h) {
      return [new Date(h[0]), safe(name), safe(h[1]), safe(h[2]), h[3], h[4]];
    }));
  }
  var xp = 0, best = 0;
  stored.forEach(function (h) { xp += h[3] * 10 + 10; best = Math.max(best, h[3]); });
  var profile = req.profile && typeof req.profile === 'object' ? {
    gender: String(req.profile.gender || '').slice(0, 30), selfGender: String(req.profile.selfGender || '').slice(0, 30)
  } : parse(row[C.prof], {});
  players.getRange(rowNo, 1, 1, 7).setValues([[safe(name), safe(plain(row[C.key])), Math.floor(xp / 100) + 1, xp, stored.length, best,
                                              stored.length ? new Date(stored[stored.length - 1][0]) : '']]);
  players.getRange(rowNo, C.hist + 1, 1, 2).setValues([[JSON.stringify(stored), JSON.stringify(profile)]]);
  return { ok: true, user: plain(row[C.key]), token: row[C.token], name: name, history: expand(stored) };
}

function listPlayers(players) {
  var n = players.getLastRow() - 1;
  if (n < 1) return [];
  return players.getRange(2, 1, n, 7).getValues()
    .filter(function (r) { return r[C.key]; })
    .map(function (r) {
      return { name: plain(r[C.name]), key: plain(r[C.key]), xp: Number(r[C.xp]) || 0,
               quizzes: Number(r[C.quizzes]) || 0, best: Number(r[C.best]) || 0 };
    })
    .sort(function (a, b) { return b.xp - a.xp; })
    .slice(0, 50);
}

// ---------- helpers ----------
function tab(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 && name === 'Players'
      ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function findRow(sh, key) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  var keys = sh.getRange(2, C.key + 1, n, 1).getValues();
  for (var i = 0; i < keys.length; i++) if (plain(keys[i][0]) === key) return i + 2;
  return 0;
}
function cleanName(v) { return String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 30); }
// Text that starts with = + - @ would be treated as a formula by Sheets; keep it as plain text.
function plain(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function safe(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function hash(salt, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8));
}
function parse(v, fallback) { try { var x = JSON.parse(v); return x == null ? fallback : x; } catch (e) { return fallback; } }
// Stored as [date, subject, quiz, score, total] to keep the cell small.
function compact(x) {
  if (!x || typeof x !== 'object') return null;
  var date = String(x.date || ''), d = new Date(date);
  if (isNaN(d.getTime())) return null;
  var total = Math.max(1, Math.min(50, Math.round(Number(x.total) || 10)));
  var score = Math.max(0, Math.min(total, Math.round(Number(x.score) || 0)));
  return [d.toISOString(), String(x.subject || '').slice(0, 40), String(x.quiz || 'Quiz').slice(0, 60), score, total];
}
function expand(list) {
  return list.map(function (h) { return { date: h[0], subject: h[1], quiz: h[2], score: h[3], total: h[4] }; });
}
