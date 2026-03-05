import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhumttwrsfgbhnjwueki.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodW10dHdyc2ZnYmhuand1ZWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDE1MjcsImV4cCI6MjA4ODIxNzUyN30.Elqxc1IS8tt8-7dV9iGZE8eM7XQMt2PBt99pc_08ths'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
