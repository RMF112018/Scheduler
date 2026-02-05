/**
 * Swagger/OpenAPI Configuration
 *
 * Phase 9: OpenAPI 3.0 specification generation for public API documentation.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Construction Scheduler API',
      version: '1.0.0',
      description: `
        Public REST API for construction scheduling and project management.
        
        ## Authentication
        All endpoints (except /auth/login) require JWT authentication via Bearer token in the Authorization header.
        
        ## Versioning
        This API uses URL path versioning. Current version: v1
        
        ## Rate Limiting
        API requests are rate-limited to prevent abuse. Limits vary by environment.
        
        ## Modules
        - **Core**: Scheduling, activities, lookahead workflows, validation
        - **Resources**: Staff management, forecasting, resource planning
        - **Workflows**: Approval processes, attachment gating
        - **Import/Export**: XER, XLSX, PDF export capabilities
        - **Dashboards**: Executive dashboards with workflow-gated data
        - **Notifications**: Real-time notifications and email alerts
        - **Audit**: Comprehensive audit logging for compliance
        - **Webhooks**: Outgoing webhook subscriptions for partner integrations
      `,
      contact: {
        name: 'API Support',
        email: 'api@scheduler.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:4000/api/v1',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login endpoint',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            message: {
              type: 'string',
              example: 'Detailed error description',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                page: { type: 'number' },
                pageSize: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Forbidden',
                message: 'Insufficient permissions',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Not Found',
                message: 'Resource not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Validation Error',
                message: 'Invalid input data',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Projects',
        description: 'Project management operations',
      },
      {
        name: 'Schedules',
        description: 'Schedule management and operations',
      },
      {
        name: 'Activities',
        description: 'Schedule activity operations',
      },
      {
        name: 'Lookahead',
        description: 'Lookahead schedule workflows (Last Planner methodology)',
      },
      {
        name: 'Workflows',
        description: 'Approval workflows and attachment gating',
      },
      {
        name: 'Import/Export',
        description: 'Schedule import (XER, XLSX) and export (XLSX, PDF, XER)',
      },
      {
        name: 'Dashboards',
        description: 'Executive dashboards and analytics',
      },
      {
        name: 'Resources',
        description: 'Staff management and resource planning',
      },
      {
        name: 'Forecasting',
        description: 'Resource forecasting and gap analysis',
      },
      {
        name: 'Notifications',
        description: 'In-app and email notifications',
      },
      {
        name: 'Comments',
        description: 'Activity comments with @mentions',
      },
      {
        name: 'Audit',
        description: 'Audit log querying (admin/PM only)',
      },
      {
        name: 'Webhooks',
        description: 'Webhook subscription management (admin/PM only)',
      },
    ],
  },
  apis: [
    './src/routes/**/*.ts',
    './src/controllers/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
