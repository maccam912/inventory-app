# Inventory Tracking Tauri App - Development Guide

## Project Overview
Building a Tauri-based inventory tracking application for managing laboratory reagent lots across multiple sites.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **Database**: SQLite with Tauri SQL plugin
- **UI Framework**: Material-UI
- **Charts**: Recharts for reporting

## Core Concepts

### Entities
1. **Sites** - Different laboratory locations
2. **Lots** - Specific batches of reagents with expiration dates
3. **Shipments** - Deliveries of lots to sites
4. **Transfers** - Movement of reagents between sites
5. **Inventory Records** - Point-in-time stock counts

### User Roles
- **Admins**: Full CRUD access to all entities, can view reports
- **Regular Users**: Can record inventory counts and lot start dates

### Key Features
- Track reagent lots with expiration dates
- Monitor stock levels across sites
- Record shipments and transfers
- Generate usage reports and alerts
- Prevent waste through transfer recommendations

## Database Schema (Planned)

### Sites
- id, name, location, active status

### Lots
- id, reagent_name, lot_number, expiration_date, total_quantity

### Shipments
- id, lot_id, site_id, quantity, shipped_date, received_date

### Transfers
- id, lot_id, from_site_id, to_site_id, quantity, transfer_date

### Inventory_Records
- id, lot_id, site_id, quantity_on_hand, recorded_date, recorded_by

## Development Commands

### Prerequisites
1. **Install Rust**: Visit https://rustup.rs/ and follow installation instructions
2. **Install Node.js dependencies**: `npm install`

### Running the App
```bash
# Start development server (requires Rust)
npm run tauri dev

# Build for production (requires Rust)
npm run tauri build

# Build just the frontend (for testing React components)
npm run dev
```

## Current Status
✅ **Project Foundation**
- Tauri project structure with React + TypeScript
- SQLite database with complete schema migrations
- Material-UI setup with responsive layout

✅ **Database & Backend** 
- Complete SQLite database with schema migrations
- Direct SQL calls from frontend (Tauri v2 pattern)
- Full CRUD operations for Sites, Reagents, and Lots
- Proper error handling and type safety

✅ **Completed Features**
- **Sites Management**: Full CRUD with active/inactive status
- **Reagents Management**: Add, edit, delete reagents with descriptions  
- **Lots Management**: Lot tracking with expiration date monitoring
- **Smart Expiration Alerts**: Visual indicators for expired/expiring lots

🚧 **Next Features**
- Inventory recording interface
- Shipment and transfer management
- Reporting dashboard with charts

## Key Features Implemented

### Sites Management
- Add laboratory sites with locations
- Edit site information and status
- Delete sites with confirmation
- Active/inactive status tracking

### Reagents & Lots Management  
- Two-tab interface for reagents and lots
- Reagent creation with name and description
- Lot creation linked to specific reagents
- Expiration date tracking with color-coded status:
  - 🔴 Expired (past expiration)
  - 🟡 Expiring soon (within 30 days)
  - 🟢 Active (good condition)

### Technical Architecture
- **Frontend**: React + TypeScript + Material-UI
- **Backend**: Rust with Tauri framework
- **Database**: SQLite with automatic migrations
- **Communication**: Direct SQL calls using @tauri-apps/plugin-sql (v2 pattern)
- **Build Status**: ✅ TypeScript compilation successful, no errors
- **Debug Features**: Added extensive logging and error handling for database operations
- **Form Validation**: Added client-side validation for all forms
- **Database Connection**: Centralized database management with connection testing

## Project Structure (Planned)
```
src/                    # React frontend
├── components/         # React components
├── pages/             # Page components
├── hooks/             # Custom hooks
├── types/             # TypeScript types
└── utils/             # Utilities

src-tauri/             # Rust backend
├── src/               # Rust source
├── Cargo.toml         # Rust dependencies
└── tauri.conf.json    # Tauri configuration
```