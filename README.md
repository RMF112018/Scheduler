# Scheduler - Construction Project Management

A modern, web-based construction scheduling application designed to be more intuitive than Primavera P6 while providing superior functionality to Microsoft Project.

## Features

- **Master Schedule Management** - Create and manage comprehensive project schedules
- **Lookahead Schedules** - Field-level planning with Last Planner methodology
- **Approval Workflows** - Multi-stage approval process for schedule changes
- **Offline Support** - Work offline with automatic synchronization
- **Executive Dashboards** - Real-time project insights and financial drill-downs
- **Import/Export** - Support for XER (Primavera P6), XLSX, and XML formats
- **Resource Planning** - Staff management with forecasting and gap analysis

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI (MUI) for components
- Redux Toolkit for state management
- D3.js for Gantt charts
- Vite for build tooling
- Dexie.js for offline storage

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- Redis for caching/sessions
- Socket.io for real-time updates
- Bull.js for job queues

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Scheduler
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start development services (PostgreSQL, Redis)**
   ```bash
   pnpm docker:up
   ```

4. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

5. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

6. **Start development servers**
   ```bash
   pnpm dev
   ```

   This will start:
   - Frontend at http://localhost:3000
   - Backend API at http://localhost:4000

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both frontend and backend in development mode |
| `pnpm dev:frontend` | Start only the frontend |
| `pnpm dev:backend` | Start only the backend |
| `pnpm build` | Build all packages for production |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm test` | Run tests for all packages |
| `pnpm docker:up` | Start PostgreSQL and Redis containers |
| `pnpm docker:down` | Stop Docker containers |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database with sample data |

### Development Tools (Optional)

Start additional development tools:
```bash
docker-compose -f docker/docker-compose.yml --profile tools up -d
```

- **pgAdmin**: http://localhost:5050 (admin@scheduler.local / admin)
- **Redis Commander**: http://localhost:8081

## Project Structure

```
Scheduler/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── common/    # Shared components
│   │   │   ├── schedules/ # Schedule-related components
│   │   │   ├── lookahead/ # Lookahead components
│   │   │   └── dashboards/# Dashboard components
│   │   ├── services/      # API and offline services
│   │   ├── store/         # Redux store and slices
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript types
│   └── package.json
├── backend/                # Node.js backend application
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── controllers/   # Route controllers
│   │   ├── services/      # Business logic services
│   │   ├── middleware/    # Express middleware
│   │   ├── routes/        # API routes
│   │   ├── utils/         # Utility functions
│   │   └── workers/       # Background job workers
│   ├── prisma/            # Prisma schema and migrations
│   └── package.json
├── shared/                 # Shared types and utilities
│   └── src/
│       └── index.ts       # Shared TypeScript types
├── docker/                 # Docker configuration
│   └── docker-compose.yml
├── docs/                   # Documentation
├── package.json            # Root package.json (workspaces)
└── pnpm-workspace.yaml     # pnpm workspace configuration
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:id` - Get project details
- `PUT /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project

### Schedules
- `GET /api/v1/schedules/:id` - Get schedule
- `POST /api/v1/schedules` - Create schedule
- `PUT /api/v1/schedules/:id` - Update schedule
- `GET /api/v1/schedules/:id/activities` - Get activities
- `GET /api/v1/schedules/:id/baselines` - Get baselines
- `POST /api/v1/schedules/:id/baselines` - Create baseline

### Lookahead
- `GET /api/v1/lookaheads/:id` - Get lookahead schedule
- `POST /api/v1/lookaheads` - Create lookahead
- `POST /api/v1/lookaheads/:id/pull` - Pull from master
- `POST /api/v1/lookaheads/:id/commit` - Commit changes

### Workflows
- `GET /api/v1/workflows` - Get pending approvals
- `POST /api/v1/workflows/:id/approve` - Approve changes
- `POST /api/v1/workflows/:id/reject` - Reject changes

### Import/Export
- `POST /api/v1/import/xer` - Import XER file
- `POST /api/v1/import/xlsx` - Import Excel file
- `GET /api/v1/export/xer/:scheduleId` - Export to XER
- `GET /api/v1/export/pdf/:scheduleId` - Export to PDF

### Dashboard
- `GET /api/v1/dashboard/executive` - Executive dashboard data
- `GET /api/v1/dashboard/financial/:projectId` - Financial drill-down

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Access token expiry | `1d` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run linting and tests: `pnpm lint && pnpm test`
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
