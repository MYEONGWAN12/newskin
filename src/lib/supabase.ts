import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnbjojlmmpecsvpovoau.supabase.co';
const supabaseKey = 'sb_publishable_g3aRqoYroc4E81FnWEwgAg_P-x9wUVF';

export const supabase = createClient(supabaseUrl, supabaseKey);
