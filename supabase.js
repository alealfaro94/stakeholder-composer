/**
 * src/lib/supabase.js
 *
 * Supabase client + helper functions for the Stakeholder Composer.
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel
 * Environment Variables (prefixed with VITE_ so Vite exposes them).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Returns null if env vars aren't configured — UI will disable history features
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const supabaseReady = !!supabase;

// ─── Save a sprint update ────────────────────────────────────────
export async function saveUpdate({ formData, outputs, label }) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('sprint_updates')
    .insert({
      project_name: formData.projectName || null,
      sprint:       formData.sprint       || null,
      form_data:    formData,
      outputs,
      label:        label || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Load recent sprint updates ──────────────────────────────────
export async function loadUpdates(limit = 20) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('sprint_updates')
    .select('id, created_at, project_name, sprint, label, outputs')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ─── Load a single update (full form_data + outputs) ─────────────
export async function loadUpdateById(id) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('sprint_updates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Delete a saved update ────────────────────────────────────────
export async function deleteUpdate(id) {
  if (!supabase) return;

  const { error } = await supabase
    .from('sprint_updates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
