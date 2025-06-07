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
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Site } from '../types';
import { getDatabase, testDatabaseConnection } from '../utils/database';

const SitesPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [open, setOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState<Site>({
    name: '',
    location: '',
    is_active: true,
  });

  useEffect(() => {
    initializeComponent();
  }, []);

  const initializeComponent = async () => {
    console.log('Initializing Sites component...');
    const isConnected = await testDatabaseConnection();
    if (isConnected) {
      console.log('Database connection successful, loading sites...');
      await loadSites();
    } else {
      console.error('Database connection failed');
      alert('Failed to connect to database. Please check your setup.');
    }
  };

  const loadSites = async () => {
    try {
      console.log('Loading sites...');
      const db = await getDatabase();
      const result = await db.select<Site[]>('SELECT id, name, location, is_active FROM sites ORDER BY name');
      console.log('Sites loaded:', result);
      setSites(result);
    } catch (error) {
      console.error('Failed to load sites:', error);
      alert(`Failed to load sites: ${error}`);
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.name.trim()) {
      alert('Site name is required');
      return;
    }

    try {
      console.log('Submitting site data:', formData);
      const db = await getDatabase();
      const isActive = formData.is_active ? 1 : 0;
      
      if (editingSite?.id) {
        console.log('Updating site with ID:', editingSite.id);
        const result = await db.execute(
          'UPDATE sites SET name = $1, location = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
          [formData.name, formData.location || '', isActive, editingSite.id]
        );
        console.log('Update result:', result);
      } else {
        console.log('Creating new site');
        const result = await db.execute(
          'INSERT INTO sites (name, location, is_active) VALUES ($1, $2, $3)',
          [formData.name, formData.location || '', isActive]
        );
        console.log('Insert result:', result);
      }
      
      console.log('Operation completed, closing form and reloading data');
      handleClose();
      await loadSites();
    } catch (error) {
      console.error('Failed to save site:', error);
      alert(`Failed to save site: ${error}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this site?')) {
      try {
        const db = await getDatabase();
        await db.execute('DELETE FROM sites WHERE id = $1', [id]);
        loadSites();
      } catch (error) {
        console.error('Failed to delete site:', error);
      }
    }
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({ ...site });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingSite(null);
    setFormData({
      name: '',
      location: '',
      is_active: true,
    });
  };

  const handleAddNew = () => {
    setEditingSite(null);
    setFormData({
      name: '',
      location: '',
      is_active: true,
    });
    setOpen(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Sites Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddNew}
        >
          Add Site
        </Button>
      </Box>

      <Box sx={{ mt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Laboratory Sites
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell>{site.name}</TableCell>
                        <TableCell>{site.location || 'Not specified'}</TableCell>
                        <TableCell>
                          <Chip
                            label={site.is_active ? 'Active' : 'Inactive'}
                            color={site.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(site)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => site.id && handleDelete(site.id)}
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
      </Box>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSite ? 'Edit Site' : 'Add New Site'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Site Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              margin="normal"
              placeholder="Building, Floor, Room, etc."
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingSite ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SitesPage;