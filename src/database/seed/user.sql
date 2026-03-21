insert into public.users (
  role_id,
  email,
  password_hash,
  first_name,
  last_name,
  status
)
select
  roles.id,
  'admin@bjoc.com',
  '$2b$12$7VglM9lAcfmZXXBvlqG1MOSTNRhcJVDdptmjrBM2/RzA4QvoheOsu',
  'System',
  'Admin',
  'active'::user_status_enum
from public.roles
where roles.name = 'admin'
on conflict (email) do update
set
  role_id = excluded.role_id,
  password_hash = excluded.password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  status = excluded.status,
  updated_at = now();
