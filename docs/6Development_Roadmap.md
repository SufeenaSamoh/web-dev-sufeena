# Development Roadmap

## Project Vision

The goal of this project is to build a complete cloud-based inventory management system for Sushi Hana Thailand.

The system must support multiple branches, automate inventory calculations, provide full traceability, and be scalable for future business expansion.

---

# Current Project Status

## Completed

- Dashboard
- Item Management
- Supplier Management
- Beginning Stock
- Purchase / Receiving
- Stock Count
- Inventory Analysis (Basic)
- Search
- Filter
- Supabase Integration

---

## In Progress

- Multi-Branch
- Automatic Beginning Stock
- Inventory Formula
- Dashboard Improvements

---

## Not Started

- Audit Log
- FIFO
- Lot Tracking
- Expiry Alert
- Notification
- User Permissions
- Barcode
- Mobile Support

---

# Phase 1 — Core Inventory System

**Priority:** Critical

### Objective

Complete the core inventory workflow.

### Tasks

- Multi-Branch Support
- Branch Selector on every page
- Beginning Stock automation
- Inventory Usage formula
- Improve Inventory Analysis
- Search & Filter optimization
- Dashboard synchronization

### Recommended Tool

- **Lovable** → UI
- **Claude Code** → Logic & Refactoring
- **Supabase** → Database

---

# Phase 2 — History & Audit System

**Priority:** Critical

### Objective

Make every inventory transaction traceable.

### Tasks

- Audit Log table
- Purchase History
- Stock Count History
- Beginning Stock History
- Search
- Export Excel
- Transaction Timeline

### Recommended Tool

- **Claude Code**
- **Supabase**

---

# Phase 3 — FIFO & Lot Management

**Priority:** High

### Objective

Manage inventory according to FIFO.

### Tasks

- Lot Number generation
- FIFO Engine
- Remaining Quantity
- Lot History
- Cost by Lot
- Automatic consumption

### Recommended Tool

- **Claude Code**
- **Supabase**

---

# Phase 4 — Expiry Management

**Priority:** High

### Objective

Prevent inventory loss from expired products.

### Tasks

- Shelf Life settings
- Expiry Date calculation
- Near Expiry alert
- Expired status
- Dashboard warning
- Expiry Report

### Recommended Tool

- **Claude Code**
- **Lovable**

---

# Phase 5 — Reporting & Dashboard

**Priority:** High

### Objective

Provide management insights.

### Tasks

- Branch Dashboard
- Inventory Analysis
- Charts
- Purchase Trend
- Usage Trend
- Top Consumed Items
- Low Stock Report
- Expiry Report

### Recommended Tool

- **Lovable**
- **Claude Code**

---

# Phase 6 — User Management

**Priority:** Medium

### Objective

Secure the system.

### User Roles

Administrator

Manager

Employee

### Tasks

- Login
- Authentication
- Authorization
- Branch Restriction
- Password Reset

### Recommended Tool

- **Supabase Auth**
- **Claude Code**

---

# Phase 7 — Notifications

**Priority:** Medium

### Tasks

- Low Stock Alert
- Near Expiry Alert
- Daily Summary
- Weekly Summary
- Email Notification

---

# Phase 8 — Barcode & QR Code

**Priority:** Future

### Tasks

- Barcode Scanner
- QR Code
- Mobile Camera Support
- Fast Stock Count

---

# Phase 9 — Mobile Optimization

**Priority:** Future

### Tasks

- Tablet Layout
- Mobile Layout
- Offline Mode
- PWA Support

---

# Phase 10 — Production Ready

### Final Checklist

- Security Review
- Performance Optimization
- Backup Strategy
- Restore Procedure
- User Training
- System Documentation
- Production Deployment

---

# Recommended Development Tools

| Task            | Recommended Tool      |
| --------------- | --------------------- |
| UI / Layout     | Lovable               |
| Business Logic  | Claude Code           |
| Documentation   | ChatGPT               |
| Database        | Supabase              |
| SQL             | Claude Code           |
| Workflow Design | ChatGPT               |
| Bug Fixing      | Claude Code           |
| Reports         | Lovable + Claude Code |

---

# Development Principles

Every new feature must:

- Follow the System Specification.
- Preserve existing functionality.
- Keep the UI consistent.
- Support multiple branches.
- Be fully traceable through Audit Logs.
- Be scalable for future expansion.
- Avoid duplicate or conflicting data.

---

# Success Criteria

The system is considered **Production Ready** when it can:

- Manage inventory for **5 branches** from a single database.
- Calculate inventory usage automatically without manual input.
- Track inventory using **FIFO and Lot Numbers**.
- Monitor expiry dates and generate alerts.
- Record every transaction through **Audit Logs**.
- Produce accurate reports and dashboards.
- Support secure, role-based user access.
- Scale for future branch expansion without redesigning the database.

---

## เอกสารชุดนี้ตอนนี้ประกอบด้วย

1. ✅ Project Overview
2. ✅ System Specification
3. ✅ Database Design
4. ✅ Business Rules
5. ✅ Workflow Documentation
6. ✅ Development Roadmap
