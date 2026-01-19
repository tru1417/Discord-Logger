# ModBot - Discord Moderation Dashboard

## Overview

ModBot is a Discord moderation bot with a web-based dashboard for managing server moderation. The application provides real-time audit logging, moderation case tracking, AutoMod rules with AI-powered analysis, role/permission management, and bot configuration. The dashboard uses a Discord-inspired dark theme with the signature "Blurple" accent color.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state caching and synchronization
- **Styling**: Tailwind CSS with Discord-inspired color palette (dark grays #36393f, #2f3136, #202225; Blurple #5865F2)
- **UI Components**: shadcn/ui (Radix primitives) with custom variants for Discord aesthetic
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: REST endpoints defined in shared/routes.ts with Zod validation
- **Discord Integration**: discord.js v14 for bot functionality (message logging, moderation events)
- **AI Integration**: OpenAI API (via Replit AI Integrations) for AutoMod message analysis

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: shared/schema.ts (logs, cases, rules, roleConfigs, settings tables)
- **Migrations**: drizzle-kit with `db:push` command

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components (Sidebar, StatsCard, etc.)
    pages/        # Route pages (Dashboard, Logs, Cases, Rules, Roles, Settings)
    hooks/        # Custom React hooks for API calls
    lib/          # Utilities (queryClient, cn helper)
server/           # Express backend
  bot.ts          # Discord bot initialization and event handlers
  routes.ts       # API endpoint definitions
  storage.ts      # Database access layer
  db.ts           # Drizzle database connection
shared/           # Shared between client/server
  schema.ts       # Drizzle table definitions
  routes.ts       # API route definitions with Zod schemas
```

### Key Design Decisions
- **Monorepo Structure**: Client and server share types via `shared/` directory, ensuring type safety across the stack
- **Type-Safe API**: Route definitions include input/output Zod schemas, validated on both client and server
- **Storage Abstraction**: IStorage interface in storage.ts allows for potential storage backend swaps
- **Discord Bot Singleton**: Bot client initialized once and reused across the application lifecycle

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via DATABASE_URL environment variable
- **connect-pg-simple**: Session storage for Express (if sessions needed)

### Discord
- **discord.js**: Bot framework for Discord API integration
- **Required Permissions**: Guilds, GuildMessages, MessageContent, GuildMembers, GuildModeration intents
- **Environment Variable**: DISCORD_TOKEN for bot authentication

### AI Services
- **OpenAI API**: Used for AutoMod message analysis
- **Environment Variables**: OPENAI_API_KEY, OPENAI_BASE_URL (defaults to Replit AI integration endpoints)

### Key NPM Packages
- **drizzle-orm/drizzle-kit**: Database ORM and migrations
- **zod**: Runtime type validation for API inputs/outputs
- **@tanstack/react-query**: Client-side data fetching and caching
- **date-fns**: Date formatting throughout the dashboard
- **lucide-react**: Icon library
- **framer-motion**: Animation library for UI transitions