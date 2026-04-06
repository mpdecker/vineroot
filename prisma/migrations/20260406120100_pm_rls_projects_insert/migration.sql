-- Allow human operator (anon) to create PM projects from the web app
CREATE POLICY pm_projects_insert ON projects FOR INSERT WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT INSERT ON projects TO anon, authenticated;
  END IF;
END $$;
