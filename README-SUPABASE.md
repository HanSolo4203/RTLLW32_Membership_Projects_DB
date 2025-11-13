# Supabase Schema Setup

Follow these steps to provision and keep the Supabase database schema in sync with the project.

## Prerequisites
- Supabase project (local via [Supabase CLI](https://supabase.com/docs/guides/cli) or hosted)
- Node.js for generating TypeScript types (optional but recommended)

## 1. Apply the Database Schema
Run the SQL file against your database. With the Supabase CLI:

```bash
supabase db push --file supabase/schema.sql
```

Or, copy the contents of `supabase/schema.sql` into the Supabase SQL editor and execute.

The script will:
- Ensure required extensions
- Create tables, views, trigger functions, and triggers
- Enable Row Level Security (RLS) with authenticated-user policies

## 2. Generate TypeScript Types
This project keeps canonical types in `supabase/types.ts`. To regenerate after schema changes:

```bash
supabase gen types typescript --linked > supabase/types.ts
```

After regenerating, update helper aliases in `src/types/database.ts` if new tables or views were added.

## 3. Verify RLS Policies
All tables ship with authenticated-only policies. Confirm that your Supabase service role or authenticated client has the correct access level before running migrations in production.

## 4. Optional: Seed Data
If you maintain seed data, apply it after the schema:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seeds.sql
```

## 5. Commit Changes
After confirming the schema applied successfully and types compile, commit the updates:

```bash
git add supabase/schema.sql supabase/types.ts src/types/database.ts README-SUPABASE.md
git commit -m "chore: sync Supabase schema and types"
```

