# NGO ID Refactor - Migration SQL Script

This file contains the complete, production-ready SQL migration for refactoring NGO IDs from email-derived strings to database-generated UUIDs.

## ⚠️ IMPORTANT: Backup First!

```bash
# With Supabase CLI:
supabase db pull  # Creates a backup of your schema

# Or manually backup in Supabase dashboard:
# Settings → Database → Backups → "Save Backup"
```

---

## Full Migration Script

Copy and paste the entire script below into your Supabase SQL Editor (at `supabase.com`):

```sql
-- ============================================================================
-- NGO ID REFACTOR MIGRATION
-- From: email-derived ID (e.g., "john" from "john@mail.com")
-- To: UUID primary key (e.g., "550e8400-e29b-41d4-a716-446655440000")
-- ============================================================================

-- START TRANSACTION
BEGIN;

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================
SELECT 'Step 1: Current state' as step;
SELECT COUNT(*) as ngo_count FROM ngo_accounts;
SELECT COUNT(*) as story_count FROM stories;

-- ============================================================================
-- STEP 2: Add id column with UUID default (if not exists)
-- ============================================================================
SELECT 'Step 2: Add UUID column' as step;

ALTER TABLE ngo_accounts
ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- ============================================================================
-- STEP 3: Add temporary mapping column
-- ============================================================================
SELECT 'Step 3: Add legacy mapping' as step;

ALTER TABLE ngo_accounts
ADD COLUMN IF NOT EXISTS legacy_ngo_id VARCHAR(255);

-- ============================================================================
-- STEP 4: Populate legacy IDs (derive from emails)
-- ============================================================================
SELECT 'Step 4: Populate legacy map' as step;

UPDATE ngo_accounts
SET legacy_ngo_id = SUBSTRING(email FROM 1 FOR POSITION('@' IN email) - 1)
WHERE legacy_ngo_id IS NULL;

-- ============================================================================
-- STEP 5: Detect duplicates in legacy IDs
-- ============================================================================
SELECT 'Step 5: Check for duplicate derived IDs' as step;

-- This query shows any email-prefix duplicates:
SELECT 
  legacy_ngo_id,
  COUNT(*) as count,
  STRING_AGG(email, ', ') as emails
FROM ngo_accounts
GROUP BY legacy_ngo_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- If you have duplicates, you'll need to handle them manually
-- For example: Update one email to be unique before proceeding

-- ============================================================================
-- STEP 6: Update stories table - Add NEW column
-- ============================================================================
SELECT 'Step 6: Add new UUID column to stories' as step;

ALTER TABLE stories
ADD COLUMN IF NOT EXISTS ngo_id_new UUID;

-- ============================================================================
-- STEP 7: Migrate data to new column
-- ============================================================================
SELECT 'Step 7: Migrate story ngo_id to new UUID' as step;

UPDATE stories s
SET ngo_id_new = n.id
FROM ngo_accounts n
WHERE s.ngo_id = SUBSTRING(n.email FROM 1 FOR POSITION('@' IN n.email) - 1);

-- ============================================================================
-- STEP 8: Verify migration success
-- ============================================================================
SELECT 'Step 8: Verify migration' as step;

-- Count stories that were successfully updated
SELECT 
  COUNT(*) as total_stories,
  COUNT(ngo_id_new) as stories_with_new_uuid,
  COUNT(*) - COUNT(ngo_id_new) as stories_not_migrated
FROM stories;

-- If stories_not_migrated > 0, investigate and fix before proceeding
-- This could happen if ngo_id in stories doesn't match any in ngo_accounts

-- ============================================================================
-- STEP 9: View mismatched stories (if any)
-- ============================================================================
SELECT 'Step 9: Check for orphaned stories' as step;

SELECT s.id, s.ngo_id, s.title
FROM stories s
WHERE s.ngo_id_new IS NULL;

-- ============================================================================
-- STEP 10: Use updated data and drop old column
-- ============================================================================
SELECT 'Step 10: Drop old column' as step;

ALTER TABLE stories
DROP COLUMN ngo_id;

ALTER TABLE stories
RENAME COLUMN ngo_id_new TO ngo_id;

-- ============================================================================
-- STEP 11: Set column type and add NOT NULL constraint
-- ============================================================================
SELECT 'Step 11: Set constraints' as step;

ALTER TABLE stories
ALTER COLUMN ngo_id SET NOT NULL;

-- ============================================================================
-- STEP 12: Add foreign key constraint
-- ============================================================================
SELECT 'Step 12: Add foreign key' as step;

ALTER TABLE stories
ADD CONSTRAINT fk_stories_ngo_id
FOREIGN KEY (ngo_id) REFERENCES ngo_accounts(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ============================================================================
-- STEP 13: Clean up legacy mapping
-- ============================================================================
SELECT 'Step 13: Drop legacy mapping' as step;

ALTER TABLE ngo_accounts
DROP COLUMN IF EXISTS legacy_ngo_id;

-- ============================================================================
-- STEP 14: Ensure ngo_accounts.id is primary key
-- ============================================================================
SELECT 'Step 14: Set primary key' as step;

-- Usually this is already set, but verify:
-- ALTER TABLE ngo_accounts
-- ADD PRIMARY KEY (id);  -- Uncomment if needed

-- ============================================================================
-- STEP 15: Final verification
-- ============================================================================
SELECT 'Step 15: Final verification' as step;

SELECT 
  (SELECT COUNT(*) FROM ngo_accounts) as total_ngos,
  (SELECT COUNT(*) FROM stories) as total_stories,
  (SELECT COUNT(*) FROM stories WHERE ngo_id IS NOT NULL) as stories_with_valid_ngo,
  (SELECT COUNT(*) FROM stories WHERE ngo_id IS NULL) as stories_without_ngo
;

-- ============================================================================
-- EXPECTED OUTPUT:
-- total_ngos should > 0
-- total_stories should > 0
-- stories_with_valid_ngo should = total_stories
-- stories_without_ngo should = 0
-- ============================================================================

-- Test foreign key works
SELECT s.id, s.title, n.org_name, n.email
FROM stories s
JOIN ngo_accounts n ON s.ngo_id = n.id
LIMIT 10;

-- COMMIT (or ROLLBACK if there were errors)
COMMIT;
```

---

## Step-by-Step Execution

### Preview Mode (Just Check - Don't Execute)
1. Open Supabase SQL Editor
2. Copy the script
3. Run it (it will show you what would happen)
4. Review the output

### Production Execution
1. **Backup your database first!**
2. Open Supabase SQL Editor
3. Copy the entire script
4. Read through it once more
5. Click "Execute" or Ctrl+Enter
6. Watch for green checkmarks ✓ (success) or red X ✗ (errors)
7. Review the verification queries output

---

## Troubleshooting

### Issue: "duplicate key value violates unique constraint"

**Cause:** Multiple NGOs have the same email prefix.

**Solution:**
```sql
-- Find duplicates:
SELECT SUBSTRING(email FROM 1 FOR POSITION('@' IN email) - 1) as prefix, COUNT(*), STRING_AGG(email, ',')
FROM ngo_accounts
GROUP BY prefix
HAVING COUNT(*) > 1;

-- Update one of them:
UPDATE ngo_accounts
SET email = 'jane.doe@organization.com'
WHERE email = 'john@organization.com';

-- Then re-run migration
```

### Issue: "Some stories have ngo_id_new IS NULL"

**Cause:** A story references an ngo_id that doesn't exist in ngo_accounts.

**Solution:**
```sql
-- See which ones:
SELECT s.id, s.ngo_id, s.title
FROM stories s
WHERE s.ngo_id_new IS NULL;

-- Option A: Delete orphaned stories
DELETE FROM stories WHERE ngo_id_new IS NULL;

-- Option B: Link them to a default NGO
UPDATE stories
SET ngo_id_new = (SELECT id FROM ngo_accounts LIMIT 1)
WHERE ngo_id_new IS NULL;

-- Then continue migration
```

### Issue: Migration ran but stories aren't showing up

**Solution:**
```sql
-- Verify the connection is correct
SELECT s.*, n.org_name
FROM stories s
LEFT JOIN ngo_accounts n ON s.ngo_id = n.id
WHERE s.ngo_id IS NULL;

-- This should return 0 rows if everything is correct
```

---

## Rollback Plan

If something goes wrong and you need to rollback:

```sql
BEGIN;

-- Restore stories.ngo_id to old format (if you have a backup schema)
-- This is database-specific, so consult your backup

ROLLBACK;
```

**Better:** Use Supabase's built-in backup/restore feature in Project Settings.

---

## Testing the Migration in Development First

### Best Practice: Test on a Copy
1. In Supabase, duplicate your project
2. Run this migration on the copy
3. Test thoroughly
4. Then run on production

### Running Tests Post-Migration

```python
# In your backend during tests:

# Test 1: NGO can signup
response = client.post("/auth/ngo/signup", json={
    "orgName": "Test Org",
    "email": "test@example.com",
    "password": "password123"
})
assert response.status_code == 200
assert "ngoId" in response.json()
ngo_id = response.json()["ngoId"]
assert ngo_id != "test"  # Should be UUID, not email-derived!

# Test 2: NGO can login
response = client.post("/auth/ngo/login", json={
    "email": "test@example.com",
    "password": "password123"
})
assert response.status_code == 200
assert response.json()["ngoId"] == ngo_id

# Test 3: NGO can create story
response = client.post("/api/stories", json={
    "ngoId": ngo_id,
    "title": "Test Story",
    "topic": "Stranger Danger",
    "ageGroup": "6-8",
    "language": "English",
    "characterCount": 1,
    "description": "Test description"
})
assert response.status_code == 200

# Test 4: NGO can view own stories (dashboard stats)
response = client.get(f"/api/dashboard/stats?ngo_id={ngo_id}")
assert response.status_code == 200
stats = response.json()
assert stats["storiesCreated"] == 1
```

---

## Post-Migration Checklist

- [ ] Backup created
- [ ] Migration script tested on copy
- [ ] Migration ran successfully on production
- [ ] Verification queries show correct counts
- [ ] No orphaned stories remaining
- [ ] Backend code updated (schemas + main.py)
- [ ] Frontend code updated (optional - already compatible)
- [ ] Test login/signup returns UUID ngoId
- [ ] Test story creation with UUID ngoId
- [ ] Test dashboard stats query
- [ ] Monitor error logs for 24 hours
- [ ] Existing NGOs can all login
- [ ] Existing stories accessible
