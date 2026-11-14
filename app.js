(function(){
  var TOTAL = 10;
  var $ = function(id){ return document.getElementById(id); };
  var nameInput = $('playerName');
  var current = null, questions = [], checked = false;
  // Small pop-up message at the bottom of the screen. kind: '' | 'good' | 'bad'
  function toast(msg, kind){
    var box = $('toasts'); if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    requestAnimationFrame(function(){ t.classList.add('show'); });
    setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); }, 300); }, 2800);
  }

  // ---------- helpers ----------
  function rnd(a, b){ return Math.floor(Math.random() * (b - a + 1)) + a; }
  function shuffle(arr){
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = rnd(0, i), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }   // Swedish style: 1 234 (a comma is a decimal sign)

  // Mixed quizzes take questions from every bank in the subject (a question text is only used once).
  function mergeBanks(){
    var seen = {}, out = [];
    Array.prototype.forEach.call(arguments, function(bank){
      bank.forEach(function(item){
        var k = item[0].toLowerCase();
        if (!seen[k]) { seen[k] = true; out.push(item); }
      });
    });
    return out;
  }
  BANKS.noak6 = mergeBanks(BANKS.noak6, BANKS.biologi, BANKS.no_kropp, BANKS.fysik, BANKS.kemi, BANKS.no_rymden, BANKS.evolution, BANKS.evo_historia, BANKS.evo_tanka);
  BANKS.ak6 = mergeBanks(BANKS.ak6, BANKS.geografi, BANKS.so_sverige, BANKS.so_historia, BANKS.so_samhalle, BANKS.religion, BANKS.hallbar);
  BANKS.engelska_mixed = mergeBanks(BANKS.engelska_mixed, BANKS.engelska_ord, BANKS.engelska_grammar);
  BANKS.teknik_alla = mergeBanks(BANKS.teknik_maskiner, BANKS.teknik_el, BANKS.teknik_design);
  BANKS.ma_np = mergeBanks(BANKS.ma_brak, BANKS.ma_geometri, BANKS.ma_negativa, BANKS.ma_skala, BANKS.ma_statistik, BANKS.ma_procent, BANKS.ma_np_extra, BANKS.ma_sannolikhet);
  BANKS.svenska_alla = mergeBanks(BANKS.svenska, BANKS.sv_grammatik, BANKS.sv_stavning, BANKS.sv_ord, BANKS.sv_texter);

  var currentReadingPassage = null;
  function readingQuestions(list, deckKey){
    list = list || READING_PASSAGES;
    currentReadingPassage = list[deal(deckKey || (list === ENGLISH_READING_PASSAGES ? 'read_en' : 'read_sv'), list.length, 1)[0]];
    var qs = currentReadingPassage.questions;
    // Longer texts have more than 7 questions: pick 7 at random, keep them in text order.
    if (qs.length > 7) {
      var pick = shuffle(qs.map(function(_, i){ return i; })).slice(0, 7).sort(function(a, b){ return a - b; });
      qs = pick.map(function(i){ return qs[i]; });
    }
    return qs.map(bankQuestion);
  }

  // Questions are dealt like a deck of cards: every question in a bank comes up once
  // before any question comes back. The deck is remembered in this browser.
  var DECKS = {};
  try { DECKS = JSON.parse(localStorage.getItem('atharvaQuizDecks') || '{}') || {}; } catch(e) { DECKS = {}; }
  function deal(key, size, count){
    var d = DECKS[key];
    if (!d || d.n !== size || !Array.isArray(d.left)) d = { n: size, left: [] };
    if (d.left.length < count) {
      var rest = [];
      for (var i = 0; i < size; i++) if (d.left.indexOf(i) < 0) rest.push(i);
      d.left = d.left.concat(shuffle(rest));
    }
    var hand = d.left.slice(0, count);
    d.left = d.left.slice(count);
    DECKS[key] = d;
    try { localStorage.setItem('atharvaQuizDecks', JSON.stringify(DECKS)); } catch(e) {}
    return hand;
  }

  function fromBank(key, count){
    return deal(key, BANKS[key].length, count || TOTAL).map(function(i){ return bankQuestion(BANKS[key][i]); });
  }

  // ---------- answer types ----------
  // [question, correct, wrong, wrong, wrong] = four options.
  // [question, correct, other] with Sant/Falskt or True/False = true or false, always in that order.
  // [question, answer] = type the answer; "a | b" accepts several answers, the first is shown as correct.
  function bankQuestion(item){
    if (item.length === 2) return typeQ(item[0], item[1]);
    var opts = item.slice(1);
    if (opts.length === 2) opts = /^(sant|true)$/i.test(opts[0]) ? opts : [opts[1], opts[0]];
    else opts = shuffle(opts);
    return { text: item[0], correct: item[1], options: opts, picked: null, pic: QPICS[item[0]] };
  }
  function typeQ(text, answer){
    var accept = String(answer).split('|').map(function(x){ return x.trim(); });
    return { text: text, correct: accept[0], accept: accept, input: true, options: [], picked: null };
  }
  // Compares typed answers loosely: case, spaces, "3,5" or "3.5", "1 234" or "1234" and units like "kr".
  function normAnswer(v){
    var t = String(v == null ? '' : v).toLowerCase().replace(/[\u00a0\u202f]/g, ' ').replace(/[−–]/g, '-')
      .replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();
    var nums = [], m = t.match(/^-?\d[\d ,.]*/);
    if (m && /^[\sa-zåäö²³%°.]*$/.test(t.slice(m[0].length))) {
      var n = m[0].replace(/ /g, '').replace(/[.,]$/, '');
      if (/^-?\d{1,3}(,\d{3})+$/.test(n)) nums.push(Number(n.replace(/,/g, '')));
      if (/^-?\d+([.,]\d+)?$/.test(n)) nums.push(Number(n.replace(',', '.')));
    }
    return { text: t, nums: nums };
  }
  function answerIsRight(q){
    if (!q.input) return q.picked === q.correct;
    var a = normAnswer(q.picked);
    return q.accept.some(function(ok){
      var b = normAnswer(ok);
      if (a.text === b.text) return true;
      return b.nums.some(function(x){ return a.nums.some(function(y){ return Math.abs(x - y) < 1e-9; }); });
    });
  }

  function additionQuestions(){
    var list = [], seen = {};
    while (list.length < TOTAL) {
      var a, b, kind = rnd(1, 3);
      if (kind === 1) { a = rnd(10, 99);  b = rnd(10, 99); }
      else if (kind === 2) { a = rnd(100, 500); b = rnd(10, 500); }
      else { a = rnd(100, 1000); b = rnd(100, 1000); }
      if (Math.random() < 0.5) { var t = a; a = b; b = t; }
      var key = a + '+' + b;
      if (seen[key]) continue;
      seen[key] = true;
      var correct = a + b, used = {}; used[correct] = true;
      var wrongs = [], offs = shuffle([1, -1, 2, -2, 5, -5, 10, -10, 20, -20, 100, -100]);
      for (var i = 0; i < offs.length && wrongs.length < 3; i++) {
        var v = correct + offs[i];
        if (v > 0 && !used[v]) { used[v] = true; wrongs.push(v); }
      }
      list.push({
        text: fmt(a) + ' + ' + fmt(b) + ' = ?',
        correct: fmt(correct),
        options: shuffle([correct].concat(wrongs).map(fmt)),
        picked: null
      });
    }
    return list;
  }

  // ---------- more MATTE quizzes ----------
  function numQ(text, correct, extras){
    var used = {}; used[correct] = true;
    var offs = shuffle([1, -1, 2, -2, 5, -5, 10, -10, 20, -20, 100, -100]).map(function(o){ return correct + o; });
    var pool = shuffle(extras || []).concat(offs), wrongs = [];
    for (var i = 0; i < pool.length && wrongs.length < 3; i++) {
      var v = pool[i];
      if (v > 0 && !used[v]) { used[v] = true; wrongs.push(v); }
    }
    return { text: text, correct: fmt(correct), options: shuffle([correct].concat(wrongs).map(fmt)), picked: null };
  }
  function basicAdd(){
    var k = rnd(1, 3), a, b;
    if (k === 1) { a = rnd(10, 99); b = rnd(10, 99); }
    else if (k === 2) { a = rnd(100, 500); b = rnd(10, 500); }
    else { a = rnd(100, 1000); b = rnd(100, 1000); }
    return numQ(fmt(a) + ' + ' + fmt(b) + ' = ?', a + b);
  }
  function basicSub(){
    var k = rnd(1, 3), a, b;
    if (k === 1) { a = rnd(20, 99); b = rnd(10, a - 1); }
    else if (k === 2) { a = rnd(100, 1000); b = rnd(10, a - 1); }
    else { a = rnd(500, 1000); b = rnd(100, a - 1); }
    return numQ(fmt(a) + ' − ' + fmt(b) + ' = ?', a - b);
  }
  function basicMul(){
    var k = rnd(1, 3), a, b;
    if (k === 1) { a = rnd(2, 12); b = rnd(2, 12); }
    else if (k === 2) { a = rnd(11, 25); b = rnd(2, 9); }
    else { a = rnd(20, 99); b = rnd(2, 9); }
    return numQ(a + ' × ' + b + ' = ?', a * b, [a * b + a, a * b - a, a * b + b, a * b - b]);
  }
  function basicDiv(){
    var k = rnd(1, 2), b, q;
    if (k === 1) { b = rnd(2, 12); q = rnd(2, 20); }
    else { b = rnd(2, 9); q = rnd(10, 99); }
    return numQ(fmt(b * q) + ' ÷ ' + b + ' = ?', q, [q + 1, q - 1, q + 2, q - 2]);
  }
  function quizFrom(gens){
    var list = [], seen = {}, guard = 0, order = [];
    while (list.length < TOTAL && guard++ < 500) {
      if (!order.length) order = shuffle(gens);   // take turns, so one quiz mixes many kinds of questions
      var q = order.pop()();
      if (seen[q.text]) continue;
      seen[q.text] = true;
      list.push(q);
    }
    return list;
  }

  // ---------- Matte åk 6: generated questions with new numbers every time ----------
  var NAMES = ['Atharva', 'Elsa', 'Noah', 'Maja', 'Omar', 'Lina', 'Hugo', 'Sara', 'Leo', 'Ebba', 'Arvid', 'Nora'];
  function pick(arr){ return arr[rnd(0, arr.length - 1)]; }
  // Swedish number format: 12 345,5
  function sv(n){
    n = Math.round(n * 1e6) / 1e6;
    var p = String(Math.abs(n)).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '−' : '') + p.join(',');
  }
  function kr(n){ return Number.isInteger(Math.round(n * 1e6) / 1e6) ? sv(n) : n.toFixed(2).replace('.', ','); }
  // Four options: the right one and the first three different wrong ones.
  function choiceQ(text, right, wrongs){
    var seen = {}, opts = [right]; seen[right] = true;
    wrongs.forEach(function(w){ w = String(w); if (opts.length < 4 && !seen[w]) { seen[w] = true; opts.push(w); } });
    return { text: text, correct: right, options: shuffle(opts), picked: null };
  }
  // A number question: sometimes typed in, otherwise four choices built from typical mistakes.
  function mathQ(text, answer, wrongs, unit, typeChance, format){
    var f = format || sv, u = unit ? ' ' + unit : '', right = f(answer) + u;
    if (Math.random() < (typeChance == null ? 0.3 : typeChance)) return typeQ(text, right);
    var extra = [answer + 1, answer - 1, answer * 10, answer + 10, answer - 10, answer * 2]
      .filter(function(w){ return w >= 0 || answer < 0; });
    return choiceQ(text, right, (wrongs || []).concat(extra).filter(function(w){ return isFinite(w); })
      .map(function(w){ return f(w) + u; }));
  }
  // Takes turns between n kinds of question so the same kind does not come back too soon.
  var TURNS = {};
  function turn(key, n){
    if (!TURNS[key] || !TURNS[key].length) TURNS[key] = shuffle(Array.from({ length: n }, function(_, i){ return i; }));
    return TURNS[key].pop();
  }
  function clock(min){ min = ((min % 1440) + 1440) % 1440; return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + min % 60).slice(-2); }

  // The four operations: Atharva's original questions mixed with bigger numbers, decimals,
  // missing numbers and word problems.
  function genAdd(){
    var r = turn('add', 10) + 1, n = pick(NAMES), a, b;
    if (r <= 3) return basicAdd();
    if (r <= 5) { a = rnd(1000, 9999); b = rnd(100, 9999); return typeQ(sv(a) + ' + ' + sv(b) + ' = ?', sv(a + b)); }
    if (r === 6) { a = rnd(120, 900); b = rnd(35, 400); return mathQ('Vilket tal ska stå i rutan? ☐ + ' + b + ' = ' + sv(a + b), a, [a + 2 * b, a + 10, a - 10]); }
    if (r <= 8) {
      a = rnd(1200, 4800); b = rnd(150, 950);
      return [
        function(){ return mathQ(n + ' har ' + sv(a) + ' kr på sitt sparkonto och sätter in ' + b + ' kr till. Hur mycket finns på kontot nu?', a + b, [a - b, a + b + 100], 'kr'); },
        function(){ return mathQ('Ett tåg kör ' + sv(a) + ' km på måndagen och ' + b + ' km på tisdagen. Hur långt kör tåget sammanlagt?', a + b, [a - b, a + b - 100], 'km'); },
        function(){ return mathQ('En konsert hade ' + sv(a) + ' besökare på fredagen och ' + b + ' fler på lördagen. Hur många besökare kom på lördagen?', a + b, [a - b, b, a + b + 10]); }
      ][turn('addWord', 3)]();
    }
    return decAdd();
  }
  function genSub(){
    var r = turn('sub', 10) + 1, n = pick(NAMES), a, b;
    if (r <= 3) return basicSub();
    if (r <= 5) { a = rnd(2000, 9999); b = rnd(100, a - 100); return typeQ(sv(a) + ' − ' + sv(b) + ' = ?', sv(a - b)); }
    if (r === 6) { a = rnd(300, 900); b = rnd(40, a - 50); return mathQ('Vilket tal ska stå i rutan? ' + a + ' − ☐ = ' + (a - b), b, [2 * a - b, a - b, b + 10, b - 10]); }
    if (r === 7) { a = rnd(2, 15); b = rnd(1, 12); return mathQ('På morgonen var det −' + a + ' °C. På eftermiddagen var det ' + b + ' °C. Hur många grader steg temperaturen?', a + b, [Math.abs(b - a), a, b], 'grader'); }
    if (r === 8) { a = rnd(1200, 1900); b = a + rnd(30, 250); return mathQ('Hur många år är det mellan år ' + a + ' och år ' + b + '?', b - a, [b - a + 1, b - a - 1, b - a + 100]); }
    if (r === 9) { a = pick([200, 500, 1000]); b = rnd(a / 5, a - 20); return mathQ(n + ' har ' + a + ' kr och köper en tröja för ' + b + ' kr. Hur mycket pengar har ' + n + ' kvar?', a - b, [a + b, a - b + 10, a - b - 10], 'kr'); }
    return decSub();
  }
  function genMul(){
    var r = turn('mul', 10) + 1, a, b, c;
    if (r <= 3) return basicMul();
    if (r <= 5) { a = rnd(12, 49); b = rnd(12, 39); return mathQ(a + ' × ' + b + ' = ?', a * b, [a * (b - b % 10), a * b + a, (a + 1) * b, a * b - 10], '', 0.4); }
    if (r === 6) { b = rnd(3, 9); a = rnd(4, 12); return mathQ('Vilket tal ska stå i rutan? ☐ × ' + b + ' = ' + (a * b), a, [a * b - b, a + 1, a - 1, b]); }
    if (r === 7) return decShift();
    if (r === 8) { a = rnd(5, 19) * 5; b = rnd(3, 9); return mathQ('En biobiljett kostar ' + a + ' kr. Vad kostar ' + b + ' biljetter?', a * b, [a + b, a * b - a, a * (b + 1)], 'kr'); }
    if (r === 9) { a = rnd(6, 12); b = rnd(6, 12); c = rnd(3, 6); return mathQ('En låda har ' + a + ' rader med ' + b + ' bullar i varje rad. Hur många bullar finns det i ' + c + ' sådana lådor?', a * b * c, [a * b, a * b + c, a * b * (c - 1)]); }
    return decMul();
  }
  function genDiv(){
    var r = turn('div', 10) + 1, n = pick(NAMES), a, b, q;
    if (r <= 3) return basicDiv();
    if (r <= 5) { b = rnd(3, 9); q = rnd(21, 199); return typeQ(sv(b * q) + ' ÷ ' + b + ' = ?', sv(q)); }
    if (r === 6) { b = rnd(12, 25); q = rnd(6, 30); return mathQ(sv(b * q) + ' ÷ ' + b + ' = ?', q, [q + 1, q - 1, q * 10]); }
    if (r === 7) { b = rnd(3, 9); q = rnd(3, 12); return mathQ('Vilket tal ska stå i rutan? ☐ ÷ ' + b + ' = ' + q, b * q, [q + b, b * q + b, b * q - q]); }
    if (r === 8) {
      b = pick([4, 5, 6]); a = b * rnd(4, 9) + rnd(1, b - 1); q = Math.floor(a / b);
      return mathQ(a + ' elever ska åka till simhallen. I varje bil får ' + b + ' elever plats. Hur många bilar behövs?', q + 1, [q, a % b, q + 2], '', 0.25);
    }
    if (r === 9) { b = rnd(3, 6); q = rnd(25, 150); return mathQ(n + ' och ' + (b - 1) + ' kompisar delar ' + sv(b * q) + ' kr lika. Hur mycket får var och en?', q, [Math.round(b * q / (b - 1)), q + 10, q - 10], 'kr'); }
    return decShift();
  }

  // Decimals
  function decAdd(){
    var a = rnd(10, 99) * 10 + rnd(1, 9), b = rnd(1, 9) * 100 + rnd(1, 99);       // a tenths, b hundredths
    var right = (a * 10 + b) / 100, slip = Math.floor(a / 10) + Math.floor(b / 100) + ((a % 10) + (b % 100)) / 100;
    return mathQ(sv(a / 10) + ' + ' + sv(b / 100) + ' = ?', right, [slip, right + 1, right - 0.1]);
  }
  function decSub(){
    var a = rnd(10, 99) * 10 + rnd(1, 9), b = rnd(1, 9) * 100 + rnd(1, 99);
    var right = (a * 10 - b) / 100, slip = Math.floor(a / 10) - Math.floor(b / 100) + Math.abs((a % 10) * 10 - b % 100) / 100;
    return mathQ(sv(a / 10) + ' − ' + sv(b / 100) + ' = ?', right, [slip, right + 1, right - 0.1]);
  }
  function decMul(){
    var t = rnd(11, 49), b = rnd(3, 9), right = t * b / 10, slip = Math.floor(t / 10) * b + (t % 10) * b / 100;
    return mathQ(sv(t / 10) + ' × ' + b + ' = ?', right, [slip, right * 10, right + 1]);
  }
  function decShift(){
    var d = pick([10, 100, 1000]);
    if (Math.random() < 0.5) { var a = rnd(101, 999) / 100; return mathQ(sv(a) + ' × ' + sv(d) + ' = ?', a * d, [a * d / 10, a * d * 10, a * d / 100]); }
    var x = rnd(12, 990); return mathQ(sv(x) + ' ÷ ' + sv(d) + ' = ?', x / d, [x / d * 10, x / d / 10, x * d]);
  }
  var DEC = [decAdd, decSub, decMul, decShift,
    function(){   // largest / smallest
      var x = rnd(3, 8), big = x / 10, mid = [(x - 1) / 10 + rnd(51, 99) / 1000, (x * 10 - rnd(1, 9)) / 100, (x - 1) / 10 + pick([5, 8, 12, 23, 34, 47]) / 1000];
      var most = Math.random() < 0.5;
      return choiceQ('Vilket decimaltal är ' + (most ? 'störst' : 'minst') + '?', sv(most ? big : x / 100), mid.concat(most ? x / 100 : big).map(sv));
    },
    function(){   // rounding
      var h = rnd(1001, 9999); if (h % 10 === 5) h++;
      if (Math.random() < 0.5) {
        var w = Math.round(h / 100);
        return mathQ('Avrunda ' + sv(h / 100) + ' till närmaste heltal.', w, [Math.floor(h / 100) === w ? w + 1 : w - 1, Math.round(h / 10) / 10, h / 100]);
      }
      var t = Math.round(h / 10) / 10;
      return mathQ('Avrunda ' + sv(h / 100) + ' till en decimal.', t, [Math.floor(h / 10) / 10 === t ? t + 0.1 : t - 0.1, Math.round(h / 100), h / 100]);
    },
    function(){   // money
      var p = rnd(15, 99) / 10 + pick([0, 0.05, 0.09]), k = rnd(3, 6), item = pick(['Ett äpple', 'En bulle', 'En penna', 'Ett paket tuggummi']);
      p = Math.round(p * 100) / 100;
      return mathQ(item + ' kostar ' + kr(p) + ' kr. Vad kostar ' + k + ' st?', Math.round(p * k * 100) / 100, [Math.round(p * (k - 1) * 100) / 100, p + k, Math.round(p * k * 10) / 100], 'kr', 0.3, kr);
    },
    function(){   // halfway
      var a = rnd(11, 98); return mathQ('Vilket tal ligger mitt emellan ' + sv(a / 10) + ' och ' + sv((a + 1) / 10) + '?', (a * 10 + 5) / 100, [(a + 0.5) / 10 + 0.5, (2 * a + 1) / 10, (a * 10 + 1) / 100]);
    },
    function(){   // place value
      var d = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4), num = d[0] + '.' + d[1] + d[2] + d[3], k = rnd(1, 3);
      var place = ['tiondels', 'hundradels', 'tusendels'][k - 1];
      return choiceQ('Vilken siffra står på ' + place + 'platsen i talet ' + num.replace('.', ',') + '?', String(d[k]), [d[1], d[2], d[3], d[0]].map(String));
    },
    function(){   // percent ↔ decimal
      var p = rnd(2, 98); if (p % 10 === 0) p++;
      if (Math.random() < 0.5) return mathQ('Skriv ' + sv(p / 100) + ' i procent.', p, [p / 10, p * 10, p / 100], '%', 0.3);
      return mathQ('Skriv ' + p + ' % i decimalform.', p / 100, [p / 10, p / 1000, p]);
    }
  ];

  // Number sense: primes, divisibility, rounding, order of operations, negative numbers
  var PRIMES = [23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  var ODD_COMPOSITES = [21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93];
  var TAL = [
    function(){ return choiceQ('Vilket av talen är ett primtal?', String(pick(PRIMES)), shuffle(ODD_COMPOSITES).slice(0, 3).map(String)); },
    function(){ return choiceQ('Vilket av talen är INTE ett primtal?', String(pick(ODD_COMPOSITES)), shuffle(PRIMES).slice(0, 3).map(String)); },
    function(){
      var d = pick([3, 4, 6, 9]), yes = d * rnd(15, 110), no = [];
      while (no.length < 3) { var x = rnd(100, 999); if (x % d && no.indexOf(x) < 0) no.push(x); }
      return choiceQ('Vilket tal är delbart med ' + d + '?', String(yes), no.map(String));
    },
    function(){
      var x = rnd(10000, 99999), s = pick([10, 100, 1000]), r = Math.round(x / s) * s;
      var name = { 10: 'tiotal', 100: 'hundratal', 1000: 'tusental' }[s];
      return mathQ('Avrunda ' + sv(x) + ' till närmaste ' + name + '.', r, [Math.floor(x / s) * s === r ? r + s : r - s, Math.round(x / (s * 10)) * s * 10, x - x % (s / 10 || 1)], '', 0.35);
    },
    function(){
      var digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6), num = Number(digits.join('')), k = rnd(0, 5), dg = digits[k];
      var vals = digits.map(function(_, i){ return dg * Math.pow(10, 5 - i); });
      return mathQ('Vilket värde har siffran ' + dg + ' i talet ' + sv(num) + '?', vals[k], vals.filter(function(_, i){ return i !== k; }), '', 0);
    },
    function(){
      var a = rnd(2, 12), b = rnd(2, 9), c = rnd(2, 9), t = rnd(1, 4);
      if (t === 1) return mathQ('Beräkna ' + a + ' + ' + b + ' × ' + c, a + b * c, [(a + b) * c, a * b + c]);
      if (t === 2) return mathQ('Beräkna (' + a + ' + ' + b + ') × ' + c, (a + b) * c, [a + b * c, a * b * c]);
      if (t === 3) { var big = b * c + rnd(1, 20); return mathQ('Beräkna ' + big + ' − ' + (b * c) + ' ÷ ' + c, big - b, [(big - b * c) / c, big - b * c, big + b].filter(Number.isInteger)); }
      return mathQ('Beräkna ' + a + ' × ' + b + ' − ' + c + ' × 2', a * b - c * 2, [(a * b - c) * 2, a * (b - c) * 2, a * b - c]);
    },
    function(){
      var a = rnd(3, 15), b = rnd(4, 20), t = rnd(1, 4);
      if (t === 1) return mathQ('Beräkna −' + a + ' + ' + b, b - a, [-(a + b), a + b, a - b]);
      if (t === 2) return mathQ('Vilket tal är ' + b + ' mindre än −' + a + '?', -(a + b), [b - a, a + b, -(a + b) + 2]);
      if (t === 3) { var xs = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).slice(0, 4).map(function(v){ return -v; }); return choiceQ('Vilket av de negativa talen är störst?', sv(Math.max.apply(null, xs)), xs.map(sv)); }
      return mathQ('Hur stor är skillnaden mellan −' + a + ' °C och ' + b + ' °C?', a + b, [Math.abs(b - a), b, a], 'grader');
    },
    function(){
      var x = rnd(1000, 9999) * 100, s = pick([1000, 10000, 100000]);
      return mathQ('Vilket tal är ' + sv(s) + ' mer än ' + sv(x) + '?', x + s, [x + s / 10, x + s * 10, x + 100]);
    },
    function(){
      var p = pick([[4, 6, 12], [6, 8, 24], [3, 5, 15], [4, 10, 20], [6, 9, 18], [8, 12, 24], [10, 15, 30]]);
      return mathQ('Vilket är det minsta tal som är delbart med både ' + p[0] + ' och ' + p[1] + '?', p[2], [p[0] * p[1], p[0] + p[1], p[2] * 2]);
    }
  ];

  // Equations, expressions and patterns
  var ALG = [
    function(){ var x = rnd(5, 60), a = rnd(5, 40); return mathQ('Lös ekvationen: x + ' + a + ' = ' + (x + a) + '. Vad är x?', x, [x + 2 * a, x + 1, x - 1], '', 0.4); },
    function(){ var x = rnd(20, 90), a = rnd(5, 19); return mathQ('Lös ekvationen: x − ' + a + ' = ' + (x - a) + '. Vad är x?', x, [x - 2 * a, x - a, x + 1], '', 0.4); },
    function(){ var x = rnd(3, 15), a = rnd(3, 9); return mathQ('Lös ekvationen: ' + a + 'x = ' + (a * x) + '. Vad är x?', x, [a * x - a, a * x + a, a * a * x], '', 0.4); },
    function(){ var y = rnd(3, 12), a = rnd(2, 9); return mathQ('Lös ekvationen: x ÷ ' + a + ' = ' + y + '. Vad är x?', a * y, [y + a, y - a > 0 ? y - a : y + 2 * a, y], '', 0.4); },
    function(){
      var x = rnd(2, 12), a = rnd(2, 6), b = rnd(1, 15), c = a * x + b;
      return mathQ('Lös ekvationen: ' + a + 'x + ' + b + ' = ' + c + '. Vad är x?', x, [(c + b) % a ? c - b : (c + b) / a, c - b, x + 1], '', 0.35);
    },
    function(){ var a = rnd(2, 9), x = rnd(2, 9), b = rnd(1, 9); return mathQ('Vad är värdet av ' + a + 'x − ' + b + ' om x = ' + x + '?', a * x - b, [a * x + b, Number(String(a) + String(x)) - b, a + x - b]); },
    function(){ var a = rnd(2, 9), b = rnd(1, 9), m = rnd(2, 5); return mathQ('a = ' + a + ' och b = ' + b + '. Vad är ' + m + 'a + b?', m * a + b, [m * (a + b), Number(String(m) + String(a)) + b, a + b]); },
    function(){
      var s = rnd(2, 20), d = rnd(3, 12), seq = [s, s + d, s + 2 * d, s + 3 * d];
      if (Math.random() < 0.3) { var g = rnd(2, 3), q = [s, s * g, s * g * g, s * g * g * g]; return mathQ('Vilket tal kommer sedan? ' + q.join(', ') + ', …', s * Math.pow(g, 4), [q[3] + (q[3] - q[2]), q[3] + q[2], q[3] * 2 + 1]); }
      return mathQ('Vilket tal kommer sedan? ' + seq.join(', ') + ', …', s + 4 * d, [s + 4 * d + 1, s + 5 * d, s + 3 * d + 1]);
    },
    function(){ var s = rnd(1, 9), d = rnd(2, 7), k = pick([10, 20, 50]); return mathQ('Talföljden börjar ' + [s, s + d, s + 2 * d, s + 3 * d].join(', ') + ', … Vilket är det ' + k + ':e talet?', s + (k - 1) * d, [s + k * d, k * d, s + (k - 2) * d], '', 0.3); },
    function(){ var s = rnd(3, 8), d = rnd(2, 6), k = rnd(6, 15); return mathQ('Figur 1 har ' + s + ' stickor och varje ny figur har ' + d + ' stickor fler. Hur många stickor har figur ' + k + '?', s + (k - 1) * d, [s + k * d, k * d, s * k], '', 0.3); },
    function(){ var x = rnd(3, 15), m = rnd(2, 6), a = rnd(2, 20), r = m * x + a; return mathQ('Jag tänker på ett tal. Jag multiplicerar det med ' + m + ' och lägger till ' + a + '. Då får jag ' + r + '. Vilket tal tänkte jag på?', x, [r - a, (r + a) % m ? Math.round(r / m) : (r + a) / m, x + 1], '', 0.35); },
    function(){
      var n = pick(NAMES), a = rnd(2, 9) * 10, w = rnd(3, 8);
      return choiceQ(n + ' har x kr och får ' + a + ' kr i veckopeng i ' + w + ' veckor. Vilket uttryck visar hur mycket pengar ' + n + ' har då?',
        'x + ' + w + ' · ' + a, ['(x + ' + a + ') · ' + w, 'x · ' + a + ' + ' + w, w + 'x + ' + a]);
    },
    function(){ var a = rnd(3, 9), p = rnd(2, 6), T = 3 * a + 2 * p; return mathQ('3 äpplen och 2 päron kostar tillsammans ' + T + ' kr. Ett päron kostar ' + p + ' kr. Vad kostar ett äpple?', a, [Math.round((T - p) / 3), Math.round(T / 5), a + 1], 'kr'); }
  ];

  // Word problems in several steps
  var WORD = [
    function(){ var n = pick(NAMES), k = rnd(2, 5), p = rnd(12, 45), note = k * p < 100 ? 100 : (k * p < 200 ? 200 : 500);
      return mathQ(n + ' köper ' + k + ' tidningar för ' + p + ' kr styck och betalar med en ' + note + '-lapp. Hur mycket får ' + n + ' tillbaka?', note - k * p, [note - p, k * p, note - k * p + 10], 'kr'); },
    function(){ var P = rnd(5, 40) * 20, r = pick([10, 20, 25, 50]), what = pick(['En jacka', 'Ett par skor', 'Ett spel', 'En ryggsäck']);
      return mathQ(what + ' kostar ' + P + ' kr. Priset sänks med ' + r + ' %. Vad kostar det nu?', P * (100 - r) / 100, [P * r / 100, P - r, P + P * r / 100], 'kr'); },
    function(){
      var start = rnd(8 * 12, 19 * 12) * 5, dur = rnd(1, 3) * 60 + rnd(1, 11) * 5, end = start + dur, what = pick(['En film', 'En match', 'En tågresa', 'En konsert']);
      var noCarry = Math.floor(start / 60) * 60 + Math.floor(dur / 60) * 60 + (start % 60 + dur % 60) % 60;
      var right = clock(end), q = what + ' börjar kl. ' + clock(start) + ' och håller på i ' + Math.floor(dur / 60) + ' h ' + (dur % 60) + ' min. När slutar den?';
      if (Math.random() < 0.25) return typeQ(q, right + ' | ' + right.replace(':', '.'));
      return choiceQ(q, right, [clock(noCarry === end ? end + 10 : noCarry), clock(end - 60), clock(end + 60), clock(end - 10)]);
    },
    function(){ var a = rnd(6 * 12, 20 * 12) * 5, d = rnd(15, 95);
      return mathQ('Bussen går kl. ' + clock(a) + ' och kommer fram kl. ' + clock(a + d) + '. Hur många minuter tar resan?', d, [d + 40, d - 10, d + 10], 'min'); },
    function(){ var v = pick([40, 50, 60, 70, 80, 90, 100, 120]), t = pick([0.5, 1.5, 2, 2.5, 3]);
      return mathQ('En bil kör med farten ' + v + ' km/h. Hur långt kommer den på ' + sv(t) + ' timmar?', v * t, [v * Math.floor(t), v + t, v * t * 2], 'km'); },
    function(){ var v = pick([60, 80, 90, 120]), t = rnd(2, 5);
      return mathQ('Ett tåg kör ' + v * t + ' km med farten ' + v + ' km/h. Hur många timmar tar resan?', t, [t + 1, v * t - v, t * 10], 'timmar'); },
    function(){ var x = pick([2, 3, 5, 6, 8]), T = pick([2, 6, 8, 10, 12]), what = pick(['mjölk', 'mjöl', 'grädde']);
      return mathQ('Ett recept för 4 personer behöver ' + x + ' dl ' + what + '. Hur mycket behövs för ' + T + ' personer?', x * T / 4, [x + (T - 4), x * T, x * 4 / T], 'dl'); },
    function(){
      var a = pick([3, 4]), b = pick([5, 6]), pa = rnd(4, 9) * a + pick([0, 1, 2]), per = rnd(4, 9), pb = per * b + pick([-2, 0, 3]);
      var ua = pa / a, ub = pb / b; if (Math.abs(ua - ub) < 0.4) { pb += 4; ub = pb / b; }
      return choiceQ('Paket A: ' + a + ' st för ' + pa + ' kr. Paket B: ' + b + ' st för ' + pb + ' kr. Vilket paket är billigast per styck?', ua < ub ? 'Paket A' : 'Paket B',
        [ua < ub ? 'Paket B' : 'Paket A', 'De kostar lika mycket per styck', 'Det går inte att räkna ut']);
    },
    function(){ var n = pick(NAMES), m = pick(NAMES.filter(function(x){ return x !== n; })), y = rnd(8, 40), d = rnd(2, 10), S = 2 * y + d;
      return mathQ(n + ' är ' + d + ' år äldre än ' + m + '. Tillsammans är de ' + S + ' år. Hur gammal är ' + n + '?', y + d, [Math.round(S / 2), y, S - d], 'år', 0.3); },
    function(){ var m = rnd(10, 20), dv = pick([[-3, 1, 2], [-2, -2, 4], [-5, 2, 3], [-1, -4, 5], [4, -1, -3]]), xs = dv.map(function(v){ return m + v; }), n = pick(NAMES);
      return mathQ(n + ' fick ' + xs[0] + ', ' + xs[1] + ' och ' + xs[2] + ' poäng på tre prov. Vad är medelvärdet?', m, [m * 3, m + 1, xs.slice().sort(function(a, b){ return a - b; })[1] === m ? m - 1 : xs.slice().sort(function(a, b){ return a - b; })[1]], 'poäng'); },
    function(){ var l = rnd(6, 25), w = rnd(3, l - 1);
      if (Math.random() < 0.5) return mathQ('En rektangulär trädgård är ' + l + ' m lång och ' + w + ' m bred. Hur många meter staket behövs runt hela trädgården?', 2 * (l + w), [l * w, l + w, 2 * l + w], 'm');
      return mathQ('Ett rektangulärt golv är ' + l + ' m långt och ' + w + ' m brett. Hur stor är arean?', l * w, [2 * (l + w), l + w, l * w + l], 'm²'); },
    function(){ var n = pick(NAMES), f = pick([[3, 4], [2, 3], [3, 5]]), P = f[1] * rnd(20, 60);
      return mathQ(n + ' läser en bok på ' + P + ' sidor och har läst ' + f[0] + '/' + f[1] + ' av den. Hur många sidor är kvar?', P - P * f[0] / f[1], [P * f[0] / f[1], P / 2, P - f[0]], 'sidor'); },
    function(){ var N = pick([20, 25, 30]), r = pick(N === 25 ? [20, 40, 60, 80] : [10, 20, 30, 40, 50, 60]);
      return mathQ('I en klass med ' + N + ' elever cyklar ' + r + ' % till skolan. Hur många elever cyklar?', N * r / 100, [r, N - N * r / 100, N * r / 10], 'elever'); },
    function(){ var s = pick([1000, 5000, 10000, 50000]), c = rnd(2, 9);
      return mathQ('På en karta i skala 1:' + sv(s) + ' är avståndet mellan två hus ' + c + ' cm. Hur långt är det i verkligheten?', c * s / 100, [c * s, c * s / 1000, c * s / 10], 'm'); },
    function(){ var n = pick(NAMES), k = rnd(2, 4), p = rnd(9, 19) * 10 - 1, m = rnd(4, 12) * 10 - 1;
      return mathQ(n + ' köper ' + k + ' t-shirts för ' + p + ' kr styck och en keps för ' + m + ' kr. Hur mycket kostar det sammanlagt?', k * p + m, [p + m, k * (p + m), k * p], 'kr'); }
  ];

  // Half from a question bank, half generated – so the national-test mix never looks the same.
  function mixQuiz(bankKey, gens, bankCount){
    var list = fromBank(bankKey, bankCount), texts = list.map(function(q){ return q.text; });
    var fresh = quizFrom(gens).filter(function(q){ return texts.indexOf(q.text) < 0; });
    return shuffle(list.concat(fresh.slice(0, TOTAL - bankCount)));
  }

  // ---------- subjects shown in the menu ----------
  // ---------- Nationella provet åk 6 – the four kinds of delprov (original questions, new numbers every time) ----------
  // Delprov B: no calculator – quick calculations, decimals, equations, percent, probability.
  var DELB = [
    function(){ var a = rnd(11, 99); return mathQ('100 · ' + a + ' = ?', 100 * a, [10 * a, 1000 * a, a + 100], '', 0.5); },
    function(){ var a = rnd(101, 899), b = rnd(101, 899); return mathQ(sv(a / 100) + ' + ' + sv(b / 100) + ' = ?', (a + b) / 100, [(a + b) / 10, (a + b) / 1000, (a + b) / 100 + 0.1], '', 0.5); },
    function(){ var m = rnd(2, 9), k = rnd(2, 9); return mathQ(m + ' · 0,' + k + ' = ?', m * k / 10, [m * k, m * k / 100, m + k / 10], '', 0.5); },
    function(){ var b = pick([2, 3, 4, 5, 6, 8, 10]), a = rnd(1, b - 1), n = b * rnd(2, 12); return mathQ('Hur mycket är ' + a + '/' + b + ' av ' + n + '?', n / b * a, [n / b, n * a, n - a], '', 0.4); },
    function(){ var a = rnd(500, 999), b = rnd(120, a - 120); return mathQ(a + ' − ' + b + ' = ?', a - b, [a - b + 10, a - b - 10, a - b + 100], '', 0.5); },
    function(){ var a = rnd(1000, 2500), b = rnd(300, 999), c = rnd(300, 999); return mathQ(sv(a) + ' + ' + b + ' + ' + c + ' = ?', a + b + c, [a + b + c + 100, a + b + c - 100, a + b + c + 10], '', 0.5); },
    function(){ var a = rnd(120, 499), b = rnd(3, 9); return mathQ(a + ' · ' + b + ' = ?', a * b, [a * b + 100, a * b - 100, (a + b) * 10], '', 0.5); },
    function(){ var d = rnd(3, 9), q = rnd(120, 399); return mathQ(sv(d * q) + ' ÷ ' + d + ' = ?', q, [q + 10, q - 10, q * 10], '', 0.5); },
    function(){
      var n = pick(NAMES), a = pick([25, 40, 50, 75, 80]), m = rnd(4, 8);
      return mathQ(n + ' sparar ' + a + ' kr varje månad till ett nytt spel. Efter ' + m + ' månader har ' + n + ' sparat ihop hälften av vad spelet kostar. Vad kostar spelet?', 2 * a * m, [a * m, 3 * a * m, a * m + a], 'kr');
    },
    function(){
      var r = rnd(2, 6), y = rnd(3, 8), g = rnd(2, 6), t = r + y + g + 1;
      return choiceQ('I en påse finns ' + r + ' röda, ' + y + ' gula, ' + g + ' gröna och 1 rosa kula. Du drar en kula utan att titta. Hur stor är sannolikheten att få en grön kula?',
        g + ' av ' + t, [(t - g) + ' av ' + t, g + ' av ' + (t - g), '1 av ' + t]);
    },
    function(){
      if (Math.random() < 0.5) { var t = rnd(11, 19); return choiceQ('Skriv ' + t + ' tiondelar i decimalform.', sv(t / 10), [sv(t / 100), sv(t), sv(t / 1000)]); }
      var k = rnd(2, 9); return choiceQ('Skriv ”en hel och ' + k + ' hundradelar” i decimalform.', sv(1 + k / 100), [sv(1 + k / 10), sv(1 + k / 1000), sv(10 + k / 100)]);
    },
    function(){
      if (Math.random() < 0.5) { var x = rnd(2, 12), a = rnd(2, 9), b = rnd(2, 20); return mathQ('Lös ekvationen: ' + (a * x + b) + ' = ' + a + ' · x + ' + b + '. Vad är x?', x, [(a * x + b) / a, a * x, x + 1], '', 0.5); }
      var d = rnd(2, 9), k = rnd(2, 12), e = rnd(1, 9); return mathQ('Lös ekvationen: x ÷ ' + d + ' + ' + e + ' = ' + (k + e) + '. Vad är x?', d * k, [k, (k + e) * d, d * k + e], '', 0.5);
    },
    function(){ var p = pick([10, 20, 25, 30, 40, 50, 75]); return choiceQ('Vilket tal har samma värde som ' + p + ' %?', sv(p / 100), [sv(p / 10), sv(p / 1000), sv(p)]); }
  ];

  // Delprov C & D: calculator allowed – longer problems in several steps (money, time, scale, average).
  var DELC = [
    function(){
      var P = pick([120, 160, 200, 240, 300]), a = rnd(1, 2), y = rnd(1, 2);
      return mathQ('En familj med ' + (a === 1 ? '1 vuxen' : '2 vuxna') + ', 1 tonåring (13 år) och ' + y + (y === 1 ? ' barn (8 år)' : ' barn (8 och 10 år)') + ' ska åka tåg. En biljett kostar ' + P + ' kr. Barn som inte har fyllt 12 år betalar halva priset. Vad kostar resan för hela familjen?',
        (a + 1) * P + y * P / 2, [(a + 1 + y) * P, (a + 1 + y) * P / 2, a * P + (1 + y) * P / 2], 'kr', 0.4);
    },
    function(){
      var r = pick([10, 11, 12]), p1 = rnd(3, 9), p2 = rnd(10, 25), p3 = rnd(2, 8), s = p1 + p2 + p3;
      return mathQ('I en butik i Spanien kostar en t-shirt ' + p1 + ' €, en keps ' + p2 + ' € och ett par strumpor ' + p3 + ' €. 1 € = ' + r + ' kr. Vad kostar allt tillsammans i svenska kronor?', s * r, [s, s + r, p2 * r], 'kr', 0.4);
    },
    function(){
      var a = rnd(5, 30), b = pick([50, 100, 200, 500]);
      return mathQ('Modellen av ett torn är ' + a + ' cm hög och gjord i skala 1:' + b + '. Hur högt är tornet i verkligheten? Svara i meter.', a * b / 100, [a * b, a * b / 10, a * b / 1000], 'm', 0.4);
    },
    function(){
      var a = rnd(60, 120), b = rnd(60, 120), c = pick([20, 25, 30, 40]);
      return mathQ('På lördagen säljs ' + a + ' biljetter till en utställning och på söndagen ' + b + ' biljetter. En biljett kostar ' + c + ' kr. Hur mycket pengar får de in sammanlagt?', (a + b) * c, [a * c, (a + b) + c, (a + b) * c + c], 'kr', 0.4);
    },
    function(){
      var t = rnd(3, 15), d = rnd(18, 34);
      return mathQ('En termometer visar −' + t + ' °C ute. Inne i huset är det ' + d + ' grader varmare. Hur varmt är det inne?', d - t, [d + t, t - d, d], '°C', 0.4);
    },
    function(){
      var c = pick([4, 5, 10, 20, 25]), m = rnd(2, 12);
      return mathQ('Man behöver ' + c + ' cm ståltråd för att göra ett gem. Hur många gem kan man göra av ' + m + ' m ståltråd?', m * 100 / c, [m * c, m * 10 / c, m * 1000 / c], 'gem', 0.4);
    },
    function(){
      var a = pick([50, 100, 150, 200, 250]);
      return mathQ('Under 1 minut skickas det ungefär ' + a + ' miljoner mejl i världen. Hur många mejl skickas under en timme? Svara i miljarder.', a * 60 / 1000, [a * 60, a / 60, a * 6], 'miljarder', 0.4);
    },
    function(){
      var c = pick([80, 120, 150, 200]), n = pick([50, 100, 200]);
      return mathQ('Ett cykelhjul har omkretsen ' + c + ' cm. Hur långt rullar cykeln när hjulet snurrar ' + n + ' varv? Svara i meter.', c * n / 100, [c * n, c * n / 10, c + n], 'm', 0.4);
    },
    function(){
      var P = rnd(5, 40) * 20, r = pick([10, 20, 25, 50]), k = rnd(2, 4), n = pick(NAMES);
      return mathQ(n + ' köper ' + k + ' likadana jackor. Priset är ' + P + ' kr per jacka, men priset sänks med ' + r + ' %. Hur mycket betalar ' + n + ' för alla jackorna?', k * P * (100 - r) / 100, [k * P, k * P * r / 100, k * (P - r)], 'kr', 0.4);
    },
    function(){
      var m = rnd(8, 14), v = [], s = 0, i;
      for (i = 0; i < 4; i++) { v.push(m + rnd(-2, 2)); s += v[i]; }
      v.push(5 * m - s);
      return mathQ('Fem kompisar fick poängen ' + v.join(', ') + ' i ett spel. Vilket är medelvärdet?', m, [Math.max.apply(null, v), Math.min.apply(null, v), m + 1], 'poäng', 0.4);
    },
    function(){
      var d = pick([2, 3, 5]), p = pick([2, 6, 8, 12]);
      return mathQ('Ett recept för 4 personer behöver ' + d + ' dl mjölk. Hur många dl behövs för ' + p + ' personer?', d * p / 4, [d * p, d + p, p / 4], 'dl', 0.4);
    }
  ];

  // Delprov E: patterns, area and reasoning.
  BANKS.ma_resonemang = [
    ["Sofia säger: ”Om man multiplicerar ett tal med 0,5 blir svaret alltid större än talet.” Stämmer det?", "Nej, svaret blir hälften så stort, alltså mindre", "Ja, alltid", "Ja, men bara för jämna tal", "Nej, svaret blir alltid 0"],
    ["Summan av två udda tal är alltid …", "ett jämnt tal", "ett udda tal", "ett primtal", "delbar med 5"],
    ["Vilket påstående är sant?", "Alla kvadrater är rektanglar", "Alla rektanglar är kvadrater", "En kvadrat har olika långa sidor", "En rektangel har aldrig räta vinklar"],
    ["Vilket tal ligger mitt emellan 0,3 och 0,4?", "0,35", "0,7", "0,03", "0,45"],
    ["Ett djur väger 3,5 kg. Ett annat väger 3 500 g. Vad stämmer?", "De väger lika mycket", "Det första väger mest", "Det andra väger mest", "Det går inte att avgöra"],
    ["Om man dubblar sidan på en kvadrat, vad händer med arean?", "Arean blir fyra gånger så stor", "Arean blir dubbelt så stor", "Arean blir hälften så stor", "Arean ändras inte"],
    ["Vilket tal är störst?", "0,6", "0,59", "0,075", "0,5999"],
    ["Vilket av följande är INTE lika med 50 %?", "0,05", "1/2", "0,5", "5 av 10"],
    ["En cirkel har radien 5 cm. Hur lång är diametern?", "10 cm", "5 cm", "2,5 cm", "25 cm"],
    ["Elsa säger: ”Ett tal som är delbart med 10 är alltid delbart med 5.” Stämmer det?", "Ja, eftersom 10 = 2 · 5", "Nej, aldrig", "Bara om talet är större än 100", "Bara om talet är jämnt och udda"]
  ];
  var DELE = [
    function(){ var n = rnd(5, 15); return mathQ('Figur 1 består av 1 ruta (1 cm²), figur 2 av 2 · 2 rutor, figur 3 av 3 · 3 rutor och så vidare. Hur stor area har figur ' + n + '? Svara i cm².', n * n, [2 * n, n + n * 2, n * n + n], 'cm²', 0.4); },
    function(){ var n = rnd(6, 25); return mathQ('Figur 1 är 1 ruta (1 cm²), figur 2 är 2 · 2 rutor, figur 3 är 3 · 3 rutor och så vidare. Vilket nummer har den figur som har arean ' + sv(n * n) + ' cm²?', n, [n * n / 2, n * 2, n * n - n], '', 0.4); },
    function(){
      var s = rnd(3, 8), d = rnd(2, 5), k = rnd(8, 20);
      return mathQ('Figur 1 byggs av ' + s + ' stickor. Varje ny figur får ' + d + ' stickor fler än den förra. Hur många stickor behövs till figur ' + k + '?', s + (k - 1) * d, [s + k * d, k * d, s * k], 'stickor', 0.4);
    },
    function(){
      var s = rnd(3, 8), d = rnd(2, 5), c = s - d;
      return choiceQ('Figur 1 har ' + s + ' stickor, figur 2 har ' + (s + d) + ' stickor och figur 3 har ' + (s + 2 * d) + ' stickor. Vilken formel visar antalet stickor S i figur n?',
        'S = ' + d + ' · n' + (c > 0 ? ' + ' + c : c < 0 ? ' − ' + (-c) : ''), ['S = ' + s + ' · n', 'S = n + ' + d, 'S = ' + (s + d) + ' · n']);
    },
    function(){
      var w = rnd(3, 9), l = rnd(w + 2, 14);
      return mathQ('En rektangel har omkretsen ' + 2 * (l + w) + ' cm och längden ' + l + ' cm. Hur stor är arean?', l * w, [2 * (l + w), l * w + l, (l + w) * (l + w)], 'cm²', 0.4);
    },
    function(){
      var a = rnd(4, 9), b = rnd(3, 8), c = rnd(2, 5), d = rnd(2, 6);
      return mathQ('En figur består av en rektangel som är ' + a + ' cm × ' + b + ' cm och en mindre rektangel som är ' + c + ' cm × ' + d + ' cm. De två delarna överlappar inte. Hur stor är figurens area?', a * b + c * d, [a * b, (a + c) * (b + d), 2 * (a + b + c + d)], 'cm²', 0.4);
    },
    function(){
      var k = rnd(2, 5), x = rnd(20, 90), pay = x * k < 200 ? 200 : 500;
      return choiceQ('En bok kostar ' + x + ' kr. Du köper ' + k + ' böcker och betalar med en ' + pay + '-lapp. Vilket uttryck visar hur mycket du får tillbaka?', pay + ' − ' + k + ' · ' + x, [k + ' · ' + x + ' − ' + pay, pay + ' − ' + x, '(' + pay + ' − ' + k + ') · ' + x]);
    },
    function(){ return fromBank('ma_resonemang', 1)[0]; },
    function(){ return fromBank('ma_resonemang', 1)[0]; }
  ];

  var MATTE_QUIZZES = [
    { id:'matte-add', tag:'MATTE', icon:'➕', title:'Addition',  color:'#6c4cf1', desc:'Big numbers, decimals, missing numbers and word problems', make: function(){ return quizFrom([genAdd]); } },
    { id:'matte-sub', tag:'MATTE', icon:'➖', title:'Subtraction', color:'#6c4cf1', desc:'Big numbers, negative numbers, decimals and word problems', make: function(){ return quizFrom([genSub]); } },
    { id:'matte-mul', tag:'MATTE', icon:'✖️', title:'Multiplication', color:'#6c4cf1', desc:'Times tables, 2-digit × 2-digit, decimals and word problems', make: function(){ return quizFrom([genMul]); } },
    { id:'matte-div', tag:'MATTE', icon:'➗', title:'Division', color:'#6c4cf1', desc:'Long division, ÷ 10 and 100, remainders and word problems', make: function(){ return quizFrom([genDiv]); } },
    { id:'matte-mix', tag:'MATTE', icon:'🧮', title:'Mix – all four', color:'#6c4cf1', desc:'Add, subtract, multiply and divide', make: function(){ return quizFrom([genAdd, genSub, genMul, genDiv]); } },
    { id:'matte-problem', tag:'MATTE', icon:'🎯', title:'Problemlösning', color:'#6c4cf1', desc:'Textuppgifter i flera steg: pengar, tid, fart, recept och skala', make:function(){ return quizFrom(WORD); } },
    { id:'matte-decimal', tag:'MATTE', icon:'🔟', title:'Decimaltal', color:'#6c4cf1', desc:'Räkna, jämföra och avrunda decimaltal – nya tal varje gång', make:function(){ return quizFrom(DEC); } },
    { id:'matte-algebra', tag:'MATTE', icon:'🧩', title:'Ekvationer och mönster', color:'#6c4cf1', desc:'Lös x, räkna ut uttryck och hitta mönster i talföljder', make:function(){ return quizFrom(ALG); } },
    { id:'matte-tal', tag:'MATTE', icon:'🧠', title:'Tal och räkneregler', color:'#6c4cf1', desc:'Primtal, delbarhet, avrundning, prioriteringsregler och negativa tal', make:function(){ return quizFrom(TAL); } },
    { id:'matte-sannolikhet', tag:'MATTE', icon:'🎲', title:'Sannolikhet och kombinatorik', color:'#6c4cf1', desc:'Tärningar, kulor i påsar och hur många sätt det finns', make:function(){ return fromBank('ma_sannolikhet'); } },
    { id:'matte-delprov-b', tag:'MATTE · DELPROV B', icon:'🧠', title:'Delprov B – utan miniräknare', color:'#6c4cf1', desc:'Huvudräkning, decimaler, bråk, ekvationer, procent och sannolikhet – som nationella provet', added:'2026-11-14', make:function(){ return quizFrom(DELB); } },
    { id:'matte-delprov-cd', tag:'MATTE · DELPROV C/D', icon:'🧾', title:'Delprov C/D – problem i flera steg', color:'#6c4cf1', desc:'Pengar, valuta, skala, tid, medelvärde och recept – med miniräknare', added:'2026-11-14', make:function(){ return quizFrom(DELC); } },
    { id:'matte-delprov-e', tag:'MATTE · DELPROV E', icon:'🔍', title:'Delprov E – mönster och resonemang', color:'#6c4cf1', desc:'Mönster, area, formler och att avgöra om ett påstående stämmer', added:'2026-11-14', make:function(){ return quizFrom(DELE); } },
    { id:'matte-delprov-alla', tag:'MATTE · NATIONELLA PROVET', icon:'🏆', title:'Nationella provet – alla delprov', color:'#6c4cf1', desc:'En blandning av delprov B, C/D och E', added:'2026-11-14', make:function(){ return quizFrom(DELB.concat(DELC, DELE)); } },
    { id:'matte-procent', tag:'MATTE', icon:'💯', title:'Procent – Läxa 8 & 9', color:'#6c4cf1', desc:'Percent, fractions and decimals, like the school homework', make:function(){ return fromBank('ma_procent'); } },
    { id:'matte-brak', tag:'MATTE', icon:'🍕', title:'Bråk – fractions', color:'#6c4cf1', desc:'Täljare, nämnare and parts of a whole', make:function(){ return fromBank('ma_brak'); } },
    { id:'matte-geometri', tag:'MATTE', icon:'📐', title:'Vinklar & symmetri', color:'#6c4cf1', desc:'Angles, triangles and lines of symmetry', make:function(){ return fromBank('ma_geometri'); } },
    { id:'matte-negativa', tag:'MATTE', icon:'🌡️', title:'Negativa tal & temperatur', color:'#6c4cf1', desc:'Number line, bank accounts and degrees below zero', make:function(){ return fromBank('ma_negativa'); } },
    { id:'matte-skala', tag:'MATTE', icon:'📏', title:'Skala, area & enheter', color:'#6c4cf1', desc:'Scale drawings, area, volume, units and time', make:function(){ return fromBank('ma_skala_mer'); } },
    { id:'matte-statistik', tag:'MATTE', icon:'📊', title:'Statistik & diagram', color:'#6c4cf1', desc:'Mean, median, mode, tables and coordinates', make:function(){ return fromBank('ma_statistik'); } },
    { id:'matte-np', tag:'MATTE', icon:'🏅', title:'Nationella provet – blandat', color:'#6c4cf1', desc:'Mixed åk 6 questions in the style of the national test', make:function(){ return mixQuiz('ma_np', WORD.concat(ALG, DEC, TAL), 6); } }
  ];

  var NO_QUIZZES = [
    { id:'no-biologi', tag:'NO · BIOLOGI', icon:'🌱', title:'Biologi', color:'#1c9c5b', desc:'Kroppen, växter, ekosystem och biologisk mångfald', make:function(){ return fromBank('biologi'); } },
    { id:'no-fysik', tag:'NO · FYSIK', icon:'⚡', title:'Fysik', color:'#1c9c5b', desc:'Krafter, energi, ljud, ljus och elektricitet', make:function(){ return fromBank('fysik'); } },
    { id:'no-kemi', tag:'NO · KEMI', icon:'🧪', title:'Kemi', color:'#1c9c5b', desc:'Ämnen, blandningar, vatten och kemiska reaktioner', make:function(){ return fromBank('kemi'); } },
    { id:'no-kropp', tag:'NO · KROPPEN', icon:'🫀', title:'Människokroppen', color:'#1c9c5b', desc:'Organ, blod, skelett, sinnen och hälsa', make:function(){ return fromBank('no_kropp'); } },
    { id:'no-rymden', tag:'NO · RYMDEN', icon:'🪐', title:'Rymden', color:'#1c9c5b', desc:'Solsystemet, månen, stjärnor och rymdfärder', make:function(){ return fromBank('no_rymden'); } },
    { id:'no-evolution', tag:'NO · EVOLUTION', icon:'🧬', title:'Livets utveckling', color:'#1c9c5b', added:'2026-11-14', desc:'Evolution, mutation, naturligt urval, Darwin, fossil och artbildning', make:function(){ return fromBank('evolution'); } },
    { id:'no-evo-begrepp', tag:'NO · EVOLUTION', icon:'✍️', title:'Evolution – skriv begreppen', color:'#1c9c5b', added:'2026-11-14', desc:'Skriv rätt ord: mutation, variation, fossil, art …', make:function(){ return fromBank('evo_begrepp'); } },
    { id:'no-evo-historia', tag:'NO · EVOLUTION', icon:'🦕', title:'Livets historia och fossil', color:'#1c9c5b', added:'2026-11-14', desc:'Urceller, cyanobakterier, fossil, levande fossil och utdöende', make:function(){ return fromBank('evo_historia'); } },
    { id:'no-evo-tanka', tag:'NO · EVOLUTION', icon:'🤔', title:'Tänk som Darwin', color:'#1c9c5b', added:'2026-11-14', desc:'Vardagsexempel på urval och anpassning, sant eller falskt', make:function(){ return fromBank('evo_tanka'); } },
    { id:'no-ak6', tag:'NO · ÅK 6', icon:'📚', title:'NO – blandat för åk 6', color:'#1c9c5b', desc:'Blandade frågor i biologi, fysik och kemi', make:function(){ return fromBank('noak6'); } }
  ];

  var SO_QUIZZES = [
    { id:'so-geografi', tag:'SO · GEOGRAFI', icon:'🗺️', title:'Geografi', color:'#d9822b', desc:'Kartor, klimat, naturresurser', make:function(){ return fromBank('geografi'); } },
    { id:'so-religion', tag:'SO · RELIGION', icon:'🕊️', title:'Religion', color:'#d9822b', desc:'Världsreligioner, heliga platser och högtider', make:function(){ return fromBank('religion'); } },
    { id:'so-hallbar', tag:'SO · HÅLLBARHET', icon:'♻️', title:'Hållbar utveckling', color:'#d9822b', desc:'Miljö, samhälle och ekonomi', make:function(){ return fromBank('hallbar'); } },
    { id:'so-historia', tag:'SO · HISTORIA', icon:'🏰', title:'Historia', color:'#d9822b', desc:'Från stenåldern och vikingarna till 1900-talet', make:function(){ return fromBank('so_historia'); } },
    { id:'so-samhalle', tag:'SO · SAMHÄLLE', icon:'🏛️', title:'Samhälle och demokrati', color:'#d9822b', desc:'Riksdag, kommun, lagar, pengar och rättigheter', make:function(){ return fromBank('so_samhalle'); } },
    { id:'so-sverige', tag:'SO · SVERIGE & EUROPA', icon:'🧭', title:'Sverige, Norden och Europa', color:'#d9822b', desc:'Landskap, städer, huvudstäder och natur', make:function(){ return fromBank('so_sverige'); } },
    { id:'so-ak6', tag:'SO · ÅK 6', icon:'📚', title:'SO – blandat för åk 6', color:'#d9822b', desc:'Blandade frågor från alla SO-ämnen', make:function(){ return fromBank('ak6'); } }
  ];

  var SVENSKA_QUIZZES = [
    { id:'svenska-np-lasa', tag:'SVENSKA · DELPROV B', icon:'📖', title:'Nationella provet – läsa', color:'#2b7bd9', desc:'Berättelser och faktatexter med frågor som på provet: gestaltning, motiv, budskap och rubriker', reading:true, added:'2026-11-14', make:function(){ return readingQuestions(SV_TEST_PASSAGES, 'read_svnp'); } },
    { id:'svenska-hora', tag:'SVENSKA · HÖRFÖRSTÅELSE', icon:'🎧', title:'Hörförståelse – lyssna och svara', color:'#2b7bd9', desc:'Texten läses upp – du ser den inte. Lyssna med 🔊 och svara på frågorna', reading:true, listening:true, added:'2026-11-14', make:function(){ return readingQuestions(SV_LISTEN_PASSAGES, 'read_svlisten'); } },
    { id:'svenska-np-skriva', tag:'SVENSKA · DELPROV C', icon:'✍️', title:'Nationella provet – skriva', color:'#2b7bd9', desc:'Berättande och argumenterande text: läs uppgiften och en elevtext och lär dig vad som gör texten bra', reading:true, added:'2026-11-14', make:function(){ return readingQuestions(SV_WRITING_CARDS, 'read_svskriva'); } },
    { id:'svenska-las', tag:'SVENSKA · LÄSFÖRSTÅELSE', icon:'📚', title:'Läsförståelse', color:'#2b7bd9', desc:READING_PASSAGES.length + ' olika texter – en slumpas varje gång, med 7 frågor', reading:true, make:function(){ return readingQuestions(READING_PASSAGES); } },
    { id:'svenska-grammatik', tag:'SVENSKA · GRAMMATIK', icon:'🔤', title:'Grammatik', color:'#2b7bd9', desc:'Ordklasser, satsdelar, verbformer och ordföljd', make:function(){ return fromBank('sv_grammatik'); } },
    { id:'svenska-stavning', tag:'SVENSKA · STAVNING', icon:'✏️', title:'Stavning och skiljetecken', color:'#2b7bd9', desc:'Sj-, tj-, j- och ng-ljud, särskrivning, stor bokstav och kommatecken', make:function(){ return fromBank('sv_stavning'); } },
    { id:'svenska-ord', tag:'SVENSKA · ORD', icon:'💬', title:'Ord, uttryck och bildspråk', color:'#2b7bd9', desc:'Synonymer, ordspråk, liknelser och metaforer', make:function(){ return fromBank('sv_ord'); } },
    { id:'svenska-texter', tag:'SVENSKA · TEXTER', icon:'📝', title:'Texttyper och berättande', color:'#2b7bd9', desc:'Berättelser, faktatexter, argumenterande texter och källor', make:function(){ return fromBank('sv_texter'); } },
    { id:'svenska-sprak', tag:'SVENSKA · SPRÅK', icon:'✍️', title:'Språk, stavning och grammatik', color:'#2b7bd9', desc:'Blandade språkfrågor från alla svenska-quiz', make:function(){ return fromBank('svenska_alla'); } }
  ];

  var ENGLISH_QUIZZES = [
    { id:'engelska-ord', tag:'ENGELSKA · ORDFÖRRÅD', icon:'🔤', title:'Vocabulary – ord och betydelser', color:'#c93c6e', desc:'Engelska ord, motsatser och betydelser', make:function(){ return fromBank('engelska_ord'); } },
    { id:'engelska-grammatik', tag:'ENGELSKA · GRAMMAR', icon:'✍️', title:'Grammar – grammatik', color:'#c93c6e', desc:'Verb, tempus, pronomen och meningsbyggnad', make:function(){ return fromBank('engelska_grammar'); } },
    { id:'engelska-mix', tag:'ENGELSKA · ÅK 6', icon:'📚', title:'English – mixed for Year 6', color:'#c93c6e', desc:'Blandade frågor i ord och grammatik', make:function(){ return fromBank('engelska_mixed'); } },
    { id:'engelska-las', tag:'ENGELSKA · READING', icon:'📖', title:'Reading – stories', color:'#c93c6e', desc:'Read a story and answer 7 questions', reading:true, make:function(){ return readingQuestions(ENGLISH_READING_PASSAGES); } },
    { id:'engelska-muntlig', tag:'ENGELSKA · SPEAKING', icon:'🗣️', title:'Speaking – oral national test', color:'#c93c6e', desc:'Elevkort like the åk 6 muntliga prov: read or listen 🔊, then learn what the teacher listens for', reading:true, added:'2026-11-14', make:function(){ return readingQuestions(ENGLISH_SPEAKING_CARDS, 'read_speak'); } },
    { id:'engelska-cloze', tag:'ENGELSKA · FILL THE GAPS', icon:'🧩', title:'Fill the gaps', color:'#c93c6e', desc:'Choose the best word for each gap in a text – like the national test', reading:true, added:'2026-11-14', make:function(){ return readingQuestions(ENGLISH_CLOZE_PASSAGES, 'read_cloze'); } },
    { id:'engelska-dialog', tag:'ENGELSKA · DIALOGUE', icon:'💬', title:'How does it end? – dialogues', color:'#c93c6e', desc:'Two people talk – choose the best way to finish the conversation', added:'2026-11-14', make:function(){ return fromBank('engelska_dialog'); } },
    { id:'engelska-info', tag:'ENGELSKA · FIND THE FACTS', icon:'🔎', title:'Find the facts', color:'#c93c6e', desc:'Read an information text (camps, museums…) and find the answers', reading:true, added:'2026-11-14', make:function(){ return readingQuestions(ENGLISH_INFO_PASSAGES, 'read_info'); } },
    { id:'engelska-writing-tips', tag:'ENGELSKA · WRITING TIPS', icon:'✍️', title:'Writing – plan and check', color:'#c93c6e', desc:'Read a writing task and a sample text, then learn what makes a good text', reading:true, added:'2026-11-14', make:function(){ return readingQuestions(ENGLISH_WRITING_CARDS, 'read_writetips'); } },
    { id:'engelska-skriva', tag:'ENGELSKA · WRITING', icon:'📝', title:'Grammar, words & writing', color:'#c93c6e', desc:'Words in context, opinions, letters and grammar', make:function(){ return fromBank('engelska_quest'); } }
  ];

  var TEKNIK_QUIZZES = [
    { id:'teknik-maskiner', tag:'TEKNIK · MASKINER', icon:'⚙️', title:'Maskiner och konstruktion', color:'#5f6b7a', desc:'Enkla maskiner, verktyg och prototyper', make:function(){ return fromBank('teknik_maskiner'); } },
    { id:'teknik-el', tag:'TEKNIK · ELEKTRICITET', icon:'🔌', title:'Elektricitet och tekniska system', color:'#5f6b7a', desc:'Kretsar, energi, sensorer och säkerhet', make:function(){ return fromBank('teknik_el'); } },
    { id:'teknik-design', tag:'TEKNIK · DESIGN', icon:'💡', title:'Design, programmering och hållbarhet', color:'#5f6b7a', desc:'Algoritmer, material och att förbättra lösningar', make:function(){ return fromBank('teknik_design'); } },
    { id:'teknik-mix', tag:'TEKNIK · BLANDAT', icon:'📚', title:'Teknik – blandat', color:'#5f6b7a', desc:'Blandade frågor från alla teknikområden', make:function(){ return fromBank('teknik_alla'); } }
  ];

  var SUBJECTS = [
    { id:'matte', tag:'MATTE', icon:'🔢', title:'Math quizzes', color:'#6c4cf1', desc:'The four operations, problemlösning, decimaltal, ekvationer, procent, bråk, geometry, statistics, sannolikhet and national test practice', children: MATTE_QUIZZES },
    { id:'no',       tag:'NO',       icon:'🔬', title:'Naturorienterande ämnen', color:'#1c9c5b', desc:'Biologi, fysik, kemi, människokroppen, rymden och NO för åk 6', children: NO_QUIZZES },
    { id:'so',       tag:'SO',       icon:'🌍', title:'Samhällsorienterande ämnen', color:'#d9822b', desc:'Geografi, historia, samhälle, religion, hållbar utveckling och SO för åk 6', children: SO_QUIZZES },
    { id:'svenska',  tag:'SVENSKA',  icon:'📖', title:'Svenska',   color:'#2b7bd9', desc:'Läsförståelse, grammatik, stavning, ord och uttryck, texttyper och berättande', children: SVENSKA_QUIZZES },
    { id:'engelska', tag:'ENGELSKA', icon:'🇬🇧', title:'Engelska', color:'#c93c6e', desc:'Ord, grammatik, läsförståelse och skrivande', children: ENGLISH_QUIZZES },
    { id:'teknik',   tag:'TEKNIK',   icon:'⚙️', title:'Teknik',   color:'#5f6b7a', desc:'Maskiner, elektricitet, design och programmering', children: TEKNIK_QUIZZES }
  ];

  // ---------- accounts (many can be saved on this device) ----------
  var GENERIC_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2230%22 fill=%22%23e8e5ff%22/%3E%3Ccircle cx=%2230%22 cy=%2222%22 r=%2210%22 fill=%22%238477c8%22/%3E%3Cpath d=%22M10 54 Q10 34 30 34 Q50 34 50 54%22 fill=%22%238477c8%22/%3E%3C/svg%3E';
  var accounts = [], profile = null;
  function saveAccounts(){
    var ok = true;
    try { localStorage.setItem('atharvaQuizAccounts', JSON.stringify(accounts)); }
    catch(e) { ok = false; }
    syncOnline();
    return ok;
  }

  // ---------- shared online list (works on the published Claude page; plain file just skips it) ----------
  // Shares ONLY: username, level, XP, number of quizzes and best score. No photo, no gender.
  var onlineDb = null, onlineUid = null, onlineReadOnly = false, onlinePlayers = [], syncing = false, syncAgain = false;
  function setOnlineNote(){
    var n = $('onlineNote');
    if (!onlineDb && SHEET_URL) {
      n.textContent = sheetError ? 'Could not reach the online score sheet right now. Your scores are still saved on this device.'
        : !sheetPlayers ? 'Connecting…'
        : 'Players who turned on online saving in 👤 My Profile. Only the user name, level and XP are shown.';
      return;
    }
    if (!onlineDb) n.textContent = 'The shared player list works on the Claude page when you are signed in to Claude. On this copy only this device is shown.';
    else if (onlineReadOnly) n.textContent = 'You can see the other players, but you cannot add yourself yet. Ask the owner to give you Contributor access.';
    else n.textContent = 'Everyone who opens this page can see these usernames, levels and XP. Please do not use your full name.';
  }
  function syncOnline(){
    syncSheet();
    if (!onlineDb || !onlineUid || onlineReadOnly) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    var all = getAllHistory();
    var summary = accounts.map(function(acc){
      var mine = all.filter(function(x){ return x.accountId === acc.id; });
      var best = 0; mine.forEach(function(x){ best = Math.max(best, Number(x.score) || 0); });
      return { id: acc.id, name: acc.name, xp: xpTotal(mine), quizzes: mine.length, best: best };
    });
    onlineDb.doc('players/' + onlineUid).set({ accounts: summary, updated: Date.now() })
      .catch(function(e){ if (e && e.code === 'invalid_argument') { onlineReadOnly = true; setOnlineNote(); } })
      .then(function(){ syncing = false; if (syncAgain) { syncAgain = false; syncOnline(); } });
  }
  function onlineRows(){
    var rows = [];
    if (!onlineDb && sheetPlayers) {
      return sheetPlayers.map(function(p){
        return { name: p.name, xp: Number(p.xp) || 0, quizzes: Number(p.quizzes) || 0, best: Number(p.best) || 0,
                 mine: accounts.some(function(a){ return a.cloud && a.cloud.user === p.key; }) };
      });
    }
    onlinePlayers.forEach(function(d){
      (d.accounts || []).forEach(function(a){
        rows.push({ name: a.name, xp: Number(a.xp) || 0, quizzes: Number(a.quizzes) || 0, best: Number(a.best) || 0, mine: d.uid === onlineUid });
      });
    });
    return rows.sort(function(a, b){ return b.xp - a.xp; });
  }
  function onlineTableHTML(){
    var rows = onlineRows();
    var h = '<h3>🌍 All players</h3>';
    if (!onlineDb && !sheetPlayers) return h + '<p class="small">' + (SHEET_URL ? 'Connecting to the online score sheet…' : 'Sign in to Claude and open the shared page to see other players.') + '</p>';
    if (!rows.length) return h + '<p>No players yet.</p>';
    h += '<table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Level</th><th>XP</th><th>Quizzes</th></tr></thead><tbody>';
    rows.slice(0, 30).forEach(function(r, i){
      h += '<tr><td>' + (i + 1) + '</td><td>' + escapeHTML(r.name) + (r.mine ? ' (you)' : '') + '</td><td>' + (Math.floor(r.xp / 100) + 1) + '</td><td>' + r.xp + '</td><td>' + r.quizzes + '</td></tr>';
    });
    return h + '</tbody></table>';
  }
  function renderOnlineList(){
    var box = $('onlineList');
    if (!box) return;
    setOnlineNote();
    var rows = onlineRows();
    box.innerHTML = '';
    rows.slice(0, 30).forEach(function(r){
      var row = document.createElement('div');
      row.className = 'acct' + (r.mine ? ' now' : '');
      var img = document.createElement('img'); img.alt = ''; img.src = GENERIC_AVATAR;
      var info = document.createElement('div'); info.className = 'grow';
      info.innerHTML = '<strong>' + escapeHTML(r.name) + (r.mine ? ' (you)' : '') + '</strong><div class="small">⭐ ' + r.xp + ' XP · Level ' + (Math.floor(r.xp / 100) + 1) + ' · ' + r.quizzes + ' quizzes</div>';
      row.appendChild(img); row.appendChild(info);
      box.appendChild(row);
    });
  }
  (function initOnline(){
    try {
      if (!window.claude || !window.claude.use) { setOnlineNote(); return; }
      Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function(r){
        var d = r[0], u = r[1];
        if (!d || !u) { setOnlineNote(); return; }
        return u.id().then(function(id){
          if (!id) { setOnlineNote(); return; }
          onlineDb = d; onlineUid = id;
          d.collection('players').onSnapshot(function(snap){
            onlinePlayers = snap.docs.map(function(doc){ var x = doc.data() || {}; x.uid = doc.id; return x; });
            renderOnlineList();
            if (!$('dashboardPanel').classList.contains('hidden') && $('panelTitle').textContent.indexOf('Leaderboard') > -1) showDashboard('leaderboardPanel');
          }, function(){ setOnlineNote(); });
          syncOnline();
          setOnlineNote();
        });
      }).catch(function(){ setOnlineNote(); });
    } catch(e) { setOnlineNote(); }
  })();
  // ---------- online saving in Atharva's Google Sheet (optional, per account) ----------
  // The web-app link from Apps Script (see QuizzTime_AppsScript.gs). Empty = everything stays on this device only.
  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbz1AviL_IC9AyRFmXzgeqYkXVyr4DqeqBqB7no8VAHMMsE00AAOEL72MJLR5jdsI52beg/exec';
  var sheetPlayers = null, sheetError = false, sheetBusy = false, sheetAgain = false;
  function sheetCall(data){
    // Sent as plain text so the browser can call Google Apps Script directly.
    if (!window.fetch) return Promise.reject(new Error('offline'));
    return fetch(SHEET_URL, { method: 'POST', body: JSON.stringify(data) }).then(function(r){ return r.json(); });
  }
  function accountHistory(acc){
    return getAllHistory().filter(function(x){ return x.accountId === acc.id; }).map(function(x){
      return { date: x.date, subject: x.subject, quiz: x.quiz, score: x.score, total: x.total };
    });
  }
  // Adds the results the Sheet knows about (from every device) to this device. Nothing local is removed.
  function useCloudHistory(acc, list){
    if (!Array.isArray(list)) return;
    try {
      var all = getAllHistory(), have = {};
      function key(x){ return String(x.date || '') + '|' + String(x.quiz || '').slice(0, 60); }
      all.forEach(function(x){ if (x.accountId === acc.id) have[key(x)] = true; });
      list.forEach(function(x){
        if (have[key(x)]) return;
        have[key(x)] = true;
        all.push({ accountId: acc.id, name: acc.name, quiz: x.quiz, subject: x.subject, score: Number(x.score) || 0, total: Number(x.total) || 10, date: x.date });
      });
      all.sort(function(a, b){ return String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : 0; });
      localStorage.setItem('atharvaQuizHistory', JSON.stringify(all.slice(-500)));
    } catch(e) {}
  }
  var sheetNotify = false;   // true right after a quiz, so the player hears whether the online save worked
  function syncSheet(){
    if (!SHEET_URL) return;
    if (sheetBusy) { sheetAgain = true; return; }
    var linked = accounts.filter(function(a){ return a.cloud && a.cloud.token; });
    if (!linked.length) return;
    sheetBusy = true;
    var chain = Promise.resolve();
    linked.forEach(function(acc){
      chain = chain.then(function(){
        return sheetCall({ action: 'save', user: acc.cloud.user, token: acc.cloud.token, name: acc.name, history: accountHistory(acc),
                           profile: { gender: acc.gender || '', selfGender: acc.selfGender || '' } })
          .then(function(res){
            var mine = sheetNotify && acc === profile;
            if (res && res.ok) { useCloudHistory(acc, res.history); if (mine) toast('☁️ Saved online', 'good'); }
            else if (res && (res.error === 'token' || res.error === 'unknown')) acc.cloud = null;   // the row was removed from the Sheet
            else if (mine) toast('Could not save online – it is kept on this device and sent later.', 'bad');
          }, function(){   // offline: it is sent again after the next quiz
            if (sheetNotify && acc === profile) toast('Offline – your score is kept on this device and sent later.');
          });
      });
    });
    chain.then(function(){
      sheetNotify = false;
      try { localStorage.setItem('atharvaQuizAccounts', JSON.stringify(accounts)); } catch(e) {}
      sheetBusy = false;
      loadSheetPlayers();
      if (sheetAgain) { sheetAgain = false; syncSheet(); }
    });
  }
  function loadSheetPlayers(){
    if (!SHEET_URL || onlineDb) return;
    sheetCall({ action: 'players' }).then(function(res){
      sheetError = !(res && res.ok);
      if (res && res.ok) sheetPlayers = res.players || [];
    }, function(){ sheetError = true; }).then(function(){
      renderOnlineList();
      if (!$('dashboardPanel').classList.contains('hidden') && $('panelTitle').textContent.indexOf('Leaderboard') > -1) showDashboard('leaderboardPanel');
    });
  }
  function cloudErrorText(err){
    if (err === 'taken') return 'This user name is already used online. If it is yours, type the PIN you chose before. Otherwise change your user name first.';
    if (err === 'locked') return 'Too many wrong PINs. Wait 15 minutes and try again.';
    if (err === 'pin') return 'Wrong user name or PIN.';
    if (err === 'unknown') return 'There is no online account with that user name.';
    return 'Could not reach the online score sheet. Check the internet and try again.';
  }
  // "Save online" box in My Profile. Optional: a player can skip it and keep everything on this device.
  function renderCloudBox(){
    if (!SHEET_URL || !profile) return;
    var acc = profile, box = document.createElement('div');
    box.className = 'panel-sec';
    if (acc.cloud && acc.cloud.token) {
      box.innerHTML = '<h3>☁️ Online saving is on</h3><p>Your scores are saved in the online score sheet as <strong>' + escapeHTML(acc.cloud.user) +
        '</strong>. On another phone or computer, choose “👤 I have an account” and log in with this user name and your PIN.</p>' +
        '<button class="ghost" type="button" id="cloudOff">Stop saving online on this device</button>';
      $('panelContent').appendChild(box);
      $('cloudOff').addEventListener('click', function(){ acc.cloud = null; saveAccounts(); showDashboard('profilePanel'); toast('Online saving is off on this device'); });
      return;
    }
    box.innerHTML = '<h3>☁️ Save online (optional)</h3><p>Turn this on to keep your XP and scores when you play on another phone or computer. You can skip it – everything still works on this device.</p>' +
      '<label for="cloudNewPin" style="display:block;font-weight:700;margin:10px 0 6px">Choose a PIN (4–8 digits)</label>' +
      '<input id="cloudNewPin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" style="width:100%;padding:10px;border:2px solid var(--line);border-radius:10px;font:inherit">' +
      '<p class="small">Your online user name will be <strong>' + escapeHTML(acc.name) + '</strong>. Remember the PIN – you need it on other devices.</p>' +
      '<button class="primary" type="button" id="cloudOn">☁️ Turn on online saving</button><p class="fb" id="cloudMsg"></p>';
    $('panelContent').appendChild(box);
    $('cloudOn').addEventListener('click', function(){
      var pin = $('cloudNewPin').value.trim(), msg = $('cloudMsg');
      if (!/^\d{4,8}$/.test(pin)) { msg.className = 'fb bad'; msg.textContent = 'The PIN must be 4 to 8 digits.'; return; }
      msg.className = 'fb'; msg.textContent = 'Connecting…'; $('cloudOn').disabled = true;
      sheetCall({ action: 'register', name: acc.name, pin: pin, history: accountHistory(acc),
                  profile: { gender: acc.gender || '', selfGender: acc.selfGender || '' } })
        .then(function(res){
          // Already online from another device? The same user name and PIN connect to it.
          if (!res || res.error !== 'taken') return res;
          return sheetCall({ action: 'login', user: acc.name, pin: pin }).then(function(r){
            if (r && r.error === 'pin') r.error = 'taken';
            return r;
          });
        })
        .then(function(res){
          if (res && res.ok) {
            acc.cloud = { user: res.user, token: res.token };
            useCloudHistory(acc, res.history);
            saveAccounts();
            showDashboard('profilePanel');
            toast('☁️ Online saving is on', 'good');
          } else {
            $('cloudOn').disabled = false; msg.className = 'fb bad'; msg.textContent = cloudErrorText(res && res.error);
          }
        }, function(){ $('cloudOn').disabled = false; msg.className = 'fb bad'; msg.textContent = cloudErrorText(); });
    });
  }
  if (SHEET_URL) {
    $('cloudLoginBox').classList.remove('hidden');
    $('saveNote').textContent += ' You can also turn on online saving in 👤 My Profile – it is optional.';
    setTimeout(function(){ setOnlineNote(); loadSheetPlayers(); syncSheet(); }, 0);
  }
  $('cloudLoginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var user = $('cloudUser').value.trim(), pin = $('cloudPin').value.trim(), msg = $('cloudLoginMsg');
    if (!user || !pin) { msg.className = 'fb bad'; msg.textContent = 'Type your user name and PIN.'; return; }
    msg.className = 'fb'; msg.textContent = 'Logging in…';
    sheetCall({ action: 'login', user: user, pin: pin }).then(function(res){
      if (!res || !res.ok) { msg.className = 'fb bad'; msg.textContent = cloudErrorText(res && res.error); return; }
      var acc = accounts.filter(function(a){ return a.cloud && a.cloud.user === res.user; })[0];
      if (!acc) {
        var p = res.profile || {};
        acc = { id:'acc-' + Date.now() + '-' + rnd(100, 999), name: res.name, gender: p.gender || '', selfGender: p.selfGender || '' };
        accounts.push(acc);
      }
      acc.cloud = { user: res.user, token: res.token };
      useCloudHistory(acc, res.history);
      saveAccounts();
      $('cloudUser').value = ''; $('cloudPin').value = ''; msg.textContent = '';
      $('accountsBox').classList.add('hidden');
      enterApp(acc, false);
      toast('👋 Welcome back, ' + acc.name + '!', 'good');
    }, function(){ msg.className = 'fb bad'; msg.textContent = cloudErrorText(); });
  });

  (function loadAccounts(){
    try {
      var list = JSON.parse(localStorage.getItem('atharvaQuizAccounts') || 'null');
      if (Array.isArray(list)) {
        accounts = list.filter(function(x){ return x && x.id && x.name; });
      } else {
        // First time with accounts: keep the single profile that was saved before.
        var old = JSON.parse(localStorage.getItem('atharvaQuizProfile') || 'null');
        if (old && old.name) {
          old.id = 'acc-' + Date.now();
          accounts = [old];
          var hist = JSON.parse(localStorage.getItem('atharvaQuizHistory') || '[]');
          hist.forEach(function(x){ if (!x.accountId) x.accountId = old.id; });
          localStorage.setItem('atharvaQuizHistory', JSON.stringify(hist));
          saveAccounts();
        }
      }
    } catch(e) { accounts = []; }
  })();

  function playerName(){ return nameInput.value.trim(); }
  $('welcomeGender').addEventListener('change', function(){
    $('selfGenderWrap').classList.toggle('hidden', $('welcomeGender').value !== 'Self-describe');
  });

  function enterApp(acc, goProfile){
    profile = acc;
    try { localStorage.setItem('atharvaQuizCurrent', acc.id); localStorage.setItem('atharvaQuizPlayer', acc.name); } catch(e) {}
    nameInput.value = acc.name;
    group = null; renderMenu();
    $('welcome').classList.add('hidden');
    $('dashboardPanel').classList.add('hidden');
    $('quiz').classList.add('hidden');
    $('menu').classList.remove('hidden');
    $('appContent').classList.remove('hidden');
    $('headerPlayer').classList.remove('hidden');
    updateGreeting();
    if (goProfile) showDashboard('profilePanel');
    window.scrollTo(0, 0);
  }

  function renderAccounts(){
    var box = $('accountsList');
    renderOnlineList();
    box.innerHTML = '';
    if (!accounts.length) {
      box.innerHTML = '<p>No accounts saved on this device yet. Create one above!</p>';
      return;
    }
    var all = getAllHistory();
    accounts.forEach(function(acc){
      var xp = xpTotal(all.filter(function(x){ return x.accountId === acc.id; }));
      var isNow = profile && profile.id === acc.id;
      var row = document.createElement('div');
      row.className = 'acct' + (isNow ? ' now' : '');
      var img = document.createElement('img');
      img.alt = ''; img.src = acc.avatar || GENERIC_AVATAR;
      var info = document.createElement('div');
      info.className = 'grow';
      info.innerHTML = '<strong>' + escapeHTML(acc.name) + '</strong><div class="small">⭐ ' + xp + ' XP · Level ' +
                       (Math.floor(xp / 100) + 1) + (isNow ? ' · signed in' : '') + '</div>';
      var open = document.createElement('button');
      open.type = 'button'; open.className = 'primary'; open.textContent = 'Open';
      open.style.padding = '8px 16px';
      open.addEventListener('click', function(){ enterApp(acc, false); });
      row.appendChild(img); row.appendChild(info); row.appendChild(open);
      box.appendChild(row);
    });
  }
  // Clicking the title goes to the home page: the subject menu, or the welcome screen if nobody is signed in.
  function goHome(){
    if (profile && accounts.indexOf(profile) > -1) { enterApp(profile, false); return; }
    $('accountsBox').classList.add('hidden');
    window.scrollTo(0, 0);
  }
  $('homeTitle').addEventListener('click', goHome);
  $('homeTitle').addEventListener('keydown', function(e){ if (e.key === 'Enter') goHome(); });

  $('haveAccountBtn').addEventListener('click', function(){
    loadSheetPlayers();
    renderAccounts();
    $('accountsBox').classList.remove('hidden');
    $('accountsBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('switchAccountBtn').addEventListener('click', function(){
    $('appContent').classList.add('hidden');
    $('headerPlayer').classList.add('hidden');
    $('welcome').classList.remove('hidden');
    renderAccounts();
    $('accountsBox').classList.remove('hidden');
    window.scrollTo(0, 0);
  });

  // Making a new account ADDS it; the accounts saved before stay as they are.
  function continueToQuizzes(e){
    if (e) e.preventDefault();
    if (!$('welcome') || $('welcome').classList.contains('hidden')) return;
    var name = $('welcomeName').value.trim();
    if (!name) { $('welcomeName').focus(); return; }
    var acc = { id:'acc-' + Date.now() + '-' + rnd(100, 999), name:name,
                gender:$('welcomeGender').value, selfGender:$('selfGender').value.trim() };
    accounts.push(acc);
    if (!saveAccounts()) toast('Could not save the account on this device.', 'bad');
    $('welcomeName').value = ''; $('welcomeGender').value = ''; $('selfGender').value = '';
    $('selfGenderWrap').classList.add('hidden');
    $('accountsBox').classList.add('hidden');
    enterApp(acc, false);
  }
  // Handle both the form submit and the button click so Continue works reliably.
  $('profileForm').addEventListener('submit', continueToQuizzes);
  $('continueBtn').addEventListener('click', continueToQuizzes);
  var group = null; // the subject whose quizzes are shown in the menu (e.g. MATTE), or null for the main menu
  function updateGreeting(){
    var n = playerName();
    if (group) {
      $('greeting').textContent = group.icon + ' ' + group.title;
      $('menuSub').textContent = 'Pick a quiz. 10 questions, no timer – take your time!';
    } else {
      $('greeting').textContent = n ? 'Hi ' + n + '! Choose a subject' : 'Choose a subject';
      $('menuSub').textContent = 'Pick a subject to start. 10 questions, no timer – take your time!';
    }
    $('subjectsBtn').classList.toggle('hidden', !group);
  }
  nameInput.addEventListener('input', function(){
    try {
      localStorage.setItem('atharvaQuizPlayer', nameInput.value);
      if (profile && nameInput.value.trim()) { profile.name = nameInput.value.trim(); saveAccounts(); }
    } catch(e){}
    updateGreeting();
  });
  updateGreeting();

  // ---------- player dashboard: local browser data ----------
  function getAllHistory(){
    try { var h = JSON.parse(localStorage.getItem('atharvaQuizHistory') || '[]'); return Array.isArray(h) ? h : []; }
    catch(e) { return []; }
  }
  function getHistory(){
    var id = profile && profile.id;
    return getAllHistory().filter(function(x){ return x.accountId === id; });
  }
  function xpTotal(h){ return h.reduce(function(sum, item){ return sum + (Number(item.score)||0)*10 + 10; }, 0); }
  function showDashboard(panel){
    $('menu').classList.add('hidden'); $('quiz').classList.add('hidden'); $('dashboardPanel').classList.remove('hidden');
    var h = getHistory(), xp = xpTotal(h), level = Math.floor(xp/100)+1, next = 100-(xp%100);
    var title = 'My dashboard', sub = 'Your learning information is saved in this browser on this device.', html = '';
    if(panel === 'xpPanel'){
      title = '⭐ XP & Levels'; sub = 'Earn 10 XP for each correct answer and 10 bonus XP for finishing a quiz.';
      html = '<div class="stat-grid"><div class="stat">⭐ Total XP<strong>'+xp+'</strong></div><div class="stat">🏅 Level<strong>'+level+'</strong></div><div class="stat">🎯 XP to next level<strong>'+next+'</strong></div></div><div class="bar"><span style="width:'+(xp%100)+'%"></span></div><p>Level '+level+' · '+(xp%100)+' / 100 XP toward the next level</p>';
    } else if(panel === 'profilePanel'){
      title = '👤 My Profile'; sub = 'Your profile is stored on this device.';
      var g = profile ? (profile.gender === 'Self-describe' ? (profile.selfGender || 'Self-described') : (profile.gender || 'Prefer not to say')) : 'Prefer not to say';
      html = '<div class="profile-avatar-wrap"><img class="profile-avatar" alt="Profile picture" src="'+escapeHTML(profile&&profile.avatar || 'data:image/jpeg;base64,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')+'"><div><strong>'+escapeHTML(playerName() || 'Atharva')+'</strong><p class="small">Your leaderboard profile picture</p></div></div><div class="stat-grid"><div class="stat">👤 Username<strong class="txt">'+escapeHTML(playerName() || 'Player')+'</strong></div><div class="stat">🙂 Gender<strong class="txt">'+escapeHTML(g)+'</strong></div><div class="stat">⭐ Total XP<strong>'+xp+'</strong></div></div><h3>Edit profile</h3><form id="editProfileForm"><label for="editAvatar">Upload profile picture</label><input id="editAvatar" type="file" accept="image/*"><p class="small">Image stays in this browser. Other people on other devices cannot see it unless the website gets an online server.</p><label for="editName">Username</label><input id="editName" maxlength="30" required value="'+escapeHTML(playerName())+'" style="width:100%;padding:10px;border:2px solid var(--line);border-radius:10px;font:inherit"><label for="editGender" style="display:block;margin-top:10px">Gender (optional)</label><select id="editGender" style="width:100%;padding:10px;border:2px solid var(--line);border-radius:10px;font:inherit"><option value="">Prefer not to say</option><option value="Girl">Girl</option><option value="Boy">Boy</option><option value="Non-binary">Non-binary</option><option value="Self-describe">Self-describe</option></select><div id="editSelfWrap" class="'+((profile&&profile.gender==='Self-describe')?'':'hidden')+'"><label for="editSelf" style="display:block;margin-top:10px">Your description (optional)</label><input id="editSelf" maxlength="30" value="'+escapeHTML(profile&&profile.selfGender||'')+'" style="width:100%;padding:10px;border:2px solid var(--line);border-radius:10px;font:inherit"></div><button class="primary" type="submit" style="margin-top:12px">Save profile</button></form><div class="panel-sec" id="dangerZone"><h3>⚠️ Delete profile</h3><p class="small">Removes this profile and its scores from this device.</p><button class="danger" id="deleteProfileBtn" type="button">🗑 Delete profile</button><div id="deleteConfirm" class="hidden"><p><strong>Delete this profile?</strong> Its quiz scores and XP will be erased. This cannot be undone.</p><div class="result-actions" style="margin-top:0"><button class="danger" id="deleteYes" type="button">Yes, delete it</button><button class="ghost" id="deleteNo" type="button">Cancel</button></div></div></div>';
    } else if(panel === 'progressPanel'){
      title = '📊 My Progress'; sub = 'A summary of the quizzes you have completed.';
      var correct = h.reduce(function(sum,item){return sum+(Number(item.score)||0);},0), total = h.reduce(function(sum,item){return sum+(Number(item.total)||10);},0), pct = total ? Math.round(correct/total*100) : 0;
      var subjects = {}; h.forEach(function(item){ var k=item.subject||'Other'; if(!subjects[k]) subjects[k]={n:0,score:0,total:0}; subjects[k].n++; subjects[k].score+=Number(item.score)||0; subjects[k].total+=Number(item.total)||10; });
      html = '<div class="stat-grid"><div class="stat">📝 Quizzes completed<strong>'+h.length+'</strong></div><div class="stat">✅ Correct answers<strong>'+correct+' / '+total+'</strong></div><div class="stat">📈 Overall accuracy<strong>'+pct+'%</strong></div></div><h3>By subject</h3>';
      var keys=Object.keys(subjects); if(!keys.length) html += '<p>No quiz results yet. Complete a quiz to see your progress here!</p>'; else { html += '<table class="data-table"><thead><tr><th>Subject</th><th>Quizzes</th><th>Accuracy</th></tr></thead><tbody>'; keys.forEach(function(k){var a=subjects[k], pc=a.total?Math.round(a.score/a.total*100):0; html+='<tr><td>'+escapeHTML(k)+'</td><td>'+a.n+'</td><td>'+pc+'%</td></tr>';}); html+='</tbody></table>'; }
      html += '<h3>Recent quizzes</h3>';
      if(h.length){html+='<table class="data-table"><thead><tr><th>Quiz</th><th>Score</th><th>Date</th></tr></thead><tbody>';h.slice().reverse().slice(0,10).forEach(function(a){html+='<tr><td>'+escapeHTML(a.quiz||'Quiz')+'</td><td>'+Number(a.score||0)+' / '+Number(a.total||10)+'</td><td>'+escapeHTML((a.date||'').slice(0,10))+'</td></tr>';});html+='</tbody></table>'; } else html+='<p>Finish your first quiz to start tracking progress.</p>';
    } else {
      title = '🏆 Leaderboard'; sub = 'Best results from all accounts on this device. This is a local leaderboard, not an online ranking.';
      var best = getAllHistory().slice().sort(function(a,b){return (Number(b.score)||0)-(Number(a.score)||0);}).slice(0,10);
      var myAvatar = profile && profile.avatar ? profile.avatar : 'data:image/jpeg;base64,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';
      html = '<div class="profile-avatar-wrap"><img class="profile-avatar" alt="Atharva profile picture" src="'+escapeHTML(myAvatar)+'"><div><strong>'+escapeHTML(playerName()||'Atharva')+'</strong><p class="small">Your player profile · '+xpTotal(h)+' XP · Level '+(Math.floor(xpTotal(h)/100)+1)+'</p></div></div><h3>Best quiz scores</h3>';
      if(!best.length) html+='<p>No quiz scores yet. You are on the leaderboard! Complete a quiz to add your first score.</p>'; else { html+='<table class="data-table"><thead><tr><th>#</th><th>Picture</th><th>Player</th><th>Quiz</th><th>Score</th></tr></thead><tbody>'; best.forEach(function(a,i){var isMe=a.accountId===(profile&&profile.id); var accA=accounts.filter(function(x){return x.id===a.accountId;})[0]; var av=isMe?myAvatar:(accA&&accA.avatar)||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2230%22 fill=%22%23e8e5ff%22/%3E%3Ccircle cx=%2230%22 cy=%2222%22 r=%2210%22 fill=%22%238477c8%22/%3E%3Cpath d=%22M10 54 Q10 34 30 34 Q50 34 50 54%22 fill=%22%238477c8%22/%3E%3C/svg%3E'; html+='<tr><td>'+(i+1)+'</td><td><img class="leader-avatar" alt="" src="'+escapeHTML(av)+'"></td><td>'+escapeHTML((accA&&accA.name)||a.name||'Player')+(isMe?' (You)':'')+'</td><td>'+escapeHTML(a.quiz||'Quiz')+'</td><td>'+Number(a.score||0)+' / '+Number(a.total||10)+'</td></tr>';}); html+='</tbody></table>'; }
      html += onlineTableHTML();
    }
    $('panelTitle').textContent=title; $('panelSub').textContent=sub; $('panelContent').innerHTML=html;
    if(panel==='profilePanel'){
      renderCloudBox();
      $('panelContent').appendChild($('dangerZone'));   // keep "Delete" last, below online saving
      $('deleteProfileBtn').addEventListener('click',function(){$('deleteProfileBtn').classList.add('hidden');$('deleteConfirm').classList.remove('hidden');});
      $('deleteNo').addEventListener('click',function(){$('deleteConfirm').classList.add('hidden');$('deleteProfileBtn').classList.remove('hidden');});
      $('deleteYes').addEventListener('click',deleteProfile);
      $('editGender').value=profile&&profile.gender||'';
      $('editGender').addEventListener('change',function(){$('editSelfWrap').classList.toggle('hidden',this.value!=='Self-describe');});
      $('editProfileForm').addEventListener('submit',function(e){e.preventDefault();var nm=$('editName').value.trim();if(!nm)return;profile=profile||{};profile.name=nm;profile.gender=$('editGender').value;profile.selfGender=$('editSelf').value.trim();var file=$('editAvatar').files&&$('editAvatar').files[0];function saveProfile(){nameInput.value=nm;if(!saveAccounts()){toast('Could not save profile. Try a smaller image.','bad');}else toast('✅ Profile saved','good');try{localStorage.setItem('atharvaQuizPlayer',nm);}catch(err){}updateGreeting();showDashboard('profilePanel');}if(file){if(!file.type.match(/^image\//)){toast('Please choose an image file.','bad');return;}if(file.size>1200000){toast('Please choose an image smaller than 1.2 MB.','bad');return;}var reader=new FileReader();reader.onload=function(){profile.avatar=reader.result;saveProfile();};reader.onerror=function(){toast('Could not read that image.','bad');};reader.readAsDataURL(file);}else saveProfile();});
    }
    window.scrollTo(0,0);
  }
  function deleteProfile(){
    if (!profile) return;
    var id = profile.id;
    accounts = accounts.filter(function(a){ return a.id !== id; });
    try {
      var keep = getAllHistory().filter(function(x){ return x.accountId !== id; });
      localStorage.setItem('atharvaQuizHistory', JSON.stringify(keep));
      localStorage.removeItem('atharvaQuizPlayer');
      if (localStorage.getItem('atharvaQuizCurrent') === id) localStorage.removeItem('atharvaQuizCurrent');
    } catch(e) {}
    saveAccounts();            // also updates the shared player list
    profile = null; nameInput.value = '';
    $('appContent').classList.add('hidden'); $('headerPlayer').classList.add('hidden');
    $('dashboardPanel').classList.add('hidden'); $('quiz').classList.add('hidden');
    $('welcome').classList.remove('hidden');
    renderAccounts();
    $('accountsBox').classList.remove('hidden');
    window.scrollTo(0, 0);
  }
  function escapeHTML(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  document.querySelectorAll('[data-panel]').forEach(function(btn){btn.addEventListener('click',function(){showDashboard(btn.getAttribute('data-panel'));});});
  $('dashboardBack').addEventListener('click',function(){$('dashboardPanel').classList.add('hidden');$('quiz').classList.add('hidden');$('menu').classList.remove('hidden');window.scrollTo(0,0);});

  // ---------- menu ----------
  // A quiz with added:'YYYY-MM-DD' gets a "NYTT" sticker for 14 days; a subject gets one if any of its quizzes is new.
  var NEW_DAYS = 14;
  function isNewQuiz(s){
    if (s.children) return s.children.some(isNewQuiz);
    return !!s.added && (Date.now() - Date.parse(s.added)) < NEW_DAYS * 864e5;
  }

  // ---------- read aloud (Web Speech API, built into the browser) ----------
  var SV_WORDS = /\b(vad|vilken|vilket|vilka|hur|varför|och|är|det|som|inte|eller|sant|falskt|betyder|översätt|ordet)\b/gi;
  function speechLang(text){
    if (current && current.listening) return 'sv-SE';
    if (current && current.id === 'engelska-muntlig') return 'en-GB';
    if (!(current && /^ENGELSKA/.test(current.tag))) return 'sv-SE';
    // In English quizzes a single Swedish word (e.g. 'väckarklocka') must not switch the voice:
    // only a real Swedish sentence – a Swedish question word first, or several Swedish words – is read in Swedish.
    var svCount = (text.match(SV_WORDS) || []).length;
    return /^(vad|vilken|vilket|vilka|hur|varför|sant eller falskt|översätt|skriv)\b/i.test(text) || svCount >= 2 ? 'sv-SE' : 'en-GB';
  }
  function speechVoice(voices, lang){
    var target = lang.toLowerCase().replace(/_/g, '-');
    var matching = voices.filter(function(voice){
      return String(voice.lang || '').toLowerCase().replace(/_/g, '-').split('-')[0] === target.split('-')[0];
    });
    var exact = matching.filter(function(voice){
      return String(voice.lang || '').toLowerCase().replace(/_/g, '-') === target;
    });
    var regional = matching.filter(function(voice){
      return String(voice.lang || '').toLowerCase().replace(/_/g, '-').indexOf(target + '-') === 0;
    });
    var preferred = ['serena', 'kate', 'martha', 'stephanie', 'samantha', 'karen', 'moira', 'fiona', 'tessa', 'victoria', 'allison', 'ava', 'zoe', 'susan', 'hazel'];
    function femaleEnglish(list){
      for (var i = 0; i < preferred.length; i++) {
        var voice = list.filter(function(item){
          return String(item.name || '').toLowerCase().split(/[ (]/)[0] === preferred[i];
        })[0];
        if (voice) return voice;
      }
      return null;
    }
    if (target.split('-')[0] === 'en') {
      return femaleEnglish(exact) || femaleEnglish(regional) || femaleEnglish(matching) ||
        femaleEnglish(voices.filter(function(voice){
          return String(voice.lang || '').toLowerCase().replace(/_/g, '-').split('-')[0] === 'en';
        })) || exact[0] || regional[0] || matching[0];
    }
    return exact[0] || regional[0] || matching[0];
  }
  function speak(parts, btn){
    if (!('speechSynthesis' in window)) { toast('Your browser cannot read aloud', 'bad'); return; }
    var synth = window.speechSynthesis;
    if (synth.speaking) { synth.cancel(); return; }
    var voices = synth.getVoices();
    var utterances = parts.map(function(text){
      var u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang(text);
      u.rate = 0.9;
      var v = speechVoice(voices, u.lang);
      if (u.lang.toLowerCase().indexOf('sv') === 0 && !v) return null;
      if (v) u.voice = v;
      return u;
    });
    if (utterances.some(function(u){ return !u; })) {
      toast('No Swedish voice is available in this browser. Enable a Swedish voice in your device settings, then try again.', 'bad');
      return;
    }
    utterances.forEach(function(u, i){
      if (i === 0) u.onstart = function(){ btn.classList.add('speaking'); };
      if (i === parts.length - 1) u.onend = u.onerror = function(){ btn.classList.remove('speaking'); };
      synth.speak(u);
    });
  }

  // Some browsers load voices late: ask once now so the first 🔊 click already has a Swedish voice.
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function(){ window.speechSynthesis.getVoices(); };
  }
  // Read the reading-comprehension text paragraph by paragraph (long single utterances can cut off).
  $('readingSpeak').addEventListener('click', function(){
    if (!currentReadingPassage) return;
    var parts = [currentReadingPassage.title].concat(currentReadingPassage.text.split(/\n+/));
    speak(parts.filter(function(p){ return p.trim(); }), this);
  });

  // ---------- sound effects and celebrations (Web Audio – no sound files needed) ----------
  var soundOn = true;
  try { soundOn = localStorage.getItem('atharvaQuizSound') !== 'off'; } catch(e) {}
  function showSoundBtn(){ $('soundBtn').textContent = soundOn ? '🔔' : '🔕'; $('soundBtn').title = soundOn ? 'Ljudeffekter på (tryck för att stänga av)' : 'Ljudeffekter av (tryck för att sätta på)'; }
  showSoundBtn();
  $('soundBtn').addEventListener('click', function(){
    soundOn = !soundOn; showSoundBtn();
    try { localStorage.setItem('atharvaQuizSound', soundOn ? 'on' : 'off'); } catch(e) {}
    if (soundOn) sfx('correct');
  });
  var audioCtx = null;
  function tone(freq, start, dur, type, vol){
    var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + start;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function sfx(kind){
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) { return; }
    if (kind === 'correct') { tone(784, 0, 0.18); tone(1175, 0.1, 0.3); }
    else if (kind === 'wrong') { var o = tone(220, 0, 0.35, 'square', 0.08); o.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.35); tone(160, 0.12, 0.3, 'square', 0.06); }
    else if (kind === 'good') { [523, 659, 784].forEach(function(f, i){ tone(f, i * 0.12, 0.3, 'triangle'); }); }
    else if (kind === 'fanfare') {
      [523, 659, 784, 1047].forEach(function(f, i){ tone(f, i * 0.13, 0.28, 'triangle', 0.22); });
      [523, 659, 784, 1047].forEach(function(f){ tone(f, 0.6, 0.9, 'triangle', 0.12); });
      for (var i = 0; i < 8; i++) tone(1500 + Math.random() * 1500, 0.9 + i * 0.07, 0.08, 'sine', 0.05);   // sparkles
    }
  }
  function confetti(count){
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var old = $('confetti'); if (old) old.remove();
    var cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), W = cv.width = innerWidth, H = cv.height = innerHeight;
    var colors = ['#6c4cf1', '#ffcf33', '#1c9c5b', '#c93c6e', '#2b7bd9', '#ff8a3d'], bits = [];
    for (var i = 0; i < count; i++) bits.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      s: 6 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], star: Math.random() < 0.25 });
    var start = performance.now();
    (function frame(now){
      var t = now - start; ctx.clearRect(0, 0, W, H);
      bits.forEach(function(b){
        b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.globalAlpha = Math.max(0, 1 - t / 3200); ctx.fillStyle = b.c;
        if (b.star) { ctx.font = (b.s * 2.4) + 'px sans-serif'; ctx.fillText('⭐', -b.s, b.s); } else ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });
      if (t < 3200) requestAnimationFrame(frame); else cv.remove();
    })(start);
  }
  var CHEERS = ['🎉 PERFEKT! Alla rätt! 🎉', '🌟 Fantastiskt! Full pott! 🌟', '🏆 Mästare! Alla rätt! 🏆', '🚀 Wow! Du klarade allt! 🚀'];
  function celebrate(score, total){
    var old = document.querySelector('#result .cheer'); if (old) old.remove();
    var sc = $('resultScore'); sc.classList.remove('bounce'); void sc.offsetWidth;
    var cheer = document.createElement('div'); cheer.className = 'cheer';
    if (score === total) { cheer.textContent = pick(CHEERS); sfx('fanfare'); confetti(160); sc.classList.add('bounce'); }
    else if (score / total >= 0.8) { cheer.className = 'cheer small'; cheer.textContent = '👏 Snyggt! Nästan alla rätt!'; sfx('good'); confetti(40); sc.classList.add('bounce'); }
    else { sfx('wrong'); cheer = null; }
    if (cheer) sc.after(cheer);
    questions.forEach(function(q, i){
      var box = $('q' + i);
      box.classList.remove('shake', 'pop'); void box.offsetWidth;
      box.classList.add(box.classList.contains('wrong') ? 'shake' : 'pop');
    });
  }

  // A quiz the current player has already done shows a green ✅ and the best score so far.
  function quizDone(s){
    if (s.children || !s.title) return null;
    var h, me = playerName(), best = null;
    try { h = JSON.parse(localStorage.getItem('atharvaQuizHistory') || '[]'); } catch(e) { return null; }
    h.forEach(function(x){
      if (x.quiz !== s.title || x.subject !== s.tag) return;
      if (me && x.name && x.name !== me) return;
      if (!best || x.score > best.score) best = x;
    });
    return best;
  }

  function renderMenu(){
    var grid = $('menuGrid');
    grid.innerHTML = '';
    (group ? group.children : SUBJECTS).forEach(function(s){
      var b = document.createElement('button');
      b.className = 'menu-item';
      b.style.setProperty('--c', s.color);
      var done = quizDone(s);
      b.innerHTML = '<span class="tag">' + s.tag + '</span>' + (isNewQuiz(s) ? '<span class="new-badge">🆕 NYTT</span>' : '') +
                    (done ? '<span class="done-mark" title="Du har gjort detta quiz">✅ ' + done.score + ' / ' + done.total + '</span>' : '') + '<strong>' + s.icon + ' ' + s.title +
                    '</strong><span class="d">' + s.desc + (s.children ? '' : (s.reading ? '' : ' · 10 questions')) + '</span>';
      b.addEventListener('click', function(){
        if (s.children) { group = s; renderMenu(); updateGreeting(); window.scrollTo(0, 0); }
        else startQuiz(s);
      });
      grid.appendChild(b);
    });
  }
  $('subjectsBtn').addEventListener('click', function(){
    group = null; renderMenu(); updateGreeting(); window.scrollTo(0, 0);
  });
  renderMenu();
  updateGreeting();

  // ---------- quiz ----------
  function answeredCount(){
    return questions.filter(function(q){ return q.picked !== null; }).length;
  }
  var idx = 0;
  function updateProgress(){
    if (checked) { $('progress').textContent = ''; return; }
    var last = idx === TOTAL - 1;
    var answered = questions[idx] && questions[idx].picked !== null;
    $('backBtn').classList.toggle('hidden', idx === 0);
    $('nextBtn').classList.toggle('hidden', last);
    $('checkBtn').classList.toggle('hidden', !last);
    $('nextBtn').disabled = !answered;
    $('checkBtn').disabled = answeredCount() < TOTAL;
    $('progress').textContent = 'Question ' + (idx + 1) + ' of ' + TOTAL +
      (answered ? '' : questions[idx] && questions[idx].input ? ' – type your answer' : ' – pick an answer');
  }
  function showQuestion(i){
    idx = i;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    for (var k = 0; k < questions.length; k++) {
      $('q' + k).classList.toggle('hidden', k !== idx);
    }
    updateProgress();
    window.scrollTo(0, 0);
  }

  function render(){
    var form = $('quizForm');
    form.innerHTML = '';
    questions.forEach(function(q, i){
      var box = document.createElement('div');
      box.className = 'q'; box.id = 'q' + i;
      var title = document.createElement('div');
      title.className = 'q-title';
      var small = document.createElement('small');
      small.textContent = 'Question ' + (i + 1);
      var say = document.createElement('button');
      say.type = 'button'; say.className = 'speak-btn'; say.textContent = '🔊';
      say.title = 'Läs upp frågan / Read the question aloud';
      say.setAttribute('aria-label', 'Read the question aloud');
      say.addEventListener('click', function(){
        speak([q.text].concat(q.input ? [] : (q.options || [])), say);
      });
      title.appendChild(say);
      title.appendChild(small);
      title.appendChild(document.createTextNode(q.text));
      box.appendChild(title);
      if (q.pic && PICS[q.pic]) {
        var pic = document.createElement('div');
        pic.className = 'q-pic'; pic.setAttribute('aria-hidden', 'true');
        pic.innerHTML = PICS[q.pic];
        box.appendChild(pic);
      }
      var opts = document.createElement('div');
      opts.className = 'opts';
      if (q.input) {
        var wrap = document.createElement('label');
        wrap.className = 'opt typein';
        var field = document.createElement('input');
        field.type = 'text'; field.autocomplete = 'off'; field.spellcheck = false;
        field.placeholder = '✍️ Type your answer here';
        field.setAttribute('aria-label', 'Your answer');
        field.addEventListener('input', function(){
          if (checked) return;
          q.picked = field.value.trim() || null;
          wrap.classList.toggle('selected', q.picked !== null);
          updateProgress();
        });
        field.addEventListener('keydown', function(e){
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (checked) { if (q.retry) q.retry(); return; }
          if (q.picked !== null && idx < TOTAL - 1) showQuestion(idx + 1);
        });
        wrap.appendChild(field);
        opts.appendChild(wrap);
      }
      q.options.forEach(function(val){
        var lab = document.createElement('label');
        lab.className = 'opt';
        var inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'q' + i; inp.value = val;
        inp.addEventListener('change', function(){
          if (checked) return;
          q.picked = val;
          var all = opts.querySelectorAll('.opt');
          for (var k = 0; k < all.length; k++) all[k].classList.remove('selected');
          lab.classList.add('selected');
          updateProgress();
        });
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(val));
        opts.appendChild(lab);
      });
      box.appendChild(opts);
      var fb = document.createElement('div');
      fb.className = 'fb hidden'; fb.id = 'fb' + i;
      box.appendChild(fb);
      form.appendChild(box);
    });
    showQuestion(0);
  }

  function startQuiz(subject){
    if (subject) current = subject;
    TOTAL = current.reading ? 7 : 10;
    currentReadingPassage = null;
    questions = current.make();
    var passageBox = $('readingPassage');
    if (currentReadingPassage) {
      $('readingTitle').textContent = currentReadingPassage.title;
      $('readingText').textContent = currentReadingPassage.text;
      passageBox.classList.remove('hidden');
    } else { passageBox.classList.add('hidden'); }
    // Listening quizzes hide the text until the answers have been checked.
    $('readingText').classList.toggle('hidden', !!current.listening);
    $('listenHint').classList.toggle('hidden', !current.listening);
    checked = false;
    $('menu').classList.add('hidden');
    $('dashboardPanel').classList.add('hidden');
    $('quiz').classList.remove('hidden');
    $('result').classList.add('hidden');
    $('reviewBox').classList.add('hidden');
    $('againBtn').classList.add('hidden');
    $('checkBtn').classList.remove('hidden');
    $('quizForm').classList.remove('locked');
    $('quizTitle').textContent = current.icon + ' ' + current.tag + ': ' + current.title;
    // Sketch pad is only for MATTE quizzes
    var isMatte = current.tag === 'MATTE';
    $('padBtn').classList.toggle('hidden', !isMatte);
    if (!isMatte) {
      $('padCard').classList.add('hidden');
      $('padBtn').textContent = '✏️ Sketch pad';
    }
    var n = playerName();
    $('quizIntro').textContent = (n ? n + ', answer' : 'Answer') +
      ' all ' + TOTAL + ' questions, then press “Check answers”. Nothing is marked until you do!';
    render();
    window.scrollTo(0, 0);
  }

  function toMenu(){
    $('quiz').classList.add('hidden');
    $('menu').classList.remove('hidden');
    updateGreeting();
    window.scrollTo(0, 0);
  }

  function checkAnswers(){
    if (checked || answeredCount() < TOTAL) return;
    checked = true;
    if (current.listening) { $('readingText').classList.remove('hidden'); $('listenHint').classList.add('hidden'); }
    var score = 0, mistakes = [], fixable = current.tag === 'MATTE';
    questions.forEach(function(q, i){
      var box = $('q' + i), fb = $('fb' + i);
      var labels = box.querySelectorAll('.opt'), right = answerIsRight(q);
      for (var k = 0; k < labels.length; k++) {
        var inp = labels[k].querySelector('input');
        inp.disabled = true;
        if (q.input) labels[k].classList.add(right ? 'correct' : 'incorrect');
        else if (inp.value === q.correct && (right || !fixable)) labels[k].classList.add('correct');   // maths: don't give the answer away
        else if (inp.value === q.picked) labels[k].classList.add('incorrect');
      }
      fb.classList.remove('hidden');
      if (right) {
        score++;
        box.classList.add('right');
        fb.className = 'fb good'; fb.textContent = '✅ Correct!';
      } else {
        box.classList.add('wrong');
        fb.className = 'fb bad';
        mistakes.push(q);
        if (fixable) allowFix(q, i);
        else fb.textContent = '❌ Not quite. Correct answer: ' + q.correct;
      }
    });
    $('quizForm').classList.add('locked');
    for (var qi = 0; qi < questions.length; qi++) $('q' + qi).classList.remove('hidden');
    $('backBtn').classList.add('hidden');
    $('nextBtn').classList.add('hidden');

    var n = playerName();
    $('resultName').textContent = n ? 'Player: ' + n + ' · ' + current.tag : current.tag;
    $('resultScore').textContent = '🏆 ' + score + ' / ' + TOTAL;
    try {
      var history = JSON.parse(localStorage.getItem('atharvaQuizHistory') || '[]');
      history.push({ accountId:(profile && profile.id) || '', name:n, quiz:current.title, subject:current.tag, score:score, total:TOTAL, date:new Date().toISOString() });
      if (history.length > 500) history = history.slice(-500);
      localStorage.setItem('atharvaQuizHistory', JSON.stringify(history));
    } catch(e) {}
    sheetNotify = true;
    syncOnline();
    toast('🏆 ' + score + ' / ' + TOTAL + ' saved · +' + (score * 10 + 10) + ' XP', score * 2 >= TOTAL ? 'good' : '');
    var msg;
    if (score === TOTAL) msg = 'Perfect score! Amazing work! 🌟';
    else if (score >= 8) msg = 'Great job! Almost perfect! 👏';
    else if (score >= 5) msg = 'Good effort! Look at the mistakes below and try again. 💪';
    else msg = 'Keep practising – you can do it! Try a new quiz. 🙂';
    $('resultMsg').textContent = msg;
    celebrate(score, TOTAL);

    var list = $('reviewList');
    list.innerHTML = '';
    mistakes.forEach(function(q){
      var li = document.createElement('li');
      li.textContent = q.text + '  →  ' + q.correct + '   (you answered: ' + q.picked + ')';
      list.appendChild(li);
    });
    $('reviewBox').classList.toggle('hidden', mistakes.length === 0 || fixable);   // maths: the questions below show it
    fixCount = 0; fixTotal = fixable ? mistakes.length : 0;
    updateFixNote();

    $('result').classList.remove('hidden');
    $('checkBtn').classList.add('hidden');
    $('againBtn').classList.remove('hidden');
    $('progress').textContent = '';
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Maths: after the result, wrong answers can be corrected. The saved score and XP stay as they were.
  var fixCount = 0, fixTotal = 0;
  function updateFixNote(){
    var note = $('fixNote');
    note.classList.toggle('hidden', !fixTotal);
    if (!fixTotal) return;
    note.textContent = fixCount === fixTotal
      ? '✅ You corrected all ' + fixTotal + ' mistakes – well done! (Corrections give no XP.)'
      : '✏️ Fix your mistakes in the questions below. Corrected: ' + fixCount + ' of ' + fixTotal + ' (no XP for corrections).';
  }
  function allowFix(q, i){
    var box = $('q' + i), fb = $('fb' + i), done = false;
    var labels = box.querySelectorAll('.opt');
    box.classList.add('fixing');
    fb.textContent = '❌ Not quite. Try to correct it!';
    var row = document.createElement('div');
    row.className = 'fix-row';
    var showBtn = document.createElement('button');
    showBtn.type = 'button'; showBtn.className = 'ghost'; showBtn.textContent = '👀 Show answer';
    function finish(fixed){
      done = true;
      box.classList.remove('fixing');
      for (var k = 0; k < labels.length; k++) labels[k].querySelector('input').disabled = true;
      row.remove();
      if (fixed) {
        fixCount++;
        box.classList.remove('wrong'); box.classList.add('right');
        fb.className = 'fb good'; fb.textContent = '✅ Corrected! (no XP for corrections)';
      } else {
        fb.textContent = '❌ Correct answer: ' + q.correct;
        for (var j = 0; j < labels.length; j++) {
          if (!q.input && labels[j].querySelector('input').value === q.correct) labels[j].classList.add('correct');
        }
      }
      updateFixNote();
      if (fixed) toast(fixCount === fixTotal ? '🌟 All mistakes corrected!' : '✅ Corrected! (no XP)', 'good');
    }
    showBtn.addEventListener('click', function(){ if (!done) finish(false); });
    if (q.input) {
      var field = labels[0].querySelector('input');
      field.disabled = false;
      var tryBtn = document.createElement('button');
      tryBtn.type = 'button'; tryBtn.className = 'ghost'; tryBtn.textContent = '✅ Check again';
      q.retry = function(){
        var val = field.value.trim();
        if (done || !val) return;
        if (answerIsRight({ input: true, accept: q.accept, picked: val })) {
          labels[0].classList.remove('incorrect'); labels[0].classList.add('correct');
          sfx('correct');
          finish(true);
        } else {
          sfx('wrong');
          fb.textContent = '❌ “' + val + '” is not right either. Try again!';
        }
      };
      tryBtn.addEventListener('click', q.retry);
      row.appendChild(tryBtn);
    } else {
      for (var k = 0; k < labels.length; k++) (function(lab){
        var inp = lab.querySelector('input');
        if (inp.value === q.picked) return;
        inp.disabled = false;
        inp.addEventListener('change', function(){
          if (done) return;
          if (inp.value === q.correct) { lab.classList.add('correct'); sfx('correct'); finish(true); }
          else {
            sfx('wrong');
            lab.classList.add('incorrect'); inp.disabled = true;
            fb.textContent = '❌ Not that one either. Try again!';
          }
        });
      })(labels[k]);
    }
    row.appendChild(showBtn);
    fb.after(row);
  }

  // ---------- sketch pad ----------
  var cv = $('padCanvas'), ctx = cv.getContext('2d');
  var pen = { color: '#26224a', size: 3, erase: false }, drawing = false, lastPt = null;

  function sizeCanvas(){
    var r = cv.getBoundingClientRect();
    if (!r.width) return;
    var dpr = window.devicePixelRatio || 1;
    var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (cv.width === w && cv.height === h) return;
    var tmp = document.createElement('canvas');
    tmp.width = cv.width; tmp.height = cv.height;
    tmp.getContext('2d').drawImage(cv, 0, 0);
    cv.width = w; cv.height = h;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.drawImage(tmp, 0, 0);
  }
  function ptFrom(e){
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
  }
  function strokeLine(a, b){
    var dpr = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = pen.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = pen.color;
    ctx.lineWidth = (pen.erase ? pen.size * 3 : pen.size) * dpr;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  cv.addEventListener('pointerdown', function(e){
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch(err){}
    drawing = true; lastPt = ptFrom(e);
    strokeLine(lastPt, lastPt);
  });
  cv.addEventListener('pointermove', function(e){
    if (!drawing) return;
    e.preventDefault();
    var p = ptFrom(e);
    strokeLine(lastPt, p);
    lastPt = p;
  });
  function stopDraw(){ drawing = false; lastPt = null; }
  function savePad(){ try { localStorage.setItem('atharvaQuizSketch', cv.toDataURL('image/png')); } catch(e) {} }
  function restorePad(){
    try {
      var savedDrawing = localStorage.getItem('atharvaQuizSketch');
      if (!savedDrawing) return;
      var img = new Image();
      img.onload = function(){ ctx.drawImage(img, 0, 0, cv.width, cv.height); };
      img.src = savedDrawing;
    } catch(e) {}
  }
  cv.addEventListener('pointerup', function(){ stopDraw(); savePad(); });
  cv.addEventListener('pointercancel', function(){ stopDraw(); savePad(); });
  cv.addEventListener('pointerleave', function(){ if (drawing) { stopDraw(); savePad(); } });

  var swatches = $('padCard').querySelectorAll('.sw'), sizes = $('padCard').querySelectorAll('[data-size]');
  function setActive(list, el){
    for (var i = 0; i < list.length; i++) list[i].classList.toggle('active', list[i] === el);
  }
  Array.prototype.forEach.call(swatches, function(b){
    b.addEventListener('click', function(){
      pen.color = b.getAttribute('data-color'); pen.erase = false;
      setActive(swatches, b); $('padErase').classList.remove('active');
    });
  });
  Array.prototype.forEach.call(sizes, function(b){
    b.addEventListener('click', function(){
      pen.size = parseInt(b.getAttribute('data-size'), 10);
      setActive(sizes, b);
    });
  });
  $('padErase').addEventListener('click', function(){
    pen.erase = !pen.erase;
    $('padErase').classList.toggle('active', pen.erase);
    if (pen.erase) setActive(swatches, null);
    else setActive(swatches, swatches[0]), pen.color = swatches[0].getAttribute('data-color');
  });
  $('padClear').addEventListener('click', function(){
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cv.width, cv.height);
    try { localStorage.removeItem('atharvaQuizSketch'); } catch(e) {}
    toast('🗑 Sketch pad cleared');
  });
  $('padBtn').addEventListener('click', function(){
    var open = $('padCard').classList.toggle('hidden') === false;
    $('padBtn').textContent = open ? '✏️ Hide sketch pad' : '✏️ Sketch pad';
    if (open) { sizeCanvas(); restorePad(); $('padCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  });
  window.addEventListener('resize', function(){ if (!$('padCard').classList.contains('hidden')) sizeCanvas(); });

  $('nextBtn').addEventListener('click', function(){ if (idx < TOTAL - 1) showQuestion(idx + 1); });
  $('backBtn').addEventListener('click', function(){ if (idx > 0) showQuestion(idx - 1); });
  $('checkBtn').addEventListener('click', checkAnswers);
  $('againBtn').addEventListener('click', function(){ startQuiz(); });
  $('againBtn2').addEventListener('click', function(){ startQuiz(); });
  $('menuBtn').addEventListener('click', toMenu);
  $('menuBtn2').addEventListener('click', toMenu);
})();
