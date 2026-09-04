# Workflow Documentation

## Purpose

This document describes how data flows through the Inventory Stock Management System.

It explains the business workflow from purchasing inventory to reporting inventory usage.

---

# Overall Workflow

```text
Master Data
        │
        ▼
Beginning Stock
        │
        ▼
Purchase / Receiving
        │
        ▼
Inventory Lots (FIFO)
        │
        ▼
Stock Count
        │
        ▼
Inventory Usage Calculation
        │
        ▼
Inventory Analysis
        │
        ▼
Dashboard
        │
        ▼
Audit Log
```

---

# Workflow 1 : Master Data

Purpose

Prepare all reference data before using the system.

Modules

- Items
- Suppliers
- Categories
- Units
- Branches

Only administrators can manage Master Data.

---

# Workflow 2 : Beginning Stock

Step 1

Create Beginning Stock during system setup.

↓

Step 2

After the first inventory period

↓

Beginning Stock is generated automatically from the latest Ending Count.

Users do not manually update Beginning Stock again.

---

# Workflow 3 : Purchase / Receiving

User selects

- Branch
- Supplier

↓

Search Item

↓

Enter

- Quantity
- Unit Cost
- Expiry Date
- Remark

↓

System creates

- Purchase Record
- Purchase Item
- Lot Number

↓

Current Stock increases

↓

Audit Log is created

---

# Workflow 4 : FIFO Lot Management

Every Purchase creates a new Lot.

Example

```text
Lot A

20 kg

Received 1 July

Expires 31 July

↓

Lot B

15 kg

Received 10 July

Expires 10 August
```

When inventory is consumed

System always uses

Lot A

before

Lot B

Remaining Quantity is updated automatically.

---

# Workflow 5 : Stock Count

Employee selects

- Branch
- Date

↓

Search Item

↓

Enter physical inventory remaining

↓

Save

↓

System creates Stock Count record

↓

Audit Log

↓

Beginning Stock for the next period is updated automatically

---

# Workflow 6 : Inventory Calculation

System calculates

```text
Usage

=

Beginning Stock

+

Purchases

-

Ending Count
```

No manual usage entry is required.

---

# Workflow 7 : Inventory Analysis

Manager selects

- Branch
- Reporting Period

↓

System retrieves

- Beginning Stock
- Purchases
- Ending Count

↓

Calculates Usage

↓

Displays Analysis Table

---

# Workflow 8 : Dashboard

Dashboard displays

- Inventory Summary
- Purchase Summary
- Usage Summary
- Low Stock
- Near Expiry
- Expired Items

Dashboard supports

- All Branches
- Individual Branch

---

# Workflow 9 : Expiry Monitoring

Purchase creates Expiry Date

↓

System checks daily

↓

Inventory Status

🟢 Normal

↓

🟡 Near Expiry

↓

🔴 Expired

Dashboard displays warning automatically.

---

# Workflow 10 : Audit Log

Every transaction

↓

Automatically creates Audit Log

↓

Stores

- Timestamp
- Branch
- User
- Module
- Before Value
- After Value
- Remark

Audit Log cannot be deleted.

---

# Workflow 11 : Multi-Branch

Every transaction belongs to one Branch.

Branch selector is available on

- Dashboard
- Inventory Analysis
- Purchase
- Stock Count
- Beginning Stock

Selecting another Branch updates all calculations instantly.

---

# Workflow 12 : Historical Data

The system never overwrites historical records.

Every Purchase

↓

Stored permanently

↓

Every Stock Count

↓

Stored permanently

↓

Every Audit Log

↓

Stored permanently

Users can

- Search
- Filter
- Export Excel

---

# Inventory Lifecycle

```text
Create Item
        │
        ▼
Beginning Stock
        │
        ▼
Purchase
        │
        ▼
Create Lot
        │
        ▼
FIFO
        │
        ▼
Stock Count
        │
        ▼
Calculate Usage
        │
        ▼
Inventory Analysis
        │
        ▼
Dashboard
        │
        ▼
Audit Log
```

---

# Workflow Principles

The system follows these principles:

- Every inventory movement is recorded.
- Inventory usage is always calculated automatically.
- FIFO is applied consistently.
- Historical data is immutable.
- Every transaction is associated with a Branch.
- Every change is traceable through Audit Logs.
- The latest Stock Count becomes the Beginning Stock of the next inventory period.
- Reports and dashboards are recalculated dynamically based on the selected Branch and reporting period.

---
