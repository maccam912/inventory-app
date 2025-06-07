import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Chip,
  Button,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getDatabase } from '../utils/database';

interface Site {
  id: number;
  name: string;
}

interface Lot {
  id: number;
  lot_number: string;
  reagent_name: string;
}

interface InventoryDataPoint {
  date: string;
  quantity: number;
  event_type: 'inventory' | 'shipment' | 'transfer_in' | 'transfer_out' | 'projection';
  cumulative_quantity: number;
  event_details?: string;
}

interface UsageStats {
  total_consumed: number;
  average_daily_usage: number;
  days_of_data: number;
  projected_days_remaining: number;
}

const ReportsPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedSite, setSelectedSite] = useState<number>(0);
  const [selectedLot, setSelectedLot] = useState<number>(0);
  const [inventoryData, setInventoryData] = useState<InventoryDataPoint[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSites();
    loadLots();
  }, []);

  useEffect(() => {
    if (selectedSite || selectedLot) {
      loadInventoryChart();
    }
  }, [selectedSite, selectedLot]);

  const loadSites = async () => {
    try {
      const db = await getDatabase();
      const result = await db.select<Site[]>('SELECT id, name FROM sites WHERE is_active = 1 ORDER BY name');
      setSites(result);
    } catch (error) {
      console.error('Failed to load sites:', error);
    }
  };

  const loadLots = async () => {
    try {
      const db = await getDatabase();
      const result = await db.select<Lot[]>(`
        SELECT l.id, l.lot_number, r.name as reagent_name
        FROM lots l
        JOIN reagents r ON l.reagent_id = r.id
        ORDER BY r.name, l.lot_number
      `);
      setLots(result);
    } catch (error) {
      console.error('Failed to load lots:', error);
    }
  };

  const loadInventoryChart = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();

      // Build WHERE clause based on selections
      let siteFilter = '';
      let lotFilter = '';
      let params: any[] = [];

      if (selectedSite) {
        siteFilter = 'AND site_id = $' + (params.length + 1);
        params.push(selectedSite);
      }
      if (selectedLot) {
        lotFilter = 'AND lot_id = $' + (params.length + 1);
        params.push(selectedLot);
      }

      // For specific site/lot combination, show detailed tracking
      if (selectedSite && selectedLot) {
        await loadDetailedInventoryChart(db, selectedSite, selectedLot);
      } else {
        // For "all sites" or "all lots", show aggregated data
        await loadAggregatedInventoryChart(db, siteFilter, lotFilter, params);
      }
    } catch (error) {
      console.error('Failed to load inventory chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedInventoryChart = async (db: any, siteId: number, lotId: number) => {
    const dataPoints: InventoryDataPoint[] = [];

    // Get inventory records for this specific site/lot
    const inventoryRecords = await db.select<any[]>(`
      SELECT ir.recorded_date as date, ir.quantity_on_hand as quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM inventory_records ir
      JOIN sites s ON ir.site_id = s.id
      JOIN lots l ON ir.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE ir.site_id = $1 AND ir.lot_id = $2
      ORDER BY ir.recorded_date ASC
    `, [siteId, lotId]);

    // Get shipments to this site for this lot
    const shipments = await db.select<any[]>(`
      SELECT sh.received_date as date, sh.quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM shipments sh
      JOIN sites s ON sh.site_id = s.id
      JOIN lots l ON sh.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE sh.site_id = $1 AND sh.lot_id = $2 AND sh.received_date IS NOT NULL
      ORDER BY sh.received_date ASC
    `, [siteId, lotId]);

    // Get transfers for this site/lot
    const transfersOut = await db.select<any[]>(`
      SELECT t.transfer_date as date, -t.quantity as quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM transfers t
      JOIN sites s ON t.from_site_id = s.id
      JOIN lots l ON t.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE t.from_site_id = $1 AND t.lot_id = $2
      ORDER BY t.transfer_date ASC
    `, [siteId, lotId]);

    const transfersIn = await db.select<any[]>(`
      SELECT t.transfer_date as date, t.quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM transfers t
      JOIN sites s ON t.to_site_id = s.id
      JOIN lots l ON t.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE t.to_site_id = $1 AND t.lot_id = $2
      ORDER BY t.transfer_date ASC
    `, [siteId, lotId]);

    // Combine and sort all events
    const allEvents: any[] = [
      ...inventoryRecords.map(r => ({ ...r, event_type: 'inventory' })),
      ...shipments.map(s => ({ ...s, event_type: 'shipment' })),
      ...transfersOut.map(t => ({ ...t, event_type: 'transfer_out' })),
      ...transfersIn.map(t => ({ ...t, event_type: 'transfer_in' })),
    ].filter(event => event.date) // Remove events without dates
     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Track inventory level through events
    let currentQuantity = 0;
    let hasInventoryBaseline = false;

    allEvents.forEach(event => {
      if (event.event_type === 'inventory') {
        // Inventory records are absolute values
        currentQuantity = event.quantity;
        hasInventoryBaseline = true;
      } else if (hasInventoryBaseline) {
        // Only apply shipments/transfers after we have an inventory baseline
        if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
          currentQuantity += event.quantity;
        } else if (event.event_type === 'transfer_out') {
          currentQuantity += event.quantity; // quantity is already negative
        }
      }

      dataPoints.push({
        date: event.date,
        quantity: event.quantity,
        event_type: event.event_type,
        cumulative_quantity: currentQuantity,
        event_details: `${event.reagent_name} - ${event.lot_number} @ ${event.site_name}`,
      });
    });

    // Calculate usage statistics
    const inventorySnapshots = dataPoints.filter(p => p.event_type === 'inventory');
    if (inventorySnapshots.length >= 2) {
      const firstSnapshot = inventorySnapshots[0];
      const lastSnapshot = inventorySnapshots[inventorySnapshots.length - 1];
      const totalConsumed = firstSnapshot.quantity - lastSnapshot.quantity;
      const daysOfData = Math.max(1, (new Date(lastSnapshot.date).getTime() - new Date(firstSnapshot.date).getTime()) / (1000 * 60 * 60 * 24));
      const averageDailyUsage = totalConsumed / daysOfData;
      
      setUsageStats({
        total_consumed: Math.max(0, totalConsumed),
        average_daily_usage: Math.max(0, averageDailyUsage),
        days_of_data: Math.round(daysOfData),
        projected_days_remaining: averageDailyUsage > 0 ? Math.round(lastSnapshot.quantity / averageDailyUsage) : 0,
      });

      // Add projection points if we have positive usage
      if (averageDailyUsage > 0 && lastSnapshot.quantity > 0) {
        const projectionDays = Math.min(90, Math.ceil(lastSnapshot.quantity / averageDailyUsage));
        const startDate = new Date(lastSnapshot.date);
        
        for (let i = 1; i <= projectionDays; i++) {
          const projectionDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
          const projectedQuantity = Math.max(0, lastSnapshot.quantity - (averageDailyUsage * i));
          
          dataPoints.push({
            date: projectionDate.toISOString().split('T')[0],
            quantity: projectedQuantity,
            event_type: 'projection',
            cumulative_quantity: projectedQuantity,
            event_details: 'Projected usage based on historical consumption',
          });

          if (projectedQuantity <= 0) break;
        }
      }
    }

    setInventoryData(dataPoints);
  };

  const loadAggregatedInventoryChart = async (db: any, siteFilter: string, lotFilter: string, params: any[]) => {
    // For aggregated view, show total quantities across all selected sites/lots
    const inventoryRecords = await db.select<any[]>(`
      SELECT ir.recorded_date as date, 
             SUM(ir.quantity_on_hand) as total_quantity,
             COUNT(DISTINCT ir.site_id) as site_count,
             COUNT(DISTINCT ir.lot_id) as lot_count
      FROM inventory_records ir
      JOIN sites s ON ir.site_id = s.id
      JOIN lots l ON ir.lot_id = l.id
      WHERE s.is_active = 1 ${siteFilter} ${lotFilter}
      GROUP BY ir.recorded_date
      ORDER BY ir.recorded_date ASC
    `, params);

    const dataPoints: InventoryDataPoint[] = inventoryRecords.map(record => ({
      date: record.date,
      quantity: record.total_quantity,
      event_type: 'inventory' as const,
      cumulative_quantity: record.total_quantity,
      event_details: `Total across ${record.site_count} site(s), ${record.lot_count} lot(s)`,
    }));

    // Calculate basic stats for aggregated view
    if (dataPoints.length >= 2) {
      const firstSnapshot = dataPoints[0];
      const lastSnapshot = dataPoints[dataPoints.length - 1];
      const totalChange = lastSnapshot.quantity - firstSnapshot.quantity;
      const daysOfData = Math.max(1, (new Date(lastSnapshot.date).getTime() - new Date(firstSnapshot.date).getTime()) / (1000 * 60 * 60 * 24));
      
      setUsageStats({
        total_consumed: Math.max(0, -totalChange), // If negative change, that's consumption
        average_daily_usage: Math.max(0, -totalChange / daysOfData),
        days_of_data: Math.round(daysOfData),
        projected_days_remaining: 0, // Don't project for aggregated view
      });
    }

    setInventoryData(dataPoints);
  };

  const formatTooltip = (value: any, name: string, props: any) => {
    if (name === 'cumulative_quantity') {
      return [`${value} units`, 'Inventory Level'];
    }
    return [value, name];
  };

  const formatLabelTooltip = (label: string, payload: any[]) => {
    if (payload && payload.length > 0) {
      const data = payload[0].payload;
      return `${label} - ${data.event_details}`;
    }
    return label;
  };

  const getFilterDescription = () => {
    const parts = [];
    if (selectedSite) {
      const site = sites.find(s => s.id === selectedSite);
      parts.push(`Site: ${site?.name}`);
    }
    if (selectedLot) {
      const lot = lots.find(l => l.id === selectedLot);
      parts.push(`Lot: ${lot?.reagent_name} - ${lot?.lot_number}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'All sites and lots';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Reports & Analytics
        </Typography>
        <Button variant="outlined" onClick={loadInventoryChart}>
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Site</InputLabel>
                <Select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(Number(e.target.value))}
                  label="Site"
                >
                  <MenuItem value={0}>All Sites</MenuItem>
                  {sites.map((site) => (
                    <MenuItem key={site.id} value={site.id}>
                      {site.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Lot</InputLabel>
                <Select
                  value={selectedLot}
                  onChange={(e) => setSelectedLot(Number(e.target.value))}
                  label="Lot"
                >
                  <MenuItem value={0}>All Lots</MenuItem>
                  {lots.map((lot) => (
                    <MenuItem key={lot.id} value={lot.id}>
                      {lot.reagent_name} - {lot.lot_number}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={2}>
            <Chip label={getFilterDescription()} variant="outlined" />
          </Box>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usageStats && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Usage Statistics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary" gutterBottom>
                  Total Consumed
                </Typography>
                <Typography variant="h5">
                  {usageStats.total_consumed.toFixed(1)} units
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary" gutterBottom>
                  Avg Daily Usage
                </Typography>
                <Typography variant="h5">
                  {usageStats.average_daily_usage.toFixed(2)} units/day
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary" gutterBottom>
                  Days of Data
                </Typography>
                <Typography variant="h5">
                  {usageStats.days_of_data} days
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary" gutterBottom>
                  Est. Days Remaining
                </Typography>
                <Typography variant="h5" color={usageStats.projected_days_remaining < 30 ? 'warning.main' : 'text.primary'}>
                  {usageStats.projected_days_remaining} days
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Inventory Chart */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Inventory Levels Over Time
          </Typography>
          
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="400px">
              <CircularProgress />
            </Box>
          ) : inventoryData.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="400px">
              <Typography color="textSecondary">
                No data available for the selected filters
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={inventoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  label={{ value: 'Quantity (units)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={formatTooltip}
                  labelFormatter={formatLabelTooltip}
                />
                <Legend />
                
                {/* Main inventory line */}
                <Line
                  type="monotone"
                  dataKey="cumulative_quantity"
                  stroke="#2196f3"
                  strokeWidth={2}
                  dot={(props) => {
                    const { payload } = props;
                    if (payload.event_type === 'projection') {
                      return <circle {...props} fill="#ff9800" strokeWidth={2} r={3} strokeDasharray="5,5" />;
                    }
                    return <circle {...props} fill="#2196f3" r={4} />;
                  }}
                  strokeDasharray={(entry) => entry && entry.event_type === 'projection' ? '5,5' : '0'}
                />
                
                {/* Reference line for low stock */}
                <ReferenceLine y={5} stroke="#f44336" strokeDasharray="5 5" label="Low Stock Threshold" />
              </LineChart>
            </ResponsiveContainer>
          )}
          
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              • Solid line shows actual inventory levels from recorded data
              <br />
              • Dashed line shows projected usage based on historical consumption rates
              <br />
              • Red dashed line indicates low stock threshold (5 units)
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReportsPage;