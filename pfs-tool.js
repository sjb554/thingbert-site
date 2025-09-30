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
      return Number.isFinite(value) ? value : null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatCurrency(value) {
    if (value === null || Number.isNaN(value)) {
      return '—';
    }
    return `$${value.toFixed(2)}`;
  }

  function formatNumber(value, digits = 3) {
    if (value === null || Number.isNaN(value)) {
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
