# Express API Starter with TypeScript

A modern, fully-featured REST API starter built with Express.js and TypeScript, following the JSON:API specification.

## Features

- 🔒 Authentication with JWT
- 👥 Role-based access control (Admin, Customer, Manufacturer)
- 📄 Comprehensive documentation
- ✨ JSON:API compliant responses
- 🚀 TypeScript for type safety
- 📦 Modular architecture
- 🔍 Input validation
- 🛠 Error handling
- ⚡️ Rate limiting
- 🧪 Testing setup

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- SQLite for development

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/express-api-starter-ts.git
cd express-api-starter-ts
```

2. Install dependencies:
```bash
npm install
```

3. Create a .env file in the root directory:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
DATABASE_URL=file:./db.sqlite
```

4. Initialize the database:
```bash
npm run db:migrate
```

5. Start the development server:
```bash
npm run dev
```

The API will be available at http://localhost:3000

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── db/            # Database setup and models
├── interfaces/    # TypeScript interfaces
├── middlewares/   # Express middlewares
├── routes/        # API routes
├── types/         # TypeScript types
├── utils/         # Utility functions
└── index.ts       # Application entry point
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login and get JWT token

### Quote Requests
- GET /api/quote-requests - List quote requests
- GET /api/quote-requests/:id - Get quote request details
- POST /api/quote-requests - Create a quote request
- PUT /api/quote-requests/:id - Update a quote request
- DELETE /api/quote-requests/:id - Delete a quote request

### Quotes
- GET /api/quotes - List quotes
- GET /api/quotes/:id - Get quote details
- POST /api/quotes - Submit a quote
- PUT /api/quotes/:id - Update a quote
- DELETE /api/quotes/:id - Delete a quote

### Contracts
- GET /api/contracts - List contracts
- GET /api/contracts/:id - Get contract details
- POST /api/contracts - Create a contract
- PUT /api/contracts/:id - Update a contract
- DELETE /api/contracts/:id - Delete a contract

### Production Status
- GET /api/production-status - List production status updates
- GET /api/production-status/:id - Get status details
- POST /api/production-status - Create status update
- PUT /api/production-status/:id - Update status
- DELETE /api/production-status/:id - Delete status update

## Error Handling

The API uses a consistent error format following the JSON:API specification:

```json
{
  "errors": [
    {
      "status": "404",
      "title": "Not Found",
      "detail": "The requested resource could not be found"
    }
  ]
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start in production mode:

```bash
npm start
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details about changes and updates.