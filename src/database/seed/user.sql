with seeded_admin as (
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
    updated_at = now()
  returning id
)
select id from seeded_admin;

with seeded_staff_one as (
  insert into public.users (
    role_id,
    email,
    password_hash,
    first_name,
    last_name,
    contact,
    status
  )
  select
    roles.id,
    'staff.dispatcher@bjoc.com',
    '$2b$12$7VglM9lAcfmZXXBvlqG1MOSTNRhcJVDdptmjrBM2/RzA4QvoheOsu',
    'Maria',
    'Santos',
    '09170000001',
    'active'::user_status_enum
  from public.roles
  where roles.name = 'staff'
  on conflict (email) do update
  set
    role_id = excluded.role_id,
    password_hash = excluded.password_hash,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact = excluded.contact,
    status = excluded.status,
    updated_at = now()
  returning id
)
insert into public.staff (
  user_id,
  department,
  position
)
select
  seeded_staff_one.id,
  'Operations',
  'Dispatcher'
from seeded_staff_one
on conflict (user_id) do update
set
  department = excluded.department,
  position = excluded.position;

with seeded_staff_two as (
  insert into public.users (
    role_id,
    email,
    password_hash,
    first_name,
    last_name,
    contact,
    status
  )
  select
    roles.id,
    'staff.support@bjoc.com',
    '$2b$12$7VglM9lAcfmZXXBvlqG1MOSTNRhcJVDdptmjrBM2/RzA4QvoheOsu',
    'James',
    'Reyes',
    '09170000002',
    'active'::user_status_enum
  from public.roles
  where roles.name = 'staff'
  on conflict (email) do update
  set
    role_id = excluded.role_id,
    password_hash = excluded.password_hash,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact = excluded.contact,
    status = excluded.status,
    updated_at = now()
  returning id
)
insert into public.staff (
  user_id,
  department,
  position
)
select
  seeded_staff_two.id,
  'Customer Support',
  'Support Staff'
from seeded_staff_two
on conflict (user_id) do update
set
  department = excluded.department,
  position = excluded.position;

with seeded_driver as (
  insert into public.users (
    role_id,
    email,
    password_hash,
    first_name,
    last_name,
    contact,
    status
  )
  select
    roles.id,
    'driver.one@bjoc.com',
    '$2b$12$7VglM9lAcfmZXXBvlqG1MOSTNRhcJVDdptmjrBM2/RzA4QvoheOsu',
    'Carlo',
    'Dela Cruz',
    '09170000003',
    'active'::user_status_enum
  from public.roles
  where roles.name = 'driver'
  on conflict (email) do update
  set
    role_id = excluded.role_id,
    password_hash = excluded.password_hash,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact = excluded.contact,
    status = excluded.status,
    updated_at = now()
  returning id
)
insert into public.drivers (
  user_id,
  license_number,
  status
)
select
  seeded_driver.id,
  'DRV-2026-0001',
  'available'::driver_status_enum
from seeded_driver
on conflict (user_id) do update
set
  license_number = excluded.license_number,
  status = excluded.status;

with seeded_passenger as (
  insert into public.users (
    role_id,
    email,
    password_hash,
    first_name,
    last_name,
    contact,
    status
  )
  select
    roles.id,
    'passenger.one@bjoc.com',
    '$2b$12$7VglM9lAcfmZXXBvlqG1MOSTNRhcJVDdptmjrBM2/RzA4QvoheOsu',
    'Ana',
    'Mendoza',
    '09170000004',
    'active'::user_status_enum
  from public.roles
  where roles.name = 'passenger'
  on conflict (email) do update
  set
    role_id = excluded.role_id,
    password_hash = excluded.password_hash,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact = excluded.contact,
    status = excluded.status,
    updated_at = now()
  returning id
)
insert into public.passengers (
  user_id,
  username,
  status
)
select
  seeded_passenger.id,
  'ana.passenger',
  'active'::user_status_enum
from seeded_passenger
on conflict (user_id) do update
set
  username = excluded.username,
  status = excluded.status;
