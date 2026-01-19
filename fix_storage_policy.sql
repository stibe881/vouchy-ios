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
drop policy if exists "Allow authenticated delete" on storage.objects;

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

-- 6. Allow authenticated users to delete files (DELETE) - Required for voucher deletion
create policy "Allow authenticated delete"
on storage.objects for delete
to authenticated
using ( bucket_id = 'vouchers' );

-- 7. Add missing columns to vouchers table
-- This fixes the issue where transaction history is not saved
alter table public.vouchers 
add column if not exists history jsonb default '[]'::jsonb;

alter table public.vouchers 
add column if not exists code text default '';

alter table public.vouchers 
add column if not exists pin text default '';

alter table public.vouchers 
add column if not exists website text default '';

alter table public.vouchers 
add column if not exists image_url_2 text default null;

-- 8. Add push_token to profiles for push notifications
alter table public.profiles 
add column if not exists push_token text default null;

-- 9. Create family_invites table for invitation management
create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  inviter_id uuid references auth.users(id) on delete cascade,
  invitee_email text not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS policies for family_invites
alter table public.family_invites enable row level security;

-- Drop existing policies first to avoid conflicts
drop policy if exists "Users can view invites they sent" on public.family_invites;
drop policy if exists "Users can view invites to their email" on public.family_invites;
drop policy if exists "Users can create invites" on public.family_invites;
drop policy if exists "Users can update invites to their email" on public.family_invites;
drop policy if exists "Users can delete their invites" on public.family_invites;

-- Inviter can see and manage their sent invites
create policy "Users can view invites they sent" on public.family_invites
for select using (auth.uid() = inviter_id);

-- Invitees can see invites sent to their email (using JWT email)
create policy "Users can view invites to their email" on public.family_invites
for select using (
  invitee_email = (auth.jwt() ->> 'email')
);

-- Inviter can insert invites
create policy "Users can create invites" on public.family_invites
for insert with check (auth.uid() = inviter_id);

-- Invitees can update status (accept/reject) using JWT email
create policy "Users can update invites to their email" on public.family_invites
for update using (
  invitee_email = (auth.jwt() ->> 'email')
);

-- Inviter can delete their pending invites
create policy "Users can delete their invites" on public.family_invites
for delete using (auth.uid() = inviter_id);
