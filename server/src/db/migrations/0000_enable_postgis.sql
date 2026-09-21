-- Enables PostGIS for geographic queries (city boundaries, provider search).
-- No spatial columns exist yet; later sprints add them where needed.
-- Requires a role allowed to create extensions (a superuser locally, or e.g.
-- rds_superuser on a managed database).
CREATE EXTENSION IF NOT EXISTS postgis;
