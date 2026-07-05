// radiomapa.pl/mapa.html — pełnoekranowa mapa + lista przemienników.
// Te same dane i ten sam styl mapy co aplikacja Android.

const MAP_STYLE_URL = 'https://radiomapa-proxy.skubany.workers.dev/style.json';
const REPEATERS_URL = 'https://storage.googleapis.com/radiomapa-287b4.firebasestorage.app/public/repeaters.json';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=pl.radiomapa.app';

// ── Kolory — 1:1 z lib/screens/map/map_colors.dart i lib/theme/app_theme.dart ──

function modeColor(mode) {
  if (mode.includes('DMR'))       return { fg: '#7c3aed', bg: '#ede9fe' };
  if (mode.includes('DSTAR'))     return { fg: '#ea580c', bg: '#ffedd5' };
  if (mode.includes('C4FM'))      return { fg: '#0891b2', bg: '#cffafe' };
  if (mode.includes('Echolink'))  return { fg: '#d97706', bg: '#fef3c7' };
  if (mode.includes('FM-Link'))   return { fg: '#db2777', bg: '#fce7f3' };
  if (mode.includes('FM-Poland')) return { fg: '#be185d', bg: '#fce7f3' };
  if (mode.includes('APCO-25'))   return { fg: '#dc2626', bg: '#fee2e2' };
  if (mode.includes('TETRA'))     return { fg: '#92400e', bg: '#fef3c7' };
  if (mode.includes('ATV'))       return { fg: '#0284c7', bg: '#cffafe' };
  return { fg: '#16a34a', bg: '#dcfce7' };
}

function repeaterColor(r) {
  if (r.status === 'wyłączony') return '#9ca3af';
  if (r.status === 'testowy')   return '#d97706';
  if (!r.modes || r.modes.length === 0) return '#16a34a';
  return modeColor(r.modes[0]).fg;
}

function statusPill(status) {
  if (status === 'działający') return { fg: '#16a34a', bg: '#dcfce7' };
  if (status === 'testowy')    return { fg: '#d97706', bg: '#fef3c7' };
  return { fg: '#9ca3af', bg: '#f1f0eb' };
}

// 1:1 z RepeaterBand.fromFreq() w lib/models/repeater.dart
function bandFromFreq(txMhz) {
  if (txMhz >= 28   && txMhz <= 30)   return '10m';
  if (txMhz >= 50   && txMhz <= 54)   return '6m';
  if (txMhz >= 144  && txMhz <= 146)  return '2m';
  if (txMhz >= 430  && txMhz <= 440)  return '70cm';
  if (txMhz >= 1240 && txMhz <= 1300) return '23cm';
  return '?';
}

function freqDisplay(mhz) {
  return Number.isInteger(mhz) ? String(mhz) : mhz.toFixed(3);
}

function offsetMhz(tx, rx) { return (Math.round((rx - tx) * 10000) / 10000).toString(); }

// ── Ikony pinów — kształt "łezki" rysowany na canvasie, jeden na kolor ─────────

const PIN_COLORS = ['#16a34a', '#9ca3af', '#d97706', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#be185d', '#dc2626', '#92400e', '#0284c7'];
const pinIconId = (hex) => 'pin-' + hex.replace('#', '');

// Ikona anteny/sygnału (viewBox 24x24), podana przez użytkownika.
const ANTENNA_PATH_1 = "M12 8c-1.1 0-2 .9-2 2c0 .85.53 1.57 1.28 1.86l-.53 10.13h2.5l-.53-10.13C13.47 11.57 14 10.85 14 10c0-1.1-.9-2-2-2m-2.83-.83L7.76 5.75A5.97 5.97 0 0 0 6 9.99c0 1.6.62 3.11 1.76 4.25l1.41-1.41A3.96 3.96 0 0 1 8 10c0-1.07.42-2.07 1.17-2.82Zm7.07-1.41l-1.41 1.41C15.59 7.93 16 8.93 16 10s-.42 2.07-1.17 2.83l1.41 1.41C17.37 13.11 18 11.6 18 10s-.62-3.11-1.76-4.24";
const ANTENNA_PATH_2 = "M6.34 4.34L4.93 2.92C3.04 4.81 2 7.32 2 9.99s1.04 5.18 2.93 7.07l1.41-1.41c-1.51-1.51-2.35-3.52-2.35-5.66s.83-4.15 2.34-5.65Zm11.32 0c3.12 3.12 3.12 8.2 0 11.31l1.41 1.41c3.9-3.9 3.9-10.24 0-14.14l-1.41 1.41Z";

function buildPinImage(color) {
  const scale = 3; // supersampling pod ekrany HiDPI
  const w = 26, h = 34;
  const r = 9;
  const cx = w / 2, cy = r + 3;
  const tipY = cy + r * 1.7; // krótszy, tępszy "ogon" niż klasyczna łezka — balonik

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Cień pod baloniku
  ctx.beginPath();
  ctx.ellipse(cx, tipY + 2, 4, 1.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fill();

  // Ciało pina — zaokrąglony balonik
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.quadraticCurveTo(cx + r, cy + r * 1.05, cx, tipY);
  ctx.quadraticCurveTo(cx - r, cy + r * 1.05, cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Ikona anteny/sygnału zamiast kropki (viewBox 24x24, wyśrodkowana w głowicy)
  ctx.save();
  ctx.translate(cx, cy + 1);
  ctx.scale(0.62, 0.62);
  ctx.translate(-12, -11);
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(ANTENNA_PATH_1));
  ctx.fill(new Path2D(ANTENNA_PATH_2));
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(imgData.data.buffer),
    pixelRatio: scale,
  };
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// ── Stan ──────────────────────────────────────────────────────────────────────

let ALL = [];
let byId = new Map();
let activeBand = 'all';
let activeStatus = 'all';
let query = '';
let selectedId = null;

const list = document.getElementById('list');
const resultCount = document.getElementById('resultCount');
const detailPanel = document.getElementById('detailPanel');

// ── Mapa ──────────────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE_URL,
  center: [19.5, 52.0], // lib/screens/map/map_gl.dart: polandCenter
  zoom: 5.4,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

function filtered() {
  return ALL.filter(r =>
    (activeBand === 'all' || r.band === activeBand) &&
    (activeStatus === 'all' || r.status === activeStatus) &&
    (query === '' || (r.callsign + ' ' + r.location).toLowerCase().includes(query))
  );
}

function toGeoJSON(items) {
  return {
    type: 'FeatureCollection',
    features: items.map(r => ({
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { id: r.id, color: repeaterColor(r), icon: pinIconId(repeaterColor(r)) },
    })),
  };
}

function updateMapSource() {
  const src = map.getSource('repeaters');
  if (src) src.setData(toGeoJSON(filtered().filter(r => r.hasCoords)));
}

function renderList() {
  const items = filtered();
  resultCount.textContent = items.length.toLocaleString('pl-PL') +
    (items.length === 1 ? ' przemiennik' : ' przemienników');

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Brak wyników dla wybranych filtrów.</div>';
    return;
  }

  list.innerHTML = items.map(r => {
    const pill = statusPill(r.status);
    const modes = (r.modes || []).map(m => {
      const c = modeColor(m);
      return `<span class="mode-badge" style="color:${c.fg};background:${c.bg}">${m}</span>`;
    }).join('');
    return `
      <div class="rcard${r.id === selectedId ? ' active' : ''}" data-id="${r.id}">
        <div class="rcard-top">
          <span class="callsign mono">${r.callsign}</span>
          <span class="pill" style="color:${pill.fg};background:${pill.bg}">${r.status}</span>
        </div>
        <div class="loc">${r.location}${r.band !== '?' ? ' · ' + r.band : ''}</div>
        <div class="rcard-meta">
          <span class="freq mono">${freqDisplay(r.txMhz)}<span class="rx"> ↓${freqDisplay(r.rxMhz)}</span></span>
          <span class="modes">${modes}</span>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.rcard').forEach(el => {
    el.addEventListener('click', () => selectRepeater(el.dataset.id, { fly: true }));
  });
}

function render() {
  renderList();
  updateMapSource();
}

// ── Panel szczegółów (pola 1:1 z lib/screens/detail/detail_screen.dart) ───────

function renderDetail(r) {
  const pill = statusPill(r.status);
  const modes = (r.modes || []).map(m => {
    const c = modeColor(m);
    return `<span class="mode-badge" style="color:${c.fg};background:${c.bg}">${m}</span>`;
  }).join('');
  const expired = r.licenseExpiry && new Date(r.licenseExpiry) < new Date();
  const gmaps = r.hasCoords ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : null;

  detailPanel.innerHTML = `
    <div class="detail-scroll">
      <div class="detail-head">
        <div class="detail-head-top">
          <span class="detail-callsign mono">${r.callsign}</span>
          <button class="detail-close" id="detailClose" aria-label="Zamknij">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
        <div class="detail-loc">${r.location}${r.locator ? ' · ' + r.locator : ''}</div>
        <div class="detail-badges">
          <span class="pill" style="color:${pill.fg};background:${pill.bg}">${r.status}</span>
          ${r.band !== '?' ? `<span class="pill" style="color:var(--text-2);background:var(--gray-bg)">${r.band}</span>` : ''}
          ${modes}
        </div>
      </div>

      <div class="detail-actions">
        ${gmaps ? `
        <a class="detail-btn" target="_blank" rel="noopener" href="${gmaps}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-5-2V6l5 2 6-2 5 2v14l-5-2-6 2z"/><path d="M9 8v14M15 6v14"/></svg>
          Google Maps
        </a>` : ''}
        <a class="detail-btn primary" target="_blank" rel="noopener" href="${PLAY_STORE_URL}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76c.3.17.64.22.97.15l13.2-7.62-2.83-2.83-11.34 10.3zm-1.9-20.7C1.1 3.33 1 3.67 1 4.04v15.92c0 .37.1.71.28 1l11.05-11.05L1.28 3.06zM20.55 9.77l-2.8-1.62-3.14 3.14 3.14 3.14 2.83-1.63c.8-.46.8-1.57-.03-2.03zM4.15.09L17.35 7.7l-2.83 2.83L3.18.23C3.5.16 3.85.21 4.15.38z"/></svg>
          Pobierz aplikację
        </a>
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Częstotliwości</p>
        <div class="detail-row"><span class="k">TX (nadajnik)</span><span class="v accent mono">${freqDisplay(r.txMhz)} MHz</span></div>
        <div class="detail-row"><span class="k">RX (odbiornik)</span><span class="v accent mono">${freqDisplay(r.rxMhz)} MHz</span></div>
        <div class="detail-row"><span class="k">Offset</span><span class="v mono">${offsetMhz(r.txMhz, r.rxMhz)} MHz</span></div>
        ${r.ctcss != null ? `<div class="detail-row"><span class="k">CTCSS</span><span class="v mono">${r.ctcss} Hz</span></div>` : ''}
        ${r.colorCode != null ? `<div class="detail-row"><span class="k">Color Code</span><span class="v mono">${r.colorCode}</span></div>` : ''}
        ${r.activation ? `<div class="detail-row"><span class="k">Aktywowanie</span><span class="v">${r.activation}</span></div>` : ''}
        ${r.echolinkNode != null ? `<div class="detail-row"><span class="k">EchoLink node</span><span class="v mono">${r.echolinkNode}</span></div>` : ''}
      </div>

      <div class="detail-section">
        <p class="detail-section-title">Lokalizacja</p>
        ${r.locator ? `<div class="detail-row"><span class="k">Lokator QTH</span><span class="v mono">${r.locator}</span></div>` : ''}
        ${r.hasCoords ? `
        <div class="detail-row"><span class="k">Szerokość</span><span class="v mono">${r.lat.toFixed(4)}°N</span></div>
        <div class="detail-row"><span class="k">Długość</span><span class="v mono">${r.lng.toFixed(4)}°E</span></div>` : ''}
        ${r.altAsl != null ? `<div class="detail-row"><span class="k">Wysokość n.p.m.</span><span class="v">${Math.round(r.altAsl)} m</span></div>` : ''}
        ${r.altAgl != null ? `<div class="detail-row"><span class="k">Wysokość n.p.g.</span><span class="v">${Math.round(r.altAgl)} m</span></div>` : ''}
      </div>

      ${r.licenseExpiry ? `
      <div class="detail-section">
        <p class="detail-section-title">Pozwolenie</p>
        <div class="detail-row"><span class="k">Ważne do</span><span class="v${expired ? ' warn' : ''}">${formatDate(r.licenseExpiry)}</span></div>
      </div>` : ''}

      ${r.owner ? `
      <div class="detail-section">
        <p class="detail-section-title">Opiekun</p>
        <div class="detail-row"><span class="k">Znak</span><span class="v mono">${r.owner}</span></div>
      </div>` : ''}

      ${r.additionalInfo ? `
      <div class="detail-section">
        <p class="detail-section-title">Dodatkowe informacje</p>
        <p class="detail-note">${r.additionalInfo}</p>
      </div>` : ''}
    </div>`;

  detailPanel.classList.add('open');
  document.getElementById('detailClose').addEventListener('click', closeDetail);
}

function setMapSelection(id) {
  // `feature-state` nie działa we właściwościach layout (icon-size/icon-image),
  // więc podświetlenie robimy przez osobne, statycznie stylowane źródło z co
  // najwyżej jedną cechą (zaznaczonym punktem), zamiast per-cecha stanu.
  const src = map.getSource('selected-point');
  if (!src) return;
  const r = id != null ? byId.get(id) : null;
  src.setData(r && r.hasCoords
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: {} }] }
    : { type: 'FeatureCollection', features: [] });
}

function closeDetail() {
  detailPanel.classList.remove('open');
  setMapSelection(null);
  selectedId = null;
  document.querySelectorAll('.rcard.active').forEach(el => el.classList.remove('active'));
}

function selectRepeater(id, { fly = false } = {}) {
  const r = byId.get(id);
  if (!r) return;
  setMapSelection(id);
  selectedId = id;
  document.querySelectorAll('.rcard').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  renderDetail(r);
  if (fly && r.hasCoords) {
    map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), 13), speed: 0.9, curve: 1.3, essential: true });
  }
}

// ── Ładowanie danych ────────────────────────────────────────────────────────

async function loadRepeaters() {
  const res = await fetch(REPEATERS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const raw = await res.json();

  ALL = raw.map(m => ({
    id: m.id,
    callsign: m.callsign,
    location: m.location || '',
    status: m.status || 'nieznany',
    modes: m.modes || [],
    txMhz: m.txMhz,
    rxMhz: m.rxMhz,
    band: bandFromFreq(m.txMhz),
    activation: m.activation || '',
    ctcss: m.ctcss ?? null,
    colorCode: m.colorCode ?? null,
    echolinkNode: m.echolinkNode ?? null,
    locator: m.locator ?? null,
    lat: m.lat ?? null,
    lng: m.lng ?? null,
    hasCoords: typeof m.lat === 'number' && typeof m.lng === 'number',
    altAsl: m.altAsl ?? null,
    altAgl: m.altAgl ?? null,
    licenseExpiry: m.licenseExpiry ?? null,
    owner: m.owner ?? null,
    additionalInfo: m.additionalInfo ?? null,
  }));

  byId = new Map(ALL.map(r => [r.id, r]));
}

// ── Start ─────────────────────────────────────────────────────────────────────

Promise.all([
  loadRepeaters(),
  new Promise(resolve => map.on('load', resolve)),
]).then(() => {
  for (const color of PIN_COLORS) {
    try {
      const img = buildPinImage(color);
      const id = pinIconId(color);
      if (!map.hasImage(id)) {
        map.addImage(id, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.pixelRatio });
      }
    } catch (err) {
      console.error('RadioMapa: nie udało się dodać ikony pina', color, err);
    }
  }

  map.addSource('repeaters', {
    type: 'geojson',
    data: toGeoJSON(ALL.filter(r => r.hasCoords)),
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 12,
  });

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'repeaters',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#2563eb',
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
    },
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'repeaters',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      // Musi istnieć w glyphs aktywnego stylu — patrz kClusterFont w map_gl.dart.
      'text-font': ['Noto-Regular'],
      'text-size': 12,
    },
    paint: { 'text-color': '#ffffff' },
  });

  // Siatka bezpieczeństwa: mała kropka pod ikoną, żeby punkt nigdy nie był
  // całkiem niewidoczny, nawet gdyby ikona (addImage) z jakiegoś powodu zawiodła.
  map.addLayer({
    id: 'unclustered-point-fallback',
    type: 'circle',
    source: 'repeaters',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': 5,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  });

  // Podświetlenie zaznaczonego przemiennika — osobne źródło z co najwyżej jedną
  // cechą, aktualizowane w setMapSelection(). Rysowane pod ikoną pina.
  map.addSource('selected-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'selected-point-ring',
    type: 'circle',
    source: 'selected-point',
    paint: {
      'circle-radius': 18,
      'circle-color': 'rgba(37, 99, 235, 0.18)',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#2563eb',
    },
  });

  map.addLayer({
    id: 'unclustered-point',
    type: 'symbol',
    source: 'repeaters',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 1.25,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!features.length) return;
    // flyTo zamiast easeTo — daje ładniejszy, "wciągający" ruch przy rozbijaniu klastra
    // zamiast prostego, płaskiego przybliżenia. Prosty, zawsze działający fallback
    // zamiast getClusterExpansionZoom, który czasem cicho zawodził (błąd połykany
    // przez `if (err) return`).
    map.flyTo({
      center: features[0].geometry.coordinates,
      zoom: map.getZoom() + 2,
      speed: 0.9,
      curve: 1.3,
      essential: true,
    });
  });

  // Podpięte pod OBIE warstwy (ikona + fallback) — działa niezależnie od tego,
  // czy ikona się wczytała, czy widoczna jest tylko kropka zapasowa.
  for (const layerId of ['unclustered-point', 'unclustered-point-fallback']) {
    map.on('click', layerId, (e) => {
      selectRepeater(e.features[0].properties.id, { fly: false });
    });
    map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
  }
  map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

  render();
}).catch(err => {
  console.error('RadioMapa: błąd wczytywania danych', err);
  resultCount.textContent = 'Nie udało się wczytać danych';
});

document.getElementById('bandRow').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeBand = chip.dataset.band;
  document.querySelectorAll('#bandRow .chip').forEach(c => c.classList.toggle('active', c === chip));
  render();
});

document.getElementById('statusRow').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeStatus = chip.dataset.status;
  document.querySelectorAll('#statusRow .chip').forEach(c => c.classList.toggle('active', c === chip));
  render();
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  query = e.target.value.trim().toLowerCase();
  render();
});
