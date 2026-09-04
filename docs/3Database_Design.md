# Database Design

## Overview

The Inventory Stock Management System uses **Supabase (PostgreSQL)** as the central database.

The database is designed to support:

- Multi-Branch Inventory Management
- Purchase & Receiving
- Beginning Stock
- Stock Count
- Automatic Inventory Usage Calculation
- FIFO Inventory Management
- Lot Tracking
- Expiry Management
- Audit Log
- Dashboard & Reporting

All inventory transactions are stored permanently and can be traced historically.

---

# Database Tables

## 1. branches

Stores restaurant branch information.

### Purpose

Each inventory transaction belongs to exactly one branch.

### Main Fields

- Branch ID
- Branch Code
- Branch Name
- Address
- Status

---

## 2. categories

Stores inventory categories.

### Examples

- ปลา
- เนื้อ
- ผัก
- เครื่องปรุง
- เครื่องดื่ม
- บรรจุภัณฑ์

### Main Fields

- Category ID
- Category Name

---

## 3. suppliers

Stores supplier information.

### Main Fields

- Supplier ID
- Supplier Name
- Contact Person
- Phone
- Email
- Address
- Status

---

## 4. units

Stores measurement units.

### Examples

- kg
- g
- pcs
- pack
- bottle
- tray

### Main Fields

- Unit ID
- Unit Name
- Unit Abbreviation

---

## 5. items

Stores all inventory items.

### Main Fields

- Item ID
- Item Code
- Item Name
- Category
- Supplier
- Unit
- Current Stock
- Minimum Stock
- Has Expiry Date
- Expiry Warning Days
- Status

Each item belongs to one Category and one Unit.

---

## 6. beginning_stock

Stores the initial inventory balance.

### Purpose

Only entered during initial system setup.

After the first stock count, Beginning Stock is generated automatically.

### Main Fields

- Branch
- Item
- Quantity
- Date

---

## 7. purchases

Stores purchase document headers.

### Main Fields

- Purchase ID
- Purchase Number
- Branch
- Supplier
- Purchase Date
- Total Amount
- Remark

---

## 8. purchase_items

Stores purchased inventory items.

### Main Fields

- Purchase
- Item
- Quantity
- Unit Price
- Expiry Date
- Lot Number
- Remaining Quantity
- Remark

Each Purchase may contain multiple Purchase Items.

---

## 9. stock_counts

Stores stock count document headers.

### Main Fields

- Stock Count ID
- Branch
- Count Date
- Remark

---

## 10. stock_count_items

Stores physical inventory counts.

### Main Fields

- Stock Count
- Item
- Count Quantity
- Remark

The latest completed Stock Count automatically becomes the Beginning Stock of the next inventory period.

---

## 11. inventory_analysis

This table is optional.

Inventory usage can be calculated dynamically without storing data.

### Formula

Usage = Beginning Stock + Purchases − Ending Count

---

## 12. lots

Stores inventory lots for FIFO.

### Main Fields

- Lot Number
- Item
- Purchase
- Purchase Date
- Expiry Date
- Original Quantity
- Remaining Quantity
- Unit Cost
- Status

Each Purchase creates one or more inventory lots.

---

## 13. audit_logs

Stores all inventory activities.

### Main Fields

- Log ID
- Timestamp
- User
- Branch
- Module
- Action
- Item
- Before Quantity
- After Quantity
- Remark

Every inventory transaction must generate an Audit Log record.

---

## 14. users

Stores application users.

### Main Fields

- User ID
- Full Name
- Email
- Role
- Branch
- Status

Future Roles

- Administrator
- Manager
- Employee

---

# Database Relationships

The database follows a relational design.

```
Branch
│
├── Purchase
│      └── Purchase Items
│                └── Lots
│
├── Beginning Stock
│
├── Stock Count
│      └── Stock Count Items
│
├── Audit Log
│
└── Users

Category
│
└── Items

Supplier
│
├── Items
└── Purchases

Unit
│
└── Items
```

---

# Inventory Calculation Logic

The system does **not** require users to manually enter inventory usage.

Inventory Usage is calculated automatically using the following formula:

```
Usage
=
Beginning Stock
+
Purchases
-
Ending Count
```

After each completed Stock Count:

```
Beginning Stock (Next Period)
=
Ending Count (Current Period)
```

This calculation works for:

- Every 3 days
- Every 5 days
- Every 7 days
- Monthly
- Custom reporting periods

---

# Design Principles

- Centralized cloud database using Supabase
- Fully supports Multi-Branch operations
- Every transaction is permanently stored
- Supports historical reporting and auditing
- FIFO inventory management using Lot Numbers
- Expiry date tracking and alerts
- Scalable architecture for future system expansion
- No data should ever be overwritten; all changes must be traceable through Audit Logs

---
