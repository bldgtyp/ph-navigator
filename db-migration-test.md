# Production Database Backup & Migration Testing Plan

Based on your setup (Render.com production + local Docker dev), here's a detailed step-by-step plan to safely test your window builder migrations:

## A) Backup Production Database from Render.com

### Step 1: Access Render Database

1. Log into Render.com dashboard
2. Navigate to your PostgreSQL service
3. Go to "Connect" tab to get connection details

### Step 2: Create Production Backup

```bash
# Option 1: Using pg_dump via Render's connection string
pg_dump $RENDER_DATABASE_URL > production_backup_$(date +%Y%m%d_%H%M%S).sql

# Option 2: If you have the individual connection params
pg_dump -h <render-host> -U <render-user> -d <render-db> -p <render-port> \
  > production_backup_$(date +%Y%m%d_%H%M%S).sql
```

**Questions for you:**

1. Do you have `pg_dump` installed locally, or do you need to install PostgreSQL client tools?
2. Do you have the production `DATABASE_URL` from Render in your local environment (maybe as a separate env var)?

## B) Replicate Production DB Locally & Test Migration

### Step 3: Create New Test Database Container

```bash
# Stop your current dev container to avoid port conflicts
docker stop <your-current-postgres-container>

# Create a new test database container
docker run --name postgres-prod-test \
  -e POSTGRES_DB=ph_nav_prod_test \
  -e POSTGRES_USER=testuser \
  -e POSTGRES_PASSWORD=testpass \
  -p 5433:5432 \
  -d postgres:15
```

### Step 4: Restore Production Data to Test DB

```bash
# Wait for container to be ready
sleep 10

# Restore the production backup
psql -h localhost -p 5433 -U testuser -d ph_nav_prod_test < production_backup_*.sql
```

### Step 5: Update Local Config for Testing

Create a temporary test config:

```bash
# Create backend/.env.test
cp backend/.env backend/.env.test

# Edit .env.test to point to test database
DATABASE_URL=postgresql+psycopg2://testuser:testpass@localhost:5433/ph_nav_prod_test
```

### Step 6: Test Migration on Production Data

```bash
cd backend

# Use test config
export $(cat .env.test | xargs)

# Check current migration state
alembic current

# Show what migrations will run
alembic show <your-new-migration-hash>

# Run the migration on production data copy
alembic upgrade head

# Verify the migration worked
# - Check tables exist
# - Spot check some data
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "SELECT COUNT(*) FROM <your-new-table>;"
```

### Step 7: Test Application Startup

```bash
# Start backend with test DB to ensure no runtime issues
uvicorn main:app --reload

# Test a few key endpoints manually or run relevant tests
curl localhost:8000/health  # or whatever endpoints use new schema
```

### Step 8: Cleanup Test Environment

```bash
# Stop test container
docker stop postgres-prod-test
docker rm postgres-prod-test

# Restart your normal dev container
docker start <your-normal-dev-container>

# Remove test config
rm backend/.env.test
```

## C) Final Production Migration (After Testing)

### Step 9: Merge & Deploy

1. Merge your PR (triggers automatic deploy on Render)
2. Monitor Render deployment logs for migration execution
3. Test production endpoints after deployment

### Step 10: Rollback Plan (If Needed)

```bash
# If something goes wrong, you can restore from backup
psql $RENDER_DATABASE_URL < production_backup_*.sql

# Or rollback migration
alembic downgrade <previous-migration-hash>
```

## Current Migration Details (Window Builder - fd4af8236c7d)

**Migration Scope**: This migration is **PURELY ADDITIVE** - very low risk!

### New Tables Created:

- `aperture_frame_types` - Lookup table for frame type definitions
- `aperture_glazing_types` - Lookup table for glazing type definitions
- `aperture_element_frame` - Frame instances with type references
- `aperture_element_glazing` - Glazing instances with type references
- `apertures` - Main aperture objects with grid dimensions
- `aperture_elements` - Individual elements within aperture grids

### Risk Assessment: **LOW**

- ✅ No existing tables modified
- ✅ No data migrations or transformations
- ✅ All new tables with proper foreign key relationships
- ✅ Clean downgrade path (just drops new tables)
- ✅ No breaking changes to existing functionality

### Simplified Testing Approach

Since this is additive-only, you could even skip the full production backup test and just:

1. **Quick Validation**: Deploy to staging/preview if available
2. **Monitor Logs**: Watch Render deployment logs during migration
3. **Smoke Test**: Verify existing functionality still works
4. **New Feature Test**: Test window builder features work as expected

**However**, if you want maximum confidence, the full backup/test procedure above is still recommended.

## Questions & Clarifications:

1. ✅ **Migration Scope**: Analyzed - purely additive window builder tables (low risk)

2. **Render Migration Trigger**: Does Render automatically run `alembic upgrade head` on deploy, or do you need to trigger it manually?

3. **Downtime Tolerance**: Is brief downtime acceptable, or do you need zero-downtime migration strategies?

4. **Data Volume**: Roughly how much data is in production? (affects backup/restore time)

5. ✅ **Dependencies**: No dependencies - purely additive schema changes

6. **Testing Coverage**: Do you have automated tests that cover the new window builder functionality that we could run against the test DB?

Would you like me to elaborate on any of these steps or adjust the plan based on your answers?
