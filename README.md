# Project MQM (myQuickMessage)

A web-based application for conducting and analyzing surveys, with a focus on gathering feedback for "Climate Fresk" workshops and training sessions.

## Project Structure

```
Project-MQM/
├── backend/         # Django backend
├── frontend/        # Next.js frontend
└── docs/           # Project documentation
```

## Setup Instructions

### Backend Setup (Django)

1. Create and activate virtual environment:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create .env file in backend directory:
```bash
DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/mqm_db
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

4. Run migrations:
```bash
python manage.py migrate
```

5. Start development server:
```bash
python manage.py runserver
```

### Frontend Setup (Next.js)

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create .env.local file in frontend directory:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

3. Start development server:
```bash
npm run dev
```

## Features

- Survey Creation with NPS and Free Text questions
- Multi-language support
- Anonymous participation
- AI-powered sentiment analysis
- Word cloud generation
- PDF report generation
- Role-based access control

## Tech Stack

- Backend: Django + Django REST Framework
- Frontend: Next.js + TypeScript
- Database: PostgreSQL
- Authentication: NextAuth.js + Django Allauth
- Styling: Tailwind CSS + shadcn/ui

## Development Guidelines

Please refer to the docs directory for:
- Product Requirements Document (PRD.md)
- Code Style Guide (CODE_STYLE.md)
- Development Progress (PROGRESS.md) 