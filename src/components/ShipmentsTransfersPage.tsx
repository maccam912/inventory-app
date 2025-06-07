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
  IconButton,
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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalShipping as ShipmentIcon,
  SwapHoriz as TransferIcon,
} from '@mui/icons-material';
import { Site, Shipment, Transfer } from '../types';
import { getDatabase } from '../utils/database';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface ShipmentWithDetails extends Shipment {
  site_name: string;
  reagent_name: string;
  lot_number: string;
  expiration_date: string;
}

interface TransferWithDetails extends Transfer {
  from_site_name: string;
  to_site_name: string;
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

const ShipmentsTransfersPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [shipments, setShipments] = useState<ShipmentWithDetails[]>([]);
  const [transfers, setTransfers] = useState<TransferWithDetails[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [lots, setLots] = useState<LotOption[]>([]);

  // Shipment form state
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentWithDetails | null>(null);
  const [shipmentFormData, setShipmentFormData] = useState<Shipment>({
    lot_id: 0,
    site_id: 0,
    quantity: 0,
    shipped_date: new Date().toISOString().split('T')[0],
    received_date: '',
  });

  // Transfer form state
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<TransferWithDetails | null>(null);
  const [transferFormData, setTransferFormData] = useState<Transfer>({
    lot_id: 0,
    from_site_id: 0,
    to_site_id: 0,
    quantity: 0,
    transfer_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadShipments();
    loadTransfers();
    loadSites();
    loadLots();
  }, []);

  const loadShipments = async () => {
    try {
      console.log('Loading shipments...');
      const db = await getDatabase();
      const result = await db.select<ShipmentWithDetails[]>(`
        SELECT s.id, s.lot_id, s.site_id, s.quantity, s.shipped_date, s.received_date,
               s.created_at, s.updated_at,
               st.name as site_name,
               r.name as reagent_name,
               l.lot_number,
               l.expiration_date
        FROM shipments s
        JOIN sites st ON s.site_id = st.id
        JOIN lots l ON s.lot_id = l.id
        JOIN reagents r ON l.reagent_id = r.id
        ORDER BY s.shipped_date DESC, s.created_at DESC
      `);
      console.log('Shipments loaded:', result);
      setShipments(result);
    } catch (error) {
      console.error('Failed to load shipments:', error);
    }
  };

  const loadTransfers = async () => {
    try {
      console.log('Loading transfers...');
      const db = await getDatabase();
      const result = await db.select<TransferWithDetails[]>(`
        SELECT t.id, t.lot_id, t.from_site_id, t.to_site_id, t.quantity, t.transfer_date,
               t.created_at, t.updated_at,
               sf.name as from_site_name,
               st.name as to_site_name,
               r.name as reagent_name,
               l.lot_number,
               l.expiration_date
        FROM transfers t
        JOIN sites sf ON t.from_site_id = sf.id
        JOIN sites st ON t.to_site_id = st.id
        JOIN lots l ON t.lot_id = l.id
        JOIN reagents r ON l.reagent_id = r.id
        ORDER BY t.transfer_date DESC, t.created_at DESC
      `);
      console.log('Transfers loaded:', result);
      setTransfers(result);
    } catch (error) {
      console.error('Failed to load transfers:', error);
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

  // Shipment handlers
  const handleShipmentSubmit = async () => {
    // Basic validation
    if (!shipmentFormData.site_id) {
      alert('Please select a site');
      return;
    }
    if (!shipmentFormData.lot_id) {
      alert('Please select a lot');
      return;
    }
    if (shipmentFormData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    try {
      console.log('Submitting shipment:', shipmentFormData);
      const db = await getDatabase();
      
      if (editingShipment?.id) {
        console.log('Updating shipment with ID:', editingShipment.id);
        const result = await db.execute(
          'UPDATE shipments SET lot_id = $1, site_id = $2, quantity = $3, shipped_date = $4, received_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
          [
            shipmentFormData.lot_id,
            shipmentFormData.site_id,
            shipmentFormData.quantity,
            shipmentFormData.shipped_date,
            shipmentFormData.received_date || null,
            editingShipment.id
          ]
        );
        console.log('Shipment update result:', result);
      } else {
        console.log('Creating new shipment');
        const result = await db.execute(
          'INSERT INTO shipments (lot_id, site_id, quantity, shipped_date, received_date) VALUES ($1, $2, $3, $4, $5)',
          [
            shipmentFormData.lot_id,
            shipmentFormData.site_id,
            shipmentFormData.quantity,
            shipmentFormData.shipped_date,
            shipmentFormData.received_date || null
          ]
        );
        console.log('Shipment insert result:', result);
      }
      
      console.log('Shipment operation completed, closing form and reloading data');
      handleShipmentClose();
      await loadShipments();
    } catch (error) {
      console.error('Failed to save shipment:', error);
      alert(`Failed to save shipment: ${error}`);
    }
  };

  const handleShipmentDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this shipment?')) {
      try {
        const db = await getDatabase();
        await db.execute('DELETE FROM shipments WHERE id = $1', [id]);
        loadShipments();
      } catch (error) {
        console.error('Failed to delete shipment:', error);
      }
    }
  };

  const handleShipmentEdit = (shipment: ShipmentWithDetails) => {
    setEditingShipment(shipment);
    setShipmentFormData({
      lot_id: shipment.lot_id,
      site_id: shipment.site_id,
      quantity: shipment.quantity,
      shipped_date: shipment.shipped_date,
      received_date: shipment.received_date || '',
    });
    setShipmentOpen(true);
  };

  const handleShipmentClose = () => {
    setShipmentOpen(false);
    setEditingShipment(null);
    setShipmentFormData({
      lot_id: 0,
      site_id: 0,
      quantity: 0,
      shipped_date: new Date().toISOString().split('T')[0],
      received_date: '',
    });
  };

  const handleShipmentAddNew = () => {
    setEditingShipment(null);
    setShipmentFormData({
      lot_id: 0,
      site_id: 0,
      quantity: 0,
      shipped_date: new Date().toISOString().split('T')[0],
      received_date: '',
    });
    setShipmentOpen(true);
  };

  // Transfer handlers
  const handleTransferSubmit = async () => {
    // Basic validation
    if (!transferFormData.from_site_id) {
      alert('Please select a from site');
      return;
    }
    if (!transferFormData.to_site_id) {
      alert('Please select a to site');
      return;
    }
    if (transferFormData.from_site_id === transferFormData.to_site_id) {
      alert('From and To sites must be different');
      return;
    }
    if (!transferFormData.lot_id) {
      alert('Please select a lot');
      return;
    }
    if (transferFormData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    try {
      console.log('Submitting transfer:', transferFormData);
      const db = await getDatabase();
      
      if (editingTransfer?.id) {
        console.log('Updating transfer with ID:', editingTransfer.id);
        const result = await db.execute(
          'UPDATE transfers SET lot_id = $1, from_site_id = $2, to_site_id = $3, quantity = $4, transfer_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
          [
            transferFormData.lot_id,
            transferFormData.from_site_id,
            transferFormData.to_site_id,
            transferFormData.quantity,
            transferFormData.transfer_date,
            editingTransfer.id
          ]
        );
        console.log('Transfer update result:', result);
      } else {
        console.log('Creating new transfer');
        const result = await db.execute(
          'INSERT INTO transfers (lot_id, from_site_id, to_site_id, quantity, transfer_date) VALUES ($1, $2, $3, $4, $5)',
          [
            transferFormData.lot_id,
            transferFormData.from_site_id,
            transferFormData.to_site_id,
            transferFormData.quantity,
            transferFormData.transfer_date
          ]
        );
        console.log('Transfer insert result:', result);
      }
      
      console.log('Transfer operation completed, closing form and reloading data');
      handleTransferClose();
      await loadTransfers();
    } catch (error) {
      console.error('Failed to save transfer:', error);
      alert(`Failed to save transfer: ${error}`);
    }
  };

  const handleTransferDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this transfer?')) {
      try {
        const db = await getDatabase();
        await db.execute('DELETE FROM transfers WHERE id = $1', [id]);
        loadTransfers();
      } catch (error) {
        console.error('Failed to delete transfer:', error);
      }
    }
  };

  const handleTransferEdit = (transfer: TransferWithDetails) => {
    setEditingTransfer(transfer);
    setTransferFormData({
      lot_id: transfer.lot_id,
      from_site_id: transfer.from_site_id,
      to_site_id: transfer.to_site_id,
      quantity: transfer.quantity,
      transfer_date: transfer.transfer_date,
    });
    setTransferOpen(true);
  };

  const handleTransferClose = () => {
    setTransferOpen(false);
    setEditingTransfer(null);
    setTransferFormData({
      lot_id: 0,
      from_site_id: 0,
      to_site_id: 0,
      quantity: 0,
      transfer_date: new Date().toISOString().split('T')[0],
    });
  };

  const handleTransferAddNew = () => {
    setEditingTransfer(null);
    setTransferFormData({
      lot_id: 0,
      from_site_id: 0,
      to_site_id: 0,
      quantity: 0,
      transfer_date: new Date().toISOString().split('T')[0],
    });
    setTransferOpen(true);
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
          Shipments & Transfers
        </Typography>
      </Box>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
        <Tab icon={<ShipmentIcon />} label="Shipments" />
        <Tab icon={<TransferIcon />} label="Transfers" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Shipments</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleShipmentAddNew}
          >
            Add Shipment
          </Button>
        </Box>

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Site</TableCell>
                    <TableCell>Reagent</TableCell>
                    <TableCell>Lot Number</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Shipped Date</TableCell>
                    <TableCell>Received Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell>{shipment.site_name}</TableCell>
                      <TableCell>{shipment.reagent_name}</TableCell>
                      <TableCell>{shipment.lot_number}</TableCell>
                      <TableCell>{shipment.quantity}</TableCell>
                      <TableCell>{shipment.shipped_date}</TableCell>
                      <TableCell>{shipment.received_date || 'Not received'}</TableCell>
                      <TableCell>
                        {shipment.received_date ? (
                          <Chip label="Received" color="success" size="small" />
                        ) : (
                          <Chip label="In Transit" color="warning" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleShipmentEdit(shipment)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => shipment.id && handleShipmentDelete(shipment.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Transfers</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleTransferAddNew}
          >
            Add Transfer
          </Button>
        </Box>

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>From Site</TableCell>
                    <TableCell>To Site</TableCell>
                    <TableCell>Reagent</TableCell>
                    <TableCell>Lot Number</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Transfer Date</TableCell>
                    <TableCell>Lot Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>{transfer.from_site_name}</TableCell>
                      <TableCell>{transfer.to_site_name}</TableCell>
                      <TableCell>{transfer.reagent_name}</TableCell>
                      <TableCell>{transfer.lot_number}</TableCell>
                      <TableCell>{transfer.quantity}</TableCell>
                      <TableCell>{transfer.transfer_date}</TableCell>
                      <TableCell>
                        {isExpired(transfer.expiration_date) ? (
                          <Chip label="Expired" color="error" size="small" />
                        ) : isExpiringSoon(transfer.expiration_date) ? (
                          <Chip label="Expiring Soon" color="warning" size="small" />
                        ) : (
                          <Chip label="Active" color="success" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleTransferEdit(transfer)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => transfer.id && handleTransferDelete(transfer.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Shipment Dialog */}
      <Dialog open={shipmentOpen} onClose={handleShipmentClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingShipment ? 'Edit Shipment' : 'Add New Shipment'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Site</InputLabel>
              <Select
                value={shipmentFormData.site_id}
                onChange={(e) => setShipmentFormData({ ...shipmentFormData, site_id: Number(e.target.value) })}
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
                value={shipmentFormData.lot_id}
                onChange={(e) => setShipmentFormData({ ...shipmentFormData, lot_id: Number(e.target.value) })}
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
              label="Quantity"
              type="number"
              value={shipmentFormData.quantity}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, quantity: Number(e.target.value) })}
              margin="normal"
              required
              inputProps={{ min: 1 }}
            />

            <TextField
              fullWidth
              label="Shipped Date"
              type="date"
              value={shipmentFormData.shipped_date}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, shipped_date: e.target.value })}
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
              required
            />

            <TextField
              fullWidth
              label="Received Date"
              type="date"
              value={shipmentFormData.received_date}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, received_date: e.target.value })}
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
              helperText="Leave empty if not yet received"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleShipmentClose}>Cancel</Button>
          <Button onClick={handleShipmentSubmit} variant="contained">
            {editingShipment ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onClose={handleTransferClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTransfer ? 'Edit Transfer' : 'Add New Transfer'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <FormControl fullWidth margin="normal" required>
              <InputLabel>From Site</InputLabel>
              <Select
                value={transferFormData.from_site_id}
                onChange={(e) => setTransferFormData({ ...transferFormData, from_site_id: Number(e.target.value) })}
                label="From Site"
              >
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name} {site.location && `(${site.location})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal" required>
              <InputLabel>To Site</InputLabel>
              <Select
                value={transferFormData.to_site_id}
                onChange={(e) => setTransferFormData({ ...transferFormData, to_site_id: Number(e.target.value) })}
                label="To Site"
              >
                {sites.filter(site => site.id !== transferFormData.from_site_id).map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name} {site.location && `(${site.location})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal" required>
              <InputLabel>Lot</InputLabel>
              <Select
                value={transferFormData.lot_id}
                onChange={(e) => setTransferFormData({ ...transferFormData, lot_id: Number(e.target.value) })}
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
              label="Quantity"
              type="number"
              value={transferFormData.quantity}
              onChange={(e) => setTransferFormData({ ...transferFormData, quantity: Number(e.target.value) })}
              margin="normal"
              required
              inputProps={{ min: 1 }}
            />

            <TextField
              fullWidth
              label="Transfer Date"
              type="date"
              value={transferFormData.transfer_date}
              onChange={(e) => setTransferFormData({ ...transferFormData, transfer_date: e.target.value })}
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTransferClose}>Cancel</Button>
          <Button onClick={handleTransferSubmit} variant="contained">
            {editingTransfer ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShipmentsTransfersPage;