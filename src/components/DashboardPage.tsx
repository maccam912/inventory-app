import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { getDatabase } from '../utils/database';

interface RiskAlert {
  id: string;
  type: 'low_stock' | 'no_recent_inventory' | 'expired' | 'expiring_soon';
  severity: 'error' | 'warning' | 'info';
  site_name: string;
  reagent_name: string;
  lot_number: string;
  message: string;
  last_quantity?: number;
  last_recorded?: string;
  expiration_date?: string;
}

interface DashboardStats {
  total_sites: number;
  total_lots: number;
  expired_lots: number;
  expiring_soon_lots: number;
  sites_with_low_stock: number;
  sites_without_recent_inventory: number;
}

const DashboardPage: React.FC = () => {
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRiskAlerts(),
        loadStats(),
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const db = await getDatabase();
      
      // Get basic counts
      const sitesResult = await db.select<{total: number}[]>('SELECT COUNT(*) as total FROM sites WHERE is_active = 1');
      const lotsResult = await db.select<{total: number}[]>('SELECT COUNT(*) as total FROM lots');
      
      // Get expired lots
      const expiredResult = await db.select<{total: number}[]>(`
        SELECT COUNT(*) as total FROM lots 
        WHERE expiration_date < date('now')
      `);
      
      // Get expiring soon lots (within 30 days)
      const expiringSoonResult = await db.select<{total: number}[]>(`
        SELECT COUNT(*) as total FROM lots 
        WHERE expiration_date BETWEEN date('now') AND date('now', '+30 days')
      `);

      // Get sites without recent inventory (last 30 days)
      const sitesWithoutRecentInventory = await db.select<{count: number}[]>(`
        SELECT COUNT(DISTINCT s.id) as count
        FROM sites s
        WHERE s.is_active = 1
        AND s.id NOT IN (
          SELECT DISTINCT ir.site_id 
          FROM inventory_records ir 
          WHERE ir.recorded_date >= date('now', '-30 days')
        )
      `);

      setStats({
        total_sites: sitesResult[0]?.total || 0,
        total_lots: lotsResult[0]?.total || 0,
        expired_lots: expiredResult[0]?.total || 0,
        expiring_soon_lots: expiringSoonResult[0]?.total || 0,
        sites_with_low_stock: 0, // Will be calculated from risk alerts
        sites_without_recent_inventory: sitesWithoutRecentInventory[0]?.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadRiskAlerts = async () => {
    try {
      const db = await getDatabase();
      const alerts: RiskAlert[] = [];

      // Get the most recent inventory record for each site/lot combination
      const latestInventoryRecords = await db.select<any[]>(`
        SELECT ir.lot_id, ir.site_id, ir.quantity_on_hand, ir.recorded_date,
               s.name as site_name, r.name as reagent_name, l.lot_number, l.expiration_date,
               s.id as site_id_check, l.id as lot_id_check
        FROM inventory_records ir
        JOIN sites s ON ir.site_id = s.id
        JOIN lots l ON ir.lot_id = l.id
        JOIN reagents r ON l.reagent_id = r.id
        WHERE s.is_active = 1
        AND ir.id = (
          SELECT ir2.id 
          FROM inventory_records ir2 
          WHERE ir2.lot_id = ir.lot_id AND ir2.site_id = ir.site_id
          ORDER BY ir2.recorded_date DESC, ir2.id DESC
          LIMIT 1
        )
      `);

      // Process each latest inventory record
      latestInventoryRecords.forEach(record => {
        const daysUntilExpiration = Math.ceil((new Date(record.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if expired and still has stock
        if (daysUntilExpiration < 0 && record.quantity_on_hand > 0) {
          alerts.push({
            id: `expired_${record.lot_id}_${record.site_id}`,
            type: 'expired',
            severity: 'error',
            site_name: record.site_name,
            reagent_name: record.reagent_name,
            lot_number: record.lot_number,
            message: `Expired ${Math.abs(daysUntilExpiration)} days ago, still has ${record.quantity_on_hand} units`,
            last_quantity: record.quantity_on_hand,
            expiration_date: record.expiration_date,
          } as RiskAlert);
        }
        // Check if expiring soon (within 30 days) and has stock
        else if (daysUntilExpiration >= 0 && daysUntilExpiration <= 30 && record.quantity_on_hand > 0) {
          alerts.push({
            id: `expiring_${record.lot_id}_${record.site_id}`,
            type: 'expiring_soon',
            severity: 'warning',
            site_name: record.site_name,
            reagent_name: record.reagent_name,
            lot_number: record.lot_number,
            message: `Expires in ${daysUntilExpiration} day(s), ${record.quantity_on_hand} units remaining`,
            last_quantity: record.quantity_on_hand,
            expiration_date: record.expiration_date,
          } as RiskAlert);
        }
        // Check for low stock (active lots only)
        else if (daysUntilExpiration >= 0 && record.quantity_on_hand > 0 && record.quantity_on_hand < 5) {
          alerts.push({
            id: `low_stock_${record.lot_id}_${record.site_id}`,
            type: 'low_stock',
            severity: 'warning',
            site_name: record.site_name,
            reagent_name: record.reagent_name,
            lot_number: record.lot_number,
            message: `Low stock: only ${record.quantity_on_hand} units remaining`,
            last_quantity: record.quantity_on_hand,
            last_recorded: record.recorded_date,
          } as RiskAlert);
        }
      });

      // Find sites without recent inventory records (30+ days)
      const sitesWithoutRecentInventory = await db.select<any[]>(`
        SELECT s.id, s.name as site_name,
               COALESCE(MAX(ir.recorded_date), 'Never') as last_recorded
        FROM sites s
        LEFT JOIN inventory_records ir ON s.id = ir.site_id
        WHERE s.is_active = 1
        GROUP BY s.id, s.name
        HAVING last_recorded = 'Never' OR last_recorded < date('now', '-30 days')
      `);

      sitesWithoutRecentInventory.forEach(site => {
        const message = site.last_recorded === 'Never' 
          ? 'No inventory has ever been recorded'
          : `Last inventory recorded on ${site.last_recorded}`;
          
        alerts.push({
          id: `no_recent_${site.id}`,
          type: 'no_recent_inventory',
          severity: 'info',
          site_name: site.site_name,
          reagent_name: 'All reagents',
          lot_number: 'All lots',
          message: message,
        } as RiskAlert);
      });

      // Sort alerts by severity and then by site name
      const severityOrder = { error: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.site_name.localeCompare(b.site_name);
      });

      setRiskAlerts(alerts);
    } catch (error) {
      console.error('Failed to load risk alerts:', error);
    }
  };

  const getAlertIcon = (type: RiskAlert['type']) => {
    switch (type) {
      case 'expired':
      case 'expiring_soon':
        return <ScheduleIcon />;
      case 'low_stock':
        return <TrendingDownIcon />;
      case 'no_recent_inventory':
        return <InventoryIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const getAlertColor = (severity: RiskAlert['severity']) => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'warning';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button variant="outlined" onClick={loadDashboardData}>
          Refresh
        </Button>
      </Box>

      {/* Stats Cards */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={4}>
        <Box flex="1" minWidth="200px">
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Sites
              </Typography>
              <Typography variant="h4">
                {stats?.total_sites || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box flex="1" minWidth="200px">
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Lots
              </Typography>
              <Typography variant="h4">
                {stats?.total_lots || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1" minWidth="200px">
          <Card sx={{ borderLeft: '4px solid #f44336' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Expired Lots
              </Typography>
              <Typography variant="h4" color="error">
                {stats?.expired_lots || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1" minWidth="200px">
          <Card sx={{ borderLeft: '4px solid #ff9800' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Expiring Soon
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats?.expiring_soon_lots || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1" minWidth="200px">
          <Card sx={{ borderLeft: '4px solid #2196f3' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Low Stock Items
              </Typography>
              <Typography variant="h4" color="info.main">
                {riskAlerts.filter(alert => alert.type === 'low_stock').length}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1" minWidth="200px">
          <Card sx={{ borderLeft: '4px solid #9e9e9e' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                No Recent Inventory
              </Typography>
              <Typography variant="h4" color="text.secondary">
                {stats?.sites_without_recent_inventory || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Risk Alerts */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Risk Alerts
          </Typography>
          
          {riskAlerts.length === 0 ? (
            <Alert severity="success">
              No risk alerts at this time. Your inventory appears to be well managed!
            </Alert>
          ) : (
            <List>
              {riskAlerts.map((alert) => (
                <ListItem key={alert.id} divider>
                  <Box display="flex" alignItems="center" width="100%">
                    <Box mr={2} color={getAlertColor(alert.severity) + '.main'}>
                      {getAlertIcon(alert.type)}
                    </Box>
                    <Box flexGrow={1}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">
                              {alert.site_name} - {alert.reagent_name}
                            </Typography>
                            <Chip
                              label={alert.lot_number}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={alert.message}
                      />
                    </Box>
                    <Chip
                      label={alert.type.replace('_', ' ').toUpperCase()}
                      color={getAlertColor(alert.severity)}
                      size="small"
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardPage;