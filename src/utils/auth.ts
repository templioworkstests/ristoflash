import { supabase } from '@/lib/supabase'
import { UserRole } from '@/types/database'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    console.error('Auth error:', error)
    return null
  }
  
  // Fetch user profile with role
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  
  if (profileError) {
    console.error('Profile fetch error:', profileError)
    return null
  }
  
  if (!profile) {
    console.error('User profile not found in users table. User ID:', user.id)
    return null
  }
  
  return { ...user, role: profile.role, restaurant_id: profile.restaurant_id }
}

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

export function requireRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole)
}

