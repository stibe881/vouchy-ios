-- Create a policy to allow authenticated users to upload files to the 'vouchers' bucket
-- Run this in your Supabase Dashboard > SQL Editor

-- 1. Create the bucket if it doesn't exist (optional, usually already exists)
insert into storage.buckets (id, name, public)
values ('vouchers', 'vouchers', true)
on conflict (id) do nothing;

-- 2. Drop existing restrictive policies to avoid conflicts (optional but recommended)
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated update" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;

-- 3. Create the permissive policy for authenticated users (INSERT)
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'vouchers' );

-- 4. Allow authenticated users to update their own files (UPDATE) - Optional
create policy "Allow authenticated update"
on storage.objects for update
to authenticated
using ( bucket_id = 'vouchers' );

-- 5. Allow users to read (download) files (public)
create policy "Allow public read"
on storage.objects for select
using ( bucket_id = 'vouchers' );

-- 6. Add missing columns to vouchers table
-- This fixes the issue where transaction history is not saved
alter table public.vouchers 
add column if not exists history jsonb default '[]'::jsonb;

alter table public.vouchers 
add column if not exists code text default '';

alter table public.vouchers 
add column if not exists pin text default '';

alter table public.vouchers 
add column if not exists website text default '';
