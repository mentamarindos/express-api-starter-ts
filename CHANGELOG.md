# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Database schema for core entities:
  - Users with roles (admin, customer, manufacturer)
  - Products, materials, opening types, and profile types
  - Quote requests and quotes management
  - Contracts and production status tracking
  - Notifications system

- Authentication and authorization:
  - JWT-based authentication
  - Role-based access control
  - User registration and login
  - Password hashing with bcrypt

- API routes and controllers:
  - Quote requests management (CRUD operations)
  - Quotes management (CRUD operations)
  - Contracts management (CRUD operations)
  - Production status tracking (CRUD operations)

- Middleware:
  - Error handling with custom AppError class
  - JWT token validation
  - Rate limiting for API endpoints

- Utilities:
  - JSON:API response formatter
  - Authentication utilities (token generation, password hashing)
  - Database initialization
  - Configuration management

- Comprehensive test suite:
  - Authentication tests covering registration, login, and profile access
  - Quote management tests for creating, updating, and managing quotes
  - Contract workflow tests from creation to signing
  - Production status tracking tests for monitoring manufacturing progress
  - Integration tests for all major API endpoints

### Changed

- Updated project structure to support a modular architecture
- Enhanced error handling with JSON:API error format
- Improved response formatting following JSON:API specification
- Added TypeScript types and interfaces for better type safety
- Updated test configuration for better coverage and maintainability

### Security

- Implemented JWT-based authentication
- Added password hashing with bcrypt
- Implemented rate limiting for API endpoints
- Added role-based access control for all endpoints
- Added proper validation for all API inputs