insert into public.roles (name)
values
  ('admin'),
  ('driver'),
  ('passenger'),
  ('staff')
on conflict (name) do nothing;
