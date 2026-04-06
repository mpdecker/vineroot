-- Human operator appends audit rows when resolving gates from the browser
CREATE POLICY pm_audit_insert ON audit_log FOR INSERT WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT INSERT ON audit_log TO anon, authenticated;
  END IF;
END $$;
