# Changelog

## 0.4.0

### Added

- `seed-sources`: pluggable seed sources built from config through a registry of factories per kind, ordered
  seed layers (later layers win, blank values inherit, each key records its layer) and machine-profile selection.
  Seed files are read with Node's dotenv grammar. Seed paths are checked against the root lexically and with
  symlinks resolved, before anything is read. The default node adapter reads through `contained-paths`, so a
  folder or file swapped for a symlink between the check and the read is refused.
- `contained-paths`: contained reads (`O_NOFOLLOW` open, `lstat` of every folder after the open, device and inode
  match, read through the descriptor) and the parent-folder symlink check.
- `value-table`: pure, table-driven value resolution from seed keys, derivations and defaults, with origins,
  missing required keys and secret keys. It never reads or patches `process.env`.
- `managed-keys`: key-level check and write for partly managed env files. Only managed assignments change; every
  other byte is kept. Ambiguous managed keys (assigned twice, or inside a multiline value) are refused by name.
  Output carries key names and statuses only.
- `env-assignments`: byte-preserving dotenv scanning with line spans, and dotenv-safe value quoting verified by
  parsing it back with `util.parseEnv`.
- `atomic-file`: atomic, symlink-refusing text file writes that keep the destination's mode and create new files
  owner-only. A symlinked parent folder between the destination's root and the file is refused unless
  `allowSymlinkedParents` is set.
