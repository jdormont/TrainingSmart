-- Add calendar_token to user_profiles
alter table public.user_profiles 
add column calendar_token text unique;

-- Create index for faster lookup since we query by token often
create index user_profiles_calendar_token_idx on public.user_profiles (calendar_token);
