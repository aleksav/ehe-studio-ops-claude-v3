import { Box, Card, CardContent, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  const displayName = user?.team_member?.full_name ?? user?.email ?? 'there';

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
        Welcome, {displayName}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here&apos;s your studio at a glance.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 3,
        }}
      >
        {[
          { label: 'Active Projects', value: '--' },
          { label: 'Hours This Week', value: '--' },
          { label: 'Open Tasks', value: '--' },
        ].map((card) => (
          <Card
            key={card.label}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {card.label}
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {card.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
