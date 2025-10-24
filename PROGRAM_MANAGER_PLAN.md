# Program Manager System - Implementation Plan

## System Architecture Overview

```
Multi-Program, Multi-Participant System
├── Users (with roles: Admin, Program Manager, Participant)
├── Programs (multiple, with many-to-many relationships)
├── Milestones (assigned, self-created, with decline capability)
└── Financial Data (role-based access control)
```

## 1. Enhanced Data Models

### User Model Updates
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  programIds: string[]; // Multiple programs
  managedProgramIds?: string[]; // For managers only
  createdAt: string;
}

enum UserRole {
  ADMIN = 'admin', // System admin - full access
  PROGRAM_MANAGER = 'program_manager',
  PARTICIPANT = 'participant'
}
```

### Program Model
```typescript
interface Program {
  id: string;
  name: string;
  description: string;
  managerIds: string[]; // Multiple managers per program
  participantIds: string[];
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'upcoming';
  createdBy: string;
  createdAt: string;
}
```

### Enhanced Milestone Model
```typescript
interface Milestone {
  id: string;
  userId: string; // Owner of the milestone
  programId?: string; // Associated program
  title: string;
  description?: string;
  category: MilestoneCategory;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;

  // Assignment fields
  assignmentInfo?: {
    assignedBy: string; // Manager who assigned
    assignedAt: string;
    assignmentType: AssignmentType;
    isRequired: boolean;
    canDecline: boolean;
    declineReason?: string; // If participant declined
    declinedAt?: string;
  };

  progressReports: ProgressReport[];
  createdAt: string;
}

enum AssignmentType {
  SELF_CREATED = 'self_created',
  MANAGER_ASSIGNED = 'manager_assigned',
  TEMPLATE_BASED = 'template_based',
  BULK_ASSIGNED = 'bulk_assigned'
}

interface MilestoneTemplate {
  id: string;
  programId: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  suggestedDuration: number;
  isRequired: boolean;
  createdBy: string;
}
```

### Progress Report Enhancement
```typescript
interface ProgressReport {
  id: string;
  weekNumber: number;
  date: string;
  content: string;
  hoursSpent?: number;
  completionPercentage?: number;

  // Manager feedback
  managerFeedback?: {
    managerId: string;
    feedback: string;
    feedbackDate: string;
  }[];
}
```

## 2. Financial Data Access Control

### Financial Permissions Matrix

| Role | View Own | Edit Own | View Others | Edit Others | View Reports | Export Data |
|------|----------|----------|-------------|-------------|--------------|-------------|
| **Participant** | ✅ | ✅ | ❌ | ❌ | Own only | Own only |
| **Program Manager** | ✅ | ✅ | ✅ (assigned participants) | ✅ (with audit log) | All in program | All in program |
| **Admin** | ✅ | ✅ | ✅ | ✅ | All | All |

### Financial Edit Scenarios
- **Participants**: Full control over their own expenses
- **Program Managers**:
  - Can edit participant expenses with reason logging
  - Can set budget limits
  - Can approve/reject certain expense categories
- **Audit Trail**: All manager edits logged with timestamp and reason

## 3. Data Visibility Rules

### Manager Can See:
- ✅ All participant profiles in their programs
- ✅ All milestones (assigned and self-created)
- ✅ All progress reports
- ✅ All financial data for their program participants
- ✅ Aggregate analytics and trends

### Participant Can See:
- ✅ Their own data (milestones, finances, reports)
- ✅ Manager feedback on their reports
- ❌ Other participants' data
- ❌ Other participants' progress
- ✅ Program-level aggregate statistics (optional)

## 4. Assignment System Features

### Bulk Assignment Workflow
```
1. Manager selects milestone/template
2. System shows participant list with checkboxes
3. Manager can:
   - Select All
   - Select by criteria (e.g., all new participants)
   - Select individually
4. Manager sets:
   - Required vs Optional
   - Custom deadlines per group
   - Allow decline option
5. System sends notifications
6. Participants can accept/decline with reason
```

### Decline Mechanism
```typescript
interface MilestoneDecline {
  milestoneId: string;
  participantId: string;
  reason: string;
  declinedAt: string;
  managerResponse?: {
    accepted: boolean;
    comment: string;
    respondedAt: string;
  };
}
```

## 5. UI/UX Structure

### Program Manager Dashboard
```
Dashboard
├── My Programs (dropdown selector)
├── Overview Tab
│   ├── Active participants count
│   ├── Milestone completion rate
│   ├── Financial summary
│   └── Recent alerts
├── Participants Tab
│   ├── Participant list with filters
│   ├── Individual participant cards
│   │   ├── Progress summary
│   │   ├── Recent activity
│   │   └── Quick actions
│   └── Bulk actions toolbar
├── Milestones Management Tab
│   ├── Template Library
│   ├── Assignment Center
│   │   ├── New assignment
│   │   ├── Bulk assignment
│   │   └── Pending declines
│   └── Progress Matrix (grid view)
├── Financial Oversight Tab
│   ├── Spending overview
│   ├── Individual reports
│   ├── Budget vs Actual
│   └── Approve/Edit transactions
└── Reports & Analytics Tab
    ├── Individual progress reports
    ├── Program analytics
    ├── Export options
    └── Custom report builder
```

### Participant Dashboard Updates
```
Existing Tabs +
├── My Assignments Tab
│   ├── Pending assignments (accept/decline)
│   ├── Active assigned milestones
│   └── Completed assignments
└── Notifications Panel
    ├── New assignments
    ├── Manager feedback
    └── Deadline reminders
```

## 6. Notification System

### Notification Types
- New milestone assigned
- Assignment declined by participant
- Progress report submitted
- Manager feedback received
- Deadline approaching
- Budget limit reached

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
- Extend User model with roles
- Create Program model and management
- Add role-based routing
- Implement basic access control

### Phase 2: Assignment System (Week 2)
- Enhance Milestone model
- Create assignment UI for managers
- Implement accept/decline flow
- Add bulk assignment feature

### Phase 3: Monitoring Tools (Week 3)
- Build manager dashboard
- Create participant overview
- Implement progress matrix
- Add financial oversight

### Phase 4: Communication (Week 4)
- Add feedback system
- Implement notifications
- Create activity logs
- Add export functionality

## 8. Security & Privacy Considerations

- **Data Isolation**: Strict program-based data separation
- **Audit Logging**: All manager actions logged
- **Permission Checks**: Every action validated against role
- **Sensitive Data**: Financial data encrypted in localStorage
- **Session Management**: Role verification on each action

## 9. Technical Considerations

### Storage Structure
```
localStorage:
├── gbw_users_v2 (with roles)
├── gbw_programs
├── gbw_program_{programId}_participants
├── gbw_milestones_{userId}_v2
├── gbw_assignments_{userId}
├── gbw_templates_{programId}
├── gbw_audit_log_{programId}
└── gbw_notifications_{userId}
```

### Migration Strategy
- Detect existing users and migrate to new structure
- Default existing users as participants
- Preserve all existing data
- Add backward compatibility layer

## 10. Key Features Summary

✅ **Multi-program support** - Managers and participants in multiple programs
✅ **Flexible assignments** - Individual, bulk, template-based
✅ **Decline capability** - Participants can decline with reason
✅ **Full visibility for managers** - Access to all participant data
✅ **Private progress reports** - Visible only to participant and their managers
✅ **Financial oversight** - Role-based access with audit trail
✅ **Template system** - Reusable milestone templates
✅ **Bulk operations** - Efficient management of multiple participants

## 11. User Stories

### As a Program Manager, I can:
- Create and manage multiple programs
- Assign milestones to individuals or groups
- Monitor all participant progress in real-time
- Provide feedback on progress reports
- Edit participant financial data with audit logging
- Export comprehensive reports for stakeholders
- Create reusable milestone templates

### As a Participant, I can:
- Join multiple programs
- Accept or decline assigned milestones
- Create my own milestones
- Submit weekly progress reports
- View manager feedback privately
- Track my financial data
- Cannot see other participants' data

### As an Admin, I can:
- Manage all programs and users
- Assign program managers
- Access all data across the system
- Generate system-wide reports
- Handle user support issues

## 12. Future Enhancements

### Phase 5 (Future)
- Mobile app development
- Email/SMS notifications
- Calendar integration
- File attachments for progress reports
- Video check-ins
- Peer mentoring features (opt-in)
- API for external integrations

## 13. Success Metrics

- Milestone completion rate
- Weekly report submission rate
- Time to complete milestones
- Financial budget adherence
- User engagement metrics
- Manager response time to reports

## 14. Risk Mitigation

- **Data Loss**: Regular export prompts, backup reminders
- **Privacy Breach**: Strict role-based access, audit logs
- **User Adoption**: Intuitive UI, onboarding tutorials
- **Scalability**: Indexed storage, pagination for large datasets

---

**Document Version**: 1.0
**Last Updated**: October 2024
**Status**: Ready for Review and Implementation Planning