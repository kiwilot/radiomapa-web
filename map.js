// radiomapa.pl — mapa przemienników na żywo (MapLibre GL JS).
// Ten sam styl mapy i te same dane co aplikacja Android.

const MAP_STYLE_URL = 'https://radiomapa-proxy.skubany.workers.dev/style.json';
const REPEATERS_URL = 'https://storage.googleapis.com/radiomapa-287b4.firebasestorage.app/public/repeaters.json';

// 1:1 z lib/screens/map/map_colors.dart — kolor wg trybu pracy
function modeColor(mode) {
  if (mode.includes('DMR'))       return '#a78bfa';
  if (mode.includes('DSTAR'))     return '#fb923c';
  if (mode.includes('C4FM'))      return '#22d3ee';
  if (mode.includes('Echolink'))  return '#f2a93c';
  if (mode.includes('FM-Link'))   return '#f472b6';
  if (mode.includes('FM-Poland')) return '#f472b6';
  if (mode.includes('APCO-25'))   return '#ef4444';
  if (mode.includes('TETRA'))     return '#c2884b';
  if (mode.includes('ATV'))       return '#38bdf8';
  return '#22c55e';
}
// 1:1 z repeaterColor() — status ma pierwszeństwo przed trybem
function repeaterColor(r) {
  if (r.status === 'wyłączony') return '#6b7684';
  if (r.status === 'testowy')   return '#f2a93c';
  if (!r.modes || r.modes.length === 0) return '#22c55e';
  return modeColor(r.modes[0]);
}

function offsetMhz(tx, rx) { return (Math.round((rx - tx) * 10000) / 10000).toString(); }

const mapLive = document.getElementById('mapLive');

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE_URL,
  center: [19.5, 52.0], // lib/screens/map/map_gl.dart: polandCenter
  zoom: 5.4,
  attributionControl: true,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

map.on('load', async () => {
  let repeaters = [];
  try {
    const res = await fetch(REPEATERS_URL);
    if (!res.ok) throw new Error(res.status);
    repeaters = await res.json();
  } catch (err) {
    mapLive.textContent = 'nie udało się wczytać danych';
    console.error('RadioMapa: błąd pobierania repeaters.json', err);
    return;
  }

  const withCoords = repeaters.filter(r => typeof r.lat === 'number' && typeof r.lng === 'number');

  const geojson = {
    type: 'FeatureCollection',
    features: withCoords.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        callsign: r.callsign,
        location: r.location || '',
        locator: r.locator || '',
        status: r.status || '',
        txMhz: r.txMhz,
        rxMhz: r.rxMhz,
        modes: (r.modes || []).join(', '),
        ctcss: r.ctcss ?? null,
        colorCode: r.colorCode ?? null,
        color: repeaterColor(r),
      },
    })),
  };

  map.addSource('repeaters', {
    type: 'geojson',
    data: geojson,
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
      'circle-color': '#16a34a',
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0a0d0f',
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
    paint: { 'text-color': '#0a0d0f' },
  });

  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'repeaters',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0a0d0f',
    },
  });

  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    const clusterId = features[0].properties.cluster_id;
    map.getSource('repeaters').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });

  map.on('click', 'unclustered-point', (e) => {
    const p = e.features[0].properties;
    const offset = offsetMhz(p.txMhz, p.rxMhz);
    const gmaps = `https://www.google.com/maps?q=${e.features[0].geometry.coordinates[1]},${e.features[0].geometry.coordinates[0]}`;
    const html = `
      <div class="rm-pop">
        <div class="rm-pop-head">
          <div class="rm-pop-call">${p.callsign}</div>
          <div class="rm-pop-loc">${p.location}${p.locator ? ' · ' + p.locator : ''}</div>
          <div class="rm-pop-badges">
            <span class="rm-pop-pill" style="color:${p.color};background:${p.color}22">${p.status}</span>
            ${p.modes ? `<span class="rm-pop-pill" style="color:var(--text-sub);background:var(--bg3)">${p.modes}</span>` : ''}
          </div>
        </div>
        <div class="rm-pop-body">
          <div class="rm-pop-row"><span class="k">TX</span><span class="v">${Number(p.txMhz).toFixed(4)} MHz</span></div>
          <div class="rm-pop-row"><span class="k">RX</span><span class="v">${Number(p.rxMhz).toFixed(4)} MHz</span></div>
          <div class="rm-pop-row"><span class="k">Offset</span><span class="v">${offset} MHz</span></div>
          ${p.ctcss ? `<div class="rm-pop-row"><span class="k">CTCSS</span><span class="v">${p.ctcss} Hz</span></div>` : ''}
          ${p.colorCode !== null ? `<div class="rm-pop-row"><span class="k">Color Code</span><span class="v">${p.colorCode}</span></div>` : ''}
          <a class="rm-pop-link" href="${gmaps}" target="_blank" rel="noopener">Otwórz w Google Maps</a>
        </div>
      </div>`;
    new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(html)
      .addTo(map);
  });

  map.on('mouseenter', 'unclustered-point', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'unclustered-point', () => map.getCanvas().style.cursor = '');
  map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

  mapLive.innerHTML = `<span>${withCoords.length.toLocaleString('pl-PL')}</span> przemienników na mapie`;
});
