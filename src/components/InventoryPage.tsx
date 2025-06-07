import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import { Site, InventoryRecord } from '../types';
import { getDatabase } from '../utils/database';

interface InventoryWithDetails extends InventoryRecord {
  site_name: string;
  reagent_name: string;
  lot_number: string;
  expiration_date: string;
}

interface LotOption {
  id: number;
  lot_number: string;
  reagent_name: string;
  expiration_date: string;
}

const InventoryPage: React.FC = () => {
  const [inventoryRecords, setInventoryRecords] = useState<InventoryWithDetails[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<InventoryRecord>({
    lot_id: 0,
    site_id: 0,
    quantity_on_hand: 0,
    recorded_date: new Date().toISOString().split('T')[0],
    recorded_by: '',
  });

  useEffect(() => {
    loadInventoryRecords();
    loadSites();
    loadLots();
  }, []);

  const loadInventoryRecords = async () => {
    try {
      console.log('Loading inventory records...');
      const db = await getDatabase();
      const result = await db.select<InventoryWithDetails[]>(`
        SELECT ir.id, ir.lot_id, ir.site_id, ir.quantity_on_hand, 
               ir.recorded_date, ir.recorded_by, ir.created_at,
               s.name as site_name,
               r.name as reagent_name,
               l.lot_number,
               l.expiration_date
        FROM inventory_records ir
        JOIN sites s ON ir.site_id = s.id
        JOIN lots l ON ir.lot_id = l.id
        JOIN reagents r ON l.reagent_id = r.id
        ORDER BY ir.recorded_date DESC, ir.created_at DESC
      `);
      console.log('Inventory records loaded:', result);
      setInventoryRecords(result);
    } catch (error) {
      console.error('Failed to load inventory records:', error);
    }
  };

  const loadSites = async () => {
    try {
      const db = await getDatabase();
      const result = await db.select<Site[]>('SELECT id, name, location, is_active FROM sites WHERE is_active = 1 ORDER BY name');
      setSites(result);
    } catch (error) {
      console.error('Failed to load sites:', error);
    }
  };

  const loadLots = async () => {
    try {
      const db = await getDatabase();
      const result = await db.select<LotOption[]>(`
        SELECT l.id, l.lot_number, l.expiration_date, r.name as reagent_name
        FROM lots l
        JOIN reagents r ON l.reagent_id = r.id
        ORDER BY r.name, l.lot_number
      `);
      setLots(result);
    } catch (error) {
      console.error('Failed to load lots:', error);
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.site_id) {
      alert('Please select a site');
      return;
    }
    if (!formData.lot_id) {
      alert('Please select a lot');
      return;
    }
    if (formData.quantity_on_hand < 0) {
      alert('Quantity must be 0 or greater');
      return;
    }
    if (!formData.recorded_by.trim()) {
      alert('Recorded by is required');
      return;
    }

    try {
      console.log('Submitting inventory record:', formData);
      const db = await getDatabase();
      
      const result = await db.execute(
        'INSERT INTO inventory_records (lot_id, site_id, quantity_on_hand, recorded_date, recorded_by) VALUES ($1, $2, $3, $4, $5)',
        [formData.lot_id, formData.site_id, formData.quantity_on_hand, formData.recorded_date, formData.recorded_by]
      );
      console.log('Inventory record insert result:', result);
      
      handleClose();
      await loadInventoryRecords();
    } catch (error) {
      console.error('Failed to save inventory record:', error);
      alert(`Failed to save inventory record: ${error}`);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({
      lot_id: 0,
      site_id: 0,
      quantity_on_hand: 0,
      recorded_date: new Date().toISOString().split('T')[0],
      recorded_by: '',
    });
  };

  const handleAddNew = () => {
    setFormData({
      lot_id: 0,
      site_id: 0,
      quantity_on_hand: 0,
      recorded_date: new Date().toISOString().split('T')[0],
      recorded_by: '',
    });
    setOpen(true);
  };

  const isExpired = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const today = new Date();
    return expDate < today;
  };

  const isExpiringSoon = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return expDate <= thirtyDaysFromNow && expDate >= today;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Inventory Records
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddNew}
        >
          Record Inventory
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Inventory History
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Site</TableCell>
                  <TableCell>Reagent</TableCell>
                  <TableCell>Lot Number</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Recorded Date</TableCell>
                  <TableCell>Recorded By</TableCell>
                  <TableCell>Lot Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.site_name}</TableCell>
                    <TableCell>{record.reagent_name}</TableCell>
                    <TableCell>{record.lot_number}</TableCell>
                    <TableCell>{record.quantity_on_hand}</TableCell>
                    <TableCell>{record.recorded_date}</TableCell>
                    <TableCell>{record.recorded_by}</TableCell>
                    <TableCell>
                      {isExpired(record.expiration_date) ? (
                        <Chip label="Expired" color="error" size="small" />
                      ) : isExpiringSoon(record.expiration_date) ? (
                        <Chip label="Expiring Soon" color="warning" size="small" />
                      ) : (
                        <Chip label="Active" color="success" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Record Inventory</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Site</InputLabel>
              <Select
                value={formData.site_id}
                onChange={(e) => setFormData({ ...formData, site_id: Number(e.target.value) })}
                label="Site"
              >
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name} {site.location && `(${site.location})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal" required>
              <InputLabel>Lot</InputLabel>
              <Select
                value={formData.lot_id}
                onChange={(e) => setFormData({ ...formData, lot_id: Number(e.target.value) })}
                label="Lot"
              >
                {lots.map((lot) => (
                  <MenuItem key={lot.id} value={lot.id}>
                    {lot.reagent_name} - {lot.lot_number} (Exp: {lot.expiration_date})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Quantity on Hand"
              type="number"
              value={formData.quantity_on_hand}
              onChange={(e) => setFormData({ ...formData, quantity_on_hand: Number(e.target.value) })}
              margin="normal"
              required
              inputProps={{ min: 0 }}
              helperText="Enter the current quantity available at this site"
            />

            <TextField
              fullWidth
              label="Recorded Date"
              type="date"
              value={formData.recorded_date}
              onChange={(e) => setFormData({ ...formData, recorded_date: e.target.value })}
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
              required
            />

            <TextField
              fullWidth
              label="Recorded By"
              value={formData.recorded_by}
              onChange={(e) => setFormData({ ...formData, recorded_by: e.target.value })}
              margin="normal"
              required
              placeholder="Enter your name or initials"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Record
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryPage;