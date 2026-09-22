# Express API Starter TypeScript Project Structure

## Project Directory Structure

```
.
├── src/                      # Source code
│   ├── config/              # Configuration files
│   ├── controllers/         # Route controllers
│   ├── db/                  # Database schema and initialization
│   ├── middlewares/         # Express middlewares
│   ├── routes/              # API routes
│   ├── types/               # TypeScript types
│   ├── utils/               # Utility functions
│   ├── app.ts              # Express app setup
│   └── index.ts            # Application entry point
├── test/                    # Test files
├── drizzle/                 # Generated SQL migrations
├── coverage/               # Test coverage reports
├── docker-compose.yml     # Docker compose configuration
├── Dockerfile            # Docker build configuration
├── drizzle.config.ts     # Drizzle Kit configuration
├── jest.config.js        # Jest test configuration
├── package.json          # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── .env.example         # Environment variables template
```

This document provides a comprehensive overview of the project structure and how different components interact with each other.

## Core Components

### Entry Points
- `src/app.ts`: Main Express application setup with middleware configuration
- `src/index.ts`: Server initialization and startup

### Configuration
- `src/config/`: Contains configuration settings
  - `database.ts`: Database connection configuration
  - `index.ts`: General application configuration

### Database
- `src/db/`: Database-related code
  - `schema.ts`: Database schema definitions using Drizzle ORM (also re-exports the `db` connection)
  - `init.ts`: Database initialization and health check functions
- `src/config/database.ts`: Single owner of the SQLite connection (`DATABASE_URL`)
- `drizzle.config.ts`: Drizzle Kit CLI configuration for generating and applying migrations
- `drizzle/`: Generated SQL migrations

### API Routes
All routes are protected by JWT authentication except for /auth endpoints.

- `src/routes/`
  - `auth.ts`: Authentication routes (register, login, profile)
  - `users.ts`: User management routes
  - `quoteRequests.ts`: Quote request management
  - `quotes.ts`: Quote management
  - `contracts.ts`: Contract management
  - `productionStatus.ts`: Production status tracking
  - `health.ts`: Health check endpoint
  - `docs.ts`: API documentation using Swagger/OpenAPI

### Controllers
- `src/controllers/`
  - `authController.ts`: Handles user authentication and registration
  - `usersController.ts`: User CRUD operations
  - `quoteRequestsController.ts`: Quote request lifecycle management
  - `quotesController.ts`: Quote creation and management
  - `contractsController.ts`: Contract lifecycle management
  - `productionStatusController.ts`: Production status updates

### Middleware
- `src/middlewares/`
  - `auth.ts`: JWT token validation
  - `errorHandler.ts`: Global error handling
  - `rateLimit.ts`: API rate limiting

### Utilities
- `src/utils/`
  - `auth.ts`: Authentication utilities (password hashing, JWT operations)
  - `jsonApiFormatter.ts`: JSON:API response formatting

## Data Flow and Relationships

### Authentication Flow
1. Users register through `/api/auth/register` (customers only)
2. Users login through `/api/auth/login`
3. JWT token is used for subsequent requests; `/api/auth/profile` returns the current user

### Business Process Flow
1. **Quote Request Creation**
   - Customer creates quote request
   - Manufacturers are notified
   - Status: pending → quoted → accepted/rejected

2. **Quote Management**
   - Manufacturers submit quotes for requests
   - Customers can accept/reject quotes
   - Status: pending → accepted/rejected

3. **Contract Management**
   - Created after quote acceptance
   - Status: pending → signed → active → completed

4. **Production Status**
   - Tracks manufacturing progress
   - Status: ordered → in_production → completed → shipped → delivered

## Role-Based Access Control

### User Roles
- **Admin**: Full system access
- **Customer**: Can manage their quote requests
- **Manufacturer**: Can submit quotes and manage contracts

### Key Permissions
- Only customers can create quote requests
- Only manufacturers can create quotes
- Contract creation restricted to manufacturers
- Users can only access their own data
- Admins have full access to all resources

## Error Handling
- Centralized error handling through `errorHandler.ts`
- JSON:API compliant error responses
- Custom `AppError` class for application-specific errors

## Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers

## Testing
Test files mirror the structure of source files in the `test/` directory:
- `auth.test.ts`: Authentication tests
- `contracts.test.ts`: Contract lifecycle tests
- `productionStatus.test.ts`: Production status tests
- `quotes.test.ts`: Quote management tests
- `app.test.ts`: Application setup tests