# UniSphere - 4-Minute Presentation & Demo Script

Follow this exact sequence to demonstrate all required functionality to the judges smoothly within the 4-minute time limit.

---

## ⏱ Demo Timeline (240 Seconds Total)

### 0:00 - 0:15 | Landing Page & Overview
1. Open `http://localhost:3000`.
2. Point out the hero section, the 3 role cards (Students, Organizers, University Admin), and the **Live Approved Upcoming Events** automatically highlighted from the database.

---

### 0:15 - 0:50 | Society President: Event Submission
1. Click **Log In** in the top navigation.
2. Enter President credentials:
   - **Email:** `president1@unisphere.test`
   - **Password:** `Pass@12345`
3. Check the server terminal console to copy the 6-digit OTP code:
   `[UniSphere OTP] president1@unisphere.test -> 123456`
4. Enter the code on the `/verify` page.
5. On the President Dashboard, click **My Events**.
6. Open the `Seminar` event (status **Draft**).
7. Click **Submit for Approval**. Notice the status updates to **Pending**.

---

### 0:50 - 1:35 | Administrator: Live Event & Budget Review
1. In an Incognito / private browser window (or second browser), navigate to `http://localhost:3000/login`.
2. Log in as University Administrator:
   - **Email:** `admin@unisphere.test`
   - **Password:** `Admin@12345`
3. Enter the 6-digit OTP from the console.
4. On the Admin Dashboard, view the statistics counters and pending proposals.
5. Click **Review** on the `Seminar` proposal.
6. Enter review remarks: `"Approved as proposed for semester calendar."`
7. Click **Approve Event & Budget**.
8. Switch back to the President's window: notice the live notification bell badge increments, and viewing the event shows status **Approved** with the budget locked into force.

---

### 1:35 - 2:30 | Student: Public Discovery & Atomic Registration
1. In a third window (or logged out):
   - Open the public event page directly: `http://localhost:3000/events/<seminar-id>` (or from the landing page).
   - Point out: Venue, PKT Datetime, Organizer (Tech Society), and **Seats Remaining**.
2. Click **Register for Event**.
3. Notice you are redirected to `/login?next=/events/...`.
4. Log in as a student:
   - **Email:** `student4@unisphere.test`
   - **Password:** `Pass@12345`
5. Enter OTP from console.
6. Notice you are immediately returned to the event page and registered!
7. Point to the seats counter: it atomically decremented in real-time across both windows.

---

### 2:30 - 3:15 | Volunteer Coordination & Kanban Board
1. In the President's window:
   - Navigate to the approved event detail page.
   - Under **Volunteer Management**, send an invitation to `student1@unisphere.test`.
2. As student1, log in and view the invitation under `/student`. Click **Accept**.
3. In President window, assign the task `"Arrange Venue Sound System"` to `Student 1`.
4. In student1's window, drag / click the task to **Completed**.
5. The President's event progress indicator automatically updates from 0% to 100%.

---

### 3:15 - 3:45 | Expense Tracking & Hard Budget Cap Test
1. In the President's event window, scroll to **Expenses**.
2. Show the Approved Budget (e.g., PKR 50,000) and Total Spent (PKR 0).
3. Add a valid expense: `"Sound check cables"` - **PKR 15,000**. It succeeds and remaining shows PKR 35,000.
4. Now test the hard cap: try adding an expense for **PKR 40,000**.
5. The system immediately rejects it with a clear error: `"Exceeds approved budget. Remaining: 35000"`.
6. Highlight to the judges that the budget cap is strictly enforced at the database transaction level.

---

### 3:45 - 4:00 | Wrap-Up & Closing
- Summarize that all core user flows, OTP rules, state machines, atomic capacity, and real-time SSE updates are fully implemented and verified.
- Open for questions from judges.
