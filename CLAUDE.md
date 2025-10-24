# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Golden Bridge Spending Tracker is a React-based web application for the "Golden Bridge Women" mentorship program. It enables participants to track expenses against budgets across defined spending cycles with AI-powered receipt OCR capabilities.

## Development Commands

### Setup
```bash
npm install
```

### Running the Application
```bash
npm run dev        # Start development server on http://localhost:3000
npm run build      # Production build
npm run preview    # Preview production build
```

### Environment Configuration
Set `GEMINI_API_KEY` in `.env.local` for AI-powered receipt OCR functionality.

## Architecture

### Core Data Model

The application uses three primary TypeScript interfaces (types.ts:1-26):

- **User**: Authentication identity (`id`, `name`, `email`)
- **Expense**: Individual spending entry with optional receipt image (stored as Data URL), contact, and remarks
- **BalanceSheetCycle**: Budget period container with `startDate`, `endDate`, `budget`, `expenses[]`, and `isActive` flag

### State Management

- **Persistence**: `useLocalStorage` hook (hooks/useLocalStorage.ts:1-29) provides automatic localStorage sync for all application state
- **Key Storage Keys**:
  - `spendingCycles`: Array of all BalanceSheetCycle objects
  - User session managed in-memory via React state

### Component Hierarchy

```
App (session management)
├── Login (authentication)
└── Dashboard (main application)
    ├── Header (user info, logout)
    ├── BalanceSheet (expense table, budget summary)
    │   └── Icons (Edit, Delete, Plus)
    ├── AddExpenseModal (form with AI OCR)
    │   └── CloseIcon
    └── NewCycleModal (budget cycle creation)
```

### Critical Implementation Details

**Cycle Management** (Dashboard.tsx:40-52):
- Only one cycle can be `isActive: true` at a time
- Starting a new cycle deactivates all previous cycles
- All expenses belong to a specific cycle via the `expenses[]` array

**Expense CRUD** (Dashboard.tsx:54-85):
- Add: Creates new expense with UUID, appends to active cycle
- Edit: Replaces expense in-place by matching `id`
- Delete: Filters expense from active cycle after confirmation

**AI Receipt OCR** (AddExpenseModal.tsx:86-147):
- Uses Google Gemini 2.5 Flash model
- Processes receipt images to extract multiple line items
- Returns structured JSON array with `item`, `amount`, `date`
- Accessible via `process.env.API_KEY` (mapped from `GEMINI_API_KEY`)
- Auto-populates form fields when user clicks detected expense

**Image Handling**:
- Receipt images converted to base64 Data URLs via FileReader
- Stored directly in localStorage (no external storage)
- Displayed via `<img src={receiptUrl}>` for receipts

### Tech Stack

- **Framework**: React 19.2 with TypeScript 5.8
- **Build Tool**: Vite 6.2
- **Styling**: Tailwind CSS (via inline classes)
- **AI**: Google Gemini API via `@google/genai`
- **UUID Generation**: uuid v9.0.1

### Path Aliases

`@/*` maps to project root (configured in tsconfig.json and vite.config.ts)

## Development Guidelines

### Adding New Expense Fields

1. Update `Expense` interface in `types.ts`
2. Modify form in `AddExpenseModal.tsx` (add input, state, handlers)
3. Update table in `BalanceSheet.tsx` to display new field
4. Adjust OCR prompt/schema in `AddExpenseModal.tsx:112-132` if AI should extract it

### Modifying Budget Calculations

- Total spent calculation: `BalanceSheet.tsx:16`
- Remaining budget: `BalanceSheet.tsx:17`
- Budget display logic: `BalanceSheet.tsx:49-64`

### Accessibility

- Modal focus trapping implemented in `AddExpenseModal.tsx:48-84`
- Escape key closes modals
- ARIA labels on icon buttons
- Form validation via HTML5 `required` attributes

### Storage Constraints

Since all data is stored in localStorage (including base64 images), be mindful of the ~5-10MB browser limit. Consider implementing external storage for receipts if users exceed limits.

## Known Integration Points

- **Gemini API Key**: Required for OCR functionality, configured via `.env.local`
- **LocalStorage**: All user data persists client-side only (no backend)
- **Vite Dev Server**: Runs on port 3000, accessible from network via `0.0.0.0`
