-- Create user_streaks table (1:1 with auth.users)
create table if not exists public.user_streaks (
    user_id uuid references auth.users(id) on delete cascade primary key,
    current_streak integer default 0 not null,
    longest_streak integer default 0 not null,
    streak_freezes integer default 0 not null,
    last_activity_date text, -- ISO date string YYYY-MM-DD in user's local time
    streak_history jsonb default '[]'::jsonb, -- Array of history objects
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_streaks enable row level security;

-- Create policies
create policy "Users can view their own streaks"
    on public.user_streaks for select
    using (auth.uid() = user_id);

create policy "Users can insert their own streaks"
    on public.user_streaks for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own streaks"
    on public.user_streaks for update
    using (auth.uid() = user_id);

-- Create trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger on_user_streaks_updated
    before update on public.user_streaks
    for each row execute procedure public.handle_updated_at();

-- Auto-create streak record on user creation (optional, but good for UX)
-- (Skipping specific trigger for separate table for now, service will handle lazy creation if not exists)
