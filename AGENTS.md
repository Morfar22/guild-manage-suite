# Project Architecture Rules

- The Cloudflare server entry copies Worker environment bindings into `process.env` before loading the TanStack server entry, because migrated server handlers read runtime secrets through `process.env`.