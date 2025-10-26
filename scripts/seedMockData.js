/**
 * MOCK DATA SEEDER - Browser Console Version
 *
 * INSTRUCTIONS:
 * 1. Open http://localhost:3001 in your browser
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this ENTIRE file
 * 5. Press Enter
 * 6. Call: seedMockData()
 * 7. Refresh the page and login with test credentials
 */

async function seedMockData() {
  console.log('🌱 Starting Golden Bridge Mock Data Seeding...\n');

  // Ask if user wants to clear existing data
  const clearData = confirm('⚠️ Clear all existing data before seeding?\n\n(Click OK to delete all current users/programs/data)');

  if (clearData) {
    console.log('🧹 Clearing existing data...');
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('gbw_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('✅ Existing data cleared\n');
  }

  // Helper function to hash password (same as app)
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Helper to generate UUID
  function uuid() {
    return crypto.randomUUID();
  }

  // Create users
  const users = [];

  console.log('👤 Creating Admin...');
  const admin = {
    id: uuid(),
    name: 'Sarah Admin',
    email: 'admin@goldenbridge.org',
    passwordHash: await hashPassword('Admin123!'),
    role: 'admin',
    programIds: [],
    managedProgramIds: [],
    createdAt: new Date().toISOString(),
  };
  users.push(admin);
  console.log(`✅ Admin: ${admin.email} / Admin123!`);

  console.log('\n👥 Creating Program Managers...');
  const emily = {
    id: uuid(),
    name: 'Emily Program Manager',
    email: 'emily.manager@goldenbridge.org',
    passwordHash: await hashPassword('Manager123!'),
    role: 'program_manager',
    programIds: [],
    managedProgramIds: [],
    createdAt: new Date().toISOString(),
  };
  users.push(emily);
  console.log(`✅ Manager: ${emily.email} / Manager123!`);

  const michael = {
    id: uuid(),
    name: 'Michael Program Manager',
    email: 'michael.manager@goldenbridge.org',
    passwordHash: await hashPassword('Manager123!'),
    role: 'program_manager',
    programIds: [],
    managedProgramIds: [],
    createdAt: new Date().toISOString(),
  };
  users.push(michael);
  console.log(`✅ Manager: ${michael.email} / Manager123!`);

  console.log('\n👥 Creating Participants...');
  const participants = [
    { name: 'Jessica Williams', email: 'jessica.w@example.com' },
    { name: 'Maria Garcia', email: 'maria.g@example.com' },
    { name: 'Aisha Johnson', email: 'aisha.j@example.com' },
    { name: 'Priya Patel', email: 'priya.p@example.com' },
    { name: 'Sophia Chen', email: 'sophia.c@example.com' },
  ];

  for (const p of participants) {
    const user = {
      id: uuid(),
      name: p.name,
      email: p.email,
      passwordHash: await hashPassword('Participant123!'),
      role: 'participant',
      programIds: [],
      managedProgramIds: [],
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    console.log(`✅ Participant: ${user.email} / Participant123!`);
  }

  // Save users
  localStorage.setItem('gbw_users_v2', JSON.stringify(users));

  // Create Programs
  console.log('\n📋 Creating Programs...');
  const programs = [];

  const program1 = {
    id: uuid(),
    name: 'Women in Tech Leadership 2025',
    description: 'A 6-month mentorship program focused on developing technical leadership skills and career advancement for women in technology.',
    managerIds: [emily.id],
    participantIds: [users[3].id, users[4].id, users[5].id], // Jessica, Maria, Aisha
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    status: 'active',
    createdBy: emily.id,
    createdAt: new Date().toISOString(),
  };
  programs.push(program1);
  console.log(`✅ Program: ${program1.name}`);

  // Update Emily's managed programs
  emily.managedProgramIds.push(program1.id);

  // Update participants' program associations
  users[3].programIds.push(program1.id);
  users[4].programIds.push(program1.id);
  users[5].programIds.push(program1.id);

  const program2 = {
    id: uuid(),
    name: 'Entrepreneurship Accelerator',
    description: 'An intensive 12-week program supporting women entrepreneurs in launching and scaling their startups.',
    managerIds: [michael.id],
    participantIds: [users[5].id, users[6].id, users[7].id], // Aisha, Priya, Sophia (Aisha in both)
    startDate: '2025-02-01',
    endDate: '2025-04-30',
    status: 'active',
    createdBy: michael.id,
    createdAt: new Date().toISOString(),
  };
  programs.push(program2);
  console.log(`✅ Program: ${program2.name}`);

  // Update Michael's managed programs
  michael.managedProgramIds.push(program2.id);

  // Update participants' program associations
  users[5].programIds.push(program2.id); // Aisha in both programs
  users[6].programIds.push(program2.id);
  users[7].programIds.push(program2.id);

  // Save programs
  localStorage.setItem('gbw_programs', JSON.stringify(programs));

  // Update users with program associations
  localStorage.setItem('gbw_users_v2', JSON.stringify(users));

  // Create Spending Cycles
  console.log('\n💰 Creating spending cycles...');
  for (let i = 3; i < users.length; i++) {
    const user = users[i];
    const cycle = {
      id: uuid(),
      startDate: '2025-01-01',
      endDate: '2025-06-30',
      budget: 2500.00,
      expenses: [],
      isActive: true,
    };

    // Add some expenses to first 3 participants
    if (i < 6) {
      const mockExpenses = [
        { item: 'Python Programming Books', amount: 89.99, category: 'Education' },
        { item: 'Online Course: AWS Certification', amount: 199.00, category: 'Education' },
        { item: 'Tech Conference Registration', amount: 450.00, category: 'Professional Development' },
        { item: 'Laptop Accessories', amount: 125.50, category: 'Equipment' },
        { item: 'Networking Event Tickets', amount: 75.00, category: 'Networking' },
      ];

      const numExpenses = Math.floor(Math.random() * 3) + 2;
      for (let j = 0; j < numExpenses; j++) {
        const expense = mockExpenses[j];
        const randomDay = Math.floor(Math.random() * 28) + 1;
        cycle.expenses.push({
          id: uuid(),
          date: `2025-01-${randomDay.toString().padStart(2, '0')}`,
          category: expense.category,
          item: expense.item,
          amount: expense.amount,
          contact: '',
          remarks: 'Mock expense for testing',
          receiptUrl: null,
        });
      }
      console.log(`✅ Created cycle with ${numExpenses} expenses for ${user.name}`);
    } else {
      console.log(`✅ Created empty cycle for ${user.name}`);
    }

    localStorage.setItem(`gbw_cycles_${user.id}`, JSON.stringify([cycle]));
  }

  // Create Milestones
  console.log('\n🎯 Creating milestones...');
  const milestoneTemplates = [
    {
      title: 'Complete Leadership Assessment',
      description: 'Take the 360-degree leadership assessment to identify strengths and development areas.',
      category: 'Personal Development',
      duration: 14,
    },
    {
      title: 'Build Technical Portfolio',
      description: 'Create or update your technical portfolio showcasing 3-5 key projects.',
      category: 'Career Development',
      duration: 30,
    },
    {
      title: 'Mentor a Junior Developer',
      description: 'Find and mentor a junior developer for at least 2 hours per week.',
      category: 'Community',
      duration: 90,
    },
  ];

  // Add milestones to Program 1 participants (Jessica, Maria, Aisha)
  for (let i = 3; i <= 5; i++) {
    const user = users[i];
    const milestones = [];

    for (let j = 0; j < 2; j++) {
      const template = milestoneTemplates[j];
      const startDate = new Date(2025, 0, 15 + (j * 20));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + template.duration);

      milestones.push({
        id: uuid(),
        title: template.title,
        description: template.description,
        category: template.category,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        status: j === 0 ? 'completed' : 'not_started',
        progressReports: [],
        completedDate: j === 0 ? startDate.toISOString() : null,
        programId: program1.id,
        assignmentInfo: {
          assignedBy: emily.id,
          assignedDate: '2025-01-01',
          isRequired: true,
          canDecline: true,
          status: 'accepted',
        },
        managerFeedback: [],
      });
    }

    localStorage.setItem(`gbw_milestones_${user.id}`, JSON.stringify(milestones));
    console.log(`✅ Created ${milestones.length} milestones for ${user.name}`);
  }

  // Print Summary
  console.log('\n' + '='.repeat(70));
  console.log('✅ MOCK DATA SEEDING COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log('   • 1 Admin account');
  console.log('   • 2 Program Managers');
  console.log('   • 5 Participants');
  console.log('   • 2 Programs (with participants assigned)');
  console.log('   • Spending cycles with mock expenses');
  console.log('   • Assigned milestones');

  console.log('\n🔐 Test Credentials:');
  console.log('\n  ADMIN:');
  console.log('    Email: admin@goldenbridge.org');
  console.log('    Password: Admin123!');
  console.log('    Access Code: ADMIN2024');

  console.log('\n  PROGRAM MANAGER #1 (Emily):');
  console.log('    Email: emily.manager@goldenbridge.org');
  console.log('    Password: Manager123!');
  console.log('    Access Code: MANAGER2024');
  console.log('    Manages: Women in Tech Leadership 2025');

  console.log('\n  PROGRAM MANAGER #2 (Michael):');
  console.log('    Email: michael.manager@goldenbridge.org');
  console.log('    Password: Manager123!');
  console.log('    Access Code: MANAGER2024');
  console.log('    Manages: Entrepreneurship Accelerator');

  console.log('\n  PARTICIPANTS (all use same password):');
  console.log('    jessica.w@example.com - In Tech Leadership program');
  console.log('    maria.g@example.com - In Tech Leadership program');
  console.log('    aisha.j@example.com - In BOTH programs');
  console.log('    priya.p@example.com - In Entrepreneurship program');
  console.log('    sophia.c@example.com - In Entrepreneurship program');
  console.log('    Password for all: Participant123!');

  console.log('\n💡 Next Steps:');
  console.log('   1. Refresh the page (F5 or Cmd+R)');
  console.log('   2. Click "Sign Up" or "Login"');
  console.log('   3. Use any credentials above');
  console.log('   4. Explore different user roles!');
  console.log('\n' + '='.repeat(70) + '\n');

  alert('✅ Mock data created successfully!\n\nRefresh the page (F5) and login with:\n\nAdmin: admin@goldenbridge.org / Admin123!\nManager: emily.manager@goldenbridge.org / Manager123!\nParticipant: jessica.w@example.com / Participant123!');

  return {
    users,
    programs,
    message: 'Seeding complete! Refresh the page to login.',
  };
}

console.log('✅ Mock data seeder loaded!');
console.log('📝 Run: seedMockData()');
console.log('');
