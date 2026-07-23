# Business Rules

## Purpose

This document defines the core business logic used throughout the Inventory Stock Management System.

All calculations, inventory movements, reports, and future features must follow these rules.

These business rules are considered the **single source of truth** for the system.

---

# 1. Beginning Stock

### Rule

Beginning Stock is entered manually only once during the initial system setup.

After the first inventory period, Beginning Stock must never be edited manually.

Instead, the system automatically carries forward the previous Ending Count.

Formula

```text
Beginning Stock (Current Period)

=

Ending Count (Previous Period)
```

---

# 2. Purchase

### Rule

Every Purchase increases inventory.

Each purchase record must contain

* Branch
* Supplier
* Purchase Date
* Item
* Quantity
* Unit Cost
* Expiry Date (Optional)
* Remark

Every Purchase automatically creates a new Lot Number.

---

# 3. Stock Count

Stock Count represents the actual physical inventory remaining.

Users only enter

* Remaining Quantity

The system calculates inventory usage automatically.

Users never manually enter inventory usage.

---

# 4. Inventory Usage Formula

The system calculates Usage using

```text
Usage

=

Beginning Stock

+

Purchases

-

Ending Count
```

This formula applies to every reporting period.

Supported periods

* Daily
* Every 3 Days
* Every 5 Days
* Every 7 Days
* Monthly
* Custom Date Range

---

# 5. Multi-Branch

Every inventory record belongs to one branch.

Every page must support

* All Branches
* Individual Branch

Changing the selected Branch automatically updates

* Dashboard
* Inventory Analysis
* Purchase
* Stock Count
* Beginning Stock
* Reports

---

# 6. FIFO

Inventory consumption follows the FIFO principle.

The oldest available Lot must always be consumed first.

The system automatically decreases Remaining Quantity from the oldest Lot before moving to newer Lots.

Users cannot manually choose which Lot is consumed.

---

# 7. Lot Number

Every Purchase automatically generates a unique Lot Number.

Format

```text
YYYYMMDD-BRANCH-0001
```

Example

```text
20260723-BGK-0001
```

Each Lot stores

* Purchase Date
* Expiry Date
* Quantity
* Remaining Quantity
* Unit Cost
* Supplier

---

# 8. Expiry Management

Each inventory item supports

* No Expiry
* Fixed Shelf Life
* Custom Shelf Life

Examples

* 30 Days
* 90 Days
* 180 Days
* 365 Days

The system automatically calculates Expiry Date.

---

# 9. Expiry Alert

Inventory status

🟢 Normal

More than warning period remaining

🟡 Near Expiry

Within warning period

🔴 Expired

Past expiry date

Dashboard must display

* Near Expiry Items
* Expired Items

---

# 10. Audit Log

Every inventory activity must be permanently recorded.

Examples

* Beginning Stock
* Purchase
* Stock Count
* Inventory Adjustment
* Item Update
* Supplier Update
* Import
* Delete

Every log stores

* Timestamp
* Branch
* User
* Module
* Action
* Item
* Before Value
* After Value
* Remark

Audit Log records cannot be edited or deleted.

---

# 11. History

The system stores all historical data.

History includes

* Purchase History
* Stock Count History
* Beginning Stock History
* Audit Log

Users can

* Search
* Filter
* Export Excel

Historical records are never overwritten.

---

# 12. Inventory Analysis

Inventory Analysis displays

* Beginning Stock
* Purchases
* Ending Count
* Usage

The system recalculates values automatically when users change

* Branch
* Reporting Period

---

# 13. Dashboard

Dashboard displays

* Total Inventory
* Total Purchases
* Total Usage
* Low Stock
* Near Expiry
* Expired
* Charts
* Summary Cards

Dashboard supports

* All Branches
* Individual Branch

---

# 14. Search & Filter

The following pages must support instant search

* Purchase
* Stock Count
* Inventory Analysis

Users can search by

* Item Code
* Item Name

Users can filter by

* Category
* Supplier

Filtering should update instantly without reloading the page.

---

# 15. Data Integrity Rules

The system must ensure

* Inventory quantities cannot be negative
* Lot quantities cannot exceed purchased quantities
* Every transaction belongs to one Branch
* Every transaction is timestamped
* Historical records are immutable
* Every inventory movement is traceable

---

# 16. Future User Roles

The system will support

### Administrator

Full access to all modules.

### Manager

Can view reports and approve inventory.

### Employee

Can only perform assigned operational tasks such as Purchase or Stock Count.

