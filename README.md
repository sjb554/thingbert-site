# Thingbert Site

Source for Thingbert.com — a hub for actuarial-flavored data storytelling, briefings, and trend explorations.

## Medicare fee schedule tool

The Medicare explorer pulls from CMS's public Physician Fee Schedule release (currently 2024B). To refresh the local data snapshot, run:

```
python scripts/build_pfs_data.py
```

This downloads the indicator and locality CSV files from CMS, trims the fields we need, and writes compact JSON files under `data/pfs/` for the site to consume.
