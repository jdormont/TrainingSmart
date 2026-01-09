-- Migration: 20260109150000_signup_notification.sql
-- Description: Creates a trigger to send email notifications on new user signup via Edge Function.

-- Enable pg_net extension if not already enabled
create extension if not exists "pg_net";

-- Function to call the Edge Function
create or replace function public.trigger_signup_notification()
returns trigger as $$
declare
  -- IMPORTANT: You must update this URL to match your project's Edge Function URL.
  -- For local development: http://host.docker.internal:54321/functions/v1/send-signup-notification
  -- For production: https://gulsoirivktbwbozuuwp.supabase.co/functions/v1/send-signup-notification
  edge_function_url text := 'https://gulsoirivktbwbozuuwp.supabase.co/functions/v1/send-signup-notification';
  
  -- Service Key is typically needed for authorization, or you can use a specific secret
  -- For webhooks configured via Dashboard, Supabase handles this.
  -- Here we will look for a setting or default to empty (which might fail if not configured)
  service_role_key text;
begin
  -- Try to get the service role key from a custom setting if you have one, 
  -- or you might need to hardcode it or use the Dashboard Webhook instead of this SQL trigger.
  -- service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Send the request
  perform net.http_post(
      url := edge_function_url,
      body := jsonb_build_object(
          'record', row_to_json(NEW),
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  return NEW;
exception when others then
  -- Do not block the insert if notification fails
  raise warning 'Failed to trigger signup notification: %', SQLERRM;
  return NEW;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists on_signup_notification on public.user_profiles;
create trigger on_signup_notification
  after insert on public.user_profiles
  for each row
  execute function public.trigger_signup_notification();
