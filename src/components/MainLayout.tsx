import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Business,
  Science,
  LocalShipping,
  SwapHoriz,
  Assessment,
} from '@mui/icons-material';
import SitesPage from './SitesPage';
import ReagentsLotsPage from './ReagentsLotsPage';
import InventoryPage from './InventoryPage';
import ShipmentsTransfersPage from './ShipmentsTransfersPage';
import DashboardPage from './DashboardPage';
import ReportsPage from './ReportsPage';

const drawerWidth = 240;

const MainLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleListItemClick = (index: number) => {
    setSelectedIndex(index);
    setMobileOpen(false);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, component: <DashboardPage /> },
    { text: 'Sites', icon: <Business />, component: <SitesPage /> },
    { text: 'Reagents & Lots', icon: <Science />, component: <ReagentsLotsPage /> },
    { text: 'Inventory Records', icon: <Assessment />, component: <InventoryPage /> },
    { text: 'Shipments & Transfers', icon: <LocalShipping />, component: <ShipmentsTransfersPage /> },
    { text: 'Reports', icon: <Assessment />, component: <ReportsPage /> },
  ];

  const renderContent = () => {
    const currentItem = menuItems[selectedIndex];
    if (currentItem.component) {
      return currentItem.component;
    }
    return (
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          {currentItem.text}
        </Typography>
        <Typography variant="body1">
          {currentItem.text} functionality coming soon...
        </Typography>
      </>
    );
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Inventory System
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item, index) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={selectedIndex === index}
              onClick={() => handleListItemClick(index)}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {menuItems[selectedIndex].text}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="navigation menu"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          overflow: 'auto'
        }}
      >
        <Toolbar />
        {renderContent()}
      </Box>
    </Box>
  );
};

export default MainLayout;