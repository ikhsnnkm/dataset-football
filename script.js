/**
 * ============================================================
 *  Football Analytics Dashboard — script.js
 *  Dataset: Club Football Elo Ratings (2000–2025)
 *  Kolom  : date | club | country | elo
 * ============================================================
 */

// ── Global state ─────────────────────────────────────────────
var raw      = [];   // data setelah dinormalisasi
var filtered = [];   // data setelah filter
var clubNames = [];  // semua nama klub unik
var selectedClubs = [];
var charts = {};
var dataType = 'elo';

var PALETTE = [
  '#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7',
  '#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6',
];

// ════════════════════════════════════════════════════════════
//  UPLOAD
// ════════════════════════════════════════════════════════════
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function handleDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileSelect(e) {
  var file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('❌ Hanya file CSV yang didukung', 'error'); return;
  }
  setLoading(true);

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    worker: false,
    complete: function(results) {
      setLoading(false);
      if (!results.data || results.data.length === 0) {
        showToast('❌ File CSV kosong', 'error'); return;
      }

      var cols  = results.meta.fields || [];
      var lower = cols.map(function(c){ return c.toLowerCase().trim(); });

      if (lower.indexOf('club') >= 0 && lower.indexOf('elo') >= 0 && lower.indexOf('country') >= 0) {
        dataType = 'elo';
      } else if (lower.indexOf('home_team') >= 0 || lower.indexOf('home_score') >= 0) {
        dataType = 'match';
      } else {
        showToast('⚠️ Kolom tidak dikenali. Butuh: date, club, country, elo', 'error'); return;
      }

      showToast('✅ ' + results.data.length.toLocaleString() + ' rows dimuat', 'success');
      buildDataset(results.data);
    },
    error: function(err) {
      setLoading(false);
      showToast('❌ Gagal parse: ' + err.message, 'error');
    }
  });
}

function setLoading(on) {
  document.getElementById('upload-section').style.opacity = on ? '0.4' : '1';
  document.getElementById('loading').style.display = on ? 'flex' : 'none';
}

// ════════════════════════════════════════════════════════════
//  BUILD & INIT
// ════════════════════════════════════════════════════════════
function buildDataset(rows) {
  if (dataType === 'elo') {
    raw = [];
    for (var i = 0; i < rows.length; i++) {
      var r  = rows[i];
      var dateStr  = String(r.date    || r.Date    || '').trim();
      var clubStr  = String(r.club    || r.Club    || '').trim();
      var countryStr = String(r.country || r.Country || '').trim();
      var eloVal   = parseFloat(r.elo || r.Elo || r.ELO || 0);
      var yearVal  = parseInt(dateStr.substring(0, 4)) || null;
      if (clubStr && eloVal > 0) {
        raw.push({ date: dateStr, club: clubStr, country: countryStr, elo: eloVal, year: yearVal });
      }
    }

    // Nilai unik untuk filter
    var countrySet = {};
    var yearSet    = {};
    var clubSet    = {};
    for (var j = 0; j < raw.length; j++) {
      countrySet[raw[j].country] = 1;
      if (raw[j].year) yearSet[raw[j].year] = 1;
      clubSet[raw[j].club] = 1;
    }

    var countries = Object.keys(countrySet).sort();
    var years     = Object.keys(yearSet).map(Number).sort(function(a,b){return a-b;});
    clubNames     = Object.keys(clubSet).sort();

    fillSelect('filter-country', countries, 'Semua Negara');
    fillSelect('filter-year', years.map(String), 'Semua Tahun');

  } else {
    // Match mode
    raw = [];
    for (var k = 0; k < rows.length; k++) {
      var m  = rows[k];
      var hs = parseInt(m.home_score) || 0;
      var as = parseInt(m.away_score) || 0;
      raw.push({
        date:       String(m.date || '').trim(),
        home_team:  String(m.home_team || '').trim(),
        away_team:  String(m.away_team || '').trim(),
        home_score: hs, away_score: as,
        league:     String(m.league || '').trim(),
        elo_home:   parseFloat(m.elo_home) || 0,
        elo_away:   parseFloat(m.elo_away) || 0,
        year:       parseInt(String(m.date || '').substring(0,4)) || null,
        result:     hs > as ? 'home' : as > hs ? 'away' : 'draw'
      });
    }

    var leagueSet2 = {}, yearSet2 = {};
    for (var l = 0; l < raw.length; l++) {
      if (raw[l].league) leagueSet2[raw[l].league] = 1;
      if (raw[l].year) yearSet2[raw[l].year] = 1;
    }
    var leagues2 = Object.keys(leagueSet2).sort();
    var years2   = Object.keys(yearSet2).map(Number).sort(function(a,b){return a-b;});
    fillSelect('filter-country', leagues2, 'Semua Liga');
    fillSelect('filter-year', years2.map(String), 'Semua Tahun');
  }

  filtered = raw.slice();

  document.getElementById('upload-section').style.display = 'none';
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('header-badge').classList.remove('hidden');

  renderAll();
}

// ════════════════════════════════════════════════════════════
//  FILTER
// ════════════════════════════════════════════════════════════
function applyFilters() {
  var country = document.getElementById('filter-country').value;
  var year    = document.getElementById('filter-year').value;
  filtered = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    if (dataType === 'elo') {
      if (country && r.country !== country) continue;
      if (year    && String(r.year) !== year) continue;
    } else {
      if (country && r.league !== country) continue;
      if (year    && String(r.year) !== year) continue;
    }
    filtered.push(r);
  }
  document.getElementById('filter-count').textContent = filtered.length.toLocaleString() + ' records';
  renderAll();
}

function resetFilters() {
  document.getElementById('filter-country').value = '';
  document.getElementById('filter-year').value    = '';
  filtered = raw.slice();
  document.getElementById('filter-count').textContent = '';
  renderAll();
}

// ════════════════════════════════════════════════════════════
//  RENDER ALL
// ════════════════════════════════════════════════════════════
function renderAll() {
  if (dataType === 'elo') {
    renderStats();
    renderPreview();
    renderTopClubs();
    renderDistribution();
    renderByCountry();
    renderPerYear();
    renderRankHighest();
    renderRankCountries();
    if (selectedClubs.length > 0) renderTimeline();
    else renderTimelineEmpty();
  } else {
    renderMatchStats();
    renderMatchPreview();
    renderMatchResultPie();
    renderMatchTopLeagues();
    renderMatchTopTeams();
    renderPerYear();
    renderRankHighest_Match();
    renderRankCountries_Match();
    renderTimelineEmpty();
  }
}

// ════════════════════════════════════════════════════════════
//  ELO MODE — RENDER FUNCTIONS
// ════════════════════════════════════════════════════════════

function renderStats() {
  var d = filtered;
  var clubSet = {}, countrySet = {};
  var sum = 0;
  for (var i = 0; i < d.length; i++) {
    clubSet[d[i].club] = 1;
    countrySet[d[i].country] = 1;
    sum += d[i].elo;
  }
  var avgElo = d.length ? sum / d.length : 0;
  animateNum('stat-records',   d.length);
  animateNum('stat-clubs',     Object.keys(clubSet).length);
  setText('stat-avg-elo',      avgElo.toFixed(0));
  animateNum('stat-countries', Object.keys(countrySet).length);
}

function renderPreview() {
  var rows = filtered.slice(0, 20);
  var cols = ['date','club','country','elo'];
  var thead = '<thead><tr>' + cols.map(function(c){ return '<th>' + c + '</th>'; }).join('') + '</tr></thead>';
  var tbody = '<tbody>' + rows.map(function(r){
    return '<tr>' + cols.map(function(c){ return '<td>' + (r[c] != null ? r[c] : '—') + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody>';
  document.getElementById('preview-table').innerHTML = thead + tbody;
  document.getElementById('preview-rows-badge').textContent = rows.length + ' rows';
}

function renderTopClubs() {
  var byClub = groupBy(filtered, 'club');
  var clubs = [];
  var keys = Object.keys(byClub);
  for (var i = 0; i < keys.length; i++) {
    clubs.push({ club: keys[i], avg: avgField(byClub[keys[i]], 'elo') });
  }
  clubs.sort(function(a,b){ return b.avg - a.avg; });
  clubs = clubs.slice(0, 10);

  renderBarChart('chart-top-clubs',
    clubs.map(function(c){ return shortLabel(c.club, 16); }),
    clubs.map(function(c){ return +c.avg.toFixed(1); }),
    'Rata-rata Elo', PALETTE[0]);
}

function renderDistribution() {
  var d = filtered;
  if (!d.length) return;

  // Cari min/max dengan loop — AMAN untuk array 200k+
  var minElo = d[0].elo, maxElo = d[0].elo;
  for (var i = 1; i < d.length; i++) {
    if (d[i].elo < minElo) minElo = d[i].elo;
    if (d[i].elo > maxElo) maxElo = d[i].elo;
  }

  var bucketSize = 100;
  var minB = Math.floor(minElo / bucketSize) * bucketSize;
  var maxB = Math.ceil(maxElo  / bucketSize) * bucketSize;
  var buckets = {};
  for (var b = minB; b < maxB; b += bucketSize) buckets[b] = 0;
  for (var j = 0; j < d.length; j++) {
    var bk = Math.floor(d[j].elo / bucketSize) * bucketSize;
    buckets[bk] = (buckets[bk] || 0) + 1;
  }

  var labels = Object.keys(buckets).map(function(k){ return k + '–' + (+k + bucketSize); });
  var values = Object.values(buckets);

  destroyChart('chart-distribution');
  var ctx = document.getElementById('chart-distribution').getContext('2d');
  charts['chart-distribution'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Jumlah Data', data: values,
        backgroundColor: PALETTE[2] + '99', borderColor: PALETTE[2],
        borderWidth: 1, borderRadius: 4 }]
    },
    options: baseChartOptions()
  });
}

function renderByCountry() {
  var byCountry = groupBy(filtered, 'country');
  var list = [];
  var keys = Object.keys(byCountry);
  for (var i = 0; i < keys.length; i++) {
    list.push({ country: keys[i], avg: avgField(byCountry[keys[i]], 'elo') });
  }
  list.sort(function(a,b){ return b.avg - a.avg; });
  list = list.slice(0, 10);

  renderBarChart('chart-by-country',
    list.map(function(c){ return c.country; }),
    list.map(function(c){ return +c.avg.toFixed(1); }),
    'Rata-rata Elo', PALETTE[4], true);
}

function renderPerYear() {
  var byYear = groupBy(filtered, 'year');
  var years  = Object.keys(byYear).filter(function(y){ return y && y !== 'null'; }).sort();
  var counts = years.map(function(y){ return byYear[y].length; });

  destroyChart('chart-per-year');
  var ctx = document.getElementById('chart-per-year').getContext('2d');
  charts['chart-per-year'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{ label: 'Jumlah Records', data: counts,
        borderColor: PALETTE[1], backgroundColor: PALETTE[1] + '20',
        fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 5 }]
    },
    options: baseChartOptions()
  });
}

function renderRankHighest() {
  // Ambil Elo terbaru per klub
  var latest = {};
  for (var i = 0; i < filtered.length; i++) {
    var r = filtered[i];
    if (!latest[r.club] || r.date > latest[r.club].date) latest[r.club] = r;
  }
  var top = Object.values(latest).sort(function(a,b){ return b.elo - a.elo; }).slice(0, 10);

  if (!top.length) {
    document.getElementById('rank-highest').innerHTML =
      '<p class="text-sm text-center py-4" style="color:var(--text-muted)">Tidak ada data</p>'; return;
  }
  var maxElo = top[0].elo;
  var html = '';
  for (var j = 0; j < top.length; j++) {
    var r2 = top[j];
    var pct = (r2.elo / maxElo * 100).toFixed(1);
    html += '<div class="rank-item">' +
      '<span class="rank-num">' + (j+1) + '</span>' +
      '<div style="flex:1">' +
        '<div class="flex items-center justify-between">' +
          '<span class="rank-name">' + esc(r2.club) + '</span>' +
          '<span class="rank-val">' + r2.elo.toFixed(0) + '</span>' +
        '</div>' +
        '<div class="progress-bar mt-1.5">' +
          '<div class="progress-fill" style="width:' + pct + '%;background:' + PALETTE[j % PALETTE.length] + '"></div>' +
        '</div>' +
        '<span style="font-size:.68rem;color:var(--text-muted)">' + esc(r2.country) + ' · ' + r2.date + '</span>' +
      '</div>' +
    '</div>';
  }
  document.getElementById('rank-highest').innerHTML = html;
}

function renderRankCountries() {
  var byCountry = {};
  for (var i = 0; i < filtered.length; i++) {
    var c = filtered[i].country, club = filtered[i].club;
    if (!byCountry[c]) byCountry[c] = {};
    byCountry[c][club] = 1;
  }
  var top = [];
  var keys = Object.keys(byCountry);
  for (var j = 0; j < keys.length; j++) {
    top.push({ country: keys[j], count: Object.keys(byCountry[keys[j]]).length });
  }
  top.sort(function(a,b){ return b.count - a.count; });
  top = top.slice(0, 10);

  if (!top.length) {
    document.getElementById('rank-countries').innerHTML =
      '<p class="text-sm text-center py-4" style="color:var(--text-muted)">Tidak ada data</p>'; return;
  }
  var maxCount = top[0].count;
  var html = '';
  for (var k = 0; k < top.length; k++) {
    var r = top[k];
    var pct = (r.count / maxCount * 100).toFixed(1);
    html += '<div class="rank-item">' +
      '<span class="rank-num">' + (k+1) + '</span>' +
      '<div style="flex:1">' +
        '<div class="flex items-center justify-between">' +
          '<span class="rank-name">' + esc(r.country) + '</span>' +
          '<span class="rank-val">' + r.count + ' klub</span>' +
        '</div>' +
        '<div class="progress-bar mt-1.5">' +
          '<div class="progress-fill" style="width:' + pct + '%;background:' + PALETTE[k % PALETTE.length] + '"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  document.getElementById('rank-countries').innerHTML = html;
}

// ════════════════════════════════════════════════════════════
//  MATCH MODE — RENDER
// ════════════════════════════════════════════════════════════
function renderMatchStats() {
  var d = filtered;
  var teams = {}, leagues = {}, goals = 0;
  for (var i = 0; i < d.length; i++) {
    teams[d[i].home_team] = 1; teams[d[i].away_team] = 1;
    leagues[d[i].league] = 1;
    goals += d[i].home_score + d[i].away_score;
  }
  animateNum('stat-records',   d.length);
  animateNum('stat-clubs',     Object.keys(teams).length);
  setText('stat-avg-elo',      d.length ? (goals/d.length).toFixed(2) : '—');
  animateNum('stat-countries', Object.keys(leagues).length);
}
function renderMatchPreview() {
  var rows = filtered.slice(0,20);
  var cols = ['date','home_team','away_team','home_score','away_score','league'];
  var thead = '<thead><tr>'+cols.map(function(c){return '<th>'+c+'</th>';}).join('')+'</tr></thead>';
  var tbody = '<tbody>'+rows.map(function(r){
    return '<tr>'+cols.map(function(c){return '<td>'+(r[c]!=null?r[c]:'—')+'</td>';}).join('')+'</tr>';
  }).join('')+'</tbody>';
  document.getElementById('preview-table').innerHTML = thead+tbody;
  document.getElementById('preview-rows-badge').textContent = rows.length+' rows';
}
function renderMatchResultPie() {
  var d=filtered, home=0, away=0, draw=0;
  for(var i=0;i<d.length;i++){
    if(d[i].result==='home')home++;
    else if(d[i].result==='away')away++;
    else draw++;
  }
  destroyChart('chart-top-clubs');
  var ctx=document.getElementById('chart-top-clubs').getContext('2d');
  charts['chart-top-clubs']=new Chart(ctx,{type:'doughnut',
    data:{labels:['Home Win','Away Win','Draw'],
      datasets:[{data:[home,away,draw],backgroundColor:[PALETTE[0],PALETTE[2],PALETTE[3]],borderWidth:0,hoverOffset:6}]},
    options:{...baseChartOptions(),cutout:'65%',plugins:{legend:{display:true,labels:{color:'#7d8fa8',font:{family:'DM Sans',size:11}}}}}
  });
}
function renderMatchTopLeagues(){
  var byLeague=groupBy(filtered,'league');
  var top=[];var keys=Object.keys(byLeague);
  for(var i=0;i<keys.length;i++) top.push({label:keys[i],count:byLeague[keys[i]].length});
  top.sort(function(a,b){return b.count-a.count;});top=top.slice(0,10);
  renderBarChart('chart-by-country',top.map(function(l){return shortLabel(l.label,18);}),top.map(function(l){return l.count;}),'Jumlah Match',PALETTE[4],true);
}
function renderMatchTopTeams(){
  var wins={};
  for(var i=0;i<filtered.length;i++){
    var r=filtered[i];
    if(r.result==='home') wins[r.home_team]=(wins[r.home_team]||0)+1;
    if(r.result==='away') wins[r.away_team]=(wins[r.away_team]||0)+1;
  }
  var top=Object.entries(wins).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  renderBarChart('chart-distribution',top.map(function(t){return shortLabel(t[0],16);}),top.map(function(t){return t[1];}),'Total Kemenangan',PALETTE[1]);
}
function renderRankHighest_Match(){
  document.getElementById('rank-highest').innerHTML='<p class="text-sm text-center py-4" style="color:var(--text-muted)">Tersedia di mode Elo</p>';
}
function renderRankCountries_Match(){
  var byLeague=groupBy(filtered,'league');
  var top=[];var keys=Object.keys(byLeague);
  for(var i=0;i<keys.length;i++) top.push({country:keys[i],count:byLeague[keys[i]].length});
  top.sort(function(a,b){return b.count-a.count;}).slice(0,10);
  if(!top.length){document.getElementById('rank-countries').innerHTML='<p>Tidak ada data</p>';return;}
  var maxC=top[0].count, html='';
  for(var j=0;j<top.length;j++){
    var pct=(top[j].count/maxC*100).toFixed(1);
    html+='<div class="rank-item"><span class="rank-num">'+(j+1)+'</span><div style="flex:1"><div class="flex items-center justify-between"><span class="rank-name">'+esc(top[j].country)+'</span><span class="rank-val">'+top[j].count+' match</span></div><div class="progress-bar mt-1.5"><div class="progress-fill" style="width:'+pct+'%;background:'+PALETTE[j%PALETTE.length]+'"></div></div></div></div>';
  }
  document.getElementById('rank-countries').innerHTML=html;
}

// ════════════════════════════════════════════════════════════
//  ELO TIMELINE
// ════════════════════════════════════════════════════════════
function showClubSuggestions(query) {
  var box   = document.getElementById('club-suggestions');
  var input = document.getElementById('club-search');
  var q     = query.trim().toLowerCase();
  if (!q) { box.classList.add('hidden'); return; }

  var matches = [];
  for (var i = 0; i < clubNames.length; i++) {
    if (clubNames[i].toLowerCase().indexOf(q) >= 0 && selectedClubs.indexOf(clubNames[i]) < 0) {
      matches.push(clubNames[i]);
      if (matches.length >= 10) break;
    }
  }

  if (!matches.length) { box.classList.add('hidden'); return; }

  var html = '';
  for (var j = 0; j < matches.length; j++) {
    html += '<div class="px-3 py-2 text-sm hover:bg-[var(--bg-card)] cursor-pointer transition-colors" style="color:var(--text-secondary)" onclick="addClubToTimeline(\'' + escAttr(matches[j]) + '\')">' + esc(matches[j]) + '</div>';
  }
  box.innerHTML = html;

  var rect = input.getBoundingClientRect();
  box.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  box.style.left = rect.left + 'px';
  box.classList.remove('hidden');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('#club-search') && !e.target.closest('#club-suggestions')) {
    document.getElementById('club-suggestions').classList.add('hidden');
  }
});

function addClubToTimeline(club) {
  if (selectedClubs.indexOf(club) >= 0) return;
  if (selectedClubs.length >= 8) { showToast('⚠️ Maksimal 8 klub', 'error'); return; }
  selectedClubs.push(club);
  document.getElementById('club-search').value = '';
  document.getElementById('club-suggestions').classList.add('hidden');
  renderSelectedPills();
  renderTimeline();
}

function removeClubFromTimeline(club) {
  selectedClubs = selectedClubs.filter(function(c){ return c !== club; });
  renderSelectedPills();
  if (selectedClubs.length > 0) renderTimeline(); else renderTimelineEmpty();
}

function clearSelectedClubs() {
  selectedClubs = [];
  renderSelectedPills();
  renderTimelineEmpty();
}

function renderSelectedPills() {
  var container = document.getElementById('selected-clubs-pills');
  var html = '';
  for (var i = 0; i < selectedClubs.length; i++) {
    var c = selectedClubs[i];
    var color = PALETTE[i % PALETTE.length];
    html += '<span class="pill active" style="border-color:' + color + ';background:' + color + '22;color:' + color + '">' +
      esc(c) +
      ' <span onclick="removeClubFromTimeline(\'' + escAttr(c) + '\')" style="cursor:pointer;margin-left:.3rem;opacity:.7">×</span>' +
      '</span>';
  }
  container.innerHTML = html;
}

function renderTimeline() {
  // Kumpulkan data bulan per klub dari raw (tidak terpengaruh filter)
  var byClub = {};
  for (var i = 0; i < selectedClubs.length; i++) byClub[selectedClubs[i]] = {};

  for (var j = 0; j < raw.length; j++) {
    var r = raw[j];
    if (byClub[r.club] !== undefined && r.date && r.date.length >= 7) {
      var ym = r.date.substring(0, 7);
      if (byClub[r.club][ym] === undefined || r.elo > byClub[r.club][ym]) {
        byClub[r.club][ym] = r.elo;
      }
    }
  }

  // Kumpulkan label bulan unik
  var monthSet = {};
  for (var k = 0; k < selectedClubs.length; k++) {
    var months = Object.keys(byClub[selectedClubs[k]]);
    for (var m = 0; m < months.length; m++) monthSet[months[m]] = 1;
  }
  var labels = Object.keys(monthSet).sort();

  var datasets = [];
  for (var n = 0; n < selectedClubs.length; n++) {
    var club = selectedClubs[n];
    var color = PALETTE[n % PALETTE.length];
    var data = labels.map(function(l){ return byClub[club][l] !== undefined ? byClub[club][l] : null; });
    datasets.push({
      label: club, data: data,
      borderColor: color, backgroundColor: color + '15',
      fill: false, tension: 0.4,
      pointRadius: 0, pointHoverRadius: 4,
      borderWidth: 2, spanGaps: true
    });
  }

  destroyChart('chart-timeline');
  var ctx = document.getElementById('chart-timeline').getContext('2d');
  var opts = baseChartOptions();
  opts.plugins.legend = { display: true, labels: { color: '#7d8fa8', font: { family:'DM Sans', size:11 }, boxWidth:12, padding:16 } };
  charts['chart-timeline'] = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: opts
  });
}

function renderTimelineEmpty() {
  destroyChart('chart-timeline');
  // Tampilkan placeholder teks di dalam kanvas
  var canvas = document.getElementById('chart-timeline');
  // Tunggu sebentar agar kanvas punya dimensi
  setTimeout(function(){
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3d4f66';
    ctx.font      = '14px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Cari dan tambahkan klub di atas untuk melihat timeline Elo', canvas.width/2, canvas.height/2);
  }, 80);
}

// ════════════════════════════════════════════════════════════
//  CHART HELPERS
// ════════════════════════════════════════════════════════════
function renderBarChart(id, labels, values, label, color, horizontal) {
  destroyChart(id);
  var ctx = document.getElementById(id).getContext('2d');
  var opts = baseChartOptions();
  if (horizontal) opts.indexAxis = 'y';
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: label, data: values,
        backgroundColor: color + 'bb', borderColor: color,
        borderWidth: 1, borderRadius: 6, borderSkipped: false }]
    },
    options: opts
  });
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      title:  { display: false },
      tooltip: {
        backgroundColor: '#161c28', borderColor: '#1e2738', borderWidth: 1,
        titleColor: '#e8edf5', bodyColor: '#7d8fa8',
        padding: 10, cornerRadius: 8,
        titleFont: { family:'DM Sans', size:12 },
        bodyFont:  { family:'DM Mono', size:11 }
      }
    },
    scales: {
      x: { ticks: { color:'#7d8fa8', font:{ family:'DM Mono', size:10 }, maxRotation:30 }, grid:{ color:'#1e2738' }, border:{ color:'#1e2738' } },
      y: { ticks: { color:'#7d8fa8', font:{ family:'DM Mono', size:10 } }, grid:{ color:'#1e2738' }, border:{ color:'#1e2738' } }
    }
  };
}

// ════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════
function groupBy(arr, key) {
  var acc = {};
  for (var i = 0; i < arr.length; i++) {
    var k = arr[i][key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(arr[i]);
  }
  return acc;
}

function avgField(arr, key) {
  if (!arr.length) return 0;
  var sum = 0;
  for (var i = 0; i < arr.length; i++) sum += parseFloat(arr[i][key]) || 0;
  return sum / arr.length;
}

function shortLabel(str, maxLen) {
  if (!str) return '—';
  str = String(str);
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

function fillSelect(id, values, placeholder) {
  var sel = document.getElementById(id);
  var html = '<option value="">' + placeholder + '</option>';
  for (var i = 0; i < values.length; i++) {
    html += '<option value="' + esc(values[i]) + '">' + esc(values[i]) + '</option>';
  }
  sel.innerHTML = html;
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function animateNum(id, target) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = parseInt(el.textContent.replace(/\D/g,'')) || 0;
  var t0 = performance.now();
  (function tick(now) {
    var t    = Math.min((now - t0) / 600, 1);
    var ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(start + (target - start) * ease).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
  })(t0);
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

// ── Toast ─────────────────────────────────────────────────
var toastTimer;
function showToast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'show ' + (type || 'success');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 3500);
}