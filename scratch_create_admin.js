const { createClient } = require('@supabase/supabase-js');

const url = 'https://rbjfyzysactrtwzhyzpr.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiamZ5enlzYWN0cnR3emh5enByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTg2MTAxMiwiZXhwIjoyMTAxNDM3MDEyfQ.NomSSAyI13UrOHXbSYvVYXSx6reo0Dj9OlB_rvXuqnw';

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const email = 'yasserr2025@gmail.com';
  const password = '123456';
  const fullName = 'ياسر - مدير النظام';

  console.log('Connecting to Supabase...');

  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('List users error:', listError);
    return;
  }

  let existing = users?.users?.find(u => u.email === email);
  let userId;

  if (!existing) {
    console.log('Creating user in Auth...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (createError) {
      console.error('Create user error:', createError);
      return;
    }
    userId = newUser.user.id;
    console.log('User created with ID:', userId);
  } else {
    userId = existing.id;
    console.log('User already exists with ID:', userId);
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) console.error('Update password error:', updateError);
    else console.log('Password updated successfully to 123456.');
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .upsert({ user_id: userId, full_name: fullName, is_active: true });

  if (adminError) console.error('Admin users upsert error:', adminError);
  else console.log('Admin user permissions granted in admin_users table successfully!');
}

main();
