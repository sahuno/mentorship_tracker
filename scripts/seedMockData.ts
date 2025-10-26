/**
 * Mock Data Seeding Script for Golden Bridge Spending Tracker
 *
 * This script creates realistic test data including:
 * - 1 Admin user
 * - 2 Program Managers
 * - 5 Participants
 * - 2 Programs with participants assigned
 * - Milestones and assignments
 * - Expenses with mock data
 *
 * Usage: Run this in the browser console on http://localhost:3001
 * Copy and paste the entire script, then call: await seedMockData()
 */

import { UserRole } from '../types';

// Mock user credentials (for easy login during testing)
const MOCK_USERS = {
  admin: {
    name: 'Sarah Admin',
    email: 'admin@goldenbridge.org',
    password: 'Admin123!',
    role: UserRole.ADMIN,
  },
  managers: [
    {
      name: 'Emily Program Manager',
      email: 'emily.manager@goldenbridge.org',
      password: 'Manager123!',
      role: UserRole.PROGRAM_MANAGER,
    },
    {
      name: 'Michael Program Manager',
      email: 'michael.manager@goldenbridge.org',
      password: 'Manager123!',
      role: UserRole.PROGRAM_MANAGER,
    },
  ],
  participants: [
    {
      name: 'Jessica Williams',
      email: 'jessica.w@example.com',
      password: 'Participant123!',
      role: UserRole.PARTICIPANT,
    },
    {
      name: 'Maria Garcia',
      email: 'maria.g@example.com',
      password: 'Participant123!',
      role: UserRole.PARTICIPANT,
    },
    {
      name: 'Aisha Johnson',
      email: 'aisha.j@example.com',
      password: 'Participant123!',
      role: UserRole.PARTICIPANT,
    },
    {
      name: 'Priya Patel',
      email: 'priya.p@example.com',
      password: 'Participant123!',
      role: UserRole.PARTICIPANT,
    },
    {
      name: 'Sophia Chen',
      email: 'sophia.c@example.com',
      password: 'Participant123!',
      role: UserRole.PARTICIPANT,
    },
  ],
};

const MOCK_PROGRAMS = [
  {
    name: 'Women in Tech Leadership 2025',
    description: 'A 6-month mentorship program focused on developing technical leadership skills and career advancement for women in technology.',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
  },
  {
    name: 'Entrepreneurship Accelerator',
    description: 'An intensive 12-week program supporting women entrepreneurs in launching and scaling their startups.',
    startDate: '2025-02-01',
    endDate: '2025-04-30',
  },
];

const MOCK_MILESTONES = [
  // Tech Leadership Program
  {
    title: 'Complete Leadership Assessment',
    description: 'Take the 360-degree leadership assessment to identify strengths and development areas.',
    category: 'Personal Development',
    duration: 14, // days
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
  {
    title: 'Present at Tech Meetup',
    description: 'Prepare and deliver a 20-minute presentation at a local tech meetup.',
    category: 'Public Speaking',
    duration: 45,
  },
  // Entrepreneurship Program
  {
    title: 'Business Model Canvas',
    description: 'Complete a comprehensive business model canvas for your startup idea.',
    category: 'Business Planning',
    duration: 7,
  },
  {
    title: 'Customer Discovery Interviews',
    description: 'Conduct 20 customer discovery interviews and document insights.',
    category: 'Market Research',
    duration: 21,
  },
  {
    title: 'MVP Development',
    description: 'Build and launch a minimum viable product (MVP) for your startup.',
    category: 'Product Development',
    duration: 60,
  },
  {
    title: 'Pitch Deck Preparation',
    description: 'Create a professional pitch deck for investor presentations.',
    category: 'Fundraising',
    duration: 14,
  },
];

const MOCK_EXPENSES = [
  { item: 'Python Programming Books', amount: 89.99, category: 'Education' },
  { item: 'Online Course: AWS Certification', amount: 199.00, category: 'Education' },
  { item: 'Tech Conference Registration', amount: 450.00, category: 'Professional Development' },
  { item: 'Laptop Accessories', amount: 125.50, category: 'Equipment' },
  { item: 'Networking Event Tickets', amount: 75.00, category: 'Networking' },
  { item: 'Software Subscriptions', amount: 49.99, category: 'Tools' },
  { item: 'Business Cards', amount: 35.00, category: 'Marketing' },
  { item: 'Co-working Space Monthly', amount: 250.00, category: 'Office' },
  { item: 'Marketing Materials', amount: 180.00, category: 'Marketing' },
  { item: 'Professional Headshots', amount: 200.00, category: 'Professional Development' },
];

async function seedMockData() {
  console.log('🌱 Starting mock data seeding...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  const clearData = confirm('Clear all existing data before seeding? (This will delete all current users, programs, etc.)');
  if (clearData) {
    console.log('🧹 Clearing existing data...');
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('gbw_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('✅ Existing data cleared');
  }

  const UserManager = (await import('../utils/userManager')).default;
  const ProgramManager = (await import('../utils/programManager')).default;

  const createdUsers: { [key: string]: any } = {};
  const createdPrograms: any[] = [];

  // Helper function to hash password
  async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  try {
    // Create Admin
    console.log('👤 Creating Admin user...');
    const adminHash = await hashPassword(MOCK_USERS.admin.password);
    const admin = await UserManager.createUser(
      MOCK_USERS.admin.name,
      MOCK_USERS.admin.email,
      MOCK_USERS.admin.password,
      MOCK_USERS.admin.role
    );
    createdUsers.admin = admin;
    console.log(`✅ Admin created: ${admin.email}`);

    // Create Program Managers
    console.log('\n👥 Creating Program Managers...');
    for (const manager of MOCK_USERS.managers) {
      const user = await UserManager.createUser(
        manager.name,
        manager.email,
        manager.password,
        manager.role
      );
      createdUsers[manager.email] = user;
      console.log(`✅ Manager created: ${user.email}`);
    }

    // Create Participants
    console.log('\n👥 Creating Participants...');
    for (const participant of MOCK_USERS.participants) {
      const user = await UserManager.createUser(
        participant.name,
        participant.email,
        participant.password,
        participant.role
      );
      createdUsers[participant.email] = user;
      console.log(`✅ Participant created: ${user.email}`);
    }

    // Create Programs
    console.log('\n📋 Creating Programs...');
    const manager1 = createdUsers[MOCK_USERS.managers[0].email];
    const manager2 = createdUsers[MOCK_USERS.managers[1].email];

    // Program 1: Tech Leadership (managed by Emily)
    const program1 = ProgramManager.createProgram(
      MOCK_PROGRAMS[0].name,
      MOCK_PROGRAMS[0].description,
      MOCK_PROGRAMS[0].startDate,
      MOCK_PROGRAMS[0].endDate,
      manager1.id,
      [manager1.id]
    );
    createdPrograms.push(program1);
    console.log(`✅ Program created: ${program1.name}`);

    // Program 2: Entrepreneurship (managed by Michael)
    const program2 = ProgramManager.createProgram(
      MOCK_PROGRAMS[1].name,
      MOCK_PROGRAMS[1].description,
      MOCK_PROGRAMS[1].startDate,
      MOCK_PROGRAMS[1].endDate,
      manager2.id,
      [manager2.id]
    );
    createdPrograms.push(program2);
    console.log(`✅ Program created: ${program2.name}`);

    // Assign Participants to Programs
    console.log('\n🔗 Assigning participants to programs...');

    // Program 1: First 3 participants
    const program1Participants = MOCK_USERS.participants.slice(0, 3);
    for (const participant of program1Participants) {
      const user = createdUsers[participant.email];
      ProgramManager.addParticipantToProgram(program1.id, user.id);
      console.log(`✅ Added ${user.name} to ${program1.name}`);
    }

    // Program 2: Last 3 participants (with 1 overlap)
    const program2Participants = MOCK_USERS.participants.slice(2, 5);
    for (const participant of program2Participants) {
      const user = createdUsers[participant.email];
      ProgramManager.addParticipantToProgram(program2.id, user.id);
      console.log(`✅ Added ${user.name} to ${program2.name}`);
    }

    // Create Spending Cycles for Participants
    console.log('\n💰 Creating spending cycles...');
    for (const participant of MOCK_USERS.participants) {
      const user = createdUsers[participant.email];
      const cycleKey = `gbw_cycles_${user.id}`;

      const cycle = {
        id: crypto.randomUUID(),
        startDate: '2025-01-01',
        endDate: '2025-06-30',
        budget: 2500.00,
        expenses: [],
        isActive: true,
      };

      localStorage.setItem(cycleKey, JSON.stringify([cycle]));
      console.log(`✅ Spending cycle created for ${user.name}`);
    }

    // Add Mock Expenses to some participants
    console.log('\n💵 Adding mock expenses...');
    const participantsWithExpenses = MOCK_USERS.participants.slice(0, 3);

    for (const participant of participantsWithExpenses) {
      const user = createdUsers[participant.email];
      const cycleKey = `gbw_cycles_${user.id}`;
      const cycles = JSON.parse(localStorage.getItem(cycleKey) || '[]');

      if (cycles.length > 0) {
        const activeCycle = cycles[0];

        // Add 3-5 random expenses
        const numExpenses = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < numExpenses; i++) {
          const mockExpense = MOCK_EXPENSES[Math.floor(Math.random() * MOCK_EXPENSES.length)];
          const randomDate = new Date(2025, Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1);

          activeCycle.expenses.push({
            id: crypto.randomUUID(),
            date: randomDate.toISOString().split('T')[0],
            category: mockExpense.category,
            item: mockExpense.item,
            amount: mockExpense.amount,
            contact: '',
            remarks: 'Mock data for testing',
            receiptUrl: null,
          });
        }

        localStorage.setItem(cycleKey, JSON.stringify(cycles));
        console.log(`✅ Added ${numExpenses} expenses for ${user.name}`);
      }
    }

    // Create Milestones
    console.log('\n🎯 Creating milestones and assignments...');

    // Assign milestones to Program 1 participants
    const program1ParticipantUsers = program1Participants.map(p => createdUsers[p.email]);
    for (const user of program1ParticipantUsers) {
      const milestoneKey = `gbw_milestones_${user.id}`;
      const milestones = [];

      // Add 2-3 milestones per participant
      const milestonesToAdd = MOCK_MILESTONES.slice(0, 4);
      const numMilestones = Math.floor(Math.random() * 2) + 2;

      for (let i = 0; i < numMilestones; i++) {
        const template = milestonesToAdd[i];
        const startDate = new Date(2025, 0, 15 + (i * 20));
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + template.duration);

        const milestone = {
          id: crypto.randomUUID(),
          title: template.title,
          description: template.description,
          category: template.category,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'not_started',
          progressReports: [],
          completedDate: i === 0 ? startDate.toISOString() : null,
          programId: program1.id,
          assignmentInfo: {
            assignedBy: manager1.id,
            assignedDate: '2025-01-01',
            isRequired: Math.random() > 0.3,
            canDecline: true,
            status: 'accepted',
          },
          managerFeedback: [],
        };

        milestones.push(milestone);
      }

      localStorage.setItem(milestoneKey, JSON.stringify(milestones));
      console.log(`✅ Created ${numMilestones} milestones for ${user.name}`);
    }

    // Display Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MOCK DATA SEEDING COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   • 1 Admin account created`);
    console.log(`   • 2 Program Manager accounts created`);
    console.log(`   • 5 Participant accounts created`);
    console.log(`   • 2 Programs created`);
    console.log(`   • Participants assigned to programs`);
    console.log(`   • Spending cycles created`);
    console.log(`   • Mock expenses added`);
    console.log(`   • Milestones assigned`);

    console.log('\n🔐 Test Account Credentials:');
    console.log('\nADMIN:');
    console.log(`   Email: ${MOCK_USERS.admin.email}`);
    console.log(`   Password: ${MOCK_USERS.admin.password}`);

    console.log('\nPROGRAM MANAGERS:');
    MOCK_USERS.managers.forEach(m => {
      console.log(`   ${m.name}`);
      console.log(`   Email: ${m.email}`);
      console.log(`   Password: ${m.password}`);
    });

    console.log('\nPARTICIPANTS:');
    MOCK_USERS.participants.forEach(p => {
      console.log(`   ${p.name}`);
      console.log(`   Email: ${p.email}`);
      console.log(`   Password: ${p.password}`);
    });

    console.log('\n💡 Next Steps:');
    console.log('   1. Refresh the page (F5)');
    console.log('   2. Login with any of the accounts above');
    console.log('   3. Test different user roles and features');
    console.log('   4. Program Managers can add more participants');
    console.log('   5. Try assigning milestones, viewing reports, etc.');

    console.log('\n' + '='.repeat(60));

    return {
      users: createdUsers,
      programs: createdPrograms,
      credentials: MOCK_USERS,
    };

  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
    throw error;
  }
}

// For direct execution in browser console
if (typeof window !== 'undefined') {
  (window as any).seedMockData = seedMockData;
  console.log('✅ Mock data seeder loaded!');
  console.log('Run: seedMockData() to seed the database');
}

export default seedMockData;
