# AI Development Guide

## Purpose

This document defines how AI assistants and future developers should work on this project.

The goal is to ensure all future development follows the same architecture, business rules, and coding standards.

This document is the **development guideline** for ChatGPT, Claude Code, Lovable, Gemini, and future developers.

---

# Project Information

## Project Name

Sushi Hana Thailand Inventory Stock Management System

## Version

1.0

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui

### Backend

* Supabase
* PostgreSQL

---

# AI Responsibilities

## ChatGPT

Use ChatGPT for

* System Architecture
* Business Analysis
* Documentation
* Business Rules
* Workflow Design
* Roadmap Planning
* Prompt Engineering
* Feature Planning

ChatGPT should **not** directly modify the project source code.

---

## Claude Code

Use Claude Code for

* Writing Code
* Refactoring
* Database Integration
* API Development
* Supabase Integration
* SQL
* Performance Optimization
* Bug Fixes

Claude Code should always follow:

* System Specification
* Business Rules
* Database Design

before modifying any code.

---

## Lovable

Use Lovable for

* UI Design
* UX Improvements
* Components
* Dashboard Layout
* Responsive Design
* Forms
* Visual Improvements

Lovable should **not** redesign the business workflow.

---

## Gemini

Use Gemini for

* Code Review
* Architecture Analysis
* Performance Suggestions
* Documentation Review

Gemini should not introduce new business rules.

---

# Development Rules

Before implementing any feature:

1. Read **System Specification**
2. Read **Business Rules**
3. Read **Database Design**
4. Read **Workflow Documentation**
5. Understand the current codebase
6. Verify compatibility with existing features

No AI should implement a feature without understanding the existing architecture.

---

# Business Rules

All AI must follow these rules.

## Inventory Usage

Usage is calculated automatically.

Formula

```text
Usage

=

Beginning Stock

+

Purchases

-

Ending Count
```

Users must never manually enter Usage.

---

## Beginning Stock

Beginning Stock is entered manually only once.

After that

Beginning Stock

=

Previous Ending Count

---

## FIFO

Inventory consumption always follows FIFO.

The oldest available lot must be consumed first.

---

## Multi-Branch

Every transaction belongs to one Branch.

All pages must support

* All Branches
* Individual Branch

---

## Audit Log

Every inventory transaction must generate an Audit Log.

Nothing should overwrite historical records.

---

# Coding Standards

* Keep components modular.
* Use reusable components.
* Avoid duplicate code.
* Follow TypeScript best practices.
* Use asynchronous Supabase operations.
* Separate UI from business logic.
* Keep database operations inside repository/service layers.

---

# Database Rules

Every new table must include:

* Primary Key
* Created At
* Updated At
* Branch ID (if applicable)

Use Foreign Keys whenever possible.

Do not duplicate inventory data.

---

# UI Rules

All pages should follow the same design language.

Use consistent

* Buttons
* Tables
* Forms
* Search
* Filters

Search should always support:

* Item Code
* Item Name

Where applicable, pages should also support filtering by:

* Category
* Supplier
* Branch

---

# Security Rules

Future authentication must support:

* Administrator
* Manager
* Employee

Never expose sensitive data to unauthorized users.

---

# Future Features

The following features are planned and should be considered during development:

* Audit Log
* FIFO
* Lot Number
* Expiry Alerts
* Barcode Scanning
* Notifications
* Mobile Support
* Offline Support
* AI Forecasting
* Purchase Suggestions

Do not design features that conflict with these future requirements.

---

# Version Control Guidelines

Every significant feature should include:

* Description
* Date
* Version
* Developer / AI Used
* Files Modified

Maintain a clear change history for future maintenance.

---

# Development Philosophy

This project prioritizes:

1. Accuracy over speed
2. Data integrity over convenience
3. Scalability for future expansion
4. Clear documentation
5. Consistent user experience
6. Traceable inventory transactions

Every change should make the system more reliable, maintainable, and scalable.

---

# Recommended Development Workflow

1. Review Documentation
2. Analyze Existing Code
3. Create Development Plan
4. Implement One Feature at a Time
5. Test Thoroughly
6. Update Documentation
7. Commit Changes
8. Deploy After Verification

---
