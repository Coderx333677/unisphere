# UniSphere
> University Society & Event Management Platform

UniSphere is a centralized web platform designed for universities to streamline society operations, event lifecycles, volunteer coordination, and financial oversight. It connects Society Presidents, Students/Volunteers, and University Administrators under a single unified system with role-based access control, atomic capacity-managed event registration, and real-time updates.

---

## 🚀 Key Features

### 1. Authentication & Two-Factor OTP
- Secure role-guarded auth (`ADMIN`, `PRESIDENT`, `STUDENT`) with 6-digit server-logged OTP verification.
- Enforced security rules: 10-minute code expiration, max 5 failed attempts before invalidation, 60-second resend cooldown, and new code invalidating prior codes.
- Full preservation of `next` redirect destination across login, registration, and OTP verification (e.g., direct return to event registration).

### 2. Society Management
- One society per President enforcement (`presidentId` unique constraint).
- Student membership requests with President review (Approve / Reject / Remove).
- Membership status transitions with support for Member / Core Member labels.

### 3. Event Lifecycle & Combined Governance
- Comprehensive state machine: `DRAFT` ➔ `PENDING` ➔ `APPROVED` / `REJECTED` / `CANCELLED`.
- Combined event proposal and budget review by university administration with review remarks.
- Editing an approved event returns it to `PENDING` while keeping the previously approved budget strictly in force.
- Timezone integrity: All user datetime inputs are normalized to **Pakistan Standard Time (Asia/Karachi)**, persisted in UTC, and formatted in PKT.

### 4. Concurrency-Safe Event Registration
- Public event pages with live seat counter.
- Atomic SQL execution (`UPDATE "Event" SET "regCount" = "regCount" + 1 WHERE id = ... AND "regCount" < "capacity"`) preventing overselling under high concurrency.
- Registration cancellation and immediate seat release.

### 5. Volunteer & Task Kanban
- Volunteer invitation workflow for approved society members and registered students (declined invitations are final).
- 3-column Kanban board (`To Do`, `In Progress`, `Completed`) with automatic progress calculation.
- Strict assignment rules: only accepted volunteers can be assigned tasks; volunteers update their own tasks; presidents manage all tasks for their events.

### 6. Expense Tracking & Hard Budget Cap
- Financial ledger tracking expenses against the admin-approved budget.
- Automatic balance calculation (`Approved Budget`, `Total Spent`, `Remaining Balance`).
- Transaction-level blocking prevents any expense exceeding the approved budget.

### 7. Real-Time Updates & Notifications
- Server-Sent Events (SSE) streaming live remaining seats to public pages and immediate notifications.
- In-app notification center with unread badge counter and real-time toast alerts.

### 🌟 Completed Bonus Tasks
- **Bonus A — Downloadable PDF Expense Report**: Built with `pdfkit` at `/api/events/[id]/report` with instant PDF export.
- **Bonus B — Society Logo Upload**: Organizers can upload society logos (enforced ≤ 2 MB file check) saved to `/public/uploads`.
- **Bonus C — Member / Core Member Labels**: Presidents can label approved society members as either `Member` or `Core Member`.
- **Bonus D — Volunteer Withdrawal & Task Reset**: Accepted volunteers can withdraw; in-progress tasks reset to `TODO` and unassign, while completed tasks stay associated for history.
- **Bonus E — Budget Reapproval & Over-Budget Warning**: System alerts admins when revised budget is lower than recorded expenses and displays the `Over budget` badge with negative balance.
- **Bonus F — Cancellation Notifications**: Real-time cancellation broadcasts sent to all registered attendees and volunteers.
- **Bonus G — Meeting Management**: Presidents can schedule meetings with PKT datetime, venue, and agenda; approved members are automatically notified and can view meetings in their student dashboard.

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router, Server Actions, TypeScript)
- **Database & ORM**: SQLite + Prisma ORM
- **Styling**: Tailwind CSS
- **Authentication**: Custom JWT (jose) in httpOnly cookies + bcryptjs
- **Date & Time Handling**: Luxon (Asia/Karachi zone normalization)

---

## ⚙️ Quick Start & Setup

Judges and evaluators can run the complete project with standard Node.js commands:

```bash
# 1. Navigate to the application directory
cd uni-sphere/unisphere

# 2. Copy environment variables
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Apply database schema and migrations
npx prisma migrate dev --name init

# 5. Seed demo accounts, societies, events, and tasks
npm run seed

# 6. Start the development server
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 🔑 How OTP Works Locally

In compliance with hackathon guidelines, email delivery is simulated via server logs:
1. When a user submits email and password, a secure 6-digit random code is generated.
2. The code's SHA-256 hash is saved to the database.
3. The plain code is printed directly to the terminal running the Next.js server:
   ```
   [UniSphere OTP] user@example.com -> 123456 (valid 10 min)
   ```
4. Enter this 6-digit code in the `/verify` page to establish the authenticated session.

---

## 👥 Demo Test Accounts

All accounts are pre-seeded and ready to use:

| Role | Email | Password | Pre-configured State |
|---|---|---|---|
| **Administrator** | `admin@unisphere.test` | `Admin@12345` | University Admin (can review proposals, view metrics) |
| **President 1** | `president1@unisphere.test` | `Pass@12345` | President of **Tech Society** (has draft, pending & approved events) |
| **President 2** | `president2@unisphere.test` | `Pass@12345` | President with **no society** (ready to demo creation) |
| **Student 1** | `student1@unisphere.test` | `Pass@12345` | Core Member of Tech Society |
| **Student 2** | `student2@unisphere.test` | `Pass@12345` | Regular Member of Tech Society |
| **Student 3** | `student3@unisphere.test` | `Pass@12345` | Pending applicant for Tech Society |
| **Student 4** | `student4@unisphere.test` | `Pass@12345` | General Student (ready to register/join) |
| **Student 5** | `student5@unisphere.test` | `Pass@12345` | General Student (ready to register/join) |

---

## 📊 Data Model (Entity Relationship Summary)

- `User`: Accounts with immutable role (`ADMIN`, `PRESIDENT`, `STUDENT`).
- `OtpCode`: Cryptographic SHA-256 OTP hashes with attempt tracking, cooldown, and expiry.
- `Society`: Belongs to 1 President (`presidentId` unique).
- `Membership`: Unique per `(societyId, studentId)`, tracks `PENDING`, `APPROVED`, `REJECTED`, `REMOVED`.
- `Event`: Tracks venue, PKT datetimes, capacity, atomic `regCount`, budgets, and approval status.
- `Registration`: Unique per `(eventId, studentId)`, tracks `REGISTERED` and `CANCELLED`.
- `Invitation`: Volunteer invitations with `PENDING`, `ACCEPTED`, `DECLINED`.
- `Task`: Kanban task with priority, due date, status (`TODO`, `IN_PROGRESS`, `COMPLETED`), and assignee.
- `Expense`: Recorded expenditure in PKR tied to approved event budgets.
- `Notification`: In-app notification records with real-time SSE dispatch.

---

## 📋 Evaluation & Demo Guide

Follow the 4-minute demonstration script in [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) or open [slides.html](./slides.html) in your browser for the judge presentation deck.
