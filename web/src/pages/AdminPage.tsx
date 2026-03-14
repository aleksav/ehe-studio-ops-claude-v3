import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import HistoryIcon from '@mui/icons-material/History';
import PaidIcon from '@mui/icons-material/Paid';
import EventIcon from '@mui/icons-material/Event';
import ClientsPage from './ClientsPage';
import TeamPage from './TeamPage';
import AuditLogPage from './AuditLogPage';
import TaskRatesPage from './TaskRatesPage';
import PublicHolidaysPage from './PublicHolidaysPage';

const TAB_KEYS = ['clients', 'team', 'audit-log', 'task-rates', 'public-holidays'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const STORAGE_KEY = 'admin-active-tab';

function resolveInitialTab(searchParams: URLSearchParams): number {
  const tabParam = searchParams.get('tab');
  if (tabParam) {
    const idx = TAB_KEYS.indexOf(tabParam as TabKey);
    if (idx >= 0) return idx;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const idx = TAB_KEYS.indexOf(stored as TabKey);
    if (idx >= 0) return idx;
  }
  return 0;
}

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<number>(() => resolveInitialTab(searchParams));

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const key = TAB_KEYS[newValue];
    localStorage.setItem(STORAGE_KEY, key);
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
        Admin
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage clients, team members, task rates, public holidays, and view the audit log.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<BusinessIcon />} iconPosition="start" label="Clients" />
          <Tab icon={<GroupIcon />} iconPosition="start" label="Team" />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit Log" />
          <Tab icon={<PaidIcon />} iconPosition="start" label="Task Rates" />
          <Tab icon={<EventIcon />} iconPosition="start" label="Public Holidays" />
        </Tabs>
      </Box>

      {activeTab === 0 && <ClientsPage embedded />}
      {activeTab === 1 && <TeamPage embedded />}
      {activeTab === 2 && <AuditLogPage embedded />}
      {activeTab === 3 && <TaskRatesPage embedded />}
      {activeTab === 4 && <PublicHolidaysPage embedded />}
    </Box>
  );
}
