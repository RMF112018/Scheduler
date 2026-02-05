import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (in development only)
  console.log('🧹 Cleaning existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityAttachment.deleteMany();
  await prisma.resourceAssignment.deleteMany();
  await prisma.importMapping.deleteMany();
  await prisma.workflowHistory.deleteMany();
  await prisma.workflowApproval.deleteMany();
  await prisma.lookaheadVersion.deleteMany();
  await prisma.lookaheadActivity.deleteMany();
  await prisma.lookaheadSchedule.deleteMany();
  await prisma.scheduleBaseline.deleteMany();
  await prisma.scheduleActivity.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.projectPermission.deleteMany(); // Phase 11
  await prisma.userRole.deleteMany(); // Phase 11
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // ============================================================================
  // Create Permissions
  // ============================================================================
  console.log('📋 Creating permissions...');
  const permissions = await Promise.all([
    // Project permissions
    prisma.permission.create({ data: { name: 'project:create', description: 'Create new projects' } }),
    prisma.permission.create({ data: { name: 'project:read', description: 'View projects' } }),
    prisma.permission.create({ data: { name: 'project:update', description: 'Update projects' } }),
    prisma.permission.create({ data: { name: 'project:delete', description: 'Delete projects' } }),
    // Schedule permissions
    prisma.permission.create({ data: { name: 'schedule:create', description: 'Create schedules' } }),
    prisma.permission.create({ data: { name: 'schedule:read', description: 'View schedules' } }),
    prisma.permission.create({ data: { name: 'schedule:update', description: 'Update schedules' } }),
    prisma.permission.create({ data: { name: 'schedule:delete', description: 'Delete schedules' } }),
    // Activity permissions
    prisma.permission.create({ data: { name: 'activity:create', description: 'Create activities' } }),
    prisma.permission.create({ data: { name: 'activity:read', description: 'View activities' } }),
    prisma.permission.create({ data: { name: 'activity:update', description: 'Update activities' } }),
    prisma.permission.create({ data: { name: 'activity:delete', description: 'Delete activities' } }),
    // Lookahead permissions
    prisma.permission.create({ data: { name: 'lookahead:create', description: 'Create lookahead schedules' } }),
    prisma.permission.create({ data: { name: 'lookahead:read', description: 'View lookahead schedules' } }),
    prisma.permission.create({ data: { name: 'lookahead:update', description: 'Update lookahead schedules' } }),
    prisma.permission.create({ data: { name: 'lookahead:commit', description: 'Commit lookahead changes' } }),
    // Workflow permissions
    prisma.permission.create({ data: { name: 'workflow:approve', description: 'Approve workflow requests' } }),
    prisma.permission.create({ data: { name: 'workflow:reject', description: 'Reject workflow requests' } }),
    // Import/Export permissions
    prisma.permission.create({ data: { name: 'import:execute', description: 'Import schedules' } }),
    prisma.permission.create({ data: { name: 'export:execute', description: 'Export schedules' } }),
    // Dashboard permissions
    prisma.permission.create({ data: { name: 'dashboard:view', description: 'View executive dashboard' } }),
    // Admin permissions
    prisma.permission.create({ data: { name: 'admin:users', description: 'Manage users' } }),
    prisma.permission.create({ data: { name: 'admin:company', description: 'Manage company settings' } }),
  ]);

  const permissionMap = permissions.reduce((acc, p) => {
    acc[p.name] = p.id;
    return acc;
  }, {} as Record<string, string>);

  // ============================================================================
  // Create Roles
  // ============================================================================
  console.log('👥 Creating roles...');
  const adminRole = await prisma.role.create({
    data: { name: 'admin', description: 'System administrator with full access' },
  });

  const pmRole = await prisma.role.create({
    data: { name: 'project_manager', description: 'Project manager with schedule management access' },
  });

  const superintendentRole = await prisma.role.create({
    data: { name: 'superintendent', description: 'Field superintendent with approval authority' },
  });

  const foremanRole = await prisma.role.create({
    data: { name: 'foreman', description: 'Field foreman with lookahead access' },
  });

  const subcontractorRole = await prisma.role.create({
    data: { name: 'subcontractor', description: 'Subcontractor with limited lookahead access' },
  });

  const viewerRole = await prisma.role.create({
    data: { name: 'viewer', description: 'Read-only access to schedules' },
  });

  // ============================================================================
  // Phase 11: Create Advanced User Management Roles
  // ============================================================================
  console.log('👥 Creating Phase 11 roles...');
  
  // New User (default for all new accounts)
  const newUserRole = await prisma.role.create({
    data: {
      name: 'new_user',
      description: 'Default role for new users - read-only public content, no project access',
      isSystem: true,
      defaultPermissions: {
        // No permissions - read-only public content only
      },
    },
  });

  // Administrator
  const administratorRole = await prisma.role.create({
    data: {
      name: 'administrator',
      description: 'Full access to all administrative functions, user/role/permission management',
      isSystem: true,
      defaultPermissions: {
        '*': ['*'], // All resources, all actions
      },
    },
  });

  // Subcontractor
  const subcontractorRolePhase11 = await prisma.role.create({
    data: {
      name: 'subcontractor_phase11',
      description: 'View assigned lookaheads, update task status, upload photos/notes',
      isSystem: true,
      defaultPermissions: {
        lookahead: ['read', 'update'],
        activity: ['read'],
      },
    },
  });

  // Superintendent
  const superintendentRolePhase11 = await prisma.role.create({
    data: {
      name: 'superintendent_phase11',
      description: 'Review and approve/reject lookahead commitments, resolve conflicts',
      isSystem: true,
      defaultPermissions: {
        lookahead: ['read', 'update', 'approve', 'reject'],
        activity: ['read', 'update'],
        workflow: ['approve', 'reject'],
      },
    },
  });

  // Project Manager
  const projectManagerRolePhase11 = await prisma.role.create({
    data: {
      name: 'project_manager_phase11',
      description: 'Full ownership of master schedules, create/import/update schedules, manage baselines',
      isSystem: true,
      defaultPermissions: {
        project: ['read', 'write'],
        schedule: ['read', 'write', 'create', 'delete'],
        activity: ['read', 'write', 'create', 'delete'],
        lookahead: ['read', 'write', 'approve', 'reject'],
        workflow: ['approve', 'reject'],
        import: ['execute'],
        export: ['execute'],
        dashboard: ['view'],
      },
    },
  });

  // Project Executive
  const projectExecutiveRole = await prisma.role.create({
    data: {
      name: 'project_executive',
      description: 'High-level oversight - view dashboards, portfolio health, variance reports',
      isSystem: true,
      defaultPermissions: {
        dashboard: ['view'],
        report: ['read'],
        project: ['read'],
      },
    },
  });

  // Leadership
  const leadershipRole = await prisma.role.create({
    data: {
      name: 'leadership',
      description: 'Organization-wide visibility - portfolio health across all projects',
      isSystem: true,
      defaultPermissions: {
        dashboard: ['view'],
        report: ['read'],
        portfolio: ['view'],
      },
    },
  });

  // 3rd Party
  const thirdPartyRole = await prisma.role.create({
    data: {
      name: 'third_party',
      description: 'View-only access to specific project data (consultant, owner rep, inspector, client)',
      isSystem: true,
      defaultPermissions: {
        project: ['read'],
        report: ['read'],
      },
    },
  });

  // ============================================================================
  // Assign Permissions to Roles
  // ============================================================================
  console.log('🔐 Assigning permissions to roles...');
  
  // Admin gets all permissions
  for (const permission of permissions) {
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  // Project Manager permissions
  const pmPermissions = [
    'project:create', 'project:read', 'project:update', 'project:delete',
    'schedule:create', 'schedule:read', 'schedule:update', 'schedule:delete',
    'activity:create', 'activity:read', 'activity:update', 'activity:delete',
    'lookahead:create', 'lookahead:read', 'lookahead:update', 'lookahead:commit',
    'workflow:approve', 'workflow:reject',
    'import:execute', 'export:execute',
    'dashboard:view',
  ];
  for (const permName of pmPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: pmRole.id, permissionId: permissionMap[permName] },
    });
  }

  // Superintendent permissions
  const superintendentPermissions = [
    'project:read',
    'schedule:read', 'schedule:update',
    'activity:read', 'activity:update',
    'lookahead:create', 'lookahead:read', 'lookahead:update', 'lookahead:commit',
    'workflow:approve', 'workflow:reject',
    'export:execute',
    'dashboard:view',
  ];
  for (const permName of superintendentPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: superintendentRole.id, permissionId: permissionMap[permName] },
    });
  }

  // Foreman permissions
  const foremanPermissions = [
    'project:read',
    'schedule:read',
    'activity:read', 'activity:update',
    'lookahead:read', 'lookahead:update', 'lookahead:commit',
    'export:execute',
  ];
  for (const permName of foremanPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: foremanRole.id, permissionId: permissionMap[permName] },
    });
  }

  // Subcontractor permissions
  const subcontractorPermissions = [
    'project:read',
    'schedule:read',
    'activity:read',
    'lookahead:read', 'lookahead:update',
  ];
  for (const permName of subcontractorPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: subcontractorRole.id, permissionId: permissionMap[permName] },
    });
  }

  // Viewer permissions
  const viewerPermissions = [
    'project:read',
    'schedule:read',
    'activity:read',
    'lookahead:read',
    'dashboard:view',
  ];
  for (const permName of viewerPermissions) {
    await prisma.rolePermission.create({
      data: { roleId: viewerRole.id, permissionId: permissionMap[permName] },
    });
  }

  // ============================================================================
  // Create Companies
  // ============================================================================
  console.log('🏢 Creating companies...');
  const acmeConstruction = await prisma.company.create({
    data: { name: 'Acme Construction Inc.' },
  });

  const buildersPro = await prisma.company.create({
    data: { name: 'Builders Pro LLC' },
  });

  // ============================================================================
  // Create Users
  // ============================================================================
  console.log('👤 Creating users...');
  const passwordHash = await bcrypt.hash('password123', 12);

  // Acme Construction Users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      companyId: acmeConstruction.id,
    },
  });

  const pmUser = await prisma.user.create({
    data: {
      email: 'pm@acme.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'project_manager',
      companyId: acmeConstruction.id,
    },
  });

  const superintendentUser = await prisma.user.create({
    data: {
      email: 'super@acme.com',
      passwordHash,
      firstName: 'Mike',
      lastName: 'Williams',
      role: 'superintendent',
      companyId: acmeConstruction.id,
    },
  });

  const foremanUser = await prisma.user.create({
    data: {
      email: 'foreman@acme.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Smith',
      role: 'foreman',
      companyId: acmeConstruction.id,
    },
  });

  const subUser = await prisma.user.create({
    data: {
      email: 'sub@electricpro.com',
      passwordHash,
      firstName: 'Tom',
      lastName: 'Electric',
      role: 'subcontractor',
      companyId: acmeConstruction.id,
    },
  });

  // ============================================================================
  // Create Staff Members
  // ============================================================================
  console.log('👷 Creating staff members...');
  const staffMembers = await Promise.all([
    prisma.staffMember.create({
      data: {
        companyId: acmeConstruction.id,
        userId: foremanUser.id,
        firstName: 'John',
        lastName: 'Smith',
        role: 'Foreman',
        certifications: ['OSHA 30', 'First Aid/CPR'],
        hourlyRate: 45.00,
        isActive: true,
      },
    }),
    prisma.staffMember.create({
      data: {
        companyId: acmeConstruction.id,
        firstName: 'Carlos',
        lastName: 'Martinez',
        role: 'Electrician',
        certifications: ['Journeyman Electrician', 'OSHA 10'],
        hourlyRate: 55.00,
        isActive: true,
      },
    }),
    prisma.staffMember.create({
      data: {
        companyId: acmeConstruction.id,
        firstName: 'David',
        lastName: 'Chen',
        role: 'Plumber',
        certifications: ['Master Plumber', 'OSHA 10'],
        hourlyRate: 52.00,
        isActive: true,
      },
    }),
    prisma.staffMember.create({
      data: {
        companyId: acmeConstruction.id,
        firstName: 'Maria',
        lastName: 'Garcia',
        role: 'Carpenter',
        certifications: ['OSHA 30', 'Scaffolding Certified'],
        hourlyRate: 48.00,
        isActive: true,
      },
    }),
    prisma.staffMember.create({
      data: {
        companyId: acmeConstruction.id,
        firstName: 'James',
        lastName: 'Wilson',
        role: 'Heavy Equipment Operator',
        certifications: ['OSHA 10', 'Crane Operator'],
        hourlyRate: 58.00,
        isActive: true,
      },
    }),
  ]);

  // ============================================================================
  // Create Projects
  // ============================================================================
  console.log('📁 Creating projects...');
  const downtownProject = await prisma.project.create({
    data: {
      companyId: acmeConstruction.id,
      name: 'Downtown Office Complex',
      description: 'A 15-story mixed-use office building with ground-floor retail space',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2026-06-30'),
      status: 'active',
      createdBy: pmUser.id,
      metadata: {
        contractValue: 45000000,
        location: '123 Main Street, Downtown',
        client: 'Metro Development Corp',
      },
    },
  });

  const hospitalProject = await prisma.project.create({
    data: {
      companyId: acmeConstruction.id,
      name: 'Regional Medical Center Expansion',
      description: 'New emergency wing and patient tower addition',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2027-02-28'),
      status: 'active',
      createdBy: pmUser.id,
      metadata: {
        contractValue: 78000000,
        location: '500 Hospital Drive',
        client: 'Regional Health System',
      },
    },
  });

  const bridgeProject = await prisma.project.create({
    data: {
      companyId: acmeConstruction.id,
      name: 'Highway 101 Bridge Rehabilitation',
      description: 'Structural rehabilitation and seismic retrofit of existing bridge',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2025-12-31'),
      status: 'planning',
      createdBy: pmUser.id,
      metadata: {
        contractValue: 12500000,
        location: 'Highway 101 Mile Marker 45',
        client: 'State DOT',
      },
    },
  });

  // ============================================================================
  // Add Project Members
  // ============================================================================
  console.log('👥 Adding project members...');
  await Promise.all([
    // Downtown Office Complex team
    prisma.projectMember.create({
      data: { projectId: downtownProject.id, userId: pmUser.id, roleId: pmRole.id },
    }),
    prisma.projectMember.create({
      data: { projectId: downtownProject.id, userId: superintendentUser.id, roleId: superintendentRole.id },
    }),
    prisma.projectMember.create({
      data: { projectId: downtownProject.id, userId: foremanUser.id, roleId: foremanRole.id },
    }),
    prisma.projectMember.create({
      data: { projectId: downtownProject.id, userId: subUser.id, roleId: subcontractorRole.id },
    }),
    // Hospital project team
    prisma.projectMember.create({
      data: { projectId: hospitalProject.id, userId: pmUser.id, roleId: pmRole.id },
    }),
    prisma.projectMember.create({
      data: { projectId: hospitalProject.id, userId: superintendentUser.id, roleId: superintendentRole.id },
    }),
  ]);

  // ============================================================================
  // Create Schedules
  // ============================================================================
  console.log('📅 Creating schedules...');
  const downtownSchedule = await prisma.schedule.create({
    data: {
      projectId: downtownProject.id,
      name: 'Downtown Office Complex - Master Schedule',
      description: 'Primary construction schedule for the downtown office project',
      status: 'active',
      createdBy: pmUser.id,
      metadata: {
        dataDate: new Date('2024-02-01'),
        calendarType: '5-day',
      },
    },
  });

  const hospitalSchedule = await prisma.schedule.create({
    data: {
      projectId: hospitalProject.id,
      name: 'Medical Center Expansion - Master Schedule',
      description: 'Primary construction schedule for hospital expansion',
      status: 'active',
      createdBy: pmUser.id,
      metadata: {
        dataDate: new Date('2024-03-15'),
        calendarType: '5-day',
      },
    },
  });

  // ============================================================================
  // Create Schedule Activities
  // ============================================================================
  console.log('📋 Creating schedule activities...');
  
  // Downtown Office Complex Activities
  const activities = [];
  
  // Phase 1: Site Work
  const sitePrep = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A1000',
      name: 'Site Preparation & Demolition',
      startDate: new Date('2024-01-15'),
      finishDate: new Date('2024-02-15'),
      duration: 22,
      percentComplete: 100,
      predecessorIds: [],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Site Work', wbs: '1.1' },
    },
  });
  activities.push(sitePrep);

  const excavation = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A1010',
      name: 'Excavation & Shoring',
      startDate: new Date('2024-02-16'),
      finishDate: new Date('2024-03-29'),
      duration: 30,
      percentComplete: 100,
      predecessorIds: [sitePrep.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Site Work', wbs: '1.2' },
    },
  });
  activities.push(excavation);

  // Phase 2: Foundation
  const foundation = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A2000',
      name: 'Foundation & Mat Slab',
      startDate: new Date('2024-04-01'),
      finishDate: new Date('2024-05-31'),
      duration: 44,
      percentComplete: 85,
      predecessorIds: [excavation.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Foundation', wbs: '2.1' },
    },
  });
  activities.push(foundation);

  const waterproofing = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A2010',
      name: 'Below Grade Waterproofing',
      startDate: new Date('2024-05-15'),
      finishDate: new Date('2024-06-07'),
      duration: 18,
      percentComplete: 50,
      predecessorIds: [foundation.id],
      successorIds: [],
      totalFloat: 5,
      isCritical: false,
      metadata: { phase: 'Foundation', wbs: '2.2' },
    },
  });
  activities.push(waterproofing);

  // Phase 3: Structure
  const steelErection = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A3000',
      name: 'Structural Steel Erection - Levels 1-5',
      startDate: new Date('2024-06-03'),
      finishDate: new Date('2024-08-30'),
      duration: 64,
      percentComplete: 25,
      predecessorIds: [foundation.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Structure', wbs: '3.1' },
    },
  });
  activities.push(steelErection);

  const steelErection2 = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A3010',
      name: 'Structural Steel Erection - Levels 6-10',
      startDate: new Date('2024-09-02'),
      finishDate: new Date('2024-11-29'),
      duration: 64,
      percentComplete: 0,
      predecessorIds: [steelErection.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Structure', wbs: '3.2' },
    },
  });
  activities.push(steelErection2);

  const steelErection3 = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A3020',
      name: 'Structural Steel Erection - Levels 11-15',
      startDate: new Date('2024-12-02'),
      finishDate: new Date('2025-02-28'),
      duration: 64,
      percentComplete: 0,
      predecessorIds: [steelErection2.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Structure', wbs: '3.3' },
    },
  });
  activities.push(steelErection3);

  const metalDeck = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A3030',
      name: 'Metal Deck & Concrete Floors',
      startDate: new Date('2024-07-01'),
      finishDate: new Date('2025-03-31'),
      duration: 195,
      percentComplete: 15,
      predecessorIds: [steelErection.id],
      successorIds: [],
      totalFloat: 10,
      isCritical: false,
      metadata: { phase: 'Structure', wbs: '3.4' },
    },
  });
  activities.push(metalDeck);

  // Phase 4: Exterior
  const curtainWall = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A4000',
      name: 'Curtain Wall Installation',
      startDate: new Date('2024-10-01'),
      finishDate: new Date('2025-06-30'),
      duration: 195,
      percentComplete: 0,
      predecessorIds: [steelErection.id],
      successorIds: [],
      totalFloat: 15,
      isCritical: false,
      metadata: { phase: 'Exterior', wbs: '4.1' },
    },
  });
  activities.push(curtainWall);

  const roofing = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A4010',
      name: 'Roofing & Waterproofing',
      startDate: new Date('2025-03-03'),
      finishDate: new Date('2025-04-30'),
      duration: 42,
      percentComplete: 0,
      predecessorIds: [steelErection3.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Exterior', wbs: '4.2' },
    },
  });
  activities.push(roofing);

  // Phase 5: MEP Rough-In
  const electricalRoughIn = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A5000',
      name: 'Electrical Rough-In',
      startDate: new Date('2025-01-06'),
      finishDate: new Date('2025-08-29'),
      duration: 168,
      percentComplete: 0,
      predecessorIds: [metalDeck.id],
      successorIds: [],
      totalFloat: 20,
      isCritical: false,
      metadata: { phase: 'MEP', wbs: '5.1' },
    },
  });
  activities.push(electricalRoughIn);

  const plumbingRoughIn = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A5010',
      name: 'Plumbing Rough-In',
      startDate: new Date('2025-01-06'),
      finishDate: new Date('2025-08-29'),
      duration: 168,
      percentComplete: 0,
      predecessorIds: [metalDeck.id],
      successorIds: [],
      totalFloat: 20,
      isCritical: false,
      metadata: { phase: 'MEP', wbs: '5.2' },
    },
  });
  activities.push(plumbingRoughIn);

  const hvacInstall = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A5020',
      name: 'HVAC Installation',
      startDate: new Date('2025-02-03'),
      finishDate: new Date('2025-09-30'),
      duration: 170,
      percentComplete: 0,
      predecessorIds: [metalDeck.id],
      successorIds: [],
      totalFloat: 15,
      isCritical: false,
      metadata: { phase: 'MEP', wbs: '5.3' },
    },
  });
  activities.push(hvacInstall);

  // Phase 6: Interior Finishes
  const drywall = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A6000',
      name: 'Drywall & Framing',
      startDate: new Date('2025-05-01'),
      finishDate: new Date('2025-11-28'),
      duration: 150,
      percentComplete: 0,
      predecessorIds: [electricalRoughIn.id, plumbingRoughIn.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Interior', wbs: '6.1' },
    },
  });
  activities.push(drywall);

  const painting = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A6010',
      name: 'Painting & Wall Finishes',
      startDate: new Date('2025-09-01'),
      finishDate: new Date('2026-02-27'),
      duration: 130,
      percentComplete: 0,
      predecessorIds: [drywall.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Interior', wbs: '6.2' },
    },
  });
  activities.push(painting);

  const flooring = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A6020',
      name: 'Flooring Installation',
      startDate: new Date('2025-12-01'),
      finishDate: new Date('2026-04-30'),
      duration: 108,
      percentComplete: 0,
      predecessorIds: [painting.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Interior', wbs: '6.3' },
    },
  });
  activities.push(flooring);

  // Phase 7: Commissioning
  const commissioning = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A7000',
      name: 'MEP Commissioning & Testing',
      startDate: new Date('2026-03-02'),
      finishDate: new Date('2026-05-29'),
      duration: 64,
      percentComplete: 0,
      predecessorIds: [flooring.id, hvacInstall.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Commissioning', wbs: '7.1' },
    },
  });
  activities.push(commissioning);

  const finalInspection = await prisma.scheduleActivity.create({
    data: {
      scheduleId: downtownSchedule.id,
      activityCode: 'A7010',
      name: 'Final Inspections & Punch List',
      startDate: new Date('2026-05-01'),
      finishDate: new Date('2026-06-30'),
      duration: 44,
      percentComplete: 0,
      predecessorIds: [commissioning.id],
      successorIds: [],
      totalFloat: 0,
      isCritical: true,
      metadata: { phase: 'Commissioning', wbs: '7.2' },
    },
  });
  activities.push(finalInspection);

  // Update successor IDs
  await prisma.scheduleActivity.update({
    where: { id: sitePrep.id },
    data: { successorIds: [excavation.id] },
  });
  await prisma.scheduleActivity.update({
    where: { id: excavation.id },
    data: { successorIds: [foundation.id] },
  });
  await prisma.scheduleActivity.update({
    where: { id: foundation.id },
    data: { successorIds: [waterproofing.id, steelErection.id] },
  });

  // ============================================================================
  // Create Schedule Baseline
  // ============================================================================
  console.log('📊 Creating schedule baseline...');
  await prisma.scheduleBaseline.create({
    data: {
      scheduleId: downtownSchedule.id,
      version: 1,
      snapshotData: {
        createdAt: new Date().toISOString(),
        activities: activities.map(a => ({
          id: a.id,
          activityCode: a.activityCode,
          name: a.name,
          startDate: a.startDate,
          finishDate: a.finishDate,
          duration: a.duration,
          percentComplete: a.percentComplete,
          totalFloat: a.totalFloat,
          isCritical: a.isCritical,
        })),
      },
    },
  });

  // ============================================================================
  // Create Lookahead Schedule
  // ============================================================================
  console.log('📆 Creating lookahead schedule...');
  const lookahead = await prisma.lookaheadSchedule.create({
    data: {
      masterScheduleId: downtownSchedule.id,
      projectId: downtownProject.id,
      name: '3-Week Lookahead - Week of Feb 5, 2024',
      startDate: new Date('2024-02-05'),
      endDate: new Date('2024-02-23'),
      status: 'active',
      lastSyncedAt: new Date(),
    },
  });

  // Create lookahead activities
  const lookaheadActivities = [
    {
      lookaheadScheduleId: lookahead.id,
      persistentInternalGuid: foundation.persistentInternalGuid,
      name: 'Foundation & Mat Slab - Week 1',
      startDate: new Date('2024-02-05'),
      finishDate: new Date('2024-02-09'),
      duration: 5,
      percentComplete: 20,
      plannerStatus: 'will_do',
      hasConflict: false,
      isCommitted: true,
    },
    {
      lookaheadScheduleId: lookahead.id,
      persistentInternalGuid: foundation.persistentInternalGuid,
      name: 'Foundation & Mat Slab - Week 2',
      startDate: new Date('2024-02-12'),
      finishDate: new Date('2024-02-16'),
      duration: 5,
      percentComplete: 0,
      plannerStatus: 'should_do',
      hasConflict: false,
      isCommitted: false,
    },
    {
      lookaheadScheduleId: lookahead.id,
      persistentInternalGuid: waterproofing.persistentInternalGuid,
      name: 'Below Grade Waterproofing Prep',
      startDate: new Date('2024-02-19'),
      finishDate: new Date('2024-02-23'),
      duration: 5,
      percentComplete: 0,
      plannerStatus: 'should_do',
      hasConflict: false,
      isCommitted: false,
    },
  ];

  for (const activity of lookaheadActivities) {
    await prisma.lookaheadActivity.create({ data: activity });
  }

  // ============================================================================
  // Create Sample Notifications
  // ============================================================================
  console.log('🔔 Creating sample notifications...');
  await Promise.all([
    prisma.notification.create({
      data: {
        userId: pmUser.id,
        type: 'approval_request',
        title: 'Lookahead Approval Required',
        message: 'John Smith has submitted a lookahead for approval',
        actionUrl: `/lookahead/${lookahead.id}`,
        read: false,
      },
    }),
    prisma.notification.create({
      data: {
        userId: pmUser.id,
        type: 'schedule_update',
        title: 'Schedule Updated',
        message: 'Foundation activities have been updated with new progress',
        actionUrl: `/schedules/${downtownSchedule.id}`,
        read: true,
      },
    }),
    prisma.notification.create({
      data: {
        userId: superintendentUser.id,
        type: 'conflict_alert',
        title: 'Schedule Conflict Detected',
        message: 'Zero-float violation detected on Steel Erection activity',
        actionUrl: `/schedules/${downtownSchedule.id}`,
        read: false,
      },
    }),
  ]);

  // ============================================================================
  // Create Resource Assignments
  // ============================================================================
  console.log('👷 Creating resource assignments...');
  await Promise.all([
    prisma.resourceAssignment.create({
      data: {
        scheduleActivityId: foundation.id,
        staffMemberId: staffMembers[0].id, // Foreman
        assignmentType: 'manual',
        hoursAllocated: 352, // 44 days * 8 hours
        assignedBy: pmUser.id,
      },
    }),
    prisma.resourceAssignment.create({
      data: {
        scheduleActivityId: electricalRoughIn.id,
        staffMemberId: staffMembers[1].id, // Electrician
        assignmentType: 'manual',
        hoursAllocated: 1344, // 168 days * 8 hours
        assignedBy: pmUser.id,
      },
    }),
    prisma.resourceAssignment.create({
      data: {
        scheduleActivityId: plumbingRoughIn.id,
        staffMemberId: staffMembers[2].id, // Plumber
        assignmentType: 'manual',
        hoursAllocated: 1344,
        assignedBy: pmUser.id,
      },
    }),
  ]);

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n✅ Database seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - ${permissions.length} permissions created`);
  console.log(`   - 6 roles created`);
  console.log(`   - 2 companies created`);
  console.log(`   - 5 users created`);
  console.log(`   - ${staffMembers.length} staff members created`);
  console.log(`   - 3 projects created`);
  console.log(`   - 2 schedules created`);
  console.log(`   - ${activities.length} activities created`);
  console.log(`   - 1 baseline created`);
  console.log(`   - 1 lookahead schedule created`);
  console.log(`   - 3 notifications created`);
  console.log(`   - 3 resource assignments created`);
  console.log('\n🔑 Test Credentials:');
  console.log('   Admin:         admin@acme.com / password123');
  console.log('   PM:            pm@acme.com / password123');
  console.log('   Superintendent: super@acme.com / password123');
  console.log('   Foreman:       foreman@acme.com / password123');
  console.log('   Subcontractor: sub@electricpro.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
