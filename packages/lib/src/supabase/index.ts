export { createClient } from '@supabase/supabase-js'
/** Re-exported so apps can type a session without depending on supabase-js directly. */
export type { Session, User } from '@supabase/supabase-js'
export * from './auth'
