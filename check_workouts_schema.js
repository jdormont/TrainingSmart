import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env file manually
const envPath = '/Users/jdormont/Apps/TrainingSmart/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    process.env[key.trim()] = value;
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error fetching workouts:', error);
  } else {
    console.log('Workouts columns:');
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log('No rows returned, trying to insert a dummy or check structure...');
      // Let's do a postgrest structure fetch if possible, or print data
      console.log('Returned data empty:', data);
    }
  }
}

run();
