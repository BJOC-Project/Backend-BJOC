update public.roles
set name = lower(name)
where name <> lower(name);

insert into public.roles (name)
values ('admin'), ('staff'), ('driver'), ('passenger')
on conflict (name) do nothing;
