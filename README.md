# Laboratory Inventory Management System

A comprehensive laboratory inventory tracking application built with Tauri v2, React, TypeScript, and SQLite. This system provides complete inventory management capabilities including real-time tracking, analytics, and data management.

## Features

### Core Functionality
- **Site Management**: Manage multiple laboratory sites with locations and contact information
- **Reagent & Lot Tracking**: Track reagents and their specific lot numbers with expiration dates
- **Inventory Records**: Real-time inventory tracking with quantity on hand and usage patterns
- **Shipment Management**: Track incoming shipments with received dates and quantities
- **Transfer Management**: Manage inter-site transfers of inventory
- **Dashboard**: Real-time risk alerts and overview statistics

### Analytics & Reporting
- **Cumulative Flow Diagrams (CFD)**: Visualize inventory flow over time
- **Interactive Charts**: Show/hide chart components with clickable legend
- **Usage Statistics**: Calculate consumption rates and projected remaining days
- **Aggregated Views**: View data across all sites or drill down to specific site/lot combinations
- **Date Simulation**: Time-travel through data to see historical states

### Data Management
- **Export**: Export data in JSON or CSV formats for backup or analysis
- **Import**: Import data from previously exported files
- **Debug Tools**: Database seeding with realistic data and reset functionality

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Tauri v2 with Rust
- **Database**: SQLite with Tauri SQL plugin
- **UI Framework**: Material-UI (MUI)
- **Charts**: Recharts library
- **Platform**: Cross-platform (Windows, macOS, Linux)

## Prerequisites

- Node.js (v18 or later)
- Rust (latest stable)
- Platform-specific dependencies for Tauri development

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd inventory-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

## Database Schema

The application uses SQLite with the following tables:

- **sites**: Laboratory sites and locations
- **reagents**: Chemical reagents and materials
- **lots**: Specific lot numbers with expiration dates
- **shipments**: Incoming inventory shipments
- **transfers**: Inter-site inventory transfers
- **inventory_records**: Point-in-time inventory snapshots

## Usage Guide

### Getting Started
1. Launch the application
2. Use **Debug Tools** to seed the database with sample data
3. Navigate through the different sections using the sidebar

### Managing Sites
- Add laboratory sites with names and locations
- Toggle sites active/inactive
- View site-specific inventory and transfers

### Tracking Reagents & Lots
- Create reagents with descriptions
- Add lots with expiration dates
- Monitor lot status (active, expiring soon, expired)

### Recording Inventory
- Create inventory snapshots showing quantity on hand
- Track who recorded the inventory and when
- View historical inventory levels

### Managing Shipments & Transfers
- Record incoming shipments with quantities and dates
- Track inter-site transfers
- Monitor shipment status (in transit, received)

### Analytics & Reports
- View cumulative flow diagrams showing total received vs. used
- Toggle chart components on/off with interactive legend
- Simulate different dates to see historical data
- View aggregated data across all sites or detailed site-specific data

### Data Management
- Export data for backup or analysis (JSON/CSV formats)
- Import data from other systems or backups
- Choose specific tables or export everything

## Key Features Explained

### Cumulative Flow Diagrams (CFD)
The reports section provides sophisticated inventory analytics:
- **Green Area**: Total inventory received (shipments + transfers in - transfers out)
- **Red Area**: Total inventory consumed (calculated from inventory records)
- **Blue Line**: Current inventory on hand
- **Orange Line**: Low stock threshold (5 units)

### Date Simulation
Use the date picker in reports to:
- View historical inventory states
- See what inventory looked like on any past date
- Project future scenarios based on current trends

### Interactive Legend
Click the colored chips above charts to:
- Show/hide specific chart components
- Focus on particular aspects of the data
- Customize the view for presentations or analysis

### Risk Alerts Dashboard
The dashboard automatically identifies:
- Expired lots with remaining inventory
- Lots expiring within 30 days
- Low stock situations (< 5 units)
- Sites without recent inventory records

## Data Seeding

The debug tools include a sophisticated seeding system that creates:
- 5 laboratory sites
- 8 different reagents
- 16-24 lots with varied expiration dates
- Systematic quarterly shipments (every site gets every lot)
- Realistic consumption patterns (~0.52 boxes/day)
- Mathematical inventory calculations based on usage over time

## File Structure

```
src/
├── components/           # React components
│   ├── DashboardPage.tsx       # Dashboard with risk alerts
│   ├── SitesPage.tsx          # Site management
│   ├── ReagentsLotsPage.tsx   # Reagent and lot management
│   ├── InventoryPage.tsx      # Inventory recording
│   ├── ShipmentsTransfersPage.tsx # Shipment and transfer management
│   ├── ReportsPage.tsx        # Analytics and CFD charts
│   ├── DataManagementPage.tsx # Import/export functionality
│   ├── DebugPage.tsx          # Database tools
│   └── MainLayout.tsx         # Main application layout
├── utils/
│   └── database.ts       # Database utilities
├── types/
│   └── index.ts         # TypeScript type definitions
└── main.tsx            # Application entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Support

For issues and questions:
1. Check the troubleshooting section in CLAUDE.md
2. Review the debug tools for database issues
3. Check browser console for error messages

## Future Enhancements

Potential improvements include:
- Barcode scanning integration
- Advanced reporting features
- Multi-user support with authentication
- Mobile app version
- Integration with lab equipment
- Advanced alerting and notifications
