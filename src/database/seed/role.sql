insert into public.roles (name)
values ('Admin'), ('Staff'), ('Driver'), ('Passenger')
on conflict (name) do nothing;