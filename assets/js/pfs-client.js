(function () {
  const PFS_API_BASE = 'https://pfs.data.cms.gov/api/1';
  let catalogPromise;

  const fetchPfsCatalog = () => {
    if (!catalogPromise) {
      const catalogUrl = `${PFS_API_BASE}/metastore/schemas/dataset/items?show-reference-ids`;
      catalogPromise = fetch(catalogUrl, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        redirect: 'follow',
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load PFS catalog (${response.status})`);
          }
          return response.json();
        })
        .then((payload) => {
          const years = {};
          const normalizeKey = (value) => {
            if (!value) {
              return null;
            }
            const match = String(value).match(/^(\d{4})([A-Z])?$/);
            if (!match) {
              return null;
            }
            return { raw: match[0], year: parseInt(match[1], 10), suffix: match[2] || '' };
          };

          (payload || []).forEach((item) => {
            const distribution = item?.distribution?.[0];
            if (!distribution?.identifier) {
              return;
            }
            const keywords = (item.keyword || []).map((kw) => kw.data);
            const yearTag = keywords.map(normalizeKey).find(Boolean);
            if (!yearTag) {
              return;
            }
            const yearKey = yearTag.raw;
            const entry = years[yearKey] || { description: item.description || '', indicator: null, locality: null };
            if (keywords.includes('indicators')) {
              entry.indicator = distribution.identifier;
            }
            if (keywords.includes('localities')) {
              entry.locality = distribution.identifier;
            }
            if (!entry.description && item.description) {
              entry.description = item.description;
            }
            years[yearKey] = entry;
          });

          Object.keys(years).forEach((key) => {
            const entry = years[key];
            if (!entry.indicator || !entry.locality) {
              delete years[key];
            }
          });

          return { years };
        })
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  };

  const selectLatestYearKey = (yearsMap) => {
    const keys = Object.keys(yearsMap || {});
    if (!keys.length) {
      return null;
    }
    const sorted = keys.sort((a, b) => {
      const parseKey = (value) => {
        const match = value.match(/^(\d{4})([A-Z])?$/);
        return {
          year: parseInt(match?.[1] || '0', 10),
          suffix: match?.[2] || '',
        };
      };
      const pa = parseKey(a);
      const pb = parseKey(b);
      if (pa.year !== pb.year) {
        return pa.year - pb.year;
      }
      if (pa.suffix === pb.suffix) {
        return 0;
      }
      return pa.suffix < pb.suffix ? -1 : 1;
    });
    return sorted[sorted.length - 1];
  };

  const sanitizeHcpcs = (value) => {
    if (!value) {
      return '';
    }
    return String(value).trim().toUpperCase();
  };

  const formatLocalityCode = (mac, locality) => {
    const macCode = String(mac || '').trim();
    const loc = String(locality || '').trim();
    if (!macCode) {
      return null;
    }
    if (loc.length === 7 && loc.startsWith(macCode)) {
      return loc;
    }
    const locDigits = loc.padStart(2, '0');
    return `${macCode}${locDigits}`;
  };
  const createPricingProperties = (yearKey) => {
    const properties = [
      { resource: 'i', property: 'year' },
      { resource: 'i', property: 'hcpc' },
      { resource: 'i', property: 'modifier' },
      { resource: 'i', property: 'sdesc' },
      { resource: 'i', property: 'proc_stat' },
      { resource: 'i', property: 'pctc' },
      { resource: 'i', property: 'global' },
      { resource: 'i', property: 'mult_surg' },
      { resource: 'i', property: 'bilt_surg' },
      { resource: 'i', property: 'asst_surg' },
      { resource: 'i', property: 'co_surg' },
      { resource: 'i', property: 'team_surg' },
      { resource: 'i', property: 'phy_superv' },
      { resource: 'i', property: 'family_ind' },
      { resource: 'i', property: 'nfac_total' },
      { resource: 'i', property: 'fac_total' },
      { resource: 'i', property: 'rvu_work' },
      { resource: 'i', property: 'trans_nfac_pe' },
      { resource: 'i', property: 'trans_fac_pe' },
      { resource: 'i', property: 'rvu_mp' },
      { resource: 'i', property: 'conv_fact' },
      { resource: 'i', property: 'work_adjustor' },
      { resource: 'l', property: 'mac' },
      { resource: 'l', property: 'mac_description' },
      { resource: 'l', property: 'locality' },
      { resource: 'l', property: 'loc_description' },
      { resource: 'l', property: 'gpci_work' },
      { resource: 'l', property: 'gpci_pe' },
      { resource: 'l', property: 'gpci_mp' },
    ];

    const year = parseInt((yearKey || '').slice(0, 4), 10) || 0;

    const nonFacilityExpression = {
      operator: '+',
      operands: [
        {
          expression: {
            operator: '*',
            operands: [
              {
                expression: {
                  operator: '*',
                  operands: [
                    { resource: 'i', property: 'rvu_work' },
                    { resource: 'i', property: 'work_adjustor' },
                  ],
                },
              },
              { resource: 'l', property: 'gpci_work' },
            ],
          },
        },
        {
          expression: {
            operator: '*',
            operands: [
              { resource: 'i', property: 'trans_nfac_pe' },
              { resource: 'l', property: 'gpci_pe' },
            ],
          },
        },
        {
          expression: {
            operator: '*',
            operands: [
              { resource: 'i', property: 'rvu_mp' },
              { resource: 'l', property: 'gpci_mp' },
            ],
          },
        },
      ],
    };

    const facilityExpression = {
      operator: '+',
      operands: [
        {
          expression: {
            operator: '*',
            operands: [
              {
                expression: {
                  operator: '*',
                  operands: [
                    { resource: 'i', property: 'rvu_work' },
                    { resource: 'i', property: 'work_adjustor' },
                  ],
                },
              },
              { resource: 'l', property: 'gpci_work' },
            ],
          },
        },
        {
          expression: {
            operator: '*',
            operands: [
              { resource: 'i', property: 'trans_fac_pe' },
              { resource: 'l', property: 'gpci_pe' },
            ],
          },
        },
        {
          expression: {
            operator: '*',
            operands: [
              { resource: 'i', property: 'rvu_mp' },
              { resource: 'l', property: 'gpci_mp' },
            ],
          },
        },
      ],
    };

    if (year >= 2007) {
      properties.push({ alias: 'nfac_price', expression: { operator: '*', operands: [{ expression: nonFacilityExpression }, { resource: 'i', property: 'conv_fact' }] } });
      properties.push({ alias: 'fac_price', expression: { operator: '*', operands: [{ expression: facilityExpression }, { resource: 'i', property: 'conv_fact' }] } });
      properties.push({ alias: 'nfac_limiting_charge', expression: { operator: '*', operands: [{ expression: nonFacilityExpression }, { resource: 'i', property: 'conv_fact' }, 1.0925] } });
      properties.push({ alias: 'fac_limiting_charge', expression: { operator: '*', operands: [{ expression: facilityExpression }, { resource: 'i', property: 'conv_fact' }, 1.0925] } });
    }

    return properties;
  };
  const buildPricingQuery = ({
    yearKey,
    indicatorId,
    localityId,
    hcpcsCode,
    limit = 500,
    offset = 0,
    includeAllMacs = true,
    macCode,
    localityCode,
  }) => {
    const normalizedCode = sanitizeHcpcs(hcpcsCode);
    if (!normalizedCode) {
      throw new Error('HCPCS code is required for fee schedule lookup.');
    }
    const properties = createPricingProperties(yearKey);
    const query = {
      resources: [
        { id: indicatorId, alias: 'i' },
        { id: localityId, alias: 'l' },
      ],
      properties,
      conditions: [
        { resource: 'i', property: 'hcpc', operator: '=', value: normalizedCode },
        { resource: 'i', property: 'year', operator: '=', value: yearKey },
      ],
      joins: [
        {
          resource: 'l',
          condition: {
            resource: 'i',
            property: 'year',
            operator: '=',
            value: { resource: 'l', property: 'year' },
          },
        },
      ],
      limit,
      offset,
      sorts: [],
      keys: true,
    };

    if (!includeAllMacs && localityCode) {
      query.conditions.push({ resource: 'l', property: 'locality', operator: '=', value: localityCode });
    } else if (!includeAllMacs && macCode) {
      query.conditions.push({ resource: 'l', property: 'mac', operator: '=', value: macCode });
    }

    return { query, normalizedCode };
  };

  const postDatastoreQuery = async (searchLabel, body) => {
    const url = `${PFS_API_BASE}/datastore/query?search=${encodeURIComponent(searchLabel)}&redirect=false`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`PFS query failed (${response.status})`);
    }
    return response.json();
  };

  const formatNumber = (value, digits = 2) => {
    if (value == null || value === '') {
      return '';
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      return value;
    }
    return num.toFixed(digits);
  };

  const normalizePricingRow = (row) => ({
    year: row.year,
    hcpc: row.hcpc,
    modifier: row.modifier ? row.modifier.trim() : '',
    description: row.sdesc,
    status: row.proc_stat,
    pctc: row.pctc,
    global: row.global,
    multipleSurgery: row.mult_surg,
    bilateralSurgery: row.bilt_surg,
    assistantSurgery: row.asst_surg,
    coSurgery: row.co_surg,
    teamSurgery: row.team_surg,
    physicianSupervision: row.phy_superv,
    familyIndicator: row.family_ind,
    nonFacilityTotalRvu: formatNumber(row.nfac_total, 4),
    facilityTotalRvu: formatNumber(row.fac_total, 4),
    nonFacilityPrice: formatNumber(row.nfac_price, 2),
    facilityPrice: formatNumber(row.fac_price, 2),
    nonFacilityLimitingCharge: formatNumber(row.nfac_limiting_charge, 2),
    facilityLimitingCharge: formatNumber(row.fac_limiting_charge, 2),
    mac: row.mac,
    macDescription: row.mac_description,
    locality: row.locality,
    localityDescription: row.loc_description,
    gpciWork: formatNumber(row.gpci_work, 3),
    gpciPe: formatNumber(row.gpci_pe, 3),
    gpciMp: formatNumber(row.gpci_mp, 3),
  });

  const CSV_COLUMNS = [
    { key: 'year', label: 'Year' },
    { key: 'hcpc', label: 'HCPCS' },
    { key: 'modifier', label: 'Modifier' },
    { key: 'description', label: 'Short Description' },
    { key: 'status', label: 'Status Indicator' },
    { key: 'nonFacilityPrice', label: 'Non-Facility Price' },
    { key: 'facilityPrice', label: 'Facility Price' },
    { key: 'nonFacilityTotalRvu', label: 'Non-Facility Total RVU' },
    { key: 'facilityTotalRvu', label: 'Facility Total RVU' },
    { key: 'nonFacilityLimitingCharge', label: 'Non-Facility Limiting Charge' },
    { key: 'facilityLimitingCharge', label: 'Facility Limiting Charge' },
    { key: 'mac', label: 'MAC' },
    { key: 'macDescription', label: 'MAC Description' },
    { key: 'locality', label: 'Locality Code' },
    { key: 'localityDescription', label: 'Locality Description' },
    { key: 'gpciWork', label: 'GPCI Work' },
    { key: 'gpciPe', label: 'GPCI PE' },
    { key: 'gpciMp', label: 'GPCI MP' },
  ];
  const createCsv = (rows) => {
    const header = CSV_COLUMNS.map((col) => col.label).join(',');
    const lines = rows.map((row) => CSV_COLUMNS.map((col) => {
      const value = row[col.key];
      if (value == null) {
        return '';
      }
      const str = String(value);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','));
    return [header, ...lines].join('\n');
  };

  const fetchFeeSchedule = async ({ hcpcsCode, mac, localityNumber, yearKey = null, includeAllMacs = true }) => {
    if (!hcpcsCode) {
      throw new Error('HCPCS code is required.');
    }
    const catalog = await fetchPfsCatalog();
    const effectiveYearKey = yearKey || selectLatestYearKey(catalog.years);
    if (!effectiveYearKey) {
      throw new Error('Unable to determine an available Physician Fee Schedule year.');
    }
    const yearEntry = catalog.years[effectiveYearKey];
    const { query, normalizedCode } = buildPricingQuery({
      yearKey: effectiveYearKey,
      indicatorId: yearEntry.indicator,
      localityId: yearEntry.locality,
      hcpcsCode,
      includeAllMacs,
      macCode: mac,
      localityCode: formatLocalityCode(mac, localityNumber),
    });

    const searchLabel = `pricing_single_${normalizedCode}`;
    const response = await postDatastoreQuery(searchLabel, query);
    const rows = (response?.results || []).map(normalizePricingRow);
    const csv = createCsv(rows);
    const localityKey = formatLocalityCode(mac, localityNumber);
    const matchingRow = localityKey ? rows.find((row) => row.locality === localityKey) : null;

    return {
      year: effectiveYearKey,
      rows,
      csv,
      matchingRow,
      query,
    };
  };

  window.ThingbertPriceCheck = window.ThingbertPriceCheck || {};
  window.ThingbertPriceCheck.fetchFeeSchedule = fetchFeeSchedule;
  window.ThingbertPriceCheck._fetchPfsCatalog = fetchPfsCatalog;
})();
