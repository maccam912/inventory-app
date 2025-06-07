import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  DeleteForever as ResetIcon,
  AutoFixHigh as SeedIcon,
  BugReport as TestIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';
import { getDatabase } from '../utils/database';

const DebugPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'seed' | null>(null);
  const [includeTransfers, setIncludeTransfers] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const runImportExportTests = async () => {
    setLoading(true);
    setMessage(null);
    setTestResults(null);

    try {
      const db = await getDatabase();
      
      // Create test data with relationships
      const testData = {
        sites: [
          { name: 'Test Site A', location: 'Test Location A', is_active: true },
          { name: 'Test Site B', location: 'Test Location B', is_active: true }
        ],
        reagents: [
          { name: 'Test Reagent 1', description: 'Test Description 1' },
          { name: 'Test Reagent 2', description: 'Test Description 2' }
        ]
      };

      // Test 1: Insert test data and get IDs for relationships
      const siteResults = [];
      const reagentResults = [];
      
      for (const site of testData.sites) {
        const result = await db.select('INSERT INTO sites (name, location, is_active) VALUES ($1, $2, $3) RETURNING id', 
                                     [site.name, site.location, site.is_active]);
        siteResults.push(result[0].id);
      }
      
      for (const reagent of testData.reagents) {
        const result = await db.select('INSERT INTO reagents (name, description) VALUES ($1, $2) RETURNING id', 
                                     [reagent.name, reagent.description]);
        reagentResults.push(result[0].id);
      }

      // Create a test lot with foreign key relationship
      const lotResult = await db.select('INSERT INTO lots (lot_number, reagent_id, expiration_date) VALUES ($1, $2, $3) RETURNING id', 
                                       ['TEST-LOT-001', reagentResults[0], '2024-12-31']);
      const lotId = lotResult[0].id;

      // Create a test shipment
      await db.execute('INSERT INTO shipments (lot_id, site_id, quantity, shipped_date, received_date) VALUES ($1, $2, $3, $4, $5)',
                      [lotId, siteResults[0], 50, '2024-01-15', '2024-01-16']);

      // Create a test transfer
      await db.execute('INSERT INTO transfers (lot_id, from_site_id, to_site_id, quantity, transfer_date) VALUES ($1, $2, $3, $4, $5)',
                      [lotId, siteResults[0], siteResults[1], 10, '2024-02-01']);

      // Create a test inventory record
      await db.execute('INSERT INTO inventory_records (lot_id, site_id, quantity_on_hand, recorded_date, recorded_by) VALUES ($1, $2, $3, $4, $5)',
                      [lotId, siteResults[0], 40, '2024-02-15', 'Test User']);

      // Test 2: Export simulation (get all test data including relationships)
      const exportData = {
        sites: await db.select('SELECT * FROM sites WHERE name LIKE \'Test%\' ORDER BY id'),
        reagents: await db.select('SELECT * FROM reagents WHERE name LIKE \'Test%\' ORDER BY id'),
        lots: await db.select('SELECT * FROM lots WHERE lot_number LIKE \'TEST%\' ORDER BY id'),
        shipments: await db.select(`
          SELECT s.* FROM shipments s 
          JOIN lots l ON s.lot_id = l.id 
          WHERE l.lot_number LIKE 'TEST%' ORDER BY s.id
        `),
        transfers: await db.select(`
          SELECT t.* FROM transfers t 
          JOIN lots l ON t.lot_id = l.id 
          WHERE l.lot_number LIKE 'TEST%' ORDER BY t.id
        `),
        inventory_records: await db.select(`
          SELECT ir.* FROM inventory_records ir 
          JOIN lots l ON ir.lot_id = l.id 
          WHERE l.lot_number LIKE 'TEST%' ORDER BY ir.id
        `)
      };

      console.log('Export data structure:', exportData);

      // Test 3: Simulate import process (same logic as DataManagementPage)
      const tables = ['sites', 'reagents', 'lots', 'shipments', 'transfers', 'inventory_records'];
      let importResults: any = {};
      
      for (const table of tables) {
        if (exportData[table] && Array.isArray(exportData[table])) {
          const data = exportData[table];
          importResults[table] = {
            found: true,
            count: data.length,
            sample: data[0] || null
          };
          
          // Test import logic on first row
          if (data.length > 0) {
            const row = data[0];
            const { id, created_at, updated_at, ...rowData } = row;
            const columns = Object.keys(rowData);
            const values = Object.values(rowData);
            
            importResults[table].columns = columns;
            importResults[table].values = values;
            importResults[table].hasData = Object.keys(rowData).length > 0;
          }
        } else {
          importResults[table] = {
            found: false,
            count: 0,
            issue: `Table ${table} not found or not an array in export data`
          };
        }
      }

      // Clean up test data (in correct order)
      await db.execute(`
        DELETE FROM inventory_records 
        WHERE lot_id IN (SELECT id FROM lots WHERE lot_number LIKE 'TEST%')
      `);
      await db.execute(`
        DELETE FROM transfers 
        WHERE lot_id IN (SELECT id FROM lots WHERE lot_number LIKE 'TEST%')
      `);
      await db.execute(`
        DELETE FROM shipments 
        WHERE lot_id IN (SELECT id FROM lots WHERE lot_number LIKE 'TEST%')
      `);
      await db.execute('DELETE FROM lots WHERE lot_number LIKE \'TEST%\'');
      await db.execute('DELETE FROM reagents WHERE name LIKE \'Test%\'');
      await db.execute('DELETE FROM sites WHERE name LIKE \'Test%\'');

      setTestResults({
        success: true,
        exportData,
        importResults,
        summary: {
          totalTables: tables.length,
          tablesWithData: Object.values(importResults).filter((r: any) => r.found && r.count > 0).length,
          emptyTables: Object.values(importResults).filter((r: any) => r.found && r.count === 0).length,
          missingTables: Object.values(importResults).filter((r: any) => !r.found).length
        }
      });

      const issues = Object.entries(importResults).filter(([table, result]: [string, any]) => 
        !result.found || !result.hasData
      );

      if (issues.length === 0) {
        setMessage('✅ Import/Export unit tests PASSED! All tables correctly structured.');
      } else {
        setMessage(`⚠️ Import/Export tests completed with ${issues.length} issues found.`);
      }

    } catch (error) {
      console.error('Unit tests failed:', error);
      setMessage(`❌ Unit tests failed: ${error}`);
      setTestResults({ success: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const resetDatabase = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const db = await getDatabase();
      
      // Delete all data from tables in correct order (respecting foreign keys)
      await db.execute('DELETE FROM inventory_records');
      await db.execute('DELETE FROM transfers');
      await db.execute('DELETE FROM shipments');
      await db.execute('DELETE FROM lots');
      await db.execute('DELETE FROM reagents');
      await db.execute('DELETE FROM sites');
      await db.execute('DELETE FROM users');
      
      setMessage('Database reset successfully! All data has been cleared.');
    } catch (error) {
      console.error('Failed to reset database:', error);
      setMessage(`Failed to reset database: ${error}`);
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      setConfirmAction(null);
    }
  };

  const seedDatabase = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const db = await getDatabase();
      
      // Insert sample sites
      const sites = [
        ['Lab A', 'Building 1, Floor 2'],
        ['Lab B', 'Building 1, Floor 3'],
        ['Lab C', 'Building 2, Floor 1'],
        ['Storage Facility', 'Building 3'],
        ['Research Lab', 'Building 2, Floor 2'],
      ];
      
      for (const [name, location] of sites) {
        await db.execute('INSERT INTO sites (name, location) VALUES ($1, $2)', [name, location]);
      }

      // Insert sample reagents
      const reagents = [
        ['Sodium Chloride', 'Common salt, NaCl'],
        ['Ethanol', '95% ethyl alcohol'],
        ['Hydrochloric Acid', 'HCl, 1M solution'],
        ['Glucose', 'D-glucose, analytical grade'],
        ['Buffer Solution', 'pH 7.4 phosphate buffer'],
        ['Acetone', 'HPLC grade acetone'],
        ['Methanol', 'Analytical grade methanol'],
        ['Potassium Hydroxide', 'KOH pellets'],
      ];
      
      for (const [name, description] of reagents) {
        await db.execute('INSERT INTO reagents (name, description) VALUES ($1, $2)', [name, description]);
      }

      // Get inserted IDs
      const siteResults = await db.select<{id: number}[]>('SELECT id FROM sites ORDER BY id');
      const reagentResults = await db.select<{id: number}[]>('SELECT id FROM reagents ORDER BY id');
      
      const siteIds = siteResults.map(s => s.id);
      const reagentIds = reagentResults.map(r => r.id);

      // Insert sample lots with varied expiration dates
      const lots = [];
      const baseDate = new Date();
      
      for (let i = 0; i < reagentIds.length; i++) {
        const reagentId = reagentIds[i];
        // Create 2-3 lots per reagent
        for (let j = 1; j <= Math.floor(Math.random() * 2) + 2; j++) {
          const lotNumber = `LOT${i + 1}${j.toString().padStart(2, '0')}${new Date().getFullYear()}`;
          // Vary expiration dates: some expired, some expiring soon, some far future
          const daysOffset = Math.floor(Math.random() * 400) - 100; // -100 to +300 days
          const expirationDate = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);
          
          await db.execute(
            'INSERT INTO lots (lot_number, reagent_id, expiration_date) VALUES ($1, $2, $3)',
            [lotNumber, reagentId, expirationDate.toISOString().split('T')[0]]
          );
          lots.push({ reagentId, lotNumber, expirationDate });
        }
      }

      // Get lot IDs
      const lotResults = await db.select<{id: number, reagent_id: number}[]>('SELECT id, reagent_id FROM lots ORDER BY id');

      // STEP 1: Create systematic shipment schedule
      // Each site gets shipments of every lot, 4 times per year (quarterly), same quantity each time
      const yearStartDate = new Date(baseDate.getTime() - 365 * 24 * 60 * 60 * 1000); // Start of simulation year
      const boxesPerShipment = 50; // Standard shipment size
      const shipmentIntervalDays = 90; // Quarterly (every 3 months)
      const shipmentsPerYear = 4;
      
      // Calculate daily usage rate (designed so sites nearly run out by year end)
      // Total boxes per year per site per lot = boxesPerShipment * shipmentsPerYear = 200
      // We want them to use ~95% by year end, so daily usage = (200 * 0.95) / 365
      const dailyUsageRate = (boxesPerShipment * shipmentsPerYear * 0.95) / 365; // ~0.52 boxes per day
      
      console.log(`Seeding with ${boxesPerShipment} boxes per shipment, quarterly schedule, ${dailyUsageRate.toFixed(2)} daily usage rate`);
      
      // Create shipments: every site gets every lot
      for (const lot of lotResults) {
        for (const siteId of siteIds) {
          // Create 4 shipments per year (past 3, future 1)
          for (let quarterIndex = 0; quarterIndex < shipmentsPerYear; quarterIndex++) {
            const shipmentDate = new Date(yearStartDate.getTime() + quarterIndex * shipmentIntervalDays * 24 * 60 * 60 * 1000);
            const shippedDate = new Date(shipmentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Shipped 1 week earlier
            
            // Only shipments that have been received (not future shipments)
            const receivedDate = shipmentDate <= baseDate ? shipmentDate : null;
            
            await db.execute(
              'INSERT INTO shipments (lot_id, site_id, quantity, shipped_date, received_date) VALUES ($1, $2, $3, $4, $5)',
              [
                lot.id, 
                siteId, 
                boxesPerShipment, 
                shippedDate.toISOString().split('T')[0], 
                receivedDate ? receivedDate.toISOString().split('T')[0] : null
              ]
            );
          }
        }
      }

      // STEP 2: Create transfers (if enabled) - small amounts between sites
      const transferLog: { [key: string]: number } = {}; // Track net transfers per site/lot
      
      if (includeTransfers) {
        // Create some realistic transfers (5-10% of inventory moving between sites)
        const numTransfers = Math.floor(lotResults.length * siteIds.length * 0.1); // About 10% of site/lot combinations
        
        for (let i = 0; i < numTransfers; i++) {
          const lot = lotResults[Math.floor(Math.random() * lotResults.length)];
          const fromSiteId = siteIds[Math.floor(Math.random() * siteIds.length)];
          let toSiteId = siteIds[Math.floor(Math.random() * siteIds.length)];
          while (toSiteId === fromSiteId) {
            toSiteId = siteIds[Math.floor(Math.random() * siteIds.length)];
          }
          
          const transferQuantity = Math.floor(Math.random() * 15) + 5; // 5-20 boxes
          const transferDaysAgo = Math.floor(Math.random() * 180) + 30; // 30-210 days ago
          const transferDate = new Date(baseDate.getTime() - transferDaysAgo * 24 * 60 * 60 * 1000);
          
          await db.execute(
            'INSERT INTO transfers (lot_id, from_site_id, to_site_id, quantity, transfer_date) VALUES ($1, $2, $3, $4, $5)',
            [lot.id, fromSiteId, toSiteId, transferQuantity, transferDate.toISOString().split('T')[0]]
          );
          
          // Track transfers for inventory calculations
          const fromKey = `${lot.id}_${fromSiteId}`;
          const toKey = `${lot.id}_${toSiteId}`;
          transferLog[fromKey] = (transferLog[fromKey] || 0) - transferQuantity;
          transferLog[toKey] = (transferLog[toKey] || 0) + transferQuantity;
        }
      }

      // STEP 3: Create realistic inventory records
      const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      
      for (const lot of lotResults) {
        for (const siteId of siteIds) {
          const key = `${lot.id}_${siteId}`;
          
          // Calculate how many shipments this site has received so far
          const receivedShipments = Math.floor((baseDate.getTime() - yearStartDate.getTime()) / (shipmentIntervalDays * 24 * 60 * 60 * 1000)) + 1;
          const clampedShipments = Math.min(receivedShipments, shipmentsPerYear - 1); // Don't count future shipments
          
          // Calculate total boxes received from shipments
          let totalReceived = clampedShipments * boxesPerShipment;
          
          // Add net transfers (if any)
          const netTransfers = transferLog[key] || 0;
          totalReceived += netTransfers;
          
          // Skip if site has no inventory (negative transfers could cause this)
          if (totalReceived <= 0) continue;
          
          // Create ~1 inventory record per month (with some randomness)
          const daysSinceStart = Math.floor((baseDate.getTime() - yearStartDate.getTime()) / (1000 * 60 * 60 * 24));
          const numRecords = Math.floor(daysSinceStart / 30) + Math.floor(Math.random() * 3); // ~1 per month + 0-2 extra
          
          for (let recordIndex = 0; recordIndex < numRecords; recordIndex++) {
            // Random date in the past year
            const recordDaysAgo = Math.floor(Math.random() * Math.min(daysSinceStart, 350));
            const recordDate = new Date(baseDate.getTime() - recordDaysAgo * 24 * 60 * 60 * 1000);
            
            // Calculate how much should have been used by this date
            const daysSinceStartForRecord = Math.floor((recordDate.getTime() - yearStartDate.getTime()) / (1000 * 60 * 60 * 24));
            const expectedUsage = Math.max(0, daysSinceStartForRecord * dailyUsageRate);
            
            // Calculate how much was received by this record date
            const shipmentsReceivedByRecord = Math.floor(daysSinceStartForRecord / shipmentIntervalDays) + 1;
            const clampedShipmentsForRecord = Math.min(shipmentsReceivedByRecord, clampedShipments);
            let receivedByRecord = clampedShipmentsForRecord * boxesPerShipment;
            
            // Add transfers that happened before this record date
            if (includeTransfers) {
              // This is simplified - in reality we'd need to track transfer dates
              receivedByRecord += netTransfers * (daysSinceStartForRecord / daysSinceStart);
            }
            
            // Calculate expected remaining inventory
            const expectedRemaining = Math.max(0, receivedByRecord - expectedUsage);
            
            // Add some randomness (±10%) but keep it realistic
            const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
            const actualRemaining = Math.max(1, Math.floor(expectedRemaining * randomFactor));
            
            // Don't record if we'd have 0 or negative inventory
            if (actualRemaining <= 0) continue;
            
            const recordedBy = users[Math.floor(Math.random() * users.length)];
            
            await db.execute(
              'INSERT INTO inventory_records (lot_id, site_id, quantity_on_hand, recorded_date, recorded_by) VALUES ($1, $2, $3, $4, $5)',
              [lot.id, siteId, actualRemaining, recordDate.toISOString().split('T')[0], recordedBy]
            );
          }
        }
      }

      const transferMsg = includeTransfers ? ', transfers,' : '';
      setMessage(`Database seeded successfully! Sample data has been generated with sites, reagents, lots, systematic quarterly shipments${transferMsg} and realistic inventory records.`);
    } catch (error) {
      console.error('Failed to seed database:', error);
      setMessage(`Failed to seed database: ${error}`);
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      setConfirmAction(null);
    }
  };

  const handleConfirm = () => {
    if (confirmAction === 'reset') {
      resetDatabase();
    } else if (confirmAction === 'seed') {
      seedDatabase();
    }
  };

  const openConfirm = (action: 'reset' | 'seed') => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Debug Tools
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <strong>Warning:</strong> These tools are for development and testing only. 
        Use with caution as they will modify or delete your database data.
      </Alert>

      {message && (
        <Alert severity={message.includes('Failed') ? 'error' : 'success'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      <Box display="flex" gap={3}>
        {/* Reset Database Card */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <ResetIcon color="error" sx={{ mr: 1 }} />
              <Typography variant="h6">Reset Database</Typography>
            </Box>
            <Typography color="textSecondary" paragraph>
              Completely clears all data from the database. This will delete all sites, reagents, 
              lots, shipments, transfers, inventory records, and users.
            </Typography>
            <Button
              variant="contained"
              color="error"
              onClick={() => openConfirm('reset')}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <ResetIcon />}
            >
              {loading && confirmAction === 'reset' ? 'Resetting...' : 'Reset Database'}
            </Button>
          </CardContent>
        </Card>

        {/* Seed Database Card */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <SeedIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Seed Database</Typography>
            </Box>
            <Typography color="textSecondary" paragraph>
              Populates the database with realistic sample data including multiple sites, 
              reagents, lots with varied expiration dates, shipments, and inventory records.
            </Typography>
            
            {/* Seeding Options */}
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Seeding Options:
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeTransfers}
                    onChange={(e) => setIncludeTransfers(e.target.checked)}
                    color="primary"
                  />
                }
                label="Include transfers between sites"
              />
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              onClick={() => openConfirm('seed')}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SeedIcon />}
            >
              {loading && confirmAction === 'seed' ? 'Seeding...' : 'Seed Database'}
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Import/Export Unit Tests */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <TestIcon color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6">Import/Export Unit Tests</Typography>
          </Box>
          <Typography color="textSecondary" paragraph>
            Runs unit tests to verify export/import functionality by creating test data, 
            exporting it, and checking the data structure for completeness.
          </Typography>
          
          <Button
            variant="contained"
            color="warning"
            onClick={runImportExportTests}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <TestIcon />}
            sx={{ mb: 2 }}
          >
            {loading ? 'Running Tests...' : 'Run Unit Tests'}
          </Button>

          {/* Test Results */}
          {testResults && testResults.success && (
            <Box mt={2}>
              <Typography variant="h6" gutterBottom>
                Test Results
              </Typography>
              
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Tables: {testResults.summary.tablesWithData} with data, {testResults.summary.emptyTables} empty, {testResults.summary.missingTables} missing
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
                {Object.entries(testResults.importResults).map(([table, result]: [string, any]) => (
                  <Box key={table} sx={{ minWidth: 150 }}>
                    <Typography variant="body2" color="textSecondary">
                      {table.replace('_', ' ')}
                    </Typography>
                    <Typography variant="body1">
                      {result.found ? (
                        <>
                          {result.count} records {result.hasData ? '✅' : '⚠️'}
                          {!result.hasData && result.count > 0 && ' (no data)'}
                        </>
                      ) : (
                        '❌ missing'
                      )}
                    </Typography>
                    {result.issue && (
                      <Typography variant="caption" color="error">
                        {result.issue}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              {Object.entries(testResults.importResults).some(([table, result]: [string, any]) => !result.found || (result.count > 0 && !result.hasData)) && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Issues Found:
                  </Typography>
                  <Box component="ul" sx={{ mb: 0 }}>
                    {Object.entries(testResults.importResults)
                      .filter(([table, result]: [string, any]) => !result.found || (result.count > 0 && !result.hasData))
                      .map(([table, result]: [string, any]) => (
                        <li key={table}>
                          <Typography variant="body2">
                            <strong>{table}:</strong> {result.issue || 'Data structure missing required fields'}
                          </Typography>
                        </li>
                      ))}
                  </Box>
                </Alert>
              )}
            </Box>
          )}

          {testResults && !testResults.success && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Tests Failed
              </Typography>
              <Typography variant="body2">
                {testResults.error}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Data Overview */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sample Data Overview
          </Typography>
          <Typography variant="body2" color="textSecondary">
            The seed operation will create:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0 }}>
            <li>5 laboratory sites with different locations</li>
            <li>8 different reagents with descriptions</li>
            <li>16-24 lots with varied expiration dates (some expired, some expiring soon, some future)</li>
            <li><strong>Systematic shipments:</strong> Every site gets every lot quarterly (4 times/year) with 50 boxes each</li>
            <li><strong>Realistic usage:</strong> ~0.52 boxes/day consumption rate (designed to nearly run out by year end)</li>
            <li>Inter-site transfers affecting inventory flow (if enabled)</li>
            <li><strong>Smart inventory records:</strong> ~1 per month per site/lot, calculated from shipments minus realistic usage over time</li>
          </Box>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          {confirmAction === 'reset' ? 'Reset Database?' : 'Seed Database?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction === 'reset' 
              ? 'This will permanently delete ALL data from the database. This action cannot be undone. Are you sure you want to continue?'
              : `This will add sample data to the database${includeTransfers ? ' (including transfers between sites)' : ' (without transfers)'}. If data already exists, this may create duplicates. Are you sure you want to continue?`
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            color={confirmAction === 'reset' ? 'error' : 'primary'}
            variant="contained"
          >
            {confirmAction === 'reset' ? 'Reset' : 'Seed'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DebugPage;