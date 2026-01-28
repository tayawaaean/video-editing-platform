import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getAllUsers, getUserBySupabaseUid, createUser } from '@/lib/airtable';
import { updateUserRoleSchema, createUserSchema } from '@/lib/validations';
import type { User } from '@/types';

// GET /api/admin/users - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    // Simple auth - check Supabase session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    
    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from Airtable
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    // Only admins can access this endpoint
    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Always fetch from Airtable
    const users = await getAllUsers();

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/users - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    // Simple auth - check Supabase session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    
    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from Airtable
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    // Only admins can create users
    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, role } = validationResult.data;

    // Verify service role key is set
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not found. Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    // Create admin client with service role key (bypasses all RLS and restrictions)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if email already exists
    const { data: existingAuthUser, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      // Continue anyway - might be a permission issue but we'll try to create
    } else {
      const emailExists = existingAuthUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so user can login immediately
    });

    if (authError) {
      console.error('Error creating user in Supabase:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        serviceRoleKeySet: !!serviceRoleKey,
        serviceRoleKeyLength: serviceRoleKey?.length,
      });
      
      // Provide helpful error messages
      if (authError.code === 'not_admin' || authError.status === 403) {
        return NextResponse.json(
          { error: 'Service role key is invalid or does not have admin permissions. Please check your SUPABASE_SERVICE_ROLE_KEY in .env.local' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: authError.message || 'Failed to create user in Supabase Auth' },
        { status: 500 }
      );
    }

    if (!authData?.user) {
      console.error('No user data returned from Supabase');
      return NextResponse.json(
        { error: 'Failed to create user: No user data returned' },
        { status: 500 }
      );
    }

    const supabase_uid = authData.user.id;

    // Check if user already exists in Airtable (shouldn't happen, but just in case)
    const existingAirtableUser = await getUserBySupabaseUid(supabase_uid);

    if (existingAirtableUser) {
      // Rollback: delete the Supabase user we just created
      await supabaseAdmin.auth.admin.deleteUser(supabase_uid);
      return NextResponse.json(
        { error: 'User already exists in Airtable' },
        { status: 409 }
      );
    }

    // Create new user in Airtable
    const newUser = await createUser({
      supabase_uid,
      email,
      role,
    });

    return NextResponse.json({ data: newUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
