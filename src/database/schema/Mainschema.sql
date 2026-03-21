create extension if not exists pgcrypto;

create type user_status_enum as enum ('active', 'inactive', 'suspended');
create type vehicle_status_enum as enum ('offline', 'available', 'on_route', 'maintenance');
create type driver_status_enum as enum ('offline', 'available', 'driving', 'suspended');
create type trip_status_enum as enum ('scheduled', 'ongoing', 'completed', 'cancelled');
create type passenger_trip_status_enum as enum ('booked', 'waiting', 'onboard', 'completed', 'cancelled');

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null,
  email text not null unique,
  password_hash text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  profile_url text,
  contact text,
  status user_status_enum not null default 'active',
  suspended_until timestamptz,
  suspension_reason text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_fk foreign key (role_id) references public.roles(id)
);

create index users_role_id_idx on public.users(role_id);
create index users_status_idx on public.users(status);

create table public.drivers (
  user_id uuid primary key,
  license_number text unique,
  status driver_status_enum not null default 'offline',
  last_active timestamptz,
  created_at timestamptz not null default now(),
  constraint drivers_user_fk foreign key (user_id) references public.users(id) on delete cascade
);

create index drivers_status_idx on public.drivers(status);

create table public.passengers (
  user_id uuid primary key,
  username text unique,
  status user_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  constraint passengers_user_fk foreign key (user_id) references public.users(id) on delete cascade
);

create index passengers_status_idx on public.passengers(status);

create table public.staff (
  user_id uuid primary key,
  department text,
  position text,
  created_at timestamptz not null default now(),
  constraint staff_user_fk foreign key (user_id) references public.users(id) on delete cascade
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text unique,
  model text,
  capacity int,
  status vehicle_status_enum not null default 'offline',
  created_at timestamptz not null default now()
);

create index vehicles_status_idx on public.vehicles(status);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  route_name text not null,
  start_location text,
  end_location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index routes_is_active_idx on public.routes(is_active);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  stop_name text,
  latitude double precision,
  longitude double precision,
  stop_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stops_route_fk foreign key (route_id) references public.routes(id) on delete cascade,
  constraint stops_unique_order unique (route_id, stop_order)
);

create index stops_route_id_idx on public.stops(route_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  vehicle_id uuid,
  driver_user_id uuid,
  assigned_by uuid,
  trip_date date not null,
  scheduled_departure_time timestamptz not null,
  start_time timestamptz,
  end_time timestamptz,
  status trip_status_enum not null default 'scheduled',
  created_at timestamptz not null default now(),
  constraint trips_route_fk foreign key (route_id) references public.routes(id),
  constraint trips_vehicle_fk foreign key (vehicle_id) references public.vehicles(id) on delete set null,
  constraint trips_driver_fk foreign key (driver_user_id) references public.users(id) on delete set null,
  constraint trips_assigned_by_fk foreign key (assigned_by) references public.users(id) on delete set null
);

create index trips_route_id_idx on public.trips(route_id);
create index trips_vehicle_id_idx on public.trips(vehicle_id);
create index trips_driver_user_id_idx on public.trips(driver_user_id);
create index trips_status_trip_date_idx on public.trips(status, trip_date);

create table public.vehicle_locations (
  vehicle_id uuid primary key,
  latitude double precision,
  longitude double precision,
  current_stop_id uuid,
  updated_at timestamptz not null default now(),
  constraint vehicle_locations_vehicle_fk foreign key (vehicle_id) references public.vehicles(id) on delete cascade,
  constraint vehicle_locations_stop_fk foreign key (current_stop_id) references public.stops(id) on delete set null
);

create index vehicle_locations_current_stop_id_idx on public.vehicle_locations(current_stop_id);

create table public.gps_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid,
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz not null default now(),
  constraint gps_logs_vehicle_fk foreign key (vehicle_id) references public.vehicles(id) on delete cascade
);

create index gps_logs_vehicle_recorded_at_idx on public.gps_logs(vehicle_id, recorded_at);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  description text,
  target_user_id uuid,
  performed_by uuid,
  module text,
  created_at timestamptz not null default now(),
  constraint activity_logs_target_fk foreign key (target_user_id) references public.users(id) on delete set null,
  constraint activity_logs_performed_by_fk foreign key (performed_by) references public.users(id) on delete set null
);

create index activity_logs_module_idx on public.activity_logs(module);
create index activity_logs_performed_by_idx on public.activity_logs(performed_by);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_user_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_target_fk foreign key (target_user_id) references public.users(id) on delete cascade
);

create index notifications_target_read_idx on public.notifications(target_user_id, is_read);
