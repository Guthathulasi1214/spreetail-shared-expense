const { sequelize, User, Group, GroupMembership } = require('../models');
const authService = require('../services/authService');

async function seed() {
  await sequelize.sync({ force: true });
  console.log('Database synced.');

  const passwordHash = await authService.hashPassword('Password123!');
  
  const gutha = await User.create({
    name: 'Gutha Thulasi',
    email: 'gutha@example.com',
    password_hash: passwordHash,
    avatar_color: authService.generateAvatarColor('Gutha Thulasi')
  });

  const group = await Group.create({
    name: 'goa trip',
    description: 'Shared expenses for Goa',
    created_by: gutha.id,
    currency: 'INR'
  });

  const usersToCreate = [
    { name: 'Aisha', email: 'aisha@example.com' },
    { name: 'Rohan', email: 'rohan@example.com' },
    { name: 'Priya', email: 'priya@example.com' },
    { name: 'Meera', email: 'meera@example.com' },
    { name: 'Dev', email: 'dev@example.com' },
    { name: 'Sam', email: 'sam@example.com' }
  ];

  await GroupMembership.create({ group_id: group.id, user_id: gutha.id, joined_at: new Date() });

  for (const uData of usersToCreate) {
    const user = await User.create({
      name: uData.name,
      email: uData.email,
      password_hash: passwordHash,
      avatar_color: authService.generateAvatarColor(uData.name)
    });
    
    // Meera left on April 1st
    const leftAt = uData.name === 'Meera' ? new Date('2026-04-01T00:00:00Z') : null;
    
    await GroupMembership.create({
      group_id: group.id,
      user_id: user.id,
      joined_at: new Date('2026-01-01T00:00:00Z'),
      left_at: leftAt
    });
  }

  console.log('Seeded Gutha and Goa trip group with all members!');
  process.exit(0);
}

seed();
