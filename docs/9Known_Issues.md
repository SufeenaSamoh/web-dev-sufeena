# 09_Known_Issues.md
Known Issues
Purpose

This document records all known bugs, limitations, and pending improvements.

Developers should review this document before implementing new features.

High Priority
Beginning Stock

Status

🚧 In Progress

Problem

Beginning Stock still requires manual setup during the first implementation.

Expected

Beginning Stock should automatically use the latest completed Stock Count.

Multi Branch

Status

🚧 In Progress

Problem

Not every page currently supports Branch selection.

Required Pages

Dashboard
Purchase
Stock Count
Inventory Analysis
Beginning Stock
Audit Log

Status

❌ Not Implemented

Problem

Inventory transactions are not permanently recorded.

Required

Purchase History
Stock Count History
Inventory Adjustment History
FIFO

Status

❌ Not Implemented

Problem

Inventory consumption does not yet follow FIFO.

Required

Automatic Lot consumption.

Lot Number

Status

❌ Not Implemented

Problem

Purchase records do not generate Lot Numbers.

Expiry Alert

Status

❌ Not Implemented

Problem

Dashboard does not warn about near-expiry items.

Medium Priority
Notifications

Status

Planned

Required

Low Stock
Near Expiry
Daily Summary
User Permissions

Status

Planned

Need

Administrator

Manager

Employee

Barcode

Status

Future

Need

Barcode Scanner

QR Code

Mobile

Status

Future

Need

Tablet Optimization

PWA

Offline Mode

Enhancement Requests

The following features are requested but not yet scheduled.

AI Purchase Forecast
Supplier Price Comparison
Automatic Purchase Suggestions
Dead Stock Report
Inventory Value Trend
Branch Comparison Dashboard
Email Notification
LINE Notification
Issue Tracking Format

Every issue should follow this format.

Issue ID

Priority

Status

Description

Expected Behavior

Current Behavior

Assigned To

Target Version

Remarks
Bug Status Legend
Status	Meaning
✅ Completed	แก้ไขเรียบร้อย
🚧 In Progress	กำลังพัฒนา
⏳ Pending	รอพัฒนา
❌ Not Implemented	ยังไม่ได้เริ่ม
🐞 Bug	พบข้อผิดพลาด
💡 Enhancement	ฟีเจอร์เพิ่มเติม