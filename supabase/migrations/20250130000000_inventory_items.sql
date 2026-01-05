-- =====================================================
-- INVENTORY ITEMS MODULE
-- Created: 2025-01-30
-- Purpose: Define inventory item policies (master data)
-- Access: Admin / Super Admin only
-- =====================================================

-- =====================================================
-- TABLE: inventory_items
-- Purpose: Master data for inventory items - defines policies, not just data
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  
  -- Step 1: Basic Information
  name text NOT NULL,
  category text NOT NULL, -- User-defined category (free text)
  description text,
  
  -- Step 2: Tracking Rules
  track_quantity boolean NOT NULL DEFAULT true,
  current_quantity integer CHECK (current_quantity IS NULL OR current_quantity >= 0),
  low_stock_threshold integer CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  track_serially boolean NOT NULL DEFAULT false, -- Serial number tracking
  
  -- Step 3: Issuance Rules
  can_be_issued boolean NOT NULL DEFAULT false,
  issue_to text CHECK (issue_to IS NULL OR issue_to IN ('student', 'staff', 'both')),
  must_be_returned boolean NOT NULL DEFAULT false,
  return_duration_days integer CHECK (return_duration_days IS NULL OR return_duration_days > 0),
  
  -- Step 4: Fee Rules (Most Sensitive)
  is_chargeable boolean NOT NULL DEFAULT false,
  charge_type text CHECK (charge_type IS NULL OR charge_type IN ('one_time', 'deposit')),
  charge_amount numeric CHECK (charge_amount IS NULL OR charge_amount >= 0),
  auto_add_to_fees boolean NOT NULL DEFAULT false,
  fee_category text CHECK (fee_category IS NULL OR fee_category IN ('books', 'uniform', 'misc')),
  
  -- Step 5: Internal Controls (Advanced)
  unit_cost numeric CHECK (unit_cost IS NULL OR unit_cost >= 0), -- Internal only
  allow_price_override boolean NOT NULL DEFAULT false, -- Admin only
  internal_notes text,
  
  -- Metadata
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  -- Ensure unique item names per school
  UNIQUE(school_code, name)
);

-- Indexes for school-scoped queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_school_code 
ON inventory_items(school_code, is_active)
WHERE school_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_category 
ON inventory_items(school_code, category, is_active)
WHERE school_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_issuable 
ON inventory_items(school_code, can_be_issued, is_active)
WHERE can_be_issued = true AND school_code IS NOT NULL;

-- Index for low stock alerts
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock 
ON inventory_items(school_code, track_quantity, current_quantity, low_stock_threshold)
WHERE track_quantity = true 
  AND current_quantity IS NOT NULL 
  AND low_stock_threshold IS NOT NULL
  AND school_code IS NOT NULL;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and Super Admins can read all items in their school
CREATE POLICY "inventory_items_read_school"
ON inventory_items
FOR SELECT
USING (
  school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'cb_admin')
);

-- Policy: Admins and Super Admins can insert items in their school
CREATE POLICY "inventory_items_insert_school"
ON inventory_items
FOR INSERT
WITH CHECK (
  school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'cb_admin')
  AND created_by = auth.uid()
);

-- Policy: Admins and Super Admins can update items in their school
CREATE POLICY "inventory_items_update_school"
ON inventory_items
FOR UPDATE
USING (
  school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'cb_admin')
)
WITH CHECK (
  school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'cb_admin')
);

-- Policy: Admins and Super Admins can delete (soft delete via is_active) items in their school
CREATE POLICY "inventory_items_delete_school"
ON inventory_items
FOR UPDATE
USING (
  school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'cb_admin')
)
WITH CHECK (
  school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'cb_admin')
);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_items_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_items_updated_at();

-- =====================================================
-- VALIDATION CONSTRAINTS (Business Rules)
-- =====================================================

-- If can_be_issued is true, issue_to must be set
ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_issue_to_required
CHECK (
  (can_be_issued = false) OR (issue_to IS NOT NULL)
);

-- If must_be_returned is true, return_duration_days must be set
ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_return_duration_required
CHECK (
  (must_be_returned = false) OR (return_duration_days IS NOT NULL)
);

-- If is_chargeable is true, charge_type and charge_amount must be set
ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_charge_details_required
CHECK (
  (is_chargeable = false) OR (charge_type IS NOT NULL AND charge_amount IS NOT NULL)
);

-- If auto_add_to_fees is true, fee_category must be set
ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_fee_category_required
CHECK (
  (auto_add_to_fees = false) OR (fee_category IS NOT NULL)
);

-- If track_quantity is true, current_quantity should be set (but allow NULL for initial setup)
-- If track_serially is true, track_quantity must also be true
ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_serial_tracking_requires_quantity
CHECK (
  (track_serially = false) OR (track_quantity = true)
);

