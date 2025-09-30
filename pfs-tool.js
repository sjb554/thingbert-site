(function () {
  const TOOL_ROOT = document.getElementById('pfs-tool');
  if (!TOOL_ROOT) {
    return;
  }

  const loadingBlock = document.getElementById('pfs-loading');
  const formWrapper = document.getElementById('pfs-form-wrapper');
  const form = document.getElementById('pfs-form');
  const errors = document.getElementById('pfs-errors');
  const suggestions = document.getElementById('pfs-suggestions');
  const hcpcsInput = document.getElementById('pfs-hcpcs');
  const modifierSelect = document.getElementById('pfs-modifier');
  const macSelect = document.getElementById('pfs-mac');
  const localitySelect = document.getElementById('pfs-locality');
  const resultsPanel = document.getElementById('pfs-results');

  const rateNonFac = document.getElementById('pfs-rate-nonfac');
  const rateFac = document.getElementById('pfs-rate-fac');
  const rvuNonFac = document.getElementById('pfs-rvu-nonfac');
  const rvuFac = document.getElementById('pfs-rvu-fac');
  const gpciNonFac = document.getElementById('pfs-gpci-nonfac');
  const gpciFac = document.getElementById('pfs-gpci-fac');
  const peNote = document.getElementById('pfs-pe-note');
  const oppsNote = document.getElementById('pfs-opps-note');
  const titleEl = document.getElementById('pfs-result-title');
  const subtitleEl = document.getElementById('pfs-result-subtitle');

  const detail = {
    code: document.getElementById('pfs-detail-code'),
    status: document.getElementById('pfs-detail-status'),
    pctc: document.getElementById('pfs-detail-pctc'),
    global: document.getElementById('pfs-detail-global'),
    mult: document.getElementById('pfs-detail-mult'),
    bilt: document.getElementById('pfs-detail-bilt'),
    asst: document.getElementById('pfs-detail-asst'),
    co: document.getElementById('pfs-detail-co'),
    team: document.getElementById('pfs-detail-team'),
    supervision: document.getElementById('pfs-detail-supervision'),
    family: document.getElementById('pfs-detail-family'),
  };

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return `$${value.toFixed(2)}`;
  }

  function formatNumber(value, digits = 3) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return value.toFixed(digits);
  }

  function formatIndicator(value) {
    if (!value) {
      return '—';
    }
    return value;
  }

  function uniqueValues(items) {
    return Array.from(new Set(items));
  }

  async function loadData() {
    const manifestPromise = fetch('data/pfs/manifest.json').then((r) => r.json());
    const indicatorsPromise = fetch('data/pfs/indicators-2024B.json').then((r) => r.json());
    const localitiesPromise = fetch('data/pfs/localities-2024B.json').then((r) => r.json());

    const [manifest, indicators, localities] = await Promise.all([
      manifestPromise,
      indicatorsPromise,
      localitiesPromise,
    ]);

    return { manifest, indicators, localities };
  }

  function buildIndex(columns) {
    const index = {};
    columns.forEach((name, i) => {
      index[name] = i;
    });
    return index;
  }

  function prepareIndicators(indicators) {
    const colIdx = buildIndex(indicators.columns);
    const map = new Map();
    const codeList = new Set();

    indicators.rows.forEach((row) => {
      const code = row[colIdx.hcpc];
      const key = code;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(row);
      codeList.add(code);
    });

    return { map, colIdx, codes: Array.from(codeList).sort() };
  }

  function prepareLocalities(localities) {
    const colIdx = buildIndex(localities.columns);
    const map = new Map();
    const macMap = new Map();

    localities.rows.forEach((row) => {
      const code = row[colIdx.code];
      map.set(code, row);

      const mac = row[colIdx.mac] || 'Unknown';
      if (!macMap.has(mac)) {
        macMap.set(mac, []);
      }
      macMap.get(mac).push(row);
    });

    // sort locality lists alphabetically
    for (const list of macMap.values()) {
      list.sort((a, b) => {
        const aDesc = (a[colIdx.description] || '').toUpperCase();
        const bDesc = (b[colIdx.description] || '').toUpperCase();
        return aDesc.localeCompare(bDesc);
      });
    }

    return { map, colIdx, macMap };
  }

  function updateModifierOptions(indicatorRows, idx) {
    modifierSelect.innerHTML = '';
    const modifiers = uniqueValues(
      indicatorRows.map((row) => (row[idx.modifier] || '').trim()),
    );

    modifiers.sort((a, b) => a.localeCompare(b));

    modifiers.forEach((modifier) => {
      const option = document.createElement('option');
      option.value = modifier;
      option.textContent = modifier === '' ? 'None' : modifier;
      modifierSelect.appendChild(option);
    });
  }

  function updateMacOptions(localities, idx) {
    const entries = Array.from(localities.macMap.entries());
    entries.sort((a, b) => {
      const macA = a[0];
      const macB = b[0];
      if (macA === macB) return 0;
      return macA < macB ? -1 : 1;
    });

    macSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All MACs';
    macSelect.appendChild(allOption);

    entries.forEach(([mac, rows]) => {
      const macDesc = rows[0][idx.mac_description] || mac;
      const option = document.createElement('option');
      option.value = mac;
      option.textContent = `${mac} — ${macDesc}`;
      macSelect.appendChild(option);
    });

    macSelect.value = 'all';
    updateLocalityOptions(localities, idx, 'all');
  }

  function updateLocalityOptions(localities, idx, macValue) {
    localitySelect.innerHTML = '';
    const rows = macValue === 'all'
      ? Array.from(localities.map.values())
      : (localities.macMap.get(macValue) || []);

    rows.sort((a, b) => {
      const macA = a[idx.mac] || '';
      const macB = b[idx.mac] || '';
      if (macA !== macB) {
        return macA.localeCompare(macB);
      }
      const descA = a[idx.description] || '';
      const descB = b[idx.description] || '';
      return descA.localeCompare(descB);
    });

    rows.forEach((row) => {
      const option = document.createElement('option');
      const mac = row[idx.mac] || '';
      const localityCode = row[idx.code];
      const localityDesc = row[idx.description] || localityCode;
      const macDesc = row[idx.mac_description] || mac;
      option.value = localityCode;
      option.textContent = `${macDesc} — ${localityDesc}`;
      localitySelect.appendChild(option);
    });

    if (localitySelect.options.length > 0) {
      localitySelect.value = localitySelect.options[0].value;
    }
  }

  function renderSuggestions(codeList, query) {
    suggestions.innerHTML = '';
    const trimmed = query.trim().toUpperCase();
    if (!trimmed || trimmed.length < 2) {
      return;
    }

    const matches = codeList.filter((code) => code.startsWith(trimmed)).slice(0, 10);
    matches.forEach((code) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'pfs-suggestion';
      item.textContent = code;
      item.dataset.code = code;
      suggestions.appendChild(item);
    });
  }

  function selectSuggestion(code) {
    hcpcsInput.value = code;
    suggestions.innerHTML = '';
    hcpcsInput.dispatchEvent(new Event('change'));
    hcpcsInput.focus();
  }

  function calculatePayments(indRow, idxInd, locRow, idxLoc) {
    const conv = numberOrNull(indRow[idxInd.conv_fact]) || 0;
    const workAdjust = numberOrNull(indRow[idxInd.work_adjustor]) || 1;
    const rvuWork = numberOrNull(indRow[idxInd.rvu_work]) || 0;
    const rvuMp = numberOrNull(indRow[idxInd.rvu_mp]) || 0;

    const transNonFacPe = numberOrNull(indRow[idxInd.trans_nfac_pe
