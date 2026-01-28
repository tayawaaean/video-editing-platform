import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

// Types for our user
export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  role: 'submitter' | 'reviewer' | 'admin';
  created_at: string;
}

// Create Supabase client for server-side queries
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Get user by email from Supabase users table
export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) {
    return null;
  }

  return data as DbUser;
}

// Get user by ID from Supabase users table
export async function getUserById(id: string): Promise<DbUser | null> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as DbUser;
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash password (for seeding users)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await getUserByEmail(credentials.email);
        
        if (!user) {
          throw new Error('Invalid email or password');
        }

        const isValid = await verifyPassword(credentials.password, user.password_hash);
        
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Return user object (will be encoded in JWT)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { email: string }).email = token.email as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
