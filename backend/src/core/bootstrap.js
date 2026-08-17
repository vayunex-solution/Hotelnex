import logger from './logger/logger.js';
import configService from './config/configService.js';
import eventBus, { SYSTEM_EVENTS } from './eventbus/eventBus.js';
import cacheEngine from './cache/cacheEngine.js';
import storageEngine from './storage/storageEngine.js';
import notificationEngine from './notifications/notificationEngine.js';
import workflowEngine from './workflow/workflowEngine.js';

// Import newly implemented Phase 1.75 infrastructure
import container from './di/container.js';
import transactionManager from './database/transactionManager.js';
import repositoryFactory from './repository/repositoryFactory.js';
import MySqlRoomRepo from './repository/mysql/mysqlRoomRepo.js';
import schedulerEngine from './scheduler/schedulerEngine.js';
import policyEngine from './policy/policyEngine.js';
import { roomMaintenanceRule } from './policy/rules/roomMaintenanceRule.js';
import { unpaidChargesRule } from './policy/rules/unpaidChargesRule.js';
import SqlSearchProvider from './search/providers/sqlSearch.js';

// Import Sprint 2.2 Core Email Engine
import emailWorker from './email/EmailWorker.js';
import emailService from './email/EmailService.js';

// Import action handlers
import { generateInvoiceAction } from './workflow/actions/generateInvoiceAction.js';
import { sendWhatsappAction } from './workflow/actions/sendWhatsappAction.js';
import { notifyHousekeepingAction } from './workflow/actions/notifyHousekeepingAction.js';
import { writeAuditLogAction } from './workflow/actions/writeAuditLogAction.js';
import { sendEmailAction } from './workflow/actions/sendEmailAction.js';

export const bootstrapCore = () => {
  logger.info('Initializing PropertyNex Platform Core Engines & Infrastructure...');

  // 1. Dependency Injection Registrations
  container.register('ConfigService', configService, { lifetime: 'singleton', type: 'instance' });
  container.register('Logger', logger, { lifetime: 'singleton', type: 'instance' });
  container.register('EventBus', eventBus, { lifetime: 'singleton', type: 'instance' });
  container.register('CacheEngine', cacheEngine, { lifetime: 'singleton', type: 'instance' });
  container.register('StorageEngine', storageEngine, { lifetime: 'singleton', type: 'instance' });
  container.register('NotificationEngine', notificationEngine, { lifetime: 'singleton', type: 'instance' });
  container.register('WorkflowEngine', workflowEngine, { lifetime: 'singleton', type: 'instance' });
  
  // Register newly implemented building blocks in DI
  container.register('TransactionManager', transactionManager, { lifetime: 'singleton', type: 'instance' });
  container.register('RepositoryFactory', repositoryFactory, { lifetime: 'singleton', type: 'instance' });
  container.register('SchedulerEngine', schedulerEngine, { lifetime: 'singleton', type: 'instance' });
  container.register('PolicyEngine', policyEngine, { lifetime: 'singleton', type: 'instance' });
  container.register('SearchProvider', new SqlSearchProvider(), { lifetime: 'singleton', type: 'instance' });
  container.register('EmailService', emailService, { lifetime: 'singleton', type: 'instance' });

  // 2. Register Repositories in RepositoryFactory
  repositoryFactory.register('RoomRepository', 'mysql', MySqlRoomRepo);
  repositoryFactory.register('RoomRepository', 'sqlite', MySqlRoomRepo); // fallback to same for sqlite testing

  // 3. Register Business Rules in Policy Engine
  policyEngine.registerRule('roomMaintenanceRule', roomMaintenanceRule);
  policyEngine.registerRule('unpaidChargesRule', unpaidChargesRule);

  // 4. Register Workflow Actions
  workflowEngine.registerAction('generate_invoice', generateInvoiceAction);
  workflowEngine.registerAction('send_whatsapp', sendWhatsappAction);
  workflowEngine.registerAction('notify_housekeeping', notifyHousekeepingAction);
  workflowEngine.registerAction('write_audit_log', writeAuditLogAction);
  workflowEngine.registerAction('send_email', sendEmailAction);

  // 5. Wire Event Bus to Workflow Engine trigger
  Object.values(SYSTEM_EVENTS).forEach((eventName) => {
    eventBus.subscribe(eventName, 'WorkflowTriggerListener', async (payload, context) => {
      let entityType = 'general';
      let entityId = 0;

      if (payload.bookingId) {
        entityType = 'booking';
        entityId = payload.bookingId;
      } else if (payload.guestId) {
        entityType = 'guest';
        entityId = payload.guestId;
      } else if (payload.invoiceId) {
        entityType = 'invoice';
        entityId = payload.invoiceId;
      } else if (payload.tenantId) {
        entityType = 'tenant';
        entityId = payload.tenantId;
      }

      await workflowEngine.trigger(eventName, entityType, entityId, context);
    });
  });

  // 6. Register Default Scheduled Cron Jobs
  schedulerEngine.registerJob('RunNightAudit', async (payload) => {
    logger.info('[Scheduler] Running Night Audit scheduled job...');
  });
  schedulerEngine.registerJob('RecordUsageMetrics', async (payload) => {
    logger.info('[Scheduler] Recording hourly platform usage metrics...');
  });
  schedulerEngine.registerJob('CheckRenewals', async (payload) => {
    logger.info('[Scheduler] Running subscription check renewals...');
  });

  // 7. Start Background Workers & Schedulers
  schedulerEngine.start();
  emailWorker.start(10000); // Poll every 10 seconds

  logger.info('PropertyNex Platform Core Engines & Infrastructure Successfully Bootstrap-loaded.');
};
export default bootstrapCore;

