// Service exports
export { scheduleService, ScheduleService } from './scheduleService.js';
export { activityService, ActivityService } from './activityService.js';
export {
  initializeSocketIO,
  notifyProjectUpdate,
  notifyScheduleUpdate,
  notifyLookaheadUpdate,
  notifyApprovalStatus,
  notifyCompany,
  getIO,
} from './socketService.js';

// Types
export type {
  CreateScheduleDto,
  UpdateScheduleDto,
  BaselineVariance,
  BaselineComparison,
  ScheduleWithDetails,
} from './scheduleService.js';

export type {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityNode,
  CriticalPathResult,
} from './activityService.js';
