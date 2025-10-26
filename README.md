# Word Widget Backend API

Backend API for the embeddable word game widget platform.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Edit the `.env` file and update:
- `DATABASE_URL`: Your Supabase connection string (replace YOUR_PASSWORD_HERE)
- `JWT_SECRET`: Generate a random 32+ character string

### 3. Create Database Tables
Go to your Supabase project → SQL Editor and run the table creation scripts (see migrations folder or documentation).

### 4. Start Development Server
```bash
npm run dev
```

The server will start on http://localhost:8080

### 5. Test the API
Open http://localhost:8080/health in your browser. You should see:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```

## Project Structure
```
word-widget-backend/
├── src/
│   ├── config/
│   │   └── database.js       # Database connection
│   ├── middleware/           # (To be added)
│   ├── routes/              # (To be added)
│   ├── controllers/         # (To be added)
│   └── app.js               # Main server file
├── migrations/              # (SQL scripts)
├── .env                     # Environment variables (DO NOT COMMIT)
├── .gitignore              # Git ignore file
├── package.json            # Dependencies
└── README.md               # This file
```

## Next Steps (Day 2+)
- Implement authentication (register, login)
- Create word management routes
- Add game tracking
- Build analytics system
- Integrate revenue tracking

## Important Notes
- Never commit your `.env` file to Git
- The `.env` file contains sensitive information (passwords, secrets)
- Always use environment variables for configuration
