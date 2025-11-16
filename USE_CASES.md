# ClassBridge - Use Cases & User Journeys

## Table of Contents
- [Introduction](#introduction)
- [User Personas](#user-personas)
- [Super Admin Use Cases](#super-admin-use-cases)
- [Admin/Teacher Use Cases](#adminteacher-use-cases)
- [Student Use Cases](#student-use-cases)
- [Cross-Role Use Cases](#cross-role-use-cases)
- [Real-World Scenarios](#real-world-scenarios)

---

## Introduction

ClassBridge is a comprehensive school management system designed to digitize and streamline all aspects of educational institution management. This document outlines the key use cases for different user roles and demonstrates how the platform solves real-world educational challenges.

---

## User Personas

### 1. Sarah Chen - Super Administrator
**Role**: Principal/School Administrator
**Responsibilities**: Overall school management, staff oversight, policy implementation
**Tech Proficiency**: Moderate
**Goals**:
- Efficiently manage all school operations
- Monitor school-wide performance
- Make data-driven decisions
- Ensure smooth academic year operations

### 2. Rajesh Kumar - Teacher/Admin
**Role**: Grade 9 Mathematics Teacher & Class Teacher
**Responsibilities**: Teaching, attendance, grading, student monitoring
**Tech Proficiency**: Moderate
**Goals**:
- Track student progress effectively
- Reduce administrative paperwork
- Communicate clearly with students
- Manage classroom activities

### 3. Emily Rodriguez - Student
**Role**: Grade 10 Student
**Responsibilities**: Attending classes, completing assignments, preparing for exams
**Tech Proficiency**: High
**Goals**:
- Stay organized with assignments
- Track academic performance
- Access learning resources
- Monitor attendance and fees

---

## Super Admin Use Cases

### UC-SA-1: Academic Year Setup
**Actor**: Super Administrator
**Goal**: Set up a new academic year with all classes, subjects, and structure

**Preconditions**:
- Super admin is logged in
- School is registered in the system

**Flow**:
1. Navigate to "Add Classes" section
2. Create new academic year (e.g., "2024-2025")
3. Define grade-section combinations:
   - Grade 1: Sections A, B, C
   - Grade 2: Sections A, B
   - ...and so on
4. Assign class teachers to each section
5. Navigate to "Add Subjects" section
6. Create subjects for each grade:
   - Grade 9: Mathematics, Science, English, History, Geography
   - Configure subject-class mappings
7. System validates and saves the structure

**Postconditions**:
- Academic year is active
- Classes and subjects are available for student enrollment
- Teachers can be assigned to subjects

**Business Value**: Saves 8-10 hours of manual setup work per academic year

---

### UC-SA-2: Staff Onboarding
**Actor**: Super Administrator
**Goal**: Add new teachers/admins to the system

**Flow**:
1. Navigate to "Add Admins" section
2. Click "Create New Admin"
3. Fill in details:
   - Full Name: "Rajesh Kumar"
   - Email: "rajesh.kumar@school.edu"
   - Role: "Teacher" or "Admin"
   - Phone: "+91-9876543210"
4. Assign to subjects/classes (if teacher)
5. System generates login credentials
6. Credentials sent to teacher's email
7. Teacher logs in and changes password on first login

**Postconditions**:
- Teacher/admin account is active
- Can log in to the system
- Has appropriate role-based access

**Business Value**: Streamlined onboarding, immediate system access, no manual credential management

---

### UC-SA-3: Student Enrollment - Bulk Import
**Actor**: Super Administrator
**Goal**: Enroll 500+ students at the start of academic year

**Flow**:
1. Navigate to "Add Students" section
2. Select "Bulk Import" option
3. Download CSV/Excel template
4. Fill template with student data:
   - Name, DOB, Gender, Parent Contact, Email
   - Class, Section, Roll Number
   - Fee Plan, Admission Date
5. Upload filled template
6. System validates data and shows preview
7. Review and confirm import
8. System creates:
   - Student accounts
   - Login credentials (auto-generated)
   - Fee plans
9. Export credentials sheet for distribution

**Postconditions**:
- All students enrolled
- Credentials generated
- Students can log in

**Business Value**: Enroll 500 students in 30 minutes vs. 20+ hours manually

---

### UC-SA-4: School-Wide Analytics Review
**Actor**: Super Administrator
**Goal**: Monthly review of school performance

**Flow**:
1. Navigate to Analytics Dashboard
2. View key metrics:
   - Overall attendance: 92.3%
   - Average test scores by grade
   - Fee collection: ₹45,00,000 / ₹50,00,000 (90%)
   - Syllabus completion: Grade 9 - 65%, Grade 10 - 70%
3. Drill down into problematic areas:
   - Grade 7 Section B has 85% attendance (below target)
   - Physics average score: 62% (needs attention)
4. Generate reports for monthly meeting
5. Export data to Excel for board presentation

**Postconditions**:
- Performance insights gained
- Areas of concern identified
- Reports prepared

**Business Value**: Data-driven decision making, early intervention opportunities

---

## Admin/Teacher Use Cases

### UC-T-1: Daily Attendance Marking
**Actor**: Teacher (Class Teacher)
**Goal**: Mark attendance for homeroom class

**Flow**:
1. Log in to ClassBridge at 8:30 AM
2. Navigate to "Attendance" tab
3. Select class: "Grade 9 - Section A"
4. Select date: Today
5. View student list (35 students)
6. Quick actions:
   - "Mark All Present" (default)
   - Toggle absent for 3 students who are missing
   - Add remark: "Arjun - Sick leave approved"
7. Submit attendance
8. System timestamps and saves

**Postconditions**:
- Attendance recorded for the day
- Parents notified of absences (if notification system enabled)
- Attendance stats updated

**Time Saved**: 2 minutes vs. 10 minutes with paper registers

---

### UC-T-2: Creating and Conducting Online Assessment
**Actor**: Teacher (Mathematics)
**Goal**: Create a chapter test and have students take it online

**Flow**:
1. Navigate to "Assessments" tab
2. Click "Create New Test"
3. Fill test details:
   - Name: "Quadratic Equations - Chapter Test"
   - Subject: Mathematics
   - Class: Grade 9 Section A, B, C
   - Duration: 45 minutes
   - Total Marks: 50
   - Scheduled: Tomorrow, 10:00 AM
4. Add questions:
   - **Option A**: Use Question Builder
     - Add 10 MCQs (auto-graded)
     - Add 5 one-word answers
     - Add 3 long answers (manual grading)
   - **Option B**: Bulk Import
     - Upload Excel with 20 questions
5. Set test as "Online" mode
6. Publish test

**Student Experience** (Next Day):
1. Student logs in at 9:55 AM
2. Sees "Upcoming Test" notification
3. Clicks "Start Test" at 10:00 AM
4. Answers questions within 45-minute timer
5. Submits test
6. MCQs auto-graded immediately
7. Can see partial score (MCQ portion)

**Teacher Experience** (After Test):
1. Navigate to test results
2. See auto-graded MCQ scores
3. Manually grade long answers
4. Enter marks for each student
5. Publish final results

**Postconditions**:
- Test completed and graded
- Results available to students
- Analytics show class performance
- Identify weak areas: 60% students struggled with question 12

**Business Value**:
- Saves 5 hours of paper-based test logistics
- Instant MCQ grading
- Automatic analytics generation

---

### UC-T-3: Syllabus Planning & Progress Tracking
**Actor**: Teacher (Science)
**Goal**: Plan semester syllabus and track completion

**Flow**:
1. Navigate to "Syllabus" tab
2. Select Subject: Physics, Class: Grade 10
3. Create chapter structure:
   - **Chapter 1: Light - Reflection and Refraction**
     - Topic 1.1: Laws of Reflection
     - Topic 1.2: Spherical Mirrors
     - Topic 1.3: Refraction of Light
     - Topic 1.4: Lenses
   - **Chapter 2: Human Eye and Colorful World**
     - Topic 2.1: Structure of Human Eye
     - Topic 2.2: Defects of Vision
     - Topic 2.3: Dispersion of Light
4. Link topics to timetable slots
5. As classes are completed:
   - Mark topics as "Completed" in timetable
   - Progress automatically updates
6. Upload chapter resources:
   - PDF: NCERT Chapter 1
   - Video: Khan Academy - Reflection
   - Link to timetable topic

**Student View**:
- Can see syllabus structure
- Knows which topics are covered
- Accesses linked resources
- Tracks personal completion

**Postconditions**:
- Syllabus clearly defined
- Progress visible to students and admin
- Resources centralized

**Business Value**: Clear learning path, organized resources, transparent progress

---

### UC-T-4: Assignment Management
**Actor**: Teacher (English)
**Goal**: Assign homework, receive submissions, provide feedback

**Flow**:
1. Navigate to "Tasks" tab
2. Click "Create Assignment"
3. Fill details:
   - Title: "Essay: My Summer Vacation"
   - Description: "Write a 500-word essay about your summer vacation. Include introduction, body, and conclusion."
   - Subject: English
   - Class: Grade 8 Section A, B
   - Due Date: 5 days from now
   - Total Marks: 20
   - Allow file uploads: Yes
4. Publish assignment

**Student Flow**:
1. Student sees assignment in dashboard
2. Writes essay
3. Uploads document (Word/PDF)
4. Submits before deadline
5. Receives confirmation

**Teacher Review**:
1. Navigate to assignment
2. See submissions list: 35/40 submitted
3. Download and review each essay
4. Provide feedback and marks for each student:
   - Grade: 17/20
   - Feedback: "Excellent introduction! Work on paragraph transitions."
5. Publish grades

**Student Outcome**:
- Receives grade notification
- Reads feedback
- Learns from comments

**Postconditions**:
- Assignment completed
- Students graded
- Feedback provided
- Late submissions tracked

**Business Value**: Paperless workflow, organized submissions, easy tracking

---

### UC-T-5: Fee Payment Recording
**Actor**: Admin
**Goal**: Record student fee payment

**Flow**:
1. Navigate to "Fees" tab
2. Search for student: "Priya Sharma"
3. View fee plan:
   - Tuition Fee: ₹12,000 (Quarterly)
   - Computer Lab: ₹2,000 (Quarterly)
   - Library: ₹1,000 (Quarterly)
   - **Total Due**: ₹15,000
   - **Paid**: ₹0
   - **Balance**: ₹15,000
4. Click "Record Payment"
5. Enter details:
   - Amount: ₹15,000
   - Payment Method: Online Transfer
   - Transaction ID: TXN123456789
   - Payment Date: Today
6. Generate and print receipt
7. System updates balance: ₹0

**Postconditions**:
- Payment recorded
- Receipt generated
- Balance updated
- Student/parent can view in app

**Business Value**: Accurate fee tracking, instant receipts, reduced discrepancies

---

## Student Use Cases

### UC-S-1: Daily Dashboard Check
**Actor**: Student
**Goal**: Morning routine - check schedule and pending work

**Flow**:
1. Open ClassBridge app at 7:30 AM
2. Dashboard shows:
   - **Today's Classes**:
     - 9:00 AM - Mathematics (Mr. Kumar)
     - 10:00 AM - Science (Ms. Patel)
     - 11:00 AM - English (Mrs. D'Souza)
   - **Pending Tasks**:
     - Math homework due today ⚠️
     - English essay due in 2 days
   - **Upcoming Test**:
     - Physics test on Friday
   - **Attendance**: 94.2% (Good standing)
   - **Fee Status**: Fully paid ✓
3. Click on Math homework
4. Review submission (already uploaded yesterday)
5. Navigate to Timetable to see full week schedule

**Postconditions**:
- Student aware of daily schedule
- No pending urgent tasks
- Prepared for classes

**Business Value**: Organized students, reduced missed deadlines

---

### UC-S-2: Taking an Online Test
**Actor**: Student
**Goal**: Complete scheduled online test

**Flow**:
1. Login 5 minutes before test (9:55 AM)
2. See notification: "Chemistry Test starts in 5 minutes"
3. Click "View Test"
4. Read instructions:
   - Duration: 60 minutes
   - Total Marks: 50
   - 20 MCQs + 5 short answers
   - No negative marking
5. At 10:00 AM, "Start Test" button activates
6. Click "Start Test"
7. Timer starts: 60:00
8. Answer questions:
   - MCQs: Select radio button
   - Short answers: Type in text box
   - Can skip and return later
9. Use navigation panel to track progress
10. At 59:00, warning appears: "1 minute remaining"
11. Click "Submit Test"
12. Confirmation dialog: "Are you sure? You cannot edit after submission"
13. Confirm submission
14. See immediate MCQ results: 16/20 correct
15. Message: "Short answers will be graded by teacher"

**Postconditions**:
- Test submitted
- Partial score visible
- Awaiting teacher grading for full results

**Business Value**: Convenient testing, immediate feedback, reduced test anxiety

---

### UC-S-3: Checking Academic Performance
**Actor**: Student
**Goal**: Review overall academic performance before parent-teacher meeting

**Flow**:
1. Navigate to "Analytics" tab
2. View comprehensive dashboard:
   - **Overall Percentage**: 78.5%
   - **Class Rank**: 12/45
   - **Attendance**: 92.1%
3. Subject-wise breakdown:
   - Mathematics: 85% (Highest)
   - Science: 80%
   - English: 75%
   - Social Studies: 72% (Needs improvement)
4. View performance trends (graph):
   - Consistent improvement in Math
   - Declining trend in Social Studies
5. Test history:
   - Last 5 test scores
   - Comparison with class average
6. Click on Social Studies for details:
   - Chapter-wise scores
   - Weak areas: Chapter 3 - 58%
7. Access linked resources for Chapter 3
8. Plan to study weak areas

**Postconditions**:
- Student aware of performance
- Identified areas for improvement
- Prepared for parent discussion

**Business Value**: Self-awareness, proactive learning, goal setting

---

### UC-S-4: Submitting Assignment
**Actor**: Student
**Goal**: Complete and submit homework

**Flow**:
1. Navigate to "Tasks" tab
2. See pending assignment: "Science Experiment Report"
3. View details:
   - Due: Tomorrow
   - Description: Document your volcano experiment
   - Required: Photos, observations, conclusion
4. Offline: Complete experiment, take photos, write report
5. Return to app
6. Click "Submit Assignment"
7. Upload files:
   - volcano_experiment.docx
   - photo1.jpg, photo2.jpg
8. Add comment: "Completed experiment with my brother. Used baking soda and vinegar."
9. Click "Submit"
10. Confirmation: "Assignment submitted successfully"
11. Task moves to "Submitted" section

**Postconditions**:
- Assignment submitted on time
- Files uploaded
- Awaiting teacher review

**Business Value**: Easy submission, no lost homework, proof of completion

---

### UC-S-5: Viewing Fee Status
**Actor**: Student
**Goal**: Check fee payment status before informing parents

**Flow**:
1. Navigate to "Fees" tab
2. View current academic year fee structure:
   - **Tuition Fee**: ₹48,000/year (₹12,000/quarter)
   - **Computer Lab**: ₹8,000/year (₹2,000/quarter)
   - **Library**: ₹4,000/year (₹1,000/quarter)
   - **Sports**: ₹4,000/year (₹1,000/quarter)
3. View payment history:
   - Q1 (April-June): ₹16,000 - Paid ✓ (April 15)
   - Q2 (July-Sept): ₹16,000 - Paid ✓ (July 10)
   - Q3 (Oct-Dec): ₹16,000 - Due Dec 31 ⚠️
   - Q4 (Jan-Mar): ₹16,000 - Not Due
4. Current balance: ₹16,000 (Q3 pending)
5. Download previous receipts
6. Share fee details with parents

**Postconditions**:
- Student and parents aware of fee status
- Can plan payment
- Access to all receipts

**Business Value**: Transparency, timely payments, reduced confusion

---

## Cross-Role Use Cases

### UC-CR-1: Timetable Management (Multi-Role)

#### Admin Creates Timetable
1. Navigate to "Timetable" tab
2. Select class: Grade 9 Section A
3. Select week: This week
4. Create slots:
   - **Monday 9:00-10:00**: Mathematics (Mr. Kumar)
     - Link to Syllabus Topic: "Quadratic Equations - Solving by Factorization"
   - **Monday 10:00-11:00**: Science (Ms. Patel)
     - Link to Syllabus Topic: "Light - Reflection"
5. Repeat for all periods, all days
6. Publish timetable

#### Teacher Views and Updates
1. See assigned classes in timetable
2. After completing class:
   - Mark slot as "Completed"
   - Add notes: "Covered examples 1-5, homework assigned"
3. If class cancelled:
   - Mark as "Cancelled"
   - Add reason: "School assembly"

#### Student Views Schedule
1. Open timetable
2. See daily schedule
3. View linked syllabus topics
4. Prepare for upcoming classes
5. Check if any classes cancelled

**Business Value**: Centralized scheduling, everyone on same page, syllabus linkage

---

### UC-CR-2: Resource Sharing

#### Teacher Uploads Resource
1. Navigate to "Resources" tab
2. Click "Add Resource"
3. Select type: PDF
4. Upload: "Chapter 5 - Quadratic Equations - Solutions.pdf"
5. Add metadata:
   - Subject: Mathematics
   - Class: Grade 9
   - Chapter: Quadratic Equations
   - Tags: practice, solutions, important
6. Set visibility: All Grade 9 students
7. Publish

#### Student Accesses Resource
1. Navigate to "Resources" tab
2. Filter by subject: Mathematics
3. Find uploaded PDF
4. View in-app PDF viewer
5. Download for offline access
6. Share with classmates (if allowed)

**Business Value**: Centralized resource library, easy access, reduced physical material

---

## Real-World Scenarios

### Scenario 1: New Academic Year Launch
**Timeline**: 2 weeks before school starts

**Week 1**:
- **Day 1-2**: Super Admin creates academic year structure
  - 10 grades × 3 sections = 30 classes
  - 15 subjects configured
  - 40 teachers assigned
- **Day 3-4**: Bulk import 1,200 students
  - Upload student data
  - Generate credentials
  - Assign fee plans
- **Day 5**: Distribute login credentials to students

**Week 2**:
- **Day 1-3**: Teachers create timetables for all classes
- **Day 4**: Upload initial learning resources
- **Day 5**: Teachers plan first month syllabus

**Outcome**: School opens with fully functional digital system

---

### Scenario 2: Mid-Term Examination Period
**Timeline**: 2 weeks

**Preparation (Week 1)**:
- Monday: Teachers create test schedules in calendar
- Tuesday-Thursday: Teachers create online tests or upload question papers
- Friday: Exam timetable published to students

**Execution (Week 2)**:
- Monday-Friday: Students take online/offline tests
- Teachers monitor test completion
- Auto-grading for MCQs provides instant feedback

**Post-Exam**:
- Week 3: Teachers complete manual grading
- Week 4: Results published
- Analytics generated:
  - Class-wise performance
  - Subject-wise averages
  - Student-wise reports
- Parent-teacher meetings scheduled based on results

**Outcome**: Efficient examination process, quick results, data-driven insights

---

### Scenario 3: Attendance Crisis Management
**Situation**: Grade 8 Section B attendance drops to 78%

**Detection**:
- Admin views weekly analytics
- Notices Grade 8B attendance trend declining
- Drill down shows:
  - 15 students with <75% attendance
  - Pattern: Mostly Mondays and Fridays

**Action**:
1. Admin generates detailed attendance report
2. Exports list of low-attendance students
3. Sends to class teacher
4. Class teacher contacts parents
5. Monitoring continues via analytics
6. After 2 weeks: Attendance improves to 88%

**Outcome**: Early detection, timely intervention, improved attendance

---

### Scenario 4: Fee Collection Drive
**Situation**: End of quarter, ₹5,00,000 pending in fee collection

**Process**:
1. Admin generates fee defaulter report
2. Filters: Outstanding > ₹10,000
3. Exports list of 45 students
4. Sends reminder notices via system (if enabled) or manually
5. Records payments as they come in
6. Daily tracking of collection progress
7. By month-end: Outstanding reduced to ₹50,000

**Outcome**: Organized collection, clear tracking, improved cash flow

---

### Scenario 5: Syllabus Completion Monitoring
**Situation**: Term end approaching, need to ensure syllabus completion

**Process**:
1. Admin views syllabus analytics (December)
2. Notices:
   - Grade 10 Science: 65% complete (target: 75%)
   - Grade 9 Math: 80% complete (on track)
3. Discusses with Science teachers
4. Teachers identify pending chapters
5. Adjust timetable to add extra periods
6. Monitor progress weekly
7. By term end: 95% completion achieved

**Outcome**: Timely course completion, student preparedness

---

## Benefits Summary

### For School Administration
- **Time Savings**: 20+ hours/week on administrative tasks
- **Data-Driven Decisions**: Real-time insights into all operations
- **Reduced Errors**: Automated calculations, validation
- **Cost Reduction**: Paperless operations, reduced printing
- **Compliance**: Organized records for audits

### For Teachers
- **Efficient Grading**: Auto-grading, organized submissions
- **Better Planning**: Integrated syllabus and timetable
- **Student Insights**: Performance analytics, attendance patterns
- **Communication**: Direct channel to students (via system)
- **Reduced Paperwork**: Digital assignments, tests, records

### For Students
- **Organization**: All information in one place
- **Transparency**: Clear visibility into performance, fees
- **Convenience**: Access anytime, anywhere
- **Self-Tracking**: Monitor own progress
- **Resource Access**: Centralized learning materials

### For Parents (if implemented)
- **Peace of Mind**: Real-time attendance alerts
- **Involvement**: Track child's academic progress
- **Communication**: Direct teacher contact
- **Fee Transparency**: Clear payment history

---

## Getting Started

### For Super Admins
1. Set up academic year structure
2. Add all teachers/admins
3. Create or import student database
4. Configure fee structures
5. Set up subjects and classes
6. Train teachers on system usage

### For Teachers
1. Log in and change password
2. Explore assigned classes
3. Create timetable for your classes
4. Upload initial resources
5. Set up syllabus structure
6. Start marking attendance

### For Students
1. Log in with provided credentials
2. Update profile if needed
3. Explore dashboard
4. Check timetable
5. View pending assignments
6. Familiarize with navigation

---

## Support & Training

### Recommended Training Schedule
- **Week 1**: Admin training (4 hours)
- **Week 2**: Teacher training (2 sessions × 2 hours)
- **Week 3**: Student orientation (1 hour per class)
- **Ongoing**: Help desk support, video tutorials

### Common Questions
See FAQ section in main README.md

---

**Document Version**: 1.0
**Last Updated**: November 9, 2025
**Maintained By**: ClassBridge Team
