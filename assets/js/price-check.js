(function () {
  const DATA_URL = 'assets/data/locality-mapping.json';

  const STATE_ABBR_LENGTH = 2;

  let datasetPromise;

  const normalizeTerm = (value) => {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const buildIndex = (data) => {
    const stateIndex = new Map();
    const termIndex = new Map();
    const stateAbbrByName = new Map();
    const stateNameByAbbr = new Map();

    if (data.stateNames) {
      Object.entries(data.stateNames).forEach(([abbr, name]) => {
        stateNameByAbbr.set(abbr, name);
        stateAbbrByName.set(normalizeTerm(name), abbr);
      });
    }

    data.localities.forEach((loc) => {
      const normalizedCounties = (loc.counties || []).map(normalizeTerm);
      const searchTerms = (loc.searchTerms || []).map((term) => term.trim());
      const searchSet = new Set(searchTerms);
      const enriched = {
        ...loc,
        normalizedCounties,
        searchSet,
      };
      const list = stateIndex.get(loc.stateAbbr) || [];
      list.push(enriched);
      stateIndex.set(loc.stateAbbr, list);

      searchSet.forEach((term) => {
        const key = term;
        if (!termIndex.has(key)) {
          termIndex.set(key, []);
        }
        termIndex.get(key).push(enriched);
      });
    });

    // Sort localities by specificity so county matches come before rest-of-state
    stateIndex.forEach((list) => {
      list.sort((a, b) => {
        if (a.isStatewide && !b.isStatewide) return 1;
        if (!a.isStatewide && b.isStatewide) return -1;
        if (a.isRestOfState && !b.isRestOfState) return 1;
        if (!a.isRestOfState && b.isRestOfState) return -1;
        return (b.counties?.length || 0) - (a.counties?.length || 0);
      });
    });

    return {
      ...data,
      index: stateIndex,
      termIndex,
      stateAbbrByName,
      stateNameByAbbr,
    };
  };

  const loadDataset = () => {
    if (!datasetPromise) {
      datasetPromise = fetch(DATA_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load locality mapping (${response.status})`);
          }
          return response.json();
        })
        .then((data) => buildIndex(data));
    }
    return datasetPromise;
  };

  const findLocalityForStateCounty = (dataset, stateAbbr, countyName) => {
    if (!stateAbbr) {
      return null;
    }
    const stateLocalities = dataset.index.get(stateAbbr);
    if (!stateLocalities || !stateLocalities.length) {
      return null;
    }

    if (countyName) {
      const normalizedCounty = normalizeTerm(countyName);
      const directMatch = stateLocalities.find((loc) => loc.normalizedCounties.includes(normalizedCounty));
      if (directMatch) {
        return directMatch;
      }
      const aliasMatch = stateLocalities.find((loc) => loc.searchSet.has(normalizedCounty));
      if (aliasMatch) {
        return aliasMatch;
      }
    }

    const statewide = stateLocalities.find((loc) => loc.isStatewide);
    if (statewide) {
      return statewide;
    }
    const rest = stateLocalities.find((loc) => loc.isRestOfState);
    if (rest) {
      return rest;
    }
    if (stateLocalities.length === 1) {
      return stateLocalities[0];
    }
    return null;
  };

  const pickFromMatches = (matches, stateAbbr) => {
    if (!matches || !matches.length) {
      return null;
    }
    if (stateAbbr) {
      const filtered = matches.filter((loc) => loc.stateAbbr === stateAbbr);
      if (filtered.length === 1) {
        return filtered[0];
      }
      if (filtered.length > 1) {
        // Prefer county-specific records
        filtered.sort((a, b) => (b.counties?.length || 0) - (a.counties?.length || 0));
        return filtered[0];
      }
    }
    if (matches.length === 1) {
      return matches[0];
    }
    // If multiple states share the same term, return the most specific one
    const sorted = [...matches].sort((a, b) => (b.counties?.length || 0) - (a.counties?.length || 0));
    return sorted[0];
  };

  const lookupByTerm = (dataset, term, stateAbbr) => {
    if (!term) {
      return null;
    }
    const normalized = normalizeTerm(term);
    const matches = dataset.termIndex.get(normalized);
    return pickFromMatches(matches, stateAbbr);
  };

  const extractState = (dataset, rawInput) => {
    const result = {
      stateAbbr: null,
      locationText: rawInput,
    };

    const segments = rawInput.split(',');
    if (segments.length > 1) {
      const possibleState = segments[segments.length - 1].trim();
      const abbrCandidate = possibleState.toUpperCase();
      if (abbrCandidate.length === STATE_ABBR_LENGTH && dataset.index.has(abbrCandidate)) {
        result.stateAbbr = abbrCandidate;
        result.locationText = segments.slice(0, -1).join(',');
        return result;
      }
      const nameCandidate = normalizeTerm(possibleState);
      const fromName = dataset.stateAbbrByName.get(nameCandidate);
      if (fromName) {
        result.stateAbbr = fromName;
        result.locationText = segments.slice(0, -1).join(',');
        return result;
      }
    }

    const tokens = rawInput.trim().split(/\s+/);
    if (tokens.length) {
      const lastToken = tokens[tokens.length - 1];
      const abbrCandidate = lastToken.toUpperCase();
      if (abbrCandidate.length === STATE_ABBR_LENGTH && dataset.index.has(abbrCandidate)) {
        result.stateAbbr = abbrCandidate;
        result.locationText = tokens.slice(0, -1).join(' ');
        return result;
      }
      const nameCandidate = normalizeTerm(lastToken);
      const fromName = dataset.stateAbbrByName.get(nameCandidate);
      if (fromName) {
        result.stateAbbr = fromName;
        result.locationText = tokens.slice(0, -1).join(' ');
        return result;
      }
    }

    return result;
  };

  const resolveLocality = async (rawInput) => {
    const initialInput = rawInput == null ? '' : String(rawInput).trim();
    if (!initialInput) {
      return {
        ok: false,
        reason: 'EMPTY_INPUT',
        message: 'No location provided.',
      };
    }

    const dataset = await loadDataset();

    const zipMatch = initialInput.match(/^\d{5}$/);
    if (zipMatch) {
      const entry = dataset.zipToCounty[zipMatch[0]];
      if (!entry) {
        return {
          ok: false,
          reason: 'UNKNOWN_ZIP',
          message: `ZIP code ${zipMatch[0]} is not mapped to a CMS locality.`,
        };
      }
      const locality = findLocalityForStateCounty(dataset, entry.stateAbbr, entry.county);
      if (locality) {
        return {
          ok: true,
          via: 'zip',
          zip: zipMatch[0],
          state: locality.state,
          stateAbbr: locality.stateAbbr,
          county: entry.county,
          localityNumber: locality.localityNumber,
          mac: locality.mac,
          localityLabel: locality.localityLabel,
          feeScheduleArea: locality.feeScheduleArea,
          counties: locality.counties,
          isStatewide: locality.isStatewide,
          isRestOfState: locality.isRestOfState,
        };
      }
      return {
        ok: false,
        reason: 'NO_LOCALITY_FOR_ZIP',
        message: `No CMS locality found for ${entry.county}, ${entry.stateAbbr}.`,
      };
    }

    const { stateAbbr, locationText } = extractState(dataset, initialInput);
    const normalizedLocation = normalizeTerm(locationText);

    if (!normalizedLocation && stateAbbr) {
      const locality = findLocalityForStateCounty(dataset, stateAbbr, null);
      if (locality) {
        return {
          ok: true,
          via: 'state',
          state: locality.state,
          stateAbbr: locality.stateAbbr,
          localityNumber: locality.localityNumber,
          mac: locality.mac,
          localityLabel: locality.localityLabel,
          feeScheduleArea: locality.feeScheduleArea,
          counties: locality.counties,
          isStatewide: locality.isStatewide,
          isRestOfState: locality.isRestOfState,
        };
      }
    }

    const locationAliases = [normalizedLocation];
    if (stateAbbr) {
      locationAliases.push(`${normalizedLocation} ${stateAbbr}`.trim());
      locationAliases.push(`${normalizedLocation} COUNTY`.trim());
      locationAliases.push(`${normalizedLocation} COUNTY ${stateAbbr}`.trim());
    }

    for (const alias of locationAliases) {
      const locality = lookupByTerm(dataset, alias, stateAbbr);
      if (locality) {
        return {
          ok: true,
          via: 'term',
          state: locality.state,
          stateAbbr: locality.stateAbbr,
          localityNumber: locality.localityNumber,
          mac: locality.mac,
          localityLabel: locality.localityLabel,
          feeScheduleArea: locality.feeScheduleArea,
          counties: locality.counties,
          isStatewide: locality.isStatewide,
          isRestOfState: locality.isRestOfState,
          matchedTerm: alias,
        };
      }
    }

    if (stateAbbr) {
      const locality = findLocalityForStateCounty(dataset, stateAbbr, normalizedLocation);
      if (locality) {
        return {
          ok: true,
          via: 'state-fallback',
          state: locality.state,
          stateAbbr: locality.stateAbbr,
          localityNumber: locality.localityNumber,
          mac: locality.mac,
          localityLabel: locality.localityLabel,
          feeScheduleArea: locality.feeScheduleArea,
          counties: locality.counties,
          isStatewide: locality.isStatewide,
          isRestOfState: locality.isRestOfState,
        };
      }
    }

    return {
      ok: false,
      reason: 'NO_MATCH',
      message: `Could not map "${initialInput}" to a CMS locality. Provide a ZIP code or include the state/county name.`,
    };
  };

  const resolutionMessages = {
    zip: 'Matched the ZIP code to the CMS locality for that county.',
    term: 'Matched the location text you entered to a CMS locality.',
    state: 'Matched based on the statewide locality for that state.',
    'state-fallback': 'Selected the closest locality available for the state provided.',
  };

  const q = (id) => document.getElementById(id);

  const toggleHidden = (el, shouldHide) => {
    if (!el) return;
    el.classList[shouldHide ? 'add' : 'remove']('hidden');
  };

  const clearCodeDetails = (elements) => {
    if (!elements || !elements.codeContainer) {
      return;
    }
    toggleHidden(elements.codeContainer, true);
    if (elements.codeTitle) {
      elements.codeTitle.textContent = '';
    }
    if (elements.codeDescription) {
      elements.codeDescription.textContent = '';
    }
  };

  const setCodeDetails = (elements, row, fallbackCode) => {
    if (!elements || !elements.codeContainer || !elements.codeTitle || !elements.codeDescription) {
      return;
    }
    if (!row) {
      clearCodeDetails(elements);
      return;
    }
    const code = (row.hcpc || fallbackCode || '').toString().trim().toUpperCase();
    const modifier = (row.modifier || '').toString().trim().toUpperCase();
    let label = 'HCPCS Code';
    if (code) {
      label = 'HCPCS ' + code + (modifier ? '-' + modifier : '');
    }
    elements.codeTitle.textContent = label;
    const description = row.description && row.description.trim() ? row.description.trim() : null;
    elements.codeDescription.textContent = description || 'CMS did not provide a short description for this code.';
    toggleHidden(elements.codeContainer, false);
  };

  const setStatus = (el, message) => {
    if (!el) return;
    if (message) {
      el.textContent = message;
      toggleHidden(el, false);
    } else {
      el.textContent = '';
      toggleHidden(el, true);
    }
  };

  const setButtonBusy = (button, busy) => {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = button.textContent;
      }
      button.disabled = true;
      button.textContent = 'Submitting...';
    } else {
      button.disabled = false;
      if (button.dataset.originalLabel) {
        button.textContent = button.dataset.originalLabel;
      }
    }
  };

  const clearFeedback = (elements) => {
    toggleHidden(elements.feedback, true);
    clearCodeDetails(elements);
    toggleHidden(elements.error, true);
    toggleHidden(elements.pricingContainer, true);
    setStatus(elements.status, '');
    if (elements.meta) {
      elements.meta.innerHTML = '';
    }
    if (elements.pricingTable) {
      elements.pricingTable.innerHTML = '';
    }
    if (elements.recommendation) {
      elements.recommendation.textContent = '';
    }
  };

  const renderSuccess = (elements, result) => {
    const { feedback, feedbackTitle, feedbackBody, meta } = elements;
    if (!feedback || !feedbackTitle || !feedbackBody || !meta) {
      return;
    }

    feedbackTitle.textContent = `${result.localityLabel}, ${result.stateAbbr}`;
    const resolution = resolutionMessages[result.via] || 'Matched the CMS locality for your entry.';
    let detail = resolution;
    if (result.county) {
      detail = `${resolution} County resolved: ${result.county}.`;
    } else if (result.isRestOfState) {
      detail = `${resolution} Covers the remaining counties in ${result.state}.`;
    } else if (result.isStatewide) {
      detail = `${resolution} Applies statewide.`;
    }
    feedbackBody.textContent = detail;

    meta.innerHTML = '';
    const normalizedLocality = (result.localityLabel || '').toUpperCase();
    const countyList = Array.isArray(result.counties)
      ? Array.from(new Set(result.counties.filter(Boolean))).filter((name) => name.toUpperCase() !== normalizedLocality)
      : [];
    const entries = [
      { label: 'Locality Number', value: result.localityNumber },
      { label: 'MAC Number', value: result.mac },
      { label: 'State', value: `${result.state} (${result.stateAbbr})` },
    ];

    if (countyList.length) {
      entries.push({ label: 'Counties Included', value: countyList.join(', ') });
    } else if (result.isStatewide) {
      entries.push({ label: 'Counties Included', value: 'All counties' });
    } else if (result.isRestOfState) {
      entries.push({ label: 'Counties Included', value: 'Rest of state' });
    }
    if (result.zip) {
      entries.unshift({ label: 'ZIP Code', value: result.zip });
    } else if (result.matchedTerm) {
      entries.unshift({ label: 'Matched Term', value: result.matchedTerm.replace(/\s+/g, ' ') });
    }

    entries.forEach((entry) => {
      if (!entry || !entry.value) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'price-check-feedback__meta-item';
      const dt = document.createElement('dt');
      dt.textContent = entry.label;
      const dd = document.createElement('dd');
      dd.textContent = entry.value;
      wrapper.append(dt, dd);
      meta.appendChild(wrapper);
    });

    toggleHidden(feedback, false);
    toggleHidden(elements.error, true);
  };

  const renderError = (elements, message) => {
    if (!elements.error) return;
    elements.error.textContent = message || 'Unable to map the location. Please adjust and try again.';
    toggleHidden(elements.error, false);
    toggleHidden(elements.feedback, true);
    clearCodeDetails(elements);
  };

  const combineLocalityCode = (mac, localityNumber) => {
    if (!mac) {
      return null;
    }
    if (!localityNumber && localityNumber !== 0) {
      return mac;
    }
    const digits = String(localityNumber).trim();
    if (digits.length > 3) {
      return digits;
    }
    return `${mac}${digits.padStart(2, '0')}`;
  };

  const parseAmount = (value) => {
    if (value == null || value === '') {
      return null;
    }
    const num = Number(String(value).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(num) ? num : null;
  };

  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  const formatCurrency = (amount) => {
    const num = parseAmount(amount);
    return num == null ? '--' : currencyFormatter.format(num);
  };

  const formatPercent = (value) => {
    if (value == null || Number.isNaN(value)) {
      return '';
    }
    const rounded = Math.round(value * 10) / 10;
    if (Number.isNaN(rounded)) {
      return '';
    }
    const text = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${text}%`;
  };

  const renderPricingError = (elements, message) => {
    clearCodeDetails(elements);
    if (elements.pricingContainer) {
      toggleHidden(elements.pricingContainer, false);
    }
    if (elements.pricingTable) {
      elements.pricingTable.innerHTML = '';
    }
    if (elements.recommendation) {
      elements.recommendation.textContent = message;
    }
  };

  const renderPricing = (elements, localityResult, pricingResult, formData, hcpcsCode) => {
    if (!elements.pricingContainer || !elements.pricingTable || !pricingResult) {
      return;
    }

    const allRows = Array.isArray(pricingResult.rows) ? pricingResult.rows : [];
    const localityCode = combineLocalityCode(localityResult.mac, localityResult.localityNumber);
    let targetRow = pricingResult.matchingRow || (localityCode ? allRows.find((row) => row.locality === localityCode) : null);
    if (!targetRow && allRows.length) {
      targetRow = allRows[0];
    }

    if (!targetRow) {
      renderPricingError(elements, 'Medicare pricing data is not available for this code.');
      return;
    }

    setCodeDetails(elements, targetRow, hcpcsCode);

    let allowed = parseAmount(targetRow.nonFacilityPrice);
    if (allowed == null || allowed === 0) {
      allowed = parseAmount(targetRow.facilityPrice);
    }

    if (allowed == null || allowed === 0) {
      renderPricingError(elements, 'Medicare pricing data is not available for this code.');
      return;
    }

    const localityName = targetRow.localityDescription || localityResult.localityLabel || 'your locality';
    const billAmount = parseAmount(formData?.get('current_bill'));
    const allowedClaimAmount = parseAmount(formData?.get('allowed_amount'));

    const rows = [];
    rows.push({
      label: `Medicare allowed amount (${localityName})`,
      amount: formatCurrency(allowed),
      percent: '100%',
    });

    const calcPercent = (value) => {
      if (value == null) {
        return null;
      }
      return (value / allowed) * 100;
    };

    if (billAmount != null) {
      rows.push({
        label: 'Your bill',
        amount: formatCurrency(billAmount),
        percent: formatPercent(calcPercent(billAmount)),
      });
    }

    if (allowedClaimAmount != null) {
      rows.push({
        label: 'Allowed amount on claim',
        amount: formatCurrency(allowedClaimAmount),
        percent: formatPercent(calcPercent(allowedClaimAmount)),
      });
    }

    const tableHeader = '<thead><tr><th>Item</th><th>Amount</th><th>% of Medicare</th></tr></thead>';
    const tableBody = rows
      .map((row) => `<tr><td>${row.label}</td><td>${row.amount}</td><td>${row.percent || ''}</td></tr>`)
      .join('');
    elements.pricingTable.innerHTML = `${tableHeader}<tbody>${tableBody}</tbody>`;
    toggleHidden(elements.pricingContainer, false);

    let recommendation;
    if (billAmount != null) {
      const pct = formatPercent(calcPercent(billAmount));
      recommendation = pct
        ? `Your bill is ${pct} of Medicare for this code in ${localityName}.`
        : `Your bill for this code in ${localityName} could not be compared to Medicare.`;
    } else if (allowedClaimAmount != null) {
      const pct = formatPercent(calcPercent(allowedClaimAmount));
      recommendation = pct
        ? `The plan allowed amount is ${pct} of Medicare for this code in ${localityName}.`
        : `The plan allowed amount for this code in ${localityName} could not be compared to Medicare.`;
    } else {
      recommendation = `The Medicare allowed amount for this code in ${localityName} is ${formatCurrency(allowed)}.`;
    }

    if (elements.recommendation) {
      elements.recommendation.textContent = recommendation;
    }
  };

  const initPriceCheckForm = () => {
    const form = q('price-check-form');
    if (!form) {
      return;
    }
    const locationInput = form.querySelector('#member-location');
    const submitButton = form.querySelector('button[type="submit"]');
    const elements = {
      status: q('price-check-status'),
      feedback: q('price-check-feedback'),
      feedbackTitle: q('price-check-feedback-title'),
      feedbackBody: q('price-check-feedback-body'),
      meta: q('price-check-feedback-meta'),
      codeContainer: q('price-check-code'),
      codeTitle: q('price-check-code-title'),
      codeDescription: q('price-check-code-description'),
      pricingContainer: q('price-check-pricing'),
      pricingTable: q('price-check-pricing-table'),
      recommendation: q('price-check-recommendation'),
      error: q('price-check-error'),
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFeedback(elements);
      if (!locationInput || !locationInput.value.trim()) {
        renderError(elements, 'Please provide a ZIP code, county, or state.');
        return;
      }

      const formData = new FormData(form);
      const hcpcsCode = (formData.get('hcpcs_code') || '').toString().trim();
      setStatus(elements.status, 'Looking up CMS locality...');
      setButtonBusy(submitButton, true);
      try {
        const localityResult = await resolveLocality(locationInput.value);
        if (!localityResult.ok) {
          renderError(elements, localityResult.message);
          return;
        }

        renderSuccess(elements, localityResult);

        if (!hcpcsCode) {
          renderPricingError(elements, 'Enter an HCPCS code to see Medicare pricing.');
          return;
        }

        const fetchFeeSchedule = window.ThingbertPriceCheck && window.ThingbertPriceCheck.fetchFeeSchedule;
        if (typeof fetchFeeSchedule !== 'function') {
          renderPricingError(elements, 'Unable to load Medicare pricing client. Refresh the page and try again.');
          return;
        }

        setStatus(elements.status, 'Retrieving Medicare allowed amount...');
        try {
          const pricingResult = await fetchFeeSchedule({
            hcpcsCode,
            mac: localityResult.mac,
            localityNumber: localityResult.localityNumber,
            includeAllMacs: true,
          });

          if (!pricingResult || !Array.isArray(pricingResult.rows) || !pricingResult.rows.length) {
            renderPricingError(elements, 'No Medicare pricing found for this code.');
          } else {
            renderPricing(elements, localityResult, pricingResult, formData, hcpcsCode);
          }
        } catch (pricingError) {
          console.error('Price check Medicare lookup failed', pricingError);
          renderPricingError(elements, 'Unable to retrieve Medicare pricing right now. Please try again later.');
        } finally {
          setStatus(elements.status, '');
        }
      } catch (error) {
        console.error('Price check locality lookup failed', error);
        renderError(elements, 'Unexpected error looking up the CMS locality. Please try again.');
      } finally {
        setStatus(elements.status, '');
        setButtonBusy(submitButton, false);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPriceCheckForm);
  } else {
    initPriceCheckForm();
  }

  window.ThingbertPriceCheck = window.ThingbertPriceCheck || {};
  window.ThingbertPriceCheck.resolveLocality = resolveLocality;
  window.ThingbertPriceCheck._loadLocalityDataset = loadDataset;
  window.ThingbertPriceCheck._initForm = initPriceCheckForm;
})();

