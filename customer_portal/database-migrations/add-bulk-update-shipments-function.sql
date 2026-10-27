-- Bulk update shipments function
-- Performance: batch UPDATE via single RPC call instead of per-row

CREATE OR REPLACE FUNCTION bulk_update_shipments(
  p_data JSON
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_item JSON;
BEGIN
  FOR v_item IN SELECT * FROM json_array_elements(p_data) LOOP
    UPDATE order_shipment
    SET
      shipment_status = COALESCE(
        (v_item->>'shipment_status')::TEXT,
        shipment_status
      ),
      dest_tracking = COALESCE(
        v_item->>'dest_tracking',
        dest_tracking
      ),
      updated_at = NOW()
    WHERE tracking_no = v_item->>'tracking_no';

    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION bulk_update_shipments(JSON) IS
  'Batch update order_shipment via JSON array input';