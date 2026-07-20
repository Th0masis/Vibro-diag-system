-- Make sensor channel uniqueness globally unique by module_path + channel_no.
-- Previous rule: UNIQUE(id_machine, channel_no)
-- New rule: UNIQUE active assignment by (module_path, channel_no) globally across all machines

ALTER TABLE sensors DROP CONSTRAINT IF EXISTS sensors_id_machine_channel_no_key;
DROP INDEX IF EXISTS idx_sensors_machine_channel_unique;
DROP INDEX IF EXISTS idx_sensors_machine_module_channel_unique;

CREATE UNIQUE INDEX idx_sensors_module_channel_unique
ON sensors (module_path, channel_no)
WHERE deleted_at IS NULL AND channel_no IS NOT NULL;
