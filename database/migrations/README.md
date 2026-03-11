# Database migrations

Migrations are **not** auto-executed. They are kept here for reference and for manually upgrading older databases.

- **Current source of truth:** `../schema.sql` — always reflects the latest schema. Use it to create or reset the database.
- To apply the schema: run `schema.sql` against MySQL (or use the app’s database init, which runs the schema only).
- To upgrade an existing DB: run the relevant migration files in order (001, 002, …) as needed. New installs should use `schema.sql` only.
