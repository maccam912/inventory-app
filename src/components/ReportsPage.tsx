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
  CircularProgress,
  Chip,
  Button,
  TextField,
} from '@mui/material';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
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
  cumulative_received: number;
  cumulative_used: number;
  current_inventory: number;
  event_type: 'inventory' | 'shipment' | 'transfer_in' | 'transfer_out';
  event_details: string;
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
  const [simulatedToday, setSimulatedToday] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Chart visibility state
  const [chartVisibility, setChartVisibility] = useState({
    totalReceived: true,
    totalUsed: true,
    currentInventory: true,
    lowStockLine: true,
  });

  useEffect(() => {
    loadSites();
    loadLots();
  }, []);

  useEffect(() => {
    if (selectedLot) {
      loadInventoryChart();
    } else {
      setInventoryData([]);
      setUsageStats(null);
    }
  }, [selectedSite, selectedLot, simulatedToday]);

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
    if (!selectedLot) return;
    
    setLoading(true);
    try {
      const db = await getDatabase();
      if (selectedSite && selectedLot) {
        // Show detailed CFD for specific site/lot
        await loadCumulativeFlowChart(db, selectedSite, selectedLot);
      } else if (selectedLot) {
        // Show aggregated data across all sites for this lot
        await loadAggregatedLotChart(db, selectedLot);
      }
    } catch (error) {
      console.error('Failed to load inventory chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCumulativeFlowChart = async (db: any, siteId: number, lotId: number) => {
    const dataPoints: InventoryDataPoint[] = [];

    // Get all events for this specific site/lot combination
    // Get shipments received at this site for this lot (up to simulated today)
    const shipments = await db.select(`
      SELECT sh.received_date as date, sh.quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM shipments sh
      JOIN sites s ON sh.site_id = s.id
      JOIN lots l ON sh.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE sh.site_id = $1 AND sh.lot_id = $2 
      AND sh.received_date IS NOT NULL 
      AND sh.received_date <= $3
      ORDER BY sh.received_date ASC
    `, [siteId, lotId, simulatedToday]);

    // Get transfers into this site for this lot (up to simulated today)
    const transfersIn = await db.select(`
      SELECT t.transfer_date as date, t.quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM transfers t
      JOIN sites s ON t.to_site_id = s.id
      JOIN lots l ON t.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE t.to_site_id = $1 AND t.lot_id = $2 AND t.transfer_date <= $3
      ORDER BY t.transfer_date ASC
    `, [siteId, lotId, simulatedToday]);

    // Get transfers out of this site for this lot (up to simulated today)
    const transfersOut = await db.select(`
      SELECT t.transfer_date as date, -t.quantity as quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM transfers t
      JOIN sites s ON t.from_site_id = s.id
      JOIN lots l ON t.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE t.from_site_id = $1 AND t.lot_id = $2 AND t.transfer_date <= $3
      ORDER BY t.transfer_date ASC
    `, [siteId, lotId, simulatedToday]);

    // Get inventory snapshots for this site/lot (up to simulated today)
    const inventoryRecords = await db.select(`
      SELECT ir.recorded_date as date, ir.quantity_on_hand as quantity,
             s.name as site_name, r.name as reagent_name, l.lot_number
      FROM inventory_records ir
      JOIN sites s ON ir.site_id = s.id
      JOIN lots l ON ir.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE ir.site_id = $1 AND ir.lot_id = $2 AND ir.recorded_date <= $3
      ORDER BY ir.recorded_date ASC
    `, [siteId, lotId, simulatedToday]);

    // Combine all receiving events (shipments + transfers in)
    const receivingEvents = [
      ...shipments.map((s: any) => ({ ...s, event_type: 'shipment' as const })),
      ...transfersIn.map((t: any) => ({ ...t, event_type: 'transfer_in' as const })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Combine all outgoing events (transfers out)
    const outgoingEvents = transfersOut.map((t: any) => ({ ...t, event_type: 'transfer_out' as const }));

    // All events combined
    const allEvents = [
      ...receivingEvents,
      ...outgoingEvents,
      ...inventoryRecords.map((r: any) => ({ ...r, event_type: 'inventory' as const })),
    ].filter(event => event.date)
     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate cumulative flow
    let cumulativeReceived = 0;
    let currentInventory = 0;
    let hasFirstInventory = false;

    allEvents.forEach(event => {
      // Track cumulative received (only goes up, never down)
      if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
        cumulativeReceived += event.quantity;
      } else if (event.event_type === 'transfer_out') {
        // Transfers out reduce cumulative received (since we're sending it elsewhere)
        cumulativeReceived += event.quantity; // quantity is already negative
      }

      // Track current inventory
      if (event.event_type === 'inventory') {
        currentInventory = event.quantity;
        hasFirstInventory = true;
      } else if (hasFirstInventory) {
        // Apply changes to inventory after we have a baseline
        if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
          currentInventory += event.quantity;
        } else if (event.event_type === 'transfer_out') {
          currentInventory += event.quantity; // quantity is already negative
        }
      } else if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
        // Before first inventory record, assume inventory equals cumulative received
        // (don't assume zero inventory before first record)
        currentInventory = cumulativeReceived;
      }

      // Calculate cumulative used = cumulative received - current inventory
      const cumulativeUsed = Math.max(0, cumulativeReceived - currentInventory);

      dataPoints.push({
        date: event.date,
        cumulative_received: cumulativeReceived,
        cumulative_used: cumulativeUsed,
        current_inventory: currentInventory,
        event_type: event.event_type,
        event_details: `${event.reagent_name} - ${event.lot_number} @ ${event.site_name}`,
      });
    });

    // Calculate usage statistics based on the CFD data
    if (dataPoints.length > 0) {
      const lastDataPoint = dataPoints[dataPoints.length - 1];
      const firstDataPoint = dataPoints[0];
      
      // Total consumed = cumulative used (red area)
      const totalConsumed = lastDataPoint.cumulative_used;
      
      // Get the time span from first to last data point
      const daysOfData = Math.max(1, (new Date(lastDataPoint.date).getTime() - new Date(firstDataPoint.date).getTime()) / (1000 * 60 * 60 * 24));
      const averageDailyUsage = Math.max(0, totalConsumed / daysOfData);
      
      setUsageStats({
        total_consumed: Math.max(0, totalConsumed),
        average_daily_usage: averageDailyUsage,
        days_of_data: Math.round(daysOfData),
        projected_days_remaining: averageDailyUsage > 0 ? Math.round(lastDataPoint.current_inventory / averageDailyUsage) : 0,
      });
    } else {
      setUsageStats(null);
    }

    setInventoryData(dataPoints);
  };

  const loadAggregatedLotChart = async (db: any, lotId: number) => {
    const dataPoints: InventoryDataPoint[] = [];

    // Get all shipments for this lot across all sites (up to simulated today)
    const shipments = await db.select(`
      SELECT sh.received_date as date, SUM(sh.quantity) as quantity,
             r.name as reagent_name, l.lot_number
      FROM shipments sh
      JOIN lots l ON sh.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE sh.lot_id = $1 
      AND sh.received_date IS NOT NULL 
      AND sh.received_date <= $2
      GROUP BY sh.received_date, r.name, l.lot_number
      ORDER BY sh.received_date ASC
    `, [lotId, simulatedToday]);

    // Get all transfers for this lot across all sites (up to simulated today)
    const transfersIn = await db.select(`
      SELECT t.transfer_date as date, SUM(t.quantity) as quantity,
             r.name as reagent_name, l.lot_number
      FROM transfers t
      JOIN lots l ON t.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE t.lot_id = $1 AND t.transfer_date <= $2
      GROUP BY t.transfer_date, r.name, l.lot_number
      ORDER BY t.transfer_date ASC
    `, [lotId, simulatedToday]);

    const transfersOut = await db.select(`
      SELECT t.transfer_date as date, -SUM(t.quantity) as quantity,
             r.name as reagent_name, l.lot_number
      FROM transfers t
      JOIN lots l ON t.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE t.lot_id = $1 AND t.transfer_date <= $2
      GROUP BY t.transfer_date, r.name, l.lot_number
      ORDER BY t.transfer_date ASC
    `, [lotId, simulatedToday]);

    // Get aggregated inventory records for this lot (sum across all sites by date)
    const inventoryRecords = await db.select(`
      SELECT ir.recorded_date as date, SUM(ir.quantity_on_hand) as quantity,
             r.name as reagent_name, l.lot_number
      FROM inventory_records ir
      JOIN lots l ON ir.lot_id = l.id
      JOIN reagents r ON l.reagent_id = r.id
      WHERE ir.lot_id = $1 AND ir.recorded_date <= $2
      GROUP BY ir.recorded_date, r.name, l.lot_number
      ORDER BY ir.recorded_date ASC
    `, [lotId, simulatedToday]);

    // Combine all events
    const allEvents = [
      ...shipments.map((s: any) => ({ ...s, event_type: 'shipment' as const })),
      ...transfersIn.map((t: any) => ({ ...t, event_type: 'transfer_in' as const })),
      ...transfersOut.map((t: any) => ({ ...t, event_type: 'transfer_out' as const })),
      ...inventoryRecords.map((r: any) => ({ ...r, event_type: 'inventory' as const })),
    ].filter(event => event.date)
     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate cumulative flow for aggregated data
    let cumulativeReceived = 0;
    let currentInventory = 0;
    let hasFirstInventory = false;

    allEvents.forEach(event => {
      // Track cumulative received across all sites
      if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
        cumulativeReceived += event.quantity;
      } else if (event.event_type === 'transfer_out') {
        cumulativeReceived += event.quantity; // quantity is already negative
      }

      // Track current inventory (aggregated across sites)
      if (event.event_type === 'inventory') {
        currentInventory = event.quantity;
        hasFirstInventory = true;
      } else if (hasFirstInventory) {
        // Apply changes to inventory after we have a baseline
        if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
          currentInventory += event.quantity;
        } else if (event.event_type === 'transfer_out') {
          currentInventory += event.quantity; // quantity is already negative
        }
      } else if (event.event_type === 'shipment' || event.event_type === 'transfer_in') {
        // Before first inventory record, assume inventory equals cumulative received
        currentInventory = cumulativeReceived;
      }

      // Calculate cumulative used = cumulative received - current inventory
      const cumulativeUsed = Math.max(0, cumulativeReceived - currentInventory);

      dataPoints.push({
        date: event.date,
        cumulative_received: cumulativeReceived,
        cumulative_used: cumulativeUsed,
        current_inventory: currentInventory,
        event_type: event.event_type,
        event_details: `${event.reagent_name} - ${event.lot_number} (All Sites)`,
      });
    });

    // Calculate usage statistics for aggregated data
    if (dataPoints.length > 0) {
      const lastDataPoint = dataPoints[dataPoints.length - 1];
      const firstDataPoint = dataPoints[0];
      
      // Total consumed = cumulative used (red area)
      const totalConsumed = lastDataPoint.cumulative_used;
      
      // Get the time span from first to last data point
      const daysOfData = Math.max(1, (new Date(lastDataPoint.date).getTime() - new Date(firstDataPoint.date).getTime()) / (1000 * 60 * 60 * 24));
      const averageDailyUsage = Math.max(0, totalConsumed / daysOfData);
      
      setUsageStats({
        total_consumed: Math.max(0, totalConsumed),
        average_daily_usage: averageDailyUsage,
        days_of_data: Math.round(daysOfData),
        projected_days_remaining: averageDailyUsage > 0 ? Math.round(lastDataPoint.current_inventory / averageDailyUsage) : 0,
      });
    } else {
      setUsageStats(null);
    }

    setInventoryData(dataPoints);
  };

  const formatTooltip = (value: any, name: string) => {
    if (name === 'cumulative_received') {
      return [`${value} units`, 'Total Received'];
    } else if (name === 'cumulative_used') {
      return [`${value} units`, 'Total Used'];
    } else if (name === 'current_inventory') {
      return [`${value} units`, 'Current Inventory'];
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
    if (selectedLot && selectedSite) {
      return parts.join(', ');
    } else if (selectedLot && !selectedSite) {
      return `${parts[0]} (All Sites)`;
    } else if (parts.length === 1) {
      return parts[0] + ' (select lot to view chart)';
    }
    return 'Please select a lot to view cumulative flow diagram';
  };

  const toggleChartComponent = (component: keyof typeof chartVisibility) => {
    setChartVisibility(prev => ({
      ...prev,
      [component]: !prev[component]
    }));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Reports & Analytics
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <TextField
            label="Simulated Date"
            type="date"
            value={simulatedToday}
            onChange={(e) => setSimulatedToday(e.target.value)}
            size="small"
            InputLabelProps={{
              shrink: true,
            }}
            helperText="View data as of this date"
            sx={{ minWidth: 200 }}
          />
          <Button variant="outlined" onClick={loadInventoryChart}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={3}>
            <Box flex="1" minWidth="250px">
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
            </Box>
            <Box flex="1" minWidth="250px">
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
            </Box>
          </Box>
          <Box mt={2} display="flex" gap={1} alignItems="center">
            <Chip label={getFilterDescription()} variant="outlined" />
            <Chip 
              label={`Viewing as of: ${simulatedToday}`} 
              variant="outlined" 
              color="primary"
              size="small"
            />
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
            <Box display="flex" flexWrap="wrap" gap={3}>
              <Box flex="1" minWidth="200px">
                <Typography color="textSecondary" gutterBottom>
                  Total Consumed
                </Typography>
                <Typography variant="h5">
                  {usageStats.total_consumed.toFixed(1)} units
                </Typography>
              </Box>
              <Box flex="1" minWidth="200px">
                <Typography color="textSecondary" gutterBottom>
                  Avg Daily Usage
                </Typography>
                <Typography variant="h5">
                  {usageStats.average_daily_usage.toFixed(2)} units/day
                </Typography>
              </Box>
              <Box flex="1" minWidth="200px">
                <Typography color="textSecondary" gutterBottom>
                  Days of Data
                </Typography>
                <Typography variant="h5">
                  {usageStats.days_of_data} days
                </Typography>
              </Box>
              <Box flex="1" minWidth="200px">
                <Typography color="textSecondary" gutterBottom>
                  Est. Days Remaining
                </Typography>
                <Typography variant="h5" color={usageStats.projected_days_remaining < 30 ? 'warning.main' : 'text.primary'}>
                  {usageStats.projected_days_remaining} days
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Cumulative Flow Chart */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Cumulative Flow Diagram
            </Typography>
            {selectedLot && (
              <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                <Typography variant="caption" color="textSecondary">
                  Click to show/hide chart components:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    label="Total Received"
                    onClick={() => toggleChartComponent('totalReceived')}
                    sx={{ 
                      backgroundColor: chartVisibility.totalReceived ? '#4caf50' : '#e0e0e0',
                      color: chartVisibility.totalReceived ? 'white' : 'black',
                      '&:hover': { backgroundColor: chartVisibility.totalReceived ? '#45a049' : '#d0d0d0' }
                    }}
                    clickable
                  />
                  <Chip
                    label="Total Used"
                    onClick={() => toggleChartComponent('totalUsed')}
                    sx={{ 
                      backgroundColor: chartVisibility.totalUsed ? '#f44336' : '#e0e0e0',
                      color: chartVisibility.totalUsed ? 'white' : 'black',
                      '&:hover': { backgroundColor: chartVisibility.totalUsed ? '#e53935' : '#d0d0d0' }
                    }}
                    clickable
                  />
                  <Chip
                    label="Current Inventory"
                    onClick={() => toggleChartComponent('currentInventory')}
                    sx={{ 
                      backgroundColor: chartVisibility.currentInventory ? '#2196f3' : '#e0e0e0',
                      color: chartVisibility.currentInventory ? 'white' : 'black',
                      '&:hover': { backgroundColor: chartVisibility.currentInventory ? '#1976d2' : '#d0d0d0' }
                    }}
                    clickable
                  />
                  <Chip
                    label="Low Stock Line"
                    onClick={() => toggleChartComponent('lowStockLine')}
                    sx={{ 
                      backgroundColor: chartVisibility.lowStockLine ? '#ff9800' : '#e0e0e0',
                      color: chartVisibility.lowStockLine ? 'white' : 'black',
                      '&:hover': { backgroundColor: chartVisibility.lowStockLine ? '#f57c00' : '#d0d0d0' }
                    }}
                    clickable
                  />
                </Box>
              </Box>
            )}
          </Box>
          
          {!selectedLot ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="400px">
              <Typography color="textSecondary" textAlign="center">
                Please select a lot to view the cumulative flow diagram.
                <br />
                Select both site and lot for detailed analysis, or just lot for aggregated view across all sites.
                <br />
                This chart shows total received inventory vs. total used inventory over time.
              </Typography>
            </Box>
          ) : loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="400px">
              <CircularProgress />
            </Box>
          ) : inventoryData.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="400px">
              <Typography color="textSecondary">
                No data available for this site/lot combination
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <ComposedChart data={inventoryData}>
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
                
                {/* Cumulative received area (total inventory that has entered this site) */}
                {chartVisibility.totalReceived && (
                  <Area
                    type="stepAfter"
                    dataKey="cumulative_received"
                    stroke="#4caf50"
                    fill="#4caf50"
                    fillOpacity={0.3}
                    strokeWidth={3}
                    name="Total Received"
                  />
                )}
                
                {/* Cumulative used area (total inventory consumed) */}
                {chartVisibility.totalUsed && (
                  <Area
                    type="monotone"
                    dataKey="cumulative_used"
                    stroke="#f44336"
                    fill="#f44336"
                    fillOpacity={0.4}
                    strokeWidth={3}
                    name="Total Used"
                  />
                )}
                
                {/* Current inventory line (what's actually on hand) */}
                {chartVisibility.currentInventory && (
                  <Line
                    type="monotone"
                    dataKey="current_inventory"
                    stroke="#2196f3"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { payload } = props;
                      if (payload && payload.event_type === 'inventory') {
                        return <circle {...props} fill="#2196f3" r={4} />;
                      }
                      return <circle {...props} fill="transparent" r={0} />;
                    }}
                    name="Current Inventory"
                  />
                )}
                
                {/* Reference line for low stock */}
                {chartVisibility.lowStockLine && (
                  <ReferenceLine y={5} stroke="#ff9800" strokeDasharray="5 5" label="Low Stock Threshold" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
          
          {selectedLot && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                • <span style={{color: '#4caf50'}}>Green area</span>: Total quantity received {selectedSite ? 'at this site' : 'across all sites'} (shipments + transfers in - transfers out)
                <br />
                • <span style={{color: '#f44336'}}>Red area</span>: Total quantity consumed (calculated from inventory records)
                <br />
                • <span style={{color: '#2196f3'}}>Blue line</span>: Current inventory on hand (from inventory records)
                <br />
                • The gap between green and red areas represents current inventory + waste/spoilage
                {!selectedSite && (
                  <>
                    <br />
                    • <strong>Aggregated view</strong>: Data summed across all sites for this lot
                  </>
                )}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReportsPage;