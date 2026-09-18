# EduMate AI

EduMate AI is a Next.js learning platform built for personalized student support. It combines AI tutoring, study planning, progress tracking, quiz generation, homework help, and voice-based learning into a single app for students and learning workflows.

## Overview

The app is designed around a student-first learning experience:

- AI-powered chat tutor for questions and explanations
- adaptive learning tools and personalized study plans
- progress tracking with streaks, achievements, recommendations, and memory
- homework and document support via AI analysis
- voice tutoring and interactive study experiences
- Supabase-powered authentication and persistent student data

## Core features

### Learning experience

- AI chat assistant for student questions
- Personal study plan generation and review flows
- Smart review and learning recommendations
- Study mode for guided topic learning
- Practice quiz generation and evaluation
- Homework helper with image and PDF support
- Voice tutor using live audio interactions

### Student data and personalization

- Student profile management
- Learning memory and recommendation tracking
- Learning achievements and progress calculations
- Streak and daily goal tracking
- Knowledge search and update endpoints

### AI and evaluation

- Gemini-based AI integration for tutoring and learning generation
- RAG evaluation and observability routes
- Knowledge and retrieval pipeline support
- Answer evaluation utilities for educational feedback

## Tech stack

- Next.js 16 app router
- React 19
- TypeScript
- Tailwind CSS
- Supabase for auth and data
- Google GenAI / Gemini for AI features

## Project structure

```text
app/
  api/
    chat/
    conversation/
    daily-learning-goal/
    guardrails/
    homework/
    knowledge/
    learning-achievements/
    learning-memory/
    learning-progress/
    learning-recommendation/
    learning-streak/
    learning-topic/
    live/
    messages/
    quiz/
    smart-review/
    student/
    study-mode/
    study-plan/
    voice/
  chat/
  login/
  signup/
  forgot-password/
  reset-password/
  page.tsx
components/
  auth/
  chat/
  landing/
lib/
  gemini.ts
  supabase.ts
  supabase-server.ts
  supabase-browser.ts
  learning-memory.ts
  learning-achievement.ts
  learning-recommendation.ts
  learning-topic.ts
  adaptive-difficulty.ts
  spaced-repetition.ts
  rag-tests.ts
  rag-evaluation.ts
  observability.ts
  guardrails.ts
  evaluate-answer.ts
  embeddings.ts
  mock-ai.ts
public/
types/
```

## Environment variables

Create a `.env.local` file in the project root with the required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SECRET_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

Notes:

- The app expects Supabase to be configured for authentication and data access.
- Gemini is used for AI chat, question evaluation, recommendations, homework support, and voice flows.
- If `MOCK_AI=true` is set in the environment, mock AI behavior can be enabled for certain routes.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Add your environment variables to `.env.local`.

3. Run the development server:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:3000
```

## Available scripts

```bash
npm run dev      # start local development server
npm run build    # production build
npm run start    # run production build locally
npm run lint     # run ESLint checks
npm run format   # format the project with Prettier
```

## Key user journeys

### Student login and onboarding

The app includes login, signup, forgot-password, and reset-password flows using Supabase auth and shared UI styling.

### Chat and tutoring

The app uses `/app/chat/page.tsx` as the main workspace where students can:

- create or select conversations
- send questions to the AI tutor
- receive streaming responses
- access learning tools from the learning center

### Learning tools

The product includes multiple interactive educational modules:

- Smart Review
- Learning Recommendation
- Study Plan
- Study Mode
- Quiz
- Voice Tutor
- Homework Helper

## Notes

This project is a full-featured prototype/production-style learning app rather than a basic starter template. It includes both end-user flows and backend AI/data endpoints for a complete educational assistant experience.

## License

This project is private and intended for internal or project-specific use unless otherwise specified by the repository owner.
