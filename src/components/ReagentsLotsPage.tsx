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
  Chip,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Reagent, Lot } from '../types';
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

interface LotWithReagent extends Lot {
  reagent_name: string;
}

const ReagentsLotsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [lots, setLots] = useState<LotWithReagent[]>([]);
  
  // Reagent form state
  const [reagentOpen, setReagentOpen] = useState(false);
  const [editingReagent, setEditingReagent] = useState<Reagent | null>(null);
  const [reagentFormData, setReagentFormData] = useState<Reagent>({
    name: '',
    description: '',
  });

  // Lot form state
  const [lotOpen, setLotOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<LotWithReagent | null>(null);
  const [lotFormData, setLotFormData] = useState<Lot>({
    lot_number: '',
    reagent_id: 0,
    expiration_date: '',
  });

  useEffect(() => {
    loadReagents();
    loadLots();
  }, []);

  const loadReagents = async () => {
    try {
      const db = await getDatabase();
      const result = await db.select<Reagent[]>('SELECT id, name, description FROM reagents ORDER BY name');
      setReagents(result);
    } catch (error) {
      console.error('Failed to load reagents:', error);
    }
  };

  const loadLots = async () => {
    try {
      const db = await getDatabase();
      const result = await db.select<LotWithReagent[]>(`
        SELECT l.id, l.lot_number, l.reagent_id, l.expiration_date, 
               l.created_at, l.updated_at, r.name as reagent_name
        FROM lots l
        JOIN reagents r ON l.reagent_id = r.id
        ORDER BY l.expiration_date ASC
      `);
      setLots(result);
    } catch (error) {
      console.error('Failed to load lots:', error);
    }
  };

  // Reagent handlers
  const handleReagentSubmit = async () => {
    // Basic validation
    if (!reagentFormData.name.trim()) {
      alert('Reagent name is required');
      return;
    }

    try {
      console.log('Submitting reagent data:', reagentFormData);
      const db = await getDatabase();
      
      if (editingReagent?.id) {
        console.log('Updating reagent with ID:', editingReagent.id);
        const result = await db.execute(
          'UPDATE reagents SET name = $1, description = $2 WHERE id = $3',
          [reagentFormData.name, reagentFormData.description || '', editingReagent.id]
        );
        console.log('Reagent update result:', result);
      } else {
        console.log('Creating new reagent');
        const result = await db.execute(
          'INSERT INTO reagents (name, description) VALUES ($1, $2)',
          [reagentFormData.name, reagentFormData.description || '']
        );
        console.log('Reagent insert result:', result);
      }
      
      console.log('Reagent operation completed, closing form and reloading data');
      handleReagentClose();
      await loadReagents();
      await loadLots(); // Reload lots to update reagent names
    } catch (error) {
      console.error('Failed to save reagent:', error);
      alert(`Failed to save reagent: ${error}`);
    }
  };

  const handleReagentDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this reagent? This will also delete all associated lots.')) {
      try {
        const db = await getDatabase();
        await db.execute('DELETE FROM reagents WHERE id = $1', [id]);
        loadReagents();
        loadLots();
      } catch (error) {
        console.error('Failed to delete reagent:', error);
      }
    }
  };

  const handleReagentEdit = (reagent: Reagent) => {
    setEditingReagent(reagent);
    setReagentFormData({ ...reagent });
    setReagentOpen(true);
  };

  const handleReagentClose = () => {
    setReagentOpen(false);
    setEditingReagent(null);
    setReagentFormData({
      name: '',
      description: '',
    });
  };

  const handleReagentAddNew = () => {
    setEditingReagent(null);
    setReagentFormData({
      name: '',
      description: '',
    });
    setReagentOpen(true);
  };

  // Lot handlers
  const handleLotSubmit = async () => {
    // Basic validation
    if (!lotFormData.lot_number.trim()) {
      alert('Lot number is required');
      return;
    }
    if (!lotFormData.reagent_id) {
      alert('Please select a reagent');
      return;
    }
    if (!lotFormData.expiration_date) {
      alert('Expiration date is required');
      return;
    }

    try {
      console.log('Submitting lot data:', lotFormData);
      const db = await getDatabase();
      
      if (editingLot?.id) {
        console.log('Updating lot with ID:', editingLot.id);
        const result = await db.execute(
          'UPDATE lots SET lot_number = $1, reagent_id = $2, expiration_date = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
          [lotFormData.lot_number, lotFormData.reagent_id, lotFormData.expiration_date, editingLot.id]
        );
        console.log('Lot update result:', result);
      } else {
        console.log('Creating new lot');
        const result = await db.execute(
          'INSERT INTO lots (lot_number, reagent_id, expiration_date) VALUES ($1, $2, $3)',
          [lotFormData.lot_number, lotFormData.reagent_id, lotFormData.expiration_date]
        );
        console.log('Lot insert result:', result);
      }
      
      console.log('Lot operation completed, closing form and reloading data');
      handleLotClose();
      await loadLots();
    } catch (error) {
      console.error('Failed to save lot:', error);
      alert(`Failed to save lot: ${error}`);
    }
  };

  const handleLotDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this lot?')) {
      try {
        const db = await getDatabase();
        await db.execute('DELETE FROM lots WHERE id = $1', [id]);
        loadLots();
      } catch (error) {
        console.error('Failed to delete lot:', error);
      }
    }
  };

  const handleLotEdit = (lot: LotWithReagent) => {
    setEditingLot(lot);
    setLotFormData({
      lot_number: lot.lot_number,
      reagent_id: lot.reagent_id,
      expiration_date: lot.expiration_date,
    });
    setLotOpen(true);
  };

  const handleLotClose = () => {
    setLotOpen(false);
    setEditingLot(null);
    setLotFormData({
      lot_number: '',
      reagent_id: 0,
      expiration_date: '',
    });
  };

  const handleLotAddNew = () => {
    setEditingLot(null);
    setLotFormData({
      lot_number: '',
      reagent_id: 0,
      expiration_date: '',
    });
    setLotOpen(true);
  };

  const isExpiringSoon = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return expDate <= thirtyDaysFromNow;
  };

  const isExpired = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const today = new Date();
    return expDate < today;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Reagents & Lots Management
        </Typography>
      </Box>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
        <Tab label="Reagents" />
        <Tab label="Lots" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Reagents</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleReagentAddNew}
          >
            Add Reagent
          </Button>
        </Box>

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reagents.map((reagent) => (
                    <TableRow key={reagent.id}>
                      <TableCell>{reagent.name}</TableCell>
                      <TableCell>{reagent.description || 'No description'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleReagentEdit(reagent)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => reagent.id && handleReagentDelete(reagent.id)}
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
          <Typography variant="h6">Lots</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleLotAddNew}
            disabled={reagents.length === 0}
          >
            Add Lot
          </Button>
        </Box>

        {reagents.length === 0 && (
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Please add reagents first before creating lots.
          </Typography>
        )}

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Lot Number</TableCell>
                    <TableCell>Reagent</TableCell>
                    <TableCell>Expiration Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>{lot.lot_number}</TableCell>
                      <TableCell>{lot.reagent_name}</TableCell>
                      <TableCell>{lot.expiration_date}</TableCell>
                      <TableCell>
                        {isExpired(lot.expiration_date) ? (
                          <Chip
                            icon={<WarningIcon />}
                            label="Expired"
                            color="error"
                            size="small"
                          />
                        ) : isExpiringSoon(lot.expiration_date) ? (
                          <Chip
                            icon={<WarningIcon />}
                            label="Expiring Soon"
                            color="warning"
                            size="small"
                          />
                        ) : (
                          <Chip
                            label="Active"
                            color="success"
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleLotEdit(lot)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => lot.id && handleLotDelete(lot.id)}
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

      {/* Reagent Dialog */}
      <Dialog open={reagentOpen} onClose={handleReagentClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingReagent ? 'Edit Reagent' : 'Add New Reagent'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Reagent Name"
              value={reagentFormData.name}
              onChange={(e) => setReagentFormData({ ...reagentFormData, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={reagentFormData.description}
              onChange={(e) => setReagentFormData({ ...reagentFormData, description: e.target.value })}
              margin="normal"
              multiline
              rows={3}
              placeholder="Optional description of the reagent"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReagentClose}>Cancel</Button>
          <Button onClick={handleReagentSubmit} variant="contained">
            {editingReagent ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lot Dialog */}
      <Dialog open={lotOpen} onClose={handleLotClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingLot ? 'Edit Lot' : 'Add New Lot'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Lot Number"
              value={lotFormData.lot_number}
              onChange={(e) => setLotFormData({ ...lotFormData, lot_number: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Reagent</InputLabel>
              <Select
                value={lotFormData.reagent_id}
                onChange={(e) => setLotFormData({ ...lotFormData, reagent_id: Number(e.target.value) })}
                label="Reagent"
              >
                {reagents.map((reagent) => (
                  <MenuItem key={reagent.id} value={reagent.id}>
                    {reagent.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Expiration Date"
              type="date"
              value={lotFormData.expiration_date}
              onChange={(e) => setLotFormData({ ...lotFormData, expiration_date: e.target.value })}
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLotClose}>Cancel</Button>
          <Button onClick={handleLotSubmit} variant="contained">
            {editingLot ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReagentsLotsPage;