const MEZCLAS = ["NINGUNA", "PAMECH (M. CHINA)", "PAMECHAE (M. CHINA ACIDO ESTEARICO)", "PAMESU (M. SURESTE)", "PAMEAR (M. AROMATIUM)", "PAMEAG (M. ACIDO GRASO)"];
const CARTUCHOS = ["NINGUNA", "MOLDEADO", "PRENSADO", "LLENADO", "BATIDO", "PRUEBA", "PENDIENTE"];

function fillSelect(sel, options, def) {
  sel.innerHTML = options.map(o => `<option value="${o}"${o===def?' selected':''}>${o}</option>`).join('');
}
fillSelect(document.getElementById('mezcla1'), MEZCLAS, "PAMECH (M. CHINA)");
fillSelect(document.getElementById('cartucho1'), CARTUCHOS, "MOLDEADO");
fillSelect(document.getElementById('mezcla2'), MEZCLAS, "NINGUNA");
fillSelect(document.getElementById('cartucho2'), CARTUCHOS, "NINGUNA");
document.getElementById('fecha').valueAsDate = new Date();

// Auto-uppercase free-text fields as the user types
['veladora', 'observaciones'].forEach(id => {
  const field = document.getElementById(id);
  field.addEventListener('input', () => {
    const { selectionStart, selectionEnd } = field;
    field.value = field.value.toUpperCase();
    field.setSelectionRange(selectionStart, selectionEnd);
  });
});

// Tab navigation
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('screen-' + btn.dataset.screen).classList.add('active');
  });
});

// --- Toast / confirm (native alert/confirm are blocked inside the Artifact sandbox) ---
let toastTimer = null;
function toast(message, type) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast show' + (type === 'error' ? ' error' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, reducedMotion() ? 0 : 220);
  }, 3200);
}

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function openModal(overlay) {
  overlay.hidden = false;
  overlay.classList.remove('show');
  void overlay.offsetWidth; // force a reflow so the transition has a start state
  requestAnimationFrame(() => overlay.classList.add('show'));
}

function closeModal(overlay) {
  overlay.classList.remove('show');
  setTimeout(() => { overlay.hidden = true; }, reducedMotion() ? 0 : 220);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModal');
    document.getElementById('confirmText').textContent = message;
    openModal(overlay);
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    function cleanup(result) {
      closeModal(overlay);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}

let db = null, downloads = null, userCap = null, myId = null;
let entries = [];
let loaded = false;
let editingId = null;
let profileCache = {};

function num(id) { return parseFloat(document.getElementById(id).value) || 0; }
function fmt(n) { return (n || 0).toFixed(3); }

function pulseReadout(el, text) {
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('pulse');
  void el.offsetWidth; // restart the animation even if it's already mid-run
  el.classList.add('pulse');
}

function computePromedios() {
  const piezas1 = num('piezas1');
  const piezas2 = num('piezas2');
  const vaso = num('vasoPeso');
  const pesoTotal1 = num('pesoTotal1');
  const pesoTotal2 = num('pesoTotal2');
  const mezcla2 = document.getElementById('mezcla2').value;
  const cartucho2 = document.getElementById('cartucho2').value;

  const pesoProm1 = piezas1 > 0 ? pesoTotal1 / piezas1 : 0;
  let pesoProm2 = 0;
  if (!(mezcla2 === "NINGUNA" && cartucho2 === "NINGUNA")) {
    pesoProm2 = piezas2 > 0 ? (pesoTotal2 / piezas2) - pesoProm1 - vaso : 0;
  }

  const out1 = document.getElementById('pesoProm1Out');
  const out2 = document.getElementById('pesoProm2Out');
  pulseReadout(out1, fmt(pesoProm1));
  out1.classList.toggle('neg', pesoProm1 < 0);
  pulseReadout(out2, fmt(pesoProm2));
  out2.classList.toggle('neg', pesoProm2 < 0);

  return { pesoProm1, pesoProm2 };
}
['piezas1','piezas2','vasoPeso','pesoTotal1','pesoTotal2','mezcla2','cartucho2'].forEach(id => {
  document.getElementById(id).addEventListener('input', computePromedios);
  document.getElementById(id).addEventListener('change', computePromedios);
});
computePromedios();

function resetForm() {
  document.getElementById('entryForm').reset();
  document.getElementById('fecha').valueAsDate = new Date();
  fillSelect(document.getElementById('mezcla1'), MEZCLAS, "PAMECH (M. CHINA)");
  fillSelect(document.getElementById('cartucho1'), CARTUCHOS, "MOLDEADO");
  fillSelect(document.getElementById('mezcla2'), MEZCLAS, "NINGUNA");
  fillSelect(document.getElementById('cartucho2'), CARTUCHOS, "NINGUNA");
  document.getElementById('piezas1').value = 20;
  document.getElementById('piezas2').value = 20;
  document.getElementById('vasoPeso').value = 0;
  document.getElementById('pesoTotal1').value = 0;
  document.getElementById('pesoTotal2').value = 0;
  editingId = null;
  document.getElementById('formTitleText').textContent = 'Nueva captura';
  document.getElementById('cancelEdit').hidden = true;
  document.getElementById('submitBtn').textContent = 'Guardar captura';
  computePromedios();
}
document.getElementById('cancelEdit').addEventListener('click', resetForm);

document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) { toast('Sin conexión al almacenamiento compartido.', 'error'); return; }
  const { pesoProm1, pesoProm2 } = computePromedios();
  const data = {
    fecha: document.getElementById('fecha').value,
    veladora: document.getElementById('veladora').value.trim().toUpperCase(),
    vasoPeso: num('vasoPeso'),
    mezcla1: document.getElementById('mezcla1').value,
    cartucho1: document.getElementById('cartucho1').value,
    piezas1: num('piezas1'),
    pesoTotal1: num('pesoTotal1'),
    pesoProm1,
    mezcla2: document.getElementById('mezcla2').value,
    cartucho2: document.getElementById('cartucho2').value,
    piezas2: num('piezas2'),
    pesoTotal2: num('pesoTotal2'),
    pesoProm2,
    observaciones: document.getElementById('observaciones').value.trim() || 'Ninguna',
    updatedAt: new Date().toISOString(),
  };
  const wasEditing = !!editingId;
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  try {
    if (editingId) {
      await db.doc('capturas/' + editingId).update(data);
    } else {
      data.createdAt = data.updatedAt;
      data.capturadoPorId = myId || null;
      await db.collection('capturas').add(data);
    }
    resetForm();
    toast(wasEditing ? 'Captura actualizada.' : 'Captura guardada.');
    document.querySelector('.tab[data-screen="history"]').click();
  } catch (err) {
    toast('No se pudo guardar: ' + (err && err.message ? err.message : 'error desconocido'), 'error');
  } finally {
    btn.disabled = false;
  }
});

function startEdit(entry) {
  editingId = entry.id;
  document.getElementById('fecha').value = entry.fecha || '';
  document.getElementById('veladora').value = entry.veladora || '';
  document.getElementById('vasoPeso').value = entry.vasoPeso ?? 0;
  fillSelect(document.getElementById('mezcla1'), MEZCLAS, entry.mezcla1);
  fillSelect(document.getElementById('cartucho1'), CARTUCHOS, entry.cartucho1);
  document.getElementById('piezas1').value = entry.piezas1 ?? entry.piezas ?? 20;
  document.getElementById('pesoTotal1').value = entry.pesoTotal1 ?? 0;
  fillSelect(document.getElementById('mezcla2'), MEZCLAS, entry.mezcla2);
  fillSelect(document.getElementById('cartucho2'), CARTUCHOS, entry.cartucho2);
  document.getElementById('piezas2').value = entry.piezas2 ?? entry.piezas ?? 20;
  document.getElementById('pesoTotal2').value = entry.pesoTotal2 ?? 0;
  document.getElementById('observaciones').value = entry.observaciones === 'Ninguna' ? '' : (entry.observaciones || '');
  computePromedios();
  document.getElementById('formTitleText').textContent = 'Editar captura';
  document.getElementById('cancelEdit').hidden = false;
  document.getElementById('submitBtn').textContent = 'Guardar cambios';
  document.querySelector('.tab[data-screen="capture"]').click();
}

async function deleteEntry(id) {
  if (!db) { toast('Sin conexión al almacenamiento compartido.', 'error'); return; }
  const ok = await confirmDialog('¿Eliminar esta captura? Esta acción no se puede deshacer.');
  if (!ok) return;
  try {
    await db.doc('capturas/' + id).delete();
    toast('Captura eliminada.');
  } catch (err) {
    toast('No se pudo eliminar: ' + (err && err.message ? err.message : 'error desconocido'), 'error');
  }
}

let exceljsPromise = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!exceljsPromise) {
    exceljsPromise = loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js')
      .then(() => window.ExcelJS);
  }
  return exceljsPromise;
}

const INK = 'FF1B1F1A';
const HEADER_BG = 'FF14110D';
const HEADER_FG = 'FFF2A63D';
const STRIPE_BG = 'FFF3F1E9';
const LINE = 'FFD3D7C9';
const WARN = 'FFB23A3A';

function styleHeaderCell(cell) {
  cell.font = { bold: true, color: { argb: HEADER_FG }, size: 10.5 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

async function exportExcel() {
  const list = filteredEntries();
  if (!list.length) { toast('No hay capturas para exportar.', 'error'); return; }

  await resolveNames(list.map(e => e.capturadoPorId));

  let ExcelJS;
  try {
    ExcelJS = await loadExcelJS();
  } catch (err) {
    toast('No se pudo cargar el generador de Excel. Revisa tu conexión.', 'error');
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Grupo Aramo';
  wb.created = new Date();
  const ws = wb.addWorksheet('Control de pesos', { views: [{ state: 'frozen', ySplit: 4 }] });

  ws.columns = [
    { key: 'fecha', width: 12 },
    { key: 'veladora', width: 22 },
    { key: 'capturadoPor', width: 18 },
    { key: 'vaso', width: 13 },
    { key: 'mezcla1', width: 26 },
    { key: 'cartucho1', width: 14 },
    { key: 'piezas1', width: 12 },
    { key: 'pesoTotal1', width: 14 },
    { key: 'pesoProm1', width: 14 },
    { key: 'mezcla2', width: 26 },
    { key: 'cartucho2', width: 14 },
    { key: 'piezas2', width: 12 },
    { key: 'pesoTotal2', width: 14 },
    { key: 'pesoProm2', width: 14 },
    { key: 'observaciones', width: 30 },
  ];

  // Row 1: title. Row 2: export summary.
  ws.mergeCells('A1:O1');
  ws.getCell('A1').value = 'CONTROL DE PESOS — GRUPO ARAMO';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: HEADER_FG } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:O2');
  ws.getCell('A2').value = `Exportado ${new Date().toLocaleString('es-MX')} · ${list.length} captura${list.length === 1 ? '' : 's'}`;
  ws.getCell('A2').font = { italic: true, size: 9.5, color: { argb: 'FFB9884F' } };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Row 3: group headers. Row 4: column headers.
  ws.mergeCells('A3:A4'); ws.getCell('A3').value = 'FECHA';
  ws.mergeCells('B3:B4'); ws.getCell('B3').value = 'VELADORA';
  ws.mergeCells('C3:C4'); ws.getCell('C3').value = 'CAPTURADO POR';
  ws.mergeCells('D3:D4'); ws.getCell('D3').value = 'VASO PESO PROM. (KG)';
  ws.mergeCells('E3:I3'); ws.getCell('E3').value = 'MEZCLA 1';
  ws.mergeCells('J3:N3'); ws.getCell('J3').value = 'MEZCLA 2';
  ws.mergeCells('O3:O4'); ws.getCell('O3').value = 'OBSERVACIONES';

  const subHeaders = ['MEZCLA', 'CARTUCHO', 'PIEZAS MUESTREADAS', 'PESO TOTAL PZ (KG)', 'PESO PROM. (KG)'];
  ['E4', 'F4', 'G4', 'H4', 'I4'].forEach((c, i) => { ws.getCell(c).value = subHeaders[i]; });
  ['J4', 'K4', 'L4', 'M4', 'N4'].forEach((c, i) => { ws.getCell(c).value = subHeaders[i]; });

  [3, 4].forEach(r => {
    ws.getRow(r).eachCell({ includeEmpty: true }, styleHeaderCell);
  });
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 30;

  list.forEach((e, idx) => {
    const row = ws.addRow({
      fecha: e.fecha || '',
      veladora: e.veladora || '',
      capturadoPor: e.capturadoPorId ? (profileCache[e.capturadoPorId] || '—') : '—',
      vaso: e.vasoPeso || 0,
      mezcla1: e.mezcla1 || '',
      cartucho1: e.cartucho1 || '',
      piezas1: e.piezas1 ?? e.piezas ?? '',
      pesoTotal1: e.pesoTotal1 || 0,
      pesoProm1: e.pesoProm1 || 0,
      mezcla2: e.mezcla2 || '',
      cartucho2: e.cartucho2 || '',
      piezas2: e.piezas2 ?? e.piezas ?? '',
      pesoTotal2: e.pesoTotal2 || 0,
      pesoProm2: e.pesoProm2 || 0,
      observaciones: e.observaciones || '',
    });
    const r = row.number;
    ['D', 'H', 'M'].forEach(col => { ws.getCell(`${col}${r}`).numFmt = '0.000'; });
    ['G', 'L'].forEach(col => { ws.getCell(`${col}${r}`).numFmt = '0'; });
    ws.getCell(`I${r}`).numFmt = '0.000';
    ws.getCell(`N${r}`).numFmt = '0.000';
    ws.getCell(`I${r}`).font = { color: { argb: (e.pesoProm1 || 0) < 0 ? WARN : INK }, bold: (e.pesoProm1 || 0) < 0 };
    ws.getCell(`N${r}`).font = { color: { argb: (e.pesoProm2 || 0) < 0 ? WARN : INK }, bold: (e.pesoProm2 || 0) < 0 };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_BG } };
      }
    });
    ws.getCell(`O${r}`).alignment = { vertical: 'middle', wrapText: true };
  });

  ws.autoFilter = { from: 'A4', to: `O${list.length + 4}` };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `control-pesos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (downloads) {
    try { await downloads.save({ filename, data: buffer }); return; }
    catch (err) {
      if (err && err.code === 'declined') return;
      toast('No se pudo exportar: ' + (err && err.message ? err.message : 'error desconocido'), 'error');
      return;
    }
  }
  const blob = new Blob([buffer], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
document.getElementById('exportBtn').addEventListener('click', exportExcel);

function filteredEntries() {
  const q = document.getElementById('searchBox').value.trim().toUpperCase();
  const d = document.getElementById('filterDate').value;
  return entries.filter(e => {
    if (q && !(e.veladora || '').toUpperCase().includes(q)) return false;
    if (d && e.fecha !== d) return false;
    return true;
  });
}
document.getElementById('searchBox').addEventListener('input', render);
document.getElementById('filterDate').addEventListener('input', render);

async function resolveNames(ids) {
  const unresolved = [...new Set(ids.filter(id => id && !(id in profileCache)))];
  if (unresolved.length && userCap) {
    try {
      const ps = await userCap.profiles(unresolved);
      unresolved.forEach(id => { profileCache[id] = (ps[id] && ps[id].name) || ''; });
    } catch (e) {}
  }
}

function renderStats() {
  const row = document.getElementById('statsRow');
  if (!entries.length) { row.hidden = true; return; }
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter(e => e.fecha === todayStr);
  const veladorasHoy = new Set(todayEntries.map(e => e.veladora)).size;
  const avgHoy = todayEntries.length
    ? todayEntries.reduce((s, e) => s + (e.pesoProm1 || 0), 0) / todayEntries.length
    : 0;
  row.hidden = false;
  row.innerHTML = `
    <div class="stat-tile"><span class="stat-value">${todayEntries.length}</span><span class="stat-label">Capturas hoy</span></div>
    <div class="stat-tile"><span class="stat-value">${veladorasHoy}</span><span class="stat-label">Veladoras hoy</span></div>
    <div class="stat-tile"><span class="stat-value">${fmt(avgHoy)}</span><span class="stat-label">Prom. 1 hoy</span></div>
  `;
}

async function render() {
  renderStats();

  const list = filteredEntries();
  const cardList = document.getElementById('cardList');
  const empty = document.getElementById('emptyState');
  const loading = document.getElementById('loadingState');

  document.getElementById('countNote').textContent = list.length
    ? `${list.length} captura${list.length === 1 ? '' : 's'}${list.length !== entries.length ? ' de ' + entries.length : ''}`
    : '';

  if (!loaded) {
    cardList.innerHTML = '';
    empty.hidden = true;
    loading.hidden = false;
    return;
  }
  loading.hidden = true;

  if (!list.length) { cardList.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;

  await resolveNames(list.map(e => e.capturadoPorId));

  cardList.innerHTML = list.map((e, idx) => `
    <div class="entry-card" style="--i:${Math.min(idx, 14)}">
      <div class="card-top">
        <div>
          <div class="card-date">${e.fecha || ''}</div>
          <div class="card-name">${e.veladora || ''}</div>
        </div>
        <div class="card-actions">
          <button class="edit" data-id="${e.id}" title="Editar" aria-label="Editar captura"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="del" data-id="${e.id}" title="Eliminar" aria-label="Eliminar captura"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </div>
      <div class="readouts-row">
        <div class="readout"><span class="r-label">PROM. 1</span><span class="r-value">${fmt(e.pesoProm1)}</span></div>
        <div class="readout"><span class="r-label">PROM. 2</span><span class="r-value ${e.pesoProm2 < 0 ? 'neg' : ''}">${fmt(e.pesoProm2)}</span></div>
      </div>
      <div class="card-details">
        <div class="d-item"><span>Vaso (kg)</span>${fmt(e.vasoPeso)}</div>
        <div class="d-item"><span>Piezas mezcla 1 / 2</span>${e.piezas1 ?? e.piezas ?? '—'} / ${e.piezas2 ?? e.piezas ?? '—'}</div>
        <div class="d-item"><span>Mezcla 1</span>${e.mezcla1 || ''} · ${e.cartucho1 || ''}</div>
        <div class="d-item"><span>Mezcla 2</span>${e.mezcla2 || ''} · ${e.cartucho2 || ''}</div>
        <div class="d-item full"><span>Observaciones</span><span class="card-obs">${e.observaciones || ''}</span></div>
        <div class="d-item full"><span>Capturado por</span>${e.capturadoPorId ? (profileCache[e.capturadoPorId] || '—') : '—'}</div>
      </div>
    </div>
  `).join('');

  cardList.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => {
    const entry = entries.find(x => x.id === b.dataset.id);
    if (entry) startEdit(entry);
  }));
  cardList.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => deleteEntry(b.dataset.id)));

  const dl = document.getElementById('veladoraList');
  const names = [...new Set(entries.map(e => e.veladora).filter(Boolean))].sort();
  dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

function promptName() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('nameModal');
    const input = document.getElementById('nameInput');
    const okBtn = document.getElementById('nameOk');
    input.value = '';
    openModal(overlay);
    setTimeout(() => input.focus(), 0);
    function submit() {
      const v = input.value.trim();
      closeModal(overlay);
      okBtn.removeEventListener('click', submit);
      input.removeEventListener('keydown', onKey);
      resolve(v);
    }
    function onKey(e) { if (e.key === 'Enter') submit(); }
    okBtn.addEventListener('click', submit);
    input.addEventListener('keydown', onKey);
  });
}

/**
 * Runs outside claude.ai (e.g. GitHub Pages): backs the same db/downloads/user
 * calls with Firebase so the app works standalone. Requires js/firebase-config.js
 * (see README) with a real project config and Anonymous auth + Firestore enabled.
 */
async function setupFirebase() {
  const cfg = window.ARAMO_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf('REEMPLAZA') === 0) return false;

  const base = 'https://cdn.jsdelivr.net/npm/firebase@10.14.1/';
  await loadScript(base + 'firebase-app-compat.js');
  await loadScript(base + 'firebase-auth-compat.js');
  await loadScript(base + 'firebase-firestore-compat.js');

  firebase.initializeApp(cfg);
  await firebase.auth().signInAnonymously();
  db = firebase.firestore();
  downloads = null; // exportCSV() already falls back to a direct browser download

  myId = localStorage.getItem('aramoCapturerName') || '';
  if (!myId) {
    myId = (await promptName()) || 'Sin nombre';
    localStorage.setItem('aramoCapturerName', myId);
  }
  // No hay directorio de usuarios fuera de claude.ai: el "id" guardado ya es el nombre.
  userCap = {
    profiles: async (ids) => {
      const list = Array.isArray(ids) ? ids : [ids];
      const out = {};
      [...new Set(list)].forEach(id => { out[id] = { name: id }; });
      return out;
    },
  };
  return true;
}

async function setupPlatform() {
  if (window.claude && typeof window.claude.use === 'function') {
    db = await claude.use('db');
    downloads = await claude.use('downloads');
    userCap = await claude.use('user');
    if (userCap) { try { myId = await userCap.id(); } catch (e) {} }
    return !!db;
  }
  return await setupFirebase();
}

async function init() {
  const dot = document.getElementById('connDot');
  const text = document.getElementById('connText');
  try {
    const ok = await setupPlatform();
    if (!ok || !db) {
      dot.classList.remove('pending'); dot.classList.add('off');
      text.textContent = window.claude ? 'Sin almacenamiento' : 'Backend no configurado';
      loaded = true; render();
      return;
    }
    dot.classList.remove('pending', 'off'); text.textContent = 'Sincronizado';

    db.collection('capturas').orderBy('fecha', 'desc').limit(1000).onSnapshot(
      (snap) => {
        entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        entries.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
        loaded = true;
        render();
      },
      (err) => {
        dot.classList.remove('pending'); dot.classList.add('off');
        text.textContent = 'Error de sync';
        loaded = true; render();
        console.error(err);
      }
    );
  } catch (err) {
    dot.classList.remove('pending'); dot.classList.add('off');
    text.textContent = 'No disponible';
    loaded = true; render();
    console.error(err);
  }
}
init();
