# CareerCompass Backend

Backend API for an MCA final year project using **Node.js + Express + TypeScript + MongoDB + JWT**.

## Features

- Role-based authentication (`student`, `recruiter`, `admin`)
- Student and recruiter profile APIs
- Resume upload with PDF/DOCX text extraction
- Resume analysis, matching, skill gap, interview, and mock feedback APIs
- Candidate ranking and shortlisted APIs
- Admin user management and analytics APIs
- Validation, centralized error handling, seed data, and API docs

## Folder Structure

```text
backend/
  src/
    config/
    controllers/
    middlewares/
    models/
    routes/
    seeds/
    services/
    utils/
    validators/
```

## Setup

1. Install dependencies:
   - `npm install`
2. Copy env file:
   - `cp .env.example .env` (Windows: copy manually)
3. Start MongoDB locally or update `MONGO_URI`.
4. Run backend:
   - `npm run dev`
5. Seed sample data:
   - `npm run seed`

## Demo Credentials (after seed)

- Student: `student@example.com` / `Password@123`
- Recruiter: `recruiter@example.com` / `Password@123`
- Admin: `admin@example.com` / `Password@123`

## API Base URL

- `http://localhost:5000/api`

## Example Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `GET /users` (admin)
- `GET /students/profile`
- `PUT /students/profile`
- `GET /recruiters/profile`
- `PUT /recruiters/profile`
- `POST /resumes/upload` (multipart `resume`)
- `GET /resumes`
- `POST /resume-analysis/:resumeId`
- `POST /matching`
- `POST /skills/gap-analysis`
- `POST /jobs`
- `GET /jobs`
- `GET /recruiters/candidate-ranking`
- `POST /recruiters/shortlisted`
- `GET /recruiters/shortlisted`
- `POST /interviews/questions/generate`
- `POST /interviews/mock/feedback`
- `GET /reports`
- `POST /reports`
- `GET /reports/analytics`

## Notes

- AI endpoints currently use placeholder logic in `src/services/aiService.ts`.
- Replace placeholder with OpenAI SDK calls using `OPENAI_API_KEY`.
