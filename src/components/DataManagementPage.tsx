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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  GetApp as ExportIcon,
  Publish as ImportIcon,
} from '@mui/icons-material';
import { getDatabase } from '../utils/database';

const DataManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv'>('json');
  const [selectedTable, setSelectedTable] = useState<string>('all');

  const tableOptions = [
    { value: 'all', label: 'All Data' },
    { value: 'sites', label: 'Sites' },
    { value: 'reagents', label: 'Reagents' },
    { value: 'lots', label: 'Lots' },
    { value: 'shipments', label: 'Shipments' },
    { value: 'transfers', label: 'Transfers' },
    { value: 'inventory_records', label: 'Inventory Records' },
  ];

  const exportData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const db = await getDatabase();
      let exportData: any = {};

      if (selectedTable === 'all') {
        // Export all tables
        const sites = await db.select('SELECT * FROM sites ORDER BY id');
        const reagents = await db.select('SELECT * FROM reagents ORDER BY id');
        const lots = await db.select('SELECT * FROM lots ORDER BY id');
        const shipments = await db.select('SELECT * FROM shipments ORDER BY id');
        const transfers = await db.select('SELECT * FROM transfers ORDER BY id');
        const inventoryRecords = await db.select('SELECT * FROM inventory_records ORDER BY id');

        exportData = {
          sites,
          reagents,
          lots,
          shipments,
          transfers,
          inventory_records: inventoryRecords,
          exported_at: new Date().toISOString(),
          version: '1.0'
        };
      } else {
        // Export specific table
        const data = await db.select(`SELECT * FROM ${selectedTable} ORDER BY id`);
        exportData = {
          [selectedTable]: data,
          exported_at: new Date().toISOString(),
          version: '1.0'
        };
      }

      // Create and download file
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `inventory_${selectedTable}_${timestamp}.${selectedFormat}`;
      
      let content: string;
      let mimeType: string;

      if (selectedFormat === 'json') {
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
      } else {
        // CSV format - flatten the data
        if (selectedTable === 'all') {
          content = 'CSV export for all tables is not supported. Please select a specific table or use JSON format.';
          mimeType = 'text/plain';
        } else {
          const data = exportData[selectedTable];
          if (data.length === 0) {
            content = 'No data to export';
          } else {
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map((row: any) => 
              Object.values(row).map((value: any) => 
                value === null ? '' : `"${String(value).replace(/"/g, '""')}"`
              ).join(',')
            );
            content = [headers, ...rows].join('\n');
          }
        }
        mimeType = 'text/csv';
      }

      // Create download link
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage(`Data exported successfully as ${filename}`);
    } catch (error) {
      console.error('Failed to export data:', error);
      setMessage(`Failed to export data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);
    try {
      const text = await file.text();
      let importData: any;

      if (file.name.endsWith('.json')) {
        importData = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        setMessage('CSV import is not yet supported. Please use JSON format.');
        setLoading(false);
        return;
      } else {
        setMessage('Unsupported file format. Please use JSON files.');
        setLoading(false);
        return;
      }

      const db = await getDatabase();
      let importedCount = 0;

      // Import data based on what's in the file
      const tables = ['sites', 'reagents', 'lots', 'shipments', 'transfers', 'inventory_records'];
      
      for (const table of tables) {
        if (importData[table] && Array.isArray(importData[table])) {
          const data = importData[table];
          
          for (const row of data) {
            try {
              // Remove id field to let database auto-increment
              const { id, created_at, updated_at, ...rowData } = row;
              
              const columns = Object.keys(rowData);
              const values = Object.values(rowData);
              const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
              
              const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
              await db.execute(insertQuery, values);
              importedCount++;
            } catch (error) {
              console.warn(`Failed to import row from ${table}:`, error);
            }
          }
        }
      }

      setMessage(`Import completed successfully! Imported ${importedCount} records.`);
    } catch (error) {
      console.error('Failed to import data:', error);
      setMessage(`Failed to import data: ${error}`);
    } finally {
      setLoading(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const openConfirmDialog = () => {
    setConfirmOpen(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Data Management
        </Typography>
      </Box>

      {message && (
        <Alert severity={message.includes('Failed') ? 'error' : 'success'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      <Box display="flex" flexWrap="wrap" gap={3}>
        {/* Export Section */}
        <Box flex="1" minWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ExportIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Export Data</Typography>
              </Box>
              
              <Typography color="textSecondary" paragraph>
                Export your inventory data to a file for backup or transfer to another system.
              </Typography>

              <FormControl fullWidth margin="normal">
                <InputLabel>Data to Export</InputLabel>
                <Select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  label="Data to Export"
                >
                  {tableOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Format</InputLabel>
                <Select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as 'json' | 'csv')}
                  label="Format"
                >
                  <MenuItem value="json">JSON (Recommended)</MenuItem>
                  <MenuItem value="csv" disabled={selectedTable === 'all'}>
                    CSV {selectedTable === 'all' && '(Not available for all data)'}
                  </MenuItem>
                </Select>
              </FormControl>

              <Box mt={3}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={openConfirmDialog}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
                  fullWidth
                >
                  {loading ? 'Exporting...' : 'Export Data'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Import Section */}
        <Box flex="1" minWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ImportIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">Import Data</Typography>
              </Box>
              
              <Typography color="textSecondary" paragraph>
                Import inventory data from a previously exported file. Data will be added to the existing database.
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Important:</strong> Data will be added to your existing records. 
                If you need to replace data, reset the database first using Debug Tools.
              </Alert>

              <Box mt={3}>
                <input
                  accept=".json"
                  style={{ display: 'none' }}
                  id="import-file-input"
                  type="file"
                  onChange={handleFileImport}
                  disabled={loading}
                />
                <label htmlFor="import-file-input">
                  <Button
                    variant="contained"
                    color="secondary"
                    component="span"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
                    fullWidth
                  >
                    {loading ? 'Importing...' : 'Select File to Import'}
                  </Button>
                </label>
              </Box>

              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                Supported formats: JSON files exported from this system
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Data Format Information */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Data Format Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="body2" color="textSecondary" paragraph>
            <strong>JSON Export Format:</strong> Contains all data in a structured format with metadata including export timestamp and version.
            This is the recommended format for complete data backup and restoration.
          </Typography>
          
          <Typography variant="body2" color="textSecondary" paragraph>
            <strong>CSV Export Format:</strong> Available for individual tables only. Provides comma-separated values 
            that can be opened in spreadsheet applications like Excel.
          </Typography>

          <Typography variant="body2" color="textSecondary" paragraph>
            <strong>Import Process:</strong> The system will attempt to import all recognized data from the file.
            Duplicate entries may be created if the same data is imported multiple times. 
            ID fields are automatically handled by the database.
          </Typography>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Export Data</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will export {selectedTable === 'all' ? 'all inventory data' : `${selectedTable} data`} 
            as a {selectedFormat.toUpperCase()} file. The file will be downloaded to your computer.
            Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => { setConfirmOpen(false); exportData(); }} color="primary" variant="contained">
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataManagementPage;